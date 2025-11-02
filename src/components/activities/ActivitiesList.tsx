import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import type { Activity } from '../../lib/database.types';
import { Plus, Calendar, Phone, Mail, Users as MeetingIcon, FileText, CheckSquare, Check } from 'lucide-react';

export function ActivitiesList() {
  const { currentCompany, permissions } = useCompany();
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  useEffect(() => {
    if (currentCompany) {
      loadActivities();
    }
  }, [currentCompany]);

  const loadActivities = async () => {
    if (!currentCompany) return;

    setLoading(true);
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('created_at', { ascending: false });

    if (data) {
      setActivities(data);
    }
    setLoading(false);
  };

  const toggleComplete = async (activity: Activity) => {
    if (!permissions?.activities.update) return;

    const { error } = await supabase
      .from('activities')
      .update({ completed: !activity.completed })
      .eq('id', activity.id);

    if (!error) {
      await supabase.from('audit_logs').insert({
        company_id: currentCompany!.id,
        entity_type: 'activity',
        entity_id: activity.id,
        action: 'update',
        changed_fields: { completed: { old: activity.completed, new: !activity.completed } },
        user_id: user!.id
      });

      loadActivities();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'call': return Phone;
      case 'email': return Mail;
      case 'meeting': return MeetingIcon;
      case 'note': return FileText;
      case 'task': return CheckSquare;
      default: return FileText;
    }
  };

  const filteredActivities = activities.filter(activity => {
    if (filter === 'pending') return !activity.completed;
    if (filter === 'completed') return activity.completed;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-600">Loading activities...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Activities</h1>
        {permissions?.activities.create && (
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
            <Plus className="w-4 h-4" />
            Add Activity
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        {['all', 'pending', 'completed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === f
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredActivities.map((activity) => {
          const Icon = getIcon(activity.type);

          return (
            <div
              key={activity.id}
              className={`bg-white rounded-lg border p-4 transition-all ${
                activity.completed
                  ? 'border-green-200 bg-green-50'
                  : 'border-slate-200 hover:shadow-md'
              }`}
            >
              <div className="flex items-start gap-4">
                {permissions?.activities.update && (
                  <button
                    onClick={() => toggleComplete(activity)}
                    className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      activity.completed
                        ? 'bg-green-600 border-green-600'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {activity.completed && <Check className="w-3 h-3 text-white" />}
                  </button>
                )}

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="w-5 h-5 text-slate-600" />
                    <h3 className={`font-medium ${
                      activity.completed ? 'text-slate-600 line-through' : 'text-slate-900'
                    }`}>
                      {activity.title}
                    </h3>
                    <span className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded">
                      {activity.type}
                    </span>
                  </div>

                  {activity.description && (
                    <p className="text-sm text-slate-600 mb-2">{activity.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    {activity.due_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Due: {new Date(activity.due_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    <span>Created: {new Date(activity.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredActivities.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-600">No activities found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
