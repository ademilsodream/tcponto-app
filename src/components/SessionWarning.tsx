
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface SessionWarningProps {
  isVisible: boolean;
  onRenew: () => void;
  onDismiss: () => void;
  minutesRemaining?: number;
}

const SessionWarning: React.FC<SessionWarningProps> = ({
  isVisible,
  onRenew,
  onDismiss,
  minutesRemaining = 60
}) => {
  if (!isVisible) return null;

  return (
    <Alert className="fixed top-4 right-4 z-50 max-w-md border-yellow-200 bg-yellow-50">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="pr-2">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-yellow-800">
            Sua sessão expirará em {minutesRemaining} minutos.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={onRenew}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Renovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDismiss}
              className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
            >
              Dispensar
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default SessionWarning;
