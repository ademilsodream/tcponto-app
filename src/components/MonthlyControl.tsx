
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Lock, Unlock } from 'lucide-react';

interface MonthlyControlProps {
  employees: Array<{
    id: string;
    name: string;
    email: string;
  }>;
}

const MonthlyControl: React.FC<MonthlyControlProps> = ({ employees }) => {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [closedMonths, setClosedMonths] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('tcponto_closed_months');
    if (saved) {
      setClosedMonths(JSON.parse(saved));
    }

    // Set current month and year as default
    const now = new Date();
    setSelectedMonth((now.getMonth() + 1).toString().padStart(2, '0'));
    setSelectedYear(now.getFullYear().toString());
  }, []);

  const getMonthKey = (year: string, month: string) => `${year}-${month}`;

  const isMonthClosed = (year: string, month: string) => {
    return closedMonths.includes(getMonthKey(year, month));
  };

  const handleCloseMonth = () => {
    if (!selectedMonth || !selectedYear) {
      alert('Selecione o mês e ano');
      return;
    }

    const monthKey = getMonthKey(selectedYear, selectedMonth);
    
    if (isMonthClosed(selectedYear, selectedMonth)) {
      alert('Este mês já está encerrado');
      return;
    }

    if (confirm(`Tem certeza que deseja encerrar o mês ${selectedMonth}/${selectedYear}? Todos os registros ficarão bloqueados para edição.`)) {
      const updatedClosedMonths = [...closedMonths, monthKey];
      setClosedMonths(updatedClosedMonths);
      localStorage.setItem('tcponto_closed_months', JSON.stringify(updatedClosedMonths));
      
      alert(`Mês ${selectedMonth}/${selectedYear} encerrado com sucesso!`);
    }
  };

  const handleReopenMonth = () => {
    if (!selectedMonth || !selectedYear) {
      alert('Selecione o mês e ano');
      return;
    }

    const monthKey = getMonthKey(selectedYear, selectedMonth);
    
    if (!isMonthClosed(selectedYear, selectedMonth)) {
      alert('Este mês não está encerrado');
      return;
    }

    if (confirm(`Tem certeza que deseja reabrir o mês ${selectedMonth}/${selectedYear}? Os registros voltarão a aceitar edições.`)) {
      const updatedClosedMonths = closedMonths.filter(month => month !== monthKey);
      setClosedMonths(updatedClosedMonths);
      localStorage.setItem('tcponto_closed_months', JSON.stringify(updatedClosedMonths));
      
      alert(`Mês ${selectedMonth}/${selectedYear} reaberto com sucesso!`);
    }
  };

  const months = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' }
  ];

  const years = Array.from({ length: 10 }, (_, i) => {
    const year = new Date().getFullYear() - 5 + i;
    return year.toString();
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary-900">Controle Mensal</h2>
        <p className="text-gray-600">Encerrar meses para bloquear edições de registros</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Encerramento de Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Mês</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Ano</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o ano" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Status</label>
              <div className="flex items-center h-10 px-3 py-2 border rounded-md bg-gray-50">
                {selectedMonth && selectedYear ? (
                  isMonthClosed(selectedYear, selectedMonth) ? (
                    <span className="flex items-center gap-2 text-red-600">
                      <Lock className="w-4 h-4" />
                      Encerrado
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-green-600">
                      <Unlock className="w-4 h-4" />
                      Aberto
                    </span>
                  )
                ) : (
                  <span className="text-gray-400">Selecione período</span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {selectedMonth && selectedYear && (
                <>
                  {!isMonthClosed(selectedYear, selectedMonth) ? (
                    <Button
                      onClick={handleCloseMonth}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Encerrar Mês
                    </Button>
                  ) : (
                    <Button
                      onClick={handleReopenMonth}
                      variant="outline"
                      className="border-green-600 text-green-600 hover:bg-green-50"
                    >
                      <Unlock className="w-4 h-4 mr-2" />
                      Reabrir Mês
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de meses encerrados */}
      {closedMonths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Meses Encerrados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {closedMonths.map((monthKey) => {
                const [year, month] = monthKey.split('-');
                const monthName = months.find(m => m.value === month)?.label;
                return (
                  <div
                    key={monthKey}
                    className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded"
                  >
                    <Lock className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-700">
                      {monthName} {year}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MonthlyControl;
