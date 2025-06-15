
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/calendar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOptimizedAuth } from "@/contexts/OptimizedAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInCalendarDays } from "date-fns";

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
    if (endDate <= startDate) {
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
    if (policy && !policy.allow_retroactive && startDate < new Date()) {
      setError("Não é permitido solicitar férias retroativas.");
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
    const { error: reqErr } = await supabase.from("vacation_requests").insert({
      employee_id: user.id,
      employee_name: profile.name,
      start_date: format(startDate!, "yyyy-MM-dd"),
      end_date: format(endDate!, "yyyy-MM-dd"),
      days: days,
      status: "pending"
    });

    if (reqErr) {
      setError("Erro ao solicitar férias. Tente novamente.");
    } else {
      setSuccess("Solicitação registrada com sucesso! Aguardando aprovação.");
      clearForm();
    }
    setIsLoading(false);
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
              <DatePicker 
                selected={startDate} 
                onSelect={setStartDate} 
                minDate={new Date()}
                required
              />
            </div>
            <div>
              <Label>Data de término</Label>
              <DatePicker 
                selected={endDate} 
                onSelect={setEndDate}
                minDate={startDate ?? new Date()}
                required
              />
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
              <Input type="text" disabled value={balance ?? "..."} />
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
            <Button type="submit" className="w-full bg-primary" disabled={isLoading}>
              {isLoading ? "Enviando..." : "Solicitar Férias"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
