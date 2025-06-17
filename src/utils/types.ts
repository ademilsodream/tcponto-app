export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface AllowedLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  range_meters: number;
  is_active: boolean;
} 