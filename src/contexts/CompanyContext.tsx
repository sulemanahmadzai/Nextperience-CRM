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
    try {
      if (!user) {
        setCompanies([]);
        setCurrentCompany(null);
        setUserRole(null);
        setPermissions(null);
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('has_all_access')
        .eq('id', user.id)
        .maybeSingle();

      const userHasAllAccess = userData?.has_all_access || false;
      setHasAllAccess(userHasAllAccess);

      let companyList: Company[] = [];

      if (userHasAllAccess) {
        const { data: allCompanies, error: companiesError } = await supabase
          .from('companies')
          .select('*')
          .eq('is_active', true)
          .order('name');

        console.log('Loading companies for all access user:', {
          allCompanies,
          companiesError,
          userHasAllAccess,
          allCompaniesType: typeof allCompanies,
          allCompaniesIsArray: Array.isArray(allCompanies),
          allCompaniesLength: allCompanies?.length
        });

        if (companiesError) {
          console.error('Error loading companies:', companiesError);
        }

        if (allCompanies && Array.isArray(allCompanies)) {
          companyList = allCompanies;
        }
      } else {
        const { data: userCompanyRoles } = await supabase
          .from('user_company_roles')
          .select('company_id, companies(*)')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (userCompanyRoles) {
          companyList = userCompanyRoles
            .map((ucr: any) => ucr.companies)
            .filter(Boolean);
        }
      }

      console.log('Final company list being set:', companyList);
      setCompanies(companyList);

      if (companyList.length > 0) {
        const savedCompanyId = localStorage.getItem('currentCompanyId');
        const companyToSet = savedCompanyId
          ? companyList.find((c: Company) => c.id === savedCompanyId) || companyList[0]
          : companyList[0];

        if (companyToSet) {
          await loadUserRoleForCompany(companyToSet, userHasAllAccess);
        }
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserRoleForCompany = async (company: Company, hasAllAccess: boolean = false) => {
    if (!user) return;

    setCurrentCompany(company);
    localStorage.setItem('currentCompanyId', company.id);

    if (hasAllAccess) {
      setPermissions(getAllAccessPermissions());
      const { data: ucr } = await supabase
        .from('user_company_roles')
        .select('*, roles(*)')
        .eq('user_id', user.id)
        .eq('company_id', company.id)
        .eq('is_active', true)
        .maybeSingle();
      setUserRole(ucr || null);
      return;
    }

    const { data: ucr } = await supabase
      .from('user_company_roles')
      .select('*, roles(*)')
      .eq('user_id', user.id)
      .eq('company_id', company.id)
      .eq('is_active', true)
      .maybeSingle();

    if (ucr) {
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
    } else {
      setUserRole(null);
      setPermissions(null);
    }
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
    loadCompanies();
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
