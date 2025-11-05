import { supabase } from './supabase';

const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001'; // The Nextperience Group
const VIEWER_ROLE_ID = '10000000-0000-0000-0000-000000000004'; // Viewer role

/**
 * Assigns the current user to the default company with Viewer role
 * Uses the SECURITY DEFINER function to bypass RLS
 */
export async function assignCurrentUserToDefaultCompany(): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {
        success: false,
        error: 'No authenticated user found'
      };
    }

    console.log('[assignUserToCompany] Assigning user to default company:', {
      userId: user.id,
      userEmail: user.email,
      companyId: DEFAULT_COMPANY_ID,
      roleId: VIEWER_ROLE_ID
    });

    const { data, error } = await supabase.rpc('assign_user_to_company_role', {
      p_user_id: user.id,
      p_company_id: DEFAULT_COMPANY_ID,
      p_role_id: VIEWER_ROLE_ID
    });

    if (error) {
      console.error('[assignUserToCompany] RPC error:', error);
      return {
        success: false,
        error: error.message || 'Failed to assign user to company'
      };
    }

    console.log('[assignUserToCompany] Success:', data);
    return {
      success: true,
      message: 'Successfully assigned to company. Please refresh the page.'
    };
  } catch (error) {
    console.error('[assignUserToCompany] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

