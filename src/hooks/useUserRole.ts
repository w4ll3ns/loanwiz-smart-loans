import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'user';

interface UserRoleState {
  role: AppRole | null;
  isAdmin: boolean;
  isLoading: boolean;
}

export function useUserRole(): UserRoleState {
  const [state, setState] = useState<UserRoleState>({
    role: null,
    isAdmin: false,
    isLoading: true,
  });

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setState({ role: null, isAdmin: false, isLoading: false });
          return;
        }

        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          setState({ role: 'user', isAdmin: false, isLoading: false });
          return;
        }

        const role = data?.role as AppRole;
        setState({
          role,
          isAdmin: role === 'admin',
          isLoading: false,
        });
      } catch (error) {
        console.error('Error in useUserRole:', error);
        setState({ role: null, isAdmin: false, isLoading: false });
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
