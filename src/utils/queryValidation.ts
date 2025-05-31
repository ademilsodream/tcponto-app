
// Função utilitária para validar resultados de queries Supabase
export function isValidQueryResult<T>(data: any, error: any): data is T[] {
  return !error && data && Array.isArray(data);
}

export function isValidSingleResult<T>(data: any, error: any): data is T {
  return !error && data && typeof data === 'object' && !Array.isArray(data);
}

export function hasValidProperties(obj: any, properties: string[]): boolean {
  if (!obj || typeof obj !== 'object') return false;
  return properties.every(prop => prop in obj && obj[prop] !== undefined);
}

// Type guard específico para time records
export function isTimeRecord(data: any): data is {
  id: string;
  date: string;
  clock_in?: string;
  lunch_start?: string;
  lunch_end?: string;
  clock_out?: string;
  total_hours?: number;
} {
  return data && 
         typeof data === 'object' && 
         'id' in data && 
         'date' in data;
}

// Type guard específico para profiles
export function isProfile(data: any): data is {
  id: string;
  name: string;
  email: string;
  role: string;
  hourly_rate: number;
  overtime_rate?: number;
} {
  return data && 
         typeof data === 'object' && 
         'id' in data && 
         'name' in data && 
         'email' in data &&
         'role' in data &&
         'hourly_rate' in data;
}

// Type guard para verificar se é um erro Supabase
export function isSupabaseError(data: any): boolean {
  return data && typeof data === 'object' && ('error' in data || data.error === true);
}

// Type guard robusto para verificar se um objeto tem as propriedades esperadas
export function isValidObject(obj: any): obj is Record<string, any> {
  return obj && typeof obj === 'object' && !isSupabaseError(obj);
}

// Type guard específico para profile com hourly_rate
export function isValidProfile(data: any): data is { hourly_rate: number } & Record<string, any> {
  return isValidObject(data) && 'hourly_rate' in data && typeof data.hourly_rate === 'number';
}

// Type guard para time record completo
export function isValidTimeRecord(data: any): data is {
  id: string;
  date: string;
  clock_in?: string;
  lunch_start?: string;
  lunch_end?: string;
  clock_out?: string;
  user_id?: string;
  locations?: any;
} {
  return isValidObject(data) && 'id' in data && 'date' in data;
}

// Função para filtrar apenas registros válidos de time_records
export function filterValidTimeRecords(records: any[]): Array<{
  id: string;
  date: string;
  clock_in?: string;
  lunch_start?: string;
  lunch_end?: string;
  clock_out?: string;
  total_hours?: number;
  user_id?: string;
  total_pay?: number;
  locations?: any;
}> {
  if (!Array.isArray(records)) return [];
  
  return records.filter((record): record is {
    id: string;
    date: string;
    clock_in?: string;
    lunch_start?: string;
    lunch_end?: string;
    clock_out?: string;
    total_hours?: number;
    user_id?: string;
    total_pay?: number;
    locations?: any;
  } => {
    return isValidTimeRecord(record);
  });
}

// Função para filtrar apenas registros válidos de profiles
export function filterValidProfiles(records: any[]): Array<{
  id: string;
  name: string;
  email: string;
  role: string;
  hourly_rate: number;
  overtime_rate?: number;
}> {
  if (!Array.isArray(records)) return [];
  
  return records.filter((record): record is {
    id: string;
    name: string;
    email: string;
    role: string;
    hourly_rate: number;
    overtime_rate?: number;
  } => {
    return isProfile(record);
  });
}

// Função genérica para filtrar apenas registros válidos (mantida para compatibilidade)
export function filterValidRecords<T = any>(records: any[]): T[] {
  if (!Array.isArray(records)) return [];
  
  return records.filter((record): record is T => 
    isValidObject(record)
  );
}

// Type guard para verificar se um valor é válido e tem propriedades específicas
export function isValidRecord<T>(data: any, requiredProps: string[]): data is T {
  return isValidObject(data) && requiredProps.every(prop => prop in data);
}

// Função auxiliar para cast seguro de IDs
export function safeIdCast(id: any): any {
  if (typeof id === 'string' && id !== '') {
    return id as any;
  }
  return id;
}

// Função auxiliar para extrair valor seguro de propriedades
export function safePropertyAccess<T>(obj: any, property: string, defaultValue: T): T {
  if (isValidObject(obj) && property in obj) {
    return obj[property] as T;
  }
  return defaultValue;
}
