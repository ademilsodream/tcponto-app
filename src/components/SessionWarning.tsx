
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Clock, X } from 'lucide-react';

interface SessionWarningProps {
  isVisible: boolean;
  onRenew: () => void;
  onDismiss: () => void;
  minutesToExpire?: number;
}

const SessionWarning: React.FC<SessionWarningProps> = ({ 
  isVisible,
  onRenew,
  onDismiss, 
  minutesToExpire = 5 
}) => {
  if (!isVisible) return null;

  return (
    <Alert className="mb-4 border-yellow-500 bg-yellow-50">
      <Clock className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>
          Sua sessão expirará em {minutesToExpire} minutos. 
          Faça login novamente se necessário.
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRenew}
            className="ml-2 p-1 h-auto"
          >
            Renovar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="ml-2 p-1 h-auto"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default SessionWarning;
