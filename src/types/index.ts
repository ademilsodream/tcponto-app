export interface User {
  id: string;
  name: string;
  email: string;
  hourlyRate: number;
  overtimeRate: number;
  employeeCode?: string;
}

export interface TimeRecord {
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
  locations?: any;
}

export interface EditRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  field: 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut';
  oldValue: string;
  newValue: string;
  reason: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
  location?: {
    latitude: number;
    longitude: number;
    timestamp: string;
    address: string;
  };
}

export interface AllowedLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  range_meters: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// Novas interfaces para Banco de Horas
export interface HourBankBalance {
  id: string;
  employee_id: string;
  current_balance: number;
  last_updated: string;
  created_at: string;
}

export interface HourBankTransaction {
  id: string;
  employee_id: string;
  time_record_id?: string;
  transaction_type: 'ACUMULO' | 'DESCONTO' | 'AJUSTE_MANUAL' | 'EXPIRACAO';
  hours_amount: number;
  previous_balance: number;
  new_balance: number;
  description?: string;
  transaction_date: string;
  expiration_date?: string;
  created_at: string;
}

export interface EmployeeWorkSchedule {
  id: string;
  employee_id: string;
  daily_hours: number;
  weekly_hours?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HourBankSettings {
  usar_banco_horas: boolean;
  limite_maximo_horas: number;
  validade_horas_meses: number;
  jornada_padrao_horas: number;
}

export interface HourBankSummary {
  accumulated: number;
  discounted: number;
  currentBalance: number;
  transactions: HourBankTransaction[];
}

// Interface para Períodos Bloqueados
export interface BlockedPeriod {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  created_by: string | null;
  created_at: string;
}
