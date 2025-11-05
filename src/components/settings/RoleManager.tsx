import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useCompany } from "../../contexts/CompanyContext";
import type { Role } from "../../lib/database.types";

type Assignment = {
  id: string;
  user_id: string;
  company_id: string;
  role_id: string | null;
  is_active: boolean;
  user_email: string | null;
  user_full_name: string | null;
};

//

export function RoleManager() {
  const { companies, currentCompany, hasAllAccess } = useCompany();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    currentCompany?.id || null
  );
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  //
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedCompanyId(currentCompany?.id || null);
  }, [currentCompany?.id]);

  useEffect(() => {
    if (!selectedCompanyId) return;
    loadData(selectedCompanyId);
  }, [selectedCompanyId]);

  const canManage = hasAllAccess;

  const loadData = async (companyId: string) => {
    setLoading(true);
    const [{ data: rolesData }, { data: assignmentsData }] = await Promise.all([
      supabase
        .from("roles")
        .select("*")
        .eq("company_id", companyId)
        .order("name"),
      supabase
        .from("user_company_roles_with_users")
        .select("*")
        .eq("company_id", companyId)
        .order("user_full_name"),
    ]);

    setRoles(rolesData || []);
    setAssignments((assignmentsData as Assignment[]) || []);
    setLoading(false);
  };

  const onChangeRole = async (assignmentId: string, nextRoleId: string) => {
    setSavingId(assignmentId);
    const { error } = await (supabase.from("user_company_roles") as any)
      .update({ role_id: nextRoleId })
      .eq("id", assignmentId);

    if (!error && selectedCompanyId) {
      await loadData(selectedCompanyId);
    }
    setSavingId(null);
  };

  if (!selectedCompanyId) {
    return (
      <div className="text-slate-600">
        Select a company to manage user roles.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-slate-600">Loading user role assignments...</div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-700">Company</label>
          <select
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
            value={selectedCompanyId || ""}
            onChange={(e) => setSelectedCompanyId(e.target.value || null)}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">
            User role assignments
          </h3>
          <p className="text-slate-600 text-sm mt-1">
            Assign a role to each user for the selected company.
          </p>
        </div>

        <div className="p-6 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-sm font-medium text-slate-700 pb-3">
                  User
                </th>
                <th className="text-left text-sm font-medium text-slate-700 pb-3">
                  Email
                </th>
                <th className="text-left text-sm font-medium text-slate-700 pb-3">
                  Role
                </th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const fullName = a.user_full_name || "(No name)";
                const email = a.user_email || "";
                return (
                  <tr key={a.id} className="border-t border-slate-200">
                    <td className="py-3 text-sm text-slate-900">{fullName}</td>
                    <td className="py-3 text-sm text-slate-600">{email}</td>
                    <td className="py-3 text-sm">
                      <select
                        disabled={!canManage || savingId === a.id}
                        className="px-3 py-2 border border-slate-300 rounded-lg bg-white min-w-[220px]"
                        value={a.role_id || ""}
                        onChange={(e) => onChangeRole(a.id, e.target.value)}
                      >
                        <option value="" disabled>
                          Select role…
                        </option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}

              {assignments.length === 0 && (
                <tr>
                  <td className="py-6 text-sm text-slate-600" colSpan={3}>
                    No users assigned to this company.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
