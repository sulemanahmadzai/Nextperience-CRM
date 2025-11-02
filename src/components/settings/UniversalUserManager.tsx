import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, UserPlus, X, Shield, Building2, Edit } from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  has_all_access: boolean;
  created_at: string;
}

interface UserCompanyAccess {
  company_name: string;
  role_name: string;
}

export function UniversalUserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [userAccess, setUserAccess] = useState<Map<string, UserCompanyAccess[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [hasAllBUAccess, setHasAllBUAccess] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<{companyId: string, roleId: string}[]>([]);
  const [addingUser, setAddingUser] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    loadData();
    loadCompanies();
    loadRoles();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name, is_active, has_all_access, created_at')
      .order('created_at', { ascending: false });

    if (usersData && !usersError) {
      setUsers(usersData);

      const accessMap = new Map<string, UserCompanyAccess[]>();
      for (const user of usersData) {
        const { data: accessData } = await supabase
          .from('user_company_roles')
          .select('companies(name), roles(name)')
          .eq('user_id', user.id);

        if (accessData) {
          const access = accessData.map((item: any) => ({
            company_name: item.companies?.name || 'Unknown',
            role_name: item.roles?.name || 'Unknown',
          }));
          accessMap.set(user.id, access);
        }
      }
      setUserAccess(accessMap);
    }

    setLoading(false);
  };

  const loadCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (data) setCompanies(data);
  };

  const loadRoles = async () => {
    const { data } = await supabase
      .from('roles')
      .select('id, name')
      .is('company_id', null)
      .order('name');
    if (data) setRoles(data);
  };

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      alert('Please enter email and password');
      return;
    }

    if (!hasAllBUAccess && selectedCompanies.length === 0) {
      alert('Please select at least one business unit or enable "All Business Units" access');
      return;
    }

    if (!hasAllBUAccess && selectedCompanies.some(sc => !sc.roleId)) {
      alert('Please select a role for each business unit');
      return;
    }

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
          fullName: newUserFullName || null,
          hasAllAccess: hasAllBUAccess,
          companyRoles: hasAllBUAccess ? [] : selectedCompanies,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create user');
      }

      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserFullName('');
      setHasAllBUAccess(false);
      setSelectedCompanies([]);
      setShowAddUser(false);
      await loadData();
    } catch (error: any) {
      console.error('Error adding user:', error);
      alert(error.message || 'Failed to add user');
    } finally {
      setAddingUser(false);
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('users')
      .update({ is_active: !currentStatus })
      .eq('id', userId);

    if (!error) {
      await loadData();
    }
  };

  const openEditModal = async (user: User) => {
    setEditingUser(user);

    const userAccessData = userAccess.get(user.id) || [];
    const { data: accessData } = await supabase
      .from('user_company_roles')
      .select('company_id, role_id')
      .eq('user_id', user.id);

    if (accessData) {
      setSelectedCompanies(accessData.map(a => ({ companyId: a.company_id, roleId: a.role_id })));
    }

    setHasAllBUAccess(user.has_all_access);
    setShowEditModal(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    setAddingUser(true);
    try {
      await supabase
        .from('users')
        .update({ has_all_access: hasAllBUAccess })
        .eq('id', editingUser.id);

      await supabase
        .from('user_company_roles')
        .delete()
        .eq('user_id', editingUser.id);

      if (hasAllBUAccess) {
        const { data: allCompanies } = await supabase
          .from('companies')
          .select('id')
          .eq('is_active', true);

        const { data: adminRole } = await supabase
          .from('roles')
          .select('id')
          .eq('name', 'Admin')
          .is('company_id', null)
          .maybeSingle();

        if (allCompanies && adminRole) {
          const userCompanyRoles = allCompanies.map(company => ({
            user_id: editingUser.id,
            company_id: company.id,
            role_id: adminRole.id,
            is_active: true,
          }));

          await supabase
            .from('user_company_roles')
            .insert(userCompanyRoles);
        }
      } else if (selectedCompanies.length > 0) {
        const userCompanyRoles = selectedCompanies.map(sc => ({
          user_id: editingUser.id,
          company_id: sc.companyId,
          role_id: sc.roleId,
          is_active: true,
        }));

        await supabase
          .from('user_company_roles')
          .insert(userCompanyRoles);
      }

      setShowEditModal(false);
      setEditingUser(null);
      setSelectedCompanies([]);
      setHasAllBUAccess(false);
      await loadData();
    } catch (error: any) {
      console.error('Error updating user:', error);
      alert(error.message || 'Failed to update user');
    } finally {
      setAddingUser(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Universal User Management</h2>
          <p className="text-slate-600 mt-1">
            Manage all users across the platform. Assign access per business unit.
          </p>
        </div>
        <button
          onClick={() => setShowAddUser(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {showAddUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Add New User</h3>
              <button
                onClick={() => setShowAddUser(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  value={newUserFullName}
                  onChange={(e) => setNewUserFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              <div className="border-t border-slate-200 pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasAllBUAccess}
                    onChange={(e) => {
                      setHasAllBUAccess(e.target.checked);
                      if (e.target.checked) {
                        setSelectedCompanies([]);
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Grant access to all business units
                  </span>
                </label>
                <p className="text-xs text-slate-500 mt-1 ml-6">
                  User will have admin access to all current and future business units
                </p>
              </div>

              {!hasAllBUAccess && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Business Units & Roles <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-3 max-h-60 overflow-y-auto border border-slate-300 rounded-lg p-3">
                    {companies.map((company) => {
                      const isSelected = selectedCompanies.some(sc => sc.companyId === company.id);
                      const selectedRole = selectedCompanies.find(sc => sc.companyId === company.id)?.roleId || '';

                      return (
                        <div key={company.id} className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCompanies([...selectedCompanies, { companyId: company.id, roleId: '' }]);
                              } else {
                                setSelectedCompanies(selectedCompanies.filter(sc => sc.companyId !== company.id));
                              }
                            }}
                            className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-700 mb-1">{company.name}</div>
                            {isSelected && (
                              <select
                                value={selectedRole}
                                onChange={(e) => {
                                  setSelectedCompanies(selectedCompanies.map(sc =>
                                    sc.companyId === company.id ? { ...sc, roleId: e.target.value } : sc
                                  ));
                                }}
                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="">Select role</option>
                                {roles.map((role) => (
                                  <option key={role.id} value={role.id}>
                                    {role.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowAddUser(false)}
                  className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                  disabled={addingUser}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddUser}
                  disabled={
                    addingUser ||
                    !newUserEmail ||
                    !newUserPassword ||
                    (!hasAllBUAccess && selectedCompanies.length === 0) ||
                    (!hasAllBUAccess && selectedCompanies.some(sc => !sc.roleId))
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {addingUser ? 'Adding...' : 'Add User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Edit User Access</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                  setSelectedCompanies([]);
                  setHasAllBUAccess(false);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="text"
                  value={editingUser.email}
                  disabled
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
                />
              </div>

              <div className="border-t border-slate-200 pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasAllBUAccess}
                    onChange={(e) => {
                      setHasAllBUAccess(e.target.checked);
                      if (e.target.checked) {
                        setSelectedCompanies([]);
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Grant access to all business units
                  </span>
                </label>
                <p className="text-xs text-slate-500 mt-1 ml-6">
                  User will have admin access to all current and future business units
                </p>
              </div>

              {!hasAllBUAccess && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Business Units & Roles <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-3 max-h-60 overflow-y-auto border border-slate-300 rounded-lg p-3">
                    {companies.map((company) => {
                      const isSelected = selectedCompanies.some(sc => sc.companyId === company.id);
                      const selectedRole = selectedCompanies.find(sc => sc.companyId === company.id)?.roleId || '';

                      return (
                        <div key={company.id} className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCompanies([...selectedCompanies, { companyId: company.id, roleId: '' }]);
                              } else {
                                setSelectedCompanies(selectedCompanies.filter(sc => sc.companyId !== company.id));
                              }
                            }}
                            className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-700 mb-1">{company.name}</div>
                            {isSelected && (
                              <select
                                value={selectedRole}
                                onChange={(e) => {
                                  setSelectedCompanies(selectedCompanies.map(sc =>
                                    sc.companyId === company.id ? { ...sc, roleId: e.target.value } : sc
                                  ));
                                }}
                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="">Select role</option>
                                {roles.map((role) => (
                                  <option key={role.id} value={role.id}>
                                    {role.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                    setSelectedCompanies([]);
                    setHasAllBUAccess(false);
                  }}
                  className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                  disabled={addingUser}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateUser}
                  disabled={
                    addingUser ||
                    (!hasAllBUAccess && selectedCompanies.length === 0) ||
                    (!hasAllBUAccess && selectedCompanies.some(sc => !sc.roleId))
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {addingUser ? 'Updating...' : 'Update User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Access Level
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Business Units
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.map((user) => {
              const access = userAccess.get(user.id) || [];
              return (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-full">
                        <Mail className="w-4 h-4 text-slate-600" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{user.email}</div>
                        {user.full_name && (
                          <div className="text-sm text-slate-500">{user.full_name}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.has_all_access ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                        <Shield className="w-3 h-3" />
                        All Access
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full">
                        <Building2 className="w-3 h-3" />
                        Specific Access
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {user.has_all_access ? (
                      <span className="text-sm text-slate-600">All business units</span>
                    ) : access.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {access.map((acc, idx) => (
                          <div key={idx} className="text-sm text-slate-600">
                            <span className="font-medium">{acc.company_name}</span>
                            <span className="text-slate-400"> • {acc.role_name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">No access</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.is_active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        className="text-sm text-slate-600 hover:text-slate-700 font-medium"
                      >
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500">No users found</p>
        </div>
      )}
    </div>
  );
}
