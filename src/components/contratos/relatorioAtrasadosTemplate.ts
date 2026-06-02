import { format } from "date-fns";
import { PAL, escapeHtml, baseStyles, toTitleCase } from "./relatorioStyles";

export interface AtrasadosColumn {
  key: string;
  header: string;
  align: string;
  color?: string;
}

export interface AtrasadosCard {
  label: string;
  value: string;
  color: string;
  anchor?: boolean;
}

export interface BuildAtrasadosArgs {
  title: string;
  columns: AtrasadosColumn[];
  cards: AtrasadosCard[];
  rows: { cells: { value: string; align: string; color?: string }[] }[];
  totals: { value: string; align: string }[];
  totalClientes: number;
  filtros: string[];
}

const WIDTH = 960;

export function buildRelatorioAtrasadosHtml(args: BuildAtrasadosArgs): { html: string; width: number } {
  const { title, columns, cards, rows, totals, totalClientes, filtros } = args;

  const filtrosHtml = filtros
    .map((f) => `<span class="chip">${escapeHtml(f)}</span>`)
    .join("");

  const cardsHtml = cards
    .map((c) => {
      const anchor = c.anchor ? " anchor" : "";
      const valColor = c.anchor ? "" : `color:${c.color};`;
      return `<div class="card${anchor}">
        <div class="lbl">${escapeHtml(c.label)}</div>
        <div class="big num" style="${valColor}">${escapeHtml(c.value)}</div>
      </div>`;
    })
    .join("");

  const theadHtml = columns
    .map((c) => `<th class="${c.align}">${escapeHtml(c.header)}</th>`)
    .join("");

  const bodyHtml = rows
    .map((r) => {
      const tds = r.cells
        .map((cell) => {
          const colorStyle = cell.color ? `color:${cell.color};font-weight:700;` : "";
          const numClass = cell.align !== "left" ? " num" : "";
          return `<td class="${cell.align}${numClass}" style="${colorStyle}">${escapeHtml(cell.value)}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  const tfootHtml = totals
    .map((t) => `<td class="${t.align} num">${escapeHtml(t.value)}</td>`)
    .join("");

  const styles = `
    ${baseStyles}
    .doc{width:${WIDTH}px;background:#fff;border:1px solid ${PAL.lineStrong};font-family:"Libre Franklin",sans-serif;color:${PAL.ink};-webkit-font-smoothing:antialiased}
    .head .right .chip{display:inline-block;margin-left:6px;margin-top:4px;font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;background:${PAL.greenBg};color:${PAL.brand};padding:3px 9px;border-radius:99px}
    .body{padding:24px 40px 8px}
    .cards{display:grid;grid-template-columns:repeat(${cards.length},1fr);gap:12px;margin-top:4px}
    .card{border:1px solid ${PAL.line};border-radius:8px;padding:16px 18px;background:#fff}
    .card .lbl{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:${PAL.muted};font-weight:600}
    .card .big{font-family:"Archivo";font-weight:800;font-size:21px;margin-top:8px;line-height:1.05;white-space:nowrap;color:${PAL.ink}}
    .card.anchor{background:${PAL.ink};border-color:${PAL.ink}}
    .card.anchor .lbl{color:#9fb0a8}
    .card.anchor .big{color:#fff}
    table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:22px}
    thead th{font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;color:${PAL.muted};font-weight:700;padding:8px 10px;border-bottom:1.5px solid ${PAL.ink}}
    th.left,td.left{text-align:left}
    th.right,td.right{text-align:right}
    th.center,td.center{text-align:center}
    tbody td{padding:9px 10px;border-bottom:1px solid ${PAL.line}}
    tbody tr:nth-child(even){background:${PAL.zebra}}
    tfoot td{padding:11px 10px;background:${PAL.ink};color:#fff;font-family:"Archivo";font-weight:700;font-size:12.5px}
  `;

  const html = `
    <style>${styles}</style>
    <div class="doc">
      <div class="accent-top"></div>
      <header class="head">
        <div>
          <div class="brand"><span class="mk"></span> WS Empréstimos</div>
          <h1>${escapeHtml(toTitleCase(title))}</h1>
          <div class="gen">Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</div>
        </div>
        <div class="right">
          <div class="row"><div class="k">Filtros</div><div class="v">${filtrosHtml || "—"}</div></div>
          <div class="row"><div class="k">Clientes</div><div class="v num">${totalClientes}</div></div>
        </div>
      </header>
      <div class="body">
        <div class="cards">${cardsHtml}</div>
        <table>
          <thead><tr>${theadHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
          <tfoot><tr>${tfootHtml}</tr></tfoot>
        </table>
      </div>
      <footer class="foot">
        <span>WS Empréstimos · Documento gerado automaticamente</span>
        <span class="id">${format(new Date(), "dd/MM/yyyy")}</span>
      </footer>
    </div>`;

  return { html, width: WIDTH };
}