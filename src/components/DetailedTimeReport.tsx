import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar, User, Users, FileDown, Search, Clock, CalendarIcon, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calculateWorkingHours } from '@/utils/timeCalculations';
import { getActiveEmployees, type Employee } from '@/utils/employeeFilters';
import { useToast } from '@/components/ui/use-toast';

// ✨ ATUALIZADO: last_edited_at adicionado
interface TimeRecord {
  id?: string;
  date: string;
  user_id?: string;
  clock_in?: string | null;
  lunch_start?: string | null;
  lunch_end?: string | null;
  clock_out?: string | null;
  total_hours?: number | null; // Mantido, pois é calculado e adicionado depois
  normal_hours?: number | null; // Mantido, pois é calculado e adicionado depois
  overtime_hours?: number | null; // Mantido, pois é calculado e adicionado depois
  last_edited_at?: string | null; // Campo para indicar se foi editado
  profiles?: {
    id: string;
    name: string;
    email: string;
    role: string;
    hourly_rate?: number;
  };
}

interface DetailedTimeReportProps {
  employees: Employee[];
  onBack?: () => void;
}

// Interface para o estado do registro em edição
interface EditingRecordState {
  id: string;
  date: string;
  user_id: string;
  clock_in: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  clock_out: string | null;
}


const DetailedTimeReport: React.FC<DetailedTimeReportProps> = ({ employees, onBack }) => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EditingRecordState | null>(null);
  const [editLoading, setEditLoading] = useState(false);


  const { toast } = useToast();

  const activeEmployees = useMemo(() => getActiveEmployees(employees), [employees]);

  const formatHoursAsTime = (hours: number | null | undefined) => {
    if (hours === null || hours === undefined || hours === 0) return '-';

    const totalMinutes = Math.round(hours * 60);
    const hoursDisplay = Math.floor(totalMinutes / 60);
    const minutesDisplay = totalMinutes % 60;

    return `${hoursDisplay.toString().padStart(2, '0')}:${minutesDisplay.toString().padStart(2, '0')}`;
  };

  const generateDateRange = (start: string, end: string) => {
    const dates = [];
    const startDateObj = new Date(start + 'T00:00:00');
    const endDateObj = new Date(end + 'T00:00:00');

    for (let date = new Date(startDateObj); date <= endDateObj; date.setDate(date.getDate() + 1)) {
      const dateString = format(date, 'yyyy-MM-dd');
      dates.push(dateString);
    }
    return dates;
  };

  const isDateInPeriod = (dateStr: string, start: string, end: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const startDateObj = new Date(start + 'T00:00:00');
    const endDateObj = new Date(end + 'T00:00:00');

    return date >= startDateObj && date <= endDateObj;
  };

  const getDayOfWeek = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return format(date, 'EEEE', { locale: ptBR });
  };

  const generateReport = useCallback(async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Datas obrigatórias",
        description: "Por favor, selecione as datas de início e fim antes de pesquisar.",
        variant: "destructive"
      });
      return;
    }

    if (startDate > endDate) {
      toast({
        title: "Período inválido",
        description: "A data de início deve ser anterior à data de fim.",
        variant: "destructive"
      });
      return;
    }

    if (activeEmployees.length === 0 && selectedEmployeeId === 'all') {
       // Adicionado verificação para caso não haja ativos, mas um específico seja selecionado
       // Permitir buscar se um ID específico é selecionado, mesmo que não esteja na lista ativa
       if (!activeEmployees.find(emp => emp.id === selectedEmployeeId)) {
           toast({
               title: "Sem funcionários",
               description: "Não há funcionários ativos cadastrados para gerar o relatório.",
               variant: "destructive"
           });
           return;
       }
    }


    setLoading(true);
    setHasSearched(true);
    setTimeRecords([]);

    try {
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');

      const dateRange = generateDateRange(startDateStr, endDateStr);

      let query = supabase
        .from('time_records')
        // ✨ CORRIGIDO: Removido total_hours e overtime_hours da seleção
        .select('id, date, user_id, clock_in, lunch_start, lunch_end, clock_out, last_edited_at')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('user_id', { ascending: true })
        .order('date', { ascending: true });

      if (selectedEmployeeId !== 'all') {
        query = query.eq('user_id', selectedEmployeeId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao carregar registros:', error);
         // ✨ NOVO: Log mais detalhado do erro do Supabase
         console.error('Supabase Error Details:', error.message, error.details, error.hint);
        toast({
          title: "Erro",
          description: `Erro ao carregar registros de ponto: ${error.message}`, // Exibir mensagem de erro
          variant: "destructive"
        });
        return;
      }

      const recordsMap = (data || []).reduce((acc, record) => {
        if (isDateInPeriod(record.date, startDateStr, endDateStr)) {
          const key = `${record.user_id}-${record.date}`;
          acc[key] = record;
        }
        return acc;
      }, {} as Record<string, any>);


      let employeeIds: string[];
      if (selectedEmployeeId === 'all') {
         // Buscar IDs de todos os funcionários ativos
         employeeIds = activeEmployees.map(emp => emp.id);
         // Adicionar IDs de usuários encontrados nos registros que não estão na lista de ativos (para histórico)
         const recordUserIds = new Set(data?.map(r => r.user_id).filter((id): id is string => id !== null && id !== undefined));
         recordUserIds.forEach(id => {
             if (!employeeIds.includes(id)) {
                 employeeIds.push(id);
             }
         });
      } else {
        employeeIds = [selectedEmployeeId];
      }


      // Buscar perfis dos funcionários relevantes
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        // ✨ CORRIGIDO: Revertido filtro para buscar apenas usuários ativos
        .select('id, name, email, role')
        .in('id', employeeIds)
        .eq('role', 'user') // Buscar apenas usuários (não admins)
        .or('status.is.null,status.eq.active'); // Buscar status nulo ou ativo


      if (profilesError) {
        console.error('Erro ao carregar perfis:', profilesError);
         // ✨ NOVO: Log mais detalhado do erro do Supabase
         console.error('Supabase Profiles Error Details:', profilesError.message, profilesError.details, profilesError.hint);
        toast({
          title: "Erro",
          description: `Erro ao carregar perfis dos funcionários: ${profilesError.message}`, // Exibir mensagem de erro
          variant: "destructive"
        });
        return;
      }

      const profilesMap = (profilesData || []).reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, typeof profilesData[0]>);


      const completeRecords: TimeRecord[] = [];

      // Iterar sobre os funcionários relevantes (cujos perfis foram encontrados) e as datas do período
      profilesData?.forEach(profile => { // Iterar sobre profilesData para garantir que temos o perfil
          dateRange.forEach(date => {
              const key = `${profile.id}-${date}`;
              const record = recordsMap[key];

              if (record) {
                  // Usar a função padronizada com tolerância de 15 minutos
                  const { totalHours, normalHours, overtimeHours } = calculateWorkingHours(
                      record.clock_in || '',
                      record.lunch_start || '',
                      record.lunch_end || '',
                      record.clock_out || ''
                  );

                  completeRecords.push({
                      id: record.id, // Garantir que o ID é incluído
                      date,
                      user_id: profile.id,
                      profiles: profile,
                      clock_in: record.clock_in,
                      lunch_start: record.lunch_start,
                      lunch_end: record.lunch_end,
                      clock_out: record.clock_out,
                      total_hours: totalHours, // Calculado aqui
                      normal_hours: normalHours, // Calculado aqui
                      overtime_hours: overtimeHours, // Calculado aqui
                      last_edited_at: record.last_edited_at // Incluir o campo editado
                  });
              } else {
                  // Adicionar registros vazios para os dias sem ponto no período, APENAS se o perfil for de usuário ativo
                  // A iteração sobre profilesData já garante que o perfil é relevante.
                  completeRecords.push({
                      date,
                      user_id: profile.id,
                      profiles: profile,
                      clock_in: null,
                      lunch_start: null,
                      lunch_end: null,
                      clock_out: null,
                      total_hours: null,
                      normal_hours: null,
                      overtime_hours: null,
                      last_edited_at: null // Não editado se não há registro
                  });
              }
          });
      });

      // Ordenar por nome do funcionário e depois por data
      completeRecords.sort((a, b) => {
          const nameA = a.profiles?.name || '';
          const nameB = b.profiles?.name || '';
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          if (a.date < b.date) return -1;
          if (a.date > b.date) return 1;
          return 0;
      });


      setTimeRecords(completeRecords);

      toast({
        title: "Sucesso",
        description: `Relatório gerado com ${completeRecords.length} registros`,
      });

    } catch (error) {
      console.error('Erro inesperado ao gerar relatório:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao gerar relatório. Verifique o console para detalhes.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedEmployeeId, activeEmployees, toast]);


  const handleClearSearch = useCallback(() => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedEmployeeId('all');
    setTimeRecords([]);
    setHasSearched(false);

    toast({
      title: "Pesquisa limpa",
      description: "Filtros e resultados foram resetados.",
    });
  }, [toast]);


  const formatTime = (timeString: string | null | undefined) => {
    if (!timeString) return '-';
    // Garantir que é um formato de hora válido antes de fatiar
    if (timeString.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
        return timeString.slice(0, 5);
    }
    return '-'; // Retorna '-' se não for um formato de hora esperado
  };

   // Função para abrir o modal de edição
  const handleEditClick = useCallback((record: TimeRecord) => {
      if (!record.id || !record.user_id) {
          toast({
              title: "Erro",
              description: "Não é possível editar um registro sem ID ou usuário.",
              variant: "destructive"
          });
          return;
      }
      setEditingRecord({
          id: record.id,
          date: record.date,
          user_id: record.user_id,
          clock_in: record.clock_in || null,
          lunch_start: record.lunch_start || null,
          lunch_end: record.lunch_end || null,
          clock_out: record.clock_out || null,
      });
      setIsEditDialogOpen(true);
  }, [toast]);

  // Função para salvar as edições
  const handleSaveEdit = useCallback(async () => {
      if (!editingRecord || editLoading) return;

      setEditLoading(true);

      try {
          // Recalcular horas com base nos novos horários
          const { totalHours, normalHours, overtimeHours } = calculateWorkingHours(
              editingRecord.clock_in || '',
              editingRecord.lunch_start || '',
              editingRecord.lunch_end || '',
              editingRecord.clock_out || ''
          );

          // Preparar o payload para atualização
          const updatePayload = {
              clock_in: editingRecord.clock_in,
              lunch_start: editingRecord.lunch_start,
              lunch_end: editingRecord.lunch_end,
              clock_out: editingRecord.clock_out,
              total_hours: totalHours, // Salvar horas calculadas no DB (se as colunas existirem)
              normal_hours: normalHours, // Salvar horas calculadas no DB (se as colunas existirem)
              overtime_hours: overtimeHours, // Salvar horas calculadas no DB (se as colunas existirem)
              last_edited_at: new Date().toISOString(), // Registrar a data/hora da edição
          };

          // Remover campos nulos do payload para evitar erros de tipo no Supabase
          const cleanPayload = Object.fromEntries(
              Object.entries(updatePayload).filter(([_, v]) => v !== null)
          );


          const { data, error } = await supabase
              .from('time_records')
              .update(cleanPayload) // Usar payload limpo
              .eq('id', editingRecord.id)
              .select() // Selecionar o registro atualizado para obter o last_edited_at e outros campos
              .single();

          if (error) throw error;

          // Atualizar o estado local dos registros
          setTimeRecords(prevRecords =>
              prevRecords.map(record =>
                  record.id === editingRecord.id ? { ...record, ...data } : record
              )
          );

          toast({
              title: "Sucesso",
              description: "Registro de ponto atualizado com sucesso.",
          });

          setIsEditDialogOpen(false);
          setEditingRecord(null);

      } catch (error: any) {
          console.error('Erro ao salvar edição:', error);
          toast({
              title: "Erro",
              description: error.message || "Erro ao salvar edição do registro.",
              variant: "destructive"
          });
      } finally {
          setEditLoading(false);
      }
  }, [editingRecord, toast]);


  // Agrupar registros por funcionário para exibição
  const groupedRecords = useMemo(() => {
      return timeRecords.reduce((acc, record) => {
          const employeeName = record.profiles?.name || 'Funcionário Desconhecido';
          if (!acc[employeeName]) {
              acc[employeeName] = [];
          }
          acc[employeeName].push(record);
          return acc;
      }, {} as Record<string, TimeRecord[]>);
  }, [timeRecords]);


  const calculateEmployeeTotals = useCallback((records: TimeRecord[]) => {
    return records.reduce((totals, record) => {
      const totalHours = Number(record.total_hours || 0);
      const overtimeHours = Number(record.overtime_hours || 0);

      return {
        totalHours: totals.totalHours + totalHours,
        overtimeHours: totals.overtimeHours + overtimeHours
      };
    }, { totalHours: 0, overtimeHours: 0 });
  }, []);


  // Efeito para gerar relatório inicial se datas estiverem preenchidas (opcional)
  // useEffect(() => {
  //     if (startDate && endDate && !hasSearched) {
  //         generateReport();
  //     }
  // }, [startDate, endDate, hasSearched, generateReport]);


  if (activeEmployees.length === 0 && selectedEmployeeId === 'all') {
     return (
       <div className="min-h-screen bg-gray-50">
         <header className="bg-white shadow-sm border-b">
           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
             <div className="flex justify-between items-center h-16">
               <div className="flex items-center space-x-4">
                 <div>
                   <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                     <Clock className="w-5 h-5" />
                     Detalhamento de Ponto
                   </h1>
                   <p className="text-sm text-gray-600">Relatório detalhado de registros de ponto por funcionário</p>
                 </div>
               </div>
             </div>
           </div>
         </header>

         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
           <Card>
             <CardContent className="text-center py-8">
               <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
               <h3 className="text-lg font-medium mb-2">Nenhum funcionário ativo encontrado</h3>
               <p className="text-sm text-gray-500">
                 Cadastre funcionários ativos (não administradores) para visualizar relatórios detalhados.
               </p>
             </CardContent>
           </Card>
         </div>
       </div>
     );
  }


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Detalhamento de Ponto
                </h1>
                <p className="text-sm text-gray-600">Relatório detalhado de registros de ponto por funcionário</p>
              </div>
            </div>
             {onBack && (
                 <Button variant="outline" onClick={onBack}>
                     Voltar
                 </Button>
             )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Inicial *</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Final *</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Funcionário</label>
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os funcionários" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os funcionários</SelectItem>
                      {activeEmployees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Total de Registros</label>
                  <div className="text-2xl font-bold text-blue-600">
                    {hasSearched ? timeRecords.length : '-'}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={generateReport}
                  disabled={loading || !startDate || !endDate}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Search className="w-4 h-4 mr-2 animate-spin" />
                      Gerando relatório...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Gerar Relatório
                    </>
                  )}
                </Button>

                {hasSearched && (
                  <Button
                    variant="outline"
                    onClick={handleClearSearch}
                    disabled={loading}
                  >
                    Limpar
                  </Button>
                )}
              </div>

              {(!startDate || !endDate) && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ <strong>Atenção:</strong> Selecione as datas de início e fim para gerar o relatório.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {loading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <Search className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                  Carregando relatório detalhado...
                </div>
              </CardContent>
            </Card>
          ) : hasSearched ? (
            Object.keys(groupedRecords).length > 0 ? (
              <div className="space-y-6">
                {Object.entries(groupedRecords).map(([employeeName, records]) => {
                  const totals = calculateEmployeeTotals(records);

                  return (
                    <Card key={employeeName}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <User className="w-5 h-5" />
                            {employeeName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {startDate && endDate && (
                              <span>
                                {format(startDate, 'dd/MM/yyyy')} - {format(endDate, 'dd/MM/yyyy')}
                              </span>
                            )}
                          </div>
                        </CardTitle>
                        <div className="flex gap-6 text-sm text-gray-600">
                          <span>Total de Horas: <strong>{formatHoursAsTime(totals.totalHours)}</strong></span>
                          <span>Horas Extras: <strong>{formatHoursAsTime(totals.overtimeHours)}</strong></span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Dia da Semana</TableHead>
                                <TableHead>Entrada</TableHead>
                                <TableHead>Saída Almoço</TableHead>
                                <TableHead>Volta Almoço</TableHead>
                                <TableHead>Saída</TableHead>
                                <TableHead>Total Horas</TableHead>
                                <TableHead>Horas Extras</TableHead>
                                <TableHead className="w-[40px]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {records.map((record: TimeRecord, index: number) => {
                                // Usar ID se existir, caso contrário, um fallback
                                const key = record.id || `${record.user_id || 'no-user'}-${record.date}-${index}`;
                                // Classe condicional para destacar registros editados
                                const rowClassName = record.last_edited_at ? 'bg-yellow-50 hover:bg-yellow-100' : '';

                                return (
                                  <TableRow key={key} className={rowClassName}>
                                    <TableCell>{format(new Date(record.date + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>{getDayOfWeek(record.date)}</TableCell>
                                    <TableCell>{formatTime(record.clock_in)}</TableCell>
                                    <TableCell>{formatTime(record.lunch_start)}</TableCell>
                                    <TableCell>{formatTime(record.lunch_end)}</TableCell>
                                    <TableCell>{formatTime(record.clock_out)}</TableCell>
                                    <TableCell>{formatHoursAsTime(record.total_hours)}</TableCell>
                                    <TableCell>{formatHoursAsTime(record.overtime_hours)}</TableCell>
                                    <TableCell className="text-right">
                                        {/* Só mostra o ícone se o registro tiver um ID (existe no DB) */}
                                        {record.id && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEditClick(record)}
                                                className="p-0 h-auto"
                                                title="Editar registro"
                                            >
                                                <Pencil className="w-4 h-4 text-blue-600" />
                                            </Button>
                                        )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center text-gray-500 py-12">
                    <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      Nenhum registro encontrado
                    </h3>
                    <p className="text-sm">
                      {startDate && endDate ? (
                        `Nenhum registro de ponto encontrado para o período de ${format(startDate, 'dd/MM/yyyy')} até ${format(endDate, 'dd/MM/yyyy')}.`
                      ) : (
                        'Nenhum registro de ponto encontrado para os filtros selecionados.'
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-500 py-12">
                  <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    Detalhamento de Ponto
                  </h3>
                  <p className="text-sm">
                    Selecione as datas de início e fim, escolha um funcionário (ou todos), depois clique em "Gerar Relatório" para visualizar os registros detalhados de ponto.
                  </p>
                  <div className="mt-4 text-xs text-gray-400">
                    ⏰ Este relatório exibe os horários de entrada, saída, almoço e cálculos de horas trabalhadas e extras.
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Editar Registro de Ponto</DialogTitle>
              </DialogHeader>
              {editingRecord && (
                  <div className="space-y-4">
                      <div>
                          {/* Buscar o nome do funcionário do estado timeRecords */}
                          <p className="text-sm text-gray-600 mb-2">
                              Funcionário: <strong>{timeRecords.find(r => r.id === editingRecord.id)?.profiles?.name || 'N/A'}</strong>
                          </p>
                          <p className="text-sm text-gray-600">
                              Data: <strong>{format(new Date(editingRecord.date + 'T00:00:00'), 'dd/MM/yyyy')} ({getDayOfWeek(editingRecord.date)})</strong>
                          </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <Label htmlFor="edit-clock-in">Entrada</Label>
                              <Input
                                  id="edit-clock-in"
                                  type="time"
                                  value={editingRecord.clock_in || ''}
                                  onChange={(e) => setEditingRecord({ ...editingRecord, clock_in: e.target.value || null })}
                                  disabled={editLoading}
                              />
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="edit-lunch-start">Saída Almoço</Label>
                              <Input
                                  id="edit-lunch-start"
                                  type="time"
                                  value={editingRecord.lunch_start || ''}
                                  onChange={(e) => setEditingRecord({ ...editingRecord, lunch_start: e.target.value || null })}
                                  disabled={editLoading}
                              />
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="edit-lunch-end">Volta Almoço</Label>
                              <Input
                                  id="edit-lunch-end"
                                  type="time"
                                  value={editingRecord.lunch_end || ''}
                                  onChange={(e) => setEditingRecord({ ...editingRecord, lunch_end: e.target.value || null })}
                                  disabled={editLoading}
                              />
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="edit-clock-out">Saída</Label>
                              <Input
                                  id="edit-clock-out"
                                  type="time"
                                  value={editingRecord.clock_out || ''}
                                  onChange={(e) => setEditingRecord({ ...editingRecord, clock_out: e.target.value || null })}
                                  disabled={editLoading}
                              />
                          </div>
                      </div>
                  </div>
              )}
              <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={editLoading}>
                      Cancelar
                  </Button>
                  <Button onClick={handleSaveEdit} disabled={editLoading}>
                      {editLoading ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

    </div>
  );
};

export default DetailedTimeReport;
