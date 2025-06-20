
import { Json } from '@/integrations/supabase/types';

export type TimeRecordKey = 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out';

export interface LocationDetails {
  address: string;
  distance: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  locationName: string;
  gpsAccuracy?: number;
  confidence?: number;
}

export interface LocationsData {
  clock_in?: LocationDetails;
  lunch_start?: LocationDetails;
  lunch_end?: LocationDetails;
  clock_out?: LocationDetails;
}

export interface TimeRecord {
  id: string;
  date: string;
  clock_in?: string;
  lunch_start?: string;
  lunch_end?: string;
  clock_out?: string;
  total_hours: number;
  normal_hours?: number;
  overtime_hours?: number;
  normal_pay?: number;
  overtime_pay?: number;
  total_pay?: number;
  locations?: Json | null;
  created_at?: string;
  updated_at?: string;
  status?: string;
  is_pending_approval?: boolean;
  approved_by?: string;
  approved_at?: string;
}
