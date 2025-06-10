
import React from 'react';
import { Drawer, DrawerContent, DrawerTrigger, DrawerClose } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Menu, Clock, BarChart3, FileText, Edit, LogOut } from 'lucide-react';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';

interface EmployeeDrawerProps {
  activeScreen: string;
  onScreenChange: (screen: string) => void;
}

const EmployeeDrawer: React.FC<EmployeeDrawerProps> = ({ activeScreen, onScreenChange }) => {
  const handleSignOut = async () => {
    try {
      // Usando o método nativo do Supabase para logout
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const menuItems = [
    { key: 'timeRegistration', label: 'Registro de Ponto', icon: Clock },
    { key: 'monthlySummary', label: 'Resumo Mensal', icon: BarChart3 },
    { key: 'detailedReport', label: 'Relatório Detalhado', icon: FileText },
    { key: 'incompleteRecords', label: 'Registros Incompletos', icon: Clock },
    { key: 'adjustPreviousDays', label: 'Ajustar dias anteriores', icon: Edit },
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
                className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg hover:bg-red-50 text-red-600 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Sair</span>
              </button>
            </DrawerClose>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default EmployeeDrawer;
