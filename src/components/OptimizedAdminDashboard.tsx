import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Clock, DollarSign, Calendar, UserCheck, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useQuery } from '@tanstack/react-query';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourlyRate: number;
  overtimeRate: number;
}

interface DashboardData {
  totalEmployees: number;
  totalAdmins: number;
  totalHours: number;
  totalEarnings: number;
  employeeStatuses: EmployeeStatus[];
}

interface EmployeeStatus {
  employee: User;
  status: 'working' | 'lunch_break' | 'not_working' | 'day_finished';
  statusLabel: string;
  statusColor: string;
  record?: any;
}

interface AdminDashboardProps {
  employees: User[];
}

const OptimizedAdminDashboard: React.FC<AdminDashboardProps> = ({ employees }) => {
  const { formatCurrency } = useCurrency();

  // Função otimizada para buscar dados do dashboard
  const fetchDashboardData = async (): Promise<DashboardData> => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const startOfMonth = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
    const endOfMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    // 1. Buscar TODOS os registros do mês em uma única query usando os campos corretos
    const { data: allTimeRecords, error: recordsError } = await supabase
      .from('time_records')
      .select(`
        user_id,
        date,
        clock_in,
        lunch_start,
        lunch_end,
        clock_out,
        total_hours,
        total_pay
      `)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)
      .eq('status', 'active');

    if (recordsError) throw recordsError;

    // 2. Buscar registros de hoje em uma única query
    const { data: todayRecords, error: todayError } = await supabase
      .from('time_records')
      .select(`
        user_id,
        clock_in,
        lunch_start,
        lunch_end,
        clock_out
      `)
      .eq('date', today);

    if (todayError) throw todayError;

    // 3. Processar dados localmente usando os campos corretos da tabela
    let totalHours = 0;
    let totalEarnings = 0;

    // Calcular totais diretamente dos campos da tabela
    allTimeRecords?.forEach(record => {
      totalHours += Number(record.total_hours) || 0;
      totalEarnings += Number(record.total_pay) || 0;
    });

    // 4. Processar status dos funcionários
    const todayRecordsByUser = todayRecords?.reduce((acc, record) => {
      acc[record.user_id] = record;
      return acc;
    }, {} as Record<string, any>) || {};

    const employeeStatuses: EmployeeStatus[] = employees
      .filter(emp => emp.role === 'user')
      .map(employee => {
        const todayRecord = todayRecordsByUser[employee.id];
        const statusInfo = getEmployeeStatus(todayRecord);
        
        return {
          employee,
          status: statusInfo.status as any,
          statusLabel: statusInfo.label,
          statusColor: statusInfo.color,
          record: todayRecord
        };
      });

    return {
      totalEmployees: employees.length,
      totalAdmins: employees.filter(emp => emp.role === 'admin').length,
      totalHours,
      totalEarnings,
      employeeStatuses
    };
  };

  // React Query para cache e otimização
  const {
    data: dashboardData,
    isLoading,
    error
  } = useQuery({
    queryKey: ['dashboard-data', employees.length],
    queryFn: fetchDashboardData,
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchInterval: 10 * 60 * 1000, // Refetch a cada 10 minutos
    enabled: employees.length > 0
  });

  const getEmployeeStatus = (record: any): { status: string; label: string; color: string } => {
    if (!record?.clock_in) {
      return {
        status: 'not_working',
        label: 'Não iniciou o trabalho',
        color: 'red'
      };
    }

    if (record.clock_out) {
      return {
        status: 'day_finished',
        label: 'Finalizou o dia',
        color: 'blue'
      };
    }

    if (record.lunch_start && !record.lunch_end) {
      return {
        status: 'lunch_break',
        label: 'Em horário de almoço',
        color: 'yellow'
      };
    }

    return {
      status: 'working',
      label: record.lunch_end ? 'Trabalhando (voltou do almoço)' : 'Trabalhando',
      color: 'green'
    };
  };

  const getStatusColorClasses = (color: string) => {
    switch (color) {
      case 'green':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'yellow':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'blue':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'red':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getStatusBadgeClasses = (color: string) => {
    switch (color) {
      case 'green':
        return 'bg-green-200 text-green-800';
      case 'yellow':
        return 'bg-yellow-200 text-yellow-800';
      case 'blue':
        return 'bg-blue-200 text-blue-800';
      case 'red':
        return 'bg-red-200 text-red-800';
      default:
        return 'bg-gray-200 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2">Carregando dados do painel...</span>
      </div>
    );
  }

  if (error) {
    console.error('Error loading dashboard:', error);
    return (
      <div className="text-center p-8">
        <p className="text-red-600">Erro ao carregar dados do painel</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Total de Funcionários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.totalEmployees || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              Total de Administradores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.totalAdmins || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              Total de Horas Trabalhadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(dashboardData?.totalHours || 0).toFixed(1)}</div>
            <div className="text-sm text-gray-500">Mês vigente</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              Folha de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData?.totalEarnings || 0)}</div>
            <div className="text-sm text-gray-500">Mês vigente</div>
          </CardContent>
        </Card>
      </div>

      {/* Status Detalhado dos Funcionários */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Status dos Funcionários
            <span className="text-sm bg-blue-100 px-2 py-1 rounded-full">Em Tempo Real</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dashboardData?.employeeStatuses?.map((empStatus) => (
              <div 
                key={empStatus.employee.id} 
                className={`p-4 rounded-lg border ${getStatusColorClasses(empStatus.statusColor)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{empStatus.employee.name}</span>
                  <span className={`text-xs px-2 py-1 rounded ${getStatusBadgeClasses(empStatus.statusColor)}`}>
                    {empStatus.statusLabel}
                  </span>
                </div>
                
                {empStatus.record && (
                  <div className="text-xs space-y-1 text-gray-600">
                    {empStatus.record.clock_in && (
                      <div>Entrada: {empStatus.record.clock_in}</div>
                    )}
                    {empStatus.record.lunch_start && (
                      <div>Saída almoço: {empStatus.record.lunch_start}</div>
                    )}
                    {empStatus.record.lunch_end && (
                      <div>Volta almoço: {empStatus.record.lunch_end}</div>
                    )}
                    {empStatus.record.clock_out && (
                      <div>Saída: {empStatus.record.clock_out}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            {(!dashboardData?.employeeStatuses || dashboardData.employeeStatuses.length === 0) && (
              <div className="col-span-full text-center py-8">
                <UserX className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Nenhum funcionário cadastrado</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OptimizedAdminDashboard;
