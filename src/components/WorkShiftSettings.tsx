
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Settings } from 'lucide-react';

const WorkShiftSettings = () => {
  const [enableWorkShifts, setEnableWorkShifts] = useState(false);
  const [toleranceMinutes, setToleranceMinutes] = useState(15);
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
        .in('setting_key', ['enable_work_shifts', 'work_shift_tolerance_minutes']);

      if (error) {
        console.error('❌ Erro ao carregar configurações:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const enableSetting = data.find(s => s.setting_key === 'enable_work_shifts');
        const toleranceSetting = data.find(s => s.setting_key === 'work_shift_tolerance_minutes');
        
        setEnableWorkShifts(enableSetting?.setting_value === 'true');
        setToleranceMinutes(toleranceSetting ? parseInt(toleranceSetting.setting_value) : 15);
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

      // Preparar configurações para salvar
      const settingsToUpsert = [
        {
          setting_key: 'enable_work_shifts',
          setting_value: enableWorkShifts.toString(),
          description: 'Habilitar turnos de trabalho personalizados'
        }
      ];

      // Adicionar tolerância apenas se turnos estiverem habilitados
      if (enableWorkShifts) {
        settingsToUpsert.push({
          setting_key: 'work_shift_tolerance_minutes',
          setting_value: toleranceMinutes.toString(),
          description: 'Tolerância em minutos para habilitar botão de registro'
        });
      }

      const { error } = await supabase
        .from('system_settings')
        .upsert(settingsToUpsert);

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

          {enableWorkShifts && (
            <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
              <div className="space-y-2">
                <Label htmlFor="tolerance-minutes" className="text-base font-medium">
                  Tolerância para Habilitação do Botão (minutos)
                </Label>
                <div className="text-sm text-muted-foreground mb-2">
                  Define quantos minutos antes e depois do horário previsto o botão de registro fica habilitado
                </div>
                <Input
                  id="tolerance-minutes"
                  type="number"
                  min="0"
                  max="60"
                  value={toleranceMinutes}
                  onChange={(e) => setToleranceMinutes(parseInt(e.target.value) || 0)}
                  disabled={saving}
                  className="w-32"
                />
              </div>
            </div>
          )}
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
