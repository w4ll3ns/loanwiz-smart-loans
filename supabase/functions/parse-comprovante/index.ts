import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { image_base64, mime_type } = await req.json();

    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: "Imagem não fornecida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mediaType = mime_type || "image/png";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "Você é um assistente especializado em extrair dados de comprovantes PIX brasileiros. Analise a imagem do comprovante e extraia as informações solicitadas. Seja preciso com valores, datas e nomes.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analise este comprovante PIX e extraia os dados usando a função fornecida.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mediaType};base64,${image_base64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extrair_dados_comprovante",
              description:
                "Extrai dados estruturados de um comprovante PIX",
              parameters: {
                type: "object",
                properties: {
                  nome_cliente: {
                    type: "string",
                    description:
                      "Nome completo do beneficiário/favorecido da transferência (quem recebeu o PIX)",
                  },
                  valor: {
                    type: "number",
                    description:
                      "Valor da transferência em reais (apenas o número, sem R$)",
                  },
                  data: {
                    type: "string",
                    description:
                      "Data da operação no formato YYYY-MM-DD",
                  },
                  chave_pix: {
                    type: "string",
                    description:
                      "Chave PIX utilizada na transferência (CPF, telefone, email ou chave aleatória)",
                  },
                  tipo_chave: {
                    type: "string",
                    enum: ["cpf", "telefone", "email", "aleatoria", "cnpj"],
                    description: "Tipo da chave PIX identificada",
                  },
                },
                required: ["nome_cliente", "valor", "data"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "extrair_dados_comprovante" },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar comprovante com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ error: "Não foi possível extrair dados do comprovante" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("parse-comprovante error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
