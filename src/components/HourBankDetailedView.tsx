
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { hourBankService, HourBankBalance, HourBankTransaction } from '@/utils/hourBankService';
import { Clock, TrendingUp, TrendingDown, Calendar, User, Filter, Download, BarChart3 } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getActiveEmployees, type Employee } from '@/utils/employeeFilters';
import HourBankSummaryCard from '@/components/HourBankSummaryCard';
import HourBankTransactionsList from '@/components/HourBankTransactionsList';
import HourBankAnalytics from '@/components/HourBankAnalytics';

interface HourBankDetailedViewProps {
  employees: Employee[];
}

const HourBankDetailedView: React.FC<HourBankDetailedViewProps> = ({ employees }) => {
  const [balances, setBalances] = useState<HourBankBalance[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [transactions, setTransactions] = useState<HourBankTransaction[]>([]);
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(subMonths(new Date(), 2)).toISOString().split('T')[0],
    end: endOfMonth(new Date()).toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  const [isHourBankActive, setIsHourBankActive] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  const activeEmployees = getActiveEmployees(employees);

  useEffect(() => {
    checkHourBankStatus();
    loadAllBalances();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      loadEmployeeTransactions(selectedEmployee);
    }
  }, [selectedEmployee, dateRange]);

  const checkHourBankStatus = async () => {
    const isActive = await hourBankService.isHourBankActive();
    setIsHourBankActive(isActive);
  };

  const loadAllBalances = async () => {
    try {
      setLoading(true);
      const data = await hourBankService.getAllEmployeesHourBankBalances();
      const activeEmployeeIds = activeEmployees.map(emp => emp.id);
      const filteredBalances = data.filter(balance => 
        activeEmployeeIds.includes(balance.employee_id)
      );
      setBalances(filteredBalances);
    } catch (error) {
      console.error('Erro ao carregar saldos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar saldos do banco de horas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeeTransactions = async (employeeId: string) => {
    try {
      const data = await hourBankService.getEmployeeHourBankTransactions(
        employeeId,
        dateRange.start,
        dateRange.end
      );
      setTransactions(data);
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar transações do funcionário",
        variant: "destructive"
      });
    }
  };

  const getEmployeeName = (employeeId: string) => {
    const employee = activeEmployees.find(emp => emp.id === employeeId);
    return employee ? employee.name : 'Funcionário não encontrado';
  };

  const handleExportData = () => {
    if (!selectedEmployee) {
      toast({
        title: "Aviso",
        description: "Selecione um funcionário para exportar os dados",
        variant: "destructive"
      });
      return;
    }

    const employeeName = getEmployeeName(selectedEmployee);
    const csvContent = [
      ['Data', 'Tipo', 'Horas', 'Saldo Anterior', 'Novo Saldo', 'Descrição'].join(','),
      ...transactions.map(t => [
        format(new Date(t.transaction_date), 'dd/MM/yyyy'),
        t.transaction_type,
        t.hours_amount.toString(),
        t.previous_balance.toString(),
        t.new_balance.toString(),
        t.description || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `banco_horas_${employeeName}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (!isHourBankActive) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            O sistema de banco de horas não está ativo. 
            Ative nas configurações para visualizar os dados.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (activeEmployees.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Nenhum funcionário ativo encontrado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Banco de Horas - Visão Detalhada</h1>
        <Button onClick={handleExportData} variant="outline" disabled={!selectedEmployee}>
          <Download className="w-4 h-4 mr-2" />
          Exportar Dados
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="transactions">Transações</TabsTrigger>
          <TabsTrigger value="analytics">Análises</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <HourBankSummaryCard 
            balances={balances}
            employees={activeEmployees}
            loading={loading}
            onEmployeeSelect={setSelectedEmployee}
          />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filtros de Transações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employee">Funcionário</Label>
                  <select
                    id="employee"
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="">Selecione um funcionário</option>
                    {activeEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start-date">Data Inicial</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end-date">Data Final</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <HourBankTransactionsList 
            transactions={transactions}
            selectedEmployee={selectedEmployee}
            employeeName={selectedEmployee ? getEmployeeName(selectedEmployee) : ''}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <HourBankAnalytics 
            balances={balances}
            employees={activeEmployees}
            selectedEmployee={selectedEmployee}
            dateRange={dateRange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HourBankDetailedView;
