// src/components/WorkShiftsManagement.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client'; // Assuming this path
import { Loader2, PlusCircle, Edit, Trash2, Clock } from 'lucide-react'; // Added icons

// Define types for clarity
interface WorkShiftSchedule {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start_time: string; // Added
  break_end_time: string; // Added
  is_active: boolean;
}

interface WorkShift {
  id?: string;
  name: string;
  description: string;
  is_active: boolean;
  early_tolerance_minutes: number;
  late_tolerance_minutes: number;
  break_tolerance_minutes: number;
  schedules: WorkShiftSchedule[];
}

const initialScheduleState: WorkShiftSchedule[] = [
  { day_of_week: 0, start_time: '', end_time: '', break_start_time: '', break_end_time: '', is_active: false }, // Sunday
  { day_of_week: 1, start_time: '', end_time: '', break_start_time: '', break_end_time: '', is_active: false }, // Monday
  { day_of_week: 2, start_time: '', end_time: '', break_start_time: '', break_end_time: '', is_active: false }, // Tuesday
  { day_of_week: 3, start_time: '', end_time: '', break_start_time: '', break_end_time: '', is_active: false }, // Wednesday
  { day_of_week: 4, start_time: '', end_time: '', break_start_time: '', break_end_time: '', is_active: false }, // Thursday
  { day_of_week: 5, start_time: '', end_time: '', break_start_time: '', break_end_time: '', is_active: false }, // Friday
  { day_of_week: 6, start_time: '', end_time: '', break_start_time: '', break_end_time: '', is_active: false }, // Saturday
];

const dayLabels = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];


const WorkShiftsManagement = () => {
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<WorkShift | null>(null);
  const [formData, setFormData] = useState<WorkShift>({
    name: '',
    description: '',
    is_active: true,
    early_tolerance_minutes: 15,
    late_tolerance_minutes: 15,
    break_tolerance_minutes: 5,
    schedules: initialScheduleState,
  });

  const { toast } = useToast();

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      // Fetch shifts and their schedules
      const { data, error } = await supabase
        .from('work_shifts')
        .select(`
          *,
          schedules:work_shift_schedules(*)
        `);

      if (error) throw error;

      // Map fetched data to state format, ensuring all days are present
      const formattedShifts = data.map(shift => {
        const schedulesMap = new Map(shift.schedules.map(s => [s.day_of_week, s]));
        const fullSchedules = initialScheduleState.map(initialDay => {
          const existing = schedulesMap.get(initialDay.day_of_week);
          return existing ? { ...initialDay, ...existing } : initialDay;
        });
        return {
          ...shift,
          schedules: fullSchedules.sort((a, b) => a.day_of_week - b.day_of_week), // Ensure consistent order
        };
      });

      setShifts(formattedShifts);
    } catch (error) {
      console.error('Error fetching shifts:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar turnos de trabalho",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewShift = () => {
    setEditingShift(null);
    setFormData({
      name: '',
      description: '',
      is_active: true,
      early_tolerance_minutes: 15,
      late_tolerance_minutes: 15,
      break_tolerance_minutes: 5,
      schedules: initialScheduleState,
    });
    setIsDialogOpen(true);
  };

  const handleEditShift = (shift: WorkShift) => {
    setEditingShift(shift);
    // Deep copy schedules to avoid modifying original state directly
    const schedulesCopy = initialScheduleState.map(initialDay => {
        const existing = shift.schedules.find(s => s.day_of_week === initialDay.day_of_week);
        return existing ? { ...initialDay, ...existing } : initialDay;
    });

    setFormData({
      ...shift,
      schedules: schedulesCopy.sort((a, b) => a.day_of_week - b.day_of_week),
    });
    setIsDialogOpen(true);
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm("Tem certeza que deseja excluir este turno? Esta ação não pode ser desfeita.")) {
      return;
    }
    try {
      // Note: Supabase foreign key with ON DELETE SET NULL on employee_work_schedules
      // means employees assigned to this shift will have their shift_id set to NULL.
      const { error } = await supabase
        .from('work_shifts')
        .delete()
        .eq('id', shiftId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Turno excluído com sucesso"
      });
      fetchShifts(); // Refresh the list
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir turno",
        variant: "destructive"
      });
    }
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 })); // Parse to integer
  };

  const handleSwitchChange = (name: keyof WorkShift) => (checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const updateSchedule = (index: number, field: keyof WorkShiftSchedule, value: string | boolean) => {
    setFormData(prev => {
      const newSchedules = [...prev.schedules];
      (newSchedules[index] as any)[field] = value; // Type assertion for dynamic field update
      return { ...prev, schedules: newSchedules };
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const shiftDataToSave = {
        id: formData.id, // Will be undefined for new shifts
        name: formData.name,
        description: formData.description,
        is_active: formData.is_active,
        early_tolerance_minutes: formData.early_tolerance_minutes,
        late_tolerance_minutes: formData.late_tolerance_minutes,
        break_tolerance_minutes: formData.break_tolerance_minutes,
      };

      let savedShiftId = formData.id;

      // Save/Update the main work_shift record
      if (editingShift) {
        // Update existing shift
        const { data, error } = await supabase
          .from('work_shifts')
          .update(shiftDataToSave)
          .eq('id', editingShift.id)
          .select() // Select updated row to get id if needed (though we have it)
          .single();

        if (error) throw error;
        savedShiftId = data.id;

      } else {
        // Insert new shift
        const { data, error } = await supabase
          .from('work_shifts')
          .insert(shiftDataToSave)
          .select() // Select inserted row to get the new id
          .single();

        if (error) throw error;
        savedShiftId = data.id;
      }

      // Save/Update the work_shift_schedules
      // Delete existing schedules for this shift first (simpler upsert approach)
       if (savedShiftId) {
         const { error: deleteError } = await supabase
           .from('work_shift_schedules')
           .delete()
           .eq('shift_id', savedShiftId);

         if (deleteError) throw deleteError;

         // Prepare schedules for insert, adding the shift_id
         const schedulesToInsert = formData.schedules
           .filter(s => s.is_active) // Only save active schedules
           .map(s => ({
             shift_id: savedShiftId,
             day_of_week: s.day_of_week,
             start_time: s.start_time,
             end_time: s.end_time,
             break_start_time: s.break_start_time, // Include break times
             break_end_time: s.break_end_time, // Include break times
             is_active: s.is_active,
           }));

         if (schedulesToInsert.length > 0) {
            const { error: insertSchedulesError } = await supabase
              .from('work_shift_schedules')
              .insert(schedulesToInsert);

            if (insertSchedulesError) throw insertSchedulesError;
         }
       }


      toast({
        title: "Sucesso",
        description: `Turno ${editingShift ? 'atualizado' : 'criado'} com sucesso`
      });

      setIsDialogOpen(false);
      fetchShifts(); // Refresh the list
    } catch (error) {
      console.error('Error saving shift:', error);
      toast({
        title: "Erro",
        description: `Erro ao ${editingShift ? 'atualizar' : 'criar'} turno`,
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
          <span>Carregando turnos...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Turnos de Trabalho
        </CardTitle>
        <Button size="sm" onClick={handleNewShift}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Novo Turno
        </Button>
      </CardHeader>
      <CardContent>
        {shifts.length === 0 ? (
          <p className="text-muted-foreground">Nenhum turno cadastrado ainda.</p>
        ) : (
          <div className="grid gap-4">
            {shifts.map(shift => (
              <div key={shift.id} className="border p-4 rounded-md shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold">{shift.name}</h3>
                    <p className="text-sm text-muted-foreground">{shift.description}</p>
                    <div className="text-xs text-muted-foreground mt-1">
                        Tolerância: Entrada Antecipada: {shift.early_tolerance_minutes}min, Atraso: {shift.late_tolerance_minutes}min, Intervalo: {shift.break_tolerance_minutes}min
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEditShift(shift)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" color="danger" onClick={() => handleDeleteShift(shift.id!)}>
                       {/* Using ! assuming id exists for existing shifts */}
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 text-sm">
                    <p className="font-medium">Horários:</p>
                    {dayLabels.map(day => {
                        const schedule = shift.schedules.find(s => s.day_of_week === day.value);
                        if (schedule && schedule.is_active) {
                            return (
                                <p key={day.value} className="text-muted-foreground ml-2">
                                    {day.label}: {schedule.start_time} - {schedule.end_time} (Intervalo: {schedule.break_start_time} - {schedule.break_end_time})
                                </p>
                            );
                        }
                        return null; // Don't show inactive days
                    })}
                     {shift.schedules.filter(s => s.is_active).length === 0 && (
                         <p className="text-muted-foreground ml-2">Nenhum horário definido para dias ativos.</p>
                     )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Dialog for adding/editing shift */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Editar Turno' : 'Novo Turno'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nome
              </Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="col-span-3"
                disabled={saving}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Descrição
              </Label>
              <Input
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="col-span-3"
                disabled={saving}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="is_active" className="text-right">
                Ativo
              </Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={handleSwitchChange('is_active')}
                disabled={saving}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="early_tolerance_minutes" className="text-right">
                Tolerância Entrada Antecipada (min)
              </Label>
              <Input
                id="early_tolerance_minutes"
                name="early_tolerance_minutes"
                type="number"
                min="0"
                max="60"
                value={formData.early_tolerance_minutes}
                onChange={handleNumberInputChange}
                className="col-span-3"
                disabled={saving}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="late_tolerance_minutes" className="text-right">
                Tolerância Atraso (min)
              </Label>
              <Input
                id="late_tolerance_minutes"
                name="late_tolerance_minutes"
                type="number"
                min="0"
                max="60"
                value={formData.late_tolerance_minutes}
                onChange={handleNumberInputChange}
                className="col-span-3"
                disabled={saving}
              />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="break_tolerance_minutes" className="text-right">
                Tolerância Intervalo (min)
              </Label>
              <Input
                id="break_tolerance_minutes"
                name="break_tolerance_minutes"
                type="number"
                min="0"
                max="30"
                value={formData.break_tolerance_minutes}
                onChange={handleNumberInputChange}
                className="col-span-3"
                disabled={saving}
              />
            </div>


            <div className="col-span-4">
              <h4 className="text-md font-medium mb-2">Horários por Dia</h4>
              {dayLabels.map((day, index) => (
                <div key={day.value} className="flex items-center gap-4 mb-2">
                  <div className="flex items-center gap-2 w-32">
                    <Switch
                      id={`day-${day.value}`}
                      checked={formData.schedules[index]?.is_active || false} // Ensure default is false
                      onCheckedChange={(checked) => updateSchedule(index, 'is_active', checked)}
                      disabled={saving}
                    />
                    <Label htmlFor={`day-${day.value}`}>
                      {day.label}
                    </Label>
                  </div>


                  {formData.schedules[index]?.is_active && (
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={formData.schedules[index]?.start_time || ''} // Ensure default is empty string
                          onChange={(e) => updateSchedule(index, 'start_time', e.target.value)}
                          disabled={saving}
                          className="w-24"
                        />
                        <span className="text-xs text-muted-foreground">às</span>
                        <Input
                          type="time"
                          value={formData.schedules[index]?.end_time || ''} // Ensure default is empty string
                          onChange={(e) => updateSchedule(index, 'end_time', e.target.value)}
                          disabled={saving}
                          className="w-24"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Intervalo:</span>
                        <Input
                          type="time"
                          value={formData.schedules[index]?.break_start_time || ''} // Ensure default is empty string
                          onChange={(e) => updateSchedule(index, 'break_start_time', e.target.value)}
                          disabled={saving}
                          className="w-24"
                        />
                        <span className="text-xs text-muted-foreground">às</span>
                        <Input
                          type="time"
                          value={formData.schedules[index]?.break_end_time || ''} // Ensure default is empty string
                          onChange={(e) => updateSchedule(index, 'break_end_time', e.target.value)}
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
    </Card>
  );
};


export default WorkShiftsManagement;
