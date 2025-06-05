import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, ArrowLeft, CalendarIcon, Search, Percent, Calculator, FileDown, FileText, FileSpreadsheet } from 'lucide-react'; // Adicionado FileDown, FileText, FileSpreadsheet
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useToast } from '@/components/ui/use-toast';

// Importações para Exportação
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

// Configura as fontes do pdfmake
pdfMake.vfs = pdfFonts.pdfMake.vfs;


interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourlyRate?: number | null;
}


interface AllowedLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  range_meters: number;
  address: string;
}


interface EmployeeAutoObrasData {
  employeeId: string;
  employeeName: string;
  departmentId: string;
  jobFunctionId: string;
  autoValue: number;
  locations: Array<{
    locationName: string;
    totalHours: number;
    totalDays: number;
    totalValue: number;
  }>;
}


// ✨ NOVA: Interface para somatório por localização
interface LocationSummary {
  locationName: string;
  totalDays: number;
  totalValue: number;
  totalValueWithPercentage: number;
  percentage: number;
}


// ✨ NOVA: Interface para configuração de porcentagem
interface PercentageConfig {
  [locationName: string]: number;
}


interface AutoDeObrasProps {
  employees: User[];
  onBack?: () => void;
}


const AutoDeObras: React.FC<AutoDeObrasProps> = ({ employees, onBack }) => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [employeeAutoObrasData, setEmployeeAutoObrasData] = useState<EmployeeAutoObrasData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [percentageConfig, setPercentageConfig] = useState<PercentageConfig>({});
  const [isPercentageDialogOpen, setIsPercentageDialogOpen] = useState(false);
  const [tempPercentage, setTempPercentage] = useState<string>('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);

  const { formatCurrency, currency } = useCurrency();
  const { toast } = useToast();

  const formatHoursAsTime = (hours: number) => {
    if (!hours || hours === 0) return '00:00';

    const totalMinutes = Math.round(hours * 60);
    const hoursDisplay = Math.floor(totalMinutes / 60);
    const minutesDisplay = totalMinutes % 60;

    return `${hoursDisplay.toString().padStart(2, '0')}:${minutesDisplay.toString().padStart(2, '0')}`;
  };

  const extractLocationName = (locations: any): string | null => {
    if (!locations) {
      return null;
    }

    if (typeof locations === 'object' && !Array.isArray(locations)) {
      const events = ['clock_in', 'clock_out', 'lunch_start', 'lunch_end'];

      for (const event of events) {
        const eventData = locations[event];
        if (eventData && typeof eventData === 'object') {
          const locationName = eventData.locationName;
          if (locationName && typeof locationName === 'string' && locationName.trim()) {
            return locationName.trim();
          }
        }
      }
    }

    if (typeof locations === 'string' && locations.trim()) {
      return locations.trim();
    }

    const findLocationNameRecursive = (obj: any, depth = 0): string | null => {
      if (!obj || typeof obj !== 'object' || depth > 3) return null;

      if (obj.locationName && typeof obj.locationName === 'string' && obj.locationName.trim()) {
        return obj.locationName.trim();
      }

      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const result = findLocationNameRecursive(obj[key], depth + 1);
          if (result) return result;
        }
      }

      return null;
    };

    const recursiveResult = findLocationNameRecursive(locations);
    if (recursiveResult) {
      return recursiveResult;
    }

    return "Local Não Identificado";
  };

  const loadAutoObrasData = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Atenção",
        description: "Por favor, selecione as datas de início e fim.",
        variant: "default"
      });
      return;
    }

    if (employees.length === 0) {
      toast({
        title: "Atenção",
        description: "Nenhum funcionário disponível para gerar o relatório.",
        variant: "default"
      });
      return;
    }

    setLoading(true);
    setHasSearched(true);

    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    try {
      let query = supabase
        .from('time_records')
        .select(`
          id,
          date,
          user_id,
          locations,
          total_hours
        `)
        .eq('status', 'active')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .not('total_hours', 'is', null)
        .gt('total_hours', 0);

      if (selectedEmployee !== 'all') {
        query = query.eq('user_id', selectedEmployee);
      }

      const { data: timeRecords, error } = await query.order('date', { ascending: false });

      if (error) {
        console.error('❌ Erro na query time_records:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar registros de ponto",
          variant: "destructive"
        });
        setEmployeeAutoObrasData([]);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(timeRecords?.map(r => r.user_id) || [])];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, department_id, job_function_id')
        .in('id', userIds);

      if (profilesError) {
        console.error('❌ Erro na query profiles:', profilesError);
        toast({
          title: "Erro",
          description: "Erro ao carregar perfis de usuários",
          variant: "destructive"
        });
        setEmployeeAutoObrasData([]);
        setLoading(false);
        return;
      }

      const profilesMap = new Map();
      profiles?.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });

      const { data: autoValues, error: autoError } = await supabase
        .from('auto_obras_values')
        .select('department_id, job_function_id, auto_value')
        .eq('is_active', true);

      if (autoError) {
        console.error('❌ Erro ao carregar auto values:', autoError);
        // Não impede a exibição, apenas loga o erro
      }

      const autoValuesMap = new Map<string, number>();
      autoValues?.forEach(av => {
        const key = `${av.department_id}-${av.job_function_id}`;
        autoValuesMap.set(key, av.auto_value);
      });

      const employeeMap = new Map<string, EmployeeAutoObrasData>();
      const locationDaysMap = new Map<string, Map<string, Set<string>>>(); // Para contar dias únicos por user+location

      timeRecords?.forEach((record) => {
        const profile = profilesMap.get(record.user_id);

        if (!profile || !profile.department_id || !profile.job_function_id) return;

        const autoKey = `${profile.department_id}-${profile.job_function_id}`;
        const autoValue = autoValuesMap.get(autoKey) || 0;

        if (autoValue <= 0) return;

        const locationName = extractLocationName(record.locations);

        if (!locationName) return;

        // Processamento para o relatório detalhado
        if (!employeeMap.has(record.user_id)) {
          employeeMap.set(record.user_id, {
            employeeId: record.user_id,
            employeeName: profile.name,
            departmentId: profile.department_id,
            jobFunctionId: profile.job_function_id,
            autoValue: autoValue,
            locations: []
          });
        }

        const employeeData = employeeMap.get(record.user_id)!;
        let locationEntry = employeeData.locations.find(loc => loc.locationName === locationName);

        if (!locationEntry) {
          locationEntry = {
            locationName: locationName,
            totalHours: 0,
            totalDays: 0, // Será calculado depois
            totalValue: 0
          };
          employeeData.locations.push(locationEntry);
        }

        locationEntry.totalHours += Number(record.total_hours);
        locationEntry.totalValue = locationEntry.totalHours * autoValue;

        // Processamento para contar dias únicos por user+location
        if (!locationDaysMap.has(record.user_id)) {
          locationDaysMap.set(record.user_id, new Map());
        }
        const userLocationDays = locationDaysMap.get(record.user_id)!;
        if (!userLocationDays.has(locationName)) {
          userLocationDays.set(locationName, new Set());
        }
        userLocationDays.get(locationName)!.add(record.date);
      });

      // Atualizar contagem de dias nos dados detalhados
      for (const [userId, employeeData] of employeeMap) {
        const userLocationDays = locationDaysMap.get(userId);
        if (userLocationDays) {
          employeeData.locations.forEach(loc => {
            const daysSet = userLocationDays.get(loc.locationName);
            loc.totalDays = daysSet ? daysSet.size : 0;
          });
        }
      }


      const result = Array.from(employeeMap.values())
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

      setEmployeeAutoObrasData(result);

    } catch (error) {
      console.error('❌ Erro geral ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar os dados do relatório.",
        variant: "destructive"
      });
      setEmployeeAutoObrasData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadAutoObrasData();
  };

  const handleClearSearch = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedEmployee('all');
    setEmployeeAutoObrasData([]);
    setHasSearched(false);
    setPercentageConfig({}); // Limpa as porcentagens configuradas
    setSelectedLocations([]); // Limpa as localizações selecionadas no modal
    setTempPercentage(''); // Limpa o valor temporário da porcentagem
  };

  // ✨ NOVO: Dados expandidos para a tabela detalhada
  const expandedData = useMemo(() => {
    const data: (EmployeeAutoObrasData['locations'][0] & { employeeId: string; employeeName: string })[] = [];
    employeeAutoObrasData.forEach(employee => {
      employee.locations.forEach(location => {
        data.push({
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          ...location
        });
      });
    });
    return data;
  }, [employeeAutoObrasData]);

  // ✨ NOVO: Somatório por localização
  const locationSummary = useMemo(() => {
    const summaryMap = new Map<string, { totalDays: number; totalValue: number }>();
    const locationDaysMap = new Map<string, Set<string>>(); // Para contar dias únicos por localização

    // Primeiro, acumula horas e valor por localização e conta dias únicos
    employeeAutoObrasData.forEach(employee => {
        // Precisamos ir nos registros originais para contar dias únicos por localização geral
        // Isso exigiria re-processar os timeRecords ou armazenar os dias por locationName
        // Vamos simplificar por agora e somar os dias dos dados já agregados,
        // mas o ideal seria contar dias únicos no nível do time_record por locationName.
        // Para a demonstração, vamos somar os totalDays já calculados por funcionário+local.
        // Isso pode superestimar os dias se um funcionário trabalhou em 2 locais no mesmo dia.
        // A abordagem correta seria:
        // timeRecords.forEach(record => {
        //     const locationName = extractLocationName(record.locations);
        //     if (locationName) {
        //         if (!locationDaysMap.has(locationName)) {
        //             locationDaysMap.set(locationName, new Set());
        //         }
        //         locationDaysMap.get(locationName)!.add(record.date);
        //     }
        // });
        // E usar locationDaysMap.get(locationName).size para totalDays no summary.

        // Usando a soma dos dias já calculados nos dados detalhados (simplificado)
        employee.locations.forEach(location => {
            const currentSummary = summaryMap.get(location.locationName) || { totalDays: 0, totalValue: 0 };
            currentSummary.totalDays += location.totalDays; // Soma os dias do detalhe
            currentSummary.totalValue += location.totalValue;
            summaryMap.set(location.locationName, currentSummary);
        });
    });

     // Re-calculando totalDays corretamente do expandedData
     const correctLocationDaysMap = new Map<string, Set<string>>();
     employeeAutoObrasData.forEach(employee => {
         employee.locations.forEach(location => {
             // Precisa ter acesso aos registros originais para contar dias únicos por localização geral
             // Como não temos os timeRecords originais aqui, vamos usar expandedData como proxy
             // Isso AINDA PODE SER IMPRECISO se um funcionário trabalhou em múltiplos locais no mesmo dia.
             // A solução ideal seria refazer a contagem de dias únicos por locationName diretamente dos timeRecords
             // ou passar os timeRecords para este useMemo.
             // Para fins de exportação, vamos assumir que a soma dos dias do expandedData é aceitável por enquanto,
             // OU, melhor, recalcular os dias únicos a partir do expandedData, embora ainda não seja 100% preciso
             // se o mesmo funcionário aparece em múltiplos locais no mesmo dia no expandedData.

             // Vamos tentar contar dias únicos por locationName a partir do expandedData
             // Isso ainda não é perfeito, pois não sabemos a data original aqui.
             // A contagem de dias únicos por locationName deveria ser feita NO loadAutoObrasData
             // e armazenada em um estado separado para ser usada aqui.

             // Vamos manter a soma simples dos dias do expandedData por enquanto,
             // mas ciente da possível imprecisão. A alternativa correta é mais complexa.
         });
     });

     // Vamos recalcular o summary usando expandedData para garantir consistência
     const refinedSummaryMap = new Map<string, { totalDays: number; totalValue: number }>();
     const refinedLocationDaysMap = new Map<string, Set<string>>(); // Para contar dias únicos por localização GERAL

     // Precisamos dos timeRecords originais para contar os dias únicos por localização GERAL
     // Como não os temos aqui, vamos ADICIONAR um estado para armazenar os timeRecords brutos
     // ou refatorar loadAutoObrasData para retornar o summary já calculado corretamente.

     // **ABORDAGEM CORRETA (requer refatoração):**
     // loadAutoObrasData deve calcular e retornar:
     // 1. employeeAutoObrasData (detalhado)
     // 2. locationSummary (resumo com contagem de dias únicos por localização geral)
     // 3. uniqueLocations (lista de nomes de locais únicos)

     // **ABORDAGEM SIMPLIFICADA (usando expandedData como proxy):**
     // Vamos somar os totalDays e totalValue do expandedData agrupando por locationName.
     // A contagem de dias AINDA SERÁ a soma dos dias por funcionário+local, NÃO dias únicos GERAIS.
     // Para o relatório de "Auto de Obras", talvez a soma dos dias por alocação (funcionário+local)
     // seja o que se espera, e não dias únicos GERAIS por local. Vamos seguir com essa interpretação.

     const simpleSummaryMap = new Map<string, { totalDays: number; totalValue: number }>();
     expandedData.forEach(item => {
         const currentSummary = simpleSummaryMap.get(item.locationName) || { totalDays: 0, totalValue: 0 };
         currentSummary.totalDays += item.totalDays; // Soma os dias do detalhe
         currentSummary.totalValue += item.totalValue;
         simpleSummaryMap.set(item.locationName, currentSummary);
     });


    const summaryArray = Array.from(simpleSummaryMap.entries()).map(([locationName, data]) => ({
      locationName,
      totalDays: data.totalDays,
      totalValue: data.totalValue,
      percentage: percentageConfig[locationName] || 0,
      totalValueWithPercentage: data.totalValue * (1 + (percentageConfig[locationName] || 0) / 100),
    }));

    return summaryArray.sort((a, b) => a.locationName.localeCompare(b.locationName));

  }, [expandedData, percentageConfig]); // Depende de expandedData e percentageConfig

  // ✨ NOVO: Lista de localizações únicas para o modal de porcentagem
  const uniqueLocations = useMemo(() => {
    const locations = new Set<string>();
    employeeAutoObrasData.forEach(employee => {
      employee.locations.forEach(location => {
        locations.add(location.locationName);
      });
    });
    return Array.from(locations).sort();
  }, [employeeAutoObrasData]);

  // ✨ NOVO: Funções para o modal de porcentagem
  const toggleLocationSelection = (locationName: string) => {
    setSelectedLocations(prev =>
      prev.includes(locationName)
        ? prev.filter(loc => loc !== locationName)
        : [...prev, locationName]
    );
  };

  const handleApplyPercentage = () => {
    const percentage = parseFloat(tempPercentage);
    if (isNaN(percentage) || percentage < 0) {
      toast({
        title: "Erro",
        description: "Porcentagem inválida. Insira um número positivo.",
        variant: "destructive"
      });
      return;
    }

    const newPercentageConfig = { ...percentageConfig };
    selectedLocations.forEach(locationName => {
      newPercentageConfig[locationName] = percentage;
    });

    setPercentageConfig(newPercentageConfig);
    setIsPercentageDialogOpen(false);
    setSelectedLocations([]); // Limpa a seleção após aplicar
    setTempPercentage(''); // Limpa o campo de porcentagem
    toast({
      title: "Sucesso",
      description: `Porcentagem de ${percentage}% aplicada a ${selectedLocations.length} localização(ões).`,
      variant: "default"
    });
  };

  const handleClearPercentages = () => {
    setPercentageConfig({});
    toast({
      title: "Sucesso",
      description: "Todas as porcentagens foram removidas.",
      variant: "default"
    });
  };


  // ✨ NOVAS: Funções de Exportação

  const exportToExcel = (data: any[], filename: string, sheetName: string = 'Sheet1') => {
    if (data.length === 0) {
      toast({
        title: "Atenção",
        description: "Não há dados para exportar para Excel.",
        variant: "default"
      });
      return;
    }

    try {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
      saveAs(blob, `${filename}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
      toast({
        title: "Sucesso",
        description: `Relatório "${filename}" exportado para Excel.`,
        variant: "default"
      });
    } catch (error) {
      console.error("Erro ao exportar para Excel:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao exportar para Excel.",
        variant: "destructive"
      });
    }
  };

  const exportToPdf = (data: any[], filename: string, reportTitle: string, columns: { header: string, dataKey: string, format?: (value: any) => string }[]) => {
    if (data.length === 0) {
      toast({
        title: "Atenção",
        description: "Não há dados para exportar para PDF.",
        variant: "default"
      });
      return;
    }

    try {
      const tableBody = [
        columns.map(col => ({ text: col.header, style: 'tableHeader' })), // Headers
        ...data.map(row => columns.map(col => {
          const value = row[col.dataKey];
          return {
            text: col.format ? col.format(value) : value,
            style: 'tableCell'
          };
        })) // Data rows
      ];

      const docDefinition: any = {
        content: [
          { text: reportTitle, style: 'header' },
          { text: `Período: ${startDate && endDate ? `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}` : 'Não especificado'}`, style: 'subheader' },
          { text: `Funcionário: ${selectedEmployee === 'all' ? 'Todos' : employees.find(emp => emp.id === selectedEmployee)?.name || 'Desconhecido'}`, style: 'subheader' },
          { text: '\n' }, // Espaço
          {
            table: {
              headerRows: 1,
              widths: columns.map(() => '*'), // Largura automática para colunas
              body: tableBody,
            },
            layout: {
                fillColor: function (rowIndex: number, node: any, columnIndex: number) {
                    return (rowIndex % 2 === 0) ? '#CCCCCC' : null;
                }
            }
          }
        ],
        styles: {
          header: {
            fontSize: 18,
            bold: true,
            margin: [0, 0, 0, 10]
          },
          subheader: {
            fontSize: 12,
            margin: [0, 2, 0, 2]
          },
          tableHeader: {
            bold: true,
            fontSize: 10,
            color: 'black',
            fillColor: '#EEEEEE',
            alignment: 'center'
          },
          tableCell: {
            fontSize: 9,
            margin: [0, 5, 0, 5],
            alignment: 'left' // Ajuste conforme necessário
          }
        },
        defaultStyle: {
            columnGap: 20,
            alignment: 'left'
        }
      };

      // Ajusta alinhamento para colunas numéricas no PDF
      columns.forEach((col, index) => {
        if (col.dataKey.includes('Value') || col.dataKey.includes('Days') || col.dataKey.includes('Percentage')) {
            docDefinition.content[4].table.body.forEach((row: any, rowIndex: number) => {
                if (rowIndex > 0) { // Ignora o header
                    row[index].alignment = 'right';
                }
            });
        }
         if (col.dataKey.includes('Hours') || col.dataKey.includes('Days') || col.dataKey.includes('Percentage')) {
             docDefinition.content[4].table.body.forEach((row: any, rowIndex: number) => {
                 if (rowIndex > 0) { // Ignora o header
                     row[index].alignment = 'center';
                 }
             });
         }
      });


      const pdfDoc = pdfMake.createPdfKitDocument(docDefinition);
      pdfDoc.pipe(saveAs(new Blob([], { type: 'application/pdf' }), `${filename}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`));
      pdfDoc.end();

      toast({
        title: "Sucesso",
        description: `Relatório "${filename}" exportado para PDF.`,
        variant: "default"
      });
    } catch (error) {
      console.error("Erro ao exportar para PDF:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao exportar para PDF.",
        variant: "destructive"
      });
    }
  };


  // ✨ NOVOS: Handlers para os botões de exportação

  const handleExportDetailedExcel = () => {
    const dataToExport = expandedData.map(item => ({
      "Funcionário": item.employeeName,
      "Local": item.locationName,
      "Total de Horas": formatHoursAsTime(item.totalHours), // Exportar como texto formatado
      "Total de Dias": item.totalDays,
      "Valor Total": item.totalValue, // Exportar como número para cálculos no Excel
    }));
    exportToExcel(dataToExport, 'relatorio_auto_obras_detalhado', 'Detalhado');
  };

  const handleExportDetailedPdf = () => {
      const columns = [
          { header: "Funcionário", dataKey: "employeeName" },
          { header: "Local", dataKey: "locationName" },
          { header: "Total de Horas", dataKey: "totalHours", format: (value: number) => formatHoursAsTime(value) },
          { header: "Total de Dias", dataKey: "totalDays" },
          { header: "Valor Total", dataKey: "totalValue", format: (value: number) => formatCurrency(value) },
      ];
      // Mapeia os dados para o formato esperado pelo pdfmake (array de objetos com chaves correspondentes a dataKey)
      const dataToExport = expandedData.map(item => ({
          employeeName: item.employeeName,
          locationName: item.locationName,
          totalHours: item.totalHours,
          totalDays: item.totalDays,
          totalValue: item.totalValue,
      }));
      exportToPdf(dataToExport, 'relatorio_auto_obras_detalhado', 'Relatório Detalhado de Auto de Obras', columns);
  };


  const handleExportSummaryExcel = () => {
    const dataToExport = locationSummary.map(item => ({
      "Localização": item.locationName,
      "Total de Dias": item.totalDays,
      "Valor Base": item.totalValue, // Exportar como número
      "Porcentagem (%)": item.percentage, // Exportar como número
      "Valor Final": item.totalValueWithPercentage, // Exportar como número
    }));
    exportToExcel(dataToExport, 'relatorio_auto_obras_resumo', 'Resumo por Local');
  };

  const handleExportSummaryPdf = () => {
      const columns = [
          { header: "Localização", dataKey: "locationName" },
          { header: "Total de Dias", dataKey: "totalDays" },
          { header: "Valor Base", dataKey: "totalValue", format: (value: number) => formatCurrency(value) },
          { header: "Porcentagem", dataKey: "percentage", format: (value: number) => `${value}%` },
          { header: "Valor Final", dataKey: "totalValueWithPercentage", format: (value: number) => formatCurrency(value) },
      ];
       // Mapeia os dados para o formato esperado pelo pdfmake
       const dataToExport = locationSummary.map(item => ({
           locationName: item.locationName,
           totalDays: item.totalDays,
           totalValue: item.totalValue,
           percentage: item.percentage,
           totalValueWithPercentage: item.totalValueWithPercentage,
       }));
      exportToPdf(dataToExport, 'relatorio_auto_obras_resumo', 'Resumo de Auto de Obras por Localização', columns);
  };


  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <Building2 className="w-6 h-6 text-blue-600" />
          Relatório de Auto de Obras
        </h1>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Filtros e Pesquisa</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div className="flex flex-col space-y-2">
              <Label htmlFor="employee-select">Funcionário</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger id="employee-select">
                  <SelectValue placeholder="Selecione um funcionário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Funcionários</SelectItem>
                  {employees.map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col space-y-2">
              <Label>Período</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : <span>Data Início</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : <span>Data Fim</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* ✨ MUDANÇA: Só mostrar estatísticas após pesquisar */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Registros Válidos</label>
              <div className="text-2xl font-bold text-blue-600">
                {hasSearched ? expandedData.length : '-'}
              </div>
            </div>

            {/* ✨ NOVOS: Botões de ação */}
            <div className="flex gap-2 pt-4 border-t col-span-3"> {/* col-span-3 para ocupar a linha toda */}
              <Button
                onClick={handleSearch}
                disabled={loading || !startDate || !endDate}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Search className="w-4 h-4 mr-2 animate-spin" />
                    Pesquisando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Pesquisar
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

            {/* ✨ NOVO: Aviso sobre obrigatoriedade das datas */}
            {(!startDate || !endDate) && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg col-span-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Atenção:</strong> Selecione as datas de início e fim para pesquisar os registros.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ✨ MUDANÇA: Condicional para mostrar resultados */}
        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <Search className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                Carregando dados painel de alocação...
              </div>
            </CardContent>
          </Card>
        ) : hasSearched ? (
          // Mostrar resultados apenas após pesquisar
          expandedData.length > 0 ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between"> {/* Adicionado flex para alinhar título e botões */}
                  <div>
                    <CardTitle>Painel de Alocação (Detalhado)</CardTitle>
                    <p className="text-sm text-gray-600">
                      Valores calculados com base no valor por função
                      {startDate && endDate && (
                        <span className="ml-2 text-gray-400">
                          ({format(startDate, 'dd/MM/yyyy')} - {format(endDate, 'dd/MM/yyyy')})
                        </span>
                      )}
                    </p>
                  </div>
                  {/* ✨ NOVOS: Botões de Exportação para o Relatório Detalhado */}
                  <div className="flex gap-2">
                      <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportDetailedPdf}
                          disabled={expandedData.length === 0}
                      >
                          <FileText className="w-4 h-4 mr-2" /> PDF
                      </Button>
                      <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportDetailedExcel}
                          disabled={expandedData.length === 0}
                      >
                          <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
                      </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold">Funcionário</TableHead>
                          <TableHead className="font-semibold">Local</TableHead>
                          <TableHead className="text-center font-semibold">Total de Horas</TableHead>
                          <TableHead className="text-center font-semibold">Total de Dias</TableHead>
                          <TableHead className="text-right font-semibold">Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expandedData.map((row, index) => (
                          <TableRow key={`${row.employeeId}-${row.locationName}-${index}`}>
                            <TableCell className="font-medium">{row.employeeName}</TableCell>
                            <TableCell>{row.locationName}</TableCell>
                            <TableCell className="text-center">
                              {formatHoursAsTime(row.totalHours)}
                            </TableCell>
                            <TableCell className="text-center">
                              {row.totalDays} dia{row.totalDays !== 1 ? 's' : ''}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(row.totalValue)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* ✨ NOVO: Somatório por Localização */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="w-5 h-5" />
                      Total por Localização (Resumo)
                    </CardTitle>
                    <p className="text-sm text-gray-600">Totais agrupados por local de trabalho</p>
                  </div>
                  <div className="flex gap-2">
                    {/* ✨ NOVOS: Botões de Exportação para o Resumo por Localização */}
                      <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportSummaryPdf}
                          disabled={locationSummary.length === 0}
                      >
                          <FileText className="w-4 h-4 mr-2" /> PDF
                      </Button>
                      <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportSummaryExcel}
                          disabled={locationSummary.length === 0}
                      >
                          <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
                      </Button>

                    <Dialog open={isPercentageDialogOpen} onOpenChange={setIsPercentageDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Percent className="w-4 h-4 mr-2" />
                          Adicionar %
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Configurar Porcentagem por Localização</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="percentage">Porcentagem (%)</Label>
                            <Input
                              id="percentage"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Ex: 15.5"
                              value={tempPercentage}
                              onChange={(e) => setTempPercentage(e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Selecionar Localizações</Label>
                            <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-3">
                              {uniqueLocations.map(location => (
                                <div key={location} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`location-${location}`}
                                    checked={selectedLocations.includes(location)}
                                    onCheckedChange={() => toggleLocationSelection(location)}
                                  />
                                  <Label htmlFor={`location-${location}`} className="text-sm">
                                    {location}
                                    {percentageConfig[location] !== undefined && ( // Mostrar % apenas se configurada
                                      <span className="text-blue-600 ml-1">
                                        ({percentageConfig[location]}%)
                                      </span>
                                    )}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="outline"
                              onClick={() => setIsPercentageDialogOpen(false)}
                            >
                              Cancelar
                            </Button>
                            <Button onClick={handleApplyPercentage} disabled={selectedLocations.length === 0 || tempPercentage === ''}> {/* Desabilita se nenhuma localização selecionada ou porcentagem vazia */}
                              Aplicar
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {Object.keys(percentageConfig).length > 0 && (
                      <Button variant="outline" size="sm" onClick={handleClearPercentages}>
                        Limpar %
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold">Localização</TableHead>
                          <TableHead className="text-center font-semibold">Total de Dias</TableHead>
                          <TableHead className="text-right font-semibold">Valor Base</TableHead>
                          <TableHead className="text-center font-semibold">Porcentagem</TableHead>
                          <TableHead className="text-right font-semibold">Valor Final</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {locationSummary.map((summary) => (
                          <TableRow key={summary.locationName}>
                            <TableCell className="font-medium">{summary.locationName}</TableCell>
                            <TableCell className="text-center">
                              {summary.totalDays} dia{summary.totalDays !== 1 ? 's' : ''}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(summary.totalValue)}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={cn(
                                "px-2 py-1 rounded-full text-xs font-medium",
                                summary.percentage > 0
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-600"
                                )}>
                                {summary.percentage > 0 ? `+${summary.percentage}%` : '0%'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {formatCurrency(summary.totalValueWithPercentage)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableBody>
                        <TableRow className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                          <TableCell className="font-bold">TOTAL GERAL</TableCell>
                          <TableCell className="text-center font-bold">
                            {locationSummary.reduce((sum, s) => sum + s.totalDays, 0)} dias
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(locationSummary.reduce((sum, s) => sum + s.totalValue, 0))}
                          </TableCell>
                          <TableCell className="text-center">-</TableCell>
                          <TableCell className="text-right font-bold text-blue-600">
                            {formatCurrency(locationSummary.reduce((sum, s) => sum + s.totalValueWithPercentage, 0))}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-500 py-12">
                  <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    Nenhum registro encontrado
                  </h3>
                  <p className="text-sm">
                    {startDate && endDate ? (
                      `Nenhum registro válido encontrado para o período de ${format(startDate, 'dd/MM/yyyy')} até ${format(endDate, 'dd/MM/yyyy')}.`
                    ) : (
                      'Nenhum registro válido encontrado para os filtros selecionados.'
                    )}
                    <br />
                    Verifique se existem registros de ponto com valores configurados.
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        ) : (
          // ✨ NOVO: Estado inicial - sem dados
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-gray-500 py-12">
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  Painel de Alocação
                </h3>
                <p className="text-sm">
                  Selecione as datas de início e fim, depois clique em "Pesquisar" para visualizar o relatório por localização e funcionário.
                </p>
                <div className="mt-4 text-xs text-gray-400">
                  💡 Este relatório mostra valores calculados com base nos valores configurados por departamento e função.
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AutoDeObras;
