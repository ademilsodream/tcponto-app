
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { OptimizedAuthProvider, useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { UltraOptimizedQueryProvider } from '@/providers/UltraOptimizedQueryProvider';
import { Toaster } from '@/components/ui/toaster';
import EmployeeLayout from '@/components/EmployeeLayout';
import Login from '@/pages/Login';
import UltraOptimizedEmployeeDashboard from '@/components/UltraOptimizedEmployeeDashboard';
import NotFound from '@/pages/NotFound';
import { initializeApp } from '@/utils/initializeApp';
import './App.css';

// ✨ Loading ultra otimizado com timeout
const OptimizedSpinner = React.memo(() => (
  <div className="min-h-screen flex items-center justify-center w-full">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-sm text-gray-600">Carregando aplicação...</p>
    </div>
  </div>
));

OptimizedSpinner.displayName = 'OptimizedSpinner';

const AppContent = React.memo(() => {
  const { user, isLoading } = useOptimizedAuth();
  const [authTimeout, setAuthTimeout] = useState(false);

  // ✨ Timeout para auth - nunca deixar carregando infinito
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        console.warn('⚠️ Auth timeout - forçando continuação');
        setAuthTimeout(true);
      }
    }, 10000); // 10 segundos máximo

    return () => clearTimeout(timer);
  }, [isLoading]);

  // ✨ Se passou do timeout, mostrar login sempre
  if (isLoading && !authTimeout) {
    return <OptimizedSpinner />;
  }

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
              <EmployeeLayout>
                <UltraOptimizedEmployeeDashboard />
              </EmployeeLayout>
            ) : (
              <Navigate to="/login" replace />
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
  const [initTimeout, setInitTimeout] = useState(false);

  useEffect(() => {
    let mounted = true;

    // ✨ Timeout de segurança para inicialização
    const safetyTimer = setTimeout(() => {
      if (mounted && !isInitialized) {
        console.warn('⚠️ Init timeout - prosseguindo sem inicialização');
        setInitTimeout(true);
        setIsInitialized(true);
      }
    }, 12000); // 12 segundos máximo total

    const init = async () => {
      try {
        const success = await initializeApp();
        if (mounted) {
          setIsInitialized(true);
          clearTimeout(safetyTimer);
        }
      } catch (error) {
        console.error('Erro na inicialização:', error);
        if (mounted) {
          // ✨ Mesmo com erro, continuar
          setIsInitialized(true);
          clearTimeout(safetyTimer);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
    };
  }, [isInitialized]);

  // ✨ Não deixar loading infinito NUNCA
  if (!isInitialized && !initTimeout) {
    return <OptimizedSpinner />;
  }

  return (
    <UltraOptimizedQueryProvider>
      <OptimizedAuthProvider>
        <CurrencyProvider>
          <Router>
            <AppContent />
            <Toaster />
          </Router>
        </CurrencyProvider>
      </OptimizedAuthProvider>
    </UltraOptimizedQueryProvider>
  );
}

export default App;
