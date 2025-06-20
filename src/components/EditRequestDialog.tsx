
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
              onChange={(e) => onValueChange(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-reason">Motivo da Alteração *</Label>
            <Textarea
              id="edit-reason"
              value={editReason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Descreva o motivo da solicitação de alteração..."
              required
              disabled={submitting}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={onSubmit}
              disabled={submitting || !editValue || !editReason}
            >
              {submitting ? 'Enviando...' : 'Enviar Solicitação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
