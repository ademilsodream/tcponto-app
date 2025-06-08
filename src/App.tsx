
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { OptimizedQueryProvider } from '@/providers/OptimizedQueryProvider';
import { Toaster } from '@/components/ui/toaster';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminLayout from '@/components/AdminLayout';
import EmployeeLayout from '@/components/EmployeeLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import OptimizedEmployeeDashboard from '@/components/OptimizedEmployeeDashboard';
import SettingsPage from '@/components/Settings';
import NotFound from '@/pages/NotFound';
import { initializeApp } from '@/utils/initializeApp';
import './App.css';

const AppContent = React.memo(() => {
  const { user, profile, loading, profileLoading } = useAuth();

  // ✨ Loading otimizado - aguardar tanto auth quanto perfil
  const isFullyLoaded = !loading && !profileLoading;
  const hasProfile = profile !== null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // ✨ Se usuário logado mas perfil ainda carregando, mostrar loading específico
  if (user && profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center w-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  // ✨ Verificação de admin aprimorada - só após profile estar carregado
  const isAdmin = user && hasProfile && profile?.role === 'admin';
  
  console.log('🔍 Verificação de role:', {
    user: !!user,
    hasProfile,
    profileRole: profile?.role,
    isAdmin
  });

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      <Routes>
        <Route 
          path="/login" 
          element={user ? <Navigate to="/" replace /> : <Login />} 
        />
        
        <Route 
          path="/" 
          element={
            user ? (
              // ✨ Só renderizar interface após ter perfil carregado
              hasProfile ? (
                isAdmin ? (
                  <AdminLayout>
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  </AdminLayout>
                ) : (
                  <EmployeeLayout>
                    <ProtectedRoute>
                      <OptimizedEmployeeDashboard />
                    </ProtectedRoute>
                  </EmployeeLayout>
                )
              ) : (
                // Aguardando carregamento do perfil
                <div className="min-h-screen flex items-center justify-center w-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Verificando permissões...</p>
                  </div>
                </div>
              )
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        
        <Route 
          path="/settings" 
          element={
            user && isAdmin ? (
              <AdminLayout>
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              </AdminLayout>
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
});

AppContent.displayName = 'AppContent';

function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeApp().then(() => {
      setIsInitialized(true);
    });
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <OptimizedQueryProvider>
      <AuthProvider>
        <CurrencyProvider>
          <Router>
            <AppContent />
            <Toaster />
          </Router>
        </CurrencyProvider>
      </AuthProvider>
    </OptimizedQueryProvider>
  );
}

export default App;
