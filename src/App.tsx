import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/OptimizedAuthContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import Login from '@/pages/Login';
import EmployeeLayout from '@/components/EmployeeLayout';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CurrencyProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/employee/*" element={<EmployeeLayout />} />
              <Route path="/" element={<Login />} />
            </Routes>
          </Router>
          <Toaster />
        </CurrencyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
