import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ArrowDown, CalendarOff, Check, Clock, ExternalLink, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, getLocalDateString } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { PagamentoModal } from "@/components/parcelas/PagamentoModal";

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

type Recebimento = {
  evento_id: string;
  parcela_id: string;
  contrato_id: string;
  cliente_nome: string;
  numero_parcela: number;
  total_parcelas: number;
  data_vencimento_parcela: string;
  valor_pago: number;
  tipo_pagamento: string | null;
  observacao: string | null;
  data_pagamento: string;
};

type Previsto = {
  parcela_id: string;
  contrato_id: string;
  cliente_nome: string;
  numero_parcela: number;
  total_parcelas: number;
  valor_previsto: number;
  valor_ja_pago: number;
  dias_atraso: number;
  status: string;
  valor: number;
  valor_original: number;
  data_vencimento: string;
  percentual: number;
  tipo_juros: string;
  valor_emprestado: number;
  contrato_numero_parcelas: number;
};

type Emprestimo = {
  contrato_id: string;
  cliente_nome: string;
  valor_emprestado: number;
  numero_parcelas: number;
  percentual: number;
  periodicidade: string;
  data_emprestimo: string;
};

type DiaDetalhes = {
  data: string;
  tipo: "passado" | "hoje" | "futuro";
  recebimentos: Recebimento[];
  previstos: Previsto[];
  emprestimos: Emprestimo[];
  totais: {
    total_recebido: number;
    total_previsto: number;
    qtd_recebimentos: number;
    qtd_previstos: number;
    total_emprestado?: number;
    qtd_emprestimos?: number;
  };
};

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const tipoPagamentoLabel: Record<string, string> = {
  total: "Total",
  juros: "Juros",
  parcial: "Parcial",
};

interface Props {
  dias: DiaCalendario[];
  mesAtual: Date;
  dataSelecionada: string;
  onSelectDia: (data: string) => void;
  onAbrirModal: () => void;
  isLoading: boolean;
}

export function MobileCalendarioView({
  dias,
  mesAtual,
  dataSelecionada,
  onSelectDia,
  onAbrirModal,
  isLoading,
}: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [parcelaPagamento, setParcelaPagamento] = useState<any>(null);
  const [isPagamentoOpen, setIsPagamentoOpen] = useState(false);

  const diasMap = useMemo(() => {
    const map = new Map<string, DiaCalendario>();
    dias?.forEach((d) => map.set(d.data, d));
    return map;
  }, [dias]);

  const gridDias = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mesAtual), { weekStartsOn: 0 });
    const fim = endOfWeek(endOfMonth(mesAtual), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: inicio, end: fim }).slice(0, 42);
  }, [mesAtual]);

  const { data: detalhes, isLoading: isLoadingDetalhes } = useQuery<DiaDetalhes>({
    queryKey: ["calendario-dia", dataSelecionada],
    queryFn: async () => {
      const { data: result, error } = await supabase.rpc("calendario_dia_detalhes", { p_data: dataSelecionada });
      if (error) throw error;
      return result as unknown as DiaDetalhes;
    },
    enabled: !!dataSelecionada,
  });

  const tituloDia = dataSelecionada
    ? capitalize(format(parseISO(`${dataSelecionada}T12:00:00`), "EEEE, d 'de' MMMM", { locale: ptBR }))
    : "";

  const handleVerContrato = (contratoId: string) => {
    navigate(`/contratos?open=${contratoId}`);
  };

  const handleBaixar = (p: Previsto) => {
    setParcelaPagamento({
      id: p.parcela_id,
      contrato_id: p.contrato_id,
      numero_parcela: p.numero_parcela,
      valor: p.valor,
      valor_original: p.valor_original,
      data_vencimento: p.data_vencimento,
      valor_pago: p.valor_ja_pago,
      status: p.status,
      contratos: {
        clientes: { nome: p.cliente_nome },
        percentual: p.percentual,
        tipo_juros: p.tipo_juros,
        valor_emprestado: p.valor_emprestado,
        numero_parcelas: p.contrato_numero_parcelas,
      },
    });
    setIsPagamentoOpen(true);
  };

  const handlePagamentoConfirmado = () => {
    setIsPagamentoOpen(false);
    setParcelaPagamento(null);
    queryClient.invalidateQueries({ queryKey: ["calendario"] });
    queryClient.invalidateQueries({ queryKey: ["calendario-dia"] });
    queryClient.invalidateQueries({ queryKey: ["parcelas"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const totRec = detalhes?.totais.total_recebido ?? 0;
  const totPrev = detalhes?.totais.total_previsto ?? 0;
  const qtdRec = detalhes?.totais.qtd_recebimentos ?? 0;
  const qtdPrev = detalhes?.totais.qtd_previstos ?? 0;
  const totEmp = detalhes?.totais.total_emprestado ?? 0;
  const qtdEmp = detalhes?.totais.qtd_emprestimos ?? 0;
  // Atrasados: previstos cujo data_vencimento < data selecionada
  const previstosAtrasados = detalhes?.previstos.filter((p) => p.dias_atraso > 0) ?? [];
  const totAtr = previstosAtrasados.reduce((s, p) => s + Math.max(0, p.valor_previsto), 0);
  const qtdAtr = previstosAtrasados.length;

  const temConteudo = !!detalhes && (detalhes.recebimentos.length > 0 || detalhes.previstos.length > 0 || (detalhes.emprestimos?.length ?? 0) > 0);

  return (
    <>
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/30 sticky top-0 z-10">
          {DIAS_SEMANA.map((d, i) => (
            <div key={i} className="text-[11px] font-medium text-muted-foreground text-center py-2">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {gridDias.map((dia, idx) => {
            const noMes = isSameMonth(dia, mesAtual);
            if (!noMes) {
              return <div key={idx} aria-hidden="true" className="aspect-square min-h-[44px]" />;
            }

            const iso = getLocalDateString(dia);
            const info = diasMap.get(iso);
            const ehHoje = isToday(dia);
            const ehSelecionado = iso === dataSelecionada;

            if (isLoading) {
              return (
                <div key={idx} className="aspect-square min-h-[44px] flex items-center justify-center">
                  <Skeleton className="h-6 w-6 rounded-full" />
                </div>
              );
            }

            const valor = info?.valor ?? 0;
            const tipo = info?.tipo;
            const jaRecebido = info?.ja_recebido_hoje ?? 0;
            const valorAtrasado = info?.valor_atrasado ?? 0;

            const showVerde = (valor > 0 && tipo === "passado") || (tipo === "hoje" && jaRecebido > 0);
            const showAzul = valor > 0 && tipo !== "passado";
            const showLaranja = valorAtrasado > 0;

            const aria = (() => {
              const dataLabel = format(dia, "d 'de' MMMM", { locale: ptBR });
              const partes: string[] = [dataLabel];
              if (showVerde) partes.push(`recebido ${formatBRL(tipo === "hoje" ? jaRecebido : valor)}`);
              if (showAzul) partes.push(`previsto ${formatBRL(valor)}`);
              if (showLaranja) partes.push(`atrasado ${formatBRL(valorAtrasado)}`);
              if (partes.length === 1) partes.push("sem movimentações");
              return partes.join(", ");
            })();

            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectDia(iso)}
                aria-label={aria}
                aria-selected={ehSelecionado}
                aria-current={ehHoje ? "date" : undefined}
                className={cn(
                  "aspect-square min-h-[44px] border-b border-r flex flex-col items-center justify-center gap-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset relative",
                  ehSelecionado && "bg-muted font-semibold",
                  ehHoje && "border-2 border-primary font-bold text-primary z-[1]"
                )}
              >
                <span>{dia.getDate()}</span>
                {(showVerde || showAzul || showLaranja) && (
                  <div className="flex gap-0.5">
                    {showVerde && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
                    {showAzul && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    {showLaranja && <span className="h-1.5 w-1.5 rounded-full bg-destructive" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Bloco de detalhes do dia */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-3 border-b">
          <h3 className="text-sm font-semibold truncate">{tituloDia}</h3>
          <Button variant="ghost" size="sm" onClick={onAbrirModal} className="h-8 text-xs shrink-0">
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Ver tudo
          </Button>
        </div>

        {(totRec > 0 || totPrev > 0 || totAtr > 0) && (
          <div className="px-3 py-2 border-b space-y-1.5 text-sm">
            {totRec > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Check className="h-4 w-4 text-success" /> Recebido
                </span>
                <span className="font-semibold text-success">
                  {formatBRL(totRec)} <span className="text-xs text-muted-foreground">({qtdRec})</span>
                </span>
              </div>
            )}
            {totPrev > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 text-primary" /> Previsto
                </span>
                <span className="font-semibold text-primary">
                  {formatBRL(totPrev)} <span className="text-xs text-muted-foreground">({qtdPrev})</span>
                </span>
              </div>
            )}
            {totAtr > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> Atrasados
                </span>
                <span className="font-semibold text-destructive">
                  {formatBRL(totAtr)} <span className="text-xs text-muted-foreground">({qtdAtr})</span>
                </span>
              </div>
            )}
          </div>
        )}

        <div className="p-3 space-y-4">
          {isLoadingDetalhes && (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {!isLoadingDetalhes && !temConteudo && (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <CalendarOff className="h-8 w-8 mb-2 opacity-60" />
              <p className="text-sm">Nenhuma movimentação neste dia.</p>
            </div>
          )}

          {!isLoadingDetalhes && detalhes && detalhes.recebimentos.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold text-success uppercase tracking-wide">Recebimentos</h4>
              <div className="space-y-2">
                {detalhes.recebimentos.map((r) => {
                  const venc = r.data_vencimento_parcela;
                  const isAntecipado = venc > detalhes.data;
                  const isAtrasadoR = venc < detalhes.data;
                  return (
                    <div key={r.evento_id} className="border rounded-md p-2.5 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{r.cliente_nome}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            <span className="text-[11px] text-muted-foreground">
                              Parcela {r.numero_parcela}/{r.total_parcelas}
                            </span>
                            {r.tipo_pagamento && (
                              r.tipo_pagamento === "juros" ? (
                                <Badge className="bg-warning/15 text-warning border-warning/30 text-[10px]">
                                  Juros (não abate)
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">
                                  {tipoPagamentoLabel[r.tipo_pagamento] ?? r.tipo_pagamento}
                                </Badge>
                              )
                            )}
                            {isAntecipado && (
                              <Badge variant="secondary" className="text-[10px]">Antecipado</Badge>
                            )}
                            {isAtrasadoR && (
                              <Badge variant="destructive" className="text-[10px]">Atrasado</Badge>
                            )}
                          </div>
                        </div>
                        <span className="font-bold text-success whitespace-nowrap text-sm">
                          {formatBRL(r.valor_pago)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {!isLoadingDetalhes && detalhes && detalhes.previstos.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold text-primary uppercase tracking-wide">
                Previstos
              </h4>
              <div className="space-y-2">
                {detalhes.previstos.map((p) => (
                  <div key={p.parcela_id} className="border rounded-md p-2.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{p.cliente_nome}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="text-[11px] text-muted-foreground">
                            Parcela {p.numero_parcela}/{p.total_parcelas}
                          </span>
                          {p.dias_atraso > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                              {p.dias_atraso} {p.dias_atraso === 1 ? "dia" : "dias"} de atraso
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="font-bold text-primary whitespace-nowrap text-sm">
                        {formatBRL(Math.max(0, p.valor_previsto))}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerContrato(p.contrato_id)}
                        className="flex-1 h-9 text-xs"
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        Ver contrato
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleBaixar(p)}
                        className="flex-1 h-9 text-xs"
                      >
                        <Wallet className="h-3.5 w-3.5 mr-1" />
                        Baixar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </Card>

      <PagamentoModal
        isOpen={isPagamentoOpen}
        onOpenChange={setIsPagamentoOpen}
        parcela={parcelaPagamento}
        onPagamentoConfirmado={handlePagamentoConfirmado}
      />
    </>
  );
}
