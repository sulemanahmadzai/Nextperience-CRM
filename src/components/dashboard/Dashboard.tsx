import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { Users, TrendingUp, Activity, Package, DollarSign, CheckCircle } from 'lucide-react';

export function Dashboard() {
  const { currentCompany } = useCompany();
  const [stats, setStats] = useState({
    customers: 0,
    leads: 0,
    activities: 0,
    products: 0,
    wonLeads: 0,
    totalLeadValue: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany) {
      loadStats();
    }
  }, [currentCompany]);

  const loadStats = async () => {
    if (!currentCompany) return;

    setLoading(true);

    const [customersRes, leadsRes, activitiesRes, productsRes, wonLeadsRes] = await Promise.all([
      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', currentCompany.id)
        .eq('is_archived', false),
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', currentCompany.id)
        .eq('is_archived', false),
      supabase
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', currentCompany.id),
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', currentCompany.id)
        .eq('is_active', true),
      supabase
        .from('leads')
        .select('value')
        .eq('company_id', currentCompany.id)
        .eq('stage', 'won')
    ]);

    const wonLeadsCount = wonLeadsRes.data?.length || 0;
    const totalValue = wonLeadsRes.data?.reduce((sum, lead) => sum + (lead.value || 0), 0) || 0;

    setStats({
      customers: customersRes.count || 0,
      leads: leadsRes.count || 0,
      activities: activitiesRes.count || 0,
      products: productsRes.count || 0,
      wonLeads: wonLeadsCount,
      totalLeadValue: totalValue
    });

    setLoading(false);
  };

  const statCards = [
    {
      label: 'Total Customers',
      value: stats.customers,
      icon: Users,
      color: 'bg-blue-100 text-blue-600'
    },
    {
      label: 'Active Leads',
      value: stats.leads,
      icon: TrendingUp,
      color: 'bg-amber-100 text-amber-600'
    },
    {
      label: 'Won Deals',
      value: stats.wonLeads,
      icon: CheckCircle,
      color: 'bg-green-100 text-green-600'
    },
    {
      label: 'Total Activities',
      value: stats.activities,
      icon: Activity,
      color: 'bg-purple-100 text-purple-600'
    },
    {
      label: 'Products',
      value: stats.products,
      icon: Package,
      color: 'bg-slate-100 text-slate-600'
    },
    {
      label: 'Revenue (Won)',
      value: `$${stats.totalLeadValue.toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-emerald-100 text-emerald-600'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-2">{stat.label}</p>
                  <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Welcome to The Nextperience Group CRM</h2>
        <p className="text-slate-600">
          This is your central hub for managing customer relationships. Use the navigation above to access
          different sections of the CRM. All data is automatically scoped to your current company selection.
        </p>
      </div>
    </div>
  );
}
