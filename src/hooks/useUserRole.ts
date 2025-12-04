import { useState, useEffect } from 'react';
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

export function useUserRole(): UserRoleState {
  const [state, setState] = useState<UserRoleState>({
    role: null,
    isAdmin: false,
    isActive: false,
    canCreate: false,
    isLoading: true,
    profile: null,
    userEmail: null,
  });

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setState({ 
            role: null, 
            isAdmin: false, 
            isActive: false,
            canCreate: false,
            isLoading: false,
            profile: null,
            userEmail: null,
          });
          return;
        }

        // Fetch role
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (roleError) {
          console.error('Error fetching user role:', roleError);
        }

        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
        }

        const role = (roleData?.role as AppRole) || 'user';
        const isAdmin = role === 'admin';
        const profile = profileData as Profile | null;
        
        // Determine if user is active and can create
        const isActive = profile?.ativo ?? false;
        
        // Check if trial is expired
        let statusPlano = profile?.status_plano || 'teste';
        if (statusPlano === 'teste' && profile?.data_expiracao_teste) {
          const expDate = new Date(profile.data_expiracao_teste);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (expDate < today) {
            statusPlano = 'expirado';
          }
        }

        // Can create if: active AND (trial not expired OR has active plan)
        // Admin can always create
        const canCreate = isAdmin || (isActive && (statusPlano === 'teste' || statusPlano === 'ativo'));

        setState({
          role,
          isAdmin,
          isActive,
          canCreate,
          isLoading: false,
          profile: profile ? { ...profile, status_plano: statusPlano as StatusPlano } : null,
          userEmail: user.email || null,
        });
      } catch (error) {
        console.error('Error in useUserRole:', error);
        setState({ 
          role: null, 
          isAdmin: false, 
          isActive: false,
          canCreate: false,
          isLoading: false,
          profile: null,
          userEmail: null,
        });
      }
    };

    fetchRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
