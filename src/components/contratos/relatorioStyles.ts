export const PAL = {
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

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function toTitleCase(text: string): string {
  const minor = new Set(["de", "do", "da", "dos", "das", "e", "em", "a", "o"]);
  return text
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((w, i) =>
      i > 0 && minor.has(w) ? w : w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1)
    )
    .join(" ");
}

/** CSS comum compartilhado entre os relatórios (faixa de acento, cabeçalho, rodapé, números). */
export const baseStyles = `
    *{box-sizing:border-box;margin:0;padding:0}
    .num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}
    .accent-top{height:5px;background:linear-gradient(90deg,${PAL.brandD},${PAL.brand} 60%,#1f8f68)}
    .head{display:flex;justify-content:space-between;align-items:flex-start;padding:30px 40px 22px;border-bottom:1px solid ${PAL.line}}
    .brand{display:flex;align-items:center;gap:9px;font-family:"Archivo";font-weight:700;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:${PAL.brand}}
    .brand .mk{width:10px;height:10px;background:${PAL.brand};border-radius:2px;transform:rotate(45deg)}
    .head h1{font-family:"Archivo";font-weight:700;font-size:30px;letter-spacing:-.01em;margin-top:14px;color:${PAL.ink}}
    .head .gen{font-size:12.5px;color:${PAL.muted};margin-top:4px}
    .head .right{text-align:right;font-size:12px}
    .head .right .row{margin-bottom:9px}
    .head .right .k{letter-spacing:.12em;text-transform:uppercase;color:${PAL.muted};font-weight:600;font-size:10.5px}
    .head .right .v{font-family:"Archivo";font-weight:700;font-size:15px;margin-top:2px;color:${PAL.ink}}
    .foot{display:flex;justify-content:space-between;align-items:center;padding:18px 40px 24px;margin-top:16px;border-top:1px solid ${PAL.line};font-size:11px;color:${PAL.muted}}
    .foot .id{font-variant-numeric:tabular-nums}
`;