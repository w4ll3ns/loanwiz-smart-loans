import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const callerUserId = claimsData.claims.sub;

    // Check if caller is admin
    const { data: roleData } = await supabaseAnon
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUserId)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), { status: 403, headers });
    }

    // Parse and validate input
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
    }

    const { user_id } = body;
    if (!user_id || typeof user_id !== "string" || !UUID_REGEX.test(user_id)) {
      return new Response(JSON.stringify({ error: "user_id must be a valid UUID" }), { status: 400, headers });
    }

    // Prevent self-deletion
    if (user_id === callerUserId) {
      return new Response(JSON.stringify({ error: "Cannot delete yourself" }), { status: 400, headers });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify target user exists
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, nome")
      .eq("id", user_id)
      .single();

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: "Target user not found" }), { status: 404, headers });
    }

    // Log audit BEFORE deletion (so we have record even if deletion partially fails)
    await supabaseAdmin.from("audit_logs").insert({
      user_id: callerUserId,
      action: "delete_user",
      target_user_id: user_id,
      details: {
        target_email: targetProfile.email,
        target_nome: targetProfile.nome,
        timestamp: new Date().toISOString(),
      },
    });

    // Delete in correct referential order:
    // 1. parcelas_historico (depends on parcelas)
    // 2. parcelas (depends on contratos)
    // 3. contratos (depends on clientes)
    // 4. clientes (depends on user_id)
    // 5. user_roles
    // 6. profiles
    // 7. auth.users

    const deletionSteps: { name: string; fn: () => Promise<{ error: any }> }[] = [
      {
        name: "parcelas_historico",
        fn: async () => {
          // Delete historico for parcelas belonging to user's contratos
          const { data: clienteIds } = await supabaseAdmin
            .from("clientes")
            .select("id")
            .eq("user_id", user_id);

          if (!clienteIds?.length) return { error: null };

          const cIds = clienteIds.map((c: any) => c.id);
          const { data: contratoIds } = await supabaseAdmin
            .from("contratos")
            .select("id")
            .in("cliente_id", cIds);

          if (!contratoIds?.length) return { error: null };

          const ctIds = contratoIds.map((c: any) => c.id);
          const { data: parcelaIds } = await supabaseAdmin
            .from("parcelas")
            .select("id")
            .in("contrato_id", ctIds);

          if (!parcelaIds?.length) return { error: null };

          const pIds = parcelaIds.map((p: any) => p.id);
          // Delete in batches of 100
          for (let i = 0; i < pIds.length; i += 100) {
            const batch = pIds.slice(i, i + 100);
            const { error } = await supabaseAdmin
              .from("parcelas_historico")
              .delete()
              .in("parcela_id", batch);
            if (error) return { error };
          }
          return { error: null };
        },
      },
      {
        name: "parcelas",
        fn: async () => {
          const { data: clienteIds } = await supabaseAdmin
            .from("clientes")
            .select("id")
            .eq("user_id", user_id);
          if (!clienteIds?.length) return { error: null };
          const cIds = clienteIds.map((c: any) => c.id);
          const { data: contratoIds } = await supabaseAdmin
            .from("contratos")
            .select("id")
            .in("cliente_id", cIds);
          if (!contratoIds?.length) return { error: null };
          const ctIds = contratoIds.map((c: any) => c.id);
          for (let i = 0; i < ctIds.length; i += 100) {
            const batch = ctIds.slice(i, i + 100);
            const { error } = await supabaseAdmin.from("parcelas").delete().in("contrato_id", batch);
            if (error) return { error };
          }
          return { error: null };
        },
      },
      {
        name: "contratos",
        fn: async () => {
          const { data: clienteIds } = await supabaseAdmin
            .from("clientes")
            .select("id")
            .eq("user_id", user_id);
          if (!clienteIds?.length) return { error: null };
          const cIds = clienteIds.map((c: any) => c.id);
          for (let i = 0; i < cIds.length; i += 100) {
            const batch = cIds.slice(i, i + 100);
            const { error } = await supabaseAdmin.from("contratos").delete().in("cliente_id", batch);
            if (error) return { error };
          }
          return { error: null };
        },
      },
      {
        name: "clientes",
        fn: async () => supabaseAdmin.from("clientes").delete().eq("user_id", user_id),
      },
      {
        name: "user_roles",
        fn: async () => supabaseAdmin.from("user_roles").delete().eq("user_id", user_id),
      },
      {
        name: "profiles",
        fn: async () => supabaseAdmin.from("profiles").delete().eq("id", user_id),
      },
    ];

    const completedSteps: string[] = [];
    for (const step of deletionSteps) {
      const result = await step.fn();
      if (result.error) {
        console.error(`Failed at step ${step.name}:`, result.error);
        return new Response(
          JSON.stringify({
            error: `Deletion failed at step: ${step.name}`,
            completed_steps: completedSteps,
            failed_step: step.name,
            detail: result.error.message,
          }),
          { status: 500, headers }
        );
      }
      completedSteps.push(step.name);
    }

    // Final step: delete auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(
        JSON.stringify({
          error: "Failed to delete auth user (data already cleaned)",
          completed_steps: completedSteps,
          detail: deleteError.message,
        }),
        { status: 500, headers }
      );
    }

    return new Response(
      JSON.stringify({ success: true, completed_steps: [...completedSteps, "auth.users"] }),
      { headers }
    );
  } catch (error) {
    console.error("delete-user error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers }
    );
  }
});
