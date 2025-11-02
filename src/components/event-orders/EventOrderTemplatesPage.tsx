import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Copy, FileText, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { RichTextEditor } from '../templates/RichTextEditor';

interface TemplateSection {
  id?: string;
  title: string;
  content: string;
  order_index: number;
}

interface EventOrderTemplatesPageProps {
  onTabChange?: (tab: 'quotations' | 'event-orders') => void;
}

export default function EventOrderTemplatesPage({ onTabChange }: EventOrderTemplatesPageProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    fetchUserRole();
    fetchTemplates();
  }, [currentCompany]);

  const fetchUserRole = async () => {
    if (!user || !currentCompany) return;

    const { data: roleData } = await supabase
      .from('user_company_roles')
      .select('role_id, roles(name)')
      .eq('user_id', user.id)
      .eq('company_id', currentCompany.id)
      .maybeSingle();

    if (roleData) {
      const role = (roleData.roles as any)?.name || '';
      setUserRole(role.toLowerCase());
    }
  };

  const fetchTemplates = async () => {
    if (!currentCompany) return;

    setLoading(true);
    const { data } = await supabase
      .from('event_order_templates')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('name');

    if (data) setTemplates(data);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    const { error } = await supabase
      .from('event_order_templates')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchTemplates();
    }
  };

  const handleDuplicate = async (template: any) => {
    const { data: sectionsData } = await supabase
      .from('event_order_template_sections')
      .select('*')
      .eq('template_id', template.id)
      .order('order_index');

    setEditingTemplate({
      ...template,
      id: null,
      name: `${template.name} (Copy)`,
      is_default: false,
      sections: sectionsData || [],
    });
    setShowModal(true);
  };

  const canEdit = userRole === 'admin' || userRole === 'manager';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {onTabChange && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Templates</h1>
              <p className="text-slate-600 mt-1">
                Manage quotation and event order templates
              </p>
            </div>
          </div>

          <div className="border-b border-slate-200">
            <nav className="flex gap-6 overflow-x-auto">
              <button
                onClick={() => onTabChange('quotations')}
                className="flex items-center gap-2 px-4 py-3 border-b-2 border-transparent text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap"
              >
                <FileText className="w-5 h-5" />
                Quotation Templates
              </button>
              <button
                onClick={() => onTabChange('event-orders')}
                className="flex items-center gap-2 px-4 py-3 border-b-2 border-blue-600 text-blue-600 transition-colors whitespace-nowrap"
              >
                <Calendar className="w-5 h-5" />
                Event Order Templates
              </button>
            </nav>
          </div>
        </>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-900">Event Order Templates</h2>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setEditingTemplate(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
          >
            <Plus className="h-5 w-5" />
            New Template
          </button>
        )}
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <p className="text-slate-600 mb-4">No templates yet</p>
          {canEdit && (
            <button
              onClick={() => {
                setEditingTemplate(null);
                setShowModal(true);
              }}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first template
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-800">{template.name}</h3>
                  {template.is_default && (
                    <span className="inline-block mt-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                      Default
                    </span>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDuplicate(template)}
                      className="p-1 text-slate-400 hover:text-blue-600"
                      title="Duplicate"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingTemplate(template);
                        setShowModal(true);
                      }}
                      className="p-1 text-slate-400 hover:text-blue-600"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-1 text-slate-400 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {template.logo_url && (
                <div className="mb-3">
                  <img
                    src={template.logo_url}
                    alt="Logo"
                    className="h-12 object-contain"
                  />
                </div>
              )}

              <div className="text-sm text-slate-600">
                <div>Logo Position: <span className="font-medium">{template.logo_position}</span></div>
                <div>Max Width: <span className="font-medium">{template.logo_max_width}px</span></div>
                <div className="flex items-center gap-2 mt-2">
                  Header Color:
                  <div
                    className="w-8 h-6 rounded border border-slate-300"
                    style={{ backgroundColor: template.header_color }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => {
            setShowModal(false);
            setEditingTemplate(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingTemplate(null);
            fetchTemplates();
          }}
        />
      )}
    </div>
  );
}

function TemplateModal({ template, onClose, onSuccess }: { template: any; onClose: () => void; onSuccess: () => void }) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    name: template?.name || '',
    logo_url: template?.logo_url || '',
    logo_position: template?.logo_position || 'left',
    logo_max_width: template?.logo_max_width || 200,
    header_color: template?.header_color || '#E9D5FF',
    is_default: template?.is_default || false,
  });

  const [sections, setSections] = useState<TemplateSection[]>(
    template?.sections || [
      { title: 'Front Office Instructions', content: '', order_index: 0 },
      { title: 'Package Inclusions', content: '', order_index: 1 },
      { title: 'Operations', content: '', order_index: 2 },
      { title: 'Accounting', content: '', order_index: 3 },
      { title: 'Security Notes', content: '', order_index: 4 },
    ]
  );

  useEffect(() => {
    if (template?.id) {
      fetchTemplateSections();
    }
  }, [template?.id]);

  const fetchTemplateSections = async () => {
    if (!template?.id) return;

    const { data } = await supabase
      .from('event_order_template_sections')
      .select('*')
      .eq('template_id', template.id)
      .order('order_index');

    if (data) {
      setSections(data.map(s => ({
        id: s.id,
        title: s.title,
        content: s.content,
        order_index: s.order_index,
      })));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany) return;

    setLoading(true);
    setMessage(null);

    try {
      const templateData = {
        company_id: currentCompany.id,
        ...formData,
        created_by: user?.id,
        updated_at: new Date().toISOString(),
      };

      let savedTemplateId = template?.id;

      if (template?.id) {
        const { error } = await supabase
          .from('event_order_templates')
          .update(templateData)
          .eq('id', template.id);

        if (error) throw error;

        await supabase
          .from('event_order_template_sections')
          .delete()
          .eq('template_id', template.id);
      } else {
        const { data: newTemplate, error } = await supabase
          .from('event_order_templates')
          .insert(templateData)
          .select()
          .single();

        if (error) throw error;
        savedTemplateId = newTemplate.id;
      }

      const sectionsData = sections.map((section, index) => ({
        template_id: savedTemplateId,
        title: section.title,
        content: section.content,
        order_index: index,
      }));

      const { error: sectionsError } = await supabase
        .from('event_order_template_sections')
        .insert(sectionsData);

      if (sectionsError) throw sectionsError;

      setMessage({ type: 'success', text: 'Template saved successfully!' });
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error: any) {
      console.error('Error saving template:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save template' });
    } finally {
      setLoading(false);
    }
  };

  const addSection = () => {
    setSections([...sections, {
      title: 'New Section',
      content: '',
      order_index: sections.length,
    }]);
  };

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-800">
            {template?.id ? 'Edit Template' : 'New Template'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {message && (
            <div className={`mb-4 p-3 rounded-lg ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {message.text}
            </div>
          )}

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Template Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Logo Position</label>
                <select
                  value={formData.logo_position}
                  onChange={(e) => setFormData({ ...formData, logo_position: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Logo Max Width (px)</label>
                <input
                  type="number"
                  value={formData.logo_max_width}
                  onChange={(e) => setFormData({ ...formData, logo_max_width: parseInt(e.target.value) || 200 })}
                  min="100"
                  max="300"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Header Color</label>
                <input
                  type="color"
                  value={formData.header_color}
                  onChange={(e) => setFormData({ ...formData, header_color: e.target.value })}
                  className="w-full h-10 px-1 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Logo URL</label>
              <input
                type="text"
                value={formData.logo_url}
                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                placeholder="https://example.com/logo.png or data:image/png;base64,..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">Enter an image URL or paste a data URI</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_default"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
              />
              <label htmlFor="is_default" className="text-sm font-medium text-slate-700">
                Set as default template
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-800">Default Sections</h3>
              <button
                type="button"
                onClick={addSection}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Section
              </button>
            </div>

            {sections.map((section, index) => (
              <div key={index} className="mb-4 p-4 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => {
                      const updated = [...sections];
                      updated[index].title = e.target.value;
                      setSections(updated);
                    }}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => removeSection(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                <RichTextEditor
                  value={section.content}
                  onChange={(content) => {
                    const updated = [...sections];
                    updated[index].content = content;
                    setSections(updated);
                  }}
                  placeholder={`Default content for ${section.title}...`}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
