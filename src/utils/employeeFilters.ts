
// Utilitário para filtros de funcionários padronizados
export interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourly_rate?: number;
  overtime_rate?: number;
  status?: string;
}

/**
 * Filtra apenas funcionários ativos (não administradores)
 * CORREÇÃO: Agora rejeita explicitamente status 'inactive' e 'terminated'
 */
export const getActiveEmployees = (employees: Employee[]): Employee[] => {
  return employees.filter(employee => 
    employee.role === 'user' && 
    (
      employee.status === 'active' || 
      employee.status === undefined || 
      employee.status === null
    ) &&
    employee.status !== 'inactive' &&
    employee.status !== 'terminated'
  );
};

/**
 * Cria condições SQL para filtrar apenas funcionários ativos
 * CORREÇÃO: Agora inclui criteria para rejeitar funcionários inativos
 */
export const getActiveEmployeesQuery = () => {
  return "role = 'user' AND (status IS NULL OR status = 'active')";
};
