import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Clock, DollarSign, Calendar, UserCheck, UserX, BarChart3, Clock4 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useQuery } from '@tanstack/react-query';
import AdvancedAnalytics from './AdvancedAnalytics';
import AnalyticsButton from './AnalyticsButton';
import { calculateWorkingHours } from '@/utils/timeCalculations'; // Importar a função calculateWorkingHours

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
  totalNormalHours: number; // ✨ Alterado para total de horas NORMAIS
  totalOvertimeHours: number;
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

// Função para formatar horas no padrão HH:MM
const formatHoursAsTime = (hours: number | null | undefined) => {
  if (hours === null || hours === undefined || hours === 0) return '00:00';

  const totalMinutes = Math.round(hours * 60);
  const hoursDisplay = Math.floor(totalMinutes / 60);
  const minutesDisplay = totalMinutes % 60;

  return `${hoursDisplay.toString().padStart(2, '0')}:${minutesDisplay.toString().padStart(2, '0')}`;
};

const OptimizedAdminDashboard: React.FC<AdminDashboardProps> = ({ employees }) => {
  const { formatCurrency } = useCurrency();

  // Função extremamente otimizada para buscar dados
  const fetchDashboardData = useCallback(async (): Promise<DashboardData> => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const startOfMonth = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
    const endOfMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    // ✨ NOVO: Buscar dados atualizados dos funcionários do banco (igual PayrollReport)
    const employeeIds = employees.map(emp => emp.id);
    const { data: dbEmployees, error: employeesError } = await supabase
      .from('profiles')
      .select('id, name, email, role, hourly_rate, overtime_rate')
      .in('id', employeeIds);

    if (employeesError) throw employeesError;

    // Buscar todos os campos necessários para recalcular as horas do mês
    const { data: monthlyRecords, error: monthlyError } = await supabase
      .from('time_records')
      .select('user_id, date, clock_in, lunch_start, lunch_end, clock_out')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth);

    if (monthlyError) throw monthlyError;

    // Query separada e otimizada para dados de hoje (ainda necessária para o status)
    const { data: todayData, error: todayError } = await supabase
      .from('time_records')
      .select('user_id, clock_in, lunch_start, lunch_end, clock_out')
      .eq('date', today);

    if (todayError) throw todayError;

    // ✨ ALTERAÇÃO: Usar dados do banco e cálculos iguais aos outros arquivos

    // Criar um mapa para agrupar registros por usuário
    const recordsByUser = new Map<string, any[]>();
    monthlyRecords?.forEach(record => {
      if (!recordsByUser.has(record.user_id)) {
        recordsByUser.set(record.user_id, []);
      }
      recordsByUser.get(record.user_id)!.push(record);
    });

    let grandTotalNormalHours = 0;
    let grandTotalOvertimeHours = 0;
    let grandTotalEarnings = 0;

    // ✨ ALTERAÇÃO: Criar mapa com dados do banco (não props)
    const employeeMap = new Map(dbEmployees?.map(emp => [emp.id, emp]) || []);

    // Calcular totais para cada usuário e somá-los nos totais gerais
    for (const [userId, records] of recordsByUser.entries()) {
      const employee = employeeMap.get(userId);
      if (employee) {
        // ✨ ALTERAÇÃO: Acumuladores sem arredondamento (igual outros arquivos)
        let employeeTotalNormalHours = 0;
        let employeeTotalOvertimeHours = 0;

        // ✨ ALTERAÇÃO: Soma direta sem arredondamento diário
        records.forEach(record => {
          const { totalHours: dayTotalHours, normalHours: dayNormalHours, overtimeHours: dayOvertimeHours } =
            calculateWorkingHours(record.clock_in, record.lunch_start, record.lunch_end, record.clock_out);

          // Soma direta (igual DetailedTimeReport e PayrollReport)
          employeeTotalNormalHours += dayNormalHours;
          employeeTotalOvertimeHours += dayOvertimeHours;
        });

        // ✨ ALTERAÇÃO: Usar dados do banco com overtime_rate específico
        const hourlyRate = Number(employee.hourly_rate) || 0;
        const overtimeRate = Number(employee.overtime_rate) || 0;

        const employeeNormalPay = employeeTotalNormalHours * hourlyRate;
        const employeeOvertimePay = employeeTotalOvertimeHours * overtimeRate; // ✨ Usando overtime_rate direto
        const employeeTotalPay = employeeNormalPay + employeeOvertimePay;

        // Somar os totais do funcionário nos totais gerais
        grandTotalNormalHours += employeeTotalNormalHours;
        grandTotalOvertimeHours += employeeTotalOvertimeHours;
        grandTotalEarnings += employeeTotalPay;
      }
    }

    // Mapa otimizado para status dos funcionários (sem alteração)
    const todayRecordsMap = new Map(
      todayData?.map(record => [record.user_id, record]) || []
    );

    // Filtrar apenas funcionários (não admins) e processar status (sem alteração)
    const employeeStatuses: EmployeeStatus[] = employees
      .filter(emp => emp.role === 'user')
      .map(employee => {
        const todayRecord = todayRecordsMap.get(employee.id);
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
      totalNormalHours: grandTotalNormalHours,
      totalOvertimeHours: grandTotalOvertimeHours,
      totalEarnings: grandTotalEarnings,
      employeeStatuses
    };
  }, [employees]); // Dependência 'employees' é importante aqui

  // Query otimizada com cache inteligente (sem alteração)
  const {
    data: dashboardData,
    isLoading,
    error
  } = useQuery({
    queryKey: ['dashboard-data', employees.length],
    queryFn: fetchDashboardData,
    staleTime: 15 * 60 * 1000, // Aumentado para 15 minutos
    refetchInterval: false, // Removido refetch automático
    refetchOnWindowFocus: false,
    enabled: employees.length > 0,
    retry: 1
  });

  // Função memoizada para status (sem alteração)
  const getEmployeeStatus = useCallback((record: any): { status: string; label: string; color: string } => {
    if (!record?.clock_in) {
      return {
        status: 'not_working',
        label: 'Não iniciou',
        color: 'red'
      };
    }

    if (record.clock_out) {
      return {
        status: 'day_finished',
        label: 'Finalizou',
        color: 'blue'
      };
    }

    if (record.lunch_start && !record.lunch_end) {
      return {
        status: 'lunch_break',
        label: 'Almoço',
        color: 'yellow'
      };
    }

    return {
      status: 'working',
      label: 'Trabalhando',
      color: 'green'
    };
  }, []);

  // Funções memoizadas para classes CSS (sem alteração)
  const getStatusColorClasses = useCallback((color: string) => {
    const classMap = {
      green: 'bg-green-50 border-green-200 text-green-800',
      yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      blue: 'bg-blue-50 border-blue-200 text-blue-800',
      red: 'bg-red-50 border-red-200 text-red-800'
    };
    return classMap[color as keyof typeof classMap] || 'bg-gray-50 border-gray-200 text-gray-800';
  }, []);

  const getStatusBadgeClasses = useCallback((color: string) => {
    const classMap = {
      green: 'bg-green-200 text-green-800',
      yellow: 'bg-yellow-200 text-yellow-800',
      blue: 'bg-blue-200 text-blue-800',
      red: 'bg-red-200 text-red-800'
    };
    return classMap[color as keyof typeof classMap] || 'bg-gray-200 text-gray-800';
  }, []);

  // Loading skeleton otimizado (sem alteração)
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="animate-pulse h-6 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="animate-pulse h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    console.error('Dashboard error:', error);
    return (
      <div className="text-center p-8">
        <p className="text-red-600">Erro ao carregar dados</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de Métricas Otimizados */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Funcionários
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
              Administradores
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
              Horas Normais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHoursAsTime(dashboardData?.totalNormalHours)}</div>
            <div className="text-sm text-gray-500">Mês atual</div>
          </CardContent>
        </Card>

        {/* Card de Horas Extras */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock4 className="w-5 h-5 text-orange-500" />
              Horas Extras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHoursAsTime(dashboardData?.totalOvertimeHours)}</div>
            <div className="text-sm text-gray-500">Mês atual</div>
          </CardContent>
        </Card>

        {/* Card de Folha de Pagamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              Folha de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData?.totalEarnings || 0)}</div>
            <div className="text-sm text-gray-500">Mês atual</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para Dashboard e Analytics (sem alteração) */}
      <Tabs defaultValue="status" className="space-y-6">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="status">Status dos Funcionários</TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics Avançado
            </TabsTrigger>
          </TabsList>
          <AnalyticsButton />
        </div>

        <TabsContent value="status">
          {/* Status dos Funcionários Otimizado (sem alteração) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                Status dos Funcionários
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
                          <div>Almoço: {empStatus.record.lunch_start}</div>
                        )}
                        {empStatus.record.lunch_end && (
                          <div>Volta: {empStatus.record.lunch_end}</div>
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
                    <p className="text-gray-500 text-sm">Nenhum funcionário</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <AdvancedAnalytics employees={employees} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OptimizedAdminDashboard;