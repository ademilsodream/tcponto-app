import React, { useEffect, useState, useCallback, useMemo, Suspense, lazy } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { clearLocationCache } from '@/utils/optimizedLocationValidation';

// Lazy loading dos componentes
const OptimizedTimeRegistration = lazy(() => import('@/components/OptimizedTimeRegistration'));
const EmployeeDrawer = lazy(() => import('@/components/EmployeeDrawer'));
const EmployeeMonthlySummary = lazy(() => import('@/components/EmployeeMonthlySummary'));
const EmployeeDetailedReport = lazy(() => import('@/components/EmployeeDetailedReport'));
const IncompleteRecordsProfile = lazy(() => import('@/components/IncompleteRecordsProfile'));
const AdjustPreviousDays = lazy(() => import('@/components/AdjustPreviousDays'));

// Componente de loading
const LoadingSpinner = () => (
  <div className="flex items-center justify-center w-full h-full min-h-[200px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const OptimizedEmployeeDashboard: React.FC = React.memo(() => {
  const { user } = useAuth();
  const [activeScreen, setActiveScreen] = useState('timeRegistration');
  
  // Memoizar data selecionada
  const selectedDate = useMemo(() => new Date(), []);

  // Callback otimizado para mudança de tela
  const handleScreenChange = useCallback((screen: string) => {
    // Limpar cache de localização ao mudar de tela se necessário
    if (screen !== 'timeRegistration') {
      clearLocationCache();
    }
    setActiveScreen(screen);
  }, []);

  // Cleanup ao desmontar componente
  useEffect(() => {
    return () => {
      clearLocationCache();
    };
  }, []);

  // Memoizar função de render para evitar re-renders
  const renderActiveScreen = useCallback(() => {
    const screenProps = {
      onBack: () => handleScreenChange('timeRegistration')
    };

    switch (activeScreen) {
      case 'timeRegistration':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <OptimizedTimeRegistration />
          </Suspense>
        );
      case 'monthlySummary':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <EmployeeMonthlySummary 
              selectedMonth={selectedDate}
              {...screenProps}
            />
          </Suspense>
        );
      case 'detailedReport':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <EmployeeDetailedReport 
              selectedMonth={selectedDate}
              {...screenProps}
            />
          </Suspense>
        );
      case 'incompleteRecords':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <IncompleteRecordsProfile {...screenProps} />
          </Suspense>
        );
      case 'adjustPreviousDays':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <AdjustPreviousDays {...screenProps} />
          </Suspense>
        );
      default:
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <OptimizedTimeRegistration />
          </Suspense>
        );
    }
  }, [activeScreen, selectedDate, handleScreenChange]);

  return (
    <div className="relative w-full min-h-screen bg-gray-50">
      <Suspense fallback={<LoadingSpinner />}>
        <EmployeeDrawer 
          activeScreen={activeScreen}
          onScreenChange={handleScreenChange}
        />
      </Suspense>

      <div className="w-full min-h-screen">
        {renderActiveScreen()}
      </div>
    </div>
  );
});

OptimizedEmployeeDashboard.displayName = 'OptimizedEmployeeDashboard';

export default OptimizedEmployeeDashboard;
