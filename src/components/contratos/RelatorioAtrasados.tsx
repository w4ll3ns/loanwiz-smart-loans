import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { AlertTriangle, Download, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface ContratoAtrasado {
  contratoId: string;
  clienteNome: string;
  parcPagas: number;
  parcAtrasadas: number;
  valorAtrasado: number;
  totalParcelas: number;
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function RelatorioAtrasados() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dados, setDados] = useState<ContratoAtrasado[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

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

      const map = new Map<string, ContratoAtrasado>();

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
            entry.valorAtrasado += Number(p.valor_original || p.valor) - Number(p.valor_pago || 0);
          }
        }
      });

      const result = Array.from(map.values()).filter((c) => c.parcAtrasadas > 0);
      result.sort((a, b) => a.clienteNome.localeCompare(b.clienteNome));
      setDados(result);
      setSelected(new Set(result.map((r) => r.contratoId)));
    } catch {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadDados();
  }, [open]);

  const toggleAll = () => {
    if (selected.size === dados.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(dados.map((d) => d.contratoId)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectedDados = dados.filter((d) => selected.has(d.contratoId));

  const buildHtml = () => {
    const totalClientes = selectedDados.length;
    const totalAtrasadas = selectedDados.reduce((s, d) => s + d.parcAtrasadas, 0);
    const totalValor = selectedDados.reduce((s, d) => s + d.valorAtrasado, 0);

    return `
      <div style="text-align:center;margin-bottom:20px;border-bottom:3px solid #333;padding-bottom:15px;">
        <h1 style="color:#1a1a1a;font-size:24px;margin:0 0 5px;font-weight:bold;">RELATÓRIO DE CONTRATOS ATRASADOS</h1>
        <p style="color:#666;font-size:12px;margin:0;">Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
      </div>
      <div style="background:#fef2f2;padding:15px;border-radius:8px;margin-bottom:15px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;text-align:center;">
        <div><div style="font-size:11px;color:#666;">Clientes</div><div style="font-size:18px;font-weight:bold;color:#333;">${totalClientes}</div></div>
        <div><div style="font-size:11px;color:#666;">Parcelas Atrasadas</div><div style="font-size:18px;font-weight:bold;color:#ef4444;">${totalAtrasadas}</div></div>
        <div><div style="font-size:11px;color:#666;">Valor Atrasado</div><div style="font-size:18px;font-weight:bold;color:#ef4444;">R$ ${totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#333;color:white;">
            <th style="padding:10px;text-align:left;">Cliente</th>
            <th style="padding:10px;text-align:center;">Pagas</th>
            <th style="padding:10px;text-align:center;">Atrasadas</th>
            <th style="padding:10px;text-align:right;">Valor Atrasado</th>
          </tr>
        </thead>
        <tbody>
          ${selectedDados
            .map(
              (d, i) => `<tr style="background:${i % 2 === 0 ? "#f9f9f9" : "#ffffff"};border-bottom:1px solid #ddd;">
              <td style="padding:8px;">${escapeHtml(d.clienteNome)}</td>
              <td style="padding:8px;text-align:center;color:#22c55e;font-weight:bold;">${d.parcPagas}</td>
              <td style="padding:8px;text-align:center;color:#ef4444;font-weight:bold;">${d.parcAtrasadas}</td>
              <td style="padding:8px;text-align:right;font-weight:bold;">R$ ${d.valorAtrasado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
            </tr>`
            )
            .join("")}
        </tbody>
        <tfoot>
          <tr style="background:#333;color:white;font-weight:bold;">
            <td style="padding:10px;">TOTAL (${totalClientes} clientes)</td>
            <td style="padding:10px;text-align:center;">${selectedDados.reduce((s, d) => s + d.parcPagas, 0)}</td>
            <td style="padding:10px;text-align:center;">${totalAtrasadas}</td>
            <td style="padding:10px;text-align:right;">R$ ${totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
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

      const fileName = `atrasados-${format(new Date(), "dd-MM-yyyy")}.png`;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (isIOS && navigator.share && navigator.canShare) {
          const file = new File([blob], fileName, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({ files: [file], title: "Relatório Atrasados" });
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

      const totalClientes = selectedDados.length;
      const totalAtrasadas = selectedDados.reduce((s, d) => s + d.parcAtrasadas, 0);
      const totalValor = selectedDados.reduce((s, d) => s + d.valorAtrasado, 0);

      // Header
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("RELATÓRIO DE CONTRATOS ATRASADOS", pw / 2, y, { align: "center" });
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

      // Summary
      pdf.setFillColor(254, 242, 242);
      pdf.roundedRect(m, y - 4, pw - 2 * m, 18, 3, 3, "F");
      const colW = (pw - 2 * m) / 3;
      const labels = ["Clientes", "Parcelas Atrasadas", "Valor Atrasado"];
      const values = [
        totalClientes.toString(),
        totalAtrasadas.toString(),
        `R$ ${totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      ];
      labels.forEach((l, i) => {
        const x = m + colW * i + colW / 2;
        pdf.setFontSize(7);
        pdf.setTextColor(120, 120, 120);
        pdf.text(l, x, y + 2, { align: "center" });
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(i > 0 ? 239 : 50, i > 0 ? 68 : 50, i > 0 ? 68 : 50);
        pdf.text(values[i], x, y + 10, { align: "center" });
      });
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
      y += 22;

      // Table header
      const cols = [70, 25, 30, 45];
      const hdrs = ["Cliente", "Pagas", "Atrasadas", "Valor Atrasado"];
      const drawHeader = () => {
        pdf.setFillColor(50, 50, 50);
        pdf.rect(m, y - 4, pw - 2 * m, 7, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        let xP = m + 2;
        hdrs.forEach((h, i) => {
          pdf.text(h, i === 3 ? xP + cols[i] - 2 : xP, y, i === 3 ? { align: "right" } : undefined);
          xP += cols[i];
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
          pdf.rect(m, y - 3.5, pw - 2 * m, 5.5, "F");
        }

        let xP = m + 2;
        // Cliente
        pdf.text(d.clienteNome.substring(0, 40), xP, y);
        xP += cols[0];
        // Pagas
        pdf.setTextColor(34, 197, 94);
        pdf.text(d.parcPagas.toString(), xP + 8, y);
        xP += cols[1];
        // Atrasadas
        pdf.setTextColor(239, 68, 68);
        pdf.setFont("helvetica", "bold");
        pdf.text(d.parcAtrasadas.toString(), xP + 12, y);
        pdf.setFont("helvetica", "normal");
        xP += cols[2];
        // Valor
        pdf.text(`R$ ${d.valorAtrasado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, xP + cols[3] - 2, y, { align: "right" });
        pdf.setTextColor(0, 0, 0);
        y += 5.5;
      });

      // Footer totals
      pdf.setFillColor(50, 50, 50);
      pdf.rect(m, y - 3.5, pw - 2 * m, 7, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      let xP = m + 2;
      pdf.text(`TOTAL (${totalClientes} clientes)`, xP, y);
      xP += cols[0];
      pdf.text(selectedDados.reduce((s, d) => s + d.parcPagas, 0).toString(), xP + 8, y);
      xP += cols[1];
      pdf.text(totalAtrasadas.toString(), xP + 12, y);
      xP += cols[2];
      pdf.text(`R$ ${totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, xP + cols[3] - 2, y, { align: "right" });
      pdf.setTextColor(0, 0, 0);

      pdf.save(`atrasados-${format(new Date(), "dd-MM-yyyy")}.pdf`);
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
            <DialogTitle>Relatório de Atrasados</DialogTitle>
            <DialogDescription>Selecione os contratos para incluir no relatório</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
            ) : dados.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum contrato com parcelas atrasadas.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{selected.size} de {dados.length} selecionados</span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleAll}>
                    {selected.size === dados.length ? "Desmarcar Todos" : "Selecionar Todos"}
                  </Button>
                </div>
                <div className="space-y-1">
                  {dados.map((d) => (
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
                          <span className="text-success">{d.parcPagas} pagas</span>
                          {" · "}
                          <span className="text-destructive font-medium">{d.parcAtrasadas} atrasadas</span>
                          {" · "}
                          R$ {d.valorAtrasado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
