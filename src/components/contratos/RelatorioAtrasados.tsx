import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { AlertTriangle, Download, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { exportarPng, exportarPdf } from "./relatorioExport";
import { buildRelatorioAtrasadosHtml } from "./relatorioAtrasadosTemplate";

interface ContratoData {
  contratoId: string;
  clienteNome: string;
  parcPagas: number;
  parcAtrasadas: number;
  valorAtrasado: number;
  parcPendentes: number;
  valorPendente: number;
  totalParcelas: number;
}

function getReportTitle(showPagas: boolean, showAtrasadas: boolean, showPendentes: boolean): string {
  if (showAtrasadas && showPendentes) return "RELATÓRIO DE CONTRATOS EM ABERTO";
  if (showAtrasadas && !showPendentes) return "RELATÓRIO DE CONTRATOS ATRASADOS";
  if (showPendentes && !showAtrasadas) return "RELATÓRIO DE CONTRATOS PENDENTES";
  if (showPagas && !showAtrasadas && !showPendentes) return "RELATÓRIO DE PARCELAS PAGAS";
  return "RELATÓRIO GERAL DE CONTRATOS";
}

function buildDynamicColumns(showPagas: boolean, showAtrasadas: boolean, showPendentes: boolean) {
  const cols: { key: string; header: string; align: string; color?: string }[] = [];
  cols.push({ key: "cliente", header: "Cliente", align: "left" });
  if (showPagas) cols.push({ key: "pagas", header: "Pagas", align: "center", color: "#1d7a55" });
  if (showAtrasadas) cols.push({ key: "atrasadas", header: "Atrasadas", align: "center", color: "#b0322a" });
  if (showPendentes) cols.push({ key: "pendentes", header: "Pendentes", align: "center", color: "#9a6310" });
  if (showAtrasadas) cols.push({ key: "valorAtrasado", header: "Valor Atrasado", align: "right" });
  if (showPendentes) cols.push({ key: "valorPendente", header: "Valor Pendente", align: "right" });
  return cols;
}

function getCellValue(d: ContratoData, key: string): string {
  switch (key) {
    case "cliente": return d.clienteNome;
    case "pagas": return d.parcPagas.toString();
    case "atrasadas": return d.parcAtrasadas.toString();
    case "pendentes": return d.parcPendentes.toString();
    case "valorAtrasado": return `R$ ${d.valorAtrasado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    case "valorPendente": return `R$ ${d.valorPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    default: return "";
  }
}

function getTotalValue(data: ContratoData[], key: string): string {
  switch (key) {
    case "pagas": return data.reduce((s, d) => s + d.parcPagas, 0).toString();
    case "atrasadas": return data.reduce((s, d) => s + d.parcAtrasadas, 0).toString();
    case "pendentes": return data.reduce((s, d) => s + d.parcPendentes, 0).toString();
    case "valorAtrasado": return `R$ ${data.reduce((s, d) => s + d.valorAtrasado, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    case "valorPendente": return `R$ ${data.reduce((s, d) => s + d.valorPendente, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    default: return "";
  }
}

export function RelatorioAtrasados() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dados, setDados] = useState<ContratoData[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showPagas, setShowPagas] = useState(false);
  const [showAtrasadas, setShowAtrasadas] = useState(true);
  const [showPendentes, setShowPendentes] = useState(false);
  const { toast } = useToast();

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const activeCount = [showPagas, showAtrasadas, showPendentes].filter(Boolean).length;

  const filteredDados = useMemo(() => {
    return dados.filter((d) => {
      if (showAtrasadas && d.parcAtrasadas > 0) return true;
      if (showPendentes && d.parcPendentes > 0) return true;
      if (showPagas && !showAtrasadas && !showPendentes && d.parcPagas > 0) return true;
      return false;
    });
  }, [dados, showPagas, showAtrasadas, showPendentes]);

  const loadDados = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("parcelas")
        .select(`
          id, status, data_vencimento, valor, valor_original, valor_pago,
          contratos!inner(id, clientes!inner(nome), numero_parcelas)
        `)
        .eq("contratos.status", "ativo");

      if (error) throw error;

      const map = new Map<string, ContratoData>();

      (data || []).forEach((p: any) => {
        const cId = p.contratos.id;
        const nome = p.contratos.clientes.nome;
        if (!map.has(cId)) {
          map.set(cId, {
            contratoId: cId,
            clienteNome: nome,
            parcPagas: 0,
            parcAtrasadas: 0,
            valorAtrasado: 0,
            parcPendentes: 0,
            valorPendente: 0,
            totalParcelas: p.contratos.numero_parcelas,
          });
        }
        const entry = map.get(cId)!;
        if (p.status === "pago") {
          entry.parcPagas++;
        } else {
          const venc = new Date(p.data_vencimento + "T00:00:00");
          if (venc < hoje) {
            entry.parcAtrasadas++;
            entry.valorAtrasado += Number(p.valor_original || p.valor);
          } else {
            entry.parcPendentes++;
            entry.valorPendente += Number(p.valor_original || p.valor);
          }
        }
      });

      const result = Array.from(map.values());
      result.sort((a, b) => a.clienteNome.localeCompare(b.clienteNome));
      setDados(result);
    } catch {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadDados();
  }, [open]);

  // Reset selection when filters change
  useEffect(() => {
    setSelected(new Set(filteredDados.map((r) => r.contratoId)));
  }, [filteredDados]);

  const toggleAll = () => {
    if (selected.size === filteredDados.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredDados.map((d) => d.contratoId)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectedDados = filteredDados.filter((d) => selected.has(d.contratoId));
  const columns = buildDynamicColumns(showPagas, showAtrasadas, showPendentes);
  const title = getReportTitle(showPagas, showAtrasadas, showPendentes);

  const buildSummaryCards = (data: ContratoData[]) => {
    const cards: { label: string; value: string; color: string; anchor?: boolean }[] = [];
    cards.push({ label: "Clientes", value: data.length.toString(), color: "#15201b" });
    if (showPagas) cards.push({ label: "Parcelas Pagas", value: data.reduce((s, d) => s + d.parcPagas, 0).toString(), color: "#1d7a55" });
    if (showAtrasadas) {
      cards.push({ label: "Parcelas Atrasadas", value: data.reduce((s, d) => s + d.parcAtrasadas, 0).toString(), color: "#b0322a" });
      cards.push({ label: "Valor Atrasado", value: `R$ ${data.reduce((s, d) => s + d.valorAtrasado, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, color: "#b0322a", anchor: true });
    }
    if (showPendentes) {
      cards.push({ label: "Parcelas Pendentes", value: data.reduce((s, d) => s + d.parcPendentes, 0).toString(), color: "#9a6310" });
      cards.push({ label: "Valor Pendente", value: `R$ ${data.reduce((s, d) => s + d.valorPendente, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, color: "#9a6310" });
    }
    return cards;
  };

  const buildHtml = () => {
    const cards = buildSummaryCards(selectedDados);
    const filtros: string[] = [];
    if (showPagas) filtros.push("Pagas");
    if (showAtrasadas) filtros.push("Atrasadas");
    if (showPendentes) filtros.push("Pendentes");
    const rows = selectedDados.map((d) => ({
      cells: columns.map((c) => ({
        value: getCellValue(d, c.key),
        align: c.align,
        color: c.color,
      })),
    }));
    const totals = columns.map((c) => ({
      value: c.key === "cliente" ? `TOTAL (${selectedDados.length} clientes)` : getTotalValue(selectedDados, c.key),
      align: c.align,
    }));
    return buildRelatorioAtrasadosHtml({
      title,
      columns,
      cards,
      rows,
      totals,
      totalClientes: selectedDados.length,
      filtros,
    });
  };

  const fileBase = () => `relatorio-atrasados-${format(new Date(), "dd-MM-yyyy")}`;

  const gerarImagem = async () => {
    if (selectedDados.length === 0) return;
    setGenerating(true);
    try {
      const { html, width } = buildHtml();
      await exportarPng(html, width, `${fileBase()}.png`, title, toast);
    } finally {
      setGenerating(false);
    }
  };

  const gerarPDF = async () => {
    if (selectedDados.length === 0) return;
    setGenerating(true);
    try {
      const { html, width } = buildHtml();
      await exportarPdf(html, width, `${fileBase()}.pdf`, toast);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <AlertTriangle className="h-4 w-4 mr-1.5" />
        Atrasados
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar Relatório</DialogTitle>
            <DialogDescription>Configure as colunas e selecione os contratos</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {/* Visibility flags */}
            <div className="flex flex-wrap gap-4 pb-3 border-b mb-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="show-pagas"
                  checked={showPagas}
                  onCheckedChange={(v) => { if (!v && activeCount <= 1) return; setShowPagas(v); }}
                  disabled={showPagas && activeCount <= 1}
                />
                <Label htmlFor="show-pagas" className="text-xs cursor-pointer">Pagas</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-atrasadas"
                  checked={showAtrasadas}
                  onCheckedChange={(v) => { if (!v && activeCount <= 1) return; setShowAtrasadas(v); }}
                  disabled={showAtrasadas && activeCount <= 1}
                />
                <Label htmlFor="show-atrasadas" className="text-xs cursor-pointer">Atrasadas</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-pendentes"
                  checked={showPendentes}
                  onCheckedChange={(v) => { if (!v && activeCount <= 1) return; setShowPendentes(v); }}
                  disabled={showPendentes && activeCount <= 1}
                />
                <Label htmlFor="show-pendentes" className="text-xs cursor-pointer">Pendentes</Label>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
            ) : filteredDados.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum contrato encontrado para os filtros selecionados.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{selected.size} de {filteredDados.length} selecionados</span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleAll}>
                    {selected.size === filteredDados.length ? "Desmarcar Todos" : "Selecionar Todos"}
                  </Button>
                </div>
                <div className="space-y-1">
                  {filteredDados.map((d) => (
                    <label
                      key={d.contratoId}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selected.has(d.contratoId)}
                        onCheckedChange={() => toggle(d.contratoId)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.clienteNome}</p>
                        <p className="text-xs text-muted-foreground">
                          {showPagas && <><span className="text-success">{d.parcPagas} pagas</span>{" · "}</>}
                          {showAtrasadas && <><span className="text-destructive font-medium">{d.parcAtrasadas} atrasadas</span>{" · "}</>}
                          {showPendentes && <><span className="text-warning font-medium">{d.parcPendentes} pendentes</span>{" · "}</>}
                          R$ {(d.valorAtrasado + d.valorPendente).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={gerarImagem}
              disabled={selected.size === 0 || generating}
              className="flex-1 sm:flex-none"
            >
              <Image className="h-4 w-4 mr-1.5" />
              Baixar Imagem
            </Button>
            <Button
              size="sm"
              onClick={gerarPDF}
              disabled={selected.size === 0 || generating}
              className="flex-1 sm:flex-none"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Baixar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
