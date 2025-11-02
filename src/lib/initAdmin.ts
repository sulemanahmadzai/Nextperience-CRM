import { supabase } from './supabase';

const ADMIN_EMAIL = 'kay@thenextperience.com';
const ADMIN_PASSWORD = '@Tng2025';
const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_ROLE_ID = '10000000-0000-0000-0000-000000000001';

export async function ensureAdminExists(): Promise<boolean> {
  try {
    const { data: existingAssignments } = await supabase
      .from('user_company_roles')
      .select('user_id')
      .eq('company_id', COMPANY_ID)
      .eq('role_id', ADMIN_ROLE_ID)
      .limit(1);

    if (existingAssignments && existingAssignments.length > 0) {
      return true;
    }

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        const { data: userData } = await supabase.auth.signInWithPassword({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
        });

        if (userData?.user?.id) {
          await supabase.rpc('assign_user_to_company_role', {
            p_user_id: userData.user.id,
            p_company_id: COMPANY_ID,
            p_role_id: ADMIN_ROLE_ID,
          });

          await supabase.auth.signOut();
        }
        return true;
      }
      console.error('Failed to create admin user:', signUpError);
      return false;
    }

    if (authData?.user?.id) {
      await supabase.rpc('assign_user_to_company_role', {
        p_user_id: authData.user.id,
        p_company_id: COMPANY_ID,
        p_role_id: ADMIN_ROLE_ID,
      });

      await supabase.auth.signOut();
    }

    return true;
  } catch (error) {
    console.error('Error ensuring admin exists:', error);
    return false;
  }
}
