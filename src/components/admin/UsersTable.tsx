import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Search, MoreVertical, Key, Trash2, MessageSquare, CreditCard } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Profile } from './types';

interface Props {
  profiles: Profile[];
  onToggleStatus: (userId: string, currentStatus: boolean) => void;
  onResetPassword: (email: string | null) => void;
  onEditObservacoes: (user: Profile) => void;
  onEditPlano: (user: Profile) => void;
  onDelete: (user: Profile) => void;
}

function getStatusPlanoBadge(profile: Profile) {
  let status = profile.status_plano || 'teste';
  if (status === 'teste' && profile.data_expiracao_teste) {
    const expDate = new Date(profile.data_expiracao_teste);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (expDate < today) status = 'expirado';
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
}

function formatUltimoAcesso(date: string | null) {
  if (!date) return 'Nunca';
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
}

export function UsersTable({
  profiles,
  onToggleStatus,
  onResetPassword,
  onEditObservacoes,
  onEditPlano,
  onDelete,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [planoFilter, setPlanoFilter] = useState('todos');

  const filteredProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      const matchesSearch =
        (profile.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (profile.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'ativos' && profile.ativo) ||
        (statusFilter === 'inativos' && !profile.ativo);

      let currentPlano = profile.status_plano || 'teste';
      if (currentPlano === 'teste' && profile.data_expiracao_teste) {
        const expDate = new Date(profile.data_expiracao_teste);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (expDate < today) currentPlano = 'expirado';
      }
      const matchesPlano = planoFilter === 'todos' || currentPlano === planoFilter;
      return matchesSearch && matchesStatus && matchesPlano;
    });
  }, [profiles, searchTerm, statusFilter, planoFilter]);

  return (
    <>
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">Usuários Cadastrados ({filteredProfiles.length})</CardTitle>
          <CardDescription className="text-xs md:text-sm">Gerencie os usuários do sistema</CardDescription>
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
                      <TableCell className="hidden lg:table-cell">{getStatusPlanoBadge(profile)}</TableCell>
                      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                        {formatUltimoAcesso(profile.ultimo_acesso)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={profile.ativo}
                            onCheckedChange={() => onToggleStatus(profile.id, profile.ativo)}
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
                            <DropdownMenuItem onClick={() => onResetPassword(profile.email)}>
                              <Key className="mr-2 h-4 w-4" />
                              Redefinir Senha
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEditObservacoes(profile)}>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Observações
                              {profile.observacoes_admin && <span className="ml-auto text-xs">●</span>}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEditPlano(profile)}>
                              <CreditCard className="mr-2 h-4 w-4" />
                              Alterar Plano
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => onDelete(profile)}
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
    </>
  );
}