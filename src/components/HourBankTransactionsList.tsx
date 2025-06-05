
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Calendar, User, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { HourBankTransaction } from '@/utils/hourBankService';

interface HourBankTransactionsListProps {
  transactions: HourBankTransaction[];
  selectedEmployee: string;
  employeeName: string;
}

const HourBankTransactionsList: React.FC<HourBankTransactionsListProps> = ({
  transactions,
  selectedEmployee,
  employeeName
}) => {
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

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'ACUMULO': return 'bg-green-100 text-green-800';
      case 'DESCONTO': return 'bg-red-100 text-red-800';
      case 'AJUSTE_MANUAL': return 'bg-blue-100 text-blue-800';
      case 'EXPIRACAO': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatHours = (hours: number) => {
    const absHours = Math.abs(hours);
    const wholeHours = Math.floor(absHours);
    const minutes = Math.round((absHours - wholeHours) * 60);
    const sign = hours < 0 ? '-' : '';
    return `${sign}${wholeHours}h ${minutes}min`;
  };

  const getTransactionSummary = () => {
    const accumulated = transactions
      .filter(t => t.transaction_type === 'ACUMULO')
      .reduce((sum, t) => sum + t.hours_amount, 0);

    const discounted = transactions
      .filter(t => t.transaction_type === 'DESCONTO')
      .reduce((sum, t) => sum + t.hours_amount, 0);

    const manual = transactions
      .filter(t => t.transaction_type === 'AJUSTE_MANUAL')
      .reduce((sum, t) => sum + t.hours_amount, 0);

    return { accumulated, discounted, manual };
  };

  if (!selectedEmployee) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Selecione um funcionário para visualizar as transações
          </p>
        </CardContent>
      </Card>
    );
  }

  const summary = getTransactionSummary();

  return (
    <div className="space-y-4">
      {/* Resumo das Transações */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas Acumuladas</p>
                <p className="text-xl font-bold text-green-600">{formatHours(summary.accumulated)}</p>
              </div>
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas Descontadas</p>
                <p className="text-xl font-bold text-red-600">{formatHours(summary.discounted)}</p>
              </div>
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ajustes Manuais</p>
                <p className="text-xl font-bold text-blue-600">{formatHours(summary.manual)}</p>
              </div>
              <User className="w-6 h-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Transações */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Transações - {employeeName}</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma transação encontrada no período selecionado
            </p>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getTransactionIcon(transaction.transaction_type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {getTransactionTypeLabel(transaction.transaction_type)}
                        </span>
                        <Badge className={`text-xs ${getTransactionColor(transaction.transaction_type)}`}>
                          {transaction.transaction_type}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(transaction.transaction_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                      {transaction.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {transaction.description}
                        </div>
                      )}
                      {transaction.expiration_date && (
                        <div className="text-xs text-orange-600 mt-1">
                          Expira em: {format(new Date(transaction.expiration_date), 'dd/MM/yyyy', { locale: ptBR })}
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
        </CardContent>
      </Card>
    </div>
  );
};

export default HourBankTransactionsList;
