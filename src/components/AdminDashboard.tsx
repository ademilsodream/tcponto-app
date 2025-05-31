import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Clock, DollarSign, Calendar, UserCheck, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/contexts/CurrencyContext';
import { isValidQueryResult, isValidSingleResult, hasValidProperties, safeArrayFilter } from '@/utils/queryValidation';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourlyRate: number;
  overtimeRate: number;
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

const AdminDashboard: React.FC<AdminDashboardProps> = ({ employees }) => {
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalAdmins, setTotalAdmins] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [employeeStatuses, setEmployeeStatuses] = useState<EmployeeStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    loadDashboardData();
  }, [employees]);

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

    if (record.lunch_end || !record.lunch_start) {
      return {
        status: 'working',
        label: record.lunch_end ? 'Trabalhando (voltou do almoço)' : 'Trabalhando',
        color: 'green'
      };
    }

    return {
      status: 'working',
      label: 'Trabalhando',
      color: 'green'
    };
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      setTotalEmployees(employees.length);
      setTotalAdmins(employees.filter(employee => employee.role === 'admin').length);

      // Buscar dados do mês vigente usando os campos corretos da tabela
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const startOfMonth = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
      const endOfMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

      console.log('Buscando dados do período:', startOfMonth, 'até', endOfMonth);

      // Buscar registros do mês vigente de funcionários ATIVOS apenas
      const activeEmployeeIds = employees.map(emp => emp.id);
      
      if (activeEmployeeIds.length > 0) {
        const { data: timeRecords, error: recordsError } = await supabase
          .from('time_records')
          .select('total_hours, total_pay, user_id')
          .gte('date', startOfMonth)
          .lte('date', endOfMonth)
          .eq('status', 'active' as any)
          .in('user_id', activeEmployeeIds as any);

        if (recordsError) {
          console.error('Erro ao buscar registros de tempo:', recordsError);
          setTotalHours(0);
          setTotalEarnings(0);
        } else if (isValidQueryResult(timeRecords, recordsError) && timeRecords.length > 0) {
          // Filtrar apenas registros válidos
          const validTimeRecords = safeArrayFilter(timeRecords);
          
          // Calcular totais diretamente dos campos da tabela
          let monthTotalHours = 0;
          let monthTotalEarnings = 0;

          validTimeRecords.forEach(record => {
            if (record && typeof record.total_hours === 'number' && typeof record.total_pay === 'number') {
              monthTotalHours += record.total_hours;
              monthTotalEarnings += record.total_pay;
            }
          });

          setTotalHours(monthTotalHours);
          setTotalEarnings(monthTotalEarnings);
        } else {
          setTotalHours(0);
          setTotalEarnings(0);
        }
      } else {
        setTotalHours(0);
        setTotalEarnings(0);
      }

      // Verificar status detalhado dos funcionários ATIVOS apenas
      const today = new Date().toISOString().split('T')[0];
      const statuses: EmployeeStatus[] = [];

      for (const employee of employees) {
        if (employee.role === 'user') {
          try {
            const { data: todayRecord, error } = await supabase
              .from('time_records')
              .select('*')
              .eq('user_id', employee.id as any)
              .eq('date', today as any)
              .maybeSingle();

            if (error) {
              console.error('Erro ao buscar registro do funcionário:', error);
            }

            const validRecord = isValidSingleResult(todayRecord, error) ? todayRecord : null;
            const statusInfo = getEmployeeStatus(validRecord);
            
            statuses.push({
              employee,
              status: statusInfo.status as any,
              statusLabel: statusInfo.label,
              statusColor: statusInfo.color,
              record: validRecord
            });
          } catch (error) {
            console.error('Erro ao processar funcionário:', error);
            statuses.push({
              employee,
              status: 'not_working',
              statusLabel: 'Não iniciou o trabalho',
              statusColor: 'red'
            });
          }
        }
      }

      setEmployeeStatuses(statuses);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Carregando dados do painel...</div>;
  }

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

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Total de Funcionários Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmployees}</div>
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
            <div className="text-2xl font-bold">{totalAdmins}</div>
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
            <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
            <div className="text-sm text-gray-500">Mês vigente (funcionários ativos)</div>
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
            <div className="text-2xl font-bold">{formatCurrency(totalEarnings)}</div>
            <div className="text-sm text-gray-500">Mês vigente (funcionários ativos)</div>
          </CardContent>
        </Card>
      </div>

      {/* Status Detalhado dos Funcionários ATIVOS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Status dos Funcionários Ativos
            <span className="text-sm bg-blue-100 px-2 py-1 rounded-full">Em Tempo Real</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {employeeStatuses.map((empStatus) => (
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
            
            {employeeStatuses.length === 0 && (
              <div className="col-span-full text-center py-8">
                <UserX className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Nenhum funcionário ativo cadastrado</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
