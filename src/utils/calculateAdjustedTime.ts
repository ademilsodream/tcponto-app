/**
 * Calcula o horário ajustado baseado na tolerância do turno
 * 
 * Se o horário atual está dentro da janela de tolerância do horário oficial,
 * retorna o horário oficial. Caso contrário, retorna o horário real.
 * 
 * @param currentTime - Data/hora atual
 * @param scheduleTime - Horário oficial do turno (ex: "08:00:00")
 * @param toleranceMinutes - Tolerância em minutos
 * @returns Horário ajustado no formato "HH:mm:ss"
 */
export const calculateAdjustedTime = (
  currentTime: Date,
  scheduleTime: string,
  toleranceMinutes: number
): string => {
  // Converter horário atual para minutos desde meia-noite
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  
  // Converter horário oficial para minutos
  const [hours, minutes] = scheduleTime.split(':').map(Number);
  const scheduleMinutes = hours * 60 + minutes;
  
  // Calcular janela de tolerância
  const minWindow = scheduleMinutes - toleranceMinutes;
  const maxWindow = scheduleMinutes + toleranceMinutes;
  
  // Se está dentro da tolerância, retorna horário oficial
  if (currentMinutes >= minWindow && currentMinutes <= maxWindow) {
    return scheduleTime.substring(0, 5); // Retorna "HH:mm"
  }
  
  // Fora da tolerância, retorna horário real
  const h = currentTime.getHours().toString().padStart(2, '0');
  const m = currentTime.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
};
