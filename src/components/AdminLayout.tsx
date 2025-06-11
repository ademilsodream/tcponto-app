import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from '@/components/ui/menubar';
import { Settings, LogOut, User, Building2, BarChart3 } from 'lucide-react';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, profile } = useOptimizedAuth();
  
  const handleLogout = async () => {
    try {
      // Usando o método nativo do Supabase para logout
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      {/* Header ajustado para não conflitar com o sidebar */}
      <header className="bg-white shadow-sm border-b w-full ml-64 fixed top-0 right-0 z-40" style={{ width: 'calc(100% - 16rem)' }}>
        <div className="w-full px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <img 
                src="/lovable-uploads/669270b6-ec43-4161-8f51-34a39fc1b06f.png" 
                alt="TCPonto Logo" 
                className="w-8 h-8 rounded-full" 
              />
              <h1 className="text-xl font-bold text-gray-900"></h1>
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Menubar>
                <MenubarMenu>
                  <MenubarTrigger asChild>
                    <Link to="/" className="cursor-pointer flex items-center">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Dashboard
                    </Link>
                  </MenubarTrigger>
                </MenubarMenu>
                <MenubarMenu>
                  <MenubarTrigger className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" />
                    Configurações
                  </MenubarTrigger>
                  <MenubarContent>
                    <MenubarItem asChild>
                      <Link to="/settings" className="cursor-pointer">
                        Configurações Gerais
                      </Link>
                    </MenubarItem>
                  </MenubarContent>
                </MenubarMenu>
              </Menubar>
              <Menubar>
                <MenubarMenu>
                  <MenubarTrigger className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" />
                    {profile?.name || user?.email}
                  </MenubarTrigger>
                  <MenubarContent>
                    <MenubarItem onClick={handleLogout} className="cursor-pointer">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair
                    </MenubarItem>
                  </MenubarContent>
                </MenubarMenu>
              </Menubar>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content ajustado para sidebar e header */}
      <main className="w-full pt-16 ml-64" style={{ width: 'calc(100% - 16rem)' }}>
        <div className="py-6 px-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;

export default AdminLayout;