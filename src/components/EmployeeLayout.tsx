
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, Bell } from 'lucide-react';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import SessionWarning from '@/components/SessionWarning';
import EmployeeDrawer from '@/components/EmployeeDrawer';
import { useUnreadAnnouncements } from '@/hooks/useUnreadAnnouncements';
import { Badge } from '@/components/ui/badge';

interface EmployeeLayoutProps {
  children: React.ReactNode;
}

const EmployeeLayout: React.FC<EmployeeLayoutProps> = ({ children }) => {
  const { user, profile, sessionWarning, renewSession, dismissSessionWarning } = useOptimizedAuth();
  const { unreadCount } = useUnreadAnnouncements(user?.id || '');

  const handleLogout = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
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
      {/* Aviso de sessão */}
      <SessionWarning
        isVisible={sessionWarning}
        onRenew={handleRenewSession}
        onDismiss={dismissSessionWarning}
      />

      <header className="bg-white shadow-sm border-b w-full relative">
        <div className="w-full px-4 py-4">
          <div className="grid grid-cols-3 items-center w-full">
            <div className="flex items-center">
              {/* Drawer/Menu fixo no header */}
              <EmployeeDrawer activeScreen={'timeRegistration'} onScreenChange={handleScreenChange} />
            </div>
            
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
              </div>
              
              {/* Indicador de Anúncios */}
              {unreadCount > 0 && (
                <div className="relative">
                  <Bell className="w-5 h-5 text-blue-600" />
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                </div>
              )}
              
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
