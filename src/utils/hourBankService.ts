
import { supabase } from '@/integrations/supabase/client';

export interface HourBankBalance {
  id: string;
  employee_id: string;
  current_balance: number;
  last_updated: string;
  created_at: string;
}

export interface HourBankTransaction {
  id: string;
  employee_id: string;
  time_record_id?: string;
  transaction_type: 'ACUMULO' | 'DESCONTO' | 'AJUSTE_MANUAL' | 'EXPIRACAO';
  hours_amount: number;
  previous_balance: number;
  new_balance: number;
  description?: string;
  admin_user_id?: string;
  transaction_date: string;
  expiration_date?: string;
  created_at: string;
}

export interface EmployeeWorkSchedule {
  id: string;
  employee_id: string;
  daily_hours: number;
  weekly_hours?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HourBankSettings {
  usar_banco_horas: boolean;
  limite_maximo_horas: number;
  validade_horas_meses: number;
  jornada_padrao_horas: number;
}

class HourBankService {
  /**
   * Verificar se o banco de horas está ativo
   */
  async isHourBankActive(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'usar_banco_horas')
        .single();

      if (error) throw error;
      return data?.setting_value === 'true';
    } catch (error) {
      console.error('Erro ao verificar status do banco de horas:', error);
      return false;
    }
  }

  /**
   * Obter configurações do banco de horas
   */
  async getHourBankSettings(): Promise<HourBankSettings> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [
          'usar_banco_horas',
          'limite_maximo_horas',
          'validade_horas_meses',
          'jornada_padrao_horas'
        ]);

      if (error) throw error;

      const settings: any = {};
      data?.forEach(setting => {
        if (setting.setting_key === 'usar_banco_horas') {
          settings[setting.setting_key] = setting.setting_value === 'true';
        } else {
          settings[setting.setting_key] = parseFloat(setting.setting_value);
        }
      });

      return {
        usar_banco_horas: settings.usar_banco_horas || false,
        limite_maximo_horas: settings.limite_maximo_horas || 40,
        validade_horas_meses: settings.validade_horas_meses || 6,
        jornada_padrao_horas: settings.jornada_padrao_horas || 8
      };
    } catch (error) {
      console.error('Erro ao obter configurações do banco de horas:', error);
      return {
        usar_banco_horas: false,
        limite_maximo_horas: 40,
        validade_horas_meses: 6,
        jornada_padrao_horas: 8
      };
    }
  }

  /**
   * Atualizar configurações do banco de horas
   */
  async updateHourBankSettings(settings: Partial<HourBankSettings>): Promise<void> {
    try {
      const updates = Object.entries(settings).map(([key, value]) => ({
        setting_key: key,
        setting_value: value.toString(),
        updated_at: new Date().toISOString()
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('system_settings')
          .update({ setting_value: update.setting_value, updated_at: update.updated_at })
          .eq('setting_key', update.setting_key);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Erro ao atualizar configurações do banco de horas:', error);
      throw error;
    }
  }

  /**
   * Obter saldo do banco de horas de um funcionário
   */
  async getEmployeeHourBankBalance(employeeId: string): Promise<HourBankBalance | null> {
    try {
      const { data, error } = await supabase
        .from('hour_bank_balances')
        .select('*')
        .eq('employee_id', employeeId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Erro ao obter saldo do banco de horas:', error);
      return null;
    }
  }

  /**
   * Obter histórico de transações do banco de horas
   */
  async getEmployeeHourBankTransactions(
    employeeId: string,
    startDate?: string,
    endDate?: string
  ): Promise<HourBankTransaction[]> {
    try {
      let query = supabase
        .from('hour_bank_transactions')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('transaction_date', startDate);
      }
      if (endDate) {
        query = query.lte('transaction_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Type cast the transaction_type to the expected union type
      return (data || []).map(transaction => ({
        ...transaction,
        transaction_type: transaction.transaction_type as 'ACUMULO' | 'DESCONTO' | 'AJUSTE_MANUAL' | 'EXPIRACAO'
      }));
    } catch (error) {
      console.error('Erro ao obter transações do banco de horas:', error);
      return [];
    }
  }

  /**
   * Criar ajuste manual no banco de horas
   */
  async createManualAdjustment(
    employeeId: string,
    hoursAmount: number,
    description: string,
    adminUserId: string
  ): Promise<void> {
    try {
      // Obter saldo atual
      const currentBalance = await this.getEmployeeHourBankBalance(employeeId);
      const previousBalance = currentBalance?.current_balance || 0;
      const newBalance = previousBalance + hoursAmount;

      // Inserir transação
      const { error: transactionError } = await supabase
        .from('hour_bank_transactions')
        .insert({
          employee_id: employeeId,
          transaction_type: 'AJUSTE_MANUAL',
          hours_amount: Math.abs(hoursAmount),
          previous_balance: previousBalance,
          new_balance: newBalance,
          description: description,
          admin_user_id: adminUserId,
          transaction_date: new Date().toISOString().split('T')[0]
        });

      if (transactionError) throw transactionError;

      // Atualizar ou criar saldo
      if (currentBalance) {
        const { error: updateError } = await supabase
          .from('hour_bank_balances')
          .update({
            current_balance: newBalance,
            last_updated: new Date().toISOString()
          })
          .eq('employee_id', employeeId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('hour_bank_balances')
          .insert({
            employee_id: employeeId,
            current_balance: newBalance
          });

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Erro ao criar ajuste manual:', error);
      throw error;
    }
  }

  /**
   * Obter jornada de trabalho de um funcionário
   */
  async getEmployeeWorkSchedule(employeeId: string): Promise<EmployeeWorkSchedule | null> {
    try {
      const { data, error } = await supabase
        .from('employee_work_schedules')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Erro ao obter jornada do funcionário:', error);
      return null;
    }
  }

  /**
   * Criar ou atualizar jornada de trabalho de um funcionário
   */
  async upsertEmployeeWorkSchedule(
    employeeId: string,
    dailyHours: number,
    weeklyHours?: number
  ): Promise<void> {
    try {
      // Desativar jornada anterior
      await supabase
        .from('employee_work_schedules')
        .update({ is_active: false })
        .eq('employee_id', employeeId)
        .eq('is_active', true);

      // Criar nova jornada
      const { error } = await supabase
        .from('employee_work_schedules')
        .insert({
          employee_id: employeeId,
          daily_hours: dailyHours,
          weekly_hours: weeklyHours,
          is_active: true
        });

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao criar/atualizar jornada do funcionário:', error);
      throw error;
    }
  }

  /**
   * Obter saldos de todos os funcionários
   */
  async getAllEmployeesHourBankBalances(): Promise<HourBankBalance[]> {
    try {
      const { data, error } = await supabase
        .from('hour_bank_balances')
        .select('*')
        .order('last_updated', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao obter saldos de todos os funcionários:', error);
      return [];
    }
  }

  /**
   * Expirar horas antigas (função para ser chamada por background job)
   */
  async expireOldHours(): Promise<void> {
    try {
      const { error } = await supabase.rpc('expire_old_hour_bank_hours');
      if (error) throw error;
    } catch (error) {
      console.error('Erro ao expirar horas antigas:', error);
      throw error;
    }
  }

  /**
   * Calcular resumo do banco de horas para um período
   */
  async getHourBankSummary(
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    accumulated: number;
    discounted: number;
    currentBalance: number;
    transactions: HourBankTransaction[];
  }> {
    try {
      const transactions = await this.getEmployeeHourBankTransactions(
        employeeId,
        startDate,
        endDate
      );

      const accumulated = transactions
        .filter(t => t.transaction_type === 'ACUMULO')
        .reduce((sum, t) => sum + t.hours_amount, 0);

      const discounted = transactions
        .filter(t => t.transaction_type === 'DESCONTO')
        .reduce((sum, t) => sum + t.hours_amount, 0);

      const balance = await this.getEmployeeHourBankBalance(employeeId);

      return {
        accumulated,
        discounted,
        currentBalance: balance?.current_balance || 0,
        transactions
      };
    } catch (error) {
      console.error('Erro ao calcular resumo do banco de horas:', error);
      return {
        accumulated: 0,
        discounted: 0,
        currentBalance: 0,
        transactions: []
      };
    }
  }
}

export const hourBankService = new HourBankService();
