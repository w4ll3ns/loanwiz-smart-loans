import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import logo from '@/assets/logo.png';

const loginSchema = z.object({
  email: z.string().trim().email('Email inválido').max(255, 'Email muito longo'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(100, 'Senha muito longa'),
});

const signupSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Nome muito longo'),
  email: z.string().trim().email('Email inválido').max(255, 'Email muito longo'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(100, 'Senha muito longa'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type AuthView = 'login' | 'signup' | 'forgot';

export default function Auth() {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate('/');
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const clearErrors = () => setErrors({});

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    setLoading(true);

    try {
      const validated = loginSchema.parse({ email, password });
      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });
      if (error) throw error;
      toast({ title: 'Login realizado com sucesso!', description: 'Bem-vindo de volta.' });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }
      let errorMessage = 'Verifique suas credenciais e tente novamente.';
      if (error.message?.includes('Invalid login credentials')) {
        errorMessage = 'Email ou senha incorretos. Verifique seus dados e tente novamente.';
      } else if (error.message?.includes('Email not confirmed')) {
        errorMessage = 'Email não confirmado. Verifique sua caixa de entrada.';
      } else if (error.message?.includes('Too many requests')) {
        errorMessage = 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.';
      }
      toast({ title: 'Não foi possível fazer login', description: errorMessage, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    setLoading(true);

    try {
      const validated = signupSchema.parse({ nome, email, password, confirmPassword });
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { nome: validated.nome },
        },
      });
      if (error) throw error;
      toast({ title: 'Cadastro realizado!', description: 'Verifique seu email para confirmar o cadastro.' });
      setNome('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setView('login');
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }
      let errorMessage = 'Não foi possível criar a conta. Tente novamente.';
      if (error.message?.includes('already registered')) {
        errorMessage = 'Este email já está cadastrado. Tente fazer login.';
      } else if (error.message?.includes('Password')) {
        errorMessage = 'A senha não atende aos requisitos de segurança.';
      }
      toast({ title: 'Erro no cadastro', description: errorMessage, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !z.string().email().safeParse(trimmedEmail).success) {
        setErrors({ email: 'Digite um email válido' });
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;

      toast({
        title: 'Email enviado!',
        description: 'Se este email estiver cadastrado, você receberá um link para redefinir sua senha.',
      });
      setView('login');
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar email',
        description: 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="Logo" className="h-16 w-auto mx-auto mb-2" />
          <CardTitle>
            {view === 'login' ? 'Login' : view === 'signup' ? 'Criar Conta' : 'Recuperar Senha'}
          </CardTitle>
          <CardDescription>
            {view === 'login'
              ? 'Entre com suas credenciais para acessar o sistema'
              : view === 'signup'
              ? 'Preencha os dados para criar sua conta'
              : 'Digite seu email para receber o link de recuperação'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">Senha</label>
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>
              <div className="text-right">
                <button type="button" onClick={() => { setView('forgot'); clearErrors(); }} className="text-xs text-primary hover:underline">
                  Esqueci minha senha
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Processando...' : 'Entrar'}
              </Button>
            </form>
          )}

          {view === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="nome" className="text-sm font-medium">Nome completo</label>
                <Input id="nome" type="text" placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
                {errors.nome && <p className="text-sm text-destructive">{errors.nome}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="signup-email" className="text-sm font-medium">Email</label>
                <Input id="signup-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="signup-password" className="text-sm font-medium">Senha</label>
                <Input id="signup-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-medium">Confirmar senha</label>
                <Input id="confirm-password" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Processando...' : 'Criar conta'}
              </Button>
            </form>
          )}

          {view === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="forgot-email" className="text-sm font-medium">Email</label>
                <Input id="forgot-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </Button>
            </form>
          )}

          <div className="mt-4 text-center">
            {view === 'forgot' ? (
              <button type="button" onClick={() => { setView('login'); clearErrors(); }} className="text-sm text-primary hover:underline">
                Voltar ao login
              </button>
            ) : (
              <button type="button" onClick={() => { setView(view === 'login' ? 'signup' : 'login'); clearErrors(); }} className="text-sm text-primary hover:underline">
                {view === 'login' ? 'Não tem conta? Criar uma agora' : 'Já tem conta? Fazer login'}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
