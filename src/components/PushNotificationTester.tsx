
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PushNotificationService } from '@/services/PushNotificationService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

const PushNotificationTester: React.FC = () => {
  const [title, setTitle] = useState('Teste TCPonto');
  const [body, setBody] = useState('Esta é uma notificação de teste!');
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleTestPush = async () => {
    try {
      setSending(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive"
        });
        return;
      }

      const pushService = PushNotificationService.getInstance();
      await pushService.sendToUser(user.id, title, body, {
        type: 'test',
        timestamp: new Date().toISOString()
      });

      toast({
        title: "Sucesso",
        description: "Notificação de teste enviada!",
        variant: "default"
      });

    } catch (error: any) {
      console.error('Erro ao enviar notificação:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar notificação",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const handleTestAnnouncement = async () => {
    try {
      setSending(true);

      // Buscar usuários ativos para enviar o anúncio
      const { data: users } = await supabase
        .from('profiles')
        .select('id')
        .eq('status', 'active')
        .eq('role', 'user');

      if (!users || users.length === 0) {
        toast({
          title: "Aviso",
          description: "Nenhum usuário ativo encontrado",
          variant: "default"
        });
        return;
      }

      const pushService = PushNotificationService.getInstance();
      
      // Enviar para todos os usuários ativos
      for (const user of users) {
        await pushService.sendToUser(user.id, title, body, {
          type: 'announcement',
          timestamp: new Date().toISOString()
        });
      }

      toast({
        title: "Sucesso",
        description: `Anúncio enviado para ${users.length} usuário(s)!`,
        variant: "default"
      });

    } catch (error: any) {
      console.error('Erro ao enviar anúncio:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar anúncio",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Teste de Push Notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da notificação"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Mensagem</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Corpo da notificação"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Button
            onClick={handleTestPush}
            disabled={sending || !title || !body}
            className="w-full"
          >
            {sending ? 'Enviando...' : 'Testar Para Mim'}
          </Button>

          <Button
            onClick={handleTestAnnouncement}
            disabled={sending || !title || !body}
            variant="secondary"
            className="w-full"
          >
            {sending ? 'Enviando...' : 'Enviar Anúncio Para Todos'}
          </Button>
        </div>

        <div className="text-xs text-gray-500 mt-4">
          <p>• "Testar Para Mim" envia apenas para seu dispositivo</p>
          <p>• "Enviar Anúncio" envia para todos os usuários ativos</p>
          <p>• Certifique-se de que o app está em segundo plano para ver a notificação</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PushNotificationTester;
