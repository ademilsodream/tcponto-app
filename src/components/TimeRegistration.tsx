import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Clock, LogIn, Coffee, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext'; // Corrigido para o caminho original
import { validateLocationForTimeRecord } from '@/utils/locationValidation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';


interface TimeRecord {
  id: string;
  date: string;
  clock_in?: string;
  lunch_start?: string;
  lunch_end?: string;
  clock_out?: string;
  total_hours: number;
  locations?: any;
}


interface AllowedLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  range_meters: number;
  is_active: boolean;
}


const TimeRegistration = () => {
  const [timeRecord, setTimeRecord] = useState<TimeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [allowedLocations, setAllowedLocations] = useState<AllowedLocation[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editField, setEditField] = useState<'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userProfile, setUserProfile] = useState<{ name?: string } | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();


  // Função para obter saudação baseada no horário
  const getGreeting = () => {
    const hour = currentTime.getHours();

    if (hour >= 5 && hour < 12) {
      return 'Bom dia';
    } else if (hour >= 12 && hour < 18) {
      return 'Boa tarde';
    } else {
      return 'Boa noite';
    }
  };


  // Função para obter nome do usuário (primeiro nome)
  const getUserDisplayName = () => {
    if (userProfile?.name) {
      // Pegar apenas o primeiro nome
      return userProfile.name.split(' ')[0];
    }

    if (user?.email) {
      // Se não tem nome, usar parte do email antes do @
      return user.email.split('@')[0];
    }

    return 'Usuário';
  };


  // Função para obter data local (corrige problema de timezone)
  const getLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };


  // Função para obter horário local
  const getLocalTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };


  // Atualizar relógio a cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);


    return () => clearInterval(timer);
  }, []);


  useEffect(() => {
    if (user) {
      // Debug da data para investigar problemas de timezone
      const utcDate = new Date().toISOString().split('T')[0];
      const localDate = getLocalDate();
      console.log('🕐 Hora atual:', new Date().toString());
      console.log('🌍 Data UTC:', utcDate);
      console.log('🇧🇷 Data Local:', localDate);
      console.log('⏰ Timezone offset:', new Date().getTimezoneOffset());

      initializeData();
    }
  }, [user]);


  // Carregar perfil do usuário
  const loadUserProfile = async () => {
    if (!user) return;


    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name') // Mantido 'name' conforme o código fornecido
        .eq('id', user.id)
        .single();


      if (error && error.code !== 'PGRST116') {
        console.warn('Perfil não encontrado, usando dados do usuário');
        return;
      }


      setUserProfile(data);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    }
  };


  const initializeData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadUserProfile(),
        loadAllowedLocations(),
        loadTodayRecord()
      ]);
    } catch (error) {
      console.error('Erro ao inicializar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados iniciais",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };


  const loadAllowedLocations = async () => {
    try {
      console.log('📍 CARREGANDO LOCALIZAÇÕES PERMITIDAS...');
      const { data, error } = await supabase
        .from('allowed_locations')
        .select('*')
        .eq('is_active', true)
        .order('name');


      if (error) throw error;

      const processedLocations = (data || []).map(location => ({
        ...location,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        range_meters: Number(location.range_meters)
      }));

      setAllowedLocations(processedLocations);

      if (!processedLocations || processedLocations.length === 0) {
        console.warn('⚠️ Nenhuma localização permitida encontrada no banco de dados');
        toast({
          title: "Aviso",
          description: "Nenhuma localização permitida configurada no sistema",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Erro ao carregar localizações permitidas:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar localizações permitidas",
        variant: "destructive"
      });
    }
  };


  const loadTodayRecord = async () => {
    if (!user) return;


    try {
      const today = getLocalDate(); // ✅ Usa data local em vez de UTC
      console.log('📅 Buscando registros para a data local:', today);

      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();


      if (error && error.code !== 'PGRST116') {
        throw error;
      }


      console.log('📊 Registro encontrado para hoje:', data);
      setTimeRecord(data);
    } catch (error) {
      console.error('Erro ao carregar registro:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar registro do dia",
        variant: "destructive"
      });
    }
  };


  const handleTimeAction = async (action: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out') => {
    if (!user) return;


    try {
      setSubmitting(true);

      console.log(`🕐 INICIANDO REGISTRO DE ${action.toUpperCase()}...`);

      if (!allowedLocations || allowedLocations.length === 0) {
        console.error('❌ Nenhuma localização permitida carregada');
        toast({
          title: "Erro de Configuração",
          description: "Nenhuma localização permitida configurada. Contate o administrador.",
          variant: "destructive"
        });
        return;
      }


      console.log(`🏢 Validando contra ${allowedLocations.length} localizações permitidas`);
      console.log('📋 Validação de localização: GPS deve estar DENTRO DO RANGE de uma localização permitida');

      const locationValidation = await validateLocationForTimeRecord(allowedLocations);

      if (!locationValidation.valid) {
        console.error('❌ Localização não autorizada:', locationValidation.message);
        toast({
          title: "Localização não autorizada",
          description: locationValidation.message,
          variant: "destructive"
        });
        return;
      }


      console.log('✅ Localização validada - GPS dentro do range permitido, registrando ponto...');


      const now = new Date();
      const today = getLocalDate(); // ✅ Usa data local
      const currentTime = getLocalTime(); // ✅ Usa horário local

      console.log('📅 Data do registro:', today);
      console.log('🕐 Horário do registro:', currentTime);


      let updateData: any = {
        [action]: currentTime,
        updated_at: new Date().toISOString()
      };

      // --- Início da lógica de salvamento de localização (completa) ---
      if (locationValidation.location) {
        const locationData = {
          [action]: {
            latitude: locationValidation.location.latitude,
            longitude: locationValidation.location.longitude,
            timestamp: now.toISOString(),
            address: locationValidation.closestLocation?.address || 'Localização autorizada',
            locationName: locationValidation.closestLocation?.name || 'Local permitido',
            distance: Math.round(locationValidation.distance || 0)
          }
        };

        if (timeRecord?.locations) {
          updateData.locations = { ...timeRecord.locations, ...locationData };
        } else {
          updateData.locations = locationData;
        }
      }
      // --- Fim da lógica de salvamento de localização ---


      if (timeRecord) {
        console.log('🔄 Atualizando registro existente:', timeRecord.id);
        const { error } = await supabase
          .from('time_records')
          .update(updateData)
          .eq('id', timeRecord.id);


        if (error) throw error;
      } else {
        console.log('➕ Criando novo registro para:', today);
        const { error } = await supabase
          .from('time_records')
          .insert({
            user_id: user.id,
            date: today,
            ...updateData
          });


        if (error) throw error;
      }


      await loadTodayRecord();

      const actionNames = {
        clock_in: 'Entrada',
        lunch_start: 'Início do Almoço',
        lunch_end: 'Fim do Almoço',
        clock_out: 'Saída'
      };


      toast({
        title: "Sucesso",
        description: `${actionNames[action]} registrada às ${currentTime}`,
      });


    } catch (error) {
      console.error('❌ Erro ao registrar:', error);
      toast({
        title: "Erro",
        description: "Erro ao registrar horário",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };


  const handleEditSubmit = async () => {
    if (!user || !editField || !editValue || !editReason) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive"
      });
      return;
    }


    try {
      setSubmitting(true);


      const locationValidation = await validateLocationForTimeRecord(allowedLocations);

      // --- Início da lógica de salvamento de localização para solicitação de edição (completa) ---
      let locationData = null;
      if (locationValidation.location) {
        locationData = {
          latitude: locationValidation.location.latitude,
          longitude: locationValidation.location.longitude,
          timestamp: new Date().toISOString(),
          address: locationValidation.closestLocation?.address || 'Localização no momento da solicitação',
          locationName: locationValidation.closestLocation?.name || 'Local da solicitação',
          distance: locationValidation.distance || 0
        };
      }
      // --- Fim da lógica de salvamento de localização para solicitação de edição ---


      const { error } = await supabase
        .from('edit_requests')
        .insert({
          employee_id: user.id,
          employee_name: user.email || 'Usuário',
          date: getLocalDate(), // ✅ Usa data local
          field: editField,
          old_value: timeRecord?.[editField] || null,
          new_value: editValue,
          reason: editReason,
          location: locationData, // Inclui os dados de localização
          status: 'pending'
        });


      if (error) throw error;


      toast({
        title: "Sucesso",
        description: "Solicitação de alteração enviada para aprovação",
      });


      setIsEditDialogOpen(false);
      setEditField(null);
      setEditValue('');
      setEditReason('');


    } catch (error) {
      console.error('Erro ao enviar solicitação:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar solicitação de alteração",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };


  // Verificar mudança de data automaticamente
  useEffect(() => {
    const checkDateChange = () => {
      const currentDate = getLocalDate();
      const recordDate = timeRecord?.date;

      // Se a data mudou, recarregar
      if (recordDate && recordDate !== currentDate) {
        console.log('🗓️ Nova data detectada, recarregando registros...');
        console.log('📅 Data anterior:', recordDate);
        console.log('📅 Data atual:', currentDate);
        loadTodayRecord();
      }
    };


    // Verificar a cada 30 segundos
    const interval = setInterval(checkDateChange, 30000);
    return () => clearInterval(interval);
  }, [timeRecord]);


  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Carregando...</span>
      </div>
    );
  }


  const steps = [
    { key: 'clock_in', label: 'Entrada', icon: LogIn, color: 'bg-green-500' },
    { key: 'lunch_start', label: 'Início Almoço', icon: Coffee, color: 'bg-orange-500' },
    { key: 'lunch_end', label: 'Volta Almoço', icon: Coffee, color: 'bg-orange-500' },
    { key: 'clock_out', label: 'Saída', icon: LogOut, color: 'bg-red-500' },
  ];


  const getValue = (key: string) => {
    return timeRecord?.[key as keyof TimeRecord];
  };


  const completedCount = steps.filter(step => getValue(step.key)).length;


  // Determinar próxima ação
  const getNextAction = () => {
    if (!timeRecord?.clock_in) return 'clock_in';
    if (!timeRecord?.lunch_start) return 'lunch_start';
    if (!timeRecord?.lunch_end) return 'lunch_end';
    if (!timeRecord?.clock_out) return 'clock_out';
    return null;
  };


  const nextAction = getNextAction();


  const fieldNames = {
    clock_in: 'Entrada',
    lunch_start: 'Início do Almoço',
    lunch_end: 'Fim do Almoço',
    clock_out: 'Saída'
  };


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 pt-8">
      {/* Header com logo movida para direita - otimizado para mobile */}
      <div className="w-full max-w-md mb-6 pl-20 sm:pl-16">

      </div>


      {/* ✨ NOVA: Saudação com nome do usuário */}
      <div className="text-center mb-4">
        <div className="text-blue-600 text-xl sm:text-2xl font-semibold mb-1">
          {getGreeting()}, {getUserDisplayName()}! 👋
        </div>
        <div className="text-gray-500 text-sm sm:text-base">
          Pronto para registrar seu ponto?
        </div>
      </div>


      {/* Relógio Principal - otimizado para mobile */}
      <div className="text-center mb-6">
        <div className="text-gray-600 text-base sm:text-lg mb-2">
          {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </div>
        <div className="text-gray-900 text-4xl sm:text-6xl font-bold tracking-wider mb-4">
          {format(currentTime, 'HH:mm:ss')}
        </div>
      </div>


      {/* Card Principal - otimizado para mobile */}
      <Card className="w-full max-w-md bg-white shadow-lg">
        <CardContent className="p-4 sm:p-6">
          {/* Progresso Horizontal - otimizado para mobile */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = !!getValue(step.key);
                const isNext = !isCompleted && completedCount === index;


                return (
                  <div key={step.key} className="flex flex-col items-center flex-1">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-1 transition-all ${
                        isCompleted
                          ? `${step.color} text-white`
                          : isNext
                            ? 'bg-blue-100 border-2 border-blue-600 text-blue-600'
                            : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className={`text-xs text-center ${
                      isCompleted ? 'text-gray-900 font-medium' : 'text-gray-500'
                    }`}>
                      {step.label}
                    </span>
                    {isCompleted && (
                      <span className="text-xs text-blue-600 mt-1 font-medium">
                        {getValue(step.key)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>


            {/* Barra de progresso horizontal */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                width: `${(completedCount / 4) * 100}%`,
                background: completedCount > 0 ? 'linear-gradient(to right, #22c55e, #f97316, #f97316, #ef4444)' : '#3b82f6'
                }}
              />
            </div>
          </div>


          {/* Botão Registrar - otimizado para mobile */}
          {nextAction && (
            <Button
              onClick={() => handleTimeAction(nextAction)}
              disabled={submitting}
              className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white touch-manipulation"
            >
              <Clock className="w-5 h-5 mr-2" />
              {submitting ? 'Registrando...' : 'Registrar'}
            </Button>
          )}


          {!nextAction && (
            <div className="text-center py-4">
              <div className="text-green-600 font-semibold mb-2">
                ✅ Todos os registros concluídos!
              </div>
              <div className="text-sm text-gray-500">
                Tenha um ótimo resto do dia, {getUserDisplayName()}!
              </div>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Dialog de Edição - mantido igual */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Solicitar Alteração - {editField ? fieldNames[editField] : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-value">Novo Horário</Label>
              <Input
                id="edit-value"
                type="time"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                disabled={submitting}
              />
            </div>


            <div className="space-y-2">
              <Label htmlFor="edit-reason">Motivo da Alteração *</Label>
              <Textarea
                id="edit-reason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Descreva o motivo da solicitação de alteração..."
                required
                disabled={submitting}
              />
            </div>


            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleEditSubmit}
                disabled={submitting || !editValue || !editReason}
              >
                {submitting ? 'Enviando...' : 'Enviar Solicitação'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};


export default TimeRegistration;
