
import React, { useEffect } from 'react';
import TimeRegistration from '@/components/TimeRegistration';
import { useAuth } from '@/contexts/AuthContext';

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();

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

  return (
    <div className="min-h-screen bg-gray-50">
      <TimeRegistration />
    </div>
  );
};

export default EmployeeDashboard;
