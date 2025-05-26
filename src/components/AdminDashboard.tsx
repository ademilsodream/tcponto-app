
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Clock, DollarSign, Calendar, UserCheck, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/contexts/CurrencyContext';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourlyRate: number;
  overtimeRate: number;
}

interface AdminDashboardProps {
  employees: User[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ employees }) => {
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalAdmins, setTotalAdmins] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [workingEmployees, setWorkingEmployees] = useState<User[]>([]);
  const [notWorkingEmployees, setNotWorkingEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 5000); // Atualiza a cada 5 segundos para tempo real
    return () => clearInterval(interval);
  }, [employees]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      setTotalEmployees(employees.length);
      setTotalAdmins(employees.filter(employee => employee.role === 'admin').length);

      // Simulação de dados de horas e ganhos
      const simulatedTotalHours = employees.reduce((acc, employee) => acc + 40, 0);
      const simulatedTotalEarnings = employees.reduce((acc, employee) => acc + (employee.hourlyRate * 40), 0);

      setTotalHours(simulatedTotalHours);
      setTotalEarnings(simulatedTotalEarnings);

      // Verificar em tempo real quem está trabalhando através dos registros do Supabase
      const today = new Date().toISOString().split('T')[0];
      const working: User[] = [];
      const notWorking: User[] = [];

      for (const employee of employees) {
        if (employee.role === 'user') {
          try {
            const { data: todayRecord, error } = await supabase
              .from('time_records')
              .select('*')
              .eq('user_id', employee.id)
              .eq('date', today)
              .single();

            if (!error && todayRecord) {
              // Se tem entrada mas não tem saída, está trabalhando
              if (todayRecord.clock_in && !todayRecord.clock_out) {
                working.push(employee);
              } else {
                notWorking.push(employee);
              }
            } else {
              notWorking.push(employee);
            }
          } catch (error) {
            notWorking.push(employee);
          }
        }
      }

      setWorkingEmployees(working);
      setNotWorkingEmployees(notWorking);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Carregando dados do painel...</div>;
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
              Total de Horas Trabalhadas (Simulado)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHours}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              Total de Ganhos (Simulado)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalEarnings)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Status em Tempo Real dos Funcionários */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <UserCheck className="w-5 h-5" />
              Funcionários Trabalhando Agora
              <span className="text-sm bg-green-100 px-2 py-1 rounded-full">Em Tempo Real</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 mb-4">
              {workingEmployees.length}
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {workingEmployees.map((employee) => (
                <div key={employee.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <span className="font-medium text-green-800">{employee.name}</span>
                  <span className="text-sm text-green-600 bg-green-200 px-2 py-1 rounded">Trabalhando</span>
                </div>
              ))}
              {workingEmployees.length === 0 && (
                <div className="text-center py-8">
                  <UserX className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Nenhum funcionário trabalhando no momento</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <UserX className="w-5 h-5" />
              Funcionários Não Trabalhando
              <span className="text-sm bg-red-100 px-2 py-1 rounded-full">Em Tempo Real</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 mb-4">
              {notWorkingEmployees.length}
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {notWorkingEmployees.map((employee) => (
                <div key={employee.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                  <span className="font-medium text-red-800">{employee.name}</span>
                  <span className="text-sm text-red-600 bg-red-200 px-2 py-1 rounded">Fora do expediente</span>
                </div>
              ))}
              {notWorkingEmployees.length === 0 && (
                <div className="text-center py-8">
                  <UserCheck className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Todos os funcionários estão trabalhando</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
