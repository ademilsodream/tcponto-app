
import { supabase } from '@/integrations/supabase/client';

// Validações de dados críticos sem afetar UI
export class BackendValidator {
  
  // Validação de valores monetários
  static validateMonetaryValue(value: number, fieldName: string): void {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`${fieldName} deve ser um número válido`);
    }
    
    if (value < 0) {
      throw new Error(`${fieldName} não pode ser negativo`);
    }
    
    if (value > 9999999.99) {
      throw new Error(`${fieldName} excede o limite máximo permitido`);
    }
    
    // Verificar se tem mais de 2 casas decimais
    if (Math.round(value * 100) !== value * 100) {
      throw new Error(`${fieldName} deve ter no máximo 2 casas decimais`);
    }
  }

  // Validação de horas trabalhadas
  static validateHours(hours: number, fieldName: string): void {
    if (typeof hours !== 'number' || isNaN(hours)) {
      throw new Error(`${fieldName} deve ser um número válido`);
    }
    
    if (hours < 0) {
      throw new Error(`${fieldName} não pode ser negativo`);
    }
    
    if (hours > 24) {
      throw new Error(`${fieldName} não pode exceder 24 horas por dia`);
    }
  }

  // Validação de datas
  static validateDate(date: string, fieldName: string): void {
    const dateObj = new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      throw new Error(`${fieldName} deve ser uma data válida`);
    }
    
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    
    const twoYearsFromNow = new Date();
    twoYearsFromNow.setFullYear(today.getFullYear() + 2);
    
    if (dateObj < oneYearAgo || dateObj > twoYearsFromNow) {
      throw new Error(`${fieldName} deve estar dentro de um período válido`);
    }
  }

  // Validação de horários
  static validateTime(time: string, fieldName: string): void {
    if (!time) return; // Permite valores nulos/vazios
    
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      throw new Error(`${fieldName} deve estar no formato HH:MM`);
    }
  }

  // Validação de email corporativo
  static validateCorporateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Email deve ter formato válido');
    }
    
    // Verificar se não é email temporário/descartável
    const disposableEmailDomains = [
      '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
      'mailinator.com', 'temp-mail.org'
    ];
    
    const domain = email.split('@')[1]?.toLowerCase();
    if (disposableEmailDomains.includes(domain)) {
      throw new Error('Não são permitidos emails temporários');
    }
  }

  // Validação de senha forte
  static validateStrongPassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Senha deve ter pelo menos 8 caracteres');
    }
    
    if (password.length > 128) {
      throw new Error('Senha muito longa');
    }
    
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!hasUpperCase) {
      throw new Error('Senha deve conter pelo menos uma letra maiúscula');
    }
    
    if (!hasLowerCase) {
      throw new Error('Senha deve conter pelo menos uma letra minúscula');
    }
    
    if (!hasNumbers) {
      throw new Error('Senha deve conter pelo menos um número');
    }
    
    if (!hasSpecialChar) {
      throw new Error('Senha deve conter pelo menos um caractere especial');
    }
    
    // Verificar padrões comuns fracos
    const commonPatterns = [
      /123456/, /password/, /qwerty/, /abc123/,
      /111111/, /000000/, /admin/, /login/
    ];
    
    for (const pattern of commonPatterns) {
      if (pattern.test(password.toLowerCase())) {
        throw new Error('Senha contém padrão muito comum');
      }
    }
  }

  // Validação de código de funcionário
  static validateEmployeeCode(code: string): void {
    if (!code) return; // Permite valores vazios
    
    if (code.length < 3 || code.length > 20) {
      throw new Error('Código do funcionário deve ter entre 3 e 20 caracteres');
    }
    
    const validCodeRegex = /^[A-Z0-9-_]+$/;
    if (!validCodeRegex.test(code.toUpperCase())) {
      throw new Error('Código deve conter apenas letras, números, hífens e underscores');
    }
  }

  // Validação de consistência de horários
  static validateTimeConsistency(clockIn?: string, lunchStart?: string, lunchEnd?: string, clockOut?: string): void {
    const times = [
      { value: clockIn, name: 'Entrada' },
      { value: lunchStart, name: 'Início do Almoço' },
      { value: lunchEnd, name: 'Fim do Almoço' },
      { value: clockOut, name: 'Saída' }
    ].filter(t => t.value);

    // Validar formato de todos os horários
    times.forEach(time => {
      this.validateTime(time.value!, time.name);
    });

    // Validar sequência lógica
    if (clockIn && lunchStart) {
      if (clockIn >= lunchStart) {
        throw new Error('Horário de entrada deve ser anterior ao início do almoço');
      }
    }

    if (lunchStart && lunchEnd) {
      if (lunchStart >= lunchEnd) {
        throw new Error('Início do almoço deve ser anterior ao fim do almoço');
      }
    }

    if (lunchEnd && clockOut) {
      if (lunchEnd >= clockOut) {
        throw new Error('Fim do almoço deve ser anterior à saída');
      }
    }

    if (clockIn && clockOut) {
      if (clockIn >= clockOut) {
        throw new Error('Horário de entrada deve ser anterior à saída');
      }
    }
  }

  // Log de validação para auditoria
  static async logValidationEvent(type: string, data: any, userId?: string): Promise<void> {
    try {
      await supabase
        .from('system_alerts')
        .insert({
          alert_type: 'validation_event',
          employee_id: userId,
          title: `Validação: ${type}`,
          message: `Evento de validação registrado`,
          severity: 'low',
          metadata: {
            validation_type: type,
            data: data,
            timestamp: new Date().toISOString()
          }
        });
    } catch (error) {
      console.error('Erro ao registrar evento de validação:', error);
    }
  }
}

// Middleware de validação para operações críticas
export class ValidationMiddleware {
  
  // Validar dados de perfil antes de salvar
  static validateProfileData(profileData: any): void {
    if (profileData.email) {
      BackendValidator.validateCorporateEmail(profileData.email);
    }
    
    if (profileData.hourly_rate !== undefined) {
      BackendValidator.validateMonetaryValue(profileData.hourly_rate, 'Taxa horária');
    }
    
    if (profileData.overtime_rate !== undefined) {
      BackendValidator.validateMonetaryValue(profileData.overtime_rate, 'Taxa de hora extra');
    }
    
    if (profileData.employee_code) {
      BackendValidator.validateEmployeeCode(profileData.employee_code);
    }
  }

  // Validar registro de ponto antes de salvar
  static validateTimeRecord(timeRecord: any): void {
    if (timeRecord.date) {
      BackendValidator.validateDate(timeRecord.date, 'Data');
    }
    
    BackendValidator.validateTimeConsistency(
      timeRecord.clock_in,
      timeRecord.lunch_start,
      timeRecord.lunch_end,
      timeRecord.clock_out
    );
    
    if (timeRecord.total_hours !== undefined) {
      BackendValidator.validateHours(timeRecord.total_hours, 'Total de horas');
    }
    
    if (timeRecord.normal_hours !== undefined) {
      BackendValidator.validateHours(timeRecord.normal_hours, 'Horas normais');
    }
    
    if (timeRecord.overtime_hours !== undefined) {
      BackendValidator.validateHours(timeRecord.overtime_hours, 'Horas extras');
    }
    
    if (timeRecord.total_pay !== undefined) {
      BackendValidator.validateMonetaryValue(timeRecord.total_pay, 'Pagamento total');
    }
  }

  // Validar transação do banco de horas
  static validateHourBankTransaction(transaction: any): void {
    if (transaction.hours_amount !== undefined) {
      BackendValidator.validateHours(transaction.hours_amount, 'Quantidade de horas');
    }
    
    if (transaction.previous_balance !== undefined) {
      BackendValidator.validateHours(transaction.previous_balance, 'Saldo anterior');
    }
    
    if (transaction.new_balance !== undefined) {
      BackendValidator.validateHours(transaction.new_balance, 'Novo saldo');
    }
    
    if (transaction.transaction_date) {
      BackendValidator.validateDate(transaction.transaction_date, 'Data da transação');
    }
    
    if (transaction.expiration_date) {
      BackendValidator.validateDate(transaction.expiration_date, 'Data de expiração');
    }
  }
}
