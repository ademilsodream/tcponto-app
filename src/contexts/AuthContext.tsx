
import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  hourlyRate: number;
  overtimeRate: number;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users para demonstração
const mockUsers: User[] = [
  {
    id: '1',
    name: 'João Silva',
    email: 'joao@tcponto.com',
    role: 'employee',
    hourlyRate: 25,
    overtimeRate: 25
  },
  {
    id: '2',
    name: 'Maria Santos',
    email: 'maria@tcponto.com',
    role: 'employee',
    hourlyRate: 30,
    overtimeRate: 30
  },
  {
    id: '3',
    name: 'Carlos Oliveira',
    email: 'carlos@tcponto.com',
    role: 'employee',
    hourlyRate: 35,
    overtimeRate: 35
  },
  {
    id: '4',
    name: 'Admin Sistema',
    email: 'admin@tcponto.com',
    role: 'admin',
    hourlyRate: 50,
    overtimeRate: 50
  }
];

const generateSampleData = () => {
  const locations = [
    { lat: 38.7223, lng: -9.1393, address: "Av. da Liberdade, 1250-096 Lisboa, Portugal" },
    { lat: 41.1579, lng: -8.6291, address: "R. de Santa Catarina, 4000-447 Porto, Portugal" },
    { lat: 38.7071, lng: -9.1359, address: "Praça do Comércio, 1100-148 Lisboa, Portugal" },
    { lat: 38.7169, lng: -9.1399, address: "Rua Augusta, 1100-053 Lisboa, Portugal" },
    { lat: 41.1496, lng: -8.6109, address: "Av. dos Aliados, 4000-064 Porto, Portugal" }
  ];

  const employees = mockUsers.filter(user => user.role === 'employee');

  employees.forEach(employee => {
    const records = [];
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const today = currentDate.getDate();

    // Gerar registros para todos os dias úteis do mês até hoje
    for (let day = 1; day <= today; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const dayOfWeek = date.getDay();
      
      // Apenas dias úteis (segunda a sexta)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const dateStr = date.toISOString().split('T')[0];
        
        // Horários variados para cada funcionário
        const baseClockIn = employee.id === '1' ? '08:00' : employee.id === '2' ? '09:00' : '08:30';
        const baseLunchStart = employee.id === '1' ? '12:00' : employee.id === '2' ? '12:30' : '13:00';
        const baseLunchEnd = employee.id === '1' ? '13:00' : employee.id === '2' ? '13:30' : '14:00';
        const baseClockOut = employee.id === '1' ? '17:00' : employee.id === '2' ? '18:00' : '17:30';
        
        // Adicionar variação aleatória de alguns minutos
        const variance = () => Math.floor(Math.random() * 20) - 10; // -10 a +10 minutos
        
        const clockIn = addMinutes(baseClockIn, variance());
        const lunchStart = addMinutes(baseLunchStart, variance());
        const lunchEnd = addMinutes(baseLunchEnd, variance());
        const clockOut = addMinutes(baseClockOut, variance());
        
        // Calcular horas
        const totalMinutes = calculateTotalMinutes(clockIn, lunchStart, lunchEnd, clockOut);
        const totalHours = totalMinutes / 60;
        const normalHours = Math.min(totalHours, 8);
        const overtimeHours = Math.max(0, totalHours - 8);
        const normalPay = normalHours * employee.hourlyRate;
        const overtimePay = overtimeHours * employee.overtimeRate * 1.5;
        const totalPay = normalPay + overtimePay;
        
        // Localização aleatória para cada registro
        const randomLocation = locations[Math.floor(Math.random() * locations.length)];
        
        const record = {
          id: `${employee.id}_${dateStr}`,
          date: dateStr,
          clockIn,
          lunchStart,
          lunchEnd,
          clockOut,
          totalHours: Math.round(totalHours * 10) / 10,
          normalHours: Math.round(normalHours * 10) / 10,
          overtimeHours: Math.round(overtimeHours * 10) / 10,
          normalPay: Math.round(normalPay * 100) / 100,
          overtimePay: Math.round(overtimePay * 100) / 100,
          totalPay: Math.round(totalPay * 100) / 100,
          locations: {
            clockIn: {
              ...randomLocation,
              lat: randomLocation.lat + (Math.random() - 0.5) * 0.001,
              lng: randomLocation.lng + (Math.random() - 0.5) * 0.001,
              timestamp: new Date(`${dateStr}T${clockIn}:00`).toISOString()
            },
            lunchStart: {
              ...randomLocation,
              lat: randomLocation.lat + (Math.random() - 0.5) * 0.001,
              lng: randomLocation.lng + (Math.random() - 0.5) * 0.001,
              timestamp: new Date(`${dateStr}T${lunchStart}:00`).toISOString()
            },
            lunchEnd: {
              ...randomLocation,
              lat: randomLocation.lat + (Math.random() - 0.5) * 0.001,
              lng: randomLocation.lng + (Math.random() - 0.5) * 0.001,
              timestamp: new Date(`${dateStr}T${lunchEnd}:00`).toISOString()
            },
            clockOut: {
              ...randomLocation,
              lat: randomLocation.lat + (Math.random() - 0.5) * 0.001,
              lng: randomLocation.lng + (Math.random() - 0.5) * 0.001,
              timestamp: new Date(`${dateStr}T${clockOut}:00`).toISOString()
            }
          }
        };
        
        records.push(record);
      }
    }
    
    // Salvar registros no localStorage
    localStorage.setItem(`tcponto_records_${employee.id}`, JSON.stringify(records));
  });

  // Salvar lista de funcionários
  localStorage.setItem('tcponto_employees', JSON.stringify(mockUsers));
};

// Funções auxiliares
const addMinutes = (time: string, minutes: number): string => {
  const [hours, mins] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60);
  const newMins = totalMinutes % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
};

const calculateTotalMinutes = (clockIn: string, lunchStart: string, lunchEnd: string, clockOut: string): number => {
  const timeToMinutes = (time: string) => {
    const [hours, mins] = time.split(':').map(Number);
    return hours * 60 + mins;
  };
  
  const clockInMins = timeToMinutes(clockIn);
  const lunchStartMins = timeToMinutes(lunchStart);
  const lunchEndMins = timeToMinutes(lunchEnd);
  const clockOutMins = timeToMinutes(clockOut);
  
  const morningWork = lunchStartMins - clockInMins;
  const afternoonWork = clockOutMins - lunchEndMins;
  
  return morningWork + afternoonWork;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Gerar dados de exemplo na primeira execução
    const hasGeneratedData = localStorage.getItem('tcponto_sample_data_generated');
    if (!hasGeneratedData) {
      generateSampleData();
      localStorage.setItem('tcponto_sample_data_generated', 'true');
    }

    // Verificar se há usuário logado no localStorage
    const savedUser = localStorage.getItem('tcponto_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Simulação de autenticação
    const foundUser = mockUsers.find(u => u.email === email);
    
    if (foundUser && password === '123456') {
      setUser(foundUser);
      setIsAuthenticated(true);
      localStorage.setItem('tcponto_user', JSON.stringify(foundUser));
      return true;
    }
    
    return false;
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('tcponto_user');
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
