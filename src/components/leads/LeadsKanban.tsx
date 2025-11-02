import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import type { Lead, PipelineStage, Customer } from '../../lib/database.types';
import { Plus, Mail, Phone, User, Edit2, Trash2, Eye, X, Users, Search, ArrowUpDown, Calendar, Lock } from 'lucide-react';
import { LeadModal } from './LeadModal';
import { getUserPermissions, canDeleteLead, logAuditAction, type UserPermissions } from '../../lib/permissions';

type LeadWithCustomer = Lead & {
  customer?: Customer;
  creator?: { email: string };
};

interface LeadsKanbanProps {
  onViewLead?: (leadId: string) => void;
  onViewCalendar?: () => void;
}

export function LeadsKanban({ onViewLead, onViewCalendar }: LeadsKanbanProps) {
  const { currentCompany, permissions } = useCompany();
  const { user } = useAuth();
  const [leads, setLeads] = useState<LeadWithCustomer[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [editStageName, setEditStageName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'created' | 'event_date' | 'value_asc' | 'value_desc'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [createdMonthFilter, setCreatedMonthFilter] = useState<string>('');
  const [eventMonthFilter, setEventMonthFilter] = useState<string>('');
  const [creatorFilter, setCreatorFilter] = useState<string>('');
  const [allUsers, setAllUsers] = useState<Array<{ id: string; email: string }>>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [leadDeletePermissions, setLeadDeletePermissions] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (currentCompany) {
      loadData();
      loadUserPermissions();
      loadUsers();
    }
  }, [currentCompany]);

  const loadUserPermissions = async () => {
    const perms = await getUserPermissions();
    setUserPermissions(perms);
  };

  const loadUsers = async () => {
    if (!currentCompany) return;

    const { data: leadsData } = await supabase
      .from('leads')
      .select('created_by')
      .eq('company_id', currentCompany.id)
      .not('created_by', 'is', null);

    if (leadsData) {
      const uniqueCreatorIds = [...new Set(
        leadsData
          .map(lead => lead.created_by)
          .filter((id): id is string => id != null)
      )];

      if (uniqueCreatorIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, email')
          .in('id', uniqueCreatorIds);

        if (usersData) {
          setAllUsers(usersData);
        }
      }
    }
  };

  const checkLeadDeletePermissions = async (leadIds: string[]) => {
    if (leadIds.length === 0) {
      setLeadDeletePermissions({});
      return;
    }

    try {
      const { data, error } = await supabase.rpc('can_delete_leads_batch', {
        lead_uuids: leadIds
      });

      if (error) {
        console.error('Error checking lead delete permissions:', error);
        setLeadDeletePermissions({});
        return;
      }

      setLeadDeletePermissions(data || {});
    } catch (err) {
      console.error('Error in batch permission check:', err);
      setLeadDeletePermissions({});
    }
  };

  const loadData = async () => {
    if (!currentCompany) return;

    setLoading(true);

    const [stagesRes, leadsRes] = await Promise.all([
      supabase
        .from('pipeline_stages')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('order'),
      supabase
        .from('leads')
        .select(`
          *,
          customer:customers!leads_customer_id_fkey(*)
        `)
        .eq('company_id', currentCompany.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
    ]);

    if (stagesRes.data) setStages(stagesRes.data);

    if (leadsRes.data) {
      const uniqueCreatorIds = [...new Set(
        leadsRes.data
          .map(lead => lead.created_by)
          .filter((id): id is string => id != null)
      )];

      let creatorsMap: { [key: string]: { email: string } } = {};

      if (uniqueCreatorIds.length > 0) {
        const { data: creatorsData } = await supabase
          .from('users')
          .select('id, email')
          .in('id', uniqueCreatorIds);

        if (creatorsData) {
          creatorsMap = creatorsData.reduce((acc, creator) => {
            acc[creator.id] = { email: creator.email };
            return acc;
          }, {} as { [key: string]: { email: string } });
        }
      }

      const leadsWithCreators = leadsRes.data.map(lead => ({
        ...lead,
        creator: lead.created_by ? creatorsMap[lead.created_by] : undefined
      }));

      setLeads(leadsWithCreators as LeadWithCustomer[]);
      setLoading(false);

      const leadIds = leadsRes.data.map(l => l.id);
      checkLeadDeletePermissions(leadIds);
    } else {
      setLoading(false);
    }
  };

  const logAudit = async (leadId: string, oldStageId: string | null, newStageId: string) => {
    if (!user || !currentCompany) return;

    const oldStage = stages.find(s => s.id === oldStageId);
    const newStage = stages.find(s => s.id === newStageId);

    await supabase.from('audit_logs').insert({
      company_id: currentCompany.id,
      user_id: user.id,
      entity_type: 'lead',
      entity_id: leadId,
      action: 'moved',
      old_value: { stage: oldStage?.name || 'None', stage_id: oldStageId },
      new_value: { stage: newStage?.name || 'Unknown', stage_id: newStageId }
    });
  };

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    if (!userPermissions?.canMove) {
      e.preventDefault();
      return;
    }
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e: React.DragEvent, newStageId: string) => {
    e.preventDefault();
    setDragOverStage(null);

    if (!draggedLead || draggedLead.stage_id === newStageId) {
      setDraggedLead(null);
      return;
    }

    const oldStageId = draggedLead.stage_id;

    setLeads(prevLeads =>
      prevLeads.map(lead =>
        lead.id === draggedLead.id ? { ...lead, stage_id: newStageId } : lead
      )
    );

    const { error } = await supabase
      .from('leads')
      .update({
        stage_id: newStageId,
        updated_at: new Date().toISOString()
      })
      .eq('id', draggedLead.id);

    if (!error) {
      await logAuditAction('leads', draggedLead.id, 'moved',
        { stage_id: oldStageId },
        { stage_id: newStageId }
      );
    } else {
      await loadData();
    }

    setDraggedLead(null);
  };

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead);
    setIsModalOpen(true);
  };

  const handleViewLead = (lead: Lead) => {
    onViewLead?.(lead.id);
  };

  const handleDeleteLead = async (lead: Lead) => {
    const canDelete = leadDeletePermissions[lead.id];

    if (!canDelete) {
      alert('You do not have permission to delete this lead. It may have a verified payment attached.');
      return;
    }

    if (!confirm(`Are you sure you want to delete the lead "${lead.name}"?`)) {
      return;
    }

    const { error } = await supabase
      .from('leads')
      .update({ is_archived: true })
      .eq('id', lead.id);

    if (!error) {
      await logAuditAction('leads', lead.id, 'deleted', { lead }, null);
      await loadData();
    }
  };

  const handleAddLead = () => {
    setSelectedLead(null);
    setIsModalOpen(true);
  };

  const getStageLeads = (stageId: string, useFiltered = false) => {
    const sourceLeads = useFiltered ? filteredLeads : leads;
    return sourceLeads.filter(lead => lead.stage_id === stageId);
  };

  const getTotalValue = (stageId: string) => {
    return getStageLeads(stageId).reduce((sum, lead) => sum + (lead.event_value || 0), 0);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (value: number) => {
    return '₱' + new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const startEditStage = (stage: PipelineStage) => {
    setEditingStage(stage.id);
    setEditStageName(stage.name);
  };

  const handleUpdateStageName = async (stageId: string) => {
    if (!editStageName.trim()) return;

    const { error } = await supabase
      .from('pipeline_stages')
      .update({
        name: editStageName,
        updated_at: new Date().toISOString()
      })
      .eq('id', stageId);

    if (!error) {
      await loadData();
      setEditingStage(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-600">Loading pipeline...</div>
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
          <p className="text-slate-600 mb-4">No pipeline stages configured for this company.</p>
          <p className="text-sm text-slate-500">Go to Settings → Pipeline to create your pipeline stages.</p>
        </div>
      </div>
    );
  }

  const sortLeads = (leadsToSort: LeadWithCustomer[]) => {
    return [...leadsToSort].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'created': {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          comparison = dateB - dateA;
          break;
        }
        case 'event_date': {
          const dateA = a.event_date ? new Date(a.event_date).getTime() : 0;
          const dateB = b.event_date ? new Date(b.event_date).getTime() : 0;
          comparison = dateA - dateB;
          break;
        }
        case 'value_asc': {
          const valueA = a.expected_value || 0;
          const valueB = b.expected_value || 0;
          comparison = valueA - valueB;
          break;
        }
        case 'value_desc': {
          const valueA = a.expected_value || 0;
          const valueB = b.expected_value || 0;
          comparison = valueB - valueA;
          break;
        }
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const filteredLeads = leads.filter((lead) => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const customerName = lead.customer?.name?.toLowerCase() || '';
      const companyName = lead.customer?.company_name?.toLowerCase() || '';
      const eventName = lead.event_name?.toLowerCase() || '';
      const eventType = lead.event_type?.toLowerCase() || '';
      const email = lead.customer?.email?.toLowerCase() || '';
      const phone = lead.customer?.phone?.toLowerCase() || '';
      const creatorEmail = lead.creator?.email?.toLowerCase() || '';

      const matchesSearch = (
        customerName.includes(query) ||
        companyName.includes(query) ||
        eventName.includes(query) ||
        eventType.includes(query) ||
        email.includes(query) ||
        phone.includes(query) ||
        creatorEmail.includes(query)
      );

      if (!matchesSearch) return false;
    }

    if (createdMonthFilter) {
      const [year, month] = createdMonthFilter.split('-');
      const leadDate = new Date(lead.created_at || '');
      const leadYear = leadDate.getFullYear().toString();
      const leadMonth = (leadDate.getMonth() + 1).toString().padStart(2, '0');

      if (leadYear !== year || leadMonth !== month) return false;
    }

    if (eventMonthFilter && lead.event_date) {
      const [year, month] = eventMonthFilter.split('-');
      const eventDate = new Date(lead.event_date);
      const eventYear = eventDate.getFullYear().toString();
      const eventMonth = (eventDate.getMonth() + 1).toString().padStart(2, '0');

      if (eventYear !== year || eventMonth !== month) return false;
    }

    if (creatorFilter && lead.created_by !== creatorFilter) {
      return false;
    }

    return true;
  });

  const sortedAndFilteredLeads = sortLeads(filteredLeads);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
        <div className="flex items-center gap-3">
          {onViewCalendar && (
            <button
              onClick={onViewCalendar}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Calendar
            </button>
          )}
          {permissions.leads.create && (
            <button
              onClick={handleAddLead}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Lead
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer, event, email, phone..."
              className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-600" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="created">Date Created</option>
              <option value="event_date">Event Date</option>
              <option value="value_asc">Value (Low to High)</option>
              <option value="value_desc">Value (High to Low)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 whitespace-nowrap">Created:</label>
            <select
              value={createdMonthFilter.split('-')[1] || ''}
              onChange={(e) => {
                const year = createdMonthFilter.split('-')[0] || new Date().getFullYear();
                setCreatedMonthFilter(e.target.value ? `${year}-${e.target.value}` : '');
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="">Month</option>
              <option value="01">January</option>
              <option value="02">February</option>
              <option value="03">March</option>
              <option value="04">April</option>
              <option value="05">May</option>
              <option value="06">June</option>
              <option value="07">July</option>
              <option value="08">August</option>
              <option value="09">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
            <select
              value={createdMonthFilter.split('-')[0] || ''}
              onChange={(e) => {
                const month = createdMonthFilter.split('-')[1] || '';
                setCreatedMonthFilter(e.target.value && month ? `${e.target.value}-${month}` : '');
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="">Year</option>
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            {createdMonthFilter && (
              <button
                onClick={() => setCreatedMonthFilter('')}
                className="text-slate-400 hover:text-slate-600"
                title="Clear filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 whitespace-nowrap">Event:</label>
            <select
              value={eventMonthFilter.split('-')[1] || ''}
              onChange={(e) => {
                const year = eventMonthFilter.split('-')[0] || new Date().getFullYear();
                setEventMonthFilter(e.target.value ? `${year}-${e.target.value}` : '');
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="">Month</option>
              <option value="01">January</option>
              <option value="02">February</option>
              <option value="03">March</option>
              <option value="04">April</option>
              <option value="05">May</option>
              <option value="06">June</option>
              <option value="07">July</option>
              <option value="08">August</option>
              <option value="09">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
            <select
              value={eventMonthFilter.split('-')[0] || ''}
              onChange={(e) => {
                const month = eventMonthFilter.split('-')[1] || '';
                setEventMonthFilter(e.target.value && month ? `${e.target.value}-${month}` : '');
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="">Year</option>
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            {eventMonthFilter && (
              <button
                onClick={() => setEventMonthFilter('')}
                className="text-slate-400 hover:text-slate-600"
                title="Clear filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 whitespace-nowrap">Creator:</label>
            <select
              value={creatorFilter}
              onChange={(e) => setCreatorFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="">All Creators</option>
              {allUsers.map(user => (
                <option key={user.id} value={user.id}>{user.email}</option>
              ))}
            </select>
            {creatorFilter && (
              <button
                onClick={() => setCreatorFilter('')}
                className="text-slate-400 hover:text-slate-600"
                title="Clear filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {(createdMonthFilter || eventMonthFilter) && (
            <button
              onClick={() => {
                setCreatedMonthFilter('');
                setEventMonthFilter('');
              }}
              className="text-sm text-slate-600 hover:text-slate-900 underline"
            >
              Clear all filters
            </button>
          )}
        </div>

        {(searchQuery || createdMonthFilter || eventMonthFilter) && (
          <p className="text-sm text-slate-600">
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''} found
          </p>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-6">
        {stages.map((stage) => {
          const stageLeads = sortedAndFilteredLeads.filter(lead => lead.stage_id === stage.id);
          const totalValue = getTotalValue(stage.id);
          const isDragOver = dragOverStage === stage.id;

          return (
            <div
              key={stage.id}
              className="flex-shrink-0 w-80"
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <div
                className="rounded-t-lg px-4 py-3 flex items-center justify-between"
                style={{ backgroundColor: stage.color }}
              >
                <div className="flex items-center gap-2 flex-1">
                  {editingStage === stage.id ? (
                    <input
                      type="text"
                      value={editStageName}
                      onChange={(e) => setEditStageName(e.target.value)}
                      onBlur={() => handleUpdateStageName(stage.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateStageName(stage.id);
                        if (e.key === 'Escape') setEditingStage(null);
                      }}
                      className="px-2 py-1 text-sm font-semibold text-white bg-white/20 rounded border-none outline-none focus:bg-white/30"
                      autoFocus
                    />
                  ) : (
                    <>
                      <h3 className="font-semibold text-white">{stage.name}</h3>
                      {permissions.leads.update && (
                        <button
                          onClick={() => startEditStage(stage)}
                          className="p-1 text-white/70 hover:text-white transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>
                <div className="text-sm font-medium text-white">
                  {stageLeads.length}
                </div>
              </div>

              <div className="bg-slate-50 px-4 py-2 text-xs text-slate-600 border-x border-slate-200">
                Total: {formatCurrency(totalValue)}
              </div>

              <div
                className={`min-h-[500px] bg-slate-100 border-x border-b border-slate-200 rounded-b-lg p-3 space-y-3 transition-colors ${
                  isDragOver ? 'bg-slate-200 border-slate-400' : ''
                }`}
              >
                {stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead)}
                    className="bg-white rounded-lg border border-slate-200 p-4 cursor-move hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900 text-sm leading-tight">
                          {lead.event_name || lead.name || 'Untitled Lead'}
                        </h4>
                        {lead.event_name && lead.name && (
                          <p className="text-xs text-slate-600 mt-0.5">{lead.name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewLead(lead);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {userPermissions?.canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditLead(lead);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-900 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {userPermissions?.canDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (leadDeletePermissions[lead.id]) {
                                handleDeleteLead(lead);
                              }
                            }}
                            disabled={!leadDeletePermissions[lead.id]}
                            className={`p-1 transition-colors ${
                              leadDeletePermissions[lead.id]
                                ? 'text-slate-400 hover:text-red-600 cursor-pointer'
                                : 'text-slate-300 cursor-not-allowed'
                            }`}
                            title={
                              leadDeletePermissions[lead.id]
                                ? 'Delete'
                                : 'Locked: This record has a verified payment attached.'
                            }
                          >
                            {leadDeletePermissions[lead.id] ? (
                              <Trash2 className="w-4 h-4" />
                            ) : (
                              <Lock className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {lead.customer && (
                      <div className="flex items-center gap-1 mb-2">
                        <User className="w-3 h-3 text-slate-500" />
                        <span className="text-xs font-medium text-slate-700">{lead.customer.name}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mb-2">
                      {lead.event_date && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {formatDate(lead.event_date)}
                        </span>
                      )}
                      {lead.event_type && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                          {lead.event_type}
                        </span>
                      )}
                      {lead.expected_pax && lead.expected_pax > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                          <Users className="w-3 h-3" />
                          {lead.expected_pax} PAX
                        </span>
                      )}
                    </div>

                    {lead.event_value && lead.event_value > 0 && (
                      <div className="text-sm font-semibold text-green-700 mb-2">
                        {formatCurrency(lead.event_value)}
                      </div>
                    )}

                    {lead.company_name && (
                      <p className="text-xs text-slate-600 mb-1">{lead.company_name}</p>
                    )}

                    {lead.creator && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{lead.creator.email}</span>
                      </div>
                    )}
                  </div>
                ))}

                {stageLeads.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    No leads in this stage
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <LeadModal
          lead={selectedLead}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedLead(null);
          }}
          onSuccess={loadData}
        />
      )}

    </div>
  );
}
