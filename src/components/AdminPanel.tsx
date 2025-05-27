import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import AdminDashboard from './AdminDashboard';
import UserManagement from './UserManagement';
import PendingApprovals from './PendingApprovals';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourlyRate: number;
  overtimeRate: number;
}

interface AdminPanelProps {
  onBack?: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (error) throw error;

      const formattedEmployees = data.map(profile => ({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role as 'admin' | 'user',
        hourlyRate: Number(profile.hourly_rate),
        overtimeRate: Number(profile.hourly_rate) * 1.5
      }));

      setEmployees(formattedEmployees);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return <div>Carregando...</div>;
    }

    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboard employees={employees} />;
      case 'users':
        return <UserManagement />;
      case 'approvals':
        return <PendingApprovals employees={employees} />;
      default:
        return <AdminDashboard employees={employees} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="mb-8">
        <nav className="flex space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Dashboard em Tempo Real
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Gerenciar Usuários
          </button>

          <button
            onClick={() => setActiveTab('approvals')}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap ${
              activeTab === 'approvals'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Solicitações Pendentes
          </button>
        </nav>
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  );
};

export default AdminPanel;
