
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

// ✨ Loading ultra otimizado
const OptimizedSpinner = React.memo(() => (
  <div className="min-h-screen flex items-center justify-center w-full">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
  </div>
));

OptimizedSpinner.displayName = 'OptimizedSpinner';

const AppContent = React.memo(() => {
  const { user, isLoading } = useOptimizedAuth();

  if (isLoading) {
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

  useEffect(() => {
    initializeApp().then(() => {
      setIsInitialized(true);
    });
  }, []);

  if (!isInitialized) {
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
