import { useState, useEffect, FormEvent, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import type { Lead, Customer, EventType } from '../../lib/database.types';
import { X, Save, AlertCircle, Calendar, Sparkles } from 'lucide-react';
import { CustomerSelector } from './CustomerSelector';
import { parseSmartPaste, SmartPasteResult } from '../../lib/smartPaste';

interface LeadModalProps {
  lead: Lead | null;
  onClose: (shouldRefresh?: boolean) => void;
  onSuccess?: () => void;
}

export function LeadModal({ lead, onClose, onSuccess }: LeadModalProps) {
  const { currentCompany, permissions } = useCompany();
  const { user } = useAuth();

  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<Customer | null>(null);

  const [customerFormData, setCustomerFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: ''
  });

  const [formData, setFormData] = useState({
    event_name: lead?.event_name || '',
    event_date: lead?.event_date || '',
    event_type: lead?.event_type || '',
    event_value: lead?.event_value?.toString() || '',
    expected_pax: lead?.expected_pax?.toString() || '',
    source: lead?.source || '',
    notes: lead?.notes || ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [smartPasteText, setSmartPasteText] = useState('');
  const [isProcessingPaste, setIsProcessingPaste] = useState(false);
  const [parseSuccess, setParseSuccess] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const userEditedFieldsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (currentCompany) {
      loadEventTypes();
    }
    if (lead?.customer_id) {
      loadCustomer(lead.customer_id);
    }
  }, [currentCompany, lead]);

  const loadEventTypes = async () => {
    if (!currentCompany) return;

    const { data } = await supabase
      .from('event_types')
      .select('*')
      .eq('company_id', currentCompany.id)
      .eq('is_active', true)
      .order('order');

    if (data) setEventTypes(data);
  };

  const loadCustomer = async (customerId: string) => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .maybeSingle();

    if (data) setSelectedCustomer(data);
  };

  const checkDuplicateCustomer = async (email: string, phone: string) => {
    if (!currentCompany || (!email && !phone)) return null;

    try {
      if (email && phone) {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .eq('company_id', currentCompany.id)
          .eq('is_archived', false)
          .or(`email.eq.${email},phone.eq.${phone}`)
          .limit(1)
          .maybeSingle();
        return data;
      } else if (email) {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .eq('company_id', currentCompany.id)
          .eq('is_archived', false)
          .eq('email', email)
          .limit(1)
          .maybeSingle();
        return data;
      } else if (phone) {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .eq('company_id', currentCompany.id)
          .eq('is_archived', false)
          .eq('phone', phone)
          .limit(1)
          .maybeSingle();
        return data;
      }
    } catch (error) {
      console.error('Duplicate check error:', error);
      return null;
    }

    return null;
  };

  const handleCustomerFormSubmit = async () => {
    if (!customerFormData.name.trim()) {
      setError('Customer name is required');
      return;
    }

    const duplicate = await checkDuplicateCustomer(
      customerFormData.email,
      customerFormData.phone
    );

    if (duplicate && !duplicateWarning) {
      setDuplicateWarning(duplicate);
      return;
    }

    setDuplicateWarning(null);
    return customerFormData;
  };

  const handleUseDuplicateCustomer = () => {
    if (duplicateWarning) {
      setSelectedCustomer(duplicateWarning);
      setShowCustomerForm(false);
      setDuplicateWarning(null);
      setCustomerFormData({
        name: '',
        email: '',
        phone: '',
        company_name: ''
      });
    }
  };

  const handleSmartPasteChange = (text: string) => {
    setSmartPasteText(text);
    setParseSuccess(false);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!text.trim()) {
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      processSmartPaste(text);
    }, 100);
  };

  const handleSmartPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText.trim()) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      setTimeout(() => {
        processSmartPaste(smartPasteText + pastedText);
      }, 150);
    }
  };

  const handleManualProcess = () => {
    if (smartPasteText.trim()) {
      processSmartPaste(smartPasteText);
    }
  };

  const processSmartPaste = async (text: string) => {
    if (!text.trim()) {
      console.log('Smart paste: Empty text');
      return;
    }

    if (!currentCompany) {
      console.log('Smart paste: No current company');
      setError('Please select a company first');
      return;
    }

    console.log('Smart paste: Processing text...', text.substring(0, 100));
    setIsProcessingPaste(true);
    setParseSuccess(false);

    try {
      const parsed = parseSmartPaste(text);
      console.log('Smart paste: Parsed result', parsed);

      handleLeadFieldsAutoFill(parsed);
      await handleCustomerAutoFill(parsed);

      setParseSuccess(true);
      setTimeout(() => setParseSuccess(false), 3000);
    } catch (error) {
      console.error('Smart paste error:', error);
      setError('Failed to parse pasted content. Please fill manually.');
    } finally {
      setIsProcessingPaste(false);
    }
  };

  const handleCustomerAutoFill = async (parsed: SmartPasteResult) => {
    if (!parsed.hasContactInfo) {
      if (parsed.customerName) {
        setShowCustomerForm(true);
        setCustomerFormData({
          name: parsed.customerName,
          email: '',
          phone: '',
          company_name: parsed.customerCompany
        });
      }
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const existingCustomer = await checkDuplicateCustomer(
        parsed.customerEmail,
        parsed.customerPhone
      );

      clearTimeout(timeoutId);

      if (existingCustomer) {
        setSelectedCustomer(existingCustomer);
        setShowCustomerForm(false);
      } else if (parsed.customerName && (parsed.customerEmail || parsed.customerPhone)) {
        await autoCreateCustomer(parsed);
      } else {
        setShowCustomerForm(true);
        setCustomerFormData({
          name: parsed.customerName,
          email: parsed.customerEmail,
          phone: parsed.customerPhone,
          company_name: parsed.customerCompany
        });
      }
    } catch (error) {
      console.error('Customer auto-fill error:', error);
      setShowCustomerForm(true);
      setCustomerFormData({
        name: parsed.customerName,
        email: parsed.customerEmail,
        phone: parsed.customerPhone,
        company_name: parsed.customerCompany
      });
    }
  };

  const autoCreateCustomer = async (parsed: SmartPasteResult) => {
    if (!currentCompany || !user) return;

    try {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert([{
          company_id: currentCompany.id,
          name: parsed.customerName,
          email: parsed.customerEmail || null,
          phone: parsed.customerPhone || null,
          company_name: parsed.customerCompany || null,
          created_by: user.id
        }])
        .select()
        .single();

      if (customerError) {
        setShowCustomerForm(true);
        setCustomerFormData({
          name: parsed.customerName,
          email: parsed.customerEmail,
          phone: parsed.customerPhone,
          company_name: parsed.customerCompany
        });
        return;
      }

      if (newCustomer) {
        setSelectedCustomer(newCustomer);
        setShowCustomerForm(false);
        setCustomerFormData({
          name: '',
          email: '',
          phone: '',
          company_name: ''
        });

        await supabase.from('audit_logs').insert({
          company_id: currentCompany.id,
          user_id: user.id,
          entity_type: 'customer',
          entity_id: newCustomer.id,
          action: 'create',
          changed_fields: newCustomer
        });
      }
    } catch (error) {
      setShowCustomerForm(true);
      setCustomerFormData({
        name: parsed.customerName,
        email: parsed.customerEmail,
        phone: parsed.customerPhone,
        company_name: parsed.customerCompany
      });
    }
  };

  const handleLeadFieldsAutoFill = (parsed: SmartPasteResult) => {
    const updates: Partial<typeof formData> = {};

    if (parsed.eventName && !userEditedFieldsRef.current.has('event_name')) {
      updates.event_name = parsed.eventName;
    }

    if (parsed.eventDate && !userEditedFieldsRef.current.has('event_date')) {
      updates.event_date = parsed.eventDate;
    }

    if (parsed.eventType && !userEditedFieldsRef.current.has('event_type')) {
      updates.event_type = parsed.eventType;
    }

    if (parsed.expectedPax && !userEditedFieldsRef.current.has('expected_pax')) {
      updates.expected_pax = parsed.expectedPax;
    }

    if (parsed.eventValue && !userEditedFieldsRef.current.has('event_value')) {
      updates.event_value = parsed.eventValue;
    }

    if (parsed.source && !userEditedFieldsRef.current.has('source')) {
      updates.source = parsed.source;
    }

    if (parsed.notes && !userEditedFieldsRef.current.has('notes')) {
      const notesWithWarnings = parsed.warnings.length > 0
        ? `${parsed.notes}\n\n${parsed.warnings.join('\n')}`
        : parsed.notes;
      updates.notes = notesWithWarnings;
    }

    if (Object.keys(updates).length > 0) {
      setFormData(prev => ({ ...prev, ...updates }));
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    userEditedFieldsRef.current.add(field);
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentCompany || !user) return;

    if (!lead && !selectedCustomer && !showCustomerForm) {
      setError('Please select a customer or create a new one');
      return;
    }

    setLoading(true);
    setError('');

    let customerId = selectedCustomer?.id;

    if (showCustomerForm) {
      const customerData = await handleCustomerFormSubmit();
      if (!customerData) {
        setLoading(false);
        return;
      }

      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert([{
          company_id: currentCompany.id,
          name: customerData.name,
          email: customerData.email || null,
          phone: customerData.phone || null,
          company_name: customerData.company_name || null,
          created_by: user.id
        }])
        .select()
        .single();

      if (customerError) {
        setError(customerError.message);
        setLoading(false);
        return;
      }

      customerId = newCustomer.id;

      await supabase.from('audit_logs').insert({
        company_id: currentCompany.id,
        user_id: user.id,
        entity_type: 'customer',
        entity_id: newCustomer.id,
        action: 'create',
        changed_fields: newCustomer
      });
    }

    if (!customerId && !lead) {
      setError('Customer is required');
      setLoading(false);
      return;
    }

    const eventDate = formData.event_date || null;
    if (eventDate && !lead) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(eventDate);

      if (selectedDate < today) {
        const confirmed = confirm('The event date is in the past. Do you want to continue?');
        if (!confirmed) {
          setLoading(false);
          return;
        }
      }
    }

    const leadData = {
      customer_id: customerId || lead?.customer_id,
      event_name: formData.event_name || null,
      event_date: eventDate,
      event_type: formData.event_type || null,
      event_value: formData.event_value ? parseFloat(formData.event_value) : 0,
      expected_pax: formData.expected_pax ? parseInt(formData.expected_pax) : null,
      source: formData.source || null,
      notes: formData.notes || null,
      company_id: currentCompany.id,
      created_by: user.id
    };

    if (lead) {
      const { error: updateError } = await supabase
        .from('leads')
        .update(leadData)
        .eq('id', lead.id);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      await supabase.from('audit_logs').insert({
        company_id: currentCompany.id,
        user_id: user.id,
        entity_type: 'lead',
        entity_id: lead.id,
        action: 'updated',
        changed_fields: leadData
      });
    } else {
      const { data: firstStage } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('company_id', currentCompany.id)
        .order('order')
        .limit(1)
        .maybeSingle();

      const { error: insertError } = await supabase
        .from('leads')
        .insert([{
          ...leadData,
          stage_id: firstStage?.id || null
        }]);

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      if (customerId && selectedCustomer) {
        await supabase.from('audit_logs').insert({
          company_id: currentCompany.id,
          user_id: user.id,
          entity_type: 'lead',
          entity_id: customerId,
          action: 'update',
          changed_fields: { customer_id: customerId, customer_name: selectedCustomer.name }
        });
      }
    }

    setLoading(false);
    if (onSuccess) {
      onSuccess();
    }
    onClose(true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {lead ? 'Edit Lead' : 'New Lead'}
          </h2>
          <button
            onClick={() => onClose(false)}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          {!lead && (
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 border-2 border-dashed border-slate-300 rounded-lg p-4">
              <div className="flex items-start gap-3 mb-2">
                <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-slate-900">Smart Paste</h3>
                    {smartPasteText.trim() && (
                      <button
                        type="button"
                        onClick={handleManualProcess}
                        disabled={isProcessingPaste}
                        className="text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isProcessingPaste ? 'Processing...' : 'Process Now'}
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mb-3">
                    Paste customer inquiry text here to auto-fill the form
                  </p>
                  <textarea
                    value={smartPasteText}
                    onChange={(e) => handleSmartPasteChange(e.target.value)}
                    onPaste={handleSmartPaste}
                    placeholder="Example:&#10;Name: John Doe&#10;Email: john@example.com&#10;Contact: 09123456789&#10;Event: Wedding&#10;Date: Dec 15&#10;Pax: 100&#10;Source: Instagram"
                    rows={6}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                  />
                  <div className="mt-2 min-h-[20px]">
                    {isProcessingPaste && (
                      <div className="text-sm text-blue-600 flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                        <span className="font-medium">Processing pasted content...</span>
                      </div>
                    )}
                    {parseSuccess && !isProcessingPaste && (
                      <div className="text-sm text-green-600 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-medium">Form auto-filled successfully! Review the fields below.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!lead && !showCustomerForm && (
            <CustomerSelector
              selectedCustomerId={selectedCustomer?.id || null}
              onSelectCustomer={(customer) => setSelectedCustomer(customer)}
              onCreateNew={() => setShowCustomerForm(true)}
            />
          )}

          {lead && selectedCustomer && (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-2">Customer</label>
              <div>
                <div className="font-medium text-slate-900">{selectedCustomer.name}</div>
                {selectedCustomer.email && (
                  <div className="text-sm text-slate-600">{selectedCustomer.email}</div>
                )}
                {selectedCustomer.phone && (
                  <div className="text-sm text-slate-600">{selectedCustomer.phone}</div>
                )}
                {selectedCustomer.company_name && (
                  <div className="text-xs text-slate-500">{selectedCustomer.company_name}</div>
                )}
              </div>
            </div>
          )}

          {showCustomerForm && (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-slate-900">New Customer</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomerForm(false);
                    setDuplicateWarning(null);
                  }}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
              </div>

              {duplicateWarning && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3 mb-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-amber-900">Possible Duplicate Customer</div>
                      <div className="text-sm text-amber-800 mt-1">
                        A customer with similar contact info already exists:
                      </div>
                      <div className="mt-2 p-2 bg-white rounded border border-amber-200">
                        <div className="font-medium">{duplicateWarning.name}</div>
                        {duplicateWarning.email && (
                          <div className="text-sm text-slate-600">{duplicateWarning.email}</div>
                        )}
                        {duplicateWarning.phone && (
                          <div className="text-sm text-slate-600">{duplicateWarning.phone}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleUseDuplicateCustomer}
                      className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                    >
                      Use Existing Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateWarning(null)}
                      className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                    >
                      Create New Anyway
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerFormData.name}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={customerFormData.company_name}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, company_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={customerFormData.email}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={customerFormData.phone}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-medium text-slate-900 mb-4">Event Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Event Name / Title
                </label>
                <input
                  type="text"
                  value={formData.event_name}
                  onChange={(e) => handleFieldChange('event_name', e.target.value)}
                  placeholder="e.g., John & Jane Wedding"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Event Date
                </label>
                <input
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => handleFieldChange('event_date', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kind of Event</label>
                <select
                  value={formData.event_type}
                  onChange={(e) => handleFieldChange('event_type', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="">Select event type...</option>
                  {eventTypes.map((type) => (
                    <option key={type.id} value={type.name}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Expected PAX
                </label>
                <input
                  type="number"
                  value={formData.expected_pax}
                  onChange={(e) => handleFieldChange('expected_pax', e.target.value)}
                  placeholder="Number of attendees"
                  min="0"
                  step="1"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Projected Event Value (₱)
                </label>
                <input
                  type="number"
                  value={formData.event_value}
                  onChange={(e) => setFormData({ ...formData, event_value: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
            <input
              type="text"
              value={formData.source}
              onChange={(e) => handleFieldChange('source', e.target.value)}
              placeholder="e.g., Website, Referral, Cold Call"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
              placeholder="Add any additional notes..."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
