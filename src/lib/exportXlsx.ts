import * as XLSX from "xlsx";

export interface PlanilhaAba {
  nome: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  /** Larguras opcionais das colunas (em caracteres) */
  colWidths?: number[];
}

/**
 * Gera e baixa um arquivo .xlsx com uma ou mais abas.
 */
export function exportarXlsx(filename: string, abas: PlanilhaAba[]) {
  const workbook = XLSX.utils.book_new();

  abas.forEach((aba) => {
    const data = [aba.headers, ...aba.rows];
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Larguras de coluna: usa as fornecidas ou calcula a partir do conteúdo
    const widths = aba.headers.map((header, i) => {
      if (aba.colWidths?.[i]) return { wch: aba.colWidths[i] };
      let max = String(header ?? "").length;
      aba.rows.forEach((row) => {
        const val = row[i];
        const len = val == null ? 0 : String(val).length;
        if (len > max) max = len;
      });
      return { wch: Math.min(Math.max(max + 2, 10), 50) };
    });
    worksheet["!cols"] = widths;

    // Nome da aba: máx. 31 caracteres, sem caracteres inválidos
    const safeName = aba.nome.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Planilha";
    XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
  });

  XLSX.writeFile(workbook, filename);
}