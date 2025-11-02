import { useState, useEffect, useRef } from 'react';
import { FileDown, Mail, Printer, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import html2pdf from 'html2pdf.js';

interface EventOrderViewProps {
  eventOrderId: string;
  onEdit?: () => void;
  canEdit?: boolean;
}

export default function EventOrderView({ eventOrderId, onEdit, canEdit = true }: EventOrderViewProps) {
  const [eventOrder, setEventOrder] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchEventOrder();
  }, [eventOrderId]);

  const fetchEventOrder = async () => {
    setLoading(true);

    const { data: orderData } = await supabase
      .from('event_orders')
      .select('*')
      .eq('id', eventOrderId)
      .maybeSingle();

    const { data: sectionsData } = await supabase
      .from('event_order_sections')
      .select('*')
      .eq('event_order_id', eventOrderId)
      .order('order_index');

    if (orderData) setEventOrder(orderData);
    if (sectionsData) setSections(sectionsData);

    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    if (!contentRef.current) return;

    const opt = {
      margin: 0.5,
      filename: `EventOrder-${eventOrder.order_number}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(opt).from(contentRef.current).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const handleEmail = () => {
    setShowEmailModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-slate-600">Loading event order...</div>
      </div>
    );
  }

  if (!eventOrder) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-slate-600">Event order not found</div>
      </div>
    );
  }

  const logoAlignment = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }[eventOrder.logo_position || 'left'];

  return (
    <div className="space-y-4 print:space-y-0">
      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-2xl font-bold text-slate-800">Event Order: {eventOrder.order_number}</h2>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <Edit2 className="h-5 w-5" />
              Edit
            </button>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            <Printer className="h-5 w-5" />
            Print
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            <FileDown className="h-5 w-5" />
            Export PDF
          </button>
          <button
            onClick={handleEmail}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Mail className="h-5 w-5" />
            Email
          </button>
        </div>
      </div>

      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #event-order-content,
            #event-order-content * {
              visibility: visible;
            }
            #event-order-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .sections-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 1.5rem;
              column-gap: 2rem;
            }
            .section-item {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        `}
      </style>
      <div
        id="event-order-content"
        ref={contentRef}
        className="bg-white border border-slate-200 rounded-lg p-8 print:border-0 print:p-0 print:rounded-none"
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        <div className={`flex ${logoAlignment} mb-6`}>
          {eventOrder.logo_url && (
            <img
              src={eventOrder.logo_url}
              alt="Logo"
              style={{ maxWidth: `${eventOrder.logo_max_width || 200}px` }}
              className="h-auto"
            />
          )}
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{eventOrder.customer_name || 'EVENT ORDER'}</h1>
          {eventOrder.type_of_function && (
            <p className="text-xl text-slate-600">{eventOrder.type_of_function}</p>
          )}
        </div>

        <div
          className="mb-6 p-4 rounded"
          style={{ backgroundColor: eventOrder.header_color || '#E9D5FF' }}
        >
          <h2 className="text-xl font-bold text-center">Event Summary</h2>
        </div>

        <div className="grid grid-cols-5 gap-4 mb-6 text-sm">
          <div className="p-3 border border-slate-300">
            <div className="font-semibold mb-1">DATE OF FUNCTION</div>
            <div>{eventOrder.event_date ? new Date(eventOrder.event_date).toLocaleDateString() : 'N/A'}</div>
          </div>
          <div className="p-3 border border-slate-300">
            <div className="font-semibold mb-1">DAY</div>
            <div>{eventOrder.event_day || 'N/A'}</div>
          </div>
          <div className="p-3 border border-slate-300">
            <div className="font-semibold mb-1">GTD. PAX</div>
            <div className="text-lg font-bold">{eventOrder.guaranteed_pax || 0}</div>
          </div>
          <div className="p-3 border border-slate-300">
            <div className="font-semibold mb-1">ACTIVITY</div>
            <div>{eventOrder.activity || 'N/A'}</div>
          </div>
          <div className="p-3 border border-slate-300">
            <div className="font-semibold mb-1">TIME</div>
            <div className="font-semibold">{eventOrder.time_slot || 'N/A'}</div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4 mb-6 text-sm">
          <div className="p-3 border border-slate-300">
            <div className="font-semibold mb-1">TYPE OF FUNCTION</div>
            <div>{eventOrder.type_of_function || 'N/A'}</div>
          </div>
          <div className="p-3 border border-slate-300">
            <div className="font-semibold mb-1">PAYMENT SCHEME</div>
            <div>{eventOrder.payment_scheme || 'N/A'}</div>
          </div>
          <div className="p-3 border border-slate-300">
            <div className="font-semibold mb-1">CONTACT NUMBER</div>
            <div>{eventOrder.contact_number || 'N/A'}</div>
          </div>
          <div className="p-3 border border-slate-300">
            <div className="font-semibold mb-1">CONTACT PERSON</div>
            <div>{eventOrder.contact_person || 'N/A'}</div>
          </div>
          <div className="p-3 border border-slate-300">
            <div className="font-semibold mb-1">AUTHORIZED SIGNATORY</div>
            <div>{eventOrder.authorized_signatory || 'N/A'}</div>
          </div>
        </div>

        <div className="sections-grid grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {sections.map((section, index) => (
            <div key={section.id || index} className="section-item break-inside-avoid">
              <div
                className="p-2 mb-2 rounded font-bold text-sm"
                style={{ backgroundColor: eventOrder.header_color || '#E9D5FF' }}
              >
                {section.title.toUpperCase()}:
              </div>
              <div
                className="prose prose-sm max-w-none pl-4 text-sm"
                dangerouslySetInnerHTML={{ __html: section.content || '<p>No content</p>' }}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-8 mt-12 pt-8 border-t border-slate-300">
          <div className="text-center">
            <div className="mb-16">
              {eventOrder.prepared_by_signature && (
                <img
                  src={eventOrder.prepared_by_signature}
                  alt="Signature"
                  className="mx-auto h-16"
                />
              )}
            </div>
            <div className="border-t-2 border-slate-800 pt-2">
              <div className="font-bold">{eventOrder.prepared_by || 'Prepared By:'}</div>
              {eventOrder.prepared_by_role && (
                <div className="text-sm text-slate-600">{eventOrder.prepared_by_role}</div>
              )}
            </div>
          </div>
          <div className="text-center">
            <div className="mb-16"></div>
            <div className="border-t-2 border-slate-800 pt-2">
              <div className="font-bold">{eventOrder.received_by || 'Received By:'}</div>
              {eventOrder.received_by_role && (
                <div className="text-sm text-slate-600">{eventOrder.received_by_role}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showEmailModal && (
        <EmailModal
          eventOrder={eventOrder}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </div>
  );
}

function EmailModal({ eventOrder, onClose }: { eventOrder: any; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(`Event Order - ${eventOrder.order_number}`);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);

    await new Promise(resolve => setTimeout(resolve, 1500));

    setSending(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">Email Event Order</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Optional message to include in the email..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:text-slate-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !email}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Mail className="h-5 w-5" />
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
