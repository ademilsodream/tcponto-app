import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Clock, LogIn, Coffee, LogOut, Timer, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { useWorkShiftValidation } from '@/hooks/useWorkShiftValidation'; // ✨ Novo hook
import { validateLocationForTimeRecord } from '@/utils/locationValidation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUnreadAnnouncements } from '@/hooks/useUnreadAnnouncements';
import AnnouncementNotification from '@/components/AnnouncementNotification';
import AnnouncementModal from '@/components/AnnouncementModal';

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

const COOLDOWN_DURATION_MS = 20 * 60 * 1000;

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
  const { user, hasAccess } = useOptimizedAuth();
  const { toast } = useToast();

  // ✨ Usar o novo hook de validação de turno
  const shiftValidation = useWorkShiftValidation();

  // ✨ Adicionar hook de anúncios com logs detalhados
  const { unreadAnnouncements, markAsRead } = useUnreadAnnouncements();
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);

  // ✨ LOG DETALHADO DOS ANÚNCIOS
  console.log('🏠 TimeRegistration - ESTADO COMPLETO:', {
    unreadAnnouncementsCount: unreadAnnouncements.length,
    unreadAnnouncements: unreadAnnouncements,
    hasUser: !!user,
    hasAccess: hasAccess,
    userEmail: user?.email
  });

  // ✨ useEffect para monitorar mudanças nos anúncios
  useEffect(() => {
    console.log('🔄 TimeRegistration useEffect - Anúncios mudaram:', {
      count: unreadAnnouncements.length,
      announcements: unreadAnnouncements.map(a => ({
        id: a.id,
        title: a.title,
        priority: a.priority,
        expires_at: a.expires_at
      }))
    });
  }, [unreadAnnouncements]);

  // ✨ Efeito para carregar cooldown do localStorage e configurar timers
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let intervalId: NodeJS.Timeout | null = null;

    const storedCooldown = localStorage.getItem('timeRegistrationCooldown');
    if (storedCooldown) {
      const endTime = Number(storedCooldown);
      if (endTime > Date.now()) {
        setCooldownEndTime(endTime);
        setRemainingCooldown(endTime - Date.now());

        timeoutId = setTimeout(() => {
          setCooldownEndTime(null);
          setRemainingCooldown(null);
          localStorage.removeItem('timeRegistrationCooldown');
          toast({
            title: "Pronto!",
            description: "Você já pode registrar o próximo ponto.",
          });
        }, endTime - Date.now());

        intervalId = setInterval(() => {
          setRemainingCooldown(Math.max(0, endTime - Date.now()));
        }, 1000);

      } else {
        localStorage.removeItem('timeRegistrationCooldown');
        setCooldownEndTime(null);
        setRemainingCooldown(null);
      }
    } else {
      setCooldownEndTime(null);
      setRemainingCooldown(null);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [toast]);

  useEffect(() => {
    if (user && hasAccess) {
      initializeData();
    }
  }, [user, hasAccess]);

  const initializeData = async () => {
    try {
      setLoading(true);
      await loadAllowedLocations();
      await loadTodayRecord();
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
      }
    } catch (error) {
      console.error('❌ Erro ao carregar localizações permitidas:', error);
      toast({
        title: "Erro",
        description: "Nenhuma localização permitida configurada. Entre em contato com o RH.",
        variant: "destructive"
      });
    }
  };

  const loadTodayRecord = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

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
    if (!user || !hasAccess) return;

    // ✨ Verificar se há cooldown ativo
    if (cooldownEndTime && cooldownEndTime > Date.now()) {
        toast({
            title: "Aguarde",
            description: "Você só pode registrar o próximo ponto após o período de espera.",
            variant: "default"
        });
        return;
    }

    // ✨ Verificar se a ação é permitida pelo turno
    if (!shiftValidation.allowedButtons[action]) {
      toast({
        title: "Fora do Horário",
        description: shiftValidation.currentShiftMessage || "Este registro não está disponível no momento.",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);

      console.log(`🕐 INICIANDO REGISTRO DE ${action.toUpperCase()}...`);

      if (!allowedLocations || allowedLocations.length === 0) {
        console.error('❌ Nenhuma localização permitida carregada');
        toast({
          title: "Erro de Configuração",
          description: "Nenhuma localização permitida configurada. Entre em contato com o RH.",
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
      const today = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

      let updateData: any = {
        [action]: currentTime,
        updated_at: new Date().toISOString()
      };

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

      // ✨ Define o fim do cooldown e salva no localStorage
      const newCooldownEndTime = Date.now() + COOLDOWN_DURATION_MS;
      setCooldownEndTime(newCooldownEndTime);
      localStorage.setItem('timeRegistrationCooldown', newCooldownEndTime.toString());

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

      const { error } = await supabase
        .from('edit_requests')
        .insert({
          employee_id: user.id,
          employee_name: user.email || 'Usuário',
          date: new Date().toISOString().split('T')[0],
          field: editField,
          old_value: timeRecord?.[editField] || null,
          new_value: editValue,
          reason: editReason,
          location: locationData,
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

  const formatRemainingTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleAnnouncementClick = (announcement: any) => {
    console.log('🖱️ TimeRegistration: Clique no anúncio:', announcement.id);
    setSelectedAnnouncement(announcement);
    setIsAnnouncementModalOpen(true);
  };

  const handleCloseAnnouncementModal = () => {
    console.log('❌ TimeRegistration: Fechando modal de anúncio');
    setIsAnnouncementModalOpen(false);
    setSelectedAnnouncement(null);
  };

  const handleMarkAnnouncementAsRead = (announcementId: string) => {
    console.log('📖 TimeRegistration: Marcando anúncio como lido:', announcementId);
    markAsRead(announcementId);
  };

  // ✨ Se não tem acesso, mostrar mensagem de bloqueio
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white shadow-lg">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
            <p className="text-gray-600 mb-4">
              Você não tem permissão para registrar ponto neste sistema.
            </p>
            <p className="text-sm text-gray-500">
              Entre em contato com o RH para mais informações.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  const completedCount = steps.filter(step => !!getValue(step.key)).length;

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

  // ✨ Verificar se botão está habilitado considerando cooldown E turno
  const isRegistrationButtonDisabled = submitting || 
    (cooldownEndTime !== null && cooldownEndTime > Date.now()) ||
    (nextAction && !shiftValidation.allowedButtons[nextAction as keyof typeof shiftValidation.allowedButtons]);

  console.log('🎨 TimeRegistration ANTES DO RENDER:', {
    unreadAnnouncementsCount: unreadAnnouncements.length,
    showingAnnouncements: unreadAnnouncements.length > 0,
    currentRoute: window.location.pathname
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 pt-8">
      {/* ... keep existing code (time display and main card) */}

      {/* ✨ Componente de notificação de anúncios - COM LOGS EXTRAS */}
      <div className="w-full max-w-md mt-4">
        {console.log('🔔 Renderizando seção de anúncios:', {
          hasAnnouncements: unreadAnnouncements.length > 0,
          announcementsCount: unreadAnnouncements.length
        })}
        
        {unreadAnnouncements.length > 0 ? (
          <>
            {console.log('✅ Renderizando AnnouncementNotification com', unreadAnnouncements.length, 'anúncios')}
            <AnnouncementNotification
              announcements={unreadAnnouncements}
              onAnnouncementClick={handleAnnouncementClick}
            />
          </>
        ) : (
          <>
            {console.log('❌ Nenhum anúncio para exibir - mostrando mensagem vazia')}
            <div className="text-center text-gray-500 text-sm p-4 bg-white rounded-lg border">
              <div className="mb-2">📭 Nenhum anúncio disponível</div>
              <div className="text-xs text-gray-400">
                {user ? `Usuário: ${user.email}` : 'Usuário não logado'}
              </div>
              <div className="text-xs text-gray-400">
                Rota: {window.location.pathname}
              </div>
            </div>
          </>
        )}
      </div>

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

      {/* ✨ Modal de anúncios */}
      <AnnouncementModal
        announcement={selectedAnnouncement}
        isOpen={isAnnouncementModalOpen}
        onClose={handleCloseAnnouncementModal}
        onMarkAsRead={handleMarkAnnouncementAsRead}
      />
    </div>
  );
};

export default TimeRegistration;
