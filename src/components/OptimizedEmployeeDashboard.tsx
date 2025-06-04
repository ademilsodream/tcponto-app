
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import OptimizedTimeRegistration from '@/components/OptimizedTimeRegistration';
import EmployeeDrawer from '@/components/EmployeeDrawer';
import EmployeeMonthlySummary from '@/components/EmployeeMonthlySummary';
import EmployeeDetailedReport from '@/components/EmployeeDetailedReport';
import IncompleteRecordsProfile from '@/components/IncompleteRecordsProfile';
import AdjustPreviousDays from '@/components/AdjustPreviousDays';
import { useAuth } from '@/contexts/AuthContext';
import { clearLocationCache } from '@/utils/optimizedLocationValidation';

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
    switch (activeScreen) {
      case 'timeRegistration':
        return <OptimizedTimeRegistration />;
      case 'monthlySummary':
        return (
          <EmployeeMonthlySummary 
            selectedMonth={selectedDate}
            onBack={() => handleScreenChange('timeRegistration')} 
          />
        );
      case 'detailedReport':
        return (
          <EmployeeDetailedReport 
            selectedMonth={selectedDate}
            onBack={() => handleScreenChange('timeRegistration')} 
          />
        );
      case 'incompleteRecords':
        return (
          <IncompleteRecordsProfile 
            onBack={() => handleScreenChange('timeRegistration')} 
          />
        );
      case 'adjustPreviousDays':
        return (
          <AdjustPreviousDays 
            onBack={() => handleScreenChange('timeRegistration')} 
          />
        );
      default:
        return <OptimizedTimeRegistration />;
    }
  }, [activeScreen, selectedDate, handleScreenChange]);

  return (
    <div className="relative w-full min-h-screen bg-gray-50">
      {/* Menu lateral */}
      <EmployeeDrawer 
        activeScreen={activeScreen}
        onScreenChange={handleScreenChange}
      />

      {/* Conteúdo principal */}
      <div className="w-full min-h-screen">
        {renderActiveScreen()}
      </div>
    </div>
  );
});

OptimizedEmployeeDashboard.displayName = 'OptimizedEmployeeDashboard';

export default OptimizedEmployeeDashboard;
