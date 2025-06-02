
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
 */
export const getActiveEmployees = (employees: Employee[]): Employee[] => {
  return employees.filter(employee => 
    employee.role === 'user' && 
    (!employee.status || employee.status === 'active')
  );
};

/**
 * Cria condições SQL para filtrar apenas funcionários ativos
 */
export const getActiveEmployeesQuery = () => {
  return `role = 'user' AND (status IS NULL OR status = 'active')`;
};
