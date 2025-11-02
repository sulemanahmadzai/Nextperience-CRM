import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import type { PipelineStage } from '../../lib/database.types';
import { Plus, Edit2, Trash2, GripVertical, Check, X } from 'lucide-react';

export function PipelineSettings() {
  const { currentCompany } = useCompany();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editProbability, setEditProbability] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#6b7280');
  const [newStageProbability, setNewStageProbability] = useState(50);

  useEffect(() => {
    if (currentCompany) {
      loadStages();
    }
  }, [currentCompany]);

  const loadStages = async () => {
    if (!currentCompany) return;

    setLoading(true);
    const { data } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('order');

    if (data) setStages(data);
    setLoading(false);
  };

  const handleAddStage = async () => {
    if (!currentCompany || !newStageName.trim()) return;

    const maxOrder = Math.max(...stages.map(s => s.order), -1);

    const { error } = await supabase
      .from('pipeline_stages')
      .insert({
        company_id: currentCompany.id,
        name: newStageName.trim(),
        color: newStageColor,
        order: maxOrder + 1,
        probability: newStageProbability,
        is_default: false
      });

    if (!error) {
      await loadStages();
      setNewStageName('');
      setNewStageColor('#6b7280');
      setNewStageProbability(50);
      setShowAddForm(false);
    }
  };

  const handleUpdateStage = async (id: string) => {
    const { error } = await supabase
      .from('pipeline_stages')
      .update({
        name: editName,
        color: editColor,
        probability: editProbability,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (!error) {
      await loadStages();
      setEditingId(null);
    }
  };

  const handleDeleteStage = async (id: string) => {
    const stage = stages.find(s => s.id === id);

    const { data: leadsInStage } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('stage_id', id);

    const leadsCount = leadsInStage ? 1 : 0;

    if (leadsCount > 0) {
      if (!confirm(`This stage has ${leadsCount} lead(s). Are you sure you want to delete it? Leads will need to be reassigned.`)) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to delete the "${stage?.name}" stage?`)) {
        return;
      }
    }

    const { error } = await supabase
      .from('pipeline_stages')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error deleting stage: ' + error.message);
    } else {
      await loadStages();
    }
  };

  const handleReorder = async (id: string, direction: 'up' | 'down') => {
    const index = stages.findIndex(s => s.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === stages.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newStages = [...stages];
    [newStages[index], newStages[newIndex]] = [newStages[newIndex], newStages[index]];

    const updates = newStages.map((stage, idx) => ({
      id: stage.id,
      order: idx,
      updated_at: new Date().toISOString()
    }));

    for (const update of updates) {
      await supabase
        .from('pipeline_stages')
        .update({ order: update.order, updated_at: update.updated_at })
        .eq('id', update.id);
    }

    await loadStages();
  };

  const startEdit = (stage: PipelineStage) => {
    setEditingId(stage.id);
    setEditName(stage.name);
    setEditColor(stage.color);
    setEditProbability(stage.probability || 0);
  };

  if (loading) {
    return <div className="text-slate-600">Loading pipeline settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Pipeline Stages</h3>
          <p className="text-sm text-slate-600 mt-1">
            Configure the stages for your sales pipeline. Leads will move through these stages.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Stage
        </button>
      </div>

      {showAddForm && (
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <h4 className="font-medium text-slate-900 mb-4">Add New Stage</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="Stage name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
              <input
                type="color"
                value={newStageColor}
                onChange={(e) => setNewStageColor(e.target.value)}
                className="w-full h-10 px-1 py-1 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Probability (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={newStageProbability}
                onChange={(e) => setNewStageProbability(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleAddStage}
                disabled={!newStageName.trim()}
                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left text-sm font-medium text-slate-700 px-6 py-3 w-12"></th>
              <th className="text-left text-sm font-medium text-slate-700 px-6 py-3">Stage Name</th>
              <th className="text-left text-sm font-medium text-slate-700 px-6 py-3">Color</th>
              <th className="text-left text-sm font-medium text-slate-700 px-6 py-3">Probability</th>
              <th className="text-left text-sm font-medium text-slate-700 px-6 py-3">Order</th>
              <th className="text-left text-sm font-medium text-slate-700 px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage, index) => {
              const isEditing = editingId === stage.id;

              return (
                <tr key={stage.id} className="border-b border-slate-200">
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleReorder(stage.id, 'up')}
                        disabled={index === 0}
                        className="text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <GripVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="px-3 py-1 border border-slate-300 rounded text-sm"
                      />
                    ) : (
                      <span className="text-sm font-medium text-slate-900">{stage.name}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="w-20 h-8 px-1 border border-slate-300 rounded"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="text-xs text-slate-600">{stage.color}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editProbability}
                        onChange={(e) => setEditProbability(Number(e.target.value))}
                        className="w-20 px-3 py-1 border border-slate-300 rounded text-sm"
                      />
                    ) : (
                      <span className="text-sm text-slate-600">{stage.probability}%</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{index + 1}</span>
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateStage(stage.id)}
                          className="p-1 text-green-600 hover:text-green-700"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(stage)}
                          className="p-1 text-slate-600 hover:text-slate-900"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteStage(stage.id)}
                          className="p-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {stages.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No pipeline stages configured yet. Click "Add Stage" to create your first stage.
          </div>
        )}
      </div>
    </div>
  );
}
