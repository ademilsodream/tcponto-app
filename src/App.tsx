
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { Toaster } from '@/components/ui/toaster';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminLayout from '@/components/AdminLayout';
import EmployeeLayout from '@/components/EmployeeLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import EmployeeDashboard from '@/components/EmployeeDashboard';
import SettingsPage from '@/components/Settings';
import NotFound from '@/pages/NotFound';
import { initializeApp } from '@/utils/initializeApp';
import './App.css';

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Determinar qual interface usar baseado no role do usuário
  const isAdmin = user?.role === 'admin';

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
              isAdmin ? (
                <AdminLayout>
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                </AdminLayout>
              ) : (
                <EmployeeLayout>
                  <ProtectedRoute>
                    <EmployeeDashboard />
                  </ProtectedRoute>
                </EmployeeLayout>
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
};

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
    <QueryProvider>
      <AuthProvider>
        <CurrencyProvider>
          <Router>
            <AppContent />
            <Toaster />
          </Router>
        </CurrencyProvider>
      </AuthProvider>
    </QueryProvider>
  );
}

export default App;
