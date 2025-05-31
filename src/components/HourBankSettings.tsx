
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { hourBankService, HourBankSettings as IHourBankSettings } from '@/utils/hourBankService';
import { Clock, Settings, Save } from 'lucide-react';

const HourBankSettings = () => {
  const [settings, setSettings] = useState<IHourBankSettings>({
    usar_banco_horas: false,
    limite_maximo_horas: 40,
    validade_horas_meses: 6,
    jornada_padrao_horas: 8
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await hourBankService.getHourBankSettings();
      setSettings(data);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações do banco de horas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await hourBankService.updateHourBankSettings(settings);
      toast({
        title: "Sucesso",
        description: "Configurações do banco de horas atualizadas com sucesso"
      });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSettingChange = (key: keyof IHourBankSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Carregando configurações...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Configurações do Banco de Horas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Ativar/Desativar Banco de Horas */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Usar Banco de Horas</Label>
            <div className="text-sm text-muted-foreground">
              Ativar o sistema de banco de horas para acúmulo e compensação
            </div>
          </div>
          <Switch
            checked={settings.usar_banco_horas}
            onCheckedChange={(checked) => handleSettingChange('usar_banco_horas', checked)}
          />
        </div>

        <Separator />

        {/* Configurações do Banco de Horas */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="limite_maximo">Limite Máximo de Acúmulo (horas)</Label>
              <Input
                id="limite_maximo"
                type="number"
                min="1"
                max="200"
                value={settings.limite_maximo_horas}
                onChange={(e) => handleSettingChange('limite_maximo_horas', parseFloat(e.target.value) || 40)}
                disabled={!settings.usar_banco_horas}
              />
              <div className="text-xs text-muted-foreground">
                Limite máximo de horas que podem ser acumuladas no banco
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="validade_meses">Validade das Horas (meses)</Label>
              <Input
                id="validade_meses"
                type="number"
                min="1"
                max="24"
                value={settings.validade_horas_meses}
                onChange={(e) => handleSettingChange('validade_horas_meses', parseFloat(e.target.value) || 6)}
                disabled={!settings.usar_banco_horas}
              />
              <div className="text-xs text-muted-foreground">
                Tempo em meses após o qual as horas acumuladas expiram
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jornada_padrao">Jornada Padrão Diária (horas)</Label>
            <Input
              id="jornada_padrao"
              type="number"
              min="1"
              max="12"
              step="0.5"
              value={settings.jornada_padrao_horas}
              onChange={(e) => handleSettingChange('jornada_padrao_horas', parseFloat(e.target.value) || 8)}
              disabled={!settings.usar_banco_horas}
              className="max-w-xs"
            />
            <div className="text-xs text-muted-foreground">
              Jornada padrão para funcionários que não possuem jornada específica
            </div>
          </div>
        </div>

        <Separator />

        {/* Informações sobre o funcionamento */}
        {settings.usar_banco_horas && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Como funciona:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Horas trabalhadas além da jornada são acumuladas no banco</li>
              <li>• Horas não trabalhadas são descontadas do banco</li>
              <li>• Limite máximo: {settings.limite_maximo_horas} horas</li>
              <li>• Validade: {settings.validade_horas_meses} meses</li>
              <li>• Tolerância: 15 minutos para cálculos</li>
            </ul>
          </div>
        )}

        {/* Botão Salvar */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default HourBankSettings;
