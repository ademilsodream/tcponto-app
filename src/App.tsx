
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

// Placeholders simples
const Placeholder = ({ title }: { title: string }) => (
  <div className="p-8 text-center text-gray-600">{title}</div>
);

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
                <Route path="/employee" element={<Navigate to="/" replace />} />
                {/* Rotas de menu */}
                <Route
                  path="/monthly-summary"
                  element={
                    <ProtectedRoute>
                      <EmployeeLayout>
                        <Placeholder title="Resumo Mensal (em breve)" />
                      </EmployeeLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/detailed-report"
                  element={
                    <ProtectedRoute>
                      <EmployeeLayout>
                        <Placeholder title="Relatório Detalhado (em breve)" />
                      </EmployeeLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/incomplete-records"
                  element={
                    <ProtectedRoute>
                      <EmployeeLayout>
                        <Placeholder title="Registros Incompletos (em breve)" />
                      </EmployeeLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/adjust-previous-days"
                  element={
                    <ProtectedRoute>
                      <EmployeeLayout>
                        <Placeholder title="Ajustar dias anteriores (em breve)" />
                      </EmployeeLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/vacation-request"
                  element={
                    <ProtectedRoute>
                      <EmployeeLayout>
                        <Placeholder title="Solicitar Férias (em breve)" />
                      </EmployeeLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/documents"
                  element={
                    <ProtectedRoute>
                      <EmployeeLayout>
                        <Placeholder title="Meus Documentos (em breve)" />
                      </EmployeeLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/salary-advance"
                  element={
                    <ProtectedRoute>
                      <EmployeeLayout>
                        <Placeholder title="Vale Salarial (em breve)" />
                      </EmployeeLayout>
                    </ProtectedRoute>
                  }
                />
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
