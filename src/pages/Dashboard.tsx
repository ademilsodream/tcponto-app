
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, LogOut, Settings, Users, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import TimeRegistration from '@/components/TimeRegistration';
import GlobalCurrencySelector from '@/components/GlobalCurrencySelector';
import AdminPanel from '@/components/AdminPanel';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'admin';
  const userName = user?.name || user?.email || 'Usuário';

  if (showAdminPanel) {
    return <AdminPanel onBack={() => setShowAdminPanel(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <img 
                src="/lovable-uploads/4b2c75fc-26d4-4be4-9e7e-3a415e06b623.png" 
                alt="TCPonto Logo" 
                className="w-10 h-10 rounded-full"
              />
              <div>
                <h1 className="text-xl font-semibold text-primary-900">TCPonto</h1>
                <p className="text-sm text-gray-600">Sistema de Controle de Ponto</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <GlobalCurrencySelector />
              
              {isAdmin && (
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowAdminPanel(true)}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Usuários
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowAdminPanel(true)}
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Relatórios
                  </Button>
                </div>
              )}

              <div className="flex items-center space-x-2 text-sm">
                <span className="text-gray-600">Olá, {userName}</span>
                {isAdmin && <span className="bg-primary-100 text-primary-800 px-2 py-1 rounded-full text-xs">Admin</span>}
              </div>

              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Configurações
              </Button>

              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isAdmin ? (
          // Admin Dashboard - sem registro de ponto
          <div className="text-center py-16">
            <div className="mb-8">
              <Users className="w-24 h-24 mx-auto text-primary-500 mb-4" />
              <h2 className="text-3xl font-bold text-primary-900 mb-2">Painel Administrativo</h2>
              <p className="text-gray-600 text-lg">Bem-vindo ao sistema de gestão TCPonto</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setShowAdminPanel(true)}>
                <CardHeader className="text-center">
                  <Users className="w-12 h-12 mx-auto text-primary-500 mb-2" />
                  <CardTitle>Gerenciar Usuários</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">Criar, editar e gerenciar funcionários do sistema</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setShowAdminPanel(true)}>
                <CardHeader className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto text-primary-500 mb-2" />
                  <CardTitle>Relatórios</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">Visualizar relatórios de ponto e folha de pagamento</p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          // Employee Dashboard - com registro de ponto
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Date Selection */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5" />
                    Selecionar Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? (
                          format(selectedDate, "PPP", { locale: ptBR })
                        ) : (
                          <span>Selecione uma data</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>

                  <div className="mt-4 p-4 bg-accent-50 rounded-lg">
                    <h3 className="font-medium text-accent-900 mb-2">Data Selecionada</h3>
                    <p className="text-accent-700">
                      {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Time Registration */}
            <div className="lg:col-span-2">
              <TimeRegistration 
                selectedDate={format(selectedDate, 'yyyy-MM-dd')}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
