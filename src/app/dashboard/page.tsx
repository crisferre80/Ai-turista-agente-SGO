"use client";
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function DashboardIndex() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      // Check businesses table first (businesses are separate users stored in `businesses`)
      const { data: businessRow } = await supabase.from('business_profiles').select('id').eq('auth_id', user.id).maybeSingle();
      if (businessRow) return router.push('/dashboard/business');

      // Fallback to profiles table and user metadata
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      const roleFromProfile = profile?.role;
      const roleFromMetadata = user.user_metadata?.role;
      const role = roleFromProfile || roleFromMetadata || 'user';

      console.debug('Dashboard redirect:', { userId: user.id, businessRow, profile, roleFromProfile, roleFromMetadata, role });

      if (role === 'business') return router.push('/dashboard/business');
      if (role === 'admin') router.push('/admin');
      else router.push('/dashboard/tourist');
    })();
  }, [router]);

  return <div style={{ padding: 40 }}>Redirigiendo al dashboard...</div>;
}