
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, AlertTriangle, Users, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface EmployeeAnalytics {
  id: string;
  employee_id: string;
  month: number;
  year: number;
  total_hours_worked: number;
  total_overtime_hours: number;
  average_daily_hours: number;
  days_worked: number;
  productivity_score: number;
  anomaly_flags: any;
  employee_name?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

interface AdvancedAnalyticsProps {
  employees: User[];
}

interface AnomalyFlags {
  excessive_overtime?: boolean;
  long_daily_hours?: boolean;
  low_attendance?: boolean;
}

const AdvancedAnalytics: React.FC<AdvancedAnalyticsProps> = ({ employees }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'current' | 'last3' | 'last6'>('current');

  // Buscar dados de analytics
  const { data: analyticsData = [], isLoading } = useQuery({
    queryKey: ['employee-analytics', selectedPeriod],
    queryFn: async () => {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      let monthsToFetch = [];
      
      switch (selectedPeriod) {
        case 'current':
          monthsToFetch.push({ month: currentMonth, year: currentYear });
          break;
        case 'last3':
          for (let i = 0; i < 3; i++) {
            const date = new Date(currentYear, currentMonth - 1 - i, 1);
            monthsToFetch.push({ 
              month: date.getMonth() + 1, 
              year: date.getFullYear() 
            });
          }
          break;
        case 'last6':
          for (let i = 0; i < 6; i++) {
            const date = new Date(currentYear, currentMonth - 1 - i, 1);
            monthsToFetch.push({ 
              month: date.getMonth() + 1, 
              year: date.getFullYear() 
            });
          }
          break;
      }

      const { data, error } = await supabase
        .from('employee_analytics')
        .select('*')
        .in('month', monthsToFetch.map(m => m.month))
        .in('year', monthsToFetch.map(m => m.year))
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;

      // Adicionar nome dos funcionários
      const enrichedData = data?.map(item => {
        const employee = employees.find(emp => emp.id === item.employee_id);
        return {
          ...item,
          employee_name: employee?.name || 'Funcionário não encontrado'
        };
      }) || [];

      return enrichedData;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Buscar alertas de anomalias
  const { data: alertsData = [] } = useQuery({
    queryKey: ['system-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_alerts')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Preparar dados para gráficos
  const productivityData = analyticsData.map(item => ({
    name: item.employee_name?.split(' ')[0] || 'N/A',
    score: Number(item.productivity_score),
    hours: Number(item.total_hours_worked),
    overtime: Number(item.total_overtime_hours)
  }));

  const overtimeData = analyticsData.filter(item => item.total_overtime_hours > 0)
    .map(item => ({
      name: item.employee_name?.split(' ')[0] || 'N/A',
      overtime: Number(item.total_overtime_hours),
      month: `${item.month}/${item.year}`
    }));

  const attendanceData = analyticsData.map(item => ({
    name: item.employee_name?.split(' ')[0] || 'N/A',
    days: item.days_worked,
    avgHours: Number(item.average_daily_hours)
  }));

  // Detectar anomalias
  const anomalies = analyticsData.filter(item => 
    item.anomaly_flags && Object.keys(item.anomaly_flags).length > 0
  );

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2">Carregando analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alertas de Anomalias */}
      {alertsData.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            {alertsData.length} alerta(s) de anomalia detectado(s). Verifique os dados abaixo.
          </AlertDescription>
        </Alert>
      )}

      {/* Seletor de Período */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Período:</label>
        <select 
          value={selectedPeriod} 
          onChange={(e) => setSelectedPeriod(e.target.value as any)}
          className="px-3 py-1 border rounded-md text-sm"
        >
          <option value="current">Mês Atual</option>
          <option value="last3">Últimos 3 Meses</option>
          <option value="last6">Últimos 6 Meses</option>
        </select>
      </div>

      <Tabs defaultValue="productivity" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="productivity">Produtividade</TabsTrigger>
          <TabsTrigger value="overtime">Horas Extras</TabsTrigger>
          <TabsTrigger value="attendance">Frequência</TabsTrigger>
          <TabsTrigger value="anomalies">Anomalias</TabsTrigger>
        </TabsList>

        <TabsContent value="productivity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Score de Produtividade por Funcionário
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productivityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => [
                    name === 'score' ? `${value}%` : `${value}h`,
                    name === 'score' ? 'Produtividade' : name === 'hours' ? 'Horas Totais' : 'Horas Extras'
                  ]} />
                  <Bar dataKey="score" fill="#8884d8" name="score" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overtime" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Análise de Horas Extras
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={overtimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value}h`, 'Horas Extras']} />
                  <Line type="monotone" dataKey="overtime" stroke="#ff7300" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Frequência e Média de Horas Diárias
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => [
                    name === 'days' ? `${value} dias` : `${value}h`,
                    name === 'days' ? 'Dias Trabalhados' : 'Média Diária'
                  ]} />
                  <Bar dataKey="days" fill="#82ca9d" name="days" />
                  <Bar dataKey="avgHours" fill="#ffc658" name="avgHours" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anomalies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Detectação de Anomalias
              </CardTitle>
            </CardHeader>
            <CardContent>
              {anomalies.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Nenhuma anomalia detectada no período selecionado.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {anomalies.map((anomaly, index) => {
                    const flags = anomaly.anomaly_flags as AnomalyFlags;
                    return (
                      <div key={index} className="border rounded-lg p-4 bg-yellow-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{anomaly.employee_name}</h4>
                            <p className="text-sm text-gray-600">
                              Período: {anomaly.month}/{anomaly.year}
                            </p>
                            <div className="mt-2 space-y-1">
                              {flags?.excessive_overtime && (
                                <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                                  Horas extras excessivas
                                </span>
                              )}
                              {flags?.long_daily_hours && (
                                <span className="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded ml-1">
                                  Jornada muito longa
                                </span>
                              )}
                              {flags?.low_attendance && (
                                <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded ml-1">
                                  Baixa frequência
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm">
                              <strong>{anomaly.total_hours_worked}h</strong> trabalhadas
                            </p>
                            <p className="text-sm">
                              <strong>{anomaly.total_overtime_hours}h</strong> extras
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedAnalytics;
