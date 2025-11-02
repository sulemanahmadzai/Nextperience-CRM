import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Archive, RotateCcw, FileText, Calendar, Receipt } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import TemplateModal from './TemplateModal';
import EventOrderTemplatesPage from '../event-orders/EventOrderTemplatesPage';
import { ProformaInvoiceTemplatesPage } from '../proforma/ProformaInvoiceTemplatesPage';

interface Template {
  id: string;
  name: string;
  body_html: string;
  terms_html: string;
  is_default: boolean;
  archived: boolean;
  created_at: string;
}

export function TemplatesPage() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'quotations' | 'event-orders' | 'proforma-invoices'>('quotations');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    if (currentCompany && user) {
      fetchTemplates();
      fetchUserRole();
    }
  }, [currentCompany, user]);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchTerm, showArchived]);

  const fetchUserRole = async () => {
    if (!user || !currentCompany) return;

    const { data, error } = await supabase
      .from('user_company_roles')
      .select('role_id, roles(name)')
      .eq('user_id', user.id)
      .eq('company_id', currentCompany.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user role:', error);
    }

    if (data) {
      const roleName = (data.roles as any)?.name || '';
      console.log('User role:', roleName);
      setUserRole(roleName);
    }
  };

  const fetchTemplates = async () => {
    if (!currentCompany) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('quotation_templates')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  };

  const filterTemplates = () => {
    let filtered = templates.filter(t => showArchived ? t.archived : !t.archived);

    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredTemplates(filtered);
  };

  const handleArchive = async (template: Template) => {
    const { error } = await supabase
      .from('quotation_templates')
      .update({ archived: !template.archived })
      .eq('id', template.id);

    if (error) {
      console.error('Error archiving template:', error);
      alert('Failed to archive template');
    } else {
      fetchTemplates();
    }
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setEditingTemplate(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingTemplate(null);
    fetchTemplates();
  };

  const canEdit = userRole === 'admin' || userRole === 'manager';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading templates...</div>
      </div>
    );
  }

  console.log('User role:', userRole, 'Can edit:', canEdit);

  if (activeTab === 'event-orders') {
    return <EventOrderTemplatesPage onTabChange={setActiveTab} />;
  }

  if (activeTab === 'proforma-invoices') {
    return (
      <div className="space-y-6 p-4 sm:p-6">
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
              onClick={() => setActiveTab('quotations')}
              className="flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap border-transparent text-slate-600 hover:text-slate-900"
            >
              <FileText className="w-5 h-5" />
              Quotation Templates
            </button>
            <button
              onClick={() => setActiveTab('event-orders')}
              className="flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap border-transparent text-slate-600 hover:text-slate-900"
            >
              <Calendar className="w-5 h-5" />
              Event Order Templates
            </button>
            <button
              onClick={() => setActiveTab('proforma-invoices')}
              className="flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap border-blue-600 text-blue-600"
            >
              <Receipt className="w-5 h-5" />
              Proforma Invoice Templates
            </button>
          </nav>
        </div>

        <ProformaInvoiceTemplatesPage />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
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
            onClick={() => setActiveTab('quotations')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'quotations'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-5 h-5" />
            Quotation Templates
          </button>
          <button
            onClick={() => setActiveTab('event-orders')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'event-orders'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-5 h-5" />
            Event Order Templates
          </button>
          <button
            onClick={() => setActiveTab('proforma-invoices')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'proforma-invoices'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-5 h-5" />
            Proforma Invoice Templates
          </button>
        </nav>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-900">Quotation Templates</h2>
          <p className="text-slate-600 mt-1">
            Create reusable templates with preset content and line items
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          New Template
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-slate-300"
          />
          Show Archived
        </label>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <p className="text-slate-600">
            {searchTerm ? 'No templates found matching your search.' : 'No templates yet. Create your first template!'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className={`bg-white rounded-lg border ${
                template.archived ? 'border-slate-200 opacity-60' : 'border-slate-300'
              } p-6 hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {template.name}
                    </h3>
                    {template.is_default && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                        Default
                      </span>
                    )}
                    {template.archived && (
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded">
                        Archived
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    {template.body_html && (
                      <div className="line-clamp-2" dangerouslySetInnerHTML={{ __html: template.body_html }} />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit template"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleArchive(template)}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title={template.archived ? 'Restore template' : 'Archive template'}
                  >
                    {template.archived ? (
                      <RotateCcw className="w-5 h-5" />
                    ) : (
                      <Archive className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <TemplateModal
          template={editingTemplate}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
