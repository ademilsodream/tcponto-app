import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
// VERIFIQUE E CORRIJA ESTE CAMINHO DE IMPORTAÇÃO SE NECESSÁRIO
import { useAuth } from '@/contexts/Auth/AuthContext';
import { Json } from '@/integrations/supabase/types'; // Importar Json type

// Interface para o objeto JSON de localização que será salvo DENTRO da chave do campo (ex: "clock_in": {...})
interface LocationDetailsForEdit {
  address: string | null;
  distance: number | null; // Pode ser nulo para edições manuais
  latitude: number | null;
  longitude: number | null;
  timestamp: string; // Timestamp da solicitação de edição
  locationName: string | null; // Pode ser nulo
}

// Interface para a estrutura esperada na coluna location do edit_requests
// Ex: { "clock_in": { ...LocationDetailsForEdit... } }
interface EditRequestLocation {
  clock_in?: LocationDetailsForEdit;
  lunch_start?: LocationDetailsForEdit;
  lunch_end?: LocationDetailsForEdit;
  clock_out?: LocationDetailsForEdit;
  [key: string]: LocationDetailsForEdit | undefined; // Para permitir acesso dinâmico
}

// Interface para a estrutura esperada na coluna locations do time_records (plural)
interface TimeRecordLocationsData {
  clock_in?: LocationDetailsForEdit;
  lunch_start?: LocationDetailsForEdit;
  lunch_end?: LocationDetailsForEdit;
  clock_out?: LocationDetailsForEdit;
  [key: string]: LocationDetailsForEdit | undefined; // Para permitir acesso dinâmico
}


interface EditRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  field: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out';
  old_value: string | null;
  new_value: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  // CORRIGIDO: Usar nomes de coluna do Supabase
  created_at: string; // Era requested_at
  reviewed_at: string | null; // Era processed_at
  reviewed_by: string | null; // Era processed_by
  // Adicionado a coluna location da tabela edit_requests
  location: Json | null; // Supabase Json type is 'any'
}

interface TimeRecord {
  id: string;
  user_id: string;
  date: string;
  clock_in: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  clock_out: string | null;
  total_hours: number | null;
  normal_hours?: number | null;
  overtime_hours?: number | null;
  normal_pay?: number | null;
  overtime_pay?: number | null;
  total_pay?: number | null;
  // A coluna locations na tabela time_records (plural)
  locations: Json | null; // Supabase Json type is 'any'
  created_at?: string;
  updated_at?: string;
  status?: string;
  is_pending_approval?: boolean;
  approved_by?: string;
  approved_at?: string;
}


const PAGE_SIZE = 10;

const OptimizedPendingApproval = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth(); // Assume useAuth provides the current user

  const [currentPage, setCurrentPage] = useState(0);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const fieldNames: Record<EditRequest['field'], string> = useMemo(() => ({
    clock_in: 'Entrada',
    lunch_start: 'Início do Almoço',
    lunch_end: 'Fim do Almoço',
    clock_out: 'Saída'
  }), []);

  const { data: requests, isLoading, error, refetch } = useQuery<EditRequest[]>({
    queryKey: ['editRequests', filterStatus],
    queryFn: async () => {
      console.log(`Fetching requests with status: ${filterStatus}`);
      const { data, error } = await supabase
        .from('edit_requests')
        .select('*')
        .eq('status', filterStatus)
        // CORRIGIDO: Usar created_at
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Fetch error:", error);
        throw error;
      }

      // LOG 1: Dados buscados do Supabase
      console.log('LOG 1: Fetched edit_requests:', data);

      // DEBUG: Log location data for each fetched request
      data?.forEach(req => {
          console.log(`DEBUG: Request ID ${req.id}, Field: ${req.field}, Raw location data:`, req.location);
      });


      return data || [];
    },
    refetchInterval: 60000, // Refetch every 60 seconds
  });

  // Use useMemo para agrupar as requisições por funcionário e data
  const groupedRequests = useMemo(() => {
    if (!requests) return {};
    const groups: { [key: string]: EditRequest[] } = {};
    requests.forEach(req => {
      // Use created_at para a chave de agrupamento se requested_at não existir na interface
      const key = `${req.employee_id}-${req.date}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(req);
    });
    console.log('LOG 2: Grouped pending requests:', groups); // LOG 2: Grupos de solicitações
    return groups;
  }, [requests]);


  const paginatedGroups = useMemo(() => {
    const groupKeys = Object.keys(groupedRequests);
    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return groupKeys.slice(start, end).reduce((obj, key) => {
      obj[key] = groupedRequests[key];
      return obj;
    }, {} as { [key: string]: EditRequest[] });
  }, [groupedRequests, currentPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(Object.keys(groupedRequests).length / PAGE_SIZE);
  }, [groupedRequests]);

  const handlePageChange = useCallback((direction: 'prev' | 'next') => {
    setCurrentPage(prev => {
      if (direction === 'prev') return Math.max(0, prev - 1);
      if (direction === 'next') return Math.min(totalPages - 1, prev + 1);
      return prev;
    });
  }, [totalPages]);

  const handleApproveGroup = useCallback(async (groupKey: string) => {
    if (!user) {
      toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
      return;
    }

    const requestsToProcess = groupedRequests[groupKey];
    if (!requestsToProcess || requestsToProcess.length === 0) return;

    console.log(`Processing approval for group: ${groupKey}`);

    const updates = requestsToProcess.map(req => ({
      id: req.id,
      status: 'approved',
      // CORRIGIDO: Usar reviewed_at e reviewed_by
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    }));

    // Start transaction or use a function if possible for atomicity
    const { error: updateRequestsError } = await supabase
      .from('edit_requests')
      .upsert(updates); // Use upsert to update by ID

    if (updateRequestsError) {
      console.error("Error updating edit_requests status:", updateRequestsError);
      toast({
        title: "Erro",
        description: `Erro ao atualizar status das solicitações: ${updateRequestsError.message}`,
        variant: "destructive"
      });
      return;
    }

    // --- Lógica para atualizar time_records e mesclar localizações ---
    const firstRequest = requestsToProcess[0]; // Use any request from the group for user_id and date
    const userId = firstRequest.employee_id;
    const date = firstRequest.date;

    try {
      // 1. Buscar o registro time_records existente para mesclar
      console.log(`LOG 3: Fetching time_record for user ${userId} on date ${date}`);
      const { data: existingTimeRecord, error: fetchRecordError } = await supabase
        .from('time_records')
        .select('id, clock_in, lunch_start, lunch_end, clock_out, locations') // Selecionar a coluna locations
        .eq('user_id', userId)
        .eq('date', date)
        .single();

      console.log('LOG 4: Fetched time_record for merging:', existingTimeRecord); // LOG 4: Registro time_records buscado

      if (fetchRecordError && fetchRecordError.code !== 'PGRST116') { // PGRST116 means not found
        throw fetchRecordError;
      }

      // Ensure existing locations is treated as a plain object, even if null initially
      let mergedLocations: TimeRecordLocationsData = (existingTimeRecord?.locations as TimeRecordLocationsData) || {};
      let updateData: any = {}; // Data to update time_records

      console.log('LOG 5: Initial mergedLocations:', mergedLocations); // LOG 5: Objeto de localizações inicial

      // 2. Iterar sobre as solicitações aprovadas e mesclar os novos valores e localizações
      for (const request of requestsToProcess) {
          // Adicionar o novo valor do campo
          updateData[request.field] = request.new_value;

          // Mesclar a localização, se existir na solicitação
          // Verifica se request.location não é null e é um objeto
          if (request.location && typeof request.location === 'object' && request.location !== null) {
              try {
                  // Treat request.location as a generic object initially for safer access
                  const requestLocationObj = request.location as Record<string, LocationDetailsForEdit>;
                   console.log(`LOG 6a: Processing location for field ${request.field}. Raw request.location:`, request.location);
                   console.log(`LOG 6b: request.location treated as object:`, requestLocationObj);

                  // Access the specific location details for the edited field
                  const specificLocationDetails = requestLocationObj[request.field];

                  console.log(`LOG 6c: Specific location details for ${request.field}:`, specificLocationDetails);

                  if (specificLocationDetails) {
                      // Mesclar a localização específica no objeto mergedLocations
                      mergedLocations[request.field] = specificLocationDetails;
                      console.log(`LOG 6d: Merged location for ${request.field}. Current mergedLocations:`, mergedLocations);
                  } else {
                      console.log(`LOG 6e: No specific location details found for field ${request.field} in request.location object.`);
                  }
              } catch (parseError) {
                  console.error(`LOG 6f: Error processing location JSON for request ID ${request.id}:`, parseError);
                  // Decide how to handle parse errors - maybe skip this location?
              }
          } else {
               console.log(`LOG 6g: request.location is null, not an object, or empty for request ID ${request.id}, field ${request.field}. Value:`, request.location);
          }
      }

      // Adicionar o objeto de localizações mescladas aos dados de atualização
      // Certifique-se de que mergedLocations não é um objeto vazio se não houver localizações para mesclar
      if (Object.keys(mergedLocations).length > 0) {
           updateData.locations = mergedLocations;
           console.log('LOG 7: Final updateData including merged locations:', updateData); // LOG 7: Dados finais de atualização
      } else {
           // Se não houver localizações para mesclar, talvez você queira garantir que 'locations'
           // no time_records seja null ou um objeto vazio, dependendo da lógica.
           // Se existingTimeRecord.locations era null e nenhuma nova localização foi mesclada,
           // não precisamos adicionar 'locations' ao updateData, ele permanecerá null.
           // Se existingTimeRecord.locations TINHA dados, mas as solicitações atuais não,
           // a lógica acima manterá os dados existentes em mergedLocations, que será adicionado.
           // Se queremos remover localizações antigas caso a edição não tenha localização,
           // a lógica precisaria ser mais complexa. Por enquanto, mantemos as antigas se não houver novas.
           console.log('LOG 7: No locations to merge. updateData without locations:', updateData);
      }


      // 3. Atualizar ou inserir o registro time_records com os novos valores e localizações
      let timeRecordUpsertData: any = {
        user_id: userId,
        date: date,
        ...updateData, // Include clock_in, lunch_start, etc., and locations
        is_pending_approval: false, // Mark as not pending approval anymore
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      };

      // If updating an existing record, include the ID
      if (existingTimeRecord) {
        timeRecordUpsertData.id = existingTimeRecord.id;
        console.log('LOG 8: Updating existing time_record:', timeRecordUpsertData); // LOG 8: Dados para atualizar registro existente
      } else {
         // If inserting a new record, ensure required fields are present if not already in updateData
         // (e.g., clock_in might be null if only lunch is edited and no clock_in existed)
         // This might require fetching more data or setting defaults if needed.
         // For simplicity, we assume updateData contains the relevant fields being edited.
         console.log('LOG 8: Inserting new time_record:', timeRecordUpsertData); // LOG 8: Dados para inserir novo registro
      }


      const { error: upsertRecordError } = await supabase
        .from('time_records')
        .upsert([timeRecordUpsertData as any], { onConflict: 'user_id, date' }); // Use onConflict for upsert logic

      if (upsertRecordError) {
        console.error("Error upserting time_record:", upsertRecordError);
        toast({
          title: "Erro",
          description: `Erro ao atualizar registro de ponto: ${upsertRecordError.message}`,
          variant: "destructive"
        });
        // Consider rolling back edit_requests status here if time_records update fails
        return;
      }

      console.log(`Successfully approved and updated time_record for ${groupKey}`);
      toast({ title: "Sucesso", description: "Solicitação(ões) aprovada(s) com sucesso.", variant: "default" });

    } catch (error: any) {
        console.error("Error during time_records update process:", error);
        toast({
            title: "Erro",
            description: `Erro no processo de aprovação: ${error.message}`,
            variant: "destructive"
        });
        // IMPORTANT: If the time_records update fails, you might want to revert the status
        // of the edit_requests back to 'pending' to allow retrying. This requires
        // additional logic (another upsert call or a Supabase function).
    } finally {
        // Invalidate queries to refetch data
        queryClient.invalidateQueries({ queryKey: ['editRequests', 'pending'] });
        queryClient.invalidateQueries({ queryKey: ['editRequests', 'approved'] });
        // Invalidate time_records query if you have one displayed elsewhere
        queryClient.invalidateQueries({ queryKey: ['timeRecords'] }); // Adjust queryKey as needed
    }

  }, [groupedRequests, user, toast, queryClient]);


  const handleRejectGroup = useCallback(async (groupKey: string) => {
    if (!user) {
      toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
      return;
    }

    const requestsToProcess = groupedRequests[groupKey];
    if (!requestsToProcess || requestsToProcess.length === 0) return;

    const updates = requestsToProcess.map(req => ({
      id: req.id,
      status: 'rejected',
      // CORRIGIDO: Usar reviewed_at e reviewed_by
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    }));

    const { error } = await supabase
      .from('edit_requests')
      .upsert(updates); // Use upsert to update by ID

    if (error) {
      console.error("Error updating edit_requests status:", error);
      toast({
        title: "Erro",
        description: `Erro ao rejeitar solicitação(ões): ${error.message}`,
        variant: "destructive"
      });
    } else {
      toast({ title: "Sucesso", description: "Solicitação(ões) rejeitada(s) com sucesso.", variant: "default" });
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['editRequests', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['editRequests', 'rejected'] });
    }

  }, [groupedRequests, user, toast, queryClient]);


  const hasGroups = Object.keys(paginatedGroups).length > 0;

  if (isLoading) {
    return <div className="flex justify-center items-center h-40"><Clock className="animate-spin mr-2" /> Carregando solicitações...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar solicitações: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-gray-800">
            Gerenciar Solicitações de<br /> Alteração de Ponto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex justify-center space-x-4">
            <Button
              variant={filterStatus === 'pending' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('pending')}
            >
              Pendentes
            </Button>
            <Button
              variant={filterStatus === 'approved' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('approved')}
            >
              Aprovadas
            </Button>
            <Button
              variant={filterStatus === 'rejected' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('rejected')}
            >
              Rejeitadas
            </Button>
          </div>

          {!hasGroups && (
            <div className="text-center text-gray-500 py-8">
              Nenhuma solicitação {filterStatus === 'pending' ? 'pendente' : filterStatus === 'approved' ? 'aprovada' : 'rejeitada'} encontrada.
            </div>
          )}

          {hasGroups && (
            <div className="space-y-6">
              {Object.entries(paginatedGroups).map(([groupKey, requestsInGroup]) => (
                <Card key={groupKey} className="border-l-4 border-blue-500">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">
                          {requestsInGroup[0].employee_name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Data: {format(new Date(requestsInGroup[0].date + 'T12:00:00Z'), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                      <Badge
                        className={`px-3 py-1 text-xs font-medium ${
                          filterStatus === 'pending' ? 'bg-yellow-500 text-white' :
                          filterStatus === 'approved' ? 'bg-green-500 text-white' :
                          'bg-red-500 text-white'
                        }`}
                      >
                        {filterStatus === 'pending' ? 'Pendente' : filterStatus === 'approved' ? 'Aprovada' : 'Rejeitada'}
                      </Badge>
                    </div>

                    <div className="space-y-3 mb-4">
                      {requestsInGroup.map(req => (
                        <div key={req.id} className="p-3 bg-gray-50 rounded-md border border-gray-200">
                          <p className="text-sm font-medium text-gray-700 mb-1">
                            Campo: <span className="font-normal">{fieldNames[req.field]}</span>
                          </p>
                          <p className="text-sm text-gray-700 mb-1">
                            Valor Antigo: <span className="font-normal">{req.old_value || 'Não registrado'}</span>
                          </p>
                          <p className="text-sm text-gray-700 mb-1">
                            Novo Valor: <span className="font-normal text-blue-600">{req.new_value}</span>
                          </p>
                           <p className="text-sm text-gray-700 italic mb-1">
                            Motivo: <span className="font-normal">{req.reason}</span>
                          </p>
                           {/* Opcional: Exibir detalhes da localização da solicitação se existir */}
                           {req.location && typeof req.location === 'object' && (
                               <div className="text-xs text-gray-500 mt-2">
                                   Localização na solicitação ({fieldNames[req.field]}):
                                   {/* Access the specific field's location data for display */}
                                   <pre className="whitespace-pre-wrap break-words text-gray-700 bg-gray-100 p-1 rounded mt-1">
                                        {/* CORRIGIDO: Acessar usando o nome do campo */}
                                        {JSON.stringify((req.location as Record<string, any>)?.[req.field], null, 2)}
                                   </pre>
                               </div>
                           )}
                        </div>
                      ))}
                    </div>

                    {filterStatus === 'pending' && (
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRejectGroup(groupKey)}
                          className="text-red-600 border-red-600 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApproveGroup(groupKey)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" /> Aprovar
                        </Button>
                      </div>
                    )}

                     {filterStatus !== 'pending' && requestsInGroup[0].reviewed_by && ( // CORRIGIDO: Usar reviewed_by
                         <div className="text-right text-sm text-gray-500 mt-2">
                             Processado por: {requestsInGroup[0].reviewed_by} em {requestsInGroup[0].reviewed_at ? format(new Date(requestsInGroup[0].reviewed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'} {/* CORRIGIDO: Usar reviewed_at */}
                         </div>
                     )}

                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {hasGroups && totalPages > 1 && (
            <div className="flex justify-center items-center space-x-4 mt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange('prev')}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <span className="text-sm text-gray-700">
                Página {currentPage + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange('next')}
                disabled={currentPage >= totalPages - 1}
              >
                Próxima <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
};

export default OptimizedPendingApproval;
