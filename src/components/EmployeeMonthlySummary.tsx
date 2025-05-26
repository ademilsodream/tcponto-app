
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface MonthlySummary {
  totalHours: number;
  normalHours: number;
  overtimeHours: number;
  totalPay: number;
  normalPay: number;
  overtimePay: number;
  workingDays: number;
}

interface EmployeeMonthlySummaryProps {
  selectedMonth: Date;
  onShowDetailedReport: () => void;
}

const EmployeeMonthlySummary: React.FC<EmployeeMonthlySummaryProps> = ({
  selectedMonth,
  onShowDetailedReport
}) => {
  const [summary, setSummary] = useState<MonthlySummary>({
    totalHours: 0,
    normalHours: 0,
    overtimeHours: 0,
    totalPay: 0,
    normalPay: 0,
    overtimePay: 0,
    workingDays: 0
  });
  const [loading, setLoading] = useState(true);
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadMonthlySummary();
    }
  }, [selectedMonth, user]);

  const loadMonthlySummary = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const startDate = format(selectedMonth, 'yyyy-MM-01');
      const endDate = format(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0), 'yyyy-MM-dd');

      const { data: records, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('status', 'active');

      if (error) throw error;

      const summary = records.reduce((acc, record) => {
        return {
          totalHours: acc.totalHours + Number(record.total_hours),
          normalHours: acc.normalHours + Number(record.normal_hours),
          overtimeHours: acc.overtimeHours + Number(record.overtime_hours),
          totalPay: acc.totalPay + Number(record.total_pay),
          normalPay: acc.normalPay + Number(record.normal_pay),
          overtimePay: acc.overtimePay + Number(record.overtime_pay),
          workingDays: acc.workingDays + (Number(record.total_hours) > 0 ? 1 : 0)
        };
      }, {
        totalHours: 0,
        normalHours: 0,
        overtimeHours: 0,
        totalPay: 0,
        normalPay: 0,
        overtimePay: 0,
        workingDays: 0
      });

      setSummary(summary);
    } catch (error) {
      console.error('Error loading monthly summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando resumo mensal...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-primary-50 to-accent-50">
      <CardHeader>
        <CardTitle className="text-primary-900 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Resumo de {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-4">
          <div>
            <p className="text-sm text-gray-600">Dias Trabalhados</p>
            <p className="text-xl font-bold text-primary-900">
              {summary.workingDays}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-gray-600">Horas Normais</p>
            <p className="text-xl font-bold text-primary-900">
              {summary.normalHours.toFixed(1)}h
            </p>
            <p className="text-sm text-accent-600">
              {formatCurrency(summary.normalPay)}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-gray-600">Horas Extras</p>
            <p className="text-xl font-bold text-orange-600">
              {summary.overtimeHours.toFixed(1)}h
            </p>
            <p className="text-sm text-accent-600">
              {formatCurrency(summary.overtimePay)}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-xl font-bold text-primary-900">
              {summary.totalHours.toFixed(1)}h
            </p>
            <p className="text-sm text-accent-600 font-bold">
              {formatCurrency(summary.totalPay)}
            </p>
          </div>
        </div>

        <Button
          onClick={onShowDetailedReport}
          variant="outline"
          className="w-full"
        >
          <FileText className="w-4 h-4 mr-2" />
          Ver Relatório Detalhado
        </Button>
      </CardContent>
    </Card>
  );
};

export default EmployeeMonthlySummary;
