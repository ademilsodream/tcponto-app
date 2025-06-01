
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BackendValidator, ValidationMiddleware } from '@/utils/backendValidation';
import { toast } from 'sonner';

interface ValidatedMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  invalidateQueries?: string[];
  validationType?: 'profile' | 'timeRecord' | 'hourBank' | 'custom';
  customValidator?: (variables: TVariables) => void;
  skipValidation?: boolean;
}

export function useValidatedMutation<TData, TVariables>({
  mutationFn,
  onSuccess,
  onError,
  invalidateQueries = [],
  validationType,
  customValidator,
  skipValidation = false
}: ValidatedMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      // Executar validações antes da mutação
      if (!skipValidation) {
        try {
          // Validações específicas por tipo
          switch (validationType) {
            case 'profile':
              ValidationMiddleware.validateProfileData(variables);
              break;
            case 'timeRecord':
              ValidationMiddleware.validateTimeRecord(variables);
              break;
            case 'hourBank':
              ValidationMiddleware.validateHourBankTransaction(variables);
              break;
            case 'custom':
              if (customValidator) {
                customValidator(variables);
              }
              break;
          }

          // Log do evento de validação
          await BackendValidator.logValidationEvent(
            validationType || 'generic',
            variables
          );

        } catch (validationError: any) {
          // Se validação falhar, mostrar erro amigável
          toast.error(`Erro de validação: ${validationError.message}`);
          throw validationError;
        }
      }

      // Executar a mutação original
      return mutationFn(variables);
    },
    onSuccess: (data, variables) => {
      // Invalidar queries relacionadas
      invalidateQueries.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });

      // Executar callback de sucesso
      if (onSuccess) {
        onSuccess(data, variables);
      }

      // Log de sucesso
      console.log('Operação validada executada com sucesso:', {
        type: validationType,
        timestamp: new Date().toISOString()
      });
    },
    onError: (error: any, variables) => {
      // Log de erro para auditoria
      console.error('Erro em operação validada:', {
        error: error.message,
        type: validationType,
        variables,
        timestamp: new Date().toISOString()
      });

      // Executar callback de erro
      if (onError) {
        onError(error, variables);
      }

      // Mostrar erro amigável se não for erro de validação
      if (!error.message.includes('validação')) {
        toast.error('Erro ao executar operação. Tente novamente.');
      }
    }
  });
}

// Hook específico para operações de perfil
export function useValidatedProfileMutation<TData, TVariables>(
  options: Omit<ValidatedMutationOptions<TData, TVariables>, 'validationType'>
) {
  return useValidatedMutation({
    ...options,
    validationType: 'profile'
  });
}

// Hook específico para operações de registro de ponto
export function useValidatedTimeRecordMutation<TData, TVariables>(
  options: Omit<ValidatedMutationOptions<TData, TVariables>, 'validationType'>
) {
  return useValidatedMutation({
    ...options,
    validationType: 'timeRecord'
  });
}

// Hook específico para operações de banco de horas
export function useValidatedHourBankMutation<TData, TVariables>(
  options: Omit<ValidatedMutationOptions<TData, TVariables>, 'validationType'>
) {
  return useValidatedMutation({
    ...options,
    validationType: 'hourBank'
  });
}
