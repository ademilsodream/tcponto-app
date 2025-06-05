
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { HourBankBalance } from '@/utils/hourBankService';
import { Employee } from '@/utils/employeeFilters';

interface HourBankSummaryCardProps {
  balances: HourBankBalance[];
  employees: Employee[];
  loading: boolean;
  onEmployeeSelect: (employeeId: string) => void;
}

const HourBankSummaryCard: React.FC<HourBankSummaryCardProps> = ({
  balances,
  employees,
  loading,
  onEmployeeSelect
}) => {
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

  const getTotalBalance = () => {
    return balances.reduce((total, balance) => total + balance.current_balance, 0);
  };

  const getPositiveBalancesCount = () => {
    return balances.filter(balance => balance.current_balance > 0).length;
  };

  const getNegativeBalancesCount = () => {
    return balances.filter(balance => balance.current_balance < 0).length;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="ml-2">Carregando...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Horas</p>
                <p className="text-2xl font-bold">{formatHours(getTotalBalance())}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Funcionários</p>
                <p className="text-2xl font-bold">{balances.length}</p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-bold">{balances.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saldos Positivos</p>
                <p className="text-2xl font-bold text-green-600">{getPositiveBalancesCount()}</p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600">+</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saldos Negativos</p>
                <p className="text-2xl font-bold text-red-600">{getNegativeBalancesCount()}</p>
              </div>
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600">-</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Funcionários */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Saldos por Funcionário
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum saldo de banco de horas encontrado
            </p>
          ) : (
            <div className="grid gap-3">
              {balances.map((balance) => {
                const employeeName = getEmployeeName(balance.employee_id);
                const isPositive = balance.current_balance >= 0;
                
                return (
                  <div 
                    key={balance.id} 
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => onEmployeeSelect(balance.employee_id)}
                  >
                    <div className="flex-1">
                      <h4 className="font-medium">{employeeName}</h4>
                      <p className="text-sm text-muted-foreground">
                        Última atualização: {format(new Date(balance.last_updated), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={isPositive ? 'default' : 'destructive'} className="text-sm">
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
    </div>
  );
};

export default HourBankSummaryCard;
