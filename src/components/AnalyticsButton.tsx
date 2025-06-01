
import React from 'react';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const AnalyticsButton = () => {
  const { toast } = useToast();

  const handleCalculateAnalytics = async () => {
    try {
      const { error } = await supabase.rpc('calculate_monthly_analytics');
      
      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Métricas de analytics atualizadas com sucesso"
      });
    } catch (error) {
      console.error('Erro ao calcular analytics:', error);
      toast({
        title: "Erro",
        description: "Erro ao calcular métricas de analytics",
        variant: "destructive"
      });
    }
  };

  return (
    <Button onClick={handleCalculateAnalytics} variant="outline" size="sm">
      <BarChart3 className="w-4 h-4 mr-2" />
      Atualizar Métricas
    </Button>
  );
};

export default AnalyticsButton;
