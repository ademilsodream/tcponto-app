
import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';

// ✨ Importação direta - sem lazy loading para componentes principais
import TimeRegistration from '@/components/TimeRegistration';
import EmployeeDrawer from '@/components/EmployeeDrawer';

// ✨ Apenas componentes secundários em lazy loading
const EmployeeMonthlySummary = React.lazy(() => import('@/components/EmployeeMonthlySummary'));
const EmployeeDetailedReport = React.lazy(() => import('@/components/EmployeeDetailedReport'));
const IncompleteRecordsProfile = React.lazy(() => import('@/components/IncompleteRecordsProfile'));
const AdjustPreviousDays = React.lazy(() => import('@/components/AdjustPreviousDays'));

// Loading simples e rápido
const QuickLoadingSpinner = React.memo(() => (
  <div className="flex items-center justify-center w-full h-32">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
  </div>
));

QuickLoadingSpinner.displayName = 'QuickLoadingSpinner';

const UltraOptimizedEmployeeDashboard = React.memo(() => {
  const { user } = useOptimizedAuth();
  const [activeScreen, setActiveScreen] = useState('timeRegistration');
  
  // Data memoizada
  const selectedDate = useMemo(() => new Date(), []);
  
  // Callback otimizado
  const handleScreenChange = useCallback((screen: string) => {
    setActiveScreen(screen);
  }, []);
  
  // Render memoizado com fallback rápido
  const renderActiveScreen = useMemo(() => {
    const screenProps = {
      onBack: () => handleScreenChange('timeRegistration')
    };
    
    switch (activeScreen) {
      case 'timeRegistration':
        // ✨ Componente principal - sem lazy loading
        return <TimeRegistration />;
        
      case 'monthlySummary':
        return (
          <React.Suspense fallback={<QuickLoadingSpinner />}>
            <EmployeeMonthlySummary 
              selectedMonth={selectedDate}
              {...screenProps}
            />
          </React.Suspense>
        );
        
      case 'detailedReport':
        return (
          <React.Suspense fallback={<QuickLoadingSpinner />}>
            <EmployeeDetailedReport 
              selectedMonth={selectedDate}
              {...screenProps}
            />
          </React.Suspense>
        );
        
      case 'incompleteRecords':
        return (
          <React.Suspense fallback={<QuickLoadingSpinner />}>
            <IncompleteRecordsProfile {...screenProps} />
          </React.Suspense>
        );
        
      case 'adjustPreviousDays':
        return (
          <React.Suspense fallback={<QuickLoadingSpinner />}>
            <AdjustPreviousDays {...screenProps} />
          </React.Suspense>
        );
        
      default:
        return <TimeRegistration />;
    }
  }, [activeScreen, selectedDate, handleScreenChange]);
  
  return (
    <div className="relative w-full min-h-screen bg-gray-50">
      {/* ✨ Drawer principal - sem lazy loading */}
      <EmployeeDrawer 
        activeScreen={activeScreen}
        onScreenChange={handleScreenChange}
      />
      
      <div className="w-full min-h-screen">
        {renderActiveScreen}
      </div>
    </div>
  );
});

UltraOptimizedEmployeeDashboard.displayName = 'UltraOptimizedEmployeeDashboard';

export default UltraOptimizedEmployeeDashboard;
