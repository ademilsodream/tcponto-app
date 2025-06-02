
import React from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, User, Clock, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface EmployeeLayoutProps {
  children: React.ReactNode;
}

const EmployeeLayout: React.FC<EmployeeLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 w-full">
      <header className="bg-white shadow-sm border-b w-full">
        <div className="w-full px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <img 
                src="/lovable-uploads/669270b6-ec43-4161-8f51-34a39fc1b06f.png" 
                alt="TCPonto Logo" 
                className="w-10 h-10 rounded-full" 
              />
              <div>
                <h1 className="text-lg font-bold text-gray-900">TCPonto</h1>
                <p className="text-xs text-gray-600">Controle de Ponto</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-600">Funcionário</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="p-2"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full p-4">
        {children}
      </main>
    </div>
  );
};

export default EmployeeLayout;
