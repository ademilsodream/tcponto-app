
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Vale Salarial</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Nova Solicitação */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Nova Solicitação</h2>
            {!showForm && !hasPendingRequest && (
              <Button onClick={() => setShowForm(true)} className="flex items-center gap-2 h-10">
                <Plus className="w-4 h-4" />
                Solicitar
              </Button>
            )}
          </div>
          
          {hasPendingRequest ? (
            <div className="text-center py-6">
              <Clock className="w-12 h-12 mx-auto mb-3 text-yellow-500" />
              <p className="text-base text-gray-700 mb-2">Você já possui uma solicitação pendente.</p>
              <p className="text-sm text-gray-600">Aguarde a análise para fazer uma nova solicitação.</p>
            </div>
          ) : showForm ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="amount" className="text-base font-medium">Valor Solicitado</Label>
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
                  className="h-12 text-base"
                />
                
              </div>
              
              <div>
                <Label htmlFor="reason" className="text-base font-medium">Justificativa</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explique o motivo da solicitação do vale salarial..."
                  rows={4}
                  required
                  className="text-base resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  className="flex-1 h-12 text-base"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 h-12 text-base"
                >
                  {submitting ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="text-center py-6">
              <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-base text-gray-700 mb-4">
                Solicite um vale salarial quando precisar de um adiantamento.
              </p>
              <Button onClick={() => setShowForm(true)} className="flex items-center gap-2 mx-auto h-12 text-base">
                <Plus className="w-5 h-5" />
                Solicitar
              </Button>
            </div>
          )}
        </div>

        {/* Lista de Solicitações */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Minhas Solicitações</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 animate-spin mx-auto mb-3 text-gray-400" />
              <p className="text-base text-gray-600">Carregando solicitações...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-base">Você ainda não fez nenhuma solicitação de vale salarial.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map(request => (
                <div key={request.id} className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-xl">
                          {formatCurrency(request.requested_amount)}
                        </span>
                        <Badge className={`${getStatusColor(request.status)} flex items-center gap-1 text-sm`}>
                          {getStatusIcon(request.status)}
                          {getStatusText(request.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Solicitado em {format(parseISO(request.requested_at), 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Justificativa:</span>
                      <p className="text-base text-gray-800 mt-1">{request.reason}</p>
                    </div>

                    {request.status === 'approved' && request.approved_amount && (
                      <div>
                        <span className="text-sm font-medium text-green-600">Valor Aprovado:</span>
                        <p className="text-base text-green-700 font-semibold mt-1">
                          {formatCurrency(request.approved_amount)}
                        </p>
                      </div>
                    )}

                    {request.admin_notes && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">Observações do Administrador:</span>
                        <p className="text-base text-gray-800 mt-1">{request.admin_notes}</p>
                      </div>
                    )}

                    {request.payment_date && request.status === 'approved' && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">Data de Pagamento:</span>
                        <p className="text-base text-gray-800 mt-1">
                          {format(parseISO(request.payment_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                    )}

                    {request.reviewed_at && (
                      <p className="text-sm text-gray-500">
                        Analisado em {format(parseISO(request.reviewed_at), 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalaryAdvanceRequest;
