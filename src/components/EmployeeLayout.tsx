
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import SessionWarning from '@/components/SessionWarning';
import EmployeeDrawer from '@/components/EmployeeDrawer';

interface EmployeeLayoutProps {
  children: React.ReactNode;
}

const EmployeeLayout: React.FC<EmployeeLayoutProps> = ({ children }) => {
  const { user, profile, sessionWarning, renewSession, dismissSessionWarning } = useOptimizedAuth();

  const handleLogout = async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const handleRenewSession = async () => {
    const success = await renewSession();
    if (success) {
      console.log('✅ Sessão renovada com sucesso');
    } else {
      console.error('❌ Falha ao renovar sessão');
    }
  };

  // Handler no-op para o menu (futuras telas)
  const handleScreenChange = React.useCallback((_screen: string) => {
    // Navegação futura pode ser adicionada aqui
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 w-full">
      {/* Drawer/Menu fixo no topo esquerdo */}
      <EmployeeDrawer activeScreen={'timeRegistration'} onScreenChange={handleScreenChange} />

      {/* Aviso de sessão */}
      <SessionWarning
        isVisible={sessionWarning}
        onRenew={handleRenewSession}
        onDismiss={dismissSessionWarning}
      />

      <header className="bg-white shadow-sm border-b w-full">
        <div className="w-full px-4 py-4">
          <div className="grid grid-cols-3 items-center w-full">
            <div></div>
            
            <div className="flex items-center justify-center space-x-3">
              <img 
                src="/lovable-uploads/669270b6-ec43-4161-8f51-34a39fc1b06f.png" 
                alt="TCPonto Logo" 
                className="w-12 h-12 rounded-full" 
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">TCPonto</h1>
              </div>
            </div>
      
            <div className="flex items-center justify-end space-x-2">
              <div className="text-right hidden sm:block">
                <p className="text-base font-medium text-gray-900">{profile?.name || user?.email}</p>
                <p className="text-sm text-gray-600">Funcionário</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="p-3 h-12 w-12"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full">
        {children}
      </main>
    </div>
  );
};

export default EmployeeLayout;
