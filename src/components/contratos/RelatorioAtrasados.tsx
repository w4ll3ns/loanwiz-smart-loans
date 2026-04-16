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
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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
  if (showPagas) cols.push({ key: "pagas", header: "Pagas", align: "center", color: "#22c55e" });
  if (showAtrasadas) cols.push({ key: "atrasadas", header: "Atrasadas", align: "center", color: "#ef4444" });
  if (showPendentes) cols.push({ key: "pendentes", header: "Pendentes", align: "center", color: "#f59e0b" });
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
    const cards: { label: string; value: string; color: string }[] = [];
    cards.push({ label: "Clientes", value: data.length.toString(), color: "#333" });
    if (showPagas) cards.push({ label: "Parcelas Pagas", value: data.reduce((s, d) => s + d.parcPagas, 0).toString(), color: "#22c55e" });
    if (showAtrasadas) {
      cards.push({ label: "Parcelas Atrasadas", value: data.reduce((s, d) => s + d.parcAtrasadas, 0).toString(), color: "#ef4444" });
      cards.push({ label: "Valor Atrasado", value: `R$ ${data.reduce((s, d) => s + d.valorAtrasado, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, color: "#ef4444" });
    }
    if (showPendentes) {
      cards.push({ label: "Parcelas Pendentes", value: data.reduce((s, d) => s + d.parcPendentes, 0).toString(), color: "#f59e0b" });
      cards.push({ label: "Valor Pendente", value: `R$ ${data.reduce((s, d) => s + d.valorPendente, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, color: "#f59e0b" });
    }
    return cards;
  };

  const buildHtml = () => {
    const cards = buildSummaryCards(selectedDados);
    return `
      <div style="text-align:center;margin-bottom:20px;border-bottom:3px solid #333;padding-bottom:15px;">
        <h1 style="color:#1a1a1a;font-size:24px;margin:0 0 5px;font-weight:bold;">${escapeHtml(title)}</h1>
        <p style="color:#666;font-size:12px;margin:0;">Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
      </div>
      <div style="background:#fef2f2;padding:15px;border-radius:8px;margin-bottom:15px;display:grid;grid-template-columns:repeat(${cards.length},1fr);gap:10px;text-align:center;">
        ${cards.map((c) => `<div><div style="font-size:11px;color:#666;">${c.label}</div><div style="font-size:18px;font-weight:bold;color:${c.color};">${c.value}</div></div>`).join("")}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#333;color:white;">
            ${columns.map((c) => `<th style="padding:10px;text-align:${c.align};">${c.header}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${selectedDados.map((d, i) => `<tr style="background:${i % 2 === 0 ? "#f9f9f9" : "#ffffff"};border-bottom:1px solid #ddd;">
            ${columns.map((c) => {
              const val = c.key === "cliente" ? escapeHtml(getCellValue(d, c.key)) : getCellValue(d, c.key);
              const color = c.color ? `color:${c.color};font-weight:bold;` : "";
              return `<td style="padding:8px;text-align:${c.align};${color}">${val}</td>`;
            }).join("")}
          </tr>`).join("")}
        </tbody>
        <tfoot>
          <tr style="background:#333;color:white;font-weight:bold;">
            ${columns.map((c) => {
              const val = c.key === "cliente" ? `TOTAL (${selectedDados.length} clientes)` : getTotalValue(selectedDados, c.key);
              return `<td style="padding:10px;text-align:${c.align};">${val}</td>`;
            }).join("")}
          </tr>
        </tfoot>
      </table>
    `;
  };

  const gerarImagem = async () => {
    if (selectedDados.length === 0) return;
    setGenerating(true);
    try {
      const tempDiv = document.createElement("div");
      tempDiv.style.cssText = "position:absolute;left:-9999px;width:800px;padding:40px;background:#ffffff;font-family:Arial,sans-serif;";
      document.body.appendChild(tempDiv);
      tempDiv.innerHTML = buildHtml();

      const canvas = await html2canvas(tempDiv, { scale: 2, backgroundColor: "#ffffff", logging: false });
      document.body.removeChild(tempDiv);

      const fileName = `relatorio-${format(new Date(), "dd-MM-yyyy")}.png`;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (isIOS && navigator.share && navigator.canShare) {
          const file = new File([blob], fileName, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({ files: [file], title: title });
              toast({ title: "Imagem pronta!", description: "Escolha 'Salvar Imagem' para adicionar à galeria." });
              return;
            } catch (err: any) {
              if (err.name === "AbortError") return;
            }
          }
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        toast({ title: "Imagem gerada!", description: "O arquivo foi baixado." });
      }, "image/png");
    } catch {
      toast({ title: "Erro ao gerar imagem", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const gerarPDF = async () => {
    if (selectedDados.length === 0) return;
    setGenerating(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const m = 15;
      let y = 20;

      // Header
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(title, pw / 2, y, { align: "center" });
      y += 6;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pw / 2, y, { align: "center" });
      pdf.setTextColor(0, 0, 0);
      y += 4;
      pdf.setLineWidth(0.8);
      pdf.line(m, y, pw - m, y);
      y += 10;

      // Summary cards
      const cards = buildSummaryCards(selectedDados);
      pdf.setFillColor(254, 242, 242);
      pdf.roundedRect(m, y - 4, pw - 2 * m, 18, 3, 3, "F");
      const colW = (pw - 2 * m) / cards.length;
      cards.forEach((c, i) => {
        const x = m + colW * i + colW / 2;
        pdf.setFontSize(7);
        pdf.setTextColor(120, 120, 120);
        pdf.text(c.label, x, y + 2, { align: "center" });
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        const rgb = hexToRgb(c.color);
        pdf.setTextColor(rgb.r, rgb.g, rgb.b);
        pdf.text(c.value, x, y + 10, { align: "center" });
      });
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
      y += 22;

      // Dynamic column widths
      const totalW = pw - 2 * m;
      const numDataCols = columns.length - 1; // minus cliente
      const clienteW = Math.min(70, totalW - numDataCols * 28);
      const dataCW = (totalW - clienteW) / numDataCols;
      const colWidths = columns.map((c) => c.key === "cliente" ? clienteW : dataCW);

      // Table header
      const drawHeader = () => {
        pdf.setFillColor(50, 50, 50);
        pdf.rect(m, y - 4, totalW, 7, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        let xP = m + 2;
        columns.forEach((c, i) => {
          const align = c.align === "right" ? "right" : undefined;
          const xPos = c.align === "right" ? xP + colWidths[i] - 2 : xP;
          pdf.text(c.header, xPos, y, align ? { align } : undefined);
          xP += colWidths[i];
        });
        pdf.setTextColor(0, 0, 0);
        y += 6;
      };
      drawHeader();

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);

      selectedDados.forEach((d, idx) => {
        if (y > ph - 25) {
          pdf.setFontSize(7);
          pdf.setTextColor(150, 150, 150);
          pdf.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, m, ph - 8);
          pdf.setTextColor(0, 0, 0);
          pdf.addPage();
          y = 20;
          drawHeader();
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
        }

        if (idx % 2 === 0) {
          pdf.setFillColor(248, 248, 248);
          pdf.rect(m, y - 3.5, totalW, 5.5, "F");
        }

        let xP = m + 2;
        columns.forEach((c, i) => {
          const val = getCellValue(d, c.key);
          if (c.color) {
            const rgb = hexToRgb(c.color);
            pdf.setTextColor(rgb.r, rgb.g, rgb.b);
            pdf.setFont("helvetica", "bold");
          }
          const displayVal = c.key === "cliente" ? val.substring(0, 40) : val;
          const align = c.align === "right" ? "right" : undefined;
          const xPos = c.align === "right" ? xP + colWidths[i] - 2 : c.align === "center" ? xP + colWidths[i] / 2 : xP;
          pdf.text(displayVal, xPos, y, align ? { align } : c.align === "center" ? { align: "center" } : undefined);
          if (c.color) {
            pdf.setTextColor(0, 0, 0);
            pdf.setFont("helvetica", "normal");
          }
          xP += colWidths[i];
        });
        y += 5.5;
      });

      // Footer totals
      pdf.setFillColor(50, 50, 50);
      pdf.rect(m, y - 3.5, totalW, 7, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      let xP = m + 2;
      columns.forEach((c, i) => {
        const val = c.key === "cliente" ? `TOTAL (${selectedDados.length} clientes)` : getTotalValue(selectedDados, c.key);
        const align = c.align === "right" ? "right" : undefined;
        const xPos = c.align === "right" ? xP + colWidths[i] - 2 : c.align === "center" ? xP + colWidths[i] / 2 : xP;
        pdf.text(val, xPos, y, align ? { align } : c.align === "center" ? { align: "center" } : undefined);
        xP += colWidths[i];
      });
      pdf.setTextColor(0, 0, 0);

      pdf.save(`relatorio-${format(new Date(), "dd-MM-yyyy")}.pdf`);
      toast({ title: "PDF gerado!", description: "O relatório foi baixado." });
    } catch {
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
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

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 0, g: 0, b: 0 };
}
