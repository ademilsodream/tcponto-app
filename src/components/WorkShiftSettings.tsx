
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Settings } from 'lucide-react';

const WorkShiftSettings = () => {
  const [enableWorkShifts, setEnableWorkShifts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      console.log('🔍 Carregando configurações de turnos...');

      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .eq('setting_key', 'enable_work_shifts');

      if (error) {
        console.error('❌ Erro ao carregar configurações:', error);
        throw error;
      }

      if (data && data.length > 0) {
        setEnableWorkShifts(data[0].setting_value === 'true');
      }

      console.log('✅ Configurações carregadas');
    } catch (error) {
      console.error('💥 Erro crítico ao carregar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações de turnos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      console.log('💾 Salvando configurações de turnos...');

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'enable_work_shifts',
          setting_value: enableWorkShifts.toString(),
          description: 'Habilitar turnos de trabalho personalizados'
        });

      if (error) throw error;

      console.log('✅ Configurações salvas com sucesso');
      toast({
        title: "Sucesso",
        description: "Configurações de turnos atualizadas com sucesso"
      });
    } catch (error) {
      console.error('💥 Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar configurações de turnos",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>Carregando configurações...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Configurações de Turnos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="enable-shifts" className="text-base font-medium">
                Habilitar turnos de trabalho personalizados
              </Label>
              <div className="text-sm text-muted-foreground">
                Quando habilitado, funcionários podem ter turnos específicos que controlam os horários de registro de ponto
              </div>
            </div>
            <Switch
              id="enable-shifts"
              checked={enableWorkShifts}
              onCheckedChange={setEnableWorkShifts}
              disabled={saving}
            />
          </div>
        </div>

        <Button onClick={handleSaveSettings} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar Configurações'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default WorkShiftSettings;
