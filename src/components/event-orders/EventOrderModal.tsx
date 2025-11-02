import { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, GripVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { RichTextEditor } from '../templates/RichTextEditor';

interface EventOrderSection {
  id?: string;
  title: string;
  content: string;
  order_index: number;
  is_default: boolean;
}

interface EventOrderModalProps {
  eventOrder?: any;
  quotationId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EventOrderModal({ eventOrder, quotationId, onClose, onSuccess }: EventOrderModalProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState(quotationId || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [userRole, setUserRole] = useState('');
  const [isViewer, setIsViewer] = useState(false);

  const [formData, setFormData] = useState({
    quotation_number: '',
    customer_name: '',
    contact_person: '',
    contact_number: '',
    event_type: '',
    number_of_pax: 0,
    guaranteed_pax: 0,
    event_date: '',
    event_day: '',
    venue: '',
    activity: '',
    time_slot: '',
    type_of_function: '',
    payment_scheme: '',
    authorized_signatory: '',
    total_amount: 0,
    vat_amount: 0,
    security_deposit: 0,
    logo_url: '',
    logo_position: 'left' as 'left' | 'center' | 'right',
    logo_max_width: 200,
    header_color: '#E9D5FF',
    prepared_by: '',
    prepared_by_role: '',
    received_by: '',
    received_by_role: '',
  });

  const [sections, setSections] = useState<EventOrderSection[]>([
    { title: 'Front Office Instructions', content: '', order_index: 0, is_default: true },
    { title: 'Package Inclusions', content: '', order_index: 1, is_default: true },
    { title: 'Operations', content: '', order_index: 2, is_default: true },
    { title: 'Accounting', content: '', order_index: 3, is_default: true },
    { title: 'Security Notes', content: '', order_index: 4, is_default: true },
  ]);

  useEffect(() => {
    if (currentCompany) {
      fetchUserRole();
      fetchQuotations();
      fetchTemplates();

      if (eventOrder) {
        loadEventOrder();
      } else if (quotationId) {
        setSelectedQuotationId(quotationId);
        generateFromQuotation(quotationId);
      }
    }
  }, [currentCompany, eventOrder?.id]);

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
      setIsViewer(role.toLowerCase() === 'viewer');
    }
  };

  const fetchQuotations = async () => {
    if (!currentCompany) return;

    const { data, error } = await supabase
      .from('quotations')
      .select('id, quotation_no, customer_name, status')
      .eq('company_id', currentCompany.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching quotations:', error);
      return;
    }

    if (data) {
      setQuotations(data);
    }
  };

  const fetchTemplates = async () => {
    if (!currentCompany) return;

    const { data } = await supabase
      .from('event_order_templates')
      .select('*, event_order_template_sections(*)')
      .eq('company_id', currentCompany.id)
      .order('name');

    if (data) setTemplates(data);
  };

  const loadEventOrder = async () => {
    if (!eventOrder?.id) return;

    const { data: sectionsData } = await supabase
      .from('event_order_sections')
      .select('*')
      .eq('event_order_id', eventOrder.id)
      .order('order_index');

    setFormData({
      quotation_number: eventOrder.quotation_number || '',
      customer_name: eventOrder.customer_name || '',
      contact_person: eventOrder.contact_person || '',
      contact_number: eventOrder.contact_number || '',
      event_type: eventOrder.event_type || '',
      number_of_pax: eventOrder.number_of_pax || 0,
      guaranteed_pax: eventOrder.guaranteed_pax || 0,
      event_date: eventOrder.event_date || '',
      event_day: eventOrder.event_day || '',
      venue: eventOrder.venue || '',
      activity: eventOrder.activity || '',
      time_slot: eventOrder.time_slot || '',
      type_of_function: eventOrder.type_of_function || '',
      payment_scheme: eventOrder.payment_scheme || '',
      authorized_signatory: eventOrder.authorized_signatory || '',
      total_amount: eventOrder.total_amount || 0,
      vat_amount: eventOrder.vat_amount || 0,
      security_deposit: eventOrder.security_deposit || 0,
      logo_url: eventOrder.logo_url || '',
      logo_position: eventOrder.logo_position || 'left',
      logo_max_width: eventOrder.logo_max_width || 200,
      header_color: eventOrder.header_color || '#E9D5FF',
      prepared_by: eventOrder.prepared_by || '',
      prepared_by_role: eventOrder.prepared_by_role || '',
      received_by: eventOrder.received_by || '',
      received_by_role: eventOrder.received_by_role || '',
    });

    if (sectionsData) {
      setSections(sectionsData.map(s => ({
        id: s.id,
        title: s.title,
        content: s.content,
        order_index: s.order_index,
        is_default: s.is_default,
      })));
    }
  };

  const generateFromQuotation = async (qId: string) => {
    if (!qId || !currentCompany || !user) return;

    try {
      const { data: quotation, error: quotationError } = await supabase
        .from('quotations')
        .select(`
          *,
          leads(event_type, event_date, expected_pax),
          customers(name, contact_person, phone)
        `)
        .eq('id', qId)
        .maybeSingle();

      if (quotationError || !quotation) {
        setMessage({ type: 'error', text: 'Failed to load quotation data' });
        return;
      }

      const lead = quotation.leads as any;
      const customer = quotation.customers as any;

      let dayOfWeek = '';
      let eventDateToUse = quotation.event_date || lead?.event_date;
      if (eventDateToUse) {
        const eventDate = new Date(eventDateToUse);
        dayOfWeek = eventDate.toLocaleDateString('en-US', { weekday: 'long' });
      }

      const { data: userData } = await supabase
        .from('user_company_roles')
        .select('users(email), roles(name)')
        .eq('user_id', user.id)
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      setFormData({
        quotation_number: quotation.quotation_no || '',
        customer_name: customer?.name || '',
        contact_person: customer?.contact_person || '',
        contact_number: customer?.phone || '',
        event_type: lead?.event_type || '',
        number_of_pax: quotation.no_of_pax || lead?.expected_pax || 0,
        guaranteed_pax: quotation.no_of_pax || lead?.expected_pax || 0,
        event_date: eventDateToUse || '',
        event_day: dayOfWeek,
        venue: '',
        activity: '',
        time_slot: '',
        type_of_function: lead?.event_type || '',
        payment_scheme: '',
        authorized_signatory: '',
        total_amount: quotation.total_amount || 0,
        vat_amount: quotation.vat_amount || 0,
        security_deposit: 0,
        logo_url: '',
        logo_position: 'left' as 'left' | 'center' | 'right',
        logo_max_width: 200,
        header_color: '#E9D5FF',
        prepared_by: (userData?.users as any)?.email || '',
        prepared_by_role: (userData?.roles as any)?.name || '',
        received_by: '',
        received_by_role: '',
      });

      const updatedSections = [...sections];
      const inclusionsSection = updatedSections.find(s => s.title === 'Package Inclusions');
      if (inclusionsSection && quotation.body_html) {
        inclusionsSection.content = quotation.body_html;
      }

      const accountingSection = updatedSections.find(s => s.title === 'Accounting');
      if (accountingSection) {
        accountingSection.content = `
          <p><strong>BILLING ARRANGEMENT:</strong></p>
          <p>Total Amount: ${quotation.currency || 'PHP'} ${quotation.total_amount?.toLocaleString() || '0.00'}</p>
          ${quotation.vat_amount ? `<p>VAT: ${quotation.currency || 'PHP'} ${quotation.vat_amount.toLocaleString()}</p>` : ''}
        `;
      }

      setSections(updatedSections);
      setMessage(null);
    } catch (error) {
      console.error('Error generating from quotation:', error);
      setMessage({ type: 'error', text: 'Failed to load quotation data' });
    }
  };

  const applyTemplate = async (templateId: string) => {
    if (!templateId) return;

    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    setFormData(prev => ({
      ...prev,
      logo_url: template.logo_url || prev.logo_url,
      logo_position: template.logo_position || prev.logo_position,
      logo_max_width: template.logo_max_width || prev.logo_max_width,
      header_color: template.header_color || prev.header_color,
    }));

    if (template.event_order_template_sections && template.event_order_template_sections.length > 0) {
      const templateSections = template.event_order_template_sections.map((s: any) => ({
        title: s.title,
        content: s.content,
        order_index: s.order_index,
        is_default: true,
      }));
      setSections(templateSections);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany || isViewer) return;

    setLoading(true);
    setMessage(null);

    try {
      let orderNumber = eventOrder?.order_number;

      if (!orderNumber) {
        const { data: numberData } = await supabase.rpc('generate_event_order_number', {
          p_company_id: currentCompany.id
        });
        orderNumber = numberData;
      }

      const orderData = {
        company_id: currentCompany.id,
        quotation_id: selectedQuotationId || null,
        template_id: selectedTemplateId || null,
        order_number: orderNumber,
        ...formData,
        created_by: user?.id,
        updated_at: new Date().toISOString(),
      };

      let savedOrderId = eventOrder?.id;

      if (eventOrder?.id) {
        const { error } = await supabase
          .from('event_orders')
          .update(orderData)
          .eq('id', eventOrder.id);

        if (error) throw error;

        await supabase
          .from('event_order_sections')
          .delete()
          .eq('event_order_id', eventOrder.id);
      } else {
        const { data: newOrder, error } = await supabase
          .from('event_orders')
          .insert(orderData)
          .select()
          .single();

        if (error) throw error;
        savedOrderId = newOrder.id;
      }

      const sectionsData = sections.map((section, index) => ({
        event_order_id: savedOrderId,
        title: section.title,
        content: section.content,
        order_index: index,
        is_default: section.is_default,
      }));

      const { error: sectionsError } = await supabase
        .from('event_order_sections')
        .insert(sectionsData);

      if (sectionsError) throw sectionsError;

      setMessage({ type: 'success', text: 'Event Order saved successfully!' });
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Error saving event order:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save event order' });
    } finally {
      setLoading(false);
    }
  };

  const addSection = () => {
    setSections([...sections, {
      title: 'New Section',
      content: '',
      order_index: sections.length,
      is_default: false,
    }]);
  };

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newSections.length) return;

    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    newSections.forEach((s, i) => s.order_index = i);

    setSections(newSections);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-800">
            {eventOrder ? 'Edit Event Order' : 'New Event Order'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-6 w-6" />
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

          {!eventOrder && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Generate from Quotation
                </label>
                <select
                  value={selectedQuotationId}
                  onChange={(e) => {
                    setSelectedQuotationId(e.target.value);
                    generateFromQuotation(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={isViewer}
                >
                  <option value="">Select a quotation...</option>
                  {quotations.map(q => (
                    <option key={q.id} value={q.id}>
                      {q.quotation_no} - {q.customer_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Apply Template
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => {
                    setSelectedTemplateId(e.target.value);
                    applyTemplate(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={isViewer}
                >
                  <option value="">None</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Event Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date of Function</label>
                  <input
                    type="date"
                    value={formData.event_date}
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      const day = date.toLocaleDateString('en-US', { weekday: 'long' });
                      setFormData({ ...formData, event_date: e.target.value, event_day: day });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={isViewer}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Day</label>
                  <input
                    type="text"
                    value={formData.event_day}
                    onChange={(e) => setFormData({ ...formData, event_day: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={isViewer}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Guaranteed Pax</label>
                  <input
                    type="number"
                    value={formData.guaranteed_pax}
                    onChange={(e) => setFormData({ ...formData, guaranteed_pax: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={isViewer}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Activity</label>
                  <input
                    type="text"
                    value={formData.activity}
                    onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={isViewer}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
                  <input
                    type="text"
                    value={formData.time_slot}
                    onChange={(e) => setFormData({ ...formData, time_slot: e.target.value })}
                    placeholder="e.g., 9am-7pm"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={isViewer}
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Type & Payment Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type of Function</label>
                  <input
                    type="text"
                    value={formData.type_of_function}
                    onChange={(e) => setFormData({ ...formData, type_of_function: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={isViewer}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Scheme</label>
                  <input
                    type="text"
                    value={formData.payment_scheme}
                    onChange={(e) => setFormData({ ...formData, payment_scheme: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={isViewer}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={isViewer}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact Number</label>
                  <input
                    type="text"
                    value={formData.contact_number}
                    onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={isViewer}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Authorized Signatory</label>
                  <input
                    type="text"
                    value={formData.authorized_signatory}
                    onChange={(e) => setFormData({ ...formData, authorized_signatory: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={isViewer}
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Sections</h3>
                {!isViewer && (
                  <button
                    type="button"
                    onClick={addSection}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add Section
                  </button>
                )}
              </div>

              {sections.map((section, index) => (
                <div key={index} className="mb-4 p-4 border border-slate-200 rounded-lg bg-white">
                  <div className="flex items-center gap-2 mb-3">
                    {!isViewer && (
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => moveSection(index, 'up')}
                          disabled={index === 0}
                          className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => {
                        const updated = [...sections];
                        updated[index].title = e.target.value;
                        setSections(updated);
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                      disabled={isViewer}
                    />
                    {!isViewer && (
                      <button
                        type="button"
                        onClick={() => removeSection(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  <RichTextEditor
                    value={section.content}
                    onChange={(content) => {
                      const updated = [...sections];
                      updated[index].content = content;
                      setSections(updated);
                    }}
                    disabled={isViewer}
                    placeholder={`Enter content for ${section.title}...`}
                  />
                </div>
              ))}
            </div>

            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Signatures</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prepared By</label>
                  <input
                    type="text"
                    value={formData.prepared_by}
                    onChange={(e) => setFormData({ ...formData, prepared_by: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-2"
                    disabled={isViewer}
                  />
                  <input
                    type="text"
                    value={formData.prepared_by_role}
                    onChange={(e) => setFormData({ ...formData, prepared_by_role: e.target.value })}
                    placeholder="Role/Title"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={isViewer}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Received By</label>
                  <input
                    type="text"
                    value={formData.received_by}
                    onChange={(e) => setFormData({ ...formData, received_by: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-2"
                    disabled={isViewer}
                  />
                  <input
                    type="text"
                    value={formData.received_by_role}
                    onChange={(e) => setFormData({ ...formData, received_by_role: e.target.value })}
                    placeholder="Role/Title"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={isViewer}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:text-slate-900"
            >
              Cancel
            </button>
            {!isViewer && (
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-5 w-5" />
                {loading ? 'Saving...' : 'Save Event Order'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
