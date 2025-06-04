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
  // ❌ REMOVIDO: onShowDetailedReport não é mais necessário
  // onShowDetailedReport: () => void;
  onBack?: () => void;
}

// ✨ Função para formatar horas no padrão HH:MM (mantida)
const formatHoursAsTime = (hours: number) => {
  if (typeof hours !== 'number' || isNaN(hours) || hours < 0) {
    return '00:00';
  }

  const totalMinutes = Math.round(hours * 60);
  const hoursDisplay = Math.floor(totalMinutes / 60);
  const minutesDisplay = totalMinutes % 60;

  return `${hoursDisplay.toString().padStart(2, '0')}:${minutesDisplay.toString().padStart(2, '0')}`;
};

const EmployeeMonthlySummary: React.FC<EmployeeMonthlySummaryProps> = ({
  selectedMonth,
  // ❌ REMOVIDO: onShowDetailedReport não é mais desestruturado
  // onShowDetailedReport,
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
        // Não lançar erro aqui para não quebrar o componente, apenas logar
        // throw error;
      }

      if (data) {
        const rate = Number(data.hourly_rate);
        if (!isNaN(rate)) { // Valida se a taxa é um número válido
           setHourlyRate(rate);
        } else {
           console.warn('Hourly rate inválido no perfil, usando valor padrão.');
           setHourlyRate(50); // Fallback para valor padrão
        }
      } else {
         console.warn('Perfil do usuário não encontrado ou sem hourly_rate.');
         setHourlyRate(50); // Fallback para valor padrão
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setHourlyRate(50); // Fallback em caso de erro na requisição
    } finally {
      setProfileLoaded(true);
    }
  };

  // Função para calcular valores (hora extra = hora normal)
  // Mantida como estava
  const calculatePay = (normalHours: number, overtimeHours: number, rate: number) => {
    const normalPay = normalHours * rate;
    const overtimePay = overtimeHours * rate; // Hora extra com mesmo valor da hora normal

    // Garantir que os resultados são números válidos antes de somar
    const validNormalPay = typeof normalPay === 'number' && !isNaN(normalPay) ? normalPay : 0;
    const validOvertimePay = typeof overtimePay === 'number' && !isNaN(overtimePay) ? overtimePay : 0;

    const totalPay = validNormalPay + validOvertimePay;

    return { normalPay: validNormalPay, overtimePay: validOvertimePay, totalPay };
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

      if (error) {
         console.error('Erro ao carregar registros de ponto:', error);
         throw error; // Lança o erro para ser pego pelo catch
      }

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
          hourlyRate // Usando o hourlyRate carregado
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
      // Resetar resumo em caso de erro
      setSummary({
        totalHours: 0,
        normalHours: 0,
        overtimeHours: 0,
        totalPay: 0,
        normalPay: 0,
        overtimePay: 0,
        workingDays: 0
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !profileLoaded) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-600">
           {/* Adicionado um spinner simples */}
           <div className="flex items-center justify-center mb-2">
             <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
           </div>
          Carregando resumo mensal...
        </CardContent>
      </Card>
    );
  }

  return (
    // ✨ Ajustes de layout e cores para mobile
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 shadow-lg border-none">
      <CardHeader className="pb-4"> {/* Ajuste no padding */}
        <div className="flex items-center justify-between flex-wrap gap-2"> {/* Permite quebrar linha em telas pequenas */}
          <CardTitle className="text-primary-800 flex items-center gap-2 text-lg sm:text-xl"> {/* Ajuste no tamanho do título */}
            <Calendar className="w-5 h-5 text-primary-600" />
            Resumo de {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
          </CardTitle>
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack} className="border-primary-300 text-primary-700 hover:bg-primary-100">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0"> {/* Ajuste no padding */}
        {/* ✨ Melhoria no layout da grid para mobile */}
        <div className="grid grid-cols-2 gap-y-6 gap-x-4 text-center"> {/* Garante 2 colunas e adiciona gap vertical */}

          {/* Dias Trabalhados */}
          <div className="flex flex-col items-center justify-center p-2 bg-white rounded-md shadow-sm"> {/* Adicionado fundo e sombra */}
            <p className="text-xs text-gray-500 font-medium uppercase">Dias Trabalhados</p>
            <p className="text-2xl font-bold text-primary-700 mt-1">
              {summary.workingDays}
            </p>
          </div>

          {/* Horas Normais */}
          <div className="flex flex-col items-center justify-center p-2 bg-white rounded-md shadow-sm"> {/* Adicionado fundo e sombra */}
            <p className="text-xs text-gray-500 font-medium uppercase">Horas Normais</p>
            <p className="text-2xl font-bold text-green-600 mt-1"> {/* Cor para horas normais */}
              {formatHoursAsTime(summary.normalHours)} {/* ✨ Aplicado formato HH:MM */}
            </p>
            <p className="text-sm text-gray-700 mt-1"> {/* Cor para o valor */}
              {formatCurrency(summary.normalPay)}
            </p>
          </div>

          {/* Horas Extras */}
          <div className="flex flex-col items-center justify-center p-2 bg-white rounded-md shadow-sm"> {/* Adicionado fundo e sombra */}
            <p className="text-xs text-gray-500 font-medium uppercase">Horas Extras</p>
            <p className="text-2xl font-bold text-orange-600 mt-1"> {/* Cor para horas extras */}
              {formatHoursAsTime(summary.overtimeHours)} {/* ✨ Aplicado formato HH:MM */}
            </p>
            <p className="text-sm text-gray-700 mt-1"> {/* Cor para o valor */}
              {formatCurrency(summary.overtimePay)}
            </p>
          </div>

          {/* Total (Horas + Pagamento) */}
          <div className="flex flex-col items-center justify-center p-2 bg-white rounded-md shadow-sm"> {/* Adicionado fundo e sombra */}
            <p className="text-xs text-gray-500 font-medium uppercase">Total</p>
             {/* ✨ Exibindo horas e valor total separadamente para clareza */}
            <p className="text-2xl font-bold text-primary-700 mt-1">
              {formatHoursAsTime(summary.totalHours)}h {/* ✨ Aplicado formato HH:MM */}
            </p>
            <p className="text-sm text-indigo-700 font-bold mt-1"> {/* Cor e negrito para o valor total */}
              {formatCurrency(summary.totalPay)}
            </p>
          </div>

        </div>

        {/* ❌ REMOVIDO: Botão "Ver Relatório Detalhado" */}
        {/*
        <Button
          onClick={onShowDetailedReport}
          variant="outline"
          className="w-full mt-4" // Adicionado margin-top para separar da grid
        >
          <FileText className="w-4 h-4 mr-2" />
          Ver Relatório Detalhado
        </Button>
        */}
      </CardContent>
    </Card>
  );
};

export default EmployeeMonthlySummary;
