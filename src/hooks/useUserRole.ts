import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'user';
type StatusPlano = 'teste' | 'ativo' | 'expirado' | 'cancelado';

interface Profile {
  id: string;
  email: string | null;
  nome: string | null;
  telefone: string | null;
  ativo: boolean;
  status_plano: StatusPlano;
  data_expiracao_teste: string | null;
  ultimo_acesso: string | null;
  observacoes_admin: string | null;
  created_at: string;
}

interface UserRoleState {
  role: AppRole | null;
  isAdmin: boolean;
  isActive: boolean;
  canCreate: boolean;
  isLoading: boolean;
  profile: Profile | null;
  userEmail: string | null;
}

interface UserRoleData {
  role: AppRole | null;
  profile: Profile | null;
  userEmail: string | null;
  profileFetchFailed: boolean;
}

async function fetchUserRoleData(): Promise<UserRoleData | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [roleRes, profileRes] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
  ]);

  if (roleRes.error) console.error('Error fetching user role:', roleRes.error);
  if (profileRes.error) console.error('Error fetching profile:', profileRes.error);

  return {
    role: (roleRes.data?.role as AppRole) || 'user',
    profile: (profileRes.data as Profile | null) ?? null,
    userEmail: user.email || null,
    profileFetchFailed: !!profileRes.error,
  };
}

export function useUserRole(): UserRoleState {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['user-role'],
    queryFn: fetchUserRoleData,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: ['user-role'] });
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  if (!data) {
    return {
      role: null,
      isAdmin: false,
      isActive: false,
      canCreate: false,
      isLoading,
      profile: null,
      userEmail: null,
    };
  }

  const { role, profile, userEmail, profileFetchFailed } = data;
  const isAdmin = role === 'admin';
  const isActive = profile?.ativo ?? false;

  // Fail-closed: if profile fetch failed, default to 'expirado'
  let statusPlano: StatusPlano = profileFetchFailed
    ? 'expirado'
    : (profile?.status_plano || 'teste');

  if (statusPlano === 'teste' && profile?.data_expiracao_teste) {
    const expDate = new Date(profile.data_expiracao_teste);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (expDate < today) statusPlano = 'expirado';
  }

  const canCreate =
    isAdmin || (isActive && (statusPlano === 'teste' || statusPlano === 'ativo'));

  return {
    role,
    isAdmin,
    isActive,
    canCreate,
    isLoading,
    profile: profile ? { ...profile, status_plano: statusPlano } : null,
    userEmail,
  };
}
