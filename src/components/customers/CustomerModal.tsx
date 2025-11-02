import { useState, FormEvent, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import type { Customer, Activity } from '../../lib/database.types';
import { X, Save, Trash2, Plus, Calendar, Phone as PhoneIcon, Mail as MailIcon } from 'lucide-react';

interface CustomerModalProps {
  customer: Customer | null;
  onClose: (shouldRefresh?: boolean) => void;
}

export function CustomerModal({ customer, onClose }: CustomerModalProps) {
  const { currentCompany, permissions } = useCompany();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    company_name: customer?.company_name || '',
    notes: customer?.notes || '',
    tags: customer?.tags.join(', ') || ''
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (customer) {
      loadActivities();
    }
  }, [customer]);

  const loadActivities = async () => {
    if (!customer) return;

    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('related_to_type', 'customer')
      .eq('related_to_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      setActivities(data);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentCompany || !user) return;

    setLoading(true);
    setError('');

    const data = {
      ...formData,
      tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      company_id: currentCompany.id,
      created_by: user.id
    };

    if (customer) {
      const { error: updateError } = await supabase
        .from('customers')
        .update(data)
        .eq('id', customer.id);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      await supabase.from('audit_logs').insert({
        company_id: currentCompany.id,
        entity_type: 'customer',
        entity_id: customer.id,
        action: 'update',
        changed_fields: { updated: true },
        user_id: user.id
      });
    } else {
      const { error: insertError } = await supabase
        .from('customers')
        .insert([data]);

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    onClose(true);
  };

  const handleArchive = async () => {
    if (!customer || !permissions?.customers.delete) return;

    const { error } = await supabase
      .from('customers')
      .update({ is_archived: true })
      .eq('id', customer.id);

    if (!error) {
      await supabase.from('audit_logs').insert({
        company_id: currentCompany!.id,
        entity_type: 'customer',
        entity_id: customer.id,
        action: 'archive',
        changed_fields: {},
        user_id: user!.id
      });

      onClose(true);
    }
  };

  const canEdit = customer ? permissions?.customers.update : permissions?.customers.create;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            {customer ? 'Customer Profile' : 'New Customer'}
          </h2>
          <button
            onClick={() => onClose()}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    required
                    disabled={!canEdit}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    disabled={!canEdit}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    disabled={!canEdit}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    disabled={!canEdit}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    placeholder="VIP, Partner, Enterprise"
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent h-32"
                  disabled={!canEdit}
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                {customer && permissions?.customers.delete && (
                  <button
                    type="button"
                    onClick={handleArchive}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Archive
                  </button>
                )}

                {canEdit && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 ml-auto"
                  >
                    <Save className="w-4 h-4" />
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
            </form>
          </div>

          {customer && (
            <div className="lg:col-span-1">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900">Recent Activities</h3>
                  {permissions?.activities.create && (
                    <button className="p-1 hover:bg-white rounded transition-colors">
                      <Plus className="w-4 h-4 text-slate-600" />
                    </button>
                  )}
                </div>

                {activities.length > 0 ? (
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <div key={activity.id} className="bg-white rounded-lg p-3 border border-slate-200">
                        <div className="flex items-start gap-2">
                          {activity.type === 'call' && <PhoneIcon className="w-4 h-4 text-slate-600 mt-0.5" />}
                          {activity.type === 'email' && <MailIcon className="w-4 h-4 text-slate-600 mt-0.5" />}
                          {activity.type === 'meeting' && <Calendar className="w-4 h-4 text-slate-600 mt-0.5" />}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">{activity.title}</p>
                            <p className="text-xs text-slate-600 mt-1">
                              {new Date(activity.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">No activities yet</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
