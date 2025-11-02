import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import type { Role, Permissions } from '../../lib/database.types';
import { Check, X, Save, Edit2, Plus } from 'lucide-react';

const MODULES = [
  { key: 'customers', label: 'Customers' },
  { key: 'leads', label: 'Leads' },
  { key: 'activities', label: 'Activities' },
  { key: 'products', label: 'Products' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'event_types', label: 'Event Types' },
  { key: 'quotations', label: 'Quotations' },
  { key: 'payments', label: 'Payment Verification' },
  { key: 'settings', label: 'Settings' }
];

const ACTIONS = ['create', 'read', 'update', 'delete'];

export function RoleManager() {
  const { currentCompany, userRole, hasAllAccess } = useCompany();
  const [roles, setRoles] = useState<Role[]>([]);
  const [editedPermissions, setEditedPermissions] = useState<Record<string, Permissions>>({});
  const [editingRoles, setEditingRoles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [creating, setCreating] = useState(false);

  const roleName = (userRole?.roles as unknown as Role)?.name?.toLowerCase();
  const isAdmin = hasAllAccess || roleName === 'admin';

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('roles')
      .select('*')
      .is('company_id', null)
      .order('name', { ascending: true });

    if (data) {
      setRoles(data);
      const initialPermissions: Record<string, Permissions> = {};
      data.forEach(role => {
        initialPermissions[role.id] = role.permissions as Permissions;
      });
      setEditedPermissions(initialPermissions);
    }
    setLoading(false);
  };

  const togglePermission = (roleId: string, moduleKey: string, action: string) => {
    if (!isAdmin || !editingRoles.has(roleId)) return;

    setEditedPermissions(prev => {
      const rolePerms = { ...prev[roleId] };
      const modulePerms = { ...rolePerms[moduleKey as keyof Permissions] } || {};

      modulePerms[action as keyof typeof modulePerms] = !modulePerms[action as keyof typeof modulePerms];
      rolePerms[moduleKey as keyof Permissions] = modulePerms as any;

      return {
        ...prev,
        [roleId]: rolePerms
      };
    });
  };

  const savePermissions = async (roleId: string) => {
    setSaving(roleId);

    const { error } = await supabase
      .from('roles')
      .update({
        permissions: editedPermissions[roleId],
        updated_at: new Date().toISOString()
      })
      .eq('id', roleId);

    if (!error) {
      setEditingRoles(prev => {
        const next = new Set(prev);
        next.delete(roleId);
        return next;
      });
      await loadRoles();
    } else {
      alert('Error saving permissions: ' + error.message);
    }

    setSaving(null);
  };

  const cancelEdit = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (role) {
      setEditedPermissions(prev => ({
        ...prev,
        [roleId]: role.permissions as Permissions
      }));
    }
    setEditingRoles(prev => {
      const next = new Set(prev);
      next.delete(roleId);
      return next;
    });
  };

  const createRole = async () => {
    if (!newRoleName.trim()) {
      alert('Please enter a role name');
      return;
    }

    setCreating(true);
    try {
      const defaultPermissions: Permissions = {};
      MODULES.forEach(module => {
        defaultPermissions[module.key as keyof Permissions] = {
          create: false,
          read: false,
          update: false,
          delete: false
        } as any;
      });

      const { error } = await supabase
        .from('roles')
        .insert({
          name: newRoleName.trim(),
          company_id: null,
          permissions: defaultPermissions,
          is_system: false
        });

      if (error) {
        alert('Error creating role: ' + error.message);
      } else {
        setShowCreateModal(false);
        setNewRoleName('');
        await loadRoles();
      }
    } catch (error: any) {
      alert('Error creating role: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="text-slate-600">Loading roles...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-slate-600">
          Manage roles and permissions for your organization. {isAdmin ? 'Click on any permission to toggle it.' : 'Only admins can modify permissions.'}
        </p>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            <Plus className="w-4 h-4" />
            Create Role
          </button>
        )}
      </div>

      <div className="space-y-6">
        {roles.map((role) => {
          const permissions = editedPermissions[role.id] || (role.permissions as Permissions);
          const isEditing = editingRoles.has(role.id);
          const isSaving = saving === role.id;

          return (
            <div key={role.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-slate-900">{role.name}</h3>
                    {role.is_system && (
                      <span className="px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded">
                        System Role
                      </span>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => cancelEdit(role.id)}
                            disabled={isSaving}
                            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => savePermissions(role.id)}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-800 disabled:opacity-50"
                          >
                            <Save className="w-4 h-4" />
                            {isSaving ? 'Saving...' : 'Save Changes'}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditingRoles(prev => new Set(prev).add(role.id))}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:border-slate-400"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit Permissions
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left text-sm font-medium text-slate-700 pb-3">Module</th>
                        {ACTIONS.map((action) => (
                          <th key={action} className="text-center text-sm font-medium text-slate-700 pb-3 px-4">
                            {action.charAt(0).toUpperCase() + action.slice(1)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map((module) => {
                        const modulePerms = permissions[module.key as keyof Permissions] || {};

                        return (
                          <tr key={module.key} className="border-t border-slate-200">
                            <td className="py-3 text-sm text-slate-900">{module.label}</td>
                            {ACTIONS.map((action) => {
                              const hasPermission = modulePerms[action as keyof typeof modulePerms];

                              return (
                                <td key={action} className="text-center py-3">
                                  <div className="flex justify-center">
                                    <button
                                      onClick={() => togglePermission(role.id, module.key, action)}
                                      disabled={!isAdmin || !isEditing}
                                      className={`p-1 rounded transition-colors ${
                                        isAdmin && isEditing ? 'hover:bg-slate-100 cursor-pointer' : 'cursor-default'
                                      }`}
                                    >
                                      {hasPermission ? (
                                        <Check className="w-5 h-5 text-green-600" />
                                      ) : (
                                        <X className="w-5 h-5 text-slate-300" />
                                      )}
                                    </button>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Create New Role</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Role Name
              </label>
              <input
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createRole()}
                placeholder="e.g., Accountant, Coordinator"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewRoleName('');
                }}
                disabled={creating}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={createRole}
                disabled={creating || !newRoleName.trim()}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
