import { format } from "date-fns";
import type { Contrato, Parcela } from "./ContratoDetails";

const PAL = {
  ink: "#15201b",
  ink2: "#3d4a44",
  muted: "#7a857f",
  line: "#e3e7e4",
  lineStrong: "#c8cfcb",
  brand: "#0f6b4f",
  brandD: "#0a4f3a",
  green: "#1d7a55",
  greenBg: "#eaf4ee",
  amber: "#9a6310",
  amberBg: "#f7eedb",
  red: "#b0322a",
  redBg: "#f6e3e1",
  zebra: "#f7f8f7",
};

const periodicidadeLabel: Record<string, string> = {
  diario: "Diário",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
};

const tipoJurosLabel: Record<string, string> = {
  simples: "Simples",
  composto: "Composto",
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const fmtMoney = (v: number) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) => format(new Date(d + "T00:00:00"), "dd/MM/yyyy");

type StatusClasse = "g" | "a" | "r";

function getStatusInfo(p: Parcela): { texto: string; classe: StatusClasse } {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(p.data_vencimento + "T00:00:00");
  if (p.status === "pago") return { texto: "Pago", classe: "g" };
  if (p.status === "parcialmente_pago") return { texto: "Parcial", classe: "a" };
  if (venc < hoje) return { texto: "Atrasado", classe: "r" };
  return { texto: "Pendente", classe: "a" };
}

function colsConfig(n: number): { cols: number; width: number } {
  if (n <= 12) return { cols: 1, width: 720 };
  if (n <= 40) return { cols: 2, width: 1040 };
  return { cols: 3, width: 1380 };
}

function buildTabela(parcelas: Parcela[]): string {
  const head = `<thead><tr>
    <th>Nº</th><th>Vencimento</th><th class="r">Valor</th><th>Status</th><th>Pago em</th><th class="r">Valor pago</th>
  </tr></thead>`;
  const rows = parcelas
    .map((p) => {
      const { texto, classe } = getStatusInfo(p);
      const pago = p.data_pagamento
        ? `<td class="num">${fmtDate(p.data_pagamento)}</td>`
        : `<td class="dash">—</td>`;
      const valorPago = p.valor_pago
        ? `<td class="r num">${fmtMoney(p.valor_pago)}</td>`
        : `<td class="r dash">—</td>`;
      return `<tr class="${classe === "r" ? "late" : ""}">
        <td class="pn">${p.numero_parcela}</td>
        <td class="num">${fmtDate(p.data_vencimento)}</td>
        <td class="r num">${fmtMoney(p.valor)}</td>
        <td class="st ${classe}"><span class="dot ${classe}"></span>${texto}</td>
        ${pago}
        ${valorPago}
      </tr>`;
    })
    .join("");
  return `<table>${head}<tbody>${rows}</tbody></table>`;
}

export function buildRelatorioHtml(
  contrato: Contrato,
  parcelas: Parcela[],
  opts: { simplificado: boolean }
): { html: string; width: number } {
  const { simplificado } = opts;
  const ordenadas = [...parcelas].sort((a, b) => a.numero_parcela - b.numero_parcela);

  const valorTotal = Number(contrato.valor_total) || 0;
  const totalPago = ordenadas.reduce((s, p) => s + (Number(p.valor_pago) || 0), 0);
  const saldoRestante = valorTotal - totalPago;
  const pctQuitado = valorTotal > 0 ? Math.min(100, (totalPago / valorTotal) * 100) : 0;

  const pagas = ordenadas.filter((p) => p.status === "pago").length;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const atrasadas = ordenadas.filter(
    (p) => p.status !== "pago" && new Date(p.data_vencimento + "T00:00:00") < hoje
  ).length;
  const pendentes = ordenadas.length - pagas - atrasadas;

  const proxima = ordenadas.find((p) => p.status !== "pago");
  const proximaAtrasada = proxima
    ? new Date(proxima.data_vencimento + "T00:00:00") < hoje
    : false;

  const clienteNome = escapeHtml(contrato.clientes?.nome || "N/A").toUpperCase();
  const contratoId = (contrato.id || "").slice(0, 8).toUpperCase();
  const valorParcela = ordenadas.length > 0 ? ordenadas[0].valor : 0;

  const { cols, width } = colsConfig(ordenadas.length);
  const perCol = Math.ceil(ordenadas.length / cols);
  const colunas: Parcela[][] = [];
  for (let i = 0; i < cols; i++) {
    colunas.push(ordenadas.slice(i * perCol, (i + 1) * perCol));
  }
  const colsHtml = colunas.map((c) => buildTabela(c)).join("");

  // Cards de resumo
  const cardSensiveis = simplificado
    ? ""
    : `
      <div class="card">
        <div class="lbl">Valor emprestado</div>
        <div class="big sm ink2 num">${fmtMoney(contrato.valor_emprestado)}</div>
      </div>
      <div class="card">
        <div class="lbl">Juros</div>
        <div class="big sm ink2 num">${Number(contrato.percentual)}%</div>
        <div class="card-sub">${tipoJurosLabel[contrato.tipo_juros || ""] || "—"}</div>
      </div>`;

  const cardsGridCols = simplificado ? "1.4fr 1fr 1fr 1.2fr" : "1.4fr 1fr 1fr 1fr 1fr 1.2fr";

  const proxVencHtml = proxima
    ? `${fmtDate(proxima.data_vencimento)} · ${fmtMoney(proxima.valor)}`
    : "—";
  const proxTagHtml =
    proxima && proximaAtrasada ? `<span class="tag">Em atraso</span>` : "";

  const styles = `
    *{box-sizing:border-box;margin:0;padding:0}
    .doc{width:${width}px;background:${PAL.brand === "" ? "#fff" : "#ffffff"};border:1px solid ${PAL.lineStrong};font-family:"Libre Franklin",sans-serif;color:${PAL.ink};-webkit-font-smoothing:antialiased}
    .accent-top{height:5px;background:linear-gradient(90deg,${PAL.brandD},${PAL.brand} 60%,#1f8f68)}
    .num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}
    .head{display:flex;justify-content:space-between;align-items:flex-start;padding:30px 40px 22px;border-bottom:1px solid ${PAL.line}}
    .brand{display:flex;align-items:center;gap:9px;font-family:"Archivo";font-weight:700;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:${PAL.brand}}
    .brand .mk{width:10px;height:10px;background:${PAL.brand};border-radius:2px;transform:rotate(45deg)}
    .head h1{font-family:"Archivo";font-weight:700;font-size:30px;letter-spacing:-.01em;margin-top:14px;color:${PAL.ink}}
    .head .gen{font-size:12.5px;color:${PAL.muted};margin-top:4px}
    .head .right{text-align:right;font-size:12px}
    .head .right .row{margin-bottom:9px}
    .head .right .k{letter-spacing:.12em;text-transform:uppercase;color:${PAL.muted};font-weight:600;font-size:10.5px}
    .head .right .v{font-family:"Archivo";font-weight:700;font-size:15px;margin-top:2px;color:${PAL.ink}}
    .body{padding:24px 40px 8px}
    .cli-k{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${PAL.muted};font-weight:600}
    .cli-v{font-family:"Archivo";font-weight:700;font-size:24px;letter-spacing:.01em;margin-top:2px;text-transform:uppercase}
    .cards{display:grid;grid-template-columns:${cardsGridCols};gap:12px;margin-top:20px}
    .card{border:1px solid ${PAL.line};border-radius:8px;padding:16px 18px;background:#fff}
    .card .lbl{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:${PAL.muted};font-weight:600}
    .card .big{font-family:"Archivo";font-weight:800;font-size:27px;margin-top:8px;line-height:1.05;white-space:nowrap}
    .card .big.sm{font-size:18px}
    .card .card-sub{font-size:11px;color:${PAL.muted};margin-top:5px}
    .card.dark{background:${PAL.ink};border-color:${PAL.ink}}
    .card.dark .lbl{color:#9fb0a8}
    .card.dark .big{color:#fff}
    .card .green{color:${PAL.green}}
    .card .ink2{color:${PAL.ink2}}
    .qrow{display:flex;justify-content:space-between;align-items:baseline;margin-top:8px}
    .qrow .pct{font-family:"Archivo";font-weight:800;font-size:23px}
    .qrow .frac{font-size:11.5px;color:${PAL.muted};font-weight:500}
    .bar{height:7px;background:#e6ebe8;border-radius:99px;overflow:hidden;margin-top:9px}
    .bar>span{display:block;height:100%;background:${PAL.brand};border-radius:99px}
    .strip{display:grid;grid-template-columns:1.7fr 1fr 1fr 1fr 1fr;gap:0;margin-top:14px;border:1px solid ${PAL.line};border-radius:8px;overflow:hidden}
    .strip .cell{padding:13px 16px;border-right:1px solid ${PAL.line};display:flex;flex-direction:column}
    .strip .cell:last-child{border-right:none}
    .strip .k{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:${PAL.muted};font-weight:600;min-height:2.4em;line-height:1.2}
    .strip .v{font-family:"Archivo";font-weight:700;font-size:15px;margin-top:auto;text-transform:capitalize}
    .strip .next{background:${PAL.amberBg}}
    .strip .next .k{color:${PAL.amber}}
    .strip .next .v{color:${PAL.amber};text-transform:none;white-space:nowrap}
    .strip .next .tag{display:inline-block;margin-top:6px;font-size:9.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:${PAL.red};color:#fff;padding:2px 8px;border-radius:4px}
    .sec{display:flex;align-items:center;justify-content:space-between;margin:26px 0 12px}
    .sec h2{font-family:"Archivo";font-weight:700;font-size:17px}
    .counts{font-size:12px;color:${PAL.ink2};display:flex;gap:16px;font-weight:500}
    .counts b{font-weight:700}
    .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:baseline}
    .dot.g{background:${PAL.green}} .dot.a{background:${PAL.amber}} .dot.r{background:${PAL.red}}
    .cols{display:grid;grid-template-columns:repeat(${cols},1fr);gap:0 26px}
    table{width:100%;border-collapse:collapse;font-size:12.5px}
    thead th{text-align:left;font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;color:${PAL.muted};font-weight:700;padding:8px 8px;border-bottom:1.5px solid ${PAL.ink}}
    th.r,td.r{text-align:right}
    tbody td{padding:8.5px 8px;border-bottom:1px solid ${PAL.line}}
    tbody tr:nth-child(even){background:${PAL.zebra}}
    tbody tr.late td{box-shadow:inset 3px 0 0 ${PAL.red}}
    tbody tr.late:nth-child(even){background:${PAL.zebra}}
    .pn{font-weight:700;color:${PAL.ink2}}
    .st{font-weight:600;white-space:nowrap}
    .st.g{color:${PAL.green}} .st.a{color:${PAL.amber}} .st.r{color:${PAL.red};font-weight:600}
    .dash{color:#b7bdb9}
    .foot{display:flex;justify-content:space-between;align-items:center;padding:18px 40px 24px;margin-top:16px;border-top:1px solid ${PAL.line};font-size:11px;color:${PAL.muted}}
    .foot .id{font-variant-numeric:tabular-nums}
  `;

  const html = `
    <style>${styles}</style>
    <div class="doc">
      <div class="accent-top"></div>
      <header class="head">
        <div>
          <div class="brand"><span class="mk"></span> WS Empréstimos</div>
          <h1>Relatório de Contrato</h1>
          <div class="gen">Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</div>
        </div>
        <div class="right">
          <div class="row"><div class="k">Contrato</div><div class="v num">#${contratoId}</div></div>
          <div class="row"><div class="k">Situação</div><div class="v">${escapeHtml(contrato.status)}</div></div>
        </div>
      </header>
      <div class="body">
        <div class="cli-k">Cliente</div>
        <div class="cli-v">${clienteNome}</div>
        <div class="cards">
          <div class="card dark">
            <div class="lbl">Valor total devido</div>
            <div class="big num">${fmtMoney(valorTotal)}</div>
          </div>
          ${cardSensiveis}
          <div class="card">
            <div class="lbl">Total pago</div>
            <div class="big sm green num">${fmtMoney(totalPago)}</div>
          </div>
          <div class="card">
            <div class="lbl">Saldo restante</div>
            <div class="big sm ink2 num">${fmtMoney(saldoRestante)}</div>
          </div>
          <div class="card">
            <div class="lbl">Quitação</div>
            <div class="qrow"><span class="pct num">${pctQuitado.toFixed(0)}%</span><span class="frac num">${pagas} de ${ordenadas.length} parcelas</span></div>
            <div class="bar"><span style="width:${pctQuitado}%"></span></div>
          </div>
        </div>
        <div class="strip">
          <div class="cell next">
            <div class="k">Próximo vencimento</div>
            <div class="v num">${proxVencHtml}</div>
          </div>
          <div class="cell"><div class="k">Data do empréstimo</div><div class="v num">${fmtDate(contrato.data_emprestimo)}</div></div>
          <div class="cell"><div class="k">Parcelas</div><div class="v num">${contrato.numero_parcelas}</div></div>
          <div class="cell"><div class="k">Periodicidade</div><div class="v">${periodicidadeLabel[contrato.periodicidade] || contrato.periodicidade}</div></div>
          <div class="cell"><div class="k">Valor da parcela</div><div class="v num">${fmtMoney(valorParcela)}</div></div>
        </div>
        <div class="sec">
          <h2>Detalhamento das Parcelas</h2>
          <div class="counts">
            <span><span class="dot g"></span><b>${pagas}</b> pagas</span>
            <span><span class="dot r"></span><b>${atrasadas}</b> atrasadas</span>
            <span><span class="dot a"></span><b>${pendentes}</b> pendentes</span>
          </div>
        </div>
        <div class="cols">${colsHtml}</div>
      </div>
      <footer class="foot">
        <span>WS Empréstimos · Documento gerado automaticamente · Sujeito a atualização</span>
        <span class="id">Contrato #${contratoId}</span>
      </footer>
    </div>`;

  return { html, width };
}