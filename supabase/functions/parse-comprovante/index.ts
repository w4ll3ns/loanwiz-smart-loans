import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB base64
const OPENAI_TIMEOUT_MS = 30_000;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const userId = claimsData.claims.sub as string;

    // Rate limit check (50 calls per 24h)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: allowed } = await supabaseAdmin.rpc("check_api_rate_limit", {
      p_user_id: userId,
      p_function_name: "parse-comprovante",
      p_max_calls: 50,
    });

    if (allowed === false) {
      return new Response(
        JSON.stringify({ error: "Limite de uso atingido. Tente novamente em 24 horas." }),
        { status: 429, headers }
      );
    }

    // Parse body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers });
    }

    const { image_base64, mime_type } = body as { image_base64?: string; mime_type?: string };

    // Validate input
    if (!image_base64 || typeof image_base64 !== "string") {
      return new Response(JSON.stringify({ error: "Imagem não fornecida" }), { status: 400, headers });
    }

    if (image_base64.length > MAX_PAYLOAD_BYTES) {
      return new Response(
        JSON.stringify({ error: "Imagem excede o tamanho máximo de 5MB" }),
        { status: 413, headers }
      );
    }

    const mediaType = mime_type && typeof mime_type === "string" ? mime_type : "image/png";
    if (!ALLOWED_MIME_TYPES.includes(mediaType)) {
      return new Response(
        JSON.stringify({ error: `Tipo de imagem não suportado: ${mediaType}. Use PNG, JPEG ou WebP.` }),
        { status: 400, headers }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY não configurada" }),
        { status: 500, headers }
      );
    }

    // Log usage
    await supabaseAdmin.rpc("log_api_usage", {
      p_user_id: userId,
      p_function_name: "parse-comprovante",
    });

    // Call OpenAI with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
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
                  image_url: { url: `data:${mediaType};base64,${image_base64}` },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extrair_dados_comprovante",
                description: "Extrai dados estruturados de um comprovante PIX",
                parameters: {
                  type: "object",
                  properties: {
                    nome_cliente: {
                      type: "string",
                      description: "Nome completo do beneficiário/favorecido da transferência",
                    },
                    valor: {
                      type: "number",
                      description: "Valor da transferência em reais (apenas o número, sem R$)",
                    },
                    data: {
                      type: "string",
                      description: "Data da operação no formato YYYY-MM-DD",
                    },
                    chave_pix: {
                      type: "string",
                      description: "Chave PIX utilizada na transferência",
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
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return new Response(
          JSON.stringify({ error: "Timeout ao processar comprovante. Tente novamente." }),
          { status: 504, headers }
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar comprovante com IA" }),
        { status: 500, headers }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ error: "Não foi possível extrair dados do comprovante" }),
        { status: 422, headers }
      );
    }

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(
        JSON.stringify({ error: "Resposta da IA em formato inválido" }),
        { status: 422, headers }
      );
    }

    // Validate output
    if (
      typeof extracted.nome_cliente !== "string" ||
      !extracted.nome_cliente.trim() ||
      typeof extracted.valor !== "number" ||
      extracted.valor <= 0 ||
      typeof extracted.data !== "string" ||
      !DATE_REGEX.test(extracted.data)
    ) {
      return new Response(
        JSON.stringify({ error: "Dados extraídos são inválidos ou incompletos" }),
        { status: 422, headers }
      );
    }

    return new Response(JSON.stringify(extracted), { headers });
  } catch (error) {
    console.error("parse-comprovante error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers }
    );
  }
});
