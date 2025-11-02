import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { email, password, fullName, hasAllAccess, companyRoles } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!hasAllAccess && (!companyRoles || companyRoles.length === 0)) {
      return new Response(
        JSON.stringify({ error: 'Must select at least one business unit or enable all access' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : {},
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { error: userInsertError } = await supabaseClient
      .from('users')
      .upsert({
        id: newUser.user.id,
        email: newUser.user.email,
        full_name: fullName || null,
        has_all_access: hasAllAccess || false,
        is_active: true,
      }, {
        onConflict: 'id'
      });

    if (userInsertError) {
      console.error('Error inserting user:', userInsertError);
      return new Response(
        JSON.stringify({ error: userInsertError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (hasAllAccess) {
      const { data: allCompanies } = await supabaseClient
        .from('companies')
        .select('id')
        .eq('is_active', true);

      if (allCompanies && allCompanies.length > 0) {
        const { data: adminRole } = await supabaseClient
          .from('roles')
          .select('id')
          .eq('name', 'Admin')
          .is('company_id', null)
          .maybeSingle();

        if (adminRole) {
          const userCompanyRoles = allCompanies.map(company => ({
            user_id: newUser.user.id,
            company_id: company.id,
            role_id: adminRole.id,
            is_active: true,
          }));

          const { error: roleError } = await supabaseClient
            .from('user_company_roles')
            .insert(userCompanyRoles);

          if (roleError) {
            return new Response(
              JSON.stringify({ error: roleError.message }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
        }
      }
    } else if (companyRoles && companyRoles.length > 0) {
      const userCompanyRoles = companyRoles.map((cr: { companyId: string, roleId: string }) => ({
        user_id: newUser.user.id,
        company_id: cr.companyId,
        role_id: cr.roleId,
        is_active: true,
      }));

      const { error: roleError } = await supabaseClient
        .from('user_company_roles')
        .insert(userCompanyRoles);

      if (roleError) {
        return new Response(
          JSON.stringify({ error: roleError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, user: newUser.user }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});