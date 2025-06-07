import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight, User, CalendarDays, Tag, Text, MapPin } from 'lucide-react'; // Added icons for details
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Json } from '@/types/supabase'; // Ensure this path and type are correct


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


// Interface for the raw data directly from the Supabase 'edit_requests' table
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
  // Column name is 'location' in the 'edit_requests' table
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
  // Property name is 'location' in the mapped data, but its content type is LocationContent
  location?: LocationContent | null;
}


// Interface for the raw data directly from the Supabase 'time_records' table
interface RawTimeRecordData {
    id: string;
    user_id: string; // Assuming 'user_id' in time_records corresponds to 'employee_id'
    date: string;
    clock_in: string | null;
    lunch_start: string | null;
    lunch_end: string | null;
    clock_out: string | null;
    // Column name is 'locations' in the 'time_records' table
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
  switch (dbField) {
    case 'clock_in': return 'clockIn';
    case 'lunch_start': return 'lunchStart';
    case 'lunch_end': return 'lunchEnd';
    case 'clock_out': return 'clockOut';
    default:
      console.error(`Unexpected field value from DB: ${dbField}`);
      // Fallback or handle error appropriately - returning as any might cause issues if not one of the expected values
      return dbField as any; // Consider a safer fallback or error handling
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
        // Select 'location' from edit_requests table
        .select('id, employee_id, employee_name, date, field, old_value, new_value, reason, created_at, status, reviewed_at, reviewed_by, location')
        .order('created_at', { ascending: false })
        .limit(50); // Consider pagination for fetching if there are many requests




      if (error) {
          console.error('Error fetching edit requests:', error);
          throw error;
      }


      // Map raw database data (RawEditRequestData[]) to the component's EditRequest interface (EditRequest[])
      // Cast data to unknown first to bypass strictness before casting to RawEditRequestData[]
      return (data as unknown as RawEditRequestData[]).map(request => ({
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
        // Map 'location' from RawEditRequestData to 'location' in EditRequest, casting content type
        location: request.location as unknown as LocationContent | null,
      }));
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
          timestamp: request.timestamp // Or use the earliest/latest request timestamp in the group
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
      console.log('🚀 Processando:', group.employeeName, 'Aprovação:', approved);


      const requestIds = group.requests.map(r => r.id);


      // Obter usuário logado para registrar quem revisou
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }
      const reviewerId = user.id;


      // --- Lógica para Aprovação ---
      if (approved) {
        console.log('✅ Aprovando solicitações para:', group.employeeName, group.date);


        // 1. Buscar o registro existente em time_records para esta data e funcionário
        const { data: existingTimeRecord, error: fetchTimeRecordError } = await supabase
          .from('time_records')
          .select('id, clock_in, lunch_start, lunch_end, clock_out, locations')
          .eq('user_id', group.employeeId) // Use user_id as per RawTimeRecordData interface
          .eq('date', group.date)
          .maybeSingle<RawTimeRecordData>();


        if (fetchTimeRecordError) {
          console.error('Erro ao buscar registro existente:', fetchTimeRecordError);
          throw new Error(`Erro ao buscar registro de ponto: ${fetchTimeRecordError.message}`);
        }


        console.log('🔍 DEBUG: Registro existente encontrado:', existingTimeRecord);


        // 2. Preparar os dados para atualizar/inserir em time_records
        const timeRecordDataToSave: any = {
          user_id: group.employeeId,
          date: group.date,
          // Start with existing values if updating, otherwise null
          clock_in: existingTimeRecord?.clock_in || null,
          lunch_start: existingTimeRecord?.lunch_start || null,
          lunch_end: existingTimeRecord?.lunch_end || null,
          clock_out: existingTimeRecord?.clock_out || null,
          // Start with existing locations if updating, otherwise an empty object
          locations: (existingTimeRecord?.locations as unknown as LocationContent) || {},
        };


        console.log('🔍 DEBUG: Dados iniciais para salvar:', timeRecordDataToSave);


        // Merge approved request values and locations into the data object
        for (const request of group.requests) {
          const dbFieldName = mapFieldCamelCaseToDb(request.field);
          timeRecordDataToSave[dbFieldName] = request.newValue; // Update time value


          // If the request has location data for this field, merge it
          if (request.location && request.location[dbFieldName]) {
            timeRecordDataToSave.locations[dbFieldName] = request.location[dbFieldName];
            console.log(`🔍 DEBUG: Mesclando localização para ${dbFieldName}:`, request.location[dbFieldName]);
          } else {
            console.log(`⚠️ DEBUG: Nenhuma localização na solicitação para ${dbFieldName}`);
          }
        }


        // Ensure locations is null if it's an empty object after merging
        if (Object.keys(timeRecordDataToSave.locations).length === 0) {
          timeRecordDataToSave.locations = null;
        }


        console.log('🔍 DEBUG: Dados finais para salvar em time_records:', timeRecordDataToSave);


        // 3. Inserir ou Atualizar o registro em time_records
        let timeRecordOperationError = null;


        if (existingTimeRecord) {
          // Update existing record
          console.log('🔍 DEBUG: Atualizando registro existente ID:', existingTimeRecord.id);
          const { error } = await supabase
            .from('time_records')
            .update(timeRecordDataToSave)
            .eq('id', existingTimeRecord.id);
          timeRecordOperationError = error;
          console.log('🔍 DEBUG: Resultado do update:', { error });


        } else {
          // Create new record
          console.log('🔍 DEBUG: Criando novo registro');
          const { error } = await supabase
            .from('time_records')
            .insert(timeRecordDataToSave);
          timeRecordOperationError = error;
          console.log('🔍 DEBUG: Resultado do insert:', { error });
        }


        // Check for errors *after* the time_records operation
        if (timeRecordOperationError) {
          console.error('❌ Erro na operação time_records:', timeRecordOperationError);
          // Throw the error to be caught by the outer catch block
          throw new Error(`Erro ao salvar registro de ponto: ${timeRecordOperationError.message}`);
        }


        console.log('✅ Operação time_records bem-sucedida.');


        // 4. Se time_records foi bem-sucedido, atualizar o status das edit_requests
        console.log('🔍 DEBUG: Atualizando status das edit_requests para approved');
        const { error: updateRequestsError } = await supabase
          .from('edit_requests')
          .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: reviewerId
          })
          .in('id', requestIds);


        if (updateRequestsError) {
          console.error('❌ Erro ao atualizar status das edit_requests:', updateRequestsError);
          // Even if this fails, the time_record was updated, but we should still report the error
          throw new Error(`Erro ao finalizar solicitações de edição: ${updateRequestsError.message}`);
        }


        console.log('✅ Status das edit_requests atualizado para approved.');
        setMessage(`✅ Solicitações de ${group.employeeName} para ${new Date(group.date).toLocaleDateString('pt-BR')} aprovadas com sucesso.`);


      } else {
        // --- Lógica para Rejeição ---
        console.log('❌ Rejeitando solicitações:', requestIds);
        const { error: rejectError } = await supabase
          .from('edit_requests')
          .update({
            status: 'rejected',
            reviewed_at: new Date().toISOString(),
            reviewed_by: reviewerId
          })
          .in('id', requestIds);


        if (rejectError) {
          console.error('Erro ao rejeitar solicitações:', rejectError);
          throw new Error(`❌ Erro ao rejeitar solicitações: ${rejectError.message}`);
        }


        console.log('✅ Solicitações rejeitadas com sucesso.');
        setMessage(`✅ Solicitações de ${group.employeeName} para ${new Date(group.date).toLocaleDateString('pt-BR')} rejeitadas com sucesso.`);
      }


      // Invalidate cache to refetch updated data regardless of approval/rejection
      queryClient.invalidateQueries({ queryKey: ['edit-requests'] });
      // Invalidate time_records and hour_bank queries as they might be affected by the trigger
      queryClient.invalidateQueries({ queryKey: ['time-records'] }); // Assuming a time-records query key
      queryClient.invalidateQueries({ queryKey: ['hour-bank'] }); // Assuming an hour-bank query key


      if (onApprovalChange) {
        onApprovalChange();
      }


      // Auto-clear message after a delay
      setTimeout(() => setMessage(''), 5000); // Increased delay for message visibility


    } catch (error: any) {
      console.error('Erro no processo de aprovação/rejeição:', error);
      setMessage(`❌ Erro ao processar: ${error.message}`);
      // Keep error message visible longer or require dismissal
      // setTimeout(() => setMessage(''), 5000);
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
  }, []); // No dependencies needed as labels are static


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
        <Alert className={`border ${message.startsWith('✅') ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}`}>
          {message.startsWith('✅') ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
          <AlertDescription className={`${message.startsWith('✅') ? 'text-green-800' : 'text-red-800'}`}>
            {message}
          </AlertDescription>
        </Alert>
      )}


      {/* Pending Requests - Compact Card Layout */}
      <Card>
        <CardHeader className="pb-3"> {/* Reduced padding */}
          <CardTitle className="flex items-center gap-2 text-lg"> {/* Reduced title size */}
            <Clock className="w-5 h-5" />
            Solicitações Pendentes ({groupedPendingRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0"> {/* Reduced padding */}
          {groupedPendingRequests.length === 0 ? (
            <p className="text-gray-500 text-center py-6 text-sm"> {/* Reduced padding and text size */}
              Nenhuma solicitação pendente
            </p>
          ) : (
            <div className="space-y-3"> {/* Reduced space */}
              {groupedPendingRequests.map((group) => (
                <div key={`${group.employeeId}-${group.date}`} className="border rounded-md p-3 bg-yellow-50 border-yellow-200 text-sm"> {/* Reduced padding, border radius, and text size */}
                  <div className="flex justify-between items-center mb-2"> {/* Reduced margin */}
                    <div>
                      <h4 className="font-medium text-gray-900 flex items-center gap-1"> {/* Added flex and gap */}
                        <User className="w-3 h-3" /> {group.employeeName}
                      </h4>
                      <p className="text-xs text-gray-600 flex items-center gap-1"> {/* Reduced text size, added flex and gap */}
                        <CalendarDays className="w-3 h-3" /> {new Date(group.date).toLocaleDateString('pt-BR')} - {group.requests.length} ajuste(s)
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs"> {/* Reduced badge text size */}
                      {new Date(group.timestamp).toLocaleDateString('pt-BR')}
                    </Badge>
                  </div>


                  <div className="mb-2"> {/* Reduced margin */}
                    <h5 className="font-medium mb-1 text-xs">Ajustes:</h5> {/* Reduced text size and margin */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"> {/* Reduced gap, adjusted grid for smaller screens */}
                      {group.requests.map((request) => (
                        <div key={request.id} className="text-xs border rounded p-2 bg-white space-y-0.5"> {/* Reduced padding, border radius, text size, and space */}
                          <div className="font-medium flex items-center gap-1"><Tag className="w-3 h-3" /> {getFieldLabel(request.field)}</div> {/* Use getFieldLabel, added icon */}
                          <div className="flex justify-between text-xs"> {/* Reduced text size */}
                            <span className="text-red-600">De: {request.oldValue || 'Vazio'}</span>
                            <span className="text-green-600">Para: {request.newValue}</span>
                          </div>
                          {/* Display location if available in the request */}
                          {request.location && request.location[mapFieldCamelCaseToDb(request.field)] && (
                              <div className="text-xs text-gray-600 flex items-start gap-1"> {/* Reduced text size, added flex */}
                                <MapPin className="w-3 h-3 mt-0.5" />
                                <span className="flex-1">Localização: {request.location[mapFieldCamelCaseToDb(request.field)]?.locationName || 'N/A'}</span>
                              </div>
                          )}
                          {request.reason && (
                            <div className="text-xs text-gray-600 flex items-start gap-1"> {/* Reduced text size, added flex */}
                              <Text className="w-3 h-3 mt-0.5" />
                              <span className="flex-1">Motivo: {request.reason}</span>
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
                      className="bg-green-600 hover:bg-green-700 text-xs h-7 px-2" // Reduced size and padding
                    >
                      <CheckCircle className="w-3 h-3 mr-1" /> {/* Reduced icon size */}
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleGroupApproval(group, false)}
                      className="text-xs h-7 px-2" // Reduced size and padding
                    >
                      <XCircle className="w-3 h-3 mr-1" /> {/* Reduced icon size */}
                      Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>


      {/* History - Compact Card Layout */}
      {processedRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-3"> {/* Reduced padding */}
            <CardTitle className="flex items-center justify-between text-lg"> {/* Reduced title size */}
              <span>Histórico</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="h-7 px-2" // Reduced button size
                  >
                    <ChevronLeft className="w-3 h-3" /> {/* Reduced icon size */}
                  </Button>
                  <span className="text-xs text-gray-600"> {/* Reduced text size */}
                    {currentPage}/{totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="h-7 px-2" // Reduced button size
                  >
                    <ChevronRight className="w-3 h-3" /> {/* Reduced icon size */}
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0"> {/* Reduced padding */}
            <div className="space-y-3"> {/* Reduced space */}
              {paginatedProcessedRequests.map((request) => (
                <div key={request.id} className="border rounded-md p-3 bg-gray-50 border-gray-200 text-sm"> {/* Compact card styling */}
                  <div className="flex justify-between items-center mb-2"> {/* Reduced margin */}
                    <div>
                      <h4 className="font-medium text-gray-900 flex items-center gap-1"> {/* Added flex and gap */}
                        <User className="w-3 h-3" /> {request.employeeName}
                      </h4>
                      <p className="text-xs text-gray-600 flex items-center gap-1"> {/* Reduced text size, added flex and gap */}
                        <CalendarDays className="w-3 h-3" /> {new Date(request.date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <Badge
                      variant={request.status === 'approved' ? 'default' : 'destructive'}
                      className="text-xs flex items-center gap-1" // Reduced text size, added flex and gap
                    >
                      {request.status === 'approved' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {request.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                    </Badge>
                  </div>


                  <div className="text-xs space-y-0.5"> {/* Reduced text size and space */}
                    <div className="flex items-center gap-1 font-medium text-gray-800"> {/* Added flex and gap */}
                      <Tag className="w-3 h-3" /> Campo: {getFieldLabel(request.field)}
                    </div>
                    <div className="flex justify-between text-xs"> {/* Reduced text size */}
                      <span className="text-red-600">De: {request.oldValue || 'Vazio'}</span>
                      <span className="text-green-600">Para: {request.newValue}</span>
                    </div>
                    {/* Display location if available in the request */}
                    {request.location && request.location[mapFieldCamelCaseToDb(request.field)] && (
                        <div className="text-xs text-gray-600 flex items-start gap-1"> {/* Reduced text size, added flex */}
                          <MapPin className="w-3 h-3 mt-0.5" />
                          <span className="flex-1">Localização: {request.location[mapFieldCamelCaseToDb(request.field)]?.locationName || 'N/A'}</span>
                        </div>
                    )}
                    {request.reason && (
                        <div className="text-xs text-gray-600 flex items-start gap-1"> {/* Reduced text size, added flex */}
                          <Text className="w-3 h-3 mt-0.5" />
                          <span className="flex-1">Motivo: {request.reason}</span>
                        </div>
                    )}
                  </div>
                  <p className="text-right text-xs text-gray-500 mt-2"> {/* Reduced text size and margin */}
                    Solicitado em: {new Date(request.timestamp).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pb-4"> {/* Added padding */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="h-7 px-2" // Reduced button size
              >
                <ChevronLeft className="w-3 h-3" /> {/* Reduced icon size */}
              </Button>
              <span className="text-xs text-gray-600"> {/* Reduced text size */}
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="h-7 px-2" // Reduced button size
              >
                <ChevronRight className="w-3 h-3" /> {/* Reduced icon size */}
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};


export default OptimizedPendingApprovals;
