import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import type { UserCompanyRole, Role } from '../../lib/database.types';
import { Mail, Shield, Edit2, UserPlus, X, Check } from 'lucide-react';

export function UserManager() {
  const { currentCompany } = useCompany();
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRoleId, setNewUserRoleId] = useState('');
  const [addingUser, setAddingUser] = useState(false);

  useEffect(() => {
    if (currentCompany) {
      loadData();
    }
  }, [currentCompany]);

  const loadData = async () => {
    if (!currentCompany) return;

    setLoading(true);

    const [rolesRes, userRolesRes] = await Promise.all([
      supabase
        .from('roles')
        .select('*')
        .eq('company_id', currentCompany.id),
      supabase
        .from('user_company_roles_with_users')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
    ]);

    if (rolesRes.data) setRoles(rolesRes.data);
    if (userRolesRes.data) setUserRoles(userRolesRes.data);

    setLoading(false);
  };

  const handleUpdateRole = async (userCompanyRoleId: string, newRoleId: string) => {
    const { error } = await supabase
      .from('user_company_roles')
      .update({ role_id: newRoleId })
      .eq('id', userCompanyRoleId);

    if (!error) {
      await loadData();
      setEditingUserId(null);
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserRoleId || !currentCompany) return;

    setAddingUser(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          companyId: currentCompany.id,
          roleId: newUserRoleId,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        await loadData();
        setShowAddUser(false);
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserRoleId('');
      } else {
        alert(`Error: ${result.error || 'Failed to create user'}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setAddingUser(false);
    }
  };

  if (loading) {
    return <div className="text-slate-600">Loading users...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-slate-600">
          Manage user access and roles for this company. Users can be assigned different roles and have per-user permission overrides.
        </p>
        <button
          onClick={() => setShowAddUser(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {showAddUser && (
        <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-900">Add New User</h3>
            <button
              onClick={() => {
                setShowAddUser(false);
                setNewUserEmail('');
                setNewUserPassword('');
                setNewUserRoleId('');
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="email"
              placeholder="Email address"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            />
            <input
              type="password"
              placeholder="Password"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            />
            <select
              value={newUserRoleId}
              onChange={(e) => setNewUserRoleId(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="">Select Role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddUser}
              disabled={!newUserEmail || !newUserPassword || !newUserRoleId || addingUser}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingUser ? 'Adding...' : 'Add User'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left text-sm font-medium text-slate-700 px-6 py-3">User</th>
              <th className="text-left text-sm font-medium text-slate-700 px-6 py-3">Role</th>
              <th className="text-left text-sm font-medium text-slate-700 px-6 py-3">Status</th>
              <th className="text-left text-sm font-medium text-slate-700 px-6 py-3">Joined</th>
              <th className="text-left text-sm font-medium text-slate-700 px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {userRoles.map((ucr: any) => {
              const isEditing = editingUserId === ucr.id;

              return (
                <tr key={ucr.id} className="border-b border-slate-200">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                        <Mail className="w-4 h-4 text-slate-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">{ucr.user_email || 'Unknown'}</div>
                        {ucr.user_full_name && (
                          <div className="text-xs text-slate-500">{ucr.user_full_name}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <select
                        value={selectedRoleId}
                        onChange={(e) => setSelectedRoleId(e.target.value)}
                        className="px-3 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-slate-600" />
                        <span className="text-sm text-slate-900">{ucr.role_name || 'No Role'}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded ${
                      ucr.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {ucr.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">
                      {new Date(ucr.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateRole(ucr.id, selectedRoleId)}
                          className="p-1 text-green-600 hover:text-green-700"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingUserId(null)}
                          className="p-1 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingUserId(ucr.id);
                          setSelectedRoleId(ucr.role_id);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {userRoles.length === 0 && (
          <div className="text-center py-12 text-slate-600">
            No users assigned to this company yet.
          </div>
        )}
      </div>
    </div>
  );
}
