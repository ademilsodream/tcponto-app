import * as React from 'react';
import { useState, useCallback, useMemo, Suspense, lazy } from 'react';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';

// Lazy loading otimizado
const TimeRegistration = lazy(() => import('@/components/TimeRegistration'));
const EmployeeDrawer = lazy(() => import('@/components/EmployeeDrawer'));

// Componentes pesados carregados apenas quando necessário
const EmployeeMonthlySummary = lazy(() => import('@/components/EmployeeMonthlySummary'));
const EmployeeDetailedReport = lazy(() => import('@/components/EmployeeDetailedReport'));
const IncompleteRecordsProfile = lazy(() => import('@/components/IncompleteRecordsProfile'));
const AdjustPreviousDays = lazy(() => import('@/components/AdjustPreviousDays'));

// Loading otimizado
const OptimizedLoadingSpinner = React.memo(() => (
  <div className="flex items-center justify-center w-full h-full min-h-[200px]">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
  </div>
));

const UltraOptimizedEmployeeDashboard = React.memo(() => {
  const { user } = useOptimizedAuth();
  const [activeScreen, setActiveScreen] = useState('timeRegistration');
  
  // Data memoizada
  const selectedDate = useMemo(() => new Date(), []);

  // Callback otimizado
  const handleScreenChange = useCallback((screen: string) => {
    setActiveScreen(screen);
  }, []);

  // Render memoizado
  const renderActiveScreen = useMemo(() => {
    const screenProps = {
      onBack: () => handleScreenChange('timeRegistration')
    };

    switch (activeScreen) {
      case 'timeRegistration':
        return (
          <Suspense fallback={<OptimizedLoadingSpinner />}>
            <TimeRegistration />
          </Suspense>
        );
      case 'monthlySummary':
        return (
          <Suspense fallback={<OptimizedLoadingSpinner />}>
            <EmployeeMonthlySummary 
              selectedMonth={selectedDate}
              {...screenProps}
            />
          </Suspense>
        );
      case 'detailedReport':
        return (
          <Suspense fallback={<OptimizedLoadingSpinner />}>
            <EmployeeDetailedReport 
              selectedMonth={selectedDate}
              {...screenProps}
            />
          </Suspense>
        );
      case 'incompleteRecords':
        return (
          <Suspense fallback={<OptimizedLoadingSpinner />}>
            <IncompleteRecordsProfile {...screenProps} />
          </Suspense>
        );
      case 'adjustPreviousDays':
        return (
          <Suspense fallback={<OptimizedLoadingSpinner />}>
            <AdjustPreviousDays {...screenProps} />
          </Suspense>
        );
      default:
        return (
          <Suspense fallback={<OptimizedLoadingSpinner />}>
            <TimeRegistration />
          </Suspense>
        );
    }
  }, [activeScreen, selectedDate, handleScreenChange]);

  return (
    <div className="relative w-full min-h-screen bg-gray-50">
      <Suspense fallback={<OptimizedLoadingSpinner />}>
        <EmployeeDrawer 
          activeScreen={activeScreen}
          onScreenChange={handleScreenChange}
        />
      </Suspense>

      <div className="w-full min-h-screen">
        {renderActiveScreen}
      </div>
    </div>
  );
});

UltraOptimizedEmployeeDashboard.displayName = 'UltraOptimizedEmployeeDashboard';

export default UltraOptimizedEmployeeDashboard;
