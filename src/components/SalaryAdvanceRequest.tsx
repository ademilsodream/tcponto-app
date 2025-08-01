
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Plus, Clock, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SalaryAdvanceRequest {
  id: string;
  requested_amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  reviewed_at?: string;
  approved_amount?: number;
  admin_notes?: string;
  payment_date?: string;
}

const SalaryAdvanceRequest: React.FC = () => {
  const { user } = useOptimizedAuth();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  
  const [requests, setRequests] = useState<SalaryAdvanceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // Form states
  const [requestedAmount, setRequestedAmount] = useState('');
  const [reason, setReason] = useState('');
  
  // System settings
  const [minAmount, setMinAmount] = useState(10);
  const [maxAmount, setMaxAmount] = useState(150);

  // Load system settings
  const loadSettings = async () => {
    try {
      const { data: settings, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['salary_advance_min_amount', 'salary_advance_max_amount']);

      if (error) {
        console.error('Error loading settings:', error);
        return;
      }

      settings?.forEach(setting => {
        if (setting.setting_key === 'salary_advance_min_amount') {
          setMinAmount(parseFloat(setting.setting_value));
        } else if (setting.setting_key === 'salary_advance_max_amount') {
          setMaxAmount(parseFloat(setting.setting_value));
        }
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // Load user's salary advance requests
  const loadRequests = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('salary_advance_requests')
        .select('*')
        .eq('employee_id', user.id)
        .order('requested_at', { ascending: false });

      if (error) {
        console.error('Error loading salary advance requests:', error);
        toast({
          title: "Erro ao carregar solicitações",
          description: "Não foi possível carregar suas solicitações de vale salarial.",
          variant: "destructive"
        });
        return;
      }

      // Safely cast the status field to the expected type
      const typedData = (data || []).map(item => ({
        ...item,
        status: item.status as 'pending' | 'approved' | 'rejected'
      }));

      setRequests(typedData);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  // Submit new request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    const amount = parseFloat(requestedAmount);
    
    // Validations
    if (amount < minAmount || amount > maxAmount) {
      toast({
        title: "Valor inválido",
        variant: "destructive"
      });
      return;
    }

    if (!reason.trim()) {
      toast({
        title: "Justificativa obrigatória",
        description: "Por favor, informe o motivo da solicitação.",
        variant: "destructive"
      });
      return;
    }

    // Check if user has pending request
    const hasPendingRequest = requests.some(req => req.status === 'pending');
    if (hasPendingRequest) {
      toast({
        title: "Solicitação pendente",
        description: "Você já possui uma solicitação pendente. Aguarde a análise.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('salary_advance_requests')
        .insert({
          employee_id: user.id,
          requested_amount: amount,
          reason: reason.trim()
        });

      if (error) {
        console.error('Error creating salary advance request:', error);
        toast({
          title: "Erro ao criar solicitação",
          description: "Não foi possível criar sua solicitação. Tente novamente.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Solicitação enviada",
        description: "Sua solicitação de vale salarial foi enviada para análise.",
      });

      // Reset form and reload requests
      setRequestedAmount('');
      setReason('');
      setShowForm(false);
      loadRequests();

    } catch (error) {
      console.error('Error submitting request:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadRequests();
  }, [user?.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'approved': return 'Aprovado';
      case 'rejected': return 'Rejeitado';
      default: return 'Desconhecido';
    }
  };

  const hasPendingRequest = requests.some(req => req.status === 'pending');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Vale Salarial
                </h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Nova Solicitação */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Nova Solicitação</span>
              {!showForm && !hasPendingRequest && (
                <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Solicitar Vale
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasPendingRequest ? (
              <div className="text-center py-4 text-gray-600">
                <Clock className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                <p>Você já possui uma solicitação pendente.</p>
                <p className="text-sm">Aguarde a análise para fazer uma nova solicitação.</p>
              </div>
            ) : showForm ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="amount">Valor Solicitado</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min={minAmount}
                    max={maxAmount}
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(e.target.value)}
                    placeholder={`Entre ${formatCurrency(minAmount)} e ${formatCurrency(maxAmount)}`}
                    required
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Valor mínimo: {formatCurrency(minAmount)} | Máximo: {formatCurrency(maxAmount)}
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="reason">Justificativa</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explique o motivo da solicitação do vale salarial..."
                    rows={3}
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Enviando...' : 'Enviar Solicitação'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowForm(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <div className="text-center py-4">
                <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 mb-4">
                  Solicite um vale salarial quando precisar de um adiantamento.
                </p>
                <Button onClick={() => setShowForm(true)} className="flex items-center gap-2 mx-auto">
                  <Plus className="w-4 h-4" />
                  Fazer Solicitação
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de Solicitações */}
        <Card>
          <CardHeader>
            <CardTitle>Minhas Solicitações</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 animate-spin mx-auto mb-2 text-gray-400" />
                <p className="text-gray-600">Carregando solicitações...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Você ainda não fez nenhuma solicitação de vale salarial.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map(request => (
                  <div key={request.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-lg">
                            {formatCurrency(request.requested_amount)}
                          </span>
                          <Badge className={`${getStatusColor(request.status)} flex items-center gap-1`}>
                            {getStatusIcon(request.status)}
                            {getStatusText(request.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Solicitado em {format(parseISO(request.requested_at), 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR })}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium">Justificativa:</span>
                        <p className="text-sm text-gray-700">{request.reason}</p>
                      </div>

                      {request.status === 'approved' && request.approved_amount && (
                        <div>
                          <span className="text-sm font-medium text-green-600">Valor Aprovado:</span>
                          <p className="text-sm text-green-700 font-semibold">
                            {formatCurrency(request.approved_amount)}
                          </p>
                        </div>
                      )}

                      {request.admin_notes && (
                        <div>
                          <span className="text-sm font-medium">Observações do Administrador:</span>
                          <p className="text-sm text-gray-700">{request.admin_notes}</p>
                        </div>
                      )}

                      {request.payment_date && request.status === 'approved' && (
                        <div>
                          <span className="text-sm font-medium">Data de Pagamento:</span>
                          <p className="text-sm text-gray-700">
                            {format(parseISO(request.payment_date), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        </div>
                      )}

                      {request.reviewed_at && (
                        <p className="text-xs text-gray-500">
                          Analisado em {format(parseISO(request.reviewed_at), 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SalaryAdvanceRequest;
