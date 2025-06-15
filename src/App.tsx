
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { OptimizedAuthProvider } from '@/contexts/OptimizedAuthContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { UltraOptimizedQueryProvider } from '@/providers/UltraOptimizedQueryProvider';
import { Toaster } from '@/components/ui/toaster';
import EmployeeLayout from '@/components/EmployeeLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import UltraOptimizedEmployeeDashboard from '@/components/UltraOptimizedEmployeeDashboard';
import NotFound from '@/pages/NotFound';
// Removido: import { initializeApp } from '@/utils/initializeApp';
import './App.css';

const AppContent = React.memo(() => {
  return (
    <div className="min-h-screen bg-gray-50 w-full">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <EmployeeLayout>
                <UltraOptimizedEmployeeDashboard />
              </EmployeeLayout>
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
});

AppContent.displayName = 'AppContent';

function App() {
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
