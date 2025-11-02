import { useState, useEffect } from 'react';
import { FileText, Plus, Edit2, Trash2, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';

interface ProformaInvoiceTemplate {
  id: string;
  name: string;
  description: string | null;
  primary_color: string;
  tax_percentage: number;
  is_active: boolean;
  created_at: string;
}

export function ProformaInvoiceTemplatesPage() {
  const { currentCompany, permissions } = useCompany();
  const [templates, setTemplates] = useState<ProformaInvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const canCreate = permissions?.quotations?.create ?? false;
  const canUpdate = permissions?.quotations?.update ?? false;
  const canDelete = permissions?.quotations?.delete ?? false;

  useEffect(() => {
    if (currentCompany) {
      loadTemplates();
    }
  }, [currentCompany, showArchived]);

  const loadTemplates = async () => {
    if (!currentCompany) return;

    setLoading(true);
    const query = supabase
      .from('proforma_invoice_templates')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('created_at', { ascending: false });

    if (!showArchived) {
      query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading templates:', error);
    } else {
      setTemplates(data || []);
    }

    setLoading(false);
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (template.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Proforma Invoice Templates</h2>
          <p className="text-sm text-slate-600 mt-1">Create reusable templates with preset branding and content</p>
        </div>
        {canCreate && (
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
            <Plus className="w-4 h-4" />
            New Template
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
          />
          Show Archived
        </label>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="text-slate-600 mt-4">Loading templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-slate-300">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No templates found</h3>
          <p className="text-slate-600 mb-4">
            {searchQuery ? 'Try adjusting your search' : 'Create your first proforma invoice template to get started'}
          </p>
          {canCreate && !searchQuery && (
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
              <Plus className="w-4 h-4" />
              Create Template
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-white border border-slate-200 rounded-lg p-6 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-8 h-8 rounded"
                      style={{ backgroundColor: template.primary_color }}
                    />
                    <h3 className="text-lg font-semibold text-slate-900">{template.name}</h3>
                    {!template.is_active && (
                      <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                        Archived
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-sm text-slate-600 mb-3">{template.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span>Tax: {template.tax_percentage}%</span>
                    <span>Created {new Date(template.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canUpdate && (
                    <button className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
