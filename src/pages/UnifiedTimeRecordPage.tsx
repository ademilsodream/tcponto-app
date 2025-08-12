
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import UnifiedTimeRegistration from '@/components/UnifiedTimeRegistration';

const UnifiedTimeRecordPage: React.FC = () => {
  const { user, isLoading } = useOptimizedAuth();

  if (isLoading) return <div className="text-center p-4">Carregando...</div>;
  if (!user) return <div className="text-center p-4">Não autenticado.</div>;

  return (
    <div className="container mx-auto py-4 sm:py-8">
      <Card className="w-full max-w-3xl mx-auto">
        <CardContent className="py-2 sm:py-4">
          <UnifiedTimeRegistration />
        </CardContent>
      </Card>
    </div>
  );
};

export default UnifiedTimeRecordPage;
