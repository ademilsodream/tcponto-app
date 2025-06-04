
import React, { useEffect, useState } from 'react';
import TimeRegistration from '@/components/TimeRegistration';
import EmployeeDrawer from '@/components/EmployeeDrawer';
import EmployeeMonthlySummary from '@/components/EmployeeMonthlySummary';
import EmployeeDetailedReport from '@/components/EmployeeDetailedReport';
import IncompleteRecordsProfile from '@/components/IncompleteRecordsProfile';
import AdjustPreviousDays from '@/components/AdjustPreviousDays';
import { useAuth } from '@/contexts/AuthContext';

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeScreen, setActiveScreen] = useState('timeRegistration');
  const [selectedDate] = useState<Date>(new Date());

  // Ativar GPS automaticamente quando carrega a tela
  useEffect(() => {
    const requestLocationPermission = () => {
      if (navigator.geolocation) {
        console.log('📍 Solicitando permissão de localização automaticamente...');
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('✅ Localização obtida automaticamente:', {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
          },
          (error) => {
            console.log('❌ Erro ao obter localização:', error.message);
            // Não mostrar alerta para não poluir a UX, apenas log
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
          }
        );
      }
    };

    // Solicitar localização imediatamente
    requestLocationPermission();
  }, []);

  const renderActiveScreen = () => {
    switch (activeScreen) {
      case 'timeRegistration':
        return <TimeRegistration />;
      case 'monthlySummary':
        return (
          <EmployeeMonthlySummary 
            selectedMonth={selectedDate}
            onBack={() => setActiveScreen('timeRegistration')} 
          />
        );
      case 'detailedReport':
        return (
          <EmployeeDetailedReport 
            selectedMonth={selectedDate}
            onBack={() => setActiveScreen('timeRegistration')} 
          />
        );
      case 'incompleteRecords':
        return <IncompleteRecordsProfile onBack={() => setActiveScreen('timeRegistration')} />;
      case 'adjustPreviousDays':
        return <AdjustPreviousDays onBack={() => setActiveScreen('timeRegistration')} />;
      default:
        return <TimeRegistration />;
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-gray-50">
      {/* Menu lateral */}
      <EmployeeDrawer 
        activeScreen={activeScreen}
        onScreenChange={setActiveScreen}
      />

      {/* Conteúdo principal */}
      <div className="w-full min-h-screen">
        {renderActiveScreen()}
      </div>
    </div>
  );
};

export default EmployeeDashboard;
