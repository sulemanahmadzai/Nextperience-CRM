import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface User {
  id: string;
  email: string;
  full_name: string;
  has_all_access: boolean;
}

interface UserAccess {
  user_id: string;
  role_id: string | null;
  role_name: string | null;
}

interface Role {
  id: string;
  name: string;
}

interface ManageUserAccessModalProps {
  companyId: string;
  companyName: string;
  onClose: () => void;
}

export default function ManageUserAccessModal({
  companyId,
  companyName,
  onClose,
}: ManageUserAccessModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [userAccess, setUserAccess] = useState<Map<string, UserAccess>>(new Map());
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    setLoading(true);

    const [usersResult, rolesResult, accessResult] = await Promise.all([
      supabase
        .from('users')
        .select('id, email, full_name, has_all_access')
        .eq('is_active', true)
        .order('email'),
      supabase.from('roles').select('id, name').is('company_id', null).order('name'),
      supabase
        .from('user_company_roles')
        .select('user_id, role_id, roles(name)')
        .eq('company_id', companyId),
    ]);

    if (usersResult.data) setUsers(usersResult.data);
    if (rolesResult.data) setRoles(rolesResult.data);

    if (accessResult.data) {
      const accessMap = new Map<string, UserAccess>();
      accessResult.data.forEach((item: any) => {
        accessMap.set(item.user_id, {
          user_id: item.user_id,
          role_id: item.role_id,
          role_name: item.roles?.name || null,
        });
      });
      setUserAccess(accessMap);
    }

    setLoading(false);
  };

  const handleAccessChange = (userId: string, roleId: string | null) => {
    const newAccess = new Map(userAccess);
    if (roleId === null) {
      newAccess.delete(userId);
    } else {
      const role = roles.find((r) => r.id === roleId);
      newAccess.set(userId, {
        user_id: userId,
        role_id: roleId,
        role_name: role?.name || null,
      });
    }
    setUserAccess(newAccess);
  };

  const handleGrantAllAccess = async (userId: string) => {
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ has_all_access: true })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating user:', updateError);
        throw new Error(`Failed to update user: ${updateError.message}`);
      }

      const adminRole = roles.find(r => r.name === 'Admin');
      if (adminRole) {
        const { error: upsertError } = await supabase.from('user_company_roles').upsert({
          user_id: userId,
          company_id: companyId,
          role_id: adminRole.id,
          is_active: true,
        }, {
          onConflict: 'user_id,company_id',
        });

        if (upsertError) {
          console.error('Error adding user to company:', upsertError);
          throw new Error(`Failed to add user to company: ${upsertError.message}`);
        }
      }

      alert('All access granted successfully!');
      await loadData();
    } catch (error: any) {
      console.error('Error granting all access:', error);
      alert(error.message || 'Failed to grant all access. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const existingAccess = await supabase
        .from('user_company_roles')
        .select('user_id, role_id')
        .eq('company_id', companyId);

      if (existingAccess.error) {
        console.error('Error fetching existing access:', existingAccess.error);
        throw new Error('Failed to fetch existing access');
      }

      const existingMap = new Map(
        existingAccess.data?.map((item) => [item.user_id, item.role_id]) || []
      );

      const toDelete: string[] = [];
      const toUpsert: { user_id: string; company_id: string; role_id: string; is_active: boolean }[] = [];

      existingMap.forEach((roleId, userId) => {
        if (!userAccess.has(userId)) {
          toDelete.push(userId);
        }
      });

      userAccess.forEach((access, userId) => {
        if (access.role_id) {
          toUpsert.push({
            user_id: userId,
            company_id: companyId,
            role_id: access.role_id,
            is_active: true,
          });
        }
      });

      if (toDelete.length > 0) {
        const deleteResult = await supabase
          .from('user_company_roles')
          .delete()
          .eq('company_id', companyId)
          .in('user_id', toDelete);

        if (deleteResult.error) {
          console.error('Error deleting user access:', deleteResult.error);
          throw new Error(`Failed to remove access: ${deleteResult.error.message}`);
        }
      }

      if (toUpsert.length > 0) {
        const upsertResult = await supabase.from('user_company_roles').upsert(toUpsert, {
          onConflict: 'user_id,company_id',
        });

        if (upsertResult.error) {
          console.error('Error upserting user access:', upsertResult.error);
          throw new Error(`Failed to save access: ${upsertResult.error.message}`);
        }
      }

      alert('User access updated successfully!');
      onClose();
    } catch (error: any) {
      console.error('Error saving user access:', error);
      alert(error.message || 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const usersWithAllAccess = users.filter((u) => u.has_all_access);
  const usersWithSpecificAccess = users.filter((u) => !u.has_all_access);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="text-slate-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Manage User Access</h2>
            <p className="text-sm text-slate-600 mt-1">{companyName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            disabled={saving}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {usersWithAllAccess.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Access to All Business Units
              </h3>
              <div className="space-y-2">
                {usersWithAllAccess.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-slate-900">{user.email}</div>
                      {user.full_name && (
                        <div className="text-sm text-slate-600">{user.full_name}</div>
                      )}
                      <div className="text-xs text-purple-600 font-medium mt-1">
                        Has access to all
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
                      All Access
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              {companyName} - Specific Access
            </h3>
            <div className="space-y-2">
              {usersWithSpecificAccess.map((user) => {
                const access = userAccess.get(user.id);
                const hasAccess = !!access?.role_id;

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{user.email}</div>
                      {user.full_name && (
                        <div className="text-sm text-slate-600">{user.full_name}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <select
                        value={access?.role_id || ''}
                        onChange={(e) =>
                          handleAccessChange(user.id, e.target.value || null)
                        }
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={saving}
                      >
                        <option value="">No Access</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                      {!hasAccess && (
                        <button
                          onClick={() => handleGrantAllAccess(user.id)}
                          className="px-3 py-1.5 text-xs text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50"
                          disabled={saving}
                        >
                          Grant All Access
                        </button>
                      )}
                      {hasAccess && (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-sm font-medium rounded-full">
                          Has Access
                        </span>
                      )}
                      {!hasAccess && (
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 text-sm font-medium rounded-full">
                          No Access
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
