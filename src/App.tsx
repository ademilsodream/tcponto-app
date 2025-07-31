
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { OptimizedAuthProvider } from '@/contexts/OptimizedAuthContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { UltraOptimizedQueryProvider } from '@/providers/UltraOptimizedQueryProvider';
import Login from '@/pages/Login';
import ProtectedRoute from '@/components/ProtectedRoute';
import EmployeeLayout from '@/components/EmployeeLayout';
import OptimizedTimeRegistration from '@/components/OptimizedTimeRegistration';
import UltraOptimizedEmployeeDashboard from '@/components/UltraOptimizedEmployeeDashboard';

function App() {
  return (
    <UltraOptimizedQueryProvider>
      <OptimizedAuthProvider>
        <CurrencyProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route 
                path="/employee/*" 
                element={
                  <ProtectedRoute>
                    <EmployeeLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<UltraOptimizedEmployeeDashboard />} />
              </Route>
              <Route path="/" element={<Login />} />
            </Routes>
          </Router>
          <Toaster />
        </CurrencyProvider>
      </OptimizedAuthProvider>
    </UltraOptimizedQueryProvider>
  );
}

export default App;
