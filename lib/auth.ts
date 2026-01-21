import { createClient } from '@/lib/supabase/server';
import type { UserRole, User } from '@/types';

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  
  const { data: { user: authUser } } = await supabase.auth.getUser();
  
  if (!authUser) {
    return null;
  }
  
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();
  
  return user;
}

export async function getUserRole(): Promise<UserRole> {
  const supabase = await createClient();
  
  const { data: { user: authUser } } = await supabase.auth.getUser();
  
  if (!authUser?.email) {
    return null;
  }
  
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', authUser.email)
    .single();
  
  return admin ? 'admin' : 'student';
}

export async function isAdmin(): Promise<boolean> {
  const role = await getUserRole();
  return role === 'admin';
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireAuth();
  const admin = await isAdmin();
  
  if (!admin) {
    throw new Error('Admin access required');
  }
  
  return user;
}

export async function getAuthenticatedUserWithRole(): Promise<{
  user: User | null;
  role: UserRole;
}> {
  const supabase = await createClient();
  
  const { data: { user: authUser } } = await supabase.auth.getUser();
  
  if (!authUser?.email) {
    return { user: null, role: null };
  }
  
  const [{ data: user }, { data: admin }] = await Promise.all([
    supabase.from('users').select('*').eq('id', authUser.id).single(),
    supabase.from('admins').select('id').eq('email', authUser.email).single(),
  ]);
  
  return {
    user,
    role: admin ? 'admin' : 'student',
  };
}
