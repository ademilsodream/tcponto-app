
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Bell, Info, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high';
  created_at: string;
  expires_at?: string;
}

interface AnnouncementModalProps {
  announcement: Announcement | null;
  isOpen: boolean;
  onClose: () => void;
  onMarkAsRead: (announcementId: string) => void;
}

const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  announcement,
  isOpen,
  onClose,
  onMarkAsRead
}) => {
  if (!announcement) return null;

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'low':
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return <Bell className="w-5 h-5 text-orange-500" />;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'Alta';
      case 'low':
        return 'Baixa';
      default:
        return 'Normal';
    }
  };

  const getPriorityVariant = (priority: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'low':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const handleClose = () => {
    onMarkAsRead(announcement.id);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getPriorityIcon(announcement.priority)}
              <DialogTitle className="text-lg">Anúncio</DialogTitle>
            </div>
            <Badge variant={getPriorityVariant(announcement.priority)}>
              Prioridade {getPriorityLabel(announcement.priority)}
            </Badge>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              {announcement.title}
            </h3>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {announcement.content}
            </p>
          </div>

          <div className="text-xs text-gray-500 border-t pt-3">
            <div>
              Publicado em: {format(new Date(announcement.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
            {announcement.expires_at && (
              <div className="mt-1">
                Expira em: {format(new Date(announcement.expires_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleClose} className="w-full">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AnnouncementModal;
