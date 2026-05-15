import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type {
  AuditLog,
  Profile,
  Stats,
  StatusPlano,
  UserCliente,
  UserContrato,
  UserStats,
} from '@/components/admin/types';

export function useAdmin(enabled: boolean) {
  const { toast } = useToast();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsuarios: 0,
    usuariosAtivos: 0,
    totalClientes: 0,
    totalContratos: 0,
    valorTotalEmprestado: 0,
  });
  const [loading, setLoading] = useState(true);

  const [whatsappNumber, setWhatsappNumber] = useState('');

  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [userClientes, setUserClientes] = useState<UserCliente[]>([]);
  const [userContratos, setUserContratos] = useState<UserContrato[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const logAuditAction = useCallback(
    async (action: string, targetUserId: string | null, details: Record<string, unknown> = {}) => {
      try {
        await supabase.rpc('insert_audit_log', {
          p_action: action,
          p_target_user_id: targetUserId,
          p_details: details as unknown as undefined,
        });
      } catch (error) {
        console.error('Erro ao registrar log de auditoria:', error);
      }
    },
    []
  );

  const loadAuditLogs = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setAuditLogs((data || []) as AuditLog[]);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  const loadWhatsappConfig = useCallback(async () => {
    const { data } = await supabase
      .from('system_settings')
      .select('valor')
      .eq('chave', 'whatsapp_contato')
      .maybeSingle();
    if (data?.valor) setWhatsappNumber(data.valor);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (profilesError) throw profilesError;
      setProfiles(profilesData || []);

      const { data: globalStats, error: statsError } = await supabase.rpc('admin_get_global_stats');
      if (statsError) throw statsError;

      const statsData = globalStats as
        | { total_clientes: number; total_contratos: number; valor_total_emprestado: number }
        | null;

      setStats({
        totalUsuarios: profilesData?.length || 0,
        usuariosAtivos: profilesData?.filter((p) => p.ativo).length || 0,
        totalClientes: statsData?.total_clientes || 0,
        totalContratos: statsData?.total_contratos || 0,
        valorTotalEmprestado: statsData?.valor_total_emprestado || 0,
      });
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados do painel.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (enabled) {
      loadData();
      loadWhatsappConfig();
    }
  }, [enabled, loadData, loadWhatsappConfig]);

  const loadUserReport = useCallback(
    async (userId: string) => {
      if (!userId) {
        setUserStats(null);
        setUserClientes([]);
        setUserContratos([]);
        return;
      }
      setLoadingReport(true);
      try {
        const [statsRes, clientesRes, contratosRes] = await Promise.all([
          supabase.rpc('admin_get_user_stats', { p_user_id: userId }),
          supabase.rpc('admin_get_user_clientes', { p_user_id: userId }),
          supabase.rpc('admin_get_user_contratos', { p_user_id: userId }),
        ]);
        if (statsRes.error) throw statsRes.error;
        if (clientesRes.error) throw clientesRes.error;
        if (contratosRes.error) throw contratosRes.error;

        setUserStats(statsRes.data as unknown as UserStats | null);
        setUserClientes((clientesRes.data as UserCliente[]) || []);
        setUserContratos((contratosRes.data as UserContrato[]) || []);
      } catch (error) {
        console.error('Erro ao carregar relatório:', error);
        toast({
          title: 'Erro ao carregar relatório',
          description: 'Não foi possível carregar os dados do usuário.',
          variant: 'destructive',
        });
      } finally {
        setLoadingReport(false);
      }
    },
    [toast]
  );

  const saveWhatsapp = useCallback(
    async (numero: string): Promise<boolean> => {
      try {
        const { data: existing } = await supabase
          .from('system_settings')
          .select('id')
          .eq('chave', 'whatsapp_contato')
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('system_settings')
            .update({ valor: numero })
            .eq('chave', 'whatsapp_contato');
          if (error) throw error;
        } else {
          const { error } = await supabase.from('system_settings').insert({
            chave: 'whatsapp_contato',
            valor: numero,
            descricao: 'Número do WhatsApp para contato de ativação',
          });
          if (error) throw error;
        }

        setWhatsappNumber(numero);
        toast({ title: 'WhatsApp atualizado', description: 'O número de contato foi salvo com sucesso.' });
        return true;
      } catch (error) {
        console.error('Erro ao salvar WhatsApp:', error);
        toast({
          title: 'Erro ao salvar',
          description: 'Não foi possível salvar o número.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast]
  );

  const toggleUserStatus = useCallback(
    async (userId: string, currentStatus: boolean) => {
      try {
        const { error } = await supabase.rpc('admin_toggle_user_status', {
          p_user_id: userId,
          p_ativo: !currentStatus,
        });
        if (error) throw error;

        setProfiles((prev) =>
          prev.map((p) => (p.id === userId ? { ...p, ativo: !currentStatus } : p))
        );

        toast({
          title: 'Status atualizado',
          description: `Usuário ${!currentStatus ? 'ativado' : 'desativado'} com sucesso.`,
        });
      } catch (error) {
        console.error('Erro ao atualizar status:', error);
        toast({
          title: 'Erro ao atualizar',
          description: 'Não foi possível atualizar o status do usuário.',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  const resetPassword = useCallback(
    async (email: string | null) => {
      if (!email) {
        toast({ title: 'Erro', description: 'Usuário sem email cadastrado.', variant: 'destructive' });
        return;
      }
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;

        toast({
          title: 'Email enviado',
          description: `Email de redefinição de senha enviado para ${email}.`,
        });
        const profile = profiles.find((p) => p.email === email);
        if (profile) await logAuditAction('reset_password', profile.id, { email });
      } catch (error: any) {
        console.error('Erro ao redefinir senha:', error);
        toast({
          title: 'Erro ao enviar email',
          description: error.message || 'Não foi possível enviar o email de redefinição.',
          variant: 'destructive',
        });
      }
    },
    [profiles, toast, logAuditAction]
  );

  const deleteUser = useCallback(
    async (user: Profile): Promise<boolean> => {
      try {
        const { error } = await supabase.functions.invoke('delete-user', {
          body: { user_id: user.id },
        });
        if (error) throw error;

        toast({
          title: 'Usuário excluído',
          description: 'O usuário e todos os seus dados foram removidos completamente.',
        });

        await logAuditAction('delete_user', user.id, { email: user.email, nome: user.nome });
        await loadData();
        return true;
      } catch (error: any) {
        console.error('Erro ao excluir usuário:', error);
        toast({
          title: 'Erro ao excluir',
          description: error.message || 'Não foi possível excluir o usuário.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast, logAuditAction, loadData]
  );

  const saveObservacoes = useCallback(
    async (userId: string, observacoes: string): Promise<boolean> => {
      try {
        const { error } = await supabase.rpc('admin_update_user_observacoes', {
          p_user_id: userId,
          p_observacoes: observacoes,
        });
        if (error) throw error;

        setProfiles((prev) =>
          prev.map((p) => (p.id === userId ? { ...p, observacoes_admin: observacoes || null } : p))
        );

        toast({ title: 'Observações salvas', description: 'As observações foram atualizadas.' });
        return true;
      } catch (error) {
        console.error('Erro ao salvar observações:', error);
        toast({
          title: 'Erro ao salvar',
          description: 'Não foi possível salvar as observações.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast]
  );

  const savePlano = useCallback(
    async (userId: string, plano: StatusPlano): Promise<boolean> => {
      try {
        const { error } = await supabase.rpc('admin_update_user_plano', {
          p_user_id: userId,
          p_plano: plano,
        });
        if (error) throw error;

        setProfiles((prev) =>
          prev.map((p) => (p.id === userId ? { ...p, status_plano: plano } : p))
        );

        toast({ title: 'Plano atualizado', description: 'O status do plano foi alterado.' });
        return true;
      } catch (error) {
        console.error('Erro ao alterar plano:', error);
        toast({
          title: 'Erro ao salvar',
          description: 'Não foi possível alterar o plano.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast]
  );

  return {
    profiles,
    stats,
    loading,
    whatsappNumber,
    auditLogs,
    loadingAudit,
    userStats,
    userClientes,
    userContratos,
    loadingReport,
    loadAuditLogs,
    loadUserReport,
    saveWhatsapp,
    toggleUserStatus,
    resetPassword,
    deleteUser,
    saveObservacoes,
    savePlano,
  };
}