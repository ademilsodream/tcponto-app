
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Clock, X } from 'lucide-react';

interface SessionWarningProps {
  onDismiss: () => void;
  minutesToExpire?: number;
}

const SessionWarning: React.FC<SessionWarningProps> = ({ 
  onDismiss, 
  minutesToExpire = 5 
}) => {
  return (
    <Alert className="mb-4 border-yellow-500 bg-yellow-50">
      <Clock className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>
          Sua sessão expirará em {minutesToExpire} minutos. 
          Faça login novamente se necessário.
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="ml-2 p-1 h-auto"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default SessionWarning;
