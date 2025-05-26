import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Clock, DollarSign, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/contexts/CurrencyContext';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourlyRate: number;
  overtimeRate: number;
}

interface AdminDashboardProps {
  employees: User[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ employees }) => {
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalAdmins, setTotalAdmins] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    loadDashboardData();
  }, [employees]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      setTotalEmployees(employees.length);
      setTotalAdmins(employees.filter(employee => employee.role === 'admin').length);

      // Simulação de dados de horas e ganhos (substitua pela lógica real)
      const simulatedTotalHours = employees.reduce((acc, employee) => acc + 40, 0); // 40 horas por funcionário
      const simulatedTotalEarnings = employees.reduce((acc, employee) => acc + (employee.hourlyRate * 40), 0); // Taxa horária * 40 horas

      setTotalHours(simulatedTotalHours);
      setTotalEarnings(simulatedTotalEarnings);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Carregando dados do painel...</div>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Total de Funcionários
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalEmployees}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            Total de Administradores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalAdmins}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Total de Horas Trabalhadas (Simulado)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalHours}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            Total de Ganhos (Simulado)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalEarnings)}</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
