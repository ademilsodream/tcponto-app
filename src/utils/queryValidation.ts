
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

// Type guard básico para verificar se é um erro Supabase
export function isSupabaseError(data: any): boolean {
  return data && typeof data === 'object' && ('error' in data || data.error === true);
}

// Type guard robusto para verificar se um objeto tem as propriedades esperadas
export function isValidObject(obj: any): obj is Record<string, any> {
  return obj && typeof obj === 'object' && !isSupabaseError(obj);
}

// Função auxiliar para cast seguro de IDs
export function safeIdCast(id: any): any {
  if (typeof id === 'string' && id !== '') {
    return id as any;
  }
  return id;
}

// Função auxiliar para cast seguro de strings
export function safeStringCast(value: any): any {
  if (typeof value === 'string') {
    return value as any;
  }
  if (value !== null && value !== undefined) {
    return String(value) as any;
  }
  return value;
}

// Função auxiliar para cast seguro de arrays de strings
export function safeStringArrayCast(values: any[]): any {
  if (Array.isArray(values)) {
    return values.map(v => safeStringCast(v)) as any;
  }
  return values;
}

// Função auxiliar para extrair valor seguro de propriedades
export function safePropertyAccess<T>(obj: any, property: string, defaultValue: T): T {
  if (isValidObject(obj) && property in obj) {
    return obj[property] as T;
  }
  return defaultValue;
}

// Função para validar se é uma query de perfil válida
export function isValidProfileQuery(data: any, error: any): data is { hourly_rate: number } {
  return isValidSingleResult(data, error) && isValidObject(data) && 'hourly_rate' in data;
}

// Função para validar se é uma query de time record válida  
export function isValidTimeRecordQuery(data: any, error: any): data is {
  id: string;
  date: string;
  clock_in?: string;
  lunch_start?: string;
  lunch_end?: string;
  clock_out?: string;
  user_id?: string;
  locations?: any;
} {
  return isValidSingleResult(data, error) && isValidObject(data) && 'id' in data && 'date' in data;
}

// Função simples para validar e filtrar dados do banco
export function safeArrayFilter<T>(data: any): T[] {
  if (!Array.isArray(data)) return [];
  return data.filter(item => item && typeof item === 'object' && !isSupabaseError(item));
}

// Cast seguro para booleanos
export function safeBooleanCast(value: any): any {
  return Boolean(value) as any;
}

// Cast seguro para números
export function safeNumberCast(value: any): any {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}
