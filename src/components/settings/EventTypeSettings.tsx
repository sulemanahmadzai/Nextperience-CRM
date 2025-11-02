import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { Plus, Edit2, Trash2, X, Check, GripVertical } from 'lucide-react';

type EventType = {
  id: string;
  company_id: string;
  name: string;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function EventTypeSettings() {
  const { currentCompany, permissions } = useCompany();
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [draggedItem, setDraggedItem] = useState<EventType | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const canManage = permissions?.settings?.update || false;

  useEffect(() => {
    if (currentCompany) {
      loadEventTypes();
    }
  }, [currentCompany]);

  const loadEventTypes = async () => {
    if (!currentCompany) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('event_types')
      .select('*')
      .eq('company_id', currentCompany.id)
      .eq('is_active', true)
      .order('order');

    if (data) {
      setEventTypes(data);
    }
    setLoading(false);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAdd = async () => {
    if (!newTypeName.trim() || !currentCompany) return;

    const maxOrder = Math.max(...eventTypes.map(t => t.order), 0);

    const { error } = await supabase
      .from('event_types')
      .insert({
        company_id: currentCompany.id,
        name: newTypeName.trim(),
        order: maxOrder + 1
      });

    if (error) {
      showMessage('error', 'Failed to add event type');
    } else {
      showMessage('success', 'Event type added');
      setNewTypeName('');
      setIsAdding(false);
      await loadEventTypes();
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) return;

    const { error } = await supabase
      .from('event_types')
      .update({
        name: editingName.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      showMessage('error', 'Failed to update event type');
    } else {
      showMessage('success', 'Event type updated');
      setEditingId(null);
      await loadEventTypes();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete event type "${name}"?`)) return;

    const { error } = await supabase
      .from('event_types')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      showMessage('error', 'Failed to delete event type');
    } else {
      showMessage('success', 'Event type deleted');
      await loadEventTypes();
    }
  };

  const handleDragStart = (e: React.DragEvent, item: EventType) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetItem: EventType) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetItem.id) return;

    const reorderedTypes = [...eventTypes];
    const draggedIndex = reorderedTypes.findIndex(t => t.id === draggedItem.id);
    const targetIndex = reorderedTypes.findIndex(t => t.id === targetItem.id);

    reorderedTypes.splice(draggedIndex, 1);
    reorderedTypes.splice(targetIndex, 0, draggedItem);

    const updates = reorderedTypes.map((type, index) => ({
      id: type.id,
      order: index + 1
    }));

    setEventTypes(reorderedTypes);

    for (const update of updates) {
      await supabase
        .from('event_types')
        .update({ order: update.order })
        .eq('id', update.id);
    }

    showMessage('success', 'Event types reordered');
    setDraggedItem(null);
  };

  if (!currentCompany) {
    return <div className="text-slate-600">No company selected</div>;
  }

  if (loading) {
    return <div className="text-slate-600">Loading event types...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Event Types</h3>
          <p className="text-sm text-slate-600 mt-1">
            Manage the event types available in the Lead form
          </p>
        </div>
        {canManage && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Type
          </button>
        )}
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {isAdding && (
        <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewTypeName('');
                }
              }}
              placeholder="Enter event type name..."
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              autoFocus
            />
            <button
              onClick={handleAdd}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            >
              <Check className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewTypeName('');
              }}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {eventTypes.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No event types yet. Add one to get started.
          </div>
        ) : (
          eventTypes.map((type) => (
            <div
              key={type.id}
              draggable={canManage}
              onDragStart={(e) => handleDragStart(e, type)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, type)}
              className={`flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg ${
                canManage ? 'cursor-move hover:bg-slate-50' : ''
              } transition-colors`}
            >
              {canManage && <GripVertical className="w-5 h-5 text-slate-400" />}

              {editingId === type.id ? (
                <>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdate(type.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="flex-1 px-3 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    autoFocus
                  />
                  <button
                    onClick={() => handleUpdate(type.id)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-slate-900">{type.name}</span>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingId(type.id);
                          setEditingName(type.name);
                        }}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(type.id, type.name)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>

      {!canManage && (
        <p className="mt-4 text-sm text-slate-500">
          Only Managers and Admins can add, edit, or delete event types.
        </p>
      )}
    </div>
  );
}
