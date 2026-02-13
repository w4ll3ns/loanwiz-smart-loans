

## Plano: Corrigir Suporte a PDF no Importador de Comprovante

### Problema

A API de visao do OpenAI (GPT-4o) **nao aceita PDFs** diretamente — apenas tipos de imagem (`image/png`, `image/jpeg`, etc.). Quando um PDF e enviado, o `mime_type` vai como `application/pdf`, e a OpenAI retorna erro 400: "Invalid MIME type. Only image types are supported."

### Solucao

Converter o PDF em imagem **no frontend** antes de enviar para a edge function, usando a biblioteca `pdfjs-dist` (PDF.js da Mozilla). Isso renderiza a primeira pagina do PDF em um canvas e exporta como PNG.

### Fluxo Corrigido

```text
Upload PDF --> PDF.js renderiza pagina 1 --> Canvas --> PNG base64 --> Edge Function --> OpenAI
Upload Imagem --> base64 direto --> Edge Function --> OpenAI
```

### Alteracoes

**1. Instalar dependencia: `pdfjs-dist`**
- Biblioteca da Mozilla para renderizar PDFs no navegador

**2. Modificar `src/pages/Contratos.tsx`**

Na funcao `handleImportComprovante`:
- Detectar se o arquivo e PDF (`file.type === 'application/pdf'`)
- Se PDF: usar PDF.js para carregar o documento, renderizar a primeira pagina em um canvas, e converter para PNG base64
- Se imagem: manter o fluxo atual (FileReader direto)
- Em ambos os casos, enviar para a edge function com `mime_type: 'image/png'`

**3. Edge function permanece inalterada**
- Ja funciona corretamente para imagens
- So precisa receber imagens validas

### Detalhes Tecnicos

```text
// Pseudo-codigo da conversao PDF -> imagem
if (file.type === 'application/pdf') {
  1. Ler arquivo como ArrayBuffer
  2. Carregar com pdfjsLib.getDocument(arrayBuffer)
  3. Obter primeira pagina: pdf.getPage(1)
  4. Criar canvas com dimensoes da pagina (escala 2x para qualidade)
  5. Renderizar pagina no canvas: page.render({ canvasContext, viewport })
  6. Exportar canvas como PNG: canvas.toDataURL('image/png')
  7. Extrair base64 e enviar com mime_type = 'image/png'
}
```

### Arquivos modificados

| Arquivo | Acao |
|---|---|
| `package.json` | Adicionar `pdfjs-dist` |
| `src/pages/Contratos.tsx` | Modificar `handleImportComprovante` para converter PDF em imagem |

