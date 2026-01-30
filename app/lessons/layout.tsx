import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Navigation from '@/components/Navigation';
import ProfileCheckWrapper from '@/components/ProfileCheckWrapper';

export default async function LessonsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Check if admin
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single();

  const isAdmin = !!admin;
  const role = isAdmin ? 'admin' : 'student';

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navigation 
        role={role} 
        userEmail={user.email} 
        userName={profile?.full_name}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isAdmin ? (
          children
        ) : (
          <ProfileCheckWrapper userEmail={user.email || ''}>
            {children}
          </ProfileCheckWrapper>
        )}
      </main>
    </div>
  );
}
