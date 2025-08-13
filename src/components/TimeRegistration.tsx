
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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAnnouncementClick = (announcement: any) => {
    setSelectedAnnouncement(announcement);
    setIsAnnouncementModalOpen(true);
  };

  const handleCloseAnnouncementModal = () => {
    setIsAnnouncementModalOpen(false);
    setSelectedAnnouncement(null);
  };

  const handleMarkAnnouncementAsRead = (announcementId: string) => {
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

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-6 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
          <p className="text-gray-600 mb-4">Você não tem permissão para registrar ponto neste sistema.</p>
          <p className="text-sm text-gray-500">Entre em contato com o RH para mais informações.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="text-lg font-medium">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      <div className="p-4 space-y-4">
        <TimeRegistrationHeader currentTime={currentTime} />
        <ShiftValidationInfo currentShiftMessage={shiftValidation.currentShiftMessage} nextButtonAvailable={shiftValidation.nextButtonAvailable} timeUntilNext={shiftValidation.timeUntilNext} />
        <TimeRegistrationProgress timeRecord={timeRecord} onEditRequest={handleEditRequest} />
        <TimeRegistrationButtons
          nextAction={nextAction}
          onTimeAction={handleTimeAction}
          isRegistrationButtonDisabled={isRegistrationButtonDisabled}
          submitting={submitting}
          shiftValidation={{ allowedButtons: shiftValidation.allowedButtons, timeUntilNext: shiftValidation.timeUntilNext }}
          remainingCooldown={remainingCooldown}
          formatRemainingTime={formatRemainingTime}
        />
        {!nextAction && <CompletionMessage />}
      </div>

      {unreadAnnouncements.length > 0 ? (
        <div className="w-full px-4 pb-4">
          <AnnouncementNotification announcements={unreadAnnouncements} onAnnouncementClick={handleAnnouncementClick} />
        </div>
      ) : (
        <div className="w-full px-4 pb-4 text-center text-gray-500 text-sm"></div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-xl">Solicitar Alteração - {editField ? fieldNames[editField] : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="edit-value" className="text-base font-medium">Novo Horário</Label>
              <Input 
                id="edit-value" 
                type="time" 
                value={editValue} 
                onChange={(e) => setEditValue(e.target.value)} 
                disabled={submitting} 
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="edit-reason" className="text-base font-medium">Motivo da Alteração *</Label>
              <Textarea 
                id="edit-reason" 
                value={editReason} 
                onChange={(e) => setEditReason(e.target.value)} 
                placeholder="Descreva o motivo da solicitação de alteração..." 
                required 
                disabled={submitting} 
                className="min-h-[80px] text-base resize-none"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)} 
                disabled={submitting}
                className="flex-1 h-12 text-base"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleEditDialogSubmit} 
                disabled={submitting || !editValue || !editReason}
                className="flex-1 h-12 text-base"
              >
                {submitting ? 'Enviando...' : 'Enviar Solicitação'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AnnouncementModal announcement={selectedAnnouncement} isOpen={isAnnouncementModalOpen} onClose={handleCloseAnnouncementModal} onMarkAsRead={handleMarkAnnouncementAsRead} />
    </div>
  );
};

export default TimeRegistration;
