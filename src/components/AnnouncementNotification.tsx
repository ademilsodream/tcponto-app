
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, AlertTriangle, Info } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high';
  created_at: string;
  expires_at?: string;
}

interface AnnouncementNotificationProps {
  announcements: Announcement[];
  onAnnouncementClick: (announcement: Announcement) => void;
}

const AnnouncementNotification: React.FC<AnnouncementNotificationProps> = ({ 
  announcements, 
  onAnnouncementClick 
}) => {
  console.log('🔔 AnnouncementNotification renderizando com:', announcements.length, 'anúncios', announcements);
  
  if (announcements.length === 0) {
    console.log('❌ AnnouncementNotification: Nenhum anúncio para exibir - retornando null');
    return null;
  }

  console.log('✅ AnnouncementNotification: Exibindo notificação de anúncios!');

  const firstAnnouncement = announcements[0];
  const hasMultiple = announcements.length > 1;

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'low':
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-orange-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-red-200 bg-red-50';
      case 'low':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-orange-200 bg-orange-50';
    }
  };

  return (
    <Card className={`w-full max-w-md ${getPriorityColor(firstAnnouncement.priority)} border-l-4 ${
      firstAnnouncement.priority === 'high' ? 'border-l-red-500' : 
      firstAnnouncement.priority === 'low' ? 'border-l-blue-500' : 'border-l-orange-500'
    }`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {getPriorityIcon(firstAnnouncement.priority)}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 mb-1">
              {hasMultiple ? 'Novos Anúncios' : 'Novo Anúncio'}
            </h4>
            <p className="text-sm text-gray-600 mb-3 truncate">
              {firstAnnouncement.title}
              {hasMultiple && ` e mais ${announcements.length - 1} anúncio${announcements.length - 1 > 1 ? 's' : ''}`}
            </p>
            <Button
              onClick={() => {
                console.log('🖱️ Clicando no anúncio:', firstAnnouncement.id);
                onAnnouncementClick(firstAnnouncement);
              }}
              size="sm"
              className="w-full text-xs"
              variant="outline"
            >
              {hasMultiple ? `Ver ${announcements.length} anúncios` : 'Ver anúncio'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AnnouncementNotification;
