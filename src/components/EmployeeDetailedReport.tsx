
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface TimeRecord {
  id: string;
  date: string;
  clock_in?: string;
  lunch_start?: string;
  lunch_end?: string;
  clock_out?: string;
  total_hours: number;
  normal_hours: number;
  overtime_hours: number;
  normal_pay: number;
  overtime_pay: number;
  total_pay: number;
  locations?: any;
}

interface EmployeeDetailedReportProps {
  selectedMonth: Date;
  onBack: () => void;
}

const EmployeeDetailedReport: React.FC<EmployeeDetailedReportProps> = ({
  selectedMonth,
  onBack
}) => {
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadRecords();
    }
  }, [selectedMonth, user]);

  const loadRecords = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const startDate = format(selectedMonth, 'yyyy-MM-01');
      const endDate = format(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('status', 'active')
        .order('date');

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error loading records:', error);
    } finally {
      setLoading(false);
    }
  };

  const totals = records.reduce((acc, record) => ({
    totalHours: acc.totalHours + Number(record.total_hours),
    normalHours: acc.normalHours + Number(record.normal_hours),
    overtimeHours: acc.overtimeHours + Number(record.overtime_hours),
    totalPay: acc.totalPay + Number(record.total_pay)
  }), { totalHours: 0, normalHours: 0, overtimeHours: 0, totalPay: 0 });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando relatório...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={onBack} className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Relatório Detalhado - {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
            </CardTitle>
          </div>
        </CardHeader>
      </Card>

      {/* Resumo */}
      <Card className="bg-gradient-to-r from-primary-50 to-accent-50">
        <CardHeader>
          <CardTitle className="text-primary-900">Resumo do Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600">Dias Trabalhados</p>
              <p className="text-xl font-bold text-primary-900">
                {records.filter(r => Number(r.total_hours) > 0).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Horas Normais</p>
              <p className="text-xl font-bold text-primary-900">
                {totals.normalHours.toFixed(1)}h
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Horas Extras</p>
              <p className="text-xl font-bold text-orange-600">
                {totals.overtimeHours.toFixed(1)}h
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Ganho</p>
              <p className="text-xl font-bold text-accent-600">
                {formatCurrency(totals.totalPay)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registros Detalhados */}
      <Card>
        <CardHeader>
          <CardTitle>Registros Diários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {records.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                Nenhum registro encontrado para este período.
              </p>
            ) : (
              records.map((record) => (
                <div key={record.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {format(new Date(record.date), 'EEEE, dd/MM/yyyy', { locale: ptBR })}
                      </h3>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Total do Dia</p>
                      <p className="font-bold text-lg">{formatCurrency(Number(record.total_pay))}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Entrada</p>
                      <p className="font-semibold">
                        {record.clock_in || '--:--'}
                      </p>
                      {record.locations?.clockIn && (
                        <MapPin className="w-3 h-3 text-green-600 mx-auto mt-1" />
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Início Almoço</p>
                      <p className="font-semibold">
                        {record.lunch_start || '--:--'}
                      </p>
                      {record.locations?.lunchStart && (
                        <MapPin className="w-3 h-3 text-orange-600 mx-auto mt-1" />
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Fim Almoço</p>
                      <p className="font-semibold">
                        {record.lunch_end || '--:--'}
                      </p>
                      {record.locations?.lunchEnd && (
                        <MapPin className="w-3 h-3 text-orange-600 mx-auto mt-1" />
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Saída</p>
                      <p className="font-semibold">
                        {record.clock_out || '--:--'}
                      </p>
                      {record.locations?.clockOut && (
                        <MapPin className="w-3 h-3 text-red-600 mx-auto mt-1" />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center text-sm border-t pt-3">
                    <div>
                      <p className="text-gray-600">Horas Normais</p>
                      <p className="font-semibold">{Number(record.normal_hours).toFixed(1)}h</p>
                      <p className="text-accent-600">{formatCurrency(Number(record.normal_pay))}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Horas Extras</p>
                      <p className="font-semibold text-orange-600">{Number(record.overtime_hours).toFixed(1)}h</p>
                      <p className="text-accent-600">{formatCurrency(Number(record.overtime_pay))}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Horas</p>
                      <p className="font-semibold">{Number(record.total_hours).toFixed(1)}h</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeDetailedReport;
