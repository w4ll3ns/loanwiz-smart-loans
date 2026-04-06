import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Users, FileText, DollarSign, UserCheck, Settings, Search, MoreVertical, Key, Trash2, MessageSquare, CreditCard, Phone, Pencil, BarChart3, ScrollText } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  target_user_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

interface Profile {
  id: string;
  email: string | null;
  nome: string | null;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
  ultimo_acesso: string | null;
  status_plano: string | null;
  data_expiracao_teste: string | null;
  observacoes_admin: string | null;
}

interface Stats {
  totalUsuarios: number;
  usuariosAtivos: number;
  totalClientes: number;
  totalContratos: number;
  valorTotalEmprestado: number;
}

interface UserStats {
  total_clientes: number;
  total_contratos: number;
  valor_emprestado: number;
  valor_a_receber: number;
  valor_recebido: number;
}

interface UserContrato {
  id: string;
  cliente_nome: string;
  valor_emprestado: number;
  valor_total: number;
  status: string;
  data_emprestimo: string;
  numero_parcelas: number;
  periodicidade: string;
}

interface UserCliente {
  id: string;
  nome: string;
  telefone: string | null;
  endereco: string | null;
}

type StatusPlano = 'teste' | 'ativo' | 'expirado' | 'cancelado';

export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [planoFilter, setPlanoFilter] = useState<string>('todos');
  
  // Modals
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);
  const [isObservacoesModalOpen, setIsObservacoesModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPlanoModalOpen, setIsPlanoModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [observacoesText, setObservacoesText] = useState('');
  const [selectedPlano, setSelectedPlano] = useState<StatusPlano>('teste');
  
  // Relatórios por usuário
  const [selectedReportUser, setSelectedReportUser] = useState<string>('');
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [userClientes, setUserClientes] = useState<UserCliente[]>([]);
  const [userContratos, setUserContratos] = useState<UserContrato[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const logAuditAction = async (action: string, targetUserId: string | null, details: Record<string, unknown> = {}) => {
    try {
      await supabase.rpc('insert_audit_log', {
        p_action: action,
        p_target_user_id: targetUserId,
        p_details: details as unknown as undefined,
      });
    } catch (error) {
      console.error('Erro ao registrar log de auditoria:', error);
    }
  };

  const loadAuditLogs = async () => {
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
  };

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
      loadWhatsappConfig();
    }
  }, [isAdmin]);

  const loadWhatsappConfig = async () => {
    const { data } = await supabase
      .from('system_settings')
      .select('valor')
      .eq('chave', 'whatsapp_contato')
      .maybeSingle();
    
    if (data?.valor) {
      setWhatsappNumber(data.valor);
    }
  };

  const loadData = async () => {
    try {
      // Carrega profiles (admin pode ver todos os profiles)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;
      setProfiles(profilesData || []);

      // Carrega estatísticas globais via função SECURITY DEFINER
      const { data: globalStats, error: statsError } = await supabase
        .rpc('admin_get_global_stats');

      if (statsError) throw statsError;

      const statsData = globalStats as { total_clientes: number; total_contratos: number; valor_total_emprestado: number } | null;

      setStats({
        totalUsuarios: profilesData?.length || 0,
        usuariosAtivos: profilesData?.filter(p => p.ativo).length || 0,
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
  };

  const loadUserReport = async (userId: string) => {
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
  };

  const handleSelectReportUser = (userId: string) => {
    setSelectedReportUser(userId);
    loadUserReport(userId);
  };

  const handleSaveWhatsapp = async () => {
    try {
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('chave', 'whatsapp_contato')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('system_settings')
          .update({ valor: whatsappNumber })
          .eq('chave', 'whatsapp_contato');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('system_settings')
          .insert({ chave: 'whatsapp_contato', valor: whatsappNumber, descricao: 'Número do WhatsApp para contato de ativação' });
        if (error) throw error;
      }

      toast({ title: 'WhatsApp atualizado', description: 'O número de contato foi salvo com sucesso.' });
      setIsWhatsappModalOpen(false);
    } catch (error) {
      console.error('Erro ao salvar WhatsApp:', error);
      toast({ title: 'Erro ao salvar', description: 'Não foi possível salvar o número.', variant: 'destructive' });
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ativo: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      setProfiles(prev =>
        prev.map(p => p.id === userId ? { ...p, ativo: !currentStatus } : p)
      );

      toast({
        title: 'Status atualizado',
        description: `Usuário ${!currentStatus ? 'ativado' : 'desativado'} com sucesso.`,
      });
      await logAuditAction('toggle_user', userId, { ativo: !currentStatus });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o status do usuário.',
        variant: 'destructive',
      });
    }
  };

  const handleResetPassword = async (email: string | null) => {
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
      const profile = profiles.find(p => p.email === email);
      if (profile) await logAuditAction('reset_password', profile.id, { email });
    } catch (error: any) {
      console.error('Erro ao redefinir senha:', error);
      toast({
        title: 'Erro ao enviar email',
        description: error.message || 'Não foi possível enviar o email de redefinição.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: selectedUser.id },
      });

      if (error) throw error;

      toast({
        title: 'Usuário excluído',
        description: 'O usuário e todos os seus dados foram removidos completamente.',
      });

      await logAuditAction('delete_user', selectedUser.id, { email: selectedUser.email, nome: selectedUser.nome });

      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      loadData();
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      toast({
        title: 'Erro ao excluir',
        description: error.message || 'Não foi possível excluir o usuário.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveObservacoes = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ observacoes_admin: observacoesText || null })
        .eq('id', selectedUser.id);

      if (error) throw error;

      setProfiles(prev =>
        prev.map(p => p.id === selectedUser.id ? { ...p, observacoes_admin: observacoesText || null } : p)
      );

      toast({ title: 'Observações salvas', description: 'As observações foram atualizadas.' });
      setIsObservacoesModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Erro ao salvar observações:', error);
      toast({ title: 'Erro ao salvar', description: 'Não foi possível salvar as observações.', variant: 'destructive' });
    }
  };

  const handleSavePlano = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status_plano: selectedPlano })
        .eq('id', selectedUser.id);

      if (error) throw error;

      setProfiles(prev =>
        prev.map(p => p.id === selectedUser.id ? { ...p, status_plano: selectedPlano } : p)
      );

      toast({ title: 'Plano atualizado', description: 'O status do plano foi alterado.' });
      await logAuditAction('change_plan', selectedUser.id, { plano: selectedPlano });
      setIsPlanoModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Erro ao alterar plano:', error);
      toast({ title: 'Erro ao salvar', description: 'Não foi possível alterar o plano.', variant: 'destructive' });
    }
  };

  const getStatusPlanoBadge = (profile: Profile) => {
    let status = profile.status_plano || 'teste';
    
    // Check if trial expired
    if (status === 'teste' && profile.data_expiracao_teste) {
      const expDate = new Date(profile.data_expiracao_teste);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expDate < today) {
        status = 'expirado';
      }
    }

    switch (status) {
      case 'ativo':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Ativo</Badge>;
      case 'teste':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Teste</Badge>;
      case 'expirado':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Expirado</Badge>;
      case 'cancelado':
        return <Badge variant="secondary">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatUltimoAcesso = (date: string | null) => {
    if (!date) return 'Nunca';
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  };

  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = 
      (profile.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (profile.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'todos' || 
      (statusFilter === 'ativos' && profile.ativo) ||
      (statusFilter === 'inativos' && !profile.ativo);
    
    let currentPlano = profile.status_plano || 'teste';
    if (currentPlano === 'teste' && profile.data_expiracao_teste) {
      const expDate = new Date(profile.data_expiracao_teste);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expDate < today) {
        currentPlano = 'expirado';
      }
    }
    const matchesPlano = planoFilter === 'todos' || currentPlano === planoFilter;

    return matchesSearch && matchesStatus && matchesPlano;
  });

  if (roleLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Painel de Administração</h1>
          <p className="text-sm text-muted-foreground">Gerencie usuários e visualize estatísticas globais</p>
        </div>

        {/* Configurações do Sistema */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Configurações do Sistema</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">WhatsApp para Contato:</span>
                <span className="text-sm font-medium truncate">
                  {whatsappNumber || 'Não configurado'}
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={() => setIsWhatsappModalOpen(true)}>
                <Pencil className="h-3 w-3 mr-1" />
                Editar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
              <CardTitle className="text-xs md:text-sm font-medium">Total Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              <div className="text-xl md:text-2xl font-bold">{stats.totalUsuarios}</div>
              <p className="text-xs text-muted-foreground">{stats.usuariosAtivos} ativos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
              <CardTitle className="text-xs md:text-sm font-medium">Total Clientes</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              <div className="text-xl md:text-2xl font-bold">{stats.totalClientes}</div>
              <p className="text-xs text-muted-foreground">em todos os usuários</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
              <CardTitle className="text-xs md:text-sm font-medium">Total Contratos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              <div className="text-xl md:text-2xl font-bold">{stats.totalContratos}</div>
              <p className="text-xs text-muted-foreground">em todos os usuários</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
              <CardTitle className="text-xs md:text-sm font-medium">Valor Emprestado</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              <div className="text-xl md:text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(stats.valorTotalEmprestado)}
              </div>
              <p className="text-xs text-muted-foreground">total no sistema</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="ativos">Ativos</SelectItem>
                    <SelectItem value="inativos">Inativos</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={planoFilter} onValueChange={setPlanoFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="teste">Teste</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="expirado">Expirado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Usuários */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg">Usuários Cadastrados ({filteredProfiles.length})</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Gerencie os usuários do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px] pl-4">Nome</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden lg:table-cell">Plano</TableHead>
                    <TableHead className="hidden xl:table-cell">Último Acesso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-4">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProfiles.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="pl-4">
                          <div>
                            <p className="font-medium text-sm">{profile.nome || 'Sem nome'}</p>
                            <p className="text-xs text-muted-foreground md:hidden">{profile.email || '-'}</p>
                            <div className="flex items-center gap-1 mt-1 lg:hidden">
                              {getStatusPlanoBadge(profile)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{profile.email || '-'}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {getStatusPlanoBadge(profile)}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                          {formatUltimoAcesso(profile.ultimo_acesso)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={profile.ativo}
                              onCheckedChange={() => toggleUserStatus(profile.id, profile.ativo)}
                            />
                            <span className="text-xs hidden sm:inline">
                              {profile.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => handleResetPassword(profile.email)}>
                                <Key className="mr-2 h-4 w-4" />
                                Redefinir Senha
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedUser(profile);
                                setObservacoesText(profile.observacoes_admin || '');
                                setIsObservacoesModalOpen(true);
                              }}>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Observações
                                {profile.observacoes_admin && <span className="ml-auto text-xs">●</span>}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedUser(profile);
                                setSelectedPlano((profile.status_plano as StatusPlano) || 'teste');
                                setIsPlanoModalOpen(true);
                              }}>
                                <CreditCard className="mr-2 h-4 w-4" />
                                Alterar Plano
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  setSelectedUser(profile);
                                  setIsDeleteModalOpen(true);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir Usuário
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Relatórios por Usuário */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base md:text-lg">Relatórios por Usuário</CardTitle>
            </div>
            <CardDescription className="text-xs md:text-sm">
              Selecione um usuário para visualizar seus dados detalhados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Selecione um usuário</Label>
              <Select value={selectedReportUser} onValueChange={handleSelectReportUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um usuário..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.nome || profile.email || 'Sem nome'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loadingReport && (
              <div className="text-center py-4">
                <p className="text-muted-foreground">Carregando relatório...</p>
              </div>
            )}

            {!loadingReport && selectedReportUser && userStats && (
              <div className="space-y-4">
                {/* Estatísticas do usuário */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border bg-muted/50">
                    <p className="text-xs text-muted-foreground">Clientes</p>
                    <p className="text-lg font-bold">{userStats.total_clientes}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-muted/50">
                    <p className="text-xs text-muted-foreground">Contratos</p>
                    <p className="text-lg font-bold">{userStats.total_contratos}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-muted/50">
                    <p className="text-xs text-muted-foreground">Total Emprestado</p>
                    <p className="text-lg font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(userStats.valor_emprestado)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-muted/50">
                    <p className="text-xs text-muted-foreground">A Receber</p>
                    <p className="text-lg font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(userStats.valor_a_receber)}
                    </p>
                  </div>
                </div>

                {/* Lista de Clientes */}
                {userClientes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Clientes ({userClientes.length})</h4>
                    <div className="overflow-x-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                         <TableRow>
                             <TableHead>Nome</TableHead>
                             <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userClientes.slice(0, 10).map((cliente) => (
                             <TableRow key={cliente.id}>
                               <TableCell className="font-medium">
                                 {cliente.nome}
                                 <div className="sm:hidden text-xs text-muted-foreground">{cliente.telefone || '-'}</div>
                               </TableCell>
                               <TableCell className="hidden sm:table-cell">{cliente.telefone || '-'}</TableCell>
                             </TableRow>
                          ))}
                          {userClientes.length > 10 && (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground">
                                ... e mais {userClientes.length - 10} cliente(s)
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Lista de Contratos */}
                {userContratos.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Contratos ({userContratos.length})</h4>
                    <div className="overflow-x-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                           <TableRow>
                             <TableHead>Cliente</TableHead>
                             <TableHead>Valor</TableHead>
                             <TableHead className="hidden sm:table-cell">Parcelas</TableHead>
                             <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userContratos.slice(0, 10).map((contrato) => (
                            <TableRow key={contrato.id}>
                              <TableCell className="font-medium">{contrato.cliente_nome}</TableCell>
                              <TableCell>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contrato.valor_emprestado)}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">{contrato.numero_parcelas}x</TableCell>
                              <TableCell>
                                <Badge variant={contrato.status === 'ativo' ? 'default' : contrato.status === 'quitado' ? 'outline' : 'secondary'}>
                                  {contrato.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                          {userContratos.length > 10 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground">
                                ... e mais {userContratos.length - 10} contrato(s)
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {userClientes.length === 0 && userContratos.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    Este usuário não possui clientes ou contratos cadastrados.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal WhatsApp */}
      <Dialog open={isWhatsappModalOpen} onOpenChange={setIsWhatsappModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar WhatsApp de Contato</DialogTitle>
            <DialogDescription>
              Este número será usado para que novos usuários entrem em contato para ativar o acesso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="whatsapp">Número do WhatsApp</Label>
              <Input
                id="whatsapp"
                placeholder="Ex: 5585999999999"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Digite o número completo com código do país (ex: 55 para Brasil)
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsWhatsappModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveWhatsapp}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Observações */}
      <Dialog open={isObservacoesModalOpen} onOpenChange={setIsObservacoesModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Observações do Usuário</DialogTitle>
            <DialogDescription>
              {selectedUser?.nome || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Notas internas sobre o usuário..."
              value={observacoesText}
              onChange={(e) => setObservacoesText(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsObservacoesModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveObservacoes}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Alterar Plano */}
      <Dialog open={isPlanoModalOpen} onOpenChange={setIsPlanoModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Plano</DialogTitle>
            <DialogDescription>
              {selectedUser?.nome || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Status do Plano</Label>
              <Select value={selectedPlano} onValueChange={(v) => setSelectedPlano(v as StatusPlano)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teste">Teste</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="expirado">Expirado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsPlanoModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePlano}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Exclusão */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent className="w-[95vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados do usuário serão removidos, incluindo clientes, contratos e parcelas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
