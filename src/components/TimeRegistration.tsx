
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Clock, Coffee, LogIn, LogOut, Edit2, Check, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  hourlyRate: number;
  overtimeRate: number;
}

interface TimeRecord {
  id: string;
  date: string;
  clockIn?: string;
  lunchStart?: string;
  lunchEnd?: string;
  clockOut?: string;
  totalHours: number;
  normalHours: number;
  overtimeHours: number;
  normalPay: number;
  overtimePay: number;
  totalPay: number;
}

interface TimeRegistrationProps {
  record: TimeRecord;
  onUpdate: (record: TimeRecord) => void;
  user: User;
}

const TimeRegistration: React.FC<TimeRegistrationProps> = ({ record, onUpdate, user }) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [message, setMessage] = useState('');

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const calculateHours = (clockIn?: string, lunchStart?: string, lunchEnd?: string, clockOut?: string) => {
    if (!clockIn || !clockOut) return { totalHours: 0, normalHours: 0, overtimeHours: 0 };

    const parseTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours + minutes / 60;
    };

    const clockInHours = parseTime(clockIn);
    const clockOutHours = parseTime(clockOut);
    const lunchStartHours = lunchStart ? parseTime(lunchStart) : 0;
    const lunchEndHours = lunchEnd ? parseTime(lunchEnd) : 0;

    let totalHours = clockOutHours - clockInHours;

    if (lunchStart && lunchEnd && lunchEndHours > lunchStartHours) {
      totalHours -= (lunchEndHours - lunchStartHours);
    }

    totalHours = Math.max(0, totalHours);

    const normalHours = Math.min(totalHours, 8);
    const overtimeHours = Math.max(0, totalHours - 8);

    return { totalHours, normalHours, overtimeHours };
  };

  const handleRegisterTime = (field: 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut') => {
    const currentTime = getCurrentTime();
    const updatedRecord = { ...record, [field]: currentTime };
    
    const { totalHours, normalHours, overtimeHours } = calculateHours(
      updatedRecord.clockIn,
      updatedRecord.lunchStart,
      updatedRecord.lunchEnd,
      updatedRecord.clockOut
    );

    const normalPay = normalHours * user.hourlyRate;
    const overtimePay = overtimeHours * user.overtimeRate;
    const totalPay = normalPay + overtimePay;

    const finalRecord = {
      ...updatedRecord,
      totalHours,
      normalHours,
      overtimeHours,
      normalPay,
      overtimePay,
      totalPay
    };

    onUpdate(finalRecord);
    setMessage(`${getFieldLabel(field)} registrado: ${currentTime}`);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleEdit = (field: string, value?: string) => {
    setEditingField(field);
    setEditValue(value || '');
    setEditReason('');
  };

  const handleSaveEdit = () => {
    if (!editingField || !editReason.trim()) {
      setMessage('Por favor, informe o motivo da alteração');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const currentValue = record[editingField as keyof TimeRecord] as string || '';
    
    if (currentValue === editValue) {
      setMessage('O novo valor deve ser diferente do atual');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Criar solicitação de edição
    const editRequest = {
      id: `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      employeeId: user.id,
      employeeName: user.name,
      date: record.date,
      field: editingField as 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut',
      oldValue: currentValue,
      newValue: editValue,
      reason: editReason,
      timestamp: new Date().toISOString(),
      status: 'pending' as const
    };

    // Salvar solicitação no localStorage
    const existingRequests = localStorage.getItem('tcponto_edit_requests');
    const requests = existingRequests ? JSON.parse(existingRequests) : [];
    requests.push(editRequest);
    localStorage.setItem('tcponto_edit_requests', JSON.stringify(requests));

    setEditingField(null);
    setEditValue('');
    setEditReason('');
    setMessage('Solicitação de alteração enviada para aprovação administrativa');
    setTimeout(() => setMessage(''), 5000);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
    setEditReason('');
  };

  const getFieldLabel = (field: string) => {
    switch (field) {
      case 'clockIn': return 'Entrada';
      case 'lunchStart': return 'Início do Almoço';
      case 'lunchEnd': return 'Fim do Almoço';
      case 'clockOut': return 'Saída';
      default: return field;
    }
  };

  const getFieldIcon = (field: string) => {
    switch (field) {
      case 'clockIn': return LogIn;
      case 'lunchStart': return Coffee;
      case 'lunchEnd': return Coffee;
      case 'clockOut': return LogOut;
      default: return Clock;
    }
  };

  const timeFields = [
    { key: 'clockIn', label: 'Entrada', value: record.clockIn, color: 'bg-green-500' },
    { key: 'lunchStart', label: 'Início Almoço', value: record.lunchStart, color: 'bg-orange-500' },
    { key: 'lunchEnd', label: 'Fim Almoço', value: record.lunchEnd, color: 'bg-orange-500' },
    { key: 'clockOut', label: 'Saída', value: record.clockOut, color: 'bg-red-500' }
  ];

  return (
    <div className="space-y-6">
      {message && (
        <Alert className="border-accent-200 bg-accent-50">
          <Clock className="h-4 w-4" />
          <AlertDescription className="text-accent-800">
            {message}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {timeFields.map(({ key, label, value, color }) => {
          const Icon = getFieldIcon(key);
          
          return (
            <Card key={key} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${color}`} />
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {editingField === key ? (
                  <div className="space-y-2">
                    <Input
                      type="time"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="text-center"
                    />
                    <Textarea
                      placeholder="Motivo da alteração (obrigatório)"
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      className="text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        className="flex-1 bg-accent-600 hover:bg-accent-700"
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                        className="flex-1"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary-900">
                        {value || '--:--'}
                      </div>
                      {value && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(key, value)}
                          className="mt-1 text-xs text-gray-500 hover:text-gray-700"
                        >
                          <Edit2 className="w-3 h-3 mr-1" />
                          Solicitar Edição
                        </Button>
                      )}
                    </div>
                    
                    {!value && (
                      <Button
                        onClick={() => handleRegisterTime(key as any)}
                        className={`w-full ${color} hover:opacity-90 text-white`}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        Registrar
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Resumo do Dia */}
      <Card className="bg-gradient-to-r from-primary-50 to-accent-50">
        <CardHeader>
          <CardTitle className="text-primary-900">Resumo do Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600">Horas Normais</p>
              <p className="text-xl font-bold text-primary-900">
                {record.normalHours.toFixed(1)}h
              </p>
              <p className="text-sm text-accent-600">
                R$ {record.normalPay.toFixed(2)}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Horas Extras</p>
              <p className="text-xl font-bold text-orange-600">
                {record.overtimeHours.toFixed(1)}h
              </p>
              <p className="text-sm text-accent-600">
                R$ {record.overtimePay.toFixed(2)}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Total Horas</p>
              <p className="text-xl font-bold text-primary-900">
                {record.totalHours.toFixed(1)}h
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Total Ganho</p>
              <p className="text-xl font-bold text-accent-600">
                R$ {record.totalPay.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TimeRegistration;
