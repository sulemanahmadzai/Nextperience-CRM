import { useState, useEffect } from 'react';
import { Clock, Mail, Phone, Calendar, MessageSquare, FileText, User, CreditCard, ShieldCheck, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';

interface TimelineItem {
  id: string;
  type: 'activity' | 'quotation' | 'email' | 'status_change' | 'payment';
  title: string;
  description: string;
  timestamp: string;
  user?: string;
  status?: string;
}

interface ActivitiesTimelineProps {
  leadId: string;
}

export default function ActivitiesTimeline({ leadId }: ActivitiesTimelineProps) {
  const { currentCompany } = useCompany();
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeline();
  }, [leadId]);

  const loadTimeline = async () => {
    if (!currentCompany) return;

    const items: TimelineItem[] = [];

    const { data: activities } = await supabase
      .from('activities')
      .select('*, users(email)')
      .eq('lead_id', leadId)
      .order('activity_date', { ascending: false });

    if (activities) {
      activities.forEach((activity) => {
        items.push({
          id: activity.id,
          type: 'activity',
          title: activity.title,
          description: activity.description || '',
          timestamp: activity.activity_date,
          user: (activity.users as any)?.email,
        });
      });
    }

    const { data: quotations } = await supabase
      .from('quotations')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (quotations) {
      quotations.forEach((quotation) => {
        items.push({
          id: quotation.id,
          type: 'quotation',
          title: `Quotation ${quotation.quotation_no} created`,
          description: `Status: ${quotation.status}`,
          timestamp: quotation.created_at,
        });

        if (quotation.status === 'sent' && quotation.updated_at !== quotation.created_at) {
          items.push({
            id: `${quotation.id}-sent`,
            type: 'quotation',
            title: `Quotation ${quotation.quotation_no} sent`,
            description: 'Quotation sent to customer',
            timestamp: quotation.updated_at,
          });
        }

        if (quotation.signed_at) {
          items.push({
            id: `${quotation.id}-signed`,
            type: 'quotation',
            title: `Quotation ${quotation.quotation_no} accepted`,
            description: `Signed by ${quotation.signed_by}`,
            timestamp: quotation.signed_at,
          });
        }
      });
    }

    const { data: emails } = await supabase
      .from('email_messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (emails) {
      emails.forEach((email) => {
        items.push({
          id: email.id,
          type: 'email',
          title: email.subject,
          description: `Sent to ${email.recipient_email}`,
          timestamp: email.sent_at || email.created_at,
        });
      });
    }

    const { data: payments } = await supabase
      .from('payments')
      .select(`
        *,
        quotations(quotation_no)
      `)
      .in('quotation_id', quotations?.map((q) => q.id) || [])
      .order('created_at', { ascending: false });

    if (payments) {
      payments.forEach((payment) => {
        const quotationNo = (payment.quotations as any)?.quotation_no;

        items.push({
          id: payment.id,
          type: 'payment',
          title: `Payment recorded for ${quotationNo}`,
          description: `${payment.currency} ${parseFloat(payment.amount).toLocaleString()} via ${payment.payment_method}`,
          timestamp: payment.payment_date,
          status: payment.payment_status,
        });

        if (payment.verified_at && payment.verification_status) {
          items.push({
            id: `${payment.id}-verified`,
            type: 'payment',
            title: `Payment ${payment.verification_status}`,
            description: payment.verification_notes || `Payment ${payment.verification_status} by finance team`,
            timestamp: payment.verified_at,
            status: payment.verification_status,
          });
        }
      });
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setTimeline(items);
    setLoading(false);
  };

  const getIcon = (type: string, status?: string) => {
    switch (type) {
      case 'activity':
        return <MessageSquare className="w-4 h-4" />;
      case 'quotation':
        return <FileText className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'payment':
        if (status === 'verified') {
          return <ShieldCheck className="w-4 h-4" />;
        } else if (status === 'rejected' || status === 'failed') {
          return <XCircle className="w-4 h-4" />;
        }
        return <CreditCard className="w-4 h-4" />;
      case 'status_change':
        return <Clock className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getIconColor = (type: string, status?: string) => {
    switch (type) {
      case 'activity':
        return 'bg-blue-100 text-blue-600';
      case 'quotation':
        return 'bg-emerald-100 text-emerald-600';
      case 'email':
        return 'bg-purple-100 text-purple-600';
      case 'payment':
        if (status === 'verified') {
          return 'bg-green-100 text-green-600';
        } else if (status === 'rejected' || status === 'failed') {
          return 'bg-red-100 text-red-600';
        }
        return 'bg-cyan-100 text-cyan-600';
      case 'status_change':
        return 'bg-amber-100 text-amber-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-600">Loading timeline...</div>;
  }

  if (timeline.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-lg">
        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-600">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-slate-900">Timeline</h3>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>
        <div className="space-y-6">
          {timeline.map((item) => (
            <div key={item.id} className="relative flex gap-4">
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getIconColor(
                  item.type,
                  item.status
                )} z-10`}
              >
                {getIcon(item.type, item.status)}
              </div>
              <div className="flex-1 bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-1">
                  <h4 className="font-medium text-slate-900">{item.title}</h4>
                  <span className="text-xs text-slate-500">{formatTimestamp(item.timestamp)}</span>
                </div>
                {item.description && (
                  <p className="text-sm text-slate-600 mb-2">{item.description}</p>
                )}
                {item.user && (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <User className="w-3 h-3" />
                    {item.user}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
