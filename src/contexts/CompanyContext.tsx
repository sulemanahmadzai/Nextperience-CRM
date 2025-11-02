import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Company, UserCompanyRole, Role, Permissions } from '../lib/database.types';

interface CompanyContextType {
  currentCompany: Company | null;
  companies: Company[];
  userRole: UserCompanyRole | null;
  permissions: Permissions | null;
  hasAllAccess: boolean;
  loading: boolean;
  switchCompany: (companyId: string) => void;
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [userRole, setUserRole] = useState<UserCompanyRole | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [hasAllAccess, setHasAllAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadCompanies = async () => {
    console.log('[CompanyContext] ===== START loadCompanies =====');
    setLoading(true);
    try {
      if (!user) {
        console.log('[CompanyContext] No user found, clearing company data');
        setCompanies([]);
        setCurrentCompany(null);
        setUserRole(null);
        setPermissions(null);
        setLoading(false);
        return;
      }

      console.log('[CompanyContext] User found:', {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      });

      console.log('[CompanyContext] Querying users table for has_all_access...');
      const { data: userData, error: userDataError } = await supabase
        .from('users')
        .select('has_all_access, is_active, email, full_name')
        .eq('id', user.id)
        .maybeSingle();

      console.log('[CompanyContext] Users table query result:', {
        userData,
        userDataError,
        hasError: !!userDataError,
        errorMessage: userDataError?.message,
        errorDetails: userDataError
      });

      if (userDataError) {
        console.error('[CompanyContext] ERROR fetching user data:', userDataError);
      }

      const userHasAllAccess = userData?.has_all_access || false;
      const userIsActive = userData?.is_active ?? true;
      
      console.log('[CompanyContext] User status:', {
        hasAllAccess: userHasAllAccess,
        isActive: userIsActive,
        userDataComplete: userData
      });

      setHasAllAccess(userHasAllAccess);

      let companyList: Company[] = [];

      if (userHasAllAccess) {
        console.log('[CompanyContext] User has ALL ACCESS - querying all companies...');
        const { data: allCompanies, error: companiesError } = await supabase
          .from('companies')
          .select('*')
          .eq('is_active', true)
          .order('name');

        console.log('[CompanyContext] ALL ACCESS - Companies query result:', {
          allCompanies,
          companiesError,
          userHasAllAccess,
          allCompaniesType: typeof allCompanies,
          allCompaniesIsArray: Array.isArray(allCompanies),
          allCompaniesLength: allCompanies?.length,
          hasError: !!companiesError,
          errorCode: companiesError?.code,
          errorMessage: companiesError?.message,
          errorDetails: companiesError,
          companiesData: allCompanies ? JSON.stringify(allCompanies, null, 2) : null
        });

        if (companiesError) {
          console.error('[CompanyContext] ERROR loading companies for all-access user:', companiesError);
          console.error('[CompanyContext] Error details:', JSON.stringify(companiesError, null, 2));
        }

        if (allCompanies && Array.isArray(allCompanies)) {
          companyList = allCompanies;
          console.log('[CompanyContext] ALL ACCESS - Successfully loaded companies:', companyList.length);
        } else {
          console.warn('[CompanyContext] ALL ACCESS - No companies returned or invalid format');
        }
      } else {
        console.log('[CompanyContext] REGULAR USER - Querying user_company_roles...');
        // First, get the user's company assignments
        const { data: userCompanyRoles, error: userCompanyRolesError } = await supabase
          .from('user_company_roles')
          .select('company_id, role_id, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true);

        console.log('[CompanyContext] REGULAR USER - user_company_roles query result:', {
          userCompanyRoles,
          userCompanyRolesError,
          userId: user.id,
          userCompanyRolesType: typeof userCompanyRoles,
          userCompanyRolesIsArray: Array.isArray(userCompanyRoles),
          userCompanyRolesLength: userCompanyRoles?.length,
          hasError: !!userCompanyRolesError,
          errorCode: userCompanyRolesError?.code,
          errorMessage: userCompanyRolesError?.message,
          errorDetails: userCompanyRolesError,
          rawData: userCompanyRoles ? JSON.stringify(userCompanyRoles, null, 2) : null
        });

        if (userCompanyRolesError) {
          console.error('[CompanyContext] ERROR loading user company roles:', userCompanyRolesError);
          console.error('[CompanyContext] Error details:', JSON.stringify(userCompanyRolesError, null, 2));
        }

        // If we have company IDs, fetch the companies separately
        if (userCompanyRoles && userCompanyRoles.length > 0) {
          const companyIds = userCompanyRoles
            .map((ucr: any) => ucr.company_id)
            .filter(Boolean);

          console.log('[CompanyContext] REGULAR USER - Extracted company IDs:', companyIds);
          console.log('[CompanyContext] REGULAR USER - Fetching companies for these IDs...');

          const { data: companiesData, error: companiesError } = await supabase
            .from('companies')
            .select('*')
            .in('id', companyIds)
            .eq('is_active', true)
            .order('name');

          console.log('[CompanyContext] REGULAR USER - Companies query result:', {
            companiesData,
            companiesError,
            companyIdsQueried: companyIds,
            companiesType: typeof companiesData,
            companiesIsArray: Array.isArray(companiesData),
            companiesLength: companiesData?.length,
            hasError: !!companiesError,
            errorCode: companiesError?.code,
            errorMessage: companiesError?.message,
            errorDetails: companiesError,
            companiesDataRaw: companiesData ? JSON.stringify(companiesData, null, 2) : null
          });

          if (companiesError) {
            console.error('[CompanyContext] ERROR loading companies for regular user:', companiesError);
            console.error('[CompanyContext] Error details:', JSON.stringify(companiesError, null, 2));
          } else {
            if (companiesData && Array.isArray(companiesData)) {
              companyList = companiesData;
              console.log('[CompanyContext] REGULAR USER - Successfully loaded companies:', companyList.length);
            } else {
              console.warn('[CompanyContext] REGULAR USER - Companies data is not an array or is null');
            }
          }
        } else {
          console.warn('[CompanyContext] REGULAR USER - User has no company role assignments');
          console.warn('[CompanyContext] This means the user is not assigned to any company');
          console.warn('[CompanyContext] User ID:', user.id);
          console.warn('[CompanyContext] User email:', user.email);
        }
      }

      console.log('[CompanyContext] Final company list being set:', {
        companyList,
        count: companyList.length,
        companyIds: companyList.map(c => c.id),
        companyNames: companyList.map(c => c.name)
      });
      setCompanies(companyList);

      if (companyList.length > 0) {
        const savedCompanyId = localStorage.getItem('currentCompanyId');
        console.log('[CompanyContext] Setting current company, savedCompanyId:', savedCompanyId);
        
        const companyToSet = savedCompanyId
          ? companyList.find((c: Company) => c.id === savedCompanyId) || companyList[0]
          : companyList[0];

        console.log('[CompanyContext] Company to set:', {
          companyToSet,
          id: companyToSet?.id,
          name: companyToSet?.name
        });

        if (companyToSet) {
          console.log('[CompanyContext] Loading user role for company...');
          await loadUserRoleForCompany(companyToSet, userHasAllAccess);
        }
      } else {
        console.warn('[CompanyContext] ===== NO COMPANIES FOUND =====');
        console.warn('[CompanyContext] This will trigger "No company access" message');
        console.warn('[CompanyContext] User details:', {
          userId: user.id,
          userEmail: user.email,
          hasAllAccess: userHasAllAccess
        });
      }
      
      console.log('[CompanyContext] ===== END loadCompanies =====');
    } catch (error) {
      console.error('[CompanyContext] ===== EXCEPTION in loadCompanies =====');
      console.error('[CompanyContext] Error:', error);
      console.error('[CompanyContext] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('[CompanyContext] Error details:', JSON.stringify(error, null, 2));
    } finally {
      setLoading(false);
      console.log('[CompanyContext] Loading state set to false');
    }
  };

  const loadUserRoleForCompany = async (company: Company, hasAllAccess: boolean = false) => {
    console.log('[CompanyContext] ===== START loadUserRoleForCompany =====');
    console.log('[CompanyContext] Company:', { id: company.id, name: company.name });
    console.log('[CompanyContext] hasAllAccess:', hasAllAccess);
    
    if (!user) {
      console.warn('[CompanyContext] No user found in loadUserRoleForCompany');
      return;
    }

    console.log('[CompanyContext] Setting current company and saving to localStorage');
    setCurrentCompany(company);
    localStorage.setItem('currentCompanyId', company.id);

    if (hasAllAccess) {
      console.log('[CompanyContext] User has all access - setting permissions');
      setPermissions(getAllAccessPermissions());
      const { data: ucr, error: ucrError } = await supabase
        .from('user_company_roles')
        .select('*, roles(*)')
        .eq('user_id', user.id)
        .eq('company_id', company.id)
        .eq('is_active', true)
        .maybeSingle();
      
      console.log('[CompanyContext] User company role query (all access):', {
        ucr,
        ucrError,
        hasError: !!ucrError
      });
      
      setUserRole(ucr || null);
      console.log('[CompanyContext] ===== END loadUserRoleForCompany (all access) =====');
      return;
    }

    console.log('[CompanyContext] Regular user - querying user_company_roles with roles...');
    const { data: ucr, error: ucrError } = await supabase
      .from('user_company_roles')
      .select('*, roles(*)')
      .eq('user_id', user.id)
      .eq('company_id', company.id)
      .eq('is_active', true)
      .maybeSingle();

    console.log('[CompanyContext] User company role query result:', {
      ucr,
      ucrError,
      hasError: !!ucrError,
      errorDetails: ucrError
    });

    if (ucr) {
      console.log('[CompanyContext] User role found, setting permissions...');
      setUserRole(ucr);
      const role = ucr.roles as unknown as Role;
      const basePermissions = role?.permissions as Permissions || getDefaultPermissions();
      const overrides = ucr.permission_overrides as Partial<Permissions> || {};

      const mergedPermissions = {
        ...basePermissions,
        ...Object.keys(overrides).reduce((acc, module) => {
          acc[module as keyof Permissions] = {
            ...basePermissions[module as keyof Permissions],
            ...(overrides[module as keyof Permissions] || {})
          };
          return acc;
        }, {} as Permissions)
      };

      setPermissions(mergedPermissions);
      console.log('[CompanyContext] Permissions set successfully');
    } else {
      console.warn('[CompanyContext] No user company role found');
      setUserRole(null);
      setPermissions(null);
    }
    
    console.log('[CompanyContext] ===== END loadUserRoleForCompany =====');
  };

  const switchCompany = async (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    if (company && user) {
      const { data: userData } = await supabase
        .from('users')
        .select('has_all_access')
        .eq('id', user.id)
        .maybeSingle();

      const hasAllAccess = userData?.has_all_access || false;
      await loadUserRoleForCompany(company, hasAllAccess);
    }
  };

  useEffect(() => {
    console.log('[CompanyContext] useEffect triggered, user?.id:', user?.id);
    if (user?.id) {
      console.log('[CompanyContext] User ID changed, loading companies...');
      loadCompanies();
    } else {
      console.log('[CompanyContext] No user ID, clearing company data and setting loading to false');
      setCompanies([]);
      setCurrentCompany(null);
      setUserRole(null);
      setPermissions(null);
      setHasAllAccess(false);
      setLoading(false);
    }
  }, [user?.id]);

  const refreshCompanies = async () => {
    await loadCompanies();
  };

  return (
    <CompanyContext.Provider
      value={{
        currentCompany,
        companies,
        userRole,
        permissions,
        hasAllAccess,
        loading,
        switchCompany,
        refreshCompanies
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}

function getDefaultPermissions(): Permissions {
  return {
    customers: { create: false, read: false, update: false, delete: false },
    leads: { create: false, read: false, update: false, delete: false },
    quotations: { create: false, read: false, update: false, delete: false },
    activities: { create: false, read: false, update: false, delete: false },
    products: { create: false, read: false, update: false, delete: false },
    settings: { create: false, read: false, update: false, delete: false }
  };
}

function getAllAccessPermissions(): Permissions {
  return {
    customers: { create: true, read: true, update: true, delete: true },
    leads: { create: true, read: true, update: true, delete: true },
    quotations: { create: true, read: true, update: true, delete: true },
    activities: { create: true, read: true, update: true, delete: true },
    products: { create: true, read: true, update: true, delete: true },
    settings: { create: true, read: true, update: true, delete: true },
    pipeline: { create: true, read: true, update: true, delete: true },
    event_types: { create: true, read: true, update: true, delete: true },
    templates: { create: true, read: true, update: true, delete: true },
    payments: { create: true, read: true, update: true, delete: true }
  };
}
