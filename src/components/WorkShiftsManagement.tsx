import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Edit, Trash2, Clock, Settings } from 'lucide-react';

interface WorkShift {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  schedules: WorkShiftSchedule[];
}

interface WorkShiftSchedule {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface SystemSettings {
  work_shifts_enabled: boolean;
  time_tolerance_minutes: number;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' }
];

const WorkShiftsManagement = () => {
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<WorkShift | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Estados das configurações do sistema
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    work_shifts_enabled: false,
    time_tolerance_minutes: 10
  });
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schedules: DAYS_OF_WEEK.map(day => ({
      day_of_week: day.value,
      start_time: '08:00',
      end_time: '17:00',
      is_active: false
    }))
  });

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([
      loadShifts(),
      loadSystemSettings()
    ]);
  };

  const loadSystemSettings = async () => {
    try {
      console.log('🔍 Carregando configurações do sistema...');

      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['work_shifts_enabled', 'time_tolerance_minutes']);

      if (error) {
        console.error('❌ Erro ao carregar configurações:', error);
        throw error;
      }

      const settings: SystemSettings = {
        work_shifts_enabled: false,
        time_tolerance_minutes: 10
      };

      data?.forEach(setting => {
        if (setting.setting_key === 'work_shifts_enabled') {
          settings.work_shifts_enabled = setting.setting_value === 'true';
        } else if (setting.setting_key === 'time_tolerance_minutes') {
          settings.time_tolerance_minutes = parseInt(setting.setting_value) || 10;
        }
      });

      console.log('✅ Configurações carregadas:', settings);
      setSystemSettings(settings);
    } catch (error) {
      console.error('💥 Erro ao carregar configurações do sistema:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações do sistema",
        variant: "destructive"
      });
    }
  };

  const saveSystemSettings = async () => {
    try {
      setSavingSettings(true);
      console.log('💾 Salvando configurações do sistema...');

      // Configurações a serem salvas
      const settingsToSave = [
        {
          setting_key: 'work_shifts_enabled',
          setting_value: systemSettings.work_shifts_enabled.toString(),
          description: 'Habilitar turnos de trabalho personalizados'
        },
        {
          setting_key: 'time_tolerance_minutes',
          setting_value: systemSettings.time_tolerance_minutes.toString(),
          description: 'Minutos de tolerância antes e depois do horário de entrada para registro de ponto'
        }
      ];

      // Usar upsert para inserir ou atualizar
      for (const setting of settingsToSave) {
        const { error } = await supabase
          .from('system_settings')
          .upsert(setting, {
            onConflict: 'setting_key'
          });

        if (error) {
          console.error(`❌ Erro ao salvar configuração ${setting.setting_key}:`, error);
          throw error;
        }
      }

      console.log('✅ Configurações salvas com sucesso');
      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso"
      });

    } catch (error: any) {
      console.error('💥 Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar configurações",
        variant: "destructive"
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const loadShifts = async () => {
    try {
      setLoading(true);
      console.log('🔍 Carregando turnos de trabalho...');

      const { data, error } = await supabase
        .from('work_shifts')
        .select(`
          *,
          work_shift_schedules (*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao carregar turnos:', error);
        throw error;
      }

      const shiftsWithSchedules = data?.map(shift => ({
        ...shift,
        schedules: shift.work_shift_schedules || []
      })) || [];

      console.log('✅ Turnos carregados:', shiftsWithSchedules.length);
      setShifts(shiftsWithSchedules);
    } catch (error) {
      console.error('💥 Erro crítico ao carregar turnos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar turnos de trabalho",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingShift(null);
    setFormData({
      name: '',
      description: '',
      schedules: DAYS_OF_WEEK.map(day => ({
        day_of_week: day.value,
        start_time: '08:00',
        end_time: '17:00',
        is_active: false
      }))
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (shift: WorkShift) => {
    setEditingShift(shift);
    setFormData({
      name: shift.name,
      description: shift.description || '',
      schedules: DAYS_OF_WEEK.map(day => {
        const existingSchedule = shift.schedules.find(s => s.day_of_week === day.value);
        return existingSchedule ? {
          ...existingSchedule,
          start_time: existingSchedule.start_time.substring(0, 5), // Remove seconds
          end_time: existingSchedule.end_time.substring(0, 5)
        } : {
          day_of_week: day.value,
          start_time: '08:00',
          end_time: '17:00',
          is_active: false
        };
      })
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome do turno é obrigatório",
        variant: "destructive"
      });
      return;
    }

    const activeSchedules = formData.schedules.filter(s => s.is_active);
    if (activeSchedules.length === 0) {
      toast({
        title: "Erro",
        description: "Pelo menos um dia da semana deve estar ativo",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);
      console.log('💾 Salvando turno...');

      if (editingShift) {
        // Atualizar turno existente
        const { error: shiftError } = await supabase
          .from('work_shifts')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', editingShift.id);

        if (shiftError) throw shiftError;

        // Deletar horários existentes
        const { error: deleteError } = await supabase
          .from('work_shift_schedules')
          .delete()
          .eq('shift_id', editingShift.id);

        if (deleteError) throw deleteError;

        // Inserir novos horários
        const schedulesToInsert = activeSchedules.map(schedule => ({
          shift_id: editingShift.id,
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          is_active: true
        }));

        const { error: insertError } = await supabase
          .from('work_shift_schedules')
          .insert(schedulesToInsert);

        if (insertError) throw insertError;

        toast({
          title: "Sucesso",
          description: "Turno atualizado com sucesso"
        });
      } else {
        // Criar novo turno
        const { data: newShift, error: shiftError } = await supabase
          .from('work_shifts')
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim(),
            is_active: true
          })
          .select()
          .single();

        if (shiftError) throw shiftError;

        // Inserir horários
        const schedulesToInsert = activeSchedules.map(schedule => ({
          shift_id: newShift.id,
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          is_active: true
        }));

        const { error: insertError } = await supabase
          .from('work_shift_schedules')
          .insert(schedulesToInsert);

        if (insertError) throw insertError;

        toast({
          title: "Sucesso",
          description: "Turno criado com sucesso"
        });
      }

      setIsDialogOpen(false);
      await loadShifts();
    } catch (error: any) {
      console.error('💥 Erro ao salvar turno:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar turno",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (shift: WorkShift) => {
    if (!confirm(`Tem certeza que deseja excluir o turno "${shift.name}"?`)) {
      return;
    }

    try {
      setDeleting(shift.id);

      const { error } = await supabase
        .from('work_shifts')
        .delete()
        .eq('id', shift.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Turno excluído com sucesso"
      });

      await loadShifts();
    } catch (error: any) {
      console.error('💥 Erro ao excluir turno:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir turno",
        variant: "destructive"
      });
    } finally {
      setDeleting(null);
    }
  };

  const updateSchedule = (dayIndex: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      schedules: prev.schedules.map((schedule, index) => 
        index === dayIndex ? { ...schedule, [field]: value } : schedule
      )
    }));
  };

  const formatScheduleDisplay = (schedules: WorkShiftSchedule[]) => {
    const activeSchedules = schedules.filter(s => s.is_active);
    if (activeSchedules.length === 0) return 'Nenhum horário definido';
    
    return activeSchedules.map(schedule => {
      const day = DAYS_OF_WEEK.find(d => d.value === schedule.day_of_week);
      return `${day?.label}: ${schedule.start_time.substring(0, 5)} - ${schedule.end_time.substring(0, 5)}`;
    }).join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Configurações do Sistema */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configurações de Turnos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">
                Habilitar turnos de trabalho personalizados
              </Label>
              <p className="text-sm text-muted-foreground">
                Quando habilitado, funcionários podem ter turnos específicos que controlam os horários de registro de ponto
              </p>
            </div>
            <Switch
              checked={systemSettings.work_shifts_enabled}
              onCheckedChange={(checked) => 
                setSystemSettings(prev => ({ ...prev, work_shifts_enabled: checked }))
              }
              disabled={savingSettings}
            />
          </div>

          <div className="space-y-4">
            <Label className="text-base font-medium">
              Minutos de tolerância antes e depois do horário de entrada para registro de ponto
            </Label>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min="0"
                max="60"
                value={systemSettings.time_tolerance_minutes}
                onChange={(e) => 
                  setSystemSettings(prev => ({ 
                    ...prev, 
                    time_tolerance_minutes: parseInt(e.target.value) || 0 
                  }))
                }
                disabled={savingSettings}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">minutos</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Define o tempo em que o botão de registro ficará habilitado antes e depois do horário previsto
            </p>
          </div>

          <Button onClick={saveSystemSettings} disabled={savingSettings}>
            {savingSettings ? (
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

      {/* Turnos de Trabalho */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Turnos de Trabalho
          </CardTitle>
          <Button 
            onClick={openCreateDialog} 
            size="sm"
            disabled={!systemSettings.work_shifts_enabled}
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Turno
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!systemSettings.work_shifts_enabled ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Habilite os turnos personalizados para gerenciar turnos de trabalho</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Carregando turnos...</span>
            </div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum turno de trabalho cadastrado
            </div>
          ) : (
            <div className="space-y-4">
              {shifts.map((shift) => (
                <div key={shift.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{shift.name}</h4>
                        <div className={`w-2 h-2 rounded-full ${shift.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                      </div>
                      {shift.description && (
                        <p className="text-sm text-muted-foreground">{shift.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatScheduleDisplay(shift.schedules)}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(shift)}
                        disabled={deleting === shift.id}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(shift)}
                        disabled={deleting === shift.id}
                        className="text-red-600 hover:text-red-700"
                      >
                        {deleting === shift.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Dialog para criar/editar turno */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingShift ? 'Editar Turno' : 'Novo Turno'}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="shift-name">Nome do Turno *</Label>
                    <Input
                      id="shift-name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Manhã, Tarde, Noite"
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shift-description">Descrição</Label>
                    <Input
                      id="shift-description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descrição opcional"
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-base font-medium">Horários por Dia da Semana</Label>
                  <div className="space-y-3">
                    {DAYS_OF_WEEK.map((day, index) => (
                      <div key={day.value} className="flex items-center gap-4 p-3 border rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`day-${day.value}`}
                            checked={formData.schedules[index].is_active}
                            onCheckedChange={(checked) => 
                              updateSchedule(index, 'is_active', checked)
                            }
                            disabled={saving}
                          />
                          <Label htmlFor={`day-${day.value}`} className="w-20 text-sm">
                            {day.label}
                          </Label>
                        </div>

                        {formData.schedules[index].is_active && (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              type="time"
                              value={formData.schedules[index].start_time}
                              onChange={(e) => updateSchedule(index, 'start_time', e.target.value)}
                              disabled={saving}
                              className="w-32"
                            />
                            <span className="text-muted-foreground">até</span>
                            <Input
                              type="time"
                              value={formData.schedules[index].end_time}
                              onChange={(e) => updateSchedule(index, 'end_time', e.target.value)}
                              disabled={saving}
                              className="w-32"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    editingShift ? 'Salvar Alterações' : 'Criar Turno'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkShiftsManagement;