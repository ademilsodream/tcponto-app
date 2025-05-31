
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { hourBankService, HourBankBalance, HourBankTransaction } from '@/utils/hourBankService';
import { Clock, TrendingUp, TrendingDown, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HourBankReportProps {
  employees: Array<{
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'user';
  }>;
}

const HourBankReport: React.FC<HourBankReportProps> = ({ employees }) => {
  const [balances, setBalances] = useState<HourBankBalance[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [transactions, setTransactions] = useState<HourBankTransaction[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  const [isHourBankActive, setIsHourBankActive] = useState(false);
  const { toast } = useToast();

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
      setBalances(data);
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
    const employee = employees.find(emp => emp.id === employeeId);
    return employee ? employee.name : 'Funcionário não encontrado';
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'ACUMULO': return 'Acúmulo';
      case 'DESCONTO': return 'Desconto';
      case 'AJUSTE_MANUAL': return 'Ajuste Manual';
      case 'EXPIRACAO': return 'Expiração';
      default: return type;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'ACUMULO': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'DESCONTO': return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'AJUSTE_MANUAL': return <User className="w-4 h-4 text-blue-600" />;
      case 'EXPIRACAO': return <Calendar className="w-4 h-4 text-orange-600" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatHours = (hours: number) => {
    const absHours = Math.abs(hours);
    const wholeHours = Math.floor(absHours);
    const minutes = Math.round((absHours - wholeHours) * 60);
    const sign = hours < 0 ? '-' : '';
    return `${sign}${wholeHours}h ${minutes}min`;
  };

  if (!isHourBankActive) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            O sistema de banco de horas não está ativo. 
            Ative nas configurações para visualizar os relatórios.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo Geral dos Saldos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Banco de Horas - Resumo Geral
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="ml-2">Carregando...</span>
            </div>
          ) : balances.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum saldo de banco de horas encontrado
            </p>
          ) : (
            <div className="grid gap-4">
              {balances.map((balance) => {
                const employeeName = getEmployeeName(balance.employee_id);
                const isPositive = balance.current_balance >= 0;
                
                return (
                  <div key={balance.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{employeeName}</h4>
                      <p className="text-sm text-muted-foreground">
                        Última atualização: {format(new Date(balance.last_updated), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={isPositive ? 'default' : 'destructive'}>
                        {formatHours(balance.current_balance)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalhes por Funcionário */}
      <Card>
        <CardHeader>
          <CardTitle>Transações por Funcionário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filtros */}
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
                {employees.map((employee) => (
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

          {/* Transações */}
          {selectedEmployee && (
            <div className="space-y-4">
              <h4 className="font-medium">
                Transações de {getEmployeeName(selectedEmployee)}
              </h4>
              
              {transactions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma transação encontrada no período selecionado
                </p>
              ) : (
                <div className="space-y-2">
                  {transactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getTransactionIcon(transaction.transaction_type)}
                        <div>
                          <div className="font-medium">
                            {getTransactionTypeLabel(transaction.transaction_type)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(transaction.transaction_date), 'dd/MM/yyyy', { locale: ptBR })}
                          </div>
                          {transaction.description && (
                            <div className="text-xs text-muted-foreground">
                              {transaction.description}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-medium">
                          {transaction.transaction_type === 'DESCONTO' || transaction.transaction_type === 'EXPIRACAO' ? '-' : '+'}
                          {formatHours(transaction.hours_amount)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Saldo: {formatHours(transaction.new_balance)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HourBankReport;
