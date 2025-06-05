
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { hourBankService, HourBankBalance } from '@/utils/hourBankService';
import { Employee } from '@/utils/employeeFilters';
import { BarChart3, TrendingUp, Users, AlertTriangle } from 'lucide-react';

interface HourBankAnalyticsProps {
  balances: HourBankBalance[];
  employees: Employee[];
  selectedEmployee: string;
  dateRange: { start: string; end: string };
}

const HourBankAnalytics: React.FC<HourBankAnalyticsProps> = ({
  balances,
  employees,
  selectedEmployee,
  dateRange
}) => {
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedEmployee) {
      loadAnalyticsData();
    }
  }, [selectedEmployee, dateRange]);

  const loadAnalyticsData = async () => {
    if (!selectedEmployee) return;
    
    try {
      setLoading(true);
      const data = await hourBankService.getHourBankSummary(
        selectedEmployee,
        dateRange.start,
        dateRange.end
      );
      setSummaryData(data);
    } catch (error) {
      console.error('Erro ao carregar dados analíticos:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId);
    return employee ? employee.name : 'Funcionário não encontrado';
  };

  const formatHours = (hours: number) => {
    const absHours = Math.abs(hours);
    const wholeHours = Math.floor(absHours);
    const minutes = Math.round((absHours - wholeHours) * 60);
    const sign = hours < 0 ? '-' : '';
    return `${sign}${wholeHours}h ${minutes}min`;
  };

  // Dados para gráficos gerais
  const getBalanceDistribution = () => {
    const ranges = [
      { name: 'Negativo', count: 0, color: '#ef4444' },
      { name: '0-10h', count: 0, color: '#10b981' },
      { name: '10-20h', count: 0, color: '#3b82f6' },
      { name: '20-40h', count: 0, color: '#f59e0b' },
      { name: '40h+', count: 0, color: '#8b5cf6' }
    ];

    balances.forEach(balance => {
      const hours = balance.current_balance;
      if (hours < 0) ranges[0].count++;
      else if (hours <= 10) ranges[1].count++;
      else if (hours <= 20) ranges[2].count++;
      else if (hours <= 40) ranges[3].count++;
      else ranges[4].count++;
    });

    return ranges.filter(range => range.count > 0);
  };

  const getMonthlyTrend = () => {
    if (!summaryData) return [];

    const monthlyData: { [key: string]: { accumulated: number; discounted: number; month: string } } = {};

    summaryData.transactions.forEach((transaction: any) => {
      const monthKey = transaction.transaction_date.substring(0, 7); // YYYY-MM
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { accumulated: 0, discounted: 0, month: monthKey };
      }

      if (transaction.transaction_type === 'ACUMULO') {
        monthlyData[monthKey].accumulated += transaction.hours_amount;
      } else if (transaction.transaction_type === 'DESCONTO') {
        monthlyData[monthKey].discounted += transaction.hours_amount;
      }
    });

    return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
  };

  const balanceDistribution = getBalanceDistribution();
  const monthlyTrend = getMonthlyTrend();

  if (!selectedEmployee && balances.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Selecione um funcionário ou carregue dados para visualizar as análises
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Maior Saldo</p>
                <p className="text-lg font-bold text-green-600">
                  {formatHours(Math.max(...balances.map(b => b.current_balance)))}
                </p>
              </div>
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Menor Saldo</p>
                <p className="text-lg font-bold text-red-600">
                  {formatHours(Math.min(...balances.map(b => b.current_balance)))}
                </p>
              </div>
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Média de Saldos</p>
                <p className="text-lg font-bold">
                  {formatHours(balances.reduce((sum, b) => sum + b.current_balance, 0) / balances.length || 0)}
                </p>
              </div>
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Funcionários Ativos</p>
                <p className="text-lg font-bold">{balances.length}</p>
              </div>
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição de Saldos */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Saldos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={balanceDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  label={({ name, count }) => `${name}: ${count}`}
                >
                  {balanceDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Saldos por Funcionário */}
        <Card>
          <CardHeader>
            <CardTitle>Saldos por Funcionário</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={balances.map(b => ({
                name: getEmployeeName(b.employee_id).split(' ')[0],
                saldo: b.current_balance
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [formatHours(Number(value)), 'Saldo']} />
                <Bar dataKey="saldo" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Análise Individual */}
      {selectedEmployee && summaryData && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise Individual - {getEmployeeName(selectedEmployee)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Horas Acumuladas</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatHours(summaryData.accumulated)}
                  </p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-gray-600">Horas Descontadas</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatHours(summaryData.discounted)}
                  </p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Saldo Atual</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatHours(summaryData.currentBalance)}
                  </p>
                </div>
              </div>

              {monthlyTrend.length > 0 && (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        formatHours(Number(value)), 
                        name === 'accumulated' ? 'Acumuladas' : 'Descontadas'
                      ]} 
                    />
                    <Line type="monotone" dataKey="accumulated" stroke="#10b981" strokeWidth={2} />
                    <Line type="monotone" dataKey="discounted" stroke="#ef4444" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default HourBankAnalytics;
