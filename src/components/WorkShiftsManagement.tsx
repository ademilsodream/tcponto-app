
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
import { Loader2, Plus, Edit, Trash2, Clock, AlertCircle } from 'lucide-react';

interface WorkShift {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  early_tolerance_minutes?: number;
  late_tolerance_minutes?: number;
  break_tolerance_minutes?: number;
  schedules: WorkShiftSchedule[];
}

interface WorkShiftSchedule {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start_time?: string;
  break_end_time?: string;
  is_active: boolean;
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
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    early_tolerance_minutes: 15,
    late_tolerance_minutes: 15,
    break_tolerance_minutes: 5,
    schedules: DAYS_OF_WEEK.map(day => ({
      day_of_week: day.value,
      start_time: '08:00',
      end_time: '17:00',
      break_start_time: '12:00',
      break_end_time: '13:00',
      is_active: false
    }))
  });

  const { toast } = useToast();

  useEffect(() => {
    loadShifts();
  }, []);

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
      early_tolerance_minutes: 15,
      late_tolerance_minutes: 15,
      break_tolerance_minutes: 5,
      schedules: DAYS_OF_WEEK.map(day => ({
        day_of_week: day.value,
        start_time: '08:00',
        end_time: '17:00',
        break_start_time: '12:00',
        break_end_time: '13:00',
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
      early_tolerance_minutes: shift.early_tolerance_minutes || 15,
      late_tolerance_minutes: shift.late_tolerance_minutes || 15,
      break_tolerance_minutes: shift.break_tolerance_minutes || 5,
      schedules: DAYS_OF_WEEK.map(day => {
        const existingSchedule = shift.schedules.find(s => s.day_of_week === day.value);
        return existingSchedule ? {
          ...existingSchedule,
          start_time: existingSchedule.start_time.substring(0, 5),
          end_time: existingSchedule.end_time.substring(0, 5),
          break_start_time: existingSchedule.break_start_time?.substring(0, 5) || '12:00',
          break_end_time: existingSchedule.break_end_time?.substring(0, 5) || '13:00'
        } : {
          day_of_week: day.value,
          start_time: '08:00',
          end_time: '17:00',
          break_start_time: '12:00',
          break_end_time: '13:00',
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

    // Validação das tolerâncias
    if (formData.early_tolerance_minutes < 0 || formData.late_tolerance_minutes < 0 || formData.break_tolerance_minutes < 0) {
      toast({
        title: "Erro",
        description: "As tolerâncias não podem ser negativas",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);
      console.log('💾 Iniciando salvamento do turno...');

      // Usar método tradicional direto
      await handleSaveTraditional();
    } catch (error: any) {
      console.error('💥 Erro ao salvar turno:', error);
      toast({
        title: "Erro",
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTraditional = async () => {
    const activeSchedules = formData.schedules.filter(s => s.is_active);
    
    const shiftData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      early_tolerance_minutes: formData.early_tolerance_minutes,
      late_tolerance_minutes: formData.late_tolerance_minutes,
      break_tolerance_minutes: formData.break_tolerance_minutes,
      is_active: true
    };

    if (editingShift) {
      console.log('📝 Atualizando turno existente:', editingShift.id);
      
      // Atualizar turno existente
      const { error: shiftError } = await supabase
        .from('work_shifts')
        .update(shiftData)
        .eq('id', editingShift.id);

      if (shiftError) {
        console.error('❌ Erro ao atualizar turno:', shiftError);
        throw shiftError;
      }

      // Deletar horários existentes
      const { error: deleteError } = await supabase
        .from('work_shift_schedules')
        .delete()
        .eq('shift_id', editingShift.id);

      if (deleteError) {
        console.error('❌ Erro ao deletar horários:', deleteError);
        throw deleteError;
      }

      // Inserir novos horários
      if (activeSchedules.length > 0) {
        const schedulesToInsert = activeSchedules.map(schedule => ({
          shift_id: editingShift.id,
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          break_start_time: schedule.break_start_time || null,
          break_end_time: schedule.break_end_time || null,
          is_active: true
        }));

        const { error: insertError } = await supabase
          .from('work_shift_schedules')
          .insert(schedulesToInsert);

        if (insertError) {
          console.error('❌ Erro ao inserir novos horários:', insertError);
          throw insertError;
        }
      }

      console.log('✅ Turno atualizado com sucesso');
    } else {
      console.log('➕ Criando novo turno...');
      
      // Criar novo turno
      const { data: newShift, error: shiftError } = await supabase
        .from('work_shifts')
        .insert(shiftData)
        .select()
        .single();

      if (shiftError) {
        console.error('❌ Erro ao criar turno:', shiftError);
        throw shiftError;
      }

      console.log('✅ Novo turno criado:', newShift.id);

      // Inserir horários
      if (activeSchedules.length > 0) {
        const schedulesToInsert = activeSchedules.map(schedule => ({
          shift_id: newShift.id,
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          break_start_time: schedule.break_start_time || null,
          break_end_time: schedule.break_end_time || null,
          is_active: true
        }));

        const { error: insertError } = await supabase
          .from('work_shift_schedules')
          .insert(schedulesToInsert);

        if (insertError) {
          console.error('❌ Erro ao inserir horários do novo turno:', insertError);
          throw insertError;
        }
      }

      console.log('✅ Horários do novo turno inseridos com sucesso');
    }

    toast({
      title: "Sucesso",
      description: editingShift ? "Turno atualizado com sucesso" : "Turno criado com sucesso"
    });

    setIsDialogOpen(false);
    await loadShifts();
  };

  const handleDelete = async (shift: WorkShift) => {
    if (!confirm(`Tem certeza que deseja excluir o turno "${shift.name}"?`)) {
      return;
    }

    try {
      setDeleting(shift.id);
      console.log('🗑️ Excluindo turno:', shift.id);

      const { error } = await supabase
        .from('work_shifts')
        .delete()
        .eq('id', shift.id);

      if (error) {
        console.error('❌ Erro ao excluir turno:', error);
        throw error;
      }

      console.log('✅ Turno excluído com sucesso');
      toast({
        title: "Sucesso",
        description: "Turno excluído com sucesso"
      });

      await loadShifts();
    } catch (error: any) {
      console.error('💥 Erro ao excluir turno:', error);
      toast({
        title: "Erro",
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setDeleting(null);
    }
  };

  const toggleShiftStatus = async (shift: WorkShift) => {
    try {
      console.log(`🔄 Alterando status do turno ${shift.id} de ${shift.is_active} para ${!shift.is_active}`);
      
      const { error } = await supabase
        .from('work_shifts')
        .update({ is_active: !shift.is_active })
        .eq('id', shift.id);
      
      if (error) {
        console.error('❌ Erro ao atualizar status do turno:', error);
        throw error;
      }
      
      console.log('✅ Status do turno atualizado com sucesso');
      
      toast({
        title: "Sucesso",
        description: `Turno ${!shift.is_active ? 'ativado' : 'desativado'} com sucesso`
      });
      
      await loadShifts();
    } catch (error) {
      console.error('💥 Erro crítico ao atualizar status do turno:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status do turno",
        variant: "destructive"
      });
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

  const formatToleranceDisplay = (shift: WorkShift) => {
    const tolerances = [];
    if (shift.early_tolerance_minutes) tolerances.push(`Antecipada: ${shift.early_tolerance_minutes}min`);
    if (shift.late_tolerance_minutes) tolerances.push(`Atraso: ${shift.late_tolerance_minutes}min`);
    if (shift.break_tolerance_minutes) tolerances.push(`Intervalo: ${shift.break_tolerance_minutes}min`);
    return tolerances.length > 0 ? tolerances.join(' | ') : 'Sem tolerância';
  };

  const getErrorMessage = (error: any): string => {
    if (error?.message) {
      // Traduzir mensagens de erro comuns
      const translations: { [key: string]: string } = {
        'duplicate key value violates unique constraint': 'Já existe um turno com este nome',
        'column does not exist': 'Estrutura do banco de dados incompatível. Verifique se as colunas de tolerância foram adicionadas.',
        'permission denied': 'Permissão negada para esta operação',
        'connection refused': 'Erro de conexão com o banco de dados'
      };

      for (const [key, translation] of Object.entries(translations)) {
        if (error.message.toLowerCase().includes(key)) {
          return translation;
        }
      }

      return error.message;
    }
    
    return 'Erro desconhecido ao processar solicitação';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Turnos de Trabalho
        </CardTitle>
        <Button onClick={openCreateDialog} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Novo Turno
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
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
                      <span className="text-xs text-muted-foreground">
                        {shift.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    {shift.description && (
                      <p className="text-sm text-muted-foreground">{shift.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatScheduleDisplay(shift.schedules)}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-orange-600">
                      <AlertCircle className="w-3 h-3" />
                      <span>Tolerâncias: {formatToleranceDisplay(shift)}</span>
                    </div>
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

                    <Button
                      variant={shift.is_active ? "destructive" : "default"}
                      size="sm"
                      onClick={() => toggleShiftStatus(shift)}
                      disabled={deleting === shift.id}
                    >
                      {shift.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dialog para criar/editar turno */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
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

              {/* Seção de Configurações de Tolerância para o Botão */}
              <div className="space-y-4 p-4 border rounded-lg bg-orange-50">
                <Label className="text-base font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Tolerância para Habilitação do Botão de Ponto
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="early-tolerance">Antes do Horário (min)</Label>
                    <Input
                      id="early-tolerance"
                      type="number"
                      min="0"
                      max="60"
                      value={formData.early_tolerance_minutes}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        early_tolerance_minutes: parseInt(e.target.value) || 0 
                      }))}
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="late-tolerance">Depois do Horário (min)</Label>
                    <Input
                      id="late-tolerance"
                      type="number"
                      min="0"
                      max="60"
                      value={formData.late_tolerance_minutes}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        late_tolerance_minutes: parseInt(e.target.value) || 0 
                      }))}
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="break-tolerance">Tolerância Intervalo (min)</Label>
                    <Input
                      id="break-tolerance"
                      type="number"
                      min="0"
                      max="30"
                      value={formData.break_tolerance_minutes}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        break_tolerance_minutes: parseInt(e.target.value) || 0 
                      }))}
                      disabled={saving}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Define quando o botão de registro fica habilitado antes e depois do horário previsto.
                </p>
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium">Jornada por Dia da Semana</Label>
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
                        <div className="flex items-center gap-2 flex-1 flex-wrap">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Entrada:</span>
                            <Input
                              type="time"
                              value={formData.schedules[index].start_time}
                              onChange={(e) => updateSchedule(index, 'start_time', e.target.value)}
                              disabled={saving}
                              className="w-24"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Início Almoço:</span>
                            <Input
                              type="time"
                              value={formData.schedules[index].break_start_time}
                              onChange={(e) => updateSchedule(index, 'break_start_time', e.target.value)}
                              disabled={saving}
                              className="w-24"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Saída Almoço:</span>
                            <Input
                              type="time"
                              value={formData.schedules[index].break_end_time}
                              onChange={(e) => updateSchedule(index, 'break_end_time', e.target.value)}
                              disabled={saving}
                              className="w-24"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Saída:</span>
                            <Input
                              type="time"
                              value={formData.schedules[index].end_time}
                              onChange={(e) => updateSchedule(index, 'end_time', e.target.value)}
                              disabled={saving}
                              className="w-24"
                            />
                          </div>
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
  );
};

export default WorkShiftsManagement;
