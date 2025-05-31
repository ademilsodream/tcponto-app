
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Clock, AlertCircle, UserPlus } from 'lucide-react';
import OptimizedAdminDashboard from '@/components/OptimizedAdminDashboard';
import OptimizedPendingApprovals from '@/components/OptimizedPendingApprovals';
import UserManagement from '@/components/UserManagement';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { isValidQueryResult, isProfile } from '@/utils/queryValidation';

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
  } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'active' as any)
        .order('name');

      if (error) throw error;

      // Verificar se os dados são válidos antes de processar
      if (!isValidQueryResult(data, error)) {
        console.error('Dados inválidos retornados para profiles');
        return [];
      }

      return data
        .filter(profile => isProfile(profile))
        .map(profile => ({
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role as 'admin' | 'user',
          hourlyRate: Number(profile.hourly_rate),
          overtimeRate: Number(profile.overtime_rate) || Number(profile.hourly_rate) * 1.5
        }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchInterval: 10 * 60 * 1000 // Refetch a cada 10 minutos
  });

  // Query para contar solicitações pendentes
  const {
    data: pendingCount = 0
  } = useQuery({
    queryKey: ['pending-requests-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('edit_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending' as any);

      if (error) throw error;
      return count || 0;
    },
    staleTime: 1 * 60 * 1000, // 1 minuto
    refetchInterval: 2 * 60 * 1000 // Refetch a cada 2 minutos
  });

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

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Aprovações
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Funcionários
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <OptimizedAdminDashboard employees={employees} />
        </TabsContent>

        <TabsContent value="approvals" className="space-y-6">
          <OptimizedPendingApprovals employees={employees} />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <UserManagement onUserChange={refetchEmployees} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;
