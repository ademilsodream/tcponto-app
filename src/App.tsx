
import { Toaster } from '@/components/ui/toaster';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UltraOptimizedQueryProvider } from '@/providers/UltraOptimizedQueryProvider';
import { OptimizedAuthProvider } from '@/contexts/OptimizedAuthContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';
import ProtectedRoute from '@/components/ProtectedRoute';
import EmployeeLayout from '@/components/EmployeeLayout';
import UnifiedTimeRecordPage from '@/pages/UnifiedTimeRecordPage';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import DebugPanel from '@/components/DebugPanel';

function App() {
  return (
    <UltraOptimizedQueryProvider>
      <CurrencyProvider>
        <OptimizedAuthProvider>
          <Router>
            <div className="min-h-screen bg-background">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <EmployeeLayout>
                        <UnifiedTimeRecordPage />
                      </EmployeeLayout>
                    </ProtectedRoute>
                  }
                />
                {/* Alias para compatibilidade com redirecionamentos antigos */}
                <Route path="/employee" element={<Navigate to="/" replace />} />
                <Route path="/404" element={<NotFound />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Routes>
            </div>
          </Router>
          <Toaster />
          <DebugPanel />
        </OptimizedAuthProvider>
      </CurrencyProvider>
    </UltraOptimizedQueryProvider>
  );
}

export default App;
