import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type ToastFn = (opts: { title: string; description?: string; variant?: "destructive" }) => void;

async function gerarCanvas(html: string, width: number): Promise<HTMLCanvasElement> {
  const tempDiv = document.createElement("div");
  tempDiv.style.position = "absolute";
  tempDiv.style.left = "-9999px";
  tempDiv.style.top = "0";
  tempDiv.style.width = `${width}px`;
  tempDiv.style.backgroundColor = "#ffffff";
  tempDiv.innerHTML = html;
  document.body.appendChild(tempDiv);
  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    return await html2canvas(tempDiv, { scale: 2, backgroundColor: "#ffffff", logging: false });
  } finally {
    document.body.removeChild(tempDiv);
  }
}

export async function exportarPng(
  html: string,
  width: number,
  fileName: string,
  titulo: string,
  toast: ToastFn
): Promise<void> {
  try {
    const canvas = await gerarCanvas(html, width);
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      if (isIOS && navigator.share && navigator.canShare) {
        const file = new File([blob], fileName, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: titulo });
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
  } catch (error) {
    toast({ title: "Erro ao gerar imagem", variant: "destructive" });
  }
}

export async function exportarPdf(
  html: string,
  width: number,
  fileName: string,
  toast: ToastFn
): Promise<void> {
  try {
    const canvas = await gerarCanvas(html, width);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const imgW = pw;
    const imgH = (canvas.height * imgW) / canvas.width;
    let heightLeft = imgH;
    let pos = 0;
    pdf.addImage(imgData, "PNG", 0, pos, imgW, imgH);
    heightLeft -= ph;
    while (heightLeft > 0) {
      pos -= ph;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, pos, imgW, imgH);
      heightLeft -= ph;
    }
    pdf.save(fileName);
    toast({ title: "PDF gerado!", description: "O relatório foi baixado." });
  } catch (error) {
    toast({ title: "Erro ao gerar PDF", variant: "destructive" });
  }
}