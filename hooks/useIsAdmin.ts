import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export function useIsAdmin(userId: string | null | undefined): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!userId) {
      setIsAdmin(false);
      return () => {
        mounted = false;
      };
    }

    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .maybeSingle();

      const profile = data as { is_admin?: boolean } | null;
      if (mounted) setIsAdmin(!error && Boolean(profile?.is_admin));
    })().catch(() => {
      if (mounted) setIsAdmin(false);
    });

    return () => {
      mounted = false;
    };
  }, [userId]);

  return isAdmin;
}
