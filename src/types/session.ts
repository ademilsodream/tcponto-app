
export interface SessionSettings {
  sessionDurationDays: number;
  autoRefreshEnabled: boolean;
  rememberMeEnabled: boolean;
  sessionWarningMinutes: number;
  permanentSessionEnabled: boolean;
}

export interface UserSession {
  id: string;
  user_id: string;
  device_info: {
    userAgent: string;
    platform: string;
    language: string;
    timestamp: string;
  };
  last_activity: string;
  expires_at: string;
  is_permanent: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionWarningProps {
  isVisible: boolean;
  onRenew: () => void;
  onDismiss: () => void;
  minutesRemaining?: number;
}
