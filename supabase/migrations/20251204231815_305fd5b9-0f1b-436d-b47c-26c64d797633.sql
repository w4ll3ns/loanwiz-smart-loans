-- Tabela de configurações do sistema
CREATE TABLE public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chave TEXT UNIQUE NOT NULL,
    valor TEXT,
    descricao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS para system_settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler configurações
CREATE POLICY "Authenticated users can read system_settings"
ON public.system_settings FOR SELECT
TO authenticated
USING (true);

-- Apenas admins podem gerenciar configurações
CREATE POLICY "Admins can insert system_settings"
ON public.system_settings FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update system_settings"
ON public.system_settings FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete system_settings"
ON public.system_settings FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Inserir configuração inicial do WhatsApp
INSERT INTO public.system_settings (chave, valor, descricao)
VALUES ('whatsapp_contato', '', 'Número do WhatsApp para contato de ativação');

-- Novos campos no profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status_plano TEXT DEFAULT 'teste';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data_expiracao_teste DATE DEFAULT (CURRENT_DATE + INTERVAL '7 days');
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS observacoes_admin TEXT;

-- Trigger para atualizar updated_at em system_settings
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();