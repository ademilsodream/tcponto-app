/**
 * Página de Registro de Ponto Unificada
 * Demonstra o uso do novo sistema de localização
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/OptimizedAuthContext';
import { UnifiedTimeRegistration } from '@/components/UnifiedTimeRegistration';
import { supabase } from '@/integrations/supabase/client';
import { AllowedLocation } from '@/types/index';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const UnifiedTimeRecordPage: React.FC = () => {
  const { user } = useAuth();
  const [timeRecord, setTimeRecord] = useState<any>(null);
  const [allowedLocations, setAllowedLocations] = useState<AllowedLocation[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar dados iniciais
  useEffect(() => {
    const loadInitialData = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Carregar localizações permitidas
        const { data: locations, error: locationsError } = await supabase
          .from('allowed_locations')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (locationsError) {
          console.error('Erro ao carregar localizações:', locationsError);
        } else {
          setAllowedLocations(locations || []);
        }

        // Carregar registro de hoje
        const today = format(new Date(), 'yyyy-MM-dd');
        const { data: record, error: recordError } = await supabase
          .from('time_records')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .single();

        if (recordError && recordError.code !== 'PGRST116') {
          console.error('Erro ao carregar registro:', recordError);
        } else {
          setTimeRecord(record);
        }

      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [user]);

  // Atualizar registro quando mudar
  const handleTimeRecordUpdate = (updatedRecord: any) => {
    setTimeRecord(updatedRecord);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Acesso Negado
          </h1>
          <p className="text-gray-600">
            Você precisa estar logado para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Registro de Ponto
          </h1>
          <p className="text-gray-600">
            Sistema unificado com GPS otimizado
          </p>
          <div className="mt-2 text-sm text-gray-500">
            {format(new Date(), 'EEEE, dd/MM/yyyy', { locale: ptBR })}
          </div>
        </div>

        {/* Informações do usuário */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h2 className="font-semibold text-blue-800 mb-2">
            Funcionário: {user.user_metadata?.full_name || user.email}
          </h2>
          <p className="text-sm text-blue-700">
            Locais permitidos: {allowedLocations.length}
          </p>
        </div>

        {/* Componente de registro unificado */}
        <UnifiedTimeRegistration
          user={user}
          allowedLocations={allowedLocations}
          timeRecord={timeRecord}
          onTimeRecordUpdate={handleTimeRecordUpdate}
        />

        {/* Informações de debug */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">Informações Técnicas</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <div>Usuário ID: {user.id}</div>
            <div>Data: {format(new Date(), 'yyyy-MM-dd')}</div>
            <div>Locais configurados: {allowedLocations.length}</div>
            {timeRecord && (
              <div>Registro ID: {timeRecord.id}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 