
import React from 'react';
import TimeRegistration from '@/components/TimeRegistration';

const UltraOptimizedEmployeeDashboard: React.FC = () => {
  console.log('📊 UltraOptimizedEmployeeDashboard renderizando...');
  console.log('🔗 Rota atual:', window.location.pathname);
  
  return (
    <div className="w-full">
      <TimeRegistration />
    </div>
  );
};

export default UltraOptimizedEmployeeDashboard;
