
import React, { useState, useEffect } from 'react';
import { Bell, X, AlertTriangle, Info, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { supabase } from '../integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  expires_at: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_active: boolean;
}

interface AnnouncementNotificationProps {
  userId: string;
}

const priorityConfig = {
  low: {
    icon: Info,
    color: 'bg-blue-50 border-blue-200 text-blue-800',
    badgeColor: 'bg-blue-100 text-blue-800',
    title: 'Informação'
  },
  normal: {
    icon: Bell,
    color: 'bg-gray-50 border-gray-200 text-gray-800',
    badgeColor: 'bg-gray-100 text-gray-800',
    title: 'Aviso'
  },
  high: {
    icon: AlertTriangle,
    color: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    badgeColor: 'bg-yellow-100 text-yellow-800',
    title: 'Importante'
  },
  urgent: {
    icon: AlertCircle,
    color: 'bg-red-50 border-red-200 text-red-800',
    badgeColor: 'bg-red-100 text-red-800',
    title: 'Urgente'
  }
};

export const AnnouncementNotification: React.FC<AnnouncementNotificationProps> = ({ userId }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);

  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        const now = new Date().toISOString();
        
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .eq('is_active', true)
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(showAll ? 10 : 3);

        if (error) {
          console.error('Error loading announcements:', error);
          return;
        }

        setAnnouncements(data || []);
      } catch (error) {
        console.error('Error loading announcements:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnnouncements();
    
    // Recarregar anúncios a cada 5 minutos
    const interval = setInterval(loadAnnouncements, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [showAll]);

  const dismissAnnouncement = (announcementId: string) => {
    setDismissedAnnouncements(prev => [...prev, announcementId]);
  };

  const activeAnnouncements = announcements.filter(
    announcement => !dismissedAnnouncements.includes(announcement.id)
  );

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-16 bg-gray-100 rounded-lg mb-2"></div>
      </div>
    );
  }

  if (activeAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Anúncios</h3>
          <Badge variant="secondary" className="text-xs">
            {activeAnnouncements.length}
          </Badge>
        </div>
        {announcements.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showAll ? 'Ver menos' : 'Ver todos'}
          </Button>
        )}
      </div>

      {/* Announcements List */}
      <div className="space-y-3">
        {activeAnnouncements.map((announcement) => {
          const config = priorityConfig[announcement.priority];
          const IconComponent = config.icon;
          
          return (
            <div
              key={announcement.id}
              className={`relative p-4 rounded-xl border-2 ${config.color} transition-all duration-200 hover:shadow-md`}
            >
              {/* Dismiss Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissAnnouncement(announcement.id)}
                className="absolute top-2 right-2 p-1 h-8 w-8 opacity-60 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </Button>

              {/* Header */}
              <div className="flex items-start gap-3 pr-8">
                <IconComponent className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-base leading-tight">
                      {announcement.title}
                    </h4>
                    <Badge className={`text-xs ${config.badgeColor}`}>
                      {config.title}
                    </Badge>
                  </div>
                  
                  {/* Content */}
                  <p className="text-sm leading-relaxed mb-3">
                    {announcement.content}
                  </p>
                  
                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs opacity-70">
                    <span>
                      {format(new Date(announcement.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {announcement.expires_at && (
                      <span>
                        Expira: {format(new Date(announcement.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
