import { createAdminClient } from '@/lib/supabase/admin';
import { getPrimaryAdminEmail } from '@/lib/utils';

// Resolve the users.id of the primary teacher/admin — the owner of the
// availability + day-block schedule that student bookings are checked against.
// Mirrors the admin-assignment logic in POST /api/lessons (PRIMARY_ADMIN_EMAIL,
// falling back to the first admin) so the availability owner matches the admin a
// booked lesson is assigned to. Uses the service-role client so the lookup is not
// limited by the caller's RLS scope.
export async function getPrimaryAdminUserId(): Promise<string | null> {
  const admin = createAdminClient();

  const primaryAdminEmail = getPrimaryAdminEmail();
  if (primaryAdminEmail) {
    const { data } = await admin
      .from('users')
      .select('id')
      .eq('email', primaryAdminEmail)
      .single();
    if (data?.id) return data.id;
  }

  const { data: admins } = await admin.from('admins').select('email').limit(1);
  if (admins && admins.length > 0) {
    const { data } = await admin
      .from('users')
      .select('id')
      .eq('email', admins[0].email)
      .single();
    return data?.id ?? null;
  }

  return null;
}
