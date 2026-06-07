import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDown, CalendarOff, ExternalLink, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { PagamentoModal } from "@/components/parcelas/PagamentoModal";

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

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const tipoPagamentoLabel: Record<string, string> = {
  total: "Total",
  juros: "Juros",
  parcial: "Parcial",
};

interface DetalheDiaModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  data: string | null;
}

export function DetalheDiaModal({ isOpen, onOpenChange, data }: DetalheDiaModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [parcelaPagamento, setParcelaPagamento] = useState<any>(null);
  const [isPagamentoOpen, setIsPagamentoOpen] = useState(false);

  const { data: detalhes, isLoading } = useQuery<DiaDetalhes>({
    queryKey: ["calendario-dia", data],
    queryFn: async () => {
      const { data: result, error } = await supabase.rpc("calendario_dia_detalhes", { p_data: data });
      if (error) throw error;
      return result as unknown as DiaDetalhes;
    },
    enabled: !!data && isOpen,
  });

  const tituloData = data
    ? capitalize(format(parseISO(`${data}T12:00:00`), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }))
    : "";

  const tipoBadge = (() => {
    if (!detalhes) return null;
    if (detalhes.tipo === "hoje") return <Badge variant="default">Hoje</Badge>;
    if (detalhes.tipo === "passado") return <Badge variant="secondary">Dia passado</Badge>;
    return <Badge variant="outline">Dia futuro</Badge>;
  })();

  const handleVerContrato = (contratoId: string) => {
    onOpenChange(false);
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
    onOpenChange(false);
  };

  const temConteudo =
    !!detalhes &&
    (detalhes.recebimentos.length > 0 ||
      detalhes.previstos.length > 0 ||
      (detalhes.emprestimos?.length ?? 0) > 0);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex flex-col md:flex-row md:items-center gap-2">
              <span>{tituloData}</span>
              {tipoBadge}
            </DialogTitle>
            <DialogDescription>
              Movimentações do dia
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-6">
            {isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}

            {!isLoading && !temConteudo && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <CalendarOff className="h-10 w-10 mb-2 opacity-60" />
                <p>Nenhuma movimentação neste dia.</p>
              </div>
            )}

            {/* Recebimentos */}
            {!isLoading && detalhes && detalhes.recebimentos.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-success uppercase tracking-wide">
                  Recebimentos
                </h3>
                <div className="space-y-2">
                  {detalhes.recebimentos.map((r) => {
                    const venc = r.data_vencimento_parcela;
                    const isAntecipado = venc > detalhes.data;
                    const isAtrasado = venc < detalhes.data;
                    return (
                      <div
                        key={r.evento_id}
                        className="border rounded-md p-3 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{r.cliente_nome}</p>
                            <div className="flex items-center gap-2 flex-wrap mt-1">
                              <span className="text-xs text-muted-foreground">
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
                                <Badge variant="secondary" className="text-[10px]">
                                  Pagamento antecipado
                                </Badge>
                              )}
                              {isAtrasado && (
                                <Badge variant="destructive" className="text-[10px]">
                                  Pagamento atrasado
                                </Badge>
                              )}
                            </div>
                          </div>
                          <span className="font-bold text-success whitespace-nowrap">
                            {formatBRL(r.valor_pago)}
                          </span>
                        </div>
                        {r.observacao && (
                          <p className="text-xs text-muted-foreground italic">{r.observacao}</p>
                        )}
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVerContrato(r.contrato_id)}
                            className="h-7 text-xs"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Ver contrato
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end pt-2 border-t">
                  <p className="text-sm">
                    Total recebido:{" "}
                    <span className="font-bold text-success">
                      {formatBRL(detalhes.totais.total_recebido)}
                    </span>
                  </p>
                </div>
              </section>
            )}

            {/* Previstos */}
            {!isLoading && detalhes && detalhes.previstos.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">
                  Previstos para o dia
                </h3>
                <div className="space-y-2">
                  {detalhes.previstos.map((p) => (
                    <div key={p.parcela_id} className="border rounded-md p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{p.cliente_nome}</p>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <span className="text-xs text-muted-foreground">
                              Parcela {p.numero_parcela}/{p.total_parcelas}
                            </span>
                            {p.dias_atraso > 0 && (
                              <Badge variant="destructive" className="text-[10px]">
                                {p.dias_atraso} {p.dias_atraso === 1 ? "dia" : "dias"} de atraso
                              </Badge>
                            )}
                          </div>
                          {p.valor_ja_pago > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Já pago: {formatBRL(p.valor_ja_pago)} · Falta:{" "}
                              <span className="font-medium">{formatBRL(Math.max(0, p.valor_previsto))}</span>
                            </p>
                          )}
                        </div>
                        <span className="font-bold text-primary whitespace-nowrap">
                          {formatBRL(Math.max(0, p.valor_previsto))}
                        </span>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVerContrato(p.contrato_id)}
                          className="h-8 text-xs"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Ver contrato
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleBaixar(p)}
                          className="h-8 text-xs"
                        >
                          <Wallet className="h-3 w-3 mr-1" />
                          Baixar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-2 border-t">
                  <p className="text-sm">
                    Total previsto:{" "}
                    <span className="font-bold text-primary">
                      {formatBRL(detalhes.totais.total_previsto)}
                    </span>
                  </p>
                </div>
              </section>
            )}

            {/* Empréstimos do dia */}
            {!isLoading && detalhes && (detalhes.emprestimos?.length ?? 0) > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-destructive uppercase tracking-wide">
                  Empréstimos do dia
                </h3>
                <div className="space-y-2">
                  {detalhes.emprestimos.map((e) => (
                    <div key={e.contrato_id} className="border rounded-md p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{e.cliente_nome}</p>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <span className="text-xs text-muted-foreground">
                              {e.numero_parcelas} parcela(s)
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {Number(e.percentual).toFixed(2)}%
                            </span>
                          </div>
                        </div>
                        <span className="font-bold text-destructive whitespace-nowrap flex items-center gap-1">
                          <ArrowDown className="h-4 w-4" />
                          {formatBRL(e.valor_emprestado)}
                        </span>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVerContrato(e.contrato_id)}
                          className="h-7 text-xs"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Ver contrato
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-2 border-t">
                  <p className="text-sm">
                    Total emprestado:{" "}
                    <span className="font-bold text-destructive">
                      {formatBRL(detalhes.totais.total_emprestado ?? 0)}
                    </span>
                  </p>
                </div>
              </section>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PagamentoModal
        isOpen={isPagamentoOpen}
        onOpenChange={setIsPagamentoOpen}
        parcela={parcelaPagamento}
        onPagamentoConfirmado={handlePagamentoConfirmado}
      />
    </>
  );
}