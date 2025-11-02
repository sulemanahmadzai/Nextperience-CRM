import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Filter, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import LeadDetailView from '../leads/LeadDetailView';
import type { Lead, PipelineStage } from '../../lib/database.types';

interface Holiday {
  id: string;
  date: string;
  name: string;
  type: 'regular' | 'special';
}

interface LeadEvent extends Lead {
  customer?: { name: string };
}

interface CalendarViewProps {
  onBack?: () => void;
}

export default function CalendarView({ onBack }: CalendarViewProps) {
  const { currentCompany } = useCompany();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leads, setLeads] = useState<LeadEvent[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [showStageFilter, setShowStageFilter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  useEffect(() => {
    if (currentCompany) {
      loadData();
    }
  }, [currentCompany, currentDate]);

  const loadData = async () => {
    if (!currentCompany) return;

    setLoading(true);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const [stagesRes, leadsRes, holidaysRes] = await Promise.all([
      supabase
        .from('pipeline_stages')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('order'),
      supabase
        .from('leads')
        .select(`
          *,
          customer:customers!leads_customer_id_fkey(name)
        `)
        .eq('company_id', currentCompany.id)
        .not('event_date', 'is', null)
        .gte('event_date', firstDay.toISOString().split('T')[0])
        .lte('event_date', lastDay.toISOString().split('T')[0]),
      supabase
        .from('philippine_holidays')
        .select('*')
        .eq('year', year)
    ]);

    if (stagesRes.data) {
      setStages(stagesRes.data);
      if (selectedStages.length === 0) {
        setSelectedStages(stagesRes.data.map(s => s.id));
      }
    }

    if (leadsRes.data) {
      setLeads(leadsRes.data as LeadEvent[]);
    }

    if (holidaysRes.data) {
      setHolidays(holidaysRes.data);
    }

    setLoading(false);
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevMonthDay = new Date(year, month, -startingDayOfWeek + i + 1);
      days.push({ date: prevMonthDay, isCurrentMonth: false });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const nextMonthDay = new Date(year, month + 1, i);
      days.push({ date: nextMonthDay, isCurrentMonth: false });
    }

    return days;
  };

  const getLeadsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return leads.filter(lead => {
      if (!lead.event_date) return false;
      const leadDate = lead.event_date.split('T')[0];
      return leadDate === dateStr && selectedStages.includes(lead.stage_id || '');
    });
  };

  const getHolidayForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return holidays.find(h => h.date === dateStr);
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const toggleStage = (stageId: string) => {
    setSelectedStages(prev =>
      prev.includes(stageId)
        ? prev.filter(id => id !== stageId)
        : [...prev, stageId]
    );
  };

  const selectAllStages = () => {
    setSelectedStages(stages.map(s => s.id));
  };

  const deselectAllStages = () => {
    setSelectedStages([]);
  };

  const getStageColor = (stageId: string) => {
    const stage = stages.find(s => s.id === stageId);
    return stage?.color || '#64748b';
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const days = getDaysInMonth();

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-slate-600">Loading calendar...</div>
        </div>
      </div>
    );
  }

  if (selectedLeadId) {
    return (
      <div className="p-6">
        <LeadDetailView
          leadId={selectedLeadId}
          onBack={() => setSelectedLeadId(null)}
          onViewQuotation={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Pipeline
              </button>
            )}
            <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={goToToday}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Today
            </button>
            <div className="relative">
              <button
                onClick={() => setShowStageFilter(!showStageFilter)}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <Filter className="w-4 h-4" />
                Filter Stages ({selectedStages.length}/{stages.length})
              </button>
              {showStageFilter && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-10">
                  <div className="p-3 border-b border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-900">Pipeline Stages</span>
                      <div className="flex gap-2">
                        <button
                          onClick={selectAllStages}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          All
                        </button>
                        <button
                          onClick={deselectAllStages}
                          className="text-xs text-slate-600 hover:text-slate-700"
                        >
                          None
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 max-h-64 overflow-y-auto">
                    {stages.map(stage => (
                      <label
                        key={stage.id}
                        className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStages.includes(stage.id)}
                          onChange={() => toggleStage(stage.id)}
                          className="rounded border-slate-300"
                        />
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: stage.color || '#64748b' }}
                        />
                        <span className="text-sm text-slate-900">{stage.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={goToPreviousMonth}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-slate-900 min-w-[200px] text-center">
              {monthYear}
            </h2>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div
              key={day}
              className="p-3 text-center text-sm font-semibold text-slate-600"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const dayLeads = getLeadsForDate(day.date);
            const holiday = getHolidayForDate(day.date);
            const isTodayDate = isToday(day.date);

            return (
              <div
                key={index}
                className={`min-h-[120px] p-2 border-b border-r border-slate-200 ${
                  !day.isCurrentMonth ? 'bg-slate-50' : ''
                } ${isTodayDate ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-sm font-medium ${
                      !day.isCurrentMonth
                        ? 'text-slate-400'
                        : isTodayDate
                        ? 'text-blue-600 font-bold'
                        : 'text-slate-900'
                    }`}
                  >
                    {day.date.getDate()}
                  </span>
                </div>

                {holiday && (
                  <div
                    className={`text-xs px-2 py-1 rounded mb-1 ${
                      holiday.type === 'regular'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                    title={holiday.name}
                  >
                    {holiday.name.length > 15
                      ? holiday.name.substring(0, 15) + '...'
                      : holiday.name}
                  </div>
                )}

                <div className="space-y-1">
                  {dayLeads.slice(0, 3).map(lead => (
                    <div
                      key={lead.id}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className="text-xs px-2 py-1 rounded text-white truncate cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: getStageColor(lead.stage_id || '') }}
                      title={`${lead.event_name || lead.name} - ${lead.customer?.name || ''}`}
                    >
                      {lead.event_name || lead.name}
                    </div>
                  ))}
                  {dayLeads.length > 3 && (
                    <div className="text-xs text-slate-500 px-2">
                      +{dayLeads.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-100 border border-red-200 rounded" />
          <span className="text-slate-600">Regular Holiday</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-100 border border-orange-200 rounded" />
          <span className="text-slate-600">Special Holiday</span>
        </div>
      </div>
    </div>
  );
}
