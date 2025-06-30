
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { LogIn, Coffee, LogOut, AlertCircle } from 'lucide-react';
import { useUnreadAnnouncements } from '@/hooks/useUnreadAnnouncements';
import AnnouncementNotification from '@/components/AnnouncementNotification';
import AnnouncementModal from '@/components/AnnouncementModal';
import { TimeRegistrationHeader } from './TimeRegistrationHeader';
import { ShiftValidationInfo } from './ShiftValidationInfo';
import { TimeRegistrationButtons } from './TimeRegistrationButtons';
import { CompletionMessage } from './CompletionMessage';
import { TimeRegistrationProgress } from './TimeRegistrationProgress';
import { useTimeRegistrationLogic } from '@/hooks/useTimeRegistrationLogic';
import { PushNotificationService } from '@/services/PushNotificationService';
import { supabase } from '@/integrations/supabase/client';

const TimeRegistration = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);

  const {
    timeRecord,
    loading,
    submitting,
    editField,
    editValue,
    editReason,
    remainingCooldown,
    shiftValidation,
    fieldNames,
    steps,
    getValue,
    completedCount,
    nextAction,
    isRegistrationButtonDisabled,
    hasAccess,
    handleTimeAction,
    handleEditSubmit,
    formatRemainingTime,
    setEditField,
    setEditValue,
    setEditReason
  } = useTimeRegistrationLogic();

  const { unreadAnnouncements, markAsRead } = useUnreadAnnouncements();

  // Inicializar push notifications
  useEffect(() => {
    const initializePushNotifications = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('🔔 Inicializando push notifications para usuário:', user.id);
          const pushService = PushNotificationService.getInstance();
          await pushService.initialize(user.id);
        }
      } catch (error) {
        console.error('❌ Erro ao inicializar push notifications:', error);
      }
    };

    initializePushNotifications();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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

  const handleEditRequest = (field: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out', value: string) => {
    setEditField(field);
    setEditValue(value);
    setIsEditDialogOpen(true);
  };

  const handleEditDialogSubmit = async () => {
    await handleEditSubmit();
    setIsEditDialogOpen(false);
  };

  // Função para testar push notification
  const handleTestPushNotification = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const pushService = PushNotificationService.getInstance();
        await pushService.testNotification(user.id);
        console.log('✅ Teste de push notification enviado');
      }
    } catch (error) {
      console.error('❌ Erro ao testar push notification:', error);
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 pt-8">
      <TimeRegistrationHeader currentTime={currentTime} />

      <Card className="w-full max-w-md bg-white shadow-lg">
        <CardContent className="p-4 sm:p-6">
          <ShiftValidationInfo
            currentShiftMessage={shiftValidation.currentShiftMessage}
            nextButtonAvailable={shiftValidation.nextButtonAvailable}
            timeUntilNext={shiftValidation.timeUntilNext}
          />

          <TimeRegistrationProgress
            timeRecord={timeRecord}
            onEditRequest={handleEditRequest}
          />

          <TimeRegistrationButtons
            nextAction={nextAction}
            onTimeAction={handleTimeAction}
            isRegistrationButtonDisabled={isRegistrationButtonDisabled}
            submitting={submitting}
            shiftValidation={{
              allowedButtons: shiftValidation.allowedButtons,
              timeUntilNext: shiftValidation.timeUntilNext
            }}
            remainingCooldown={remainingCooldown}
            formatRemainingTime={formatRemainingTime}
          />

          {!nextAction && <CompletionMessage />}
        </CardContent>
      </Card>

      {unreadAnnouncements.length > 0 ? (
        <div className="w-full max-w-md mt-4">
          <AnnouncementNotification
            announcements={unreadAnnouncements}
            onAnnouncementClick={handleAnnouncementClick}
          />
        </div>
      ) : (
        <div className="w-full max-w-md mt-4 text-center text-gray-500 text-sm">
        </div>
      )}

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
                onClick={handleEditDialogSubmit}
                disabled={submitting || !editValue || !editReason}
              >
                {submitting ? 'Enviando...' : 'Enviar Solicitação'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
