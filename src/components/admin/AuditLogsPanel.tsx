import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AuditLog, Profile } from './types';

interface Props {
  auditLogs: AuditLog[];
  loadingAudit: boolean;
  profiles: Profile[];
  onLoad: () => void;
}

const actionLabels: Record<string, string> = {
  toggle_user: 'Ativar/Desativar',
  delete_user: 'Excluir Usuário',
  change_plan: 'Alterar Plano',
  reset_password: 'Redefinir Senha',
};

export function AuditLogsPanel({ auditLogs, loadingAudit, profiles, onLoad }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base md:text-lg">Logs de Auditoria</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={onLoad} disabled={loadingAudit}>
            {loadingAudit ? 'Carregando...' : 'Carregar Logs'}
          </Button>
        </div>
        <CardDescription className="text-xs md:text-sm">
          Últimas 100 ações administrativas registradas
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {auditLogs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 px-4">
            {loadingAudit ? 'Carregando...' : 'Clique em "Carregar Logs" para visualizar'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px] pl-4">Data</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead className="hidden md:table-cell">Usuário Alvo</TableHead>
                  <TableHead className="hidden lg:table-cell">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => {
                  const targetProfile = profiles.find((p) => p.id === log.target_user_id);
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="pl-4 text-sm">
                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {actionLabels[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {targetProfile?.nome || targetProfile?.email || log.target_user_id || '-'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                        {JSON.stringify(log.details)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}