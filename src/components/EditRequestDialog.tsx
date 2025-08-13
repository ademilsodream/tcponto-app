
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { TimeRecordKey } from './TimeRegistrationProgress';

interface EditRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editField: TimeRecordKey | null;
  editValue: string;
  editReason: string;
  submitting: boolean;
  onValueChange: (value: string) => void;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
}

const fieldNames: Record<TimeRecordKey, string> = {
  clock_in: 'Entrada',
  lunch_start: 'Início do Almoço',
  lunch_end: 'Fim do Almoço',
  clock_out: 'Saída'
};

export const EditRequestDialog: React.FC<EditRequestDialogProps> = ({
  isOpen,
  onClose,
  editField,
  editValue,
  editReason,
  submitting,
  onValueChange,
  onReasonChange,
  onSubmit
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Solicitar Alteração - {editField ? fieldNames[editField] : ''}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="edit-value" className="text-base font-medium">Novo Horário</Label>
            <Input
              id="edit-value"
              type="time"
              value={editValue}
              onChange={(e) => onValueChange(e.target.value)}
              disabled={submitting}
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="edit-reason" className="text-base font-medium">Motivo da Alteração *</Label>
            <Textarea
              id="edit-reason"
              value={editReason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Descreva o motivo da solicitação de alteração..."
              required
              disabled={submitting}
              className="min-h-[100px] text-base resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 h-12 text-base"
            >
              Cancelar
            </Button>
            <Button
              onClick={onSubmit}
              disabled={submitting || !editValue || !editReason}
              className="flex-1 h-12 text-base"
            >
              {submitting ? 'Enviando...' : 'Enviar Solicitação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
