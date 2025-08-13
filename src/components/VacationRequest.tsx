import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOptimizedAuth } from "@/contexts/OptimizedAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInCalendarDays, isAfter, isBefore, isSameDay } from "date-fns";
import { CalendarIcon, Umbrella } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface VacationPolicy {
  min_period_days: number;
  allow_retroactive: boolean;
  // pode expandir conforme necessário
}

export default function VacationRequest() {
  const { user, profile } = useOptimizedAuth();
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [policy, setPolicy] = useState<VacationPolicy | null>(null);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    const fetchBalanceAndPolicy = async () => {
      if (!user) return;
      // Buscar saldo de férias
      const { data: bal } = await supabase
        .from("vacation_balances")
        .select("available_days")
        .eq("employee_id", user.id)
        .maybeSingle();
      setBalance(bal?.available_days ?? 0);

      // Buscar política
      const { data: pol } = await supabase
        .from("vacation_policies")
        .select("min_period_days, allow_retroactive")
        .maybeSingle();
      setPolicy(pol ?? { min_period_days: 5, allow_retroactive: false });
    };
    fetchBalanceAndPolicy();
  }, [user]);

  const clearForm = () => {
    setStartDate(null);
    setEndDate(null);
    setError("");
    setSuccess("");
  };

  const validate = () => {
    if (!startDate || !endDate) {
      setError("Preencha as datas de início e fim das férias.");
      return false;
    }
    if (isAfter(startDate, endDate) || (isSameDay(startDate, endDate) === false && isAfter(endDate, startDate) === false)) {
      setError("A data final deve ser após a inicial.");
      return false;
    }
    const days = differenceInCalendarDays(endDate, startDate) + 1;
    if (policy && days < policy.min_period_days) {
      setError(`O período deve ter pelo menos ${policy.min_period_days} dias.`);
      return false;
    }
    if (balance !== null && days > balance) {
      setError("Você não possui saldo suficiente de férias.");
      return false;
    }
    if (policy && !policy.allow_retroactive) {
      const now = new Date();
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);
      if (isBefore(start, now)) {
        setError("Não é permitido solicitar férias retroativas.");
        return false;
      }
    }
    // Validação dos dados obrigatórios do perfil
    if (!profile?.department_id || !profile?.job_function_id) {
      setError("Seu perfil está incompleto (setor ou função ausente). Solicite atualização ao RH.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!user || !profile) {
      setError("Usuário não autenticado.");
      return;
    }
    if (!validate()) return;

    setIsLoading(true);

    const days = differenceInCalendarDays(endDate!, startDate!) + 1;
    const payload = {
      employee_id: user.id,
      start_date: format(startDate!, "yyyy-MM-dd"),
      end_date: format(endDate!, "yyyy-MM-dd"),
      days,
      status: "pending",
      department_id: profile.department_id,
      job_function_id: profile.job_function_id,
    };

    const { error: reqErr } = await supabase.from("vacation_requests").insert(payload);

    if (reqErr) {
      setError("Erro ao solicitar férias. Tente novamente.");
    } else {
      setSuccess("Solicitação registrada com sucesso! Aguardando aprovação.");
      toast({
        title: "Solicitação enviada!",
        description: "Sua solicitação de férias foi registrada com sucesso e está aguardando aprovação.",
        variant: "default"
      });
      clearForm();
    }
    setIsLoading(false);
  };

  // Helper for calendar popover button label
  function getDateLabel(date: Date | null, placeholder: string) {
    return date ? format(date, "dd/MM/yyyy") : <span className="text-muted-foreground">{placeholder}</span>;
  }

  // Nova mensagem de orientação se saldo for 0
  const renderBalanceHint = () => {
    if (balance === null) {
      return null;
    }
    if (balance === 0) {
      return (
        <Alert variant="destructive" className="mb-4 border-2">
          <AlertDescription className="text-base">
            Você está sem saldo de férias disponível no momento. Caso acredite que deveria ter saldo, por favor entre em contato com o RH para regularizar.
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Umbrella className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Solicitar Férias</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Data de início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal mt-2 h-12 text-base",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-5 w-5" />
                      {getDateLabel(startDate, "Selecionar data de início")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate ?? undefined}
                      onSelect={setStartDate}
                      disabled={date =>
                        false
                      }
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      fromDate={new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <Label className="text-base font-medium">Data de término</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal mt-2 h-12 text-base",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-5 w-5" />
                      {getDateLabel(endDate, "Selecionar data de término")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate ?? undefined}
                      onSelect={setEndDate}
                      disabled={date =>
                        startDate
                          ? isBefore(date, startDate)
                          : false
                      }
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      fromDate={startDate ?? new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Dias solicitados</Label>
                <Input
                  type="text"
                  disabled
                  value={
                    startDate && endDate
                      ? differenceInCalendarDays(endDate, startDate) + 1
                      : ""
                  }
                  className="h-12 text-base"
                />
              </div>
              
              <div>
                <Label className="text-base font-medium">Saldo disponível</Label>
                <Input
                  type="text"
                  disabled
                  value={
                    balance === null
                      ? "..."
                      : `${balance} dia${balance === 1 ? "" : "s"}`
                  }
                  className={cn(
                    "h-12 text-base",
                    balance === 0 ? "border-destructive font-bold text-destructive" : ""
                  )}
                />
                {renderBalanceHint()}
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="border-2">
              <AlertDescription className="text-base">{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert variant="default" className="border-2">
              <AlertDescription className="text-base text-green-700">{success}</AlertDescription>
            </Alert>
          )}
          
          <Button
            type="submit"
            className="w-full h-14 text-lg font-semibold"
            disabled={isLoading || (balance !== null && balance === 0)}
          >
            {isLoading ? "Enviando..." : "Solicitar Férias"}
          </Button>
        </form>
      </div>
    </div>
  );
}
