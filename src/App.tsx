
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

// Páginas/Componentes reais
import EmployeeMonthlySummary from '@/components/EmployeeMonthlySummary';
import EmployeeDetailedReport from '@/components/EmployeeDetailedReport';
import IncompleteRecordsProfile from '@/components/IncompleteRecordsProfile';
import AdjustPreviousDays from '@/components/AdjustPreviousDays';
import VacationRequest from '@/components/VacationRequest';
import EmployeeDocuments from '@/components/EmployeeDocuments';
import SalaryAdvanceRequest from '@/components/SalaryAdvanceRequest';

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

                {/* Rotas reais do menu */}
                <Route
                  path="/monthly-summary"
                  element={
                    <ProtectedRoute>
                      <EmployeeLayout>
                        <EmployeeMonthlySummary selectedMonth={new Date()} />
                      </EmployeeLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/detailed-report"
                  element={
                    <ProtectedRoute>
                      <EmployeeLayout>
                        <EmployeeDetailedReport selectedMonth={new Date()} onBack={() => {}} />
                      </EmployeeLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/incomplete-records"
                  element={
                    <ProtectedRoute>
                      <EmployeeLayout>
                        <IncompleteRecordsProfile />
                      </EmployeeLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/adjust-previous-days"
                  element={
                    <ProtectedRoute>
                      <EmployeeLayout>
                        <AdjustPreviousDays />
                      </EmployeeLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/vacation-request"
                  element={
                    <ProtectedRoute>
                      <EmployeeLayout>
                        <VacationRequest />
                      </EmployeeLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/documents"
                  element={
                    <ProtectedRoute>
                      <EmployeeLayout>
                        <EmployeeDocuments />
                      </EmployeeLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/salary-advance"
                  element={
                    <ProtectedRoute>
                      <EmployeeLayout>
                        <SalaryAdvanceRequest />
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
