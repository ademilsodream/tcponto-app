import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { OptimizedAuthProvider } from '@/contexts/OptimizedAuthContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import Login from '@/pages/Login';
import ProtectedRoute from '@/components/ProtectedRoute';
import EmployeeLayout from '@/components/EmployeeLayout';
import OptimizedTimeRegistration from '@/components/OptimizedTimeRegistration';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UltraOptimizedEmployeeDashboard from '@/components/UltraOptimizedEmployeeDashboard';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}

export default App;
