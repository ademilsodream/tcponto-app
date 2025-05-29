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
import { Database } from '@/integrations/supabase/types';

// Tipos inferidos do banco de dados
type TimeRecordRow = Database['public']['Tables']['time_records']['Row'];

// Tipo melhorado para a estrutura de localização com detalhes completos
interface LocationDetails {
  lat: number;
  lng: number;
  street: string;        // Nome da rua
  houseNumber: string;   // Número do endereço
  neighborhood: string;  // Bairro
  city: string;          // Cidade
  state: string;         // Estado/Província
  postalCode: string;    // CEP/Código postal
  country: string;       // País
  fullAddress: string;   // Endereço completo formatado
}

// Tipo para o campo 'locations' que agora é um objeto JSON
interface TimeRecordLocations {
  clockIn?: LocationDetails | null;
  lunchStart?: LocationDetails | null;
  lunchEnd?: LocationDetails | null;
  clockOut?: LocationDetails | null;
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
  locations: TimeRecordLocations | null;
}

interface TimeRegistrationProps {
  selectedDate: string;
}

// Função melhorada para obter o endereço completo com todos os detalhes
const getDetailedAddress = async (latitude: number, longitude: number): Promise<LocationDetails> => {
  const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;

  try {
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'TCPonto/1.0 (contato@tcponto.com)'
      }
    });

    if (!response.ok) {
      throw new Error(`Erro ao obter endereço: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.address) {
      const addr = data.address;
      
      // Extrair componentes do endereço de forma robusta
      const street = addr.road || addr.pedestrian || addr.footway || '';
      const houseNumber = addr.house_number || '';
      const neighborhood = addr.neighbourhood || addr.suburb || addr.quarter || '';
      const city = addr.city || addr.town || addr.village || addr.municipality || '';
      const state = addr.state || addr.province || addr.region || '';
      const postalCode = addr.postcode || '';
      const country = addr.country || '';

      // Montar endereço completo formatado
      let fullAddress = '';
      if (street) fullAddress += street;
      if (houseNumber) fullAddress += (fullAddress ? ', ' : '') + houseNumber;
      if (neighborhood) fullAddress += (fullAddress ? ' - ' : '') + neighborhood;
      if (city) fullAddress += (fullAddress ? ', ' : '') + city;
      if (state) fullAddress += (fullAddress ? '/' : '') + state;
      if (postalCode) fullAddress += (fullAddress ? ' - CEP: ' : 'CEP: ') + postalCode;
      if (country) fullAddress += (fullAddress ? ', ' : '') + country;

      // Se não conseguiu montar endereço, usar display_name como fallback
      if (!fullAddress.trim()) {
        fullAddress = data.display_name || 'Endereço não disponível';
      }

      return {
        lat: latitude,
        lng: longitude,
        street: street || 'Não informado',
        houseNumber: houseNumber || 'S/N',
        neighborhood: neighborhood || 'Não informado',
        city: city || 'Não informado',
        state: state || 'Não informado',
        postalCode: postalCode || 'Não informado',
        country: country || 'Não informado',
        fullAddress: fullAddress
      };

    } else {
      throw new Error('Dados de endereço não encontrados');
    }
  } catch (error) {
    console.error('Erro ao obter endereço via Nominatim:', error);
    
    // Retornar estrutura básica em caso de erro
    return {
      lat: latitude,
      lng: longitude,
      street: 'Não disponível',
      houseNumber: 'S/N',
      neighborhood: 'Não disponível',
      city: 'Não disponível',
      state: 'Não disponível',
      postalCode: 'Não disponível',
      country: 'Não disponível',
      fullAddress: `Localização: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    };
  }
};

const TimeRegistration: React.FC<TimeRegistrationProps> = ({ selectedDate }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeRecord, setTimeRecord] = useState<TimeRecord | null>(null);
  const [loading, setLoading] = useState(false);
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
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading time record:', error);
        setTimeRecord(null);
        return;
      }

      if (data) {
        setTimeRecord({
          id: data.id,
          date: data.date,
          clock_in: data.clock_in,
          lunch_start: data.lunch_start,
          lunch_end: data.lunch_end,
          clock_out: data.clock_out,
          status: data.status,
          locations: data.locations as TimeRecordLocations | null
        });
      } else {
         setTimeRecord(null);
      }
    } catch (error) {
      console.error('Error loading time record:', error);
      setTimeRecord(null);
    }
  };

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
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  const registerTime = async (type: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out') => {
    if (!user) return;

    setLoading(true);
    let locationDetails: LocationDetails | null = null;

    try {
      // 1. Obter as coordenadas
      const coords = await getCurrentLocation();

      // 2. Obter endereço detalhado
      try {
        locationDetails = await getDetailedAddress(coords.latitude, coords.longitude);
      } catch (addressError) {
        console.warn('Não foi possível obter o endereço detalhado:', addressError);
        // Criar estrutura básica se falhar
        locationDetails = {
          lat: coords.latitude,
          lng: coords.longitude,
          street: 'Não disponível',
          houseNumber: 'S/N',
          neighborhood: 'Não disponível',
          city: 'Não disponível',
          state: 'Não disponível',
          postalCode: 'Não disponível',
          country: 'Não disponível',
          fullAddress: `Coordenadas: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
        };
        
        toast({
          title: "Aviso",
          description: "Coordenadas registradas, mas endereço detalhado não foi obtido.",
          variant: "default",
        });
      }

    } catch (locationError: any) {
      console.error('Erro ao obter localização:', locationError);
      toast({
        title: "Erro de Localização",
        description: locationError.message || "Não foi possível obter sua localização.",
        variant: "destructive",
      });
    }

    const currentTimeString = new Date().toLocaleTimeString('pt-BR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    try {
      const updateData: any = { [type]: currentTimeString };

      if (locationDetails) {
           const existingLocations = timeRecord?.locations || {};
           updateData.locations = {
               ...existingLocations,
               [type]: locationDetails
           };
      } else {
          updateData.locations = timeRecord?.locations || null;
      }

      if (timeRecord) {
        const { error } = await supabase
          .from('time_records')
          .update(updateData)
          .eq('id', timeRecord.id);

        if (error) throw error;

      } else {
        const { error } = await supabase
          .from('time_records')
          .insert({
            user_id: user.id,
            date: selectedDate,
            ...updateData,
            status: 'active'
          });

        if (error) throw error;
      }

      await loadTimeRecord();

      const typeLabels = {
        clock_in: 'Entrada',
        lunch_start: 'Início do Almoço',
        lunch_end: 'Fim do Almoço',
        clock_out: 'Saída'
      };

      const locationMsg = locationDetails 
        ? `Localização: ${locationDetails.city}, ${locationDetails.state}, ${locationDetails.country}` 
        : 'Localização não registrada.';

      toast({
        title: "Registro realizado!",
        description: `${typeLabels[type]} registrada às ${currentTimeString}. ${locationMsg}`,
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
              {loading ? 'Obtendo localização detalhada e registrando...' : nextAction.label}
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
