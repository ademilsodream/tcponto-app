import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Clock, AlertCircle, UserPlus, LayoutDashboard } from 'lucide-react';
import OptimizedAdminDashboard from '@/components/OptimizedAdminDashboard';
import OptimizedPendingApprovals from '@/components/OptimizedPendingApprovals';
import UserManagement from '@/components/UserManagement';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
// ✨ Importar componentes de Tabs do Shadcn UI
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';


interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourlyRate: number;
  overtimeRate: number;
}


// Função para formatar horas no padrão HH:MM (mantida)
const formatHoursAsTime = (hours: number) => {
  if (!hours || hours === 0) return '00:00';

  const totalMinutes = Math.round(hours * 60);
  const hoursDisplay = Math.floor(totalMinutes / 60);
  const minutesDisplay = totalMinutes % 60;

  return `${hoursDisplay.toString().padStart(2, '0')}:${minutesDisplay.toString().padStart(2, '0')}`;
};


const AdminPanel = () => {
  // ✨ NOVA: Estado para controlar qual aba está ativa
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'pending', 'users'

  // Query otimizada para buscar funcionários ATIVOS apenas
  const {
    data: employees = [],
    isLoading: loadingEmployees,
    refetch: refetchEmployees
  } = useQuery<User[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;

      return data.map(profile => ({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role as 'admin' | 'user',
        hourlyRate: Number(profile.hourly_rate),
        overtimeRate: Number(profile.overtime_rate) || Number(profile.hourly_rate) * 1.5 // Fallback calculation
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    // Desabilitar refetchOnWindowFocus se não quiser que recarregue ao voltar para a aba
    // refetchOnWindowFocus: false,
  });

  // Query para contar solicitações pendentes
  const {
    data: pendingCount = 0,
    refetch: refetchPendingCount
  } = useQuery<number>({
    queryKey: ['pending-requests-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('edit_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;
      return count || 0;
    },
    staleTime: 1 * 60 * 1000, // 1 minuto
    // Desabilitar refetchOnWindowFocus se não quiser que recarregue ao voltar para a aba
    // refetchOnWindowFocus: false,
  });

  // Function to refetch data after actions in child components if needed
  const handleDataChange = () => {
      console.log("🔄 Disparando refetch manual...");
      refetchEmployees();
      refetchPendingCount();
  }

  if (loadingEmployees) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2">Carregando painel administrativo...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section (mantido acima das abas) */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
          <p className="text-gray-600">Gerencie usuários, aprovações e visualize o dashboard.</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600">
            Total de funcionários ativos: {employees.length}
          </div>
          {pendingCount > 0 && (
            <Alert className="inline-flex items-center p-2 border-orange-200 bg-orange-50">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800 ml-1">
                {pendingCount} solicitação(ões) pendente(s)
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* ✨ NOVA: Componente Tabs para navegação */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Lista de botões/triggers para as abas */}
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard">
            <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="pending">
            <Clock className="w-4 h-4 mr-2" /> Solicitações Pendentes
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] h-4 flex items-center justify-center ml-2">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="users">
            <UserPlus className="w-4 h-4 mr-2" /> Gerenciar Funcionários
          </TabsTrigger>
        </TabsList>

        {/* Conteúdo de cada aba */}
        <TabsContent value="dashboard">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5" />
                Dashboard Geral
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OptimizedAdminDashboard employees={employees} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Gerenciar Solicitações Pendentes
                {pendingCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center ml-2">
                    {pendingCount}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Pass handleDataChange para refetch após aprovações */}
              <OptimizedPendingApprovals employees={employees} onApprovalChange={handleDataChange} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
           {/* O componente UserManagement já renderiza seu próprio Card */}
           {/* Pass handleDataChange para refetch após alterações de usuário */}
          <UserManagement onUserChange={handleDataChange} />
        </TabsContent>
      </Tabs>
      {/* FIM: Componente Tabs */}

      {/* O componente AutomatedChecks não estava no código original fornecido,
          mas se ele existisse e você quisesse incluí-lo, poderia ser
          outra aba ou mantido separado, dependendo da sua preferência. */}
      {/* Exemplo de como seria se fosse outra aba: */}
      {/*
      <TabsContent value="checks">
         <AutomatedChecks />
      </TabsContent>
      */}

    </div>
  );
};

export default AdminPanel;
