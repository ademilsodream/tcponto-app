
import React from 'react';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import UnifiedTimeRegistration from '@/components/UnifiedTimeRegistration';

const UnifiedTimeRecordPage: React.FC = () => {
  const { user, isLoading } = useOptimizedAuth();

  if (isLoading) return <div className="text-center p-4">Carregando...</div>;
  if (!user) return <div className="text-center p-4">Não autenticado.</div>;

  return (
    <div className="w-full">
      <UnifiedTimeRegistration />
    </div>
  );
};

export default UnifiedTimeRecordPage;
