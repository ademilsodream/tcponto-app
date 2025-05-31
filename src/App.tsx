
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from '@/components/ui/menubar';
import { Settings, LogOut, User, Building2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { Toaster } from '@/components/ui/toaster';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import SettingsPage from '@/components/Settings';
import NotFound from '@/pages/NotFound';
import { initializeApp } from '@/utils/initializeApp';
import './App.css';

const Layout = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const {
    user,
    logout
  } = useAuth();
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };
  const isAdmin = user?.role === 'admin';
  return <div className="min-h-screen bg-gray-50 w-full">
      <header className="bg-white shadow-sm border-b w-full">
        <div className="w-full px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <img src="/lovable-uploads/669270b6-ec43-4161-8f51-34a39fc1b06f.png" alt="TCPonto Logo" className="w-8 h-8 rounded-full" />
              <h1 className="text-xl font-bold text-gray-900">TCPonto</h1>
            </div>

            <div className="flex items-center space-x-4">
              {/* Só mostrar menus para admin */}
              {isAdmin && <>
                  <Menubar>
                    <MenubarMenu>
                      <MenubarTrigger asChild>
                        <Link to="/" className="cursor-pointer">Dashboard</Link>
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
                </>}

              <Menubar>
                <MenubarMenu>
                  <MenubarTrigger className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" />
                    {user?.email}
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

      <main className="w-full py-6 px-6">
        {children}
      </main>
    </div>;
};

const AppContent = () => {
  const {
    user,
    loading
  } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-50 w-full">
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        
        <Route path="/" element={user ? <Layout>
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              </Layout> : <Navigate to="/login" replace />} />
        
        <Route path="/settings" element={user ? <Layout>
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              </Layout> : <Navigate to="/login" replace />} />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>;
};

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  useEffect(() => {
    initializeApp().then(() => {
      setIsInitialized(true);
    });
  }, []);
  if (!isInitialized) {
    return <div className="min-h-screen flex items-center justify-center w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>;
  }
  return <QueryProvider>
      <AuthProvider>
        <CurrencyProvider>
          <Router>
            <AppContent />
            <Toaster />
          </Router>
        </CurrencyProvider>
      </AuthProvider>
    </QueryProvider>;
}

export default App;
