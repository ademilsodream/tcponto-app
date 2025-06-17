import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TimeRecordRegistration } from '@/components/TimeRecordRegistration';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AllowedLocation } from '@/utils/types';
import { useToast } from '@/components/ui/use-toast';

const TimeRecordPage: React.FC = () => {
  const [allowedLocations, setAllowedLocations] = useState<AllowedLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useOptimizedAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadAllowedLocations();
  }, []);

  const loadAllowedLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('allowed_locations')
        .select('id, name, address, latitude, longitude, range_meters, is_active')
        .eq('is_active', true);

      if (error) throw error;

      setAllowedLocations(data || []);
    } catch (error) {
      console.error('Erro ao carregar localizações permitidas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as localizações permitidas.",
        variant: "destructive",
      });
    }
  };

  const handleRegister = async (type: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out') => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const now = new Date();
      const timeString = now.toTimeString().split(' ')[0];
      const dateString = now.toISOString().split('T')[0];

      // Verificar se já existe um registro para hoje
      const { data: existingRecord, error: fetchError } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateString)
        .eq('status', 'active')
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingRecord) {
        // Atualizar registro existente
        const { error: updateError } = await supabase
          .from('time_records')
          .update({
            [type]: timeString,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRecord.id);

        if (updateError) throw updateError;
      } else {
        // Criar novo registro
        const { error: insertError } = await supabase
          .from('time_records')
          .insert({
            user_id: user.id,
            date: dateString,
            [type]: timeString,
            status: 'active'
          });

        if (insertError) throw insertError;
      }

      toast({
        title: "Sucesso",
        description: "Ponto registrado com sucesso!",
      });

    } catch (error: any) {
      console.error('Erro ao registrar ponto:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível registrar o ponto.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Registro de Ponto</CardTitle>
        </CardHeader>
        <CardContent>
          <TimeRecordRegistration
            allowedLocations={allowedLocations}
            onRegister={handleRegister}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default TimeRecordPage; 