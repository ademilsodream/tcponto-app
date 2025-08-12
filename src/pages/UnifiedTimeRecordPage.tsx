import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Building2 } from 'lucide-react';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import UnifiedTimeRegistration from '@/components/UnifiedTimeRegistration';
import { SessionWarning } from '@/components/SessionWarning';

const UnifiedTimeRecordPage: React.FC = () => {
  const { user, profile, isLoading, hasAccess, sessionWarning, dismissSessionWarning } = useOptimizedAuth();

  if (isLoading) {
    return <div className="text-center p-4">Carregando...</div>;
  }

  if (!user) {
    return <div className="text-center p-4">Não autenticado.</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 mr-2" />
            Registro de Ponto
          </CardTitle>
          <Badge variant="secondary">
            {hasAccess ? 'Acesso Permitido' : 'Acesso Restrito'}
          </Badge>
        </CardHeader>
        <CardContent className="py-4">
          {sessionWarning && (
            <SessionWarning
              onDismiss={dismissSessionWarning}
              minutesToExpire={5} // Tempo de expiração da sessão em minutos
            />
          )}
          <div className="grid gap-4">
            <Card>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <User className="h-10 w-10 text-gray-500" />
                  <div>
                    <p className="text-lg font-semibold">{profile?.name || 'Nome do Funcionário'}</p>
                    <p className="text-sm text-gray-500">{user?.email || 'email@example.com'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <Building2 className="h-10 w-10 text-gray-500" />
                  <div>
                    <p className="text-lg font-semibold">{profile?.departments?.name || 'Departamento'}</p>
                    <p className="text-sm text-gray-500">{profile?.job_functions?.name || 'Função'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <UnifiedTimeRegistration />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnifiedTimeRecordPage;
