import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOptimizedAuth } from "@/contexts/OptimizedAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInCalendarDays, isAfter, isBefore, isSameDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
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
        <Alert variant="destructive" className="mb-2">
          <AlertDescription>
            Você está sem saldo de férias disponível no momento. Caso acredite que deveria ter saldo, por favor entre em contato com o RH para regularizar.
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <Card className="shadow-md mb-4">
        <CardHeader>
          <CardTitle>Solicitar Férias</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Data de início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal mt-1",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
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
              <Label>Data de término</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal mt-1",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
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
            <div>
              <Label>Dias solicitados</Label>
              <Input
                type="text"
                disabled
                value={
                  startDate && endDate
                    ? differenceInCalendarDays(endDate, startDate) + 1
                    : ""
                }
              />
            </div>
            <div>
              <Label>Saldo disponível</Label>
              <Input
                type="text"
                disabled
                value={
                  balance === null
                    ? "..."
                    : `${balance} dia${balance === 1 ? "" : "s"}`
                }
                className={balance === 0 ? "border-destructive font-bold text-destructive" : ""}
              />
              {renderBalanceHint()}
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert variant="default">
                <AlertDescription className="text-green-700">{success}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              className="w-full bg-primary"
              disabled={isLoading || (balance !== null && balance === 0)}
            >
              {isLoading ? "Enviando..." : "Solicitar Férias"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
