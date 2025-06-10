
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { OptimizedAuthProvider, useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { UltraOptimizedQueryProvider } from '@/providers/UltraOptimizedQueryProvider';
import { Toaster } from '@/components/ui/toaster';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminLayout from '@/components/AdminLayout';
import EmployeeLayout from '@/components/EmployeeLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import UltraOptimizedEmployeeDashboard from '@/components/UltraOptimizedEmployeeDashboard';
import SettingsPage from '@/components/Settings';
import NotFound from '@/pages/NotFound';
import { initializeApp } from '@/utils/initializeApp';
import './App.css';

// Loading otimizado
const OptimizedSpinner = React.memo(() => (
  <div className="min-h-screen flex items-center justify-center w-full">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
  </div>
));

const AppContent = React.memo(() => {
  const { user, profile, isLoading } = useOptimizedAuth();

  if (isLoading) {
    return <OptimizedSpinner />;
  }

  const isAdmin = user && profile && profile.role === 'admin';

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
              profile ? (
                isAdmin ? (
                  <AdminLayout>
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  </AdminLayout>
                ) : (
                  <EmployeeLayout>
                    <ProtectedRoute>
                      <UltraOptimizedEmployeeDashboard />
                    </ProtectedRoute>
                  </EmployeeLayout>
                )
              ) : (
                <OptimizedSpinner />
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
