export function exportarCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  const BOM = "\uFEFF";
  const escape = (val: string | number | null | undefined): string => {
    const str = val == null ? "" : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent =
    BOM +
    headers.map(escape).join(",") +
    "\n" +
    rows.map((row) => row.map(escape).join(",")).join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
