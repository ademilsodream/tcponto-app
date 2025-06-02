
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Calendar, User, AlertCircle } from 'lucide-react';
import TimeRegistration from '@/components/TimeRegistration';
import { useAuth } from '@/contexts/AuthContext';

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();

  const currentTime = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const currentDate = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header com informações do usuário */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">
          Olá, {user?.name}!
        </h1>
        <p className="text-lg text-gray-600 capitalize">{currentDate}</p>
        <p className="text-3xl font-mono font-bold text-primary-600">{currentTime}</p>
      </div>

      {/* Cards de resumo rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horas Hoje</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8h 30m</div>
            <p className="text-xs text-muted-foreground">
              +20m em relação a ontem
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horas Mês</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">168h 45m</div>
            <p className="text-xs text-muted-foreground">
              Restam 11h 15m
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Ativo</div>
            <p className="text-xs text-muted-foreground">
              Último registro: 14:30
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Componente principal de registro de ponto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Registro de Ponto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TimeRegistration />
        </CardContent>
      </Card>

      {/* Alertas ou avisos */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <AlertCircle className="w-5 h-5" />
            Avisos Importantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-orange-700">
            Lembre-se de registrar seu ponto de almoço até as 13:00h.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeDashboard;
