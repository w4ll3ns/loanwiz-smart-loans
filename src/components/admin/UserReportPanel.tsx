import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3 } from 'lucide-react';
import type { Profile, UserCliente, UserContrato, UserStats } from './types';

interface Props {
  profiles: Profile[];
  userStats: UserStats | null;
  userClientes: UserCliente[];
  userContratos: UserContrato[];
  loadingReport: boolean;
  onSelectUser: (userId: string) => void;
}

export function UserReportPanel({
  profiles,
  userStats,
  userClientes,
  userContratos,
  loadingReport,
  onSelectUser,
}: Props) {
  const [selectedReportUser, setSelectedReportUser] = useState('');

  const handleChange = (userId: string) => {
    setSelectedReportUser(userId);
    onSelectUser(userId);
  };

  return (
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
          <Select value={selectedReportUser} onValueChange={handleChange}>
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
                            <Badge
                              variant={
                                contrato.status === 'ativo'
                                  ? 'default'
                                  : contrato.status === 'quitado'
                                  ? 'outline'
                                  : 'secondary'
                              }
                            >
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
  );
}