import { useState } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdmin } from '@/hooks/useAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, DollarSign, UserCheck } from 'lucide-react';
import { SystemSettings } from '@/components/admin/SystemSettings';
import { UsersTable } from '@/components/admin/UsersTable';
import { UserReportPanel } from '@/components/admin/UserReportPanel';
import { AuditLogsPanel } from '@/components/admin/AuditLogsPanel';
import { EditWhatsappDialog } from '@/components/admin/dialogs/EditWhatsappDialog';
import { EditObservacoesDialog } from '@/components/admin/dialogs/EditObservacoesDialog';
import { EditPlanDialog } from '@/components/admin/dialogs/EditPlanDialog';
import { DeleteUserDialog } from '@/components/admin/dialogs/DeleteUserDialog';
import type { Profile } from '@/components/admin/types';

export default function Admin() {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const admin = useAdmin(!!isAdmin);

  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);
  const [isObservacoesModalOpen, setIsObservacoesModalOpen] = useState(false);
  const [isPlanoModalOpen, setIsPlanoModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  if (roleLoading || admin.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Painel de Administração</h1>
          <p className="text-sm text-muted-foreground">Gerencie usuários e visualize estatísticas globais</p>
        </div>

        <SystemSettings
          whatsappNumber={admin.whatsappNumber}
          onEdit={() => setIsWhatsappModalOpen(true)}
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
              <CardTitle className="text-xs md:text-sm font-medium">Total Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              <div className="text-xl md:text-2xl font-bold">{admin.stats.totalUsuarios}</div>
              <p className="text-xs text-muted-foreground">{admin.stats.usuariosAtivos} ativos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
              <CardTitle className="text-xs md:text-sm font-medium">Total Clientes</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              <div className="text-xl md:text-2xl font-bold">{admin.stats.totalClientes}</div>
              <p className="text-xs text-muted-foreground">em todos os usuários</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
              <CardTitle className="text-xs md:text-sm font-medium">Total Contratos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              <div className="text-xl md:text-2xl font-bold">{admin.stats.totalContratos}</div>
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
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(admin.stats.valorTotalEmprestado)}
              </div>
              <p className="text-xs text-muted-foreground">total no sistema</p>
            </CardContent>
          </Card>
        </div>

        <UsersTable
          profiles={admin.profiles}
          onToggleStatus={admin.toggleUserStatus}
          onResetPassword={admin.resetPassword}
          onEditObservacoes={(user) => {
            setSelectedUser(user);
            setIsObservacoesModalOpen(true);
          }}
          onEditPlano={(user) => {
            setSelectedUser(user);
            setIsPlanoModalOpen(true);
          }}
          onDelete={(user) => {
            setSelectedUser(user);
            setIsDeleteModalOpen(true);
          }}
        />

        <UserReportPanel
          profiles={admin.profiles}
          userStats={admin.userStats}
          userClientes={admin.userClientes}
          userContratos={admin.userContratos}
          loadingReport={admin.loadingReport}
          onSelectUser={admin.loadUserReport}
        />

        <AuditLogsPanel
          auditLogs={admin.auditLogs}
          loadingAudit={admin.loadingAudit}
          profiles={admin.profiles}
          onLoad={admin.loadAuditLogs}
        />
      </div>

      <EditWhatsappDialog
        open={isWhatsappModalOpen}
        onOpenChange={setIsWhatsappModalOpen}
        initialNumber={admin.whatsappNumber}
        onSave={admin.saveWhatsapp}
      />

      <EditObservacoesDialog
        open={isObservacoesModalOpen}
        onOpenChange={(open) => {
          setIsObservacoesModalOpen(open);
          if (!open) setSelectedUser(null);
        }}
        user={selectedUser}
        onSave={admin.saveObservacoes}
      />

      <EditPlanDialog
        open={isPlanoModalOpen}
        onOpenChange={(open) => {
          setIsPlanoModalOpen(open);
          if (!open) setSelectedUser(null);
        }}
        user={selectedUser}
        onSave={admin.savePlano}
      />

      <DeleteUserDialog
        open={isDeleteModalOpen}
        onOpenChange={(open) => {
          setIsDeleteModalOpen(open);
          if (!open) setSelectedUser(null);
        }}
        user={selectedUser}
        onConfirm={admin.deleteUser}
      />
    </>
  );
}