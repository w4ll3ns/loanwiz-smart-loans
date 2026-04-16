import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { User, Phone, Mail, Save, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/PageHeader';

export default function Perfil() {
  const { profile, isLoading, userEmail } = useUserRole();
  const { toast } = useToast();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setNome(profile.nome || '');
      setTelefone(profile.telefone || '');
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_own_profile', {
        p_nome: nome || undefined,
        p_telefone: telefone || undefined,
      });

      if (error) throw error;

      toast({ title: 'Perfil atualizado', description: 'Seus dados foram salvos com sucesso.' });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível atualizar o perfil.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusPlano = profile?.status_plano || 'teste';
  const statusColor = {
    teste: 'bg-warning/10 text-warning border-warning/30',
    ativo: 'bg-success/10 text-success border-success/30',
    expirado: 'bg-destructive/10 text-destructive border-destructive/30',
    cancelado: 'bg-muted text-muted-foreground border-border',
  }[statusPlano] || 'bg-muted text-muted-foreground border-border';

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <PageHeader title="Meu Perfil" description="Gerencie suas informações pessoais" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Dados Pessoais
          </CardTitle>
          <CardDescription>Atualize seu nome e telefone de contato</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-1.5 text-xs">
              <Mail className="h-3.5 w-3.5" /> Email
            </Label>
            <Input id="email" value={userEmail || ''} disabled className="bg-muted" />
            <p className="text-[11px] text-muted-foreground">O email não pode ser alterado.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome" className="flex items-center gap-1.5 text-xs">
              <User className="h-3.5 w-3.5" /> Nome
            </Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome completo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone" className="flex items-center gap-1.5 text-xs">
              <Phone className="h-3.5 w-3.5" /> Telefone
            </Label>
            <Input
              id="telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar alterações
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações do Plano</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status do Plano</span>
            <Badge variant="outline" className={statusColor}>
              {statusPlano === 'teste' ? 'Teste' :
               statusPlano === 'ativo' ? 'Ativo' :
               statusPlano === 'expirado' ? 'Expirado' : 'Cancelado'}
            </Badge>
          </div>
          {profile?.data_expiracao_teste && statusPlano === 'teste' && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Expira em</span>
              <span className="text-sm font-medium">
                {format(new Date(profile.data_expiracao_teste), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Membro desde</span>
            <span className="text-sm font-medium">
              {profile?.created_at ? format(new Date(profile.created_at), "dd/MM/yyyy", { locale: ptBR }) : '—'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
