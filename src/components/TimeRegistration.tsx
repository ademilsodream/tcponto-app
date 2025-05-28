import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import TimeRegistrationProgress from './TimeRegistrationProgress';
import { useToast } from '@/hooks/use-toast';

// Importar o tipo Database do seu arquivo de tipos Supabase
// Assumindo que 'locations' é jsonb no seu schema Supabase
import { Database } from '@/types/supabase'; // Ajuste o caminho conforme necessário

// Tipos inferidos do banco de dados
type TimeRecordRow = Database['public']['Tables']['time_records']['Row'];

// Tipo para a estrutura de localização dentro do campo 'locations'
interface LocationDetails {
  lat: number;
  lng: number;
  address: string; // Endereço formatado
}

// Tipo para o campo 'locations' que agora é um objeto JSON
interface TimeRecordLocations {
  clockIn?: LocationDetails | null;
  lunchStart?: LocationDetails | null;
  lunchEnd?: LocationDetails | null;
  clockOut?: LocationDetails | null;
  // Adicione outros tipos de ponto se existirem
}

// Atualizar o tipo TimeRecord para usar a nova estrutura de locations
interface TimeRecord {
  id: string;
  date: string;
  clock_in: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  clock_out: string | null;
  status: string;
  locations: TimeRecordLocations | null; // Agora é um objeto estruturado
}


interface TimeRegistrationProps {
  selectedDate: string;
}

// Função para obter o endereço a partir das coordenadas usando Nominatim
const getStreetAddress = async (latitude: number, longitude: number): Promise<string> => {
  // URL do endpoint de geocodificação reversa do Nominatim
  // zoom=18 geralmente dá detalhes de rua e número
  // addressdetails=1 inclui componentes do endereço
  const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;

  try {
    const response = await fetch(nominatimUrl, {
      headers: {
        // Nominatim requer um User-Agent. Substitua pelo nome da sua aplicação e um contato.
        'User-Agent': 'YourAppName/1.0 (your-email@example.com)' // <-- MUDE ISSO!
      }
    });

    if (!response.ok) {
      // Tenta ler o erro da resposta se disponível
      const errorText = await response.text();
      console.error(`Erro HTTP ao obter endereço: ${response.status} - ${errorText}`);
      throw new Error(`Erro ao obter endereço: ${response.status}`);
    }

    const data = await response.json();

    // Verifica se a resposta contém um endereço
    if (data && data.display_name) {
      // Nominatim fornece display_name que é o endereço completo formatado
      // Você também pode construir o endereço a partir de data.address
      const addressComponents = data.address;
      let formattedAddress = data.display_name; // Endereço completo padrão

      // Exemplo de como construir um endereço mais específico se necessário
      // Os campos disponíveis em addressComponents variam muito dependendo da localização
      const street = addressComponents.road || addressComponents.pedestrian || '';
      const houseNumber = addressComponents.house_number || '';
      const neighbourhood = addressComponents.neighbourhood || addressComponents.suburb || '';
      const city = addressComponents.city || addressComponents.town || addressComponents.village || '';
      const state = addressComponents.state || '';
      const postcode = addressComponents.postcode || '';
      const country = addressComponents.country || '';

      // Constrói um formato específico (ajuste conforme sua necessidade)
      // Ex: Rua X, 123, Bairro Y - Cidade Z/UF - CEP: 00000-000, País
      formattedAddress = `${street}${houseNumber ? ', ' + houseNumber : ''}${neighbourhood ? ', ' + neighbourhood : ''}${city ? ' - ' + city : ''}${state ? '/' + state : ''}${postcode ? ' - CEP: ' + postcode : ''}${country ? ', ' + country : ''}`;

      // Limpa vírgulas/espaços extras no início ou fim
      formattedAddress = formattedAddress.replace(/^[,\s]+|[,\s]+$/g, '');
      formattedAddress = formattedAddress.replace(/,\s*,/g, ','); // Substitui vírgulas duplas

      // Retorna o endereço construído ou o display_name se a construção falhar/for vazia
      return formattedAddress || data.display_name || 'Endereço não encontrado';

    } else {
      // Se display_name não estiver na resposta, pode significar que não encontrou endereço
      console.warn('Nominatim não encontrou endereço para as coordenadas.');
      return 'Endereço não encontrado';
    }
  } catch (error) {
    console.error('Erro ao obter endereço via Nominatim:', error);
    // Em caso de erro na requisição ou processamento
    throw new Error('Não foi possível obter o endereço.');
  }
};


const TimeRegistration: React.FC<TimeRegistrationProps> = ({ selectedDate }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeRecord, setTimeRecord] = useState<TimeRecord | null>(null);
  const [loading, setLoading] = useState(false);
  // location state não é mais estritamente necessário aqui, pois a localização é buscada no momento do registro
  // const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();


  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);


  useEffect(() => {
    if (user) {
      loadTimeRecord();
    }
  }, [selectedDate, user]);


  const loadTimeRecord = async () => {
    if (!user) return;

    try {
      // Usar o tipo inferido para a query
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error('Error loading time record:', error);
        // Considere mostrar um erro na UI
        setTimeRecord(null); // Garante que o estado está limpo se houver erro
        return;
      }

      if (data) {
        // Mapear os dados do Supabase para o tipo TimeRecord,
        // garantindo que 'locations' seja tratado como objeto
        setTimeRecord({
          id: data.id,
          date: data.date,
          clock_in: data.clock_in,
          lunch_start: data.lunch_start,
          lunch_end: data.lunch_end,
          clock_out: data.clock_out,
          status: data.status,
          locations: data.locations as TimeRecordLocations | null // Cast para o novo tipo
        });
      } else {
         setTimeRecord(null); // Define como null se nenhum registro for encontrado
      }
    } catch (error) {
      console.error('Error loading time record:', error);
      setTimeRecord(null); // Define como null em caso de erro inesperado
    }
  };


  // Função para obter as coordenadas atuais (já existente)
  const getCurrentLocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não é suportada por este navegador.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Erro ao obter localização:', error);
          // Mapear erros comuns para mensagens mais amigáveis
          let errorMessage = 'Erro desconhecido ao obter localização.';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permissão de geolocalização negada. Por favor, permita o acesso à sua localização nas configurações do navegador.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Informação de localização indisponível.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Tempo limite esgotado ao tentar obter a localização.';
              break;
          }
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000, // Aumentado ligeiramente para dar mais tempo
          maximumAge: 0, // Força a busca por uma nova localização
        }
      );
    });
  };


  const registerTime = async (type: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out') => {
    if (!user) return;

    setLoading(true);
    let locationDetails: LocationDetails | null = null; // Objeto para armazenar coordenadas e endereço

    try {
      // 1. Obter as coordenadas
      const coords = await getCurrentLocation();

      // 2. Se obteve coordenadas, buscar o endereço
      try {
        const address = await getStreetAddress(coords.latitude, coords.longitude);
        locationDetails = {
          lat: coords.latitude,
          lng: coords.longitude,
          address: address // Endereço obtido
        };
      } catch (addressError) {
        console.warn('Não foi possível obter o endereço exato:', addressError);
        // Se a busca de endereço falhar, ainda armazena as coordenadas
        locationDetails = {
           lat: coords.latitude,
           lng: coords.longitude,
           address: 'Endereço não disponível' // Indica que o endereço não foi obtido
        };
        toast({
          title: "Aviso",
          description: "Não foi possível obter o endereço exato, mas as coordenadas foram registradas.",
          variant: "default", // Use default ou info para avisos
        });
      }

    } catch (locationError: any) {
      console.error('Erro ao obter localização (coordenadas):', locationError);
       toast({
        title: "Erro de Localização",
        description: locationError.message || "Não foi possível obter sua localização. O registro de ponto não incluirá localização.",
        variant: "destructive",
      });
      // locationDetails permanece null se não conseguir nem as coordenadas
    }


    const currentTimeString = new Date().toLocaleTimeString('pt-BR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    try {
      // Prepara os dados a serem atualizados/inseridos
      const updateData: any = { [type]: currentTimeString };

      // Se locationDetails foi obtido (mesmo que só com coordenadas), atualiza o campo locations
      if (locationDetails) {
           // Cria um novo objeto locations mesclando os existentes com o novo ponto
           const existingLocations = timeRecord?.locations || {};
           updateData.locations = {
               ...existingLocations,
               [type]: locationDetails // Adiciona/atualiza a localização para este tipo de ponto
           };
      } else {
          // Se não obteve nenhuma localização, mantém as existentes ou define como null
          updateData.locations = timeRecord?.locations || null;
      }


      if (timeRecord) {
        // Atualiza o registro existente
        const { error } = await supabase
          .from('time_records')
          .update(updateData)
          .eq('id', timeRecord.id);

        if (error) throw error;

      } else {
        // Insere um novo registro
        const { error } = await supabase
          .from('time_records')
          .insert({
            user_id: user.id,
            date: selectedDate,
            ...updateData, // Inclui o ponto registrado e as localizações
            status: 'active'
          });

        if (error) throw error;
      }

      // Recarrega o registro após a operação
      await loadTimeRecord();

      const typeLabels = {
        clock_in: 'Entrada',
        lunch_start: 'Início do Almoço',
        lunch_end: 'Fim do Almoço',
        clock_out: 'Saída'
      };

      toast({
        title: "Registro realizado!",
        description: `${typeLabels[type]} registrada às ${currentTimeString}. ${locationDetails ? 'Localização registrada.' : 'Localização não registrada.'}`,
      });

    } catch (error) {
      console.error('Error registering time:', error);
      toast({
        title: "Erro",
        description: "Erro ao registrar o ponto. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const getNextAction = () => {
    if (!timeRecord) return { type: 'clock_in', label: 'Registrar Entrada', icon: Clock };
    if (!timeRecord.clock_in) return { type: 'clock_in', label: 'Registrar Entrada', icon: Clock };
    if (!timeRecord.lunch_start) return { type: 'lunch_start', label: 'Registrar Início Almoço', icon: Clock };
    if (!timeRecord.lunch_end) return { type: 'lunch_end', label: 'Registrar Fim Almoço', icon: Clock };
    if (!timeRecord.clock_out) return { type: 'clock_out', label: 'Registrar Saída', icon: Clock };
    return null;
  };


  const nextAction = getNextAction();
  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd');

  // Converter o timeRecord para o formato esperado pelo TimeRegistrationProgress
  const progressRecord = timeRecord ? {
    clockIn: timeRecord.clock_in,
    lunchStart: timeRecord.lunch_start,
    lunchEnd: timeRecord.lunch_end,
    clockOut: timeRecord.clock_out
  } : {
    clockIn: undefined,
    lunchStart: undefined,
    lunchEnd: undefined,
    clockOut: undefined
  };


  return (
    <div className="space-y-6">
      {/* Relógio */}
      <Card className="bg-gradient-to-r from-primary-50 to-accent-50">
        <CardHeader className="text-center">
          <CardTitle className="text-primary-900">
            {/* Adicionado 'T00:00:00' para garantir que o Date constructor interprete como data local */}
            {format(new Date(selectedDate + 'T00:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </CardTitle>
          <div className="text-4xl font-bold text-primary-700 font-mono">
            {currentTime.toLocaleTimeString('pt-BR', { hour12: false })}
          </div>
        </CardHeader>
      </Card>

      {/* Progresso do Dia */}
      <TimeRegistrationProgress record={progressRecord} />

      {/* Botão de Ação Principal */}
      {nextAction && isToday && (
        <Card>
          <CardContent className="p-6">
            <Button
              onClick={() => registerTime(nextAction.type as any)}
              disabled={loading}
              className="w-full h-16 text-lg"
              size="lg"
            >
              <nextAction.icon className="w-6 h-6 mr-3" />
              {loading ? 'Obtendo localização e registrando...' : nextAction.label}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edição para dias passados */}
      {!isToday && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-600 mb-4">
              Ajustar registros de {format(new Date(selectedDate + 'T00:00:00'), "dd/MM/yyyy")}
            </p>
            <Button variant="outline" className="w-full">
              <Edit className="w-4 h-4 mr-2" />
              Solicitar Edição
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TimeRegistration;
