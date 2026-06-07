import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarCheck, TrendingUp, Activity, ArrowDownCircle, ArrowDown } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cn, getLocalDateString } from "@/lib/utils";
import { DetalheDiaModal } from "@/components/calendario/DetalheDiaModal";
import { MobileCalendarioView } from "@/components/calendario/MobileCalendarioView";
import { useToast } from "@/hooks/use-toast";

type DiaCalendario = {
  data: string;
  tipo: "passado" | "hoje" | "futuro";
  valor: number;
  qtd_movimentacoes: number;
  ja_recebido_hoje?: number;
  valor_atrasado?: number;
  qtd_atrasados?: number;
  valor_saida?: number;
  qtd_saidas?: number;
};

type CalendarioMensal = {
  dias: DiaCalendario[];
  totais: {
    recebido_mes: number;
    previsto_mes: number;
    qtd_recebimentos_mes: number;
    qtd_previstos_mes: number;
    total_atrasado_mes?: number;
    qtd_atrasados_mes?: number;
    total_emprestado_mes?: number;
    qtd_emprestimos_mes?: number;
  };
};

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const formatarCompacto = (valor: number) => {
  if (!valor) return "";
  if (Math.abs(valor) >= 1000) {
    return `R$ ${(valor / 1000).toFixed(valor >= 10000 ? 0 : 1)}k`;
  }
  return `R$ ${valor.toFixed(0)}`;
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

export default function Calendario() {
  const { toast } = useToast();
  const [mesAtual, setMesAtual] = useState<Date>(() => startOfMonth(new Date()));
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dataSelecionadaMobile, setDataSelecionadaMobile] = useState<string>(() => getLocalDateString(new Date()));

  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth() + 1;

  const { data, isLoading, isError, refetch, isFetching } = useQuery<CalendarioMensal>({
    queryKey: ["calendario", ano, mes],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("calendario_mensal", { p_mes: mes, p_ano: ano });
      if (error) throw error;
      return data as unknown as CalendarioMensal;
    },
    staleTime: 60_000,
  });

  const diasMap = useMemo(() => {
    const map = new Map<string, DiaCalendario>();
    data?.dias?.forEach((d) => map.set(d.data, d));
    return map;
  }, [data]);

  const gridDias = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mesAtual), { weekStartsOn: 0 });
    const fim = endOfWeek(endOfMonth(mesAtual), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: inicio, end: fim }).slice(0, 42);
  }, [mesAtual]);

  // Sincroniza dataSelecionadaMobile com mês visível
  useEffect(() => {
    const hoje = new Date();
    if (isSameMonth(mesAtual, hoje)) {
      setDataSelecionadaMobile(getLocalDateString(hoje));
    } else {
      setDataSelecionadaMobile(getLocalDateString(startOfMonth(mesAtual)));
    }
  }, [mesAtual]);

  const handlePrev = () => setMesAtual((m) => subMonths(m, 1));
  const handleNext = () => setMesAtual((m) => addMonths(m, 1));
  const handleHoje = () => setMesAtual(startOfMonth(new Date()));

  const abrirDia = (dia: Date) => {
    if (!isSameMonth(dia, mesAtual)) return;
    const iso = getLocalDateString(dia);
    setDataSelecionada(iso);
    setIsModalOpen(true);
  };

  const abrirModalMobile = () => {
    setDataSelecionada(dataSelecionadaMobile);
    setIsModalOpen(true);
  };

  if (isError) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <p className="text-muted-foreground">Erro ao carregar o calendário.</p>
          <Button onClick={() => { refetch(); toast({ title: "Recarregando..." }); }}>
            Tentar novamente
          </Button>
        </div>
      </>
    );
  }

  const totais = data?.totais;

  return (
    <>
      <div className="flex flex-col gap-4 md:gap-6">
        <PageHeader title="Calendário" description="Recebimentos e previsões por dia" />

        {/* Navegação de mês */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handlePrev} aria-label="Mês anterior" className="h-9 w-9">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-base md:text-lg font-semibold min-w-[140px] md:min-w-[180px] text-center">
              {capitalize(format(mesAtual, "MMMM yyyy", { locale: ptBR }))}
            </h2>
            <Button variant="ghost" size="icon" onClick={handleNext} aria-label="Próximo mês" className="h-9 w-9">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleHoje} className="h-9">
            Hoje
          </Button>
        </div>

        {/* Cards de resumo - desktop (5 cards) */}
        <div className="hidden md:grid grid-cols-5 gap-3">
          <Card className="p-3 md:p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarCheck className="h-3.5 w-3.5 text-success" />
              Recebido no mês
            </div>
            <div className="text-lg md:text-2xl font-bold text-success mt-1 truncate">
              {isLoading ? <Skeleton className="h-7 w-24" /> : formatBRL(totais?.recebido_mes ?? 0)}
            </div>
          </Card>
          <Card className="p-3 md:p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              Previsto no mês
            </div>
            <div className="text-lg md:text-2xl font-bold text-primary mt-1 truncate">
              {isLoading ? <Skeleton className="h-7 w-24" /> : formatBRL(totais?.previsto_mes ?? 0)}
            </div>
          </Card>
          <Card className="p-3 md:p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowDownCircle className="h-3.5 w-3.5 text-destructive" />
              Emprestado no mês
            </div>
            <div className="text-lg md:text-2xl font-bold text-destructive mt-1 truncate">
              {isLoading ? <Skeleton className="h-7 w-24" /> : formatBRL(totais?.total_emprestado_mes ?? 0)}
            </div>
            {!isLoading && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {totais?.qtd_emprestimos_mes ?? 0} empréstimo(s)
              </div>
            )}
          </Card>
          <Card className="p-3 md:p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              Movimentações realizadas
            </div>
            <div className="text-lg md:text-2xl font-bold mt-1">
              {isLoading ? <Skeleton className="h-7 w-12" /> : (totais?.qtd_recebimentos_mes ?? 0)}
            </div>
          </Card>
          <Card className="p-3 md:p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              Movimentações previstas
            </div>
            <div className="text-lg md:text-2xl font-bold mt-1">
              {isLoading ? <Skeleton className="h-7 w-12" /> : (totais?.qtd_previstos_mes ?? 0)}
            </div>
          </Card>
        </div>

        {/* Cards de resumo - mobile (3 cards) */}
        <div className="grid grid-cols-2 gap-3 md:hidden">
          <Card className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarCheck className="h-3.5 w-3.5 text-success" />
              Recebido no mês
            </div>
            <div className="text-lg font-bold text-success mt-1 truncate">
              {isLoading ? <Skeleton className="h-7 w-24" /> : formatBRL(totais?.recebido_mes ?? 0)}
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              Previsto no mês
            </div>
            <div className="text-lg font-bold text-primary mt-1 truncate">
              {isLoading ? <Skeleton className="h-7 w-24" /> : formatBRL(totais?.previsto_mes ?? 0)}
            </div>
          </Card>
          <Card className="p-3 col-span-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowDownCircle className="h-3.5 w-3.5 text-destructive" />
              Emprestado no mês
            </div>
            <div className="text-lg font-bold text-destructive mt-1 truncate">
              {isLoading ? <Skeleton className="h-7 w-24" /> : formatBRL(totais?.total_emprestado_mes ?? 0)}
              {!isLoading && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  ({totais?.qtd_emprestimos_mes ?? 0})
                </span>
              )}
            </div>
          </Card>
        </div>

        {/* Mobile view */}
        <div className="md:hidden space-y-4">
          <MobileCalendarioView
            dias={data?.dias ?? []}
            mesAtual={mesAtual}
            dataSelecionada={dataSelecionadaMobile}
            onSelectDia={setDataSelecionadaMobile}
            onAbrirModal={abrirModalMobile}
            isLoading={isLoading}
          />
        </div>

        {/* Calendário desktop */}
        <Card className="hidden md:block overflow-hidden">
          {/* Cabeçalho dias da semana */}
          <div className="grid grid-cols-7 border-b bg-muted/30 sticky top-0 z-10">
            {DIAS_SEMANA.map((d, i) => (
              <div
                key={i}
                className="text-[11px] md:text-xs font-medium text-muted-foreground text-center py-2"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid de dias */}
          <div
            className={cn(
              "grid grid-cols-7 transition-opacity duration-200",
              isFetching && !isLoading && "opacity-60"
            )}
          >
            {gridDias.map((dia, idx) => {
              const iso = getLocalDateString(dia);
              const info = diasMap.get(iso);
              const noMes = isSameMonth(dia, mesAtual);
              const ehHoje = isToday(dia);
              const valor = info?.valor ?? 0;
              const tipo = info?.tipo;
              const jaRecebido = info?.ja_recebido_hoje ?? 0;
              const valorSaida = info?.valor_saida ?? 0;

              if (!noMes) {
                return (
                  <div
                    key={idx}
                    className="min-h-[70px] md:min-h-[90px] border-b border-r p-1.5 md:p-2 text-muted-foreground/40 select-none"
                    aria-hidden="true"
                  >
                    <span className="text-xs md:text-sm">{dia.getDate()}</span>
                  </div>
                );
              }

              if (isLoading) {
                return (
                  <div key={idx} className="min-h-[70px] md:min-h-[90px] border-b border-r p-1.5 md:p-2">
                    <Skeleton className="h-3 w-4 mb-2" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                );
              }

              const corValor =
                tipo === "passado"
                  ? "text-success"
                  : "text-primary";

              const aria = (() => {
                const dataLabel = format(dia, "d 'de' MMMM", { locale: ptBR });
                if (!info || (valor === 0 && valorSaida === 0)) return `${dataLabel}, sem movimentações`;
                const partes: string[] = [dataLabel];
                if (valor > 0) partes.push(tipo === "passado" ? `recebido ${formatBRL(valor)}` : `previsto ${formatBRL(valor)}`);
                if (valorSaida > 0) partes.push(`emprestado ${formatBRL(valorSaida)}`);
                return partes.join(", ");
              })();

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => abrirDia(dia)}
                  aria-label={aria}
                  className={cn(
                    "min-h-[70px] md:min-h-[90px] border-b border-r p-1.5 md:p-2 text-left transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset relative flex flex-col",
                    ehHoje && "border-2 border-primary bg-primary/5 z-[1]"
                  )}
                >
                  <span
                    className={cn(
                      "text-xs md:text-sm font-medium",
                      ehHoje && "text-primary font-bold"
                    )}
                  >
                    {dia.getDate()}
                  </span>
                  {valor > 0 && (
                    <span
                      className={cn(
                        "mt-auto font-semibold text-[10px] md:text-sm leading-tight truncate",
                        corValor
                      )}
                    >
                      <span className="md:hidden">{formatarCompacto(valor)}</span>
                      <span className="hidden md:inline">{formatBRL(valor)}</span>
                    </span>
                  )}
                  {valorSaida > 0 && (
                    <span className="font-semibold text-[10px] md:text-sm leading-tight truncate text-destructive flex items-center gap-0.5 mt-auto">
                      <ArrowDown className="h-3 w-3 shrink-0" />
                      <span className="md:hidden">{formatarCompacto(valorSaida)}</span>
                      <span className="hidden md:inline">{formatBRL(valorSaida)}</span>
                    </span>
                  )}
                  {tipo === "hoje" && jaRecebido > 0 && (
                    <span className="text-[9px] md:text-[11px] text-success font-medium leading-tight truncate">
                      ✓ <span className="md:hidden">{formatarCompacto(jaRecebido)}</span>
                      <span className="hidden md:inline">{formatBRL(jaRecebido)}</span> já
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      <DetalheDiaModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        data={dataSelecionada}
      />
    </>
  );
}