import * as React from 'react';
import { Drawer, DrawerContent, DrawerTrigger, DrawerClose } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Menu, Clock, BarChart3, FileText, Edit, LogOut, Loader2, Folder } from 'lucide-react';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface EmployeeDrawerProps {
  activeScreen: string;
  onScreenChange: (screen: string) => void;
}

const EmployeeDrawer: React.FC<EmployeeDrawerProps> = ({ activeScreen, onScreenChange }) => {
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      
      // Limpar dados locais
      localStorage.clear();
      sessionStorage.clear();
      
      // Fazer logout
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }

      // Limpar cache do navegador
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });

    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast({
        title: "Erro ao fazer logout",
        description: "Tente novamente ou limpe o cache do navegador.",
        variant: "destructive"
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const menuItems = [
    { key: 'timeRegistration', label: 'Registro de Ponto', icon: Clock },
    { key: 'monthlySummary', label: 'Resumo Mensal', icon: BarChart3 },
    { key: 'detailedReport', label: 'Relatório Detalhado', icon: FileText },
    { key: 'incompleteRecords', label: 'Registros Incompletos', icon: Clock },
    { key: 'adjustPreviousDays', label: 'Ajustar dias anteriores', icon: Edit },
    { key: 'vacationRequest', label: 'Solicitar Férias', icon: FileText },
    { key: 'documents', label: 'Meus Documentos', icon: Folder },
  ];

  return (
    <Drawer direction="left">
      <DrawerTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="fixed top-4 left-4 z-50 bg-white shadow-lg"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-full w-80 rounded-none">
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center mb-8">
            <img 
              src="/lovable-uploads/669270b6-ec43-4161-8f51-34a39fc1b06f.png" 
              alt="TCPonto Logo" 
              className="w-10 h-10 rounded-full mr-3" 
            />
            <div>
              <h2 className="text-lg font-bold text-gray-900">TCPonto</h2>
            </div>
          </div>

          <nav className="flex-1">
            <ul className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeScreen === item.key;
                
                return (
                  <li key={item.key}>
                    <DrawerClose asChild>
                      <button
                        onClick={() => onScreenChange(item.key)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
                          isActive 
                            ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    </DrawerClose>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t pt-4">
            <DrawerClose asChild>
              <button
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingOut ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <LogOut className="h-5 w-5" />
                )}
                <span className="font-medium">{isLoggingOut ? 'Saindo...' : 'Sair'}</span>
              </button>
            </DrawerClose>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default EmployeeDrawer;
