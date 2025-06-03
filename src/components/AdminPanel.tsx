import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Clock, AlertCircle, UserPlus, LayoutDashboard } from 'lucide-react'; // Added LayoutDashboard icon
import OptimizedAdminDashboard from '@/components/OptimizedAdminDashboard';
import OptimizedPendingApprovals from '@/components/OptimizedPendingApprovals';
import UserManagement from '@/components/UserManagement';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourlyRate: number;
  overtimeRate: number;
}

const AdminPanel = () => {
  // Query otimizada para buscar funcionários ATIVOS apenas
  const {
    data: employees = [],
    isLoading: loadingEmployees,
    refetch: refetchEmployees
  } = useQuery<User[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;

      return data.map(profile => ({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role as 'admin' | 'user',
        hourlyRate: Number(profile.hourly_rate),
        overtimeRate: Number(profile.overtime_rate) || Number(profile.hourly_rate) * 1.5 // Fallback calculation
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchInterval: 10 * 60 * 1000 // Refetch a cada 10 minutos
  });

  // Query para contar solicitações pendentes
  const {
    data: pendingCount = 0,
    refetch: refetchPendingCount // Added refetch for pending count
  } = useQuery<number>({
    queryKey: ['pending-requests-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('edit_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;
      return count || 0;
    },
    staleTime: 1 * 60 * 1000, // 1 minuto
    refetchInterval: 2 * 60 * 1000 // Refetch a cada 2 minutos
  });

  // Function to refetch data after actions in child components if needed
  const handleDataChange = () => {
      refetchEmployees();
      refetchPendingCount();
  }


  if (loadingEmployees) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2">Carregando painel administrativo...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600">
            Total de funcionários ativos: {employees.length}
          </div>
          {pendingCount > 0 && (
            <Alert className="inline-flex items-center p-2 border-orange-200 bg-orange-50">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800 ml-1">
                {pendingCount} solicitação(ões) pendente(s)
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* Dashboard Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5" />
            Dashboard Geral
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OptimizedAdminDashboard employees={employees} />
        </CardContent>
      </Card>

      {/* Pending Approvals Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Gerenciar Solicitações Pendentes
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center ml-2">
                {pendingCount}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Pass handleDataChange to trigger refetches if approvals are processed */}
          <OptimizedPendingApprovals employees={employees} onApprovalChange={handleDataChange} />
        </CardContent>
      </Card>

      {/* User Management Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Gerenciar Funcionários
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Pass handleDataChange to trigger refetches if users are added/edited/deleted */}
          <UserManagement onUserChange={handleDataChange} />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPanel;
