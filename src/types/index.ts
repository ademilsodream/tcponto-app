
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourlyRate: number;
  overtimeRate: number;
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
}
