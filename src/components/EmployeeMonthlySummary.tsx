import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, FileText, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { calculateWorkingHours } from '@/utils/timeCalculations';

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
  onBack?: () => void;
}

const EmployeeMonthlySummary: React.FC<EmployeeMonthlySummaryProps> = ({
  selectedMonth,
  onShowDetailedReport,
  onBack
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
  const [hourlyRate, setHourlyRate] = useState(50);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();

  // Carregar perfil do usuário primeiro
  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  // Depois carregar o resumo quando o perfil estiver carregado
  useEffect(() => {
    if (user && profileLoaded) {
      loadMonthlySummary();
    }
  }, [selectedMonth, user, profileLoaded, hourlyRate]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('hourly_rate')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Erro ao carregar perfil:', error);
        throw error;
      }

      if (data) {
        const rate = Number(data.hourly_rate);
        setHourlyRate(rate);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setProfileLoaded(true);
    }
  };

  // Função para calcular valores (hora extra = hora normal)
  const calculatePay = (normalHours: number, overtimeHours: number, rate: number) => {
    const normalPay = normalHours * rate;
    const overtimePay = overtimeHours * rate; // Hora extra com mesmo valor da hora normal
    const totalPay = normalPay + overtimePay;
    
    return { normalPay, overtimePay, totalPay };
  };

  const loadMonthlySummary = async () => {
    if (!user || !profileLoaded) return;

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

      // Recalcular tudo usando os dados brutos e o hourlyRate correto
      const summary = records.reduce((acc, record) => {
        // Usar a função padronizada para calcular horas
        const { totalHours, normalHours, overtimeHours } = calculateWorkingHours(
          record.clock_in || '',
          record.lunch_start || '',
          record.lunch_end || '',
          record.clock_out || ''
        );

        // Calcular valores com o hourlyRate correto
        const { normalPay, overtimePay, totalPay } = calculatePay(
          normalHours,
          overtimeHours,
          hourlyRate
        );

        return {
          totalHours: acc.totalHours + totalHours,
          normalHours: acc.normalHours + normalHours,
          overtimeHours: acc.overtimeHours + overtimeHours,
          totalPay: acc.totalPay + totalPay,
          normalPay: acc.normalPay + normalPay,
          overtimePay: acc.overtimePay + overtimePay,
          workingDays: acc.workingDays + (totalHours > 0 ? 1 : 0)
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

  if (loading || !profileLoaded) {
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-primary-900 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Resumo de {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
          </CardTitle>
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          )}
        </div>
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
