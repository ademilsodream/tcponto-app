import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// ✨ DEFINIR TIPO Json LOCALMENTE (versão melhorada)
type Json = 
  | string 
  | number 
  | boolean 
  | null 
  | { [key: string]: Json } 
  | Json[];

// Interface for the JSON location object saved within a field key (e.g., "clock_in": {...})
interface LocationDetailsForEdit {
  address: string | null;
  distance: number | null; // Can be null for manual edits
  latitude: number | null;
  longitude: number | null;
  timestamp: string; // Timestamp of the edit request
  locationName: string;
}

// Interface for the expected structure *inside* the JSON column (whether it's named 'location' or 'locations')
// Ex: { "clock_in": { ...LocationDetailsForEdit... } }
interface LocationContent {
  clock_in?: LocationDetailsForEdit;
  lunch_start?: LocationDetailsForEdit;
  lunch_end?: LocationDetailsForEdit;
  clock_out?: LocationDetailsForEdit;
  [key: string]: LocationDetailsForEdit | undefined; // Allow dynamic access
}

// ✨ Interface for the raw data directly from the Supabase 'edit_requests' table
// Matches the database column names and types for this specific table.
interface RawEditRequestData {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  field: string; // Database stores 'clock_in', 'lunch_start', etc. as strings
  old_value: string | null;
  new_value: string;
  reason: string;
  created_at: string; // Database timestamp
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at: string | null;
  reviewed_by: string | null;
  // ✨ Column name is 'location' in the 'edit_requests' table
  location: Json | null; // Database column is named 'location', type is Json/JSONB
}

// Keep the EditRequest interface for mapped data used within the component
// This uses camelCase and the desired union type for the 'field' value
interface EditRequest {
  id: string;
  employeeId: string; // Mapped from employee_id
  employeeName: string; // Mapped from employee_name
  date: string;
  field: 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut'; // Mapped VALUE from DB field string
  oldValue: string; // Mapped from old_value
  newValue: string; // Mapped from new_value
  reason: string;
  timestamp: string; // Mapped from created_at
  status: 'pending' | 'approved' | 'rejected';
  // ✨ Property name is 'location' in the mapped data, but its content type is LocationContent
  location?: LocationContent | null;
}

// ✨ Interface for the raw data directly from the Supabase 'time_records' table
// Matches the database column names and types for this specific table.
interface RawTimeRecordData {
    id: string;
    user_id: string;
    date: string;
    clock_in: string | null;
    lunch_start: string | null;
    lunch_end: string | null;
    clock_out: string | null;
    // ✨ Column name is 'locations' in the 'time_records' table
    locations: Json | null; // Database column is named 'locations', type is Json/JSONB
    // Add other time_records columns as needed (e.g., created_at, updated_at, etc.)
}

interface GroupedRequest {
  employeeId: string;
  employeeName: string;
  date: string;
  requests: EditRequest[];
  timestamp: string;
}

interface PendingApprovalsProps {
  employees: Array<{
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'user';
    hourlyRate: number;
    overtimeRate: number;
  }>;
  onApprovalChange?: () => void;
}

const ITEMS_PER_PAGE = 10;

// Helper function to map database field names (snake_case strings) to camelCase used in the component
const mapFieldDbToCamelCase = (dbField: string): 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut' => {
  // ✨ MELHORADO: Se já estiver em camelCase, retorna diretamente
  const camelCaseFields = ['clockIn', 'lunchStart', 'lunchEnd', 'clockOut'];
  if (camelCaseFields.includes(dbField)) {
    return dbField as 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut';
  }
  
  // Se estiver em snake_case, converte para camelCase
  switch (dbField) {
    case 'clock_in': return 'clockIn';
    case 'lunch_start': return 'lunchStart';
    case 'lunch_end': return 'lunchEnd';
    case 'clock_out': return 'clockOut';
    default:
      console.error(`Campo inesperado do DB: ${dbField}`);
      // Fallback or handle error appropriately
      return 'clockIn'; // ✨ CORRIGIDO: retorna valor válido em vez de any
  }
};

// Helper function to map camelCase field names used in the component to database snake_case
const mapFieldCamelCaseToDb = (camelCaseField: 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut'): string => {
    switch (camelCaseField) {
        case 'clockIn': return 'clock_in';
        case 'lunchStart': return 'lunch_start';
        case 'lunchEnd': return 'lunch_end';
        case 'clockOut': return 'clock_out';
        // No default needed here as input type is a strict union
    }
};

// Função removida - não precisamos exibir email

// ✨ FUNÇÃO HELPER para conversão segura (versão melhorada)
const safeConvertToLocationContent = (jsonData: Json | null): LocationContent | null => {
  // Retorna null se não há dados
  if (!jsonData) {
    return null;
  }
  
  // Retorna null se não é um objeto válido
  if (typeof jsonData !== 'object' || Array.isArray(jsonData)) {
    return null;
  }
  
  try {
    // Conversão via unknown para evitar erros TypeScript
    const obj = jsonData as unknown as { [key: string]: any };
    const result: LocationContent = {};
    
    const validFields = ['clock_in', 'lunch_start', 'lunch_end', 'clock_out'];
    
    for (const field of validFields) {
      const fieldData = obj[field];
      
      // Verificar se o campo existe e é um objeto válido
      if (fieldData && 
          typeof fieldData === 'object' && 
          !Array.isArray(fieldData) &&
          fieldData !== null) {
        
        // Conversão mais segura via unknown
        result[field] = fieldData as unknown as LocationDetailsForEdit;
      }
    }
    
    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.error('Erro ao converter Json para LocationContent:', error);
    return null;
  }
};

const OptimizedPendingApprovals: React.FC<PendingApprovalsProps> = ({ employees, onApprovalChange }) => {
  const [message, setMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();

  // Query fetching raw data and mapping it to the component's interface
  const {
    data: editRequests = [], // Initialize with empty array
    isLoading,
    refetch
  } = useQuery<EditRequest[]>({ // Type the hook result as EditRequest[]
    queryKey: ['edit-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('edit_requests')
        // ✨ Select 'location' from edit_requests table
        .select('id, employee_id, employee_name, date, field, old_value, new_value, reason, created_at, status, reviewed_at, reviewed_by, location')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
          console.error('Error fetching edit requests:', error);
          throw error;
      }

      // Map raw database data (RawEditRequestData[]) to the component's EditRequest interface (EditRequest[])
      // ✨ Cast data to unknown first to bypass strictness before casting to RawEditRequestData[]
      return (data as unknown as RawEditRequestData[]).map(request => {
        // ✨ DEBUG: Log para verificar dados do banco
        console.log('🔍 DEBUG - OptimizedPendingApprovals:', {
          field_original: request.field,
          field_mapeado: mapFieldDbToCamelCase(request.field),
          employee_name: request.employee_name,
          location: request.location
        });

        return {
          id: request.id,
          employeeId: request.employee_id,
          employeeName: request.employee_name,
          date: request.date,
          field: mapFieldDbToCamelCase(request.field), // Use mapping function for field value conversion
          oldValue: request.old_value || '',
          newValue: request.new_value,
          reason: request.reason,
          timestamp: request.created_at,
          status: request.status,
          // ✨ CORRIGIDO: Usar função de conversão segura
          location: safeConvertToLocationContent(request.location),
        };
      });
    },
    staleTime: 10 * 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Real-time optimized with throttling
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const subscription = supabase
      .channel('edit_requests_throttled')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'edit_requests'
        },
        () => {
          // Throttling of 2 seconds
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['edit-requests'] });
          }, 2000);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // Memoized calculations with optimized dependencies
  const { pendingRequests, processedRequests, groupedPendingRequests } = useMemo(() => {
    // editRequests is now correctly typed as EditRequest[]
    const pending = editRequests.filter(r => r.status === 'pending');
    const processed = editRequests.filter(r => r.status !== 'pending');

    // Group pending requests more efficiently
    const groupsMap = new Map<string, GroupedRequest>();

    // This loop iterates over `pending`, which is correctly typed as EditRequest[]
    for (const request of pending) {
      const key = `${request.employeeId}-${request.date}`;

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          employeeId: request.employeeId,
          employeeName: request.employeeName,
          date: request.date,
          requests: [],
          timestamp: request.timestamp
        });
      }

      groupsMap.get(key)!.requests.push(request);
    }

    return {
      pendingRequests: pending,
      processedRequests: processed,
      groupedPendingRequests: Array.from(groupsMap.values())
    };
  }, [editRequests]); // Dependency is the correctly typed editRequests array

  // Pagination optimized
  const paginatedProcessedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [processedRequests, currentPage]);

  const totalPages = Math.ceil(processedRequests.length / ITEMS_PER_PAGE);

  // Handler optimized with callback
  const handleGroupApproval = useCallback(async (group: GroupedRequest, approved: boolean) => {
    try {
      const requestIds = group.requests.map(r => r.id);

      // Get the current user's ID
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const reviewerId = user?.id || null; // Use null if user or id is undefined

      // Batch update edit_requests status
      // This update uses database column names (snake_case)
      const { error: updateError } = await supabase
        .from('edit_requests')
        .update({
          status: approved ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewerId // Pass the user ID (string | null)
        })
        .in('id', requestIds); // Filter rows by ID

      if (updateError) throw updateError;

      if (approved) {
        console.log('🔍 DEBUG: Aprovando solicitações para', group.employeeName, 'data:', group.date);
        
        // Fetch existing time record efficiently, including current locations
        const { data: timeRecord, error: fetchError } = await supabase
          .from('time_records')
          .select('id, locations')
          .eq('user_id', group.employeeId)
          .eq('date', group.date)
          .maybeSingle<RawTimeRecordData>();

        if (fetchError) throw fetchError;
        
        console.log('🔍 DEBUG: Registro existente:', timeRecord);

        // Prepare update data for time_records
        const updateData: any = {};
        // ✨ CORRIGIDO: Usar conversão segura para LocationContent
        let mergedLocationContent: LocationContent = safeConvertToLocationContent(timeRecord?.locations) || {};
        
        console.log('🔍 DEBUG: Localizações existentes:', mergedLocationContent);

        for (const request of group.requests) {
          const dbFieldName = mapFieldCamelCaseToDb(request.field);
          
          console.log('🔍 DEBUG: Processando request OptimizedPendingApprovals:', {
            field: request.field,
            dbFieldName,
            location: request.location,
            newValue: request.newValue,
            locationForField: request.location?.[dbFieldName]
          });

          // Add the new time value
          updateData[dbFieldName] = request.newValue;

          // Se a solicitação tem dados de localização, extraia o valor correto
          if (request.location && request.location[dbFieldName]) {
            mergedLocationContent[dbFieldName] = request.location[dbFieldName];
            console.log('🔍 DEBUG: Adicionando localização para', dbFieldName, ':', request.location[dbFieldName]);
          } else {
            console.log('⚠️ DEBUG: Nenhuma localização encontrada para', dbFieldName);
          }
        }

        console.log('🔍 DEBUG: Localizações mescladas finais:', mergedLocationContent);
        
        // Add the merged location content object to the update data
        updateData.locations = Object.keys(mergedLocationContent).length > 0 ? mergedLocationContent : null;
        
        console.log('🔍 DEBUG: Dados finais do update:', updateData);

        if (timeRecord) {
          // Update existing record
          console.log('🔍 DEBUG: Atualizando registro existente ID:', timeRecord.id);
          const { error: updateRecordError } = await supabase
            .from('time_records')
            .update(updateData)
            .eq('id', timeRecord.id);

          if (updateRecordError) {
            console.error('❌ DEBUG: Erro ao atualizar registro:', updateRecordError);
            throw updateRecordError;
          }
          console.log('✅ DEBUG: Registro atualizado com sucesso');
        } else {
          // Create new record
          console.log('🔍 DEBUG: Criando novo registro');
          const { error: insertError } = await supabase
            .from('time_records')
            .insert({
              user_id: group.employeeId,
              date: group.date,
              ...updateData,
            });

          if (insertError) {
            console.error('❌ DEBUG: Erro ao inserir registro:', insertError);
            throw insertError;
          }
          console.log('✅ DEBUG: Novo registro criado com sucesso');
        }

        setMessage(`Edições aprovadas para ${group.employeeName}`);
      } else {
        setMessage(`Edições rejeitadas para ${group.employeeName}`);
      }

      // Invalidate cache to refetch updated data
      queryClient.invalidateQueries({
        queryKey: ['edit-requests'],
        exact: true
      });

      // Call callback if provided
      if (onApprovalChange) {
        onApprovalChange();
      }

      // Auto-clear message after a delay
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error handling group approval:', error);
      setMessage('Erro ao processar aprovação');
      setTimeout(() => setMessage(''), 3000);
    }
  }, [queryClient, onApprovalChange]); // Added onApprovalChange as dependency

  // Memoized field label function
  const getFieldLabel = useCallback((field: 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut') => {
    const labels = {
      clockIn: 'Entrada',
      lunchStart: 'Início do Almoço',
      lunchEnd: 'Fim do Almoço',
      clockOut: 'Saída'
    };
    return labels[field]; // field is now guaranteed to be one of the keys
  }, []);

  // ✨ FUNÇÃO para obter localização específica do campo
  const getFieldLocation = useCallback((request: EditRequest): string => {
    if (!request.location) return 'N/A';
    
    const dbFieldName = mapFieldCamelCaseToDb(request.field);
    const locationData = request.location[dbFieldName];
    
    return locationData?.locationName || 'N/A';
  }, []);

  // ✨ FUNÇÃO para calcular total de horas trabalhadas dos novos horários
  const calculateWorkingHours = useCallback((group: GroupedRequest): number => {
    // Organizar os horários por tipo
    const times: { [key: string]: string } = {};
    
    group.requests.forEach(request => {
      if (request.newValue) {
        times[request.field] = request.newValue;
      }
    });

    try {
      const clockIn = times.clockIn;
      const lunchStart = times.lunchStart;
      const lunchEnd = times.lunchEnd;
      const clockOut = times.clockOut;

      let totalHours = 0;

      // Calcular horas da manhã (entrada até início do almoço)
      if (clockIn && lunchStart) {
        const [inHour, inMin] = clockIn.split(':').map(Number);
        const [lunchStartHour, lunchStartMin] = lunchStart.split(':').map(Number);
        
        const inMinutes = inHour * 60 + inMin;
        const lunchStartMinutes = lunchStartHour * 60 + lunchStartMin;
        
        if (lunchStartMinutes > inMinutes) {
          totalHours += (lunchStartMinutes - inMinutes) / 60;
        }
      }

      // Calcular horas da tarde (fim do almoço até saída)
      if (lunchEnd && clockOut) {
        const [lunchEndHour, lunchEndMin] = lunchEnd.split(':').map(Number);
        const [outHour, outMin] = clockOut.split(':').map(Number);
        
        const lunchEndMinutes = lunchEndHour * 60 + lunchEndMin;
        const outMinutes = outHour * 60 + outMin;
        
        if (outMinutes > lunchEndMinutes) {
          totalHours += (outMinutes - lunchEndMinutes) / 60;
        }
      }

      // Se não tem horário de almoço, calcular direto entrada até saída
      if (clockIn && clockOut && (!lunchStart || !lunchEnd)) {
        const [inHour, inMin] = clockIn.split(':').map(Number);
        const [outHour, outMin] = clockOut.split(':').map(Number);
        
        const inMinutes = inHour * 60 + inMin;
        const outMinutes = outHour * 60 + outMin;
        
        if (outMinutes > inMinutes) {
          totalHours = (outMinutes - inMinutes) / 60;
        }
      }

      return totalHours;
    } catch {
      return 0;
    }
  }, []);

  // ✨ FUNÇÃO para obter localização específica do campo
  const getFieldLocation = useCallback((request: EditRequest): string => {
    if (!request.location) return 'N/A';
    
    const dbFieldName = mapFieldCamelCaseToDb(request.field);
    const locationData = request.location[dbFieldName];
    
    return locationData?.locationName || 'N/A';
  }, []);

  // ✨ FUNÇÃO para calcular diferença de horas
  const calculateTimeDifference = useCallback((oldTime: string, newTime: string): number => {
    if (!oldTime || !newTime) return 0;
    
    try {
      const [oldHour, oldMin] = oldTime.split(':').map(Number);
      const [newHour, newMin] = newTime.split(':').map(Number);
      
      const oldMinutes = oldHour * 60 + oldMin;
      const newMinutes = newHour * 60 + newMin;
      
      return Math.abs(newMinutes - oldMinutes) / 60; // Retorna em horas
    } catch {
      return 0;
    }
  }, []);

  // ✨ FUNÇÃO para calcular total de horas trabalhadas dos novos horários
  const calculateWorkingHours = useCallback((group: GroupedRequest): number => {
    // Organizar os horários por tipo
    const times: { [key: string]: string } = {};
    
    group.requests.forEach(request => {
      if (request.newValue) {
        times[request.field] = request.newValue;
      }
    });

    try {
      const clockIn = times.clockIn;
      const lunchStart = times.lunchStart;
      const lunchEnd = times.lunchEnd;
      const clockOut = times.clockOut;

      let totalHours = 0;

      // Calcular horas da manhã (entrada até início do almoço)
      if (clockIn && lunchStart) {
        const [inHour, inMin] = clockIn.split(':').map(Number);
        const [lunchStartHour, lunchStartMin] = lunchStart.split(':').map(Number);
        
        const inMinutes = inHour * 60 + inMin;
        const lunchStartMinutes = lunchStartHour * 60 + lunchStartMin;
        
        if (lunchStartMinutes > inMinutes) {
          totalHours += (lunchStartMinutes - inMinutes) / 60;
        }
      }

      // Calcular horas da tarde (fim do almoço até saída)
      if (lunchEnd && clockOut) {
        const [lunchEndHour, lunchEndMin] = lunchEnd.split(':').map(Number);
        const [outHour, outMin] = clockOut.split(':').map(Number);
        
        const lunchEndMinutes = lunchEndHour * 60 + lunchEndMin;
        const outMinutes = outHour * 60 + outMin;
        
        if (outMinutes > lunchEndMinutes) {
          totalHours += (outMinutes - lunchEndMinutes) / 60;
        }
      }

      // Se não tem horário de almoço, calcular direto entrada até saída
      if (clockIn && clockOut && (!lunchStart || !lunchEnd)) {
        const [inHour, inMin] = clockIn.split(':').map(Number);
        const [outHour, outMin] = clockOut.split(':').map(Number);
        
        const inMinutes = inHour * 60 + inMin;
        const outMinutes = outHour * 60 + outMin;
        
        if (outMinutes > inMinutes) {
          totalHours = (outMinutes - inMinutes) / 60;
        }
      }

      return totalHours;
    } catch {
      return 0;
    }
  }, []);

  // ✨ FUNÇÃO para calcular total de horas ajustadas de um grupo (mantida para diferenças individuais)
  const calculateGroupTotalHours = useCallback((group: GroupedRequest): number => {
    return group.requests.reduce((total, request) => {
      return total + calculateTimeDifference(request.oldValue, request.newValue);
    }, 0);
  }, [calculateTimeDifference]);

  // Loading optimized
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <Alert className="border-accent-200 bg-accent-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-accent-800">
            {message}
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Requests Optimized */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Solicitações Pendentes ({groupedPendingRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {groupedPendingRequests.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Nenhuma solicitação pendente
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {groupedPendingRequests.map((group) => (
                <div key={`${group.employeeId}-${group.date}`} className="border rounded-lg p-3 bg-yellow-50 border-yellow-200">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 text-sm truncate">{group.employeeName}</h4>
                      <p className="text-xs text-gray-600">
                        {new Date(group.date).toLocaleDateString('pt-BR')} - {group.requests.length} ajuste(s)
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {new Date(group.timestamp).toLocaleDateString('pt-BR')}
                      </Badge>
                      {/* ✨ Total de horas trabalhadas dos novos horários - mais compacto */}
                      <div className="bg-blue-100 px-2 py-1 rounded text-xs text-blue-800 font-semibold">
                        ⏱️ {calculateWorkingHours(group).toFixed(1)}h
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <h5 className="font-medium mb-2 text-sm">Ajustes:</h5>
                    <div className="space-y-2">
                      {group.requests.map((request) => (
                        <div key={request.id} className="text-xs border rounded p-2 bg-white">
                          <div className="font-medium flex justify-between items-center mb-1">
                            <span>{getFieldLabel(request.field)}</span>
                            <span className="text-xs text-green-600 bg-green-50 px-1 py-0.5 rounded font-semibold">
                              {request.newValue || 'Vazio'}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-red-600">De: {request.oldValue || 'Vazio'}</span>
                            <span className="text-green-600">Para: {request.newValue}</span>
                          </div>
                          <div className="text-xs text-gray-600 truncate" title={getFieldLocation(request)}>
                            📍 {getFieldLocation(request)}
                          </div>
                          {request.reason && (
                            <div className="text-xs text-gray-600 mt-1 truncate" title={request.reason}>
                              💬 {request.reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleGroupApproval(group, true)}
                      className="bg-green-600 hover:bg-green-700 flex-1 text-xs"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleGroupApproval(group, false)}
                      className="flex-1 text-xs"
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Optimized */}
      {processedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Histórico</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    {currentPage}/{totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Funcionário
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Campo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Alteração
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Data
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedProcessedRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.employeeName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getFieldLabel(request.field)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.oldValue || 'Vazio'} → {request.newValue}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={request.status === 'approved' ? 'default' : 'destructive'}>
                          {request.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(request.timestamp).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OptimizedPendingApprovals;