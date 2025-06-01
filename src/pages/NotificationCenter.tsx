
import React from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import NotificationCenter from '@/components/NotificationCenter';

const NotificationCenterPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50">
        <div className="container mx-auto px-4 py-8">
          <NotificationCenter />
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default NotificationCenterPage;
