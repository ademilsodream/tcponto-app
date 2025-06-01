
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Settings, FileText, Cog } from 'lucide-react';
import NotificationSettings from './NotificationSettings';
import NotificationLogs from './NotificationLogs';
import AutomatedChecks from './AutomatedChecks';

const NotificationCenter: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Central de Notificações</h1>
        <p className="text-gray-600">
          Gerencie todas as configurações de notificação e monitore o sistema de alertas.
        </p>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="automated" className="flex items-center gap-2">
            <Cog className="w-4 h-4" />
            Verificações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="logs">
          <NotificationLogs />
        </TabsContent>

        <TabsContent value="automated">
          <AutomatedChecks />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationCenter;
