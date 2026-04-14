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

    // === PRE-DELETION INVENTORY ===
    const { data: clienteIds } = await supabaseAdmin
      .from("clientes")
      .select("id")
      .eq("user_id", user_id);

    const cIds = clienteIds?.map((c: any) => c.id) || [];

    let contratoCount = 0;
    let parcelaCount = 0;
    let historicoCount = 0;
    let ctIds: string[] = [];
    let pIds: string[] = [];

    if (cIds.length > 0) {
      const { data: contratos } = await supabaseAdmin
        .from("contratos")
        .select("id")
        .in("cliente_id", cIds);
      ctIds = contratos?.map((c: any) => c.id) || [];
      contratoCount = ctIds.length;

      if (ctIds.length > 0) {
        const { data: parcelas } = await supabaseAdmin
          .from("parcelas")
          .select("id")
          .in("contrato_id", ctIds);
        pIds = parcelas?.map((p: any) => p.id) || [];
        parcelaCount = pIds.length;

        if (pIds.length > 0) {
          const { count } = await supabaseAdmin
            .from("parcelas_historico")
            .select("id", { count: "exact", head: true })
            .in("parcela_id", pIds.slice(0, 100)); // count sample
          historicoCount = count || 0;
        }
      }
    }

    const inventory = {
      clientes: cIds.length,
      contratos: contratoCount,
      parcelas: parcelaCount,
      historico_estimado: historicoCount,
    };

    // === SOFT-DELETE: mark profile inactive BEFORE deletion ===
    const { error: deactivateError } = await supabaseAdmin
      .from("profiles")
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq("id", user_id);

    if (deactivateError) {
      console.error("Failed to deactivate profile:", deactivateError);
      return new Response(
        JSON.stringify({ error: "Failed to deactivate user before deletion", detail: deactivateError.message }),
        { status: 500, headers }
      );
    }

    // Log audit BEFORE deletion (so we have record even if deletion partially fails)
    await supabaseAdmin.from("audit_logs").insert({
      user_id: callerUserId,
      action: "delete_user",
      target_user_id: user_id,
      details: {
        target_email: targetProfile.email,
        target_nome: targetProfile.nome,
        inventory,
        timestamp: new Date().toISOString(),
      },
    });

    // === DELETION in correct referential order ===
    const deletionSteps: { name: string; fn: () => Promise<{ error: any }> }[] = [
      {
        name: "parcelas_historico",
        fn: async () => {
          if (!pIds.length) return { error: null };
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
          if (!ctIds.length) return { error: null };
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
          if (!cIds.length) return { error: null };
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

    const completedSteps: Record<string, number> = {};
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
            note: "User was deactivated (ativo=false) before deletion started. Remaining data may need manual cleanup.",
          }),
          { status: 500, headers }
        );
      }
      // Record what was deleted per step
      const counts: Record<string, number> = {
        parcelas_historico: inventory.historico_estimado,
        parcelas: inventory.parcelas,
        contratos: inventory.contratos,
        clientes: inventory.clientes,
        user_roles: 1,
        profiles: 1,
      };
      completedSteps[step.name] = counts[step.name] || 0;
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

    completedSteps["auth.users"] = 1;

    return new Response(
      JSON.stringify({ success: true, completed_steps: completedSteps, inventory }),
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
