import React, { useState, useEffect, useMemo } from 'react';
import { 
  LifeBuoy, 
  Search, 
  Filter, 
  MessageSquare, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Send, 
  User as UserIcon, 
  Phone, 
  Truck, 
  ShieldCheck, 
  ChevronRight, 
  RotateCcw, 
  XCircle,
  Building2,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { SupportTicket, TicketCategory, TicketPriority, TicketStatus, User } from '../../types';
import { logisticsStore } from '../../services/store';

interface AdminSupportDeskProps {
  currentUser: User;
}

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  payment_billing: 'Payment & Settlement',
  e_way_bill_gst: 'e-Way Bill & GST',
  fastag_toll: 'Fastag & Toll Plaza',
  vehicle_breakdown: 'Breakdown & Towing',
  transit_delay: 'Transit Delay',
  cargo_damage: 'Cargo Damage & Claims',
  kyc_verification: 'KYC Verification',
  app_technical: 'Technical / App',
  general_inquiry: 'General Inquiry'
};

const PRESET_RESOLUTIONS = [
  {
    label: 'e-Way Part-B Updated',
    text: 'Vehicle number successfully re-assigned to Part-B of the GST e-Way bill portal. Transshipment document registered. Safe to proceed.'
  },
  {
    label: 'Fastag Toll Dispute Logged',
    text: 'Fastag double-charge dispute lodged with NHAI IHMCL desk under ref #IHMCL-NE9921. Refund of the duplicate debit will be credited to wallet within 48h.'
  },
  {
    label: 'Roadside Recovery Dispatched',
    text: 'Zuggi Highway Assistance team and commercial towing crane have been dispatched to your highway milestone. ETA 25 minutes.'
  },
  {
    label: 'TDS / Payment Reconciled',
    text: 'Bank settlement UTR verified with State Bank of India CMS gateway. Section 194C TDS certificate updated in your portal.'
  }
];

export const AdminSupportDesk: React.FC<AdminSupportDeskProps> = ({ currentUser }) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TicketPriority>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'customer' | 'driver'>('all');

  // Reply Input & Action Feedback
  const [replyMessage, setReplyMessage] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const refreshTickets = () => {
    const list = logisticsStore.getTickets('admin');
    setTickets(list);
    if (!selectedTicketId && list.length > 0) {
      setSelectedTicketId(list[0].id);
    }
  };

  useEffect(() => {
    refreshTickets();
    const unsub = logisticsStore.subscribe(refreshTickets);
    return unsub;
  }, []);

  const selectedTicket = useMemo(() => {
    return tickets.find((t) => t.id === selectedTicketId) || tickets[0] || null;
  }, [tickets, selectedTicketId]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (roleFilter !== 'all' && t.userRole !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = t.ticketNumber.toLowerCase().includes(q);
        const matchesSubject = t.subject.toLowerCase().includes(q);
        const matchesUser = t.userName.toLowerCase().includes(q);
        const matchesPhone = t.userPhone.toLowerCase().includes(q);
        if (!matchesId && !matchesSubject && !matchesUser && !matchesPhone) return false;
      }
      return true;
    });
  }, [tickets, statusFilter, priorityFilter, roleFilter, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((t) => t.status === 'open').length;
    const inProgress = tickets.filter((t) => t.status === 'in_progress').length;
    const critical = tickets.filter((t) => t.priority === 'critical' && t.status !== 'resolved' && t.status !== 'closed').length;
    const resolved = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length;
    return { total, open, inProgress, critical, resolved };
  }, [tickets]);

  const handleStatusChange = (status: TicketStatus) => {
    if (!selectedTicket) return;
    const updated = logisticsStore.updateTicketStatus(
      selectedTicket.id,
      status,
      `Status updated by ${currentUser.name}`,
      currentUser.name
    );
    if (updated) {
      setActionSuccess(`Ticket ${selectedTicket.ticketNumber} marked as ${status.replace('_', ' ').toUpperCase()}`);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const handlePriorityChange = (priority: TicketPriority) => {
    if (!selectedTicket) return;
    logisticsStore.updateTicketPriority(selectedTicket.id, priority);
    setActionSuccess(`Priority updated to ${priority.toUpperCase()}`);
    setTimeout(() => setActionSuccess(null), 2500);
  };

  const handleSendAdminReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;

    logisticsStore.addTicketMessage(selectedTicket.id, {
      senderId: currentUser.id,
      senderName: `${currentUser.name} (Operations)`,
      senderRole: 'admin',
      message: replyMessage.trim()
    });

    setReplyMessage('');
    setActionSuccess('Response dispatched and user notified in real time.');
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const handleApplyPreset = (presetText: string) => {
    setReplyMessage(presetText);
  };

  const getPriorityBadge = (p: TicketPriority) => {
    switch (p) {
      case 'critical':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">Critical</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30 uppercase">High</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">Medium</span>;
      case 'low':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">Low</span>;
    }
  };

  const getStatusBadge = (s: TicketStatus) => {
    switch (s) {
      case 'open':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">Open</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">In Progress</span>;
      case 'resolved':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">Resolved</span>;
      case 'closed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 uppercase">Closed</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 text-xs">Total Tickets</span>
          <div className="text-2xl font-black text-white font-mono">{metrics.total}</div>
          <span className="text-[10px] text-slate-500">All registered cases</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 text-xs">Open / Unassigned</span>
          <div className="text-2xl font-black text-blue-400 font-mono">{metrics.open}</div>
          <span className="text-[10px] text-blue-400/80">Pending first action</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 text-xs">In Progress</span>
          <div className="text-2xl font-black text-amber-400 font-mono">{metrics.inProgress}</div>
          <span className="text-[10px] text-amber-400/80">Under investigation</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 text-xs flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Critical Alerts</span>
          </span>
          <div className="text-2xl font-black text-rose-400 font-mono">{metrics.critical}</div>
          <span className="text-[10px] text-rose-400/80">Requires urgent response</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 col-span-2 sm:col-span-1">
          <span className="text-slate-400 text-xs">Resolved</span>
          <div className="text-2xl font-black text-emerald-400 font-mono">{metrics.resolved}</div>
          <span className="text-[10px] text-emerald-400">Successfully closed</span>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Ticket ID (e.g. TICK-8021), subject, customer or driver name..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Submitter Roles</option>
              <option value="customer">Shipper / Customer Cases</option>
              <option value="driver">Driver / Transporter Cases</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Split Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Tickets List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Showing {filteredTickets.length} cases</span>
            <span>Sorted by latest activity</span>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2 text-slate-400 text-xs">
              <LifeBuoy className="w-8 h-8 text-slate-600 mx-auto" />
              <p>No tickets match current search or filters.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
              {filteredTickets.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-2 text-xs shadow-sm ${
                      isSelected
                        ? 'bg-slate-900 border-amber-500/80 shadow-md ring-1 ring-amber-500/30'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-amber-400">{t.ticketNumber}</span>
                        {getStatusBadge(t.status)}
                        {getPriorityBadge(t.priority)}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {new Date(t.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-100 line-clamp-1">{t.subject}</h4>
                      <p className="text-slate-400 text-[11px] line-clamp-2 mt-0.5">{t.description}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300 font-medium">{t.userName}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[9px] uppercase font-bold text-slate-400">
                          {t.userRole}
                        </span>
                      </div>
                      <span className="text-amber-400 font-semibold">{t.messages.length} msgs</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Case Investigation & Action Desk (7 cols) */}
        <div className="lg:col-span-7">
          {selectedTicket ? (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden space-y-4 p-5">
              
              {/* Header & Status Management Toolbar */}
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-amber-400">{selectedTicket.ticketNumber}</span>
                    {getStatusBadge(selectedTicket.status)}
                    {getPriorityBadge(selectedTicket.priority)}
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                      {CATEGORY_LABELS[selectedTicket.category] || selectedTicket.category}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-white mt-1">
                    {selectedTicket.subject}
                  </h2>
                </div>

                {/* Status Switcher Dropdown */}
                <div className="flex items-center gap-2 text-xs">
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-semibold focus:outline-none focus:border-amber-500"
                  >
                    <option value="open">Status: OPEN</option>
                    <option value="in_progress">Status: IN PROGRESS</option>
                    <option value="resolved">Status: RESOLVED</option>
                    <option value="closed">Status: CLOSED</option>
                  </select>

                  <select
                    value={selectedTicket.priority}
                    onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-semibold focus:outline-none focus:border-amber-500"
                  >
                    <option value="critical">Priority: CRITICAL</option>
                    <option value="high">Priority: HIGH</option>
                    <option value="medium">Priority: MEDIUM</option>
                    <option value="low">Priority: LOW</option>
                  </select>
                </div>
              </div>

              {/* Submitter & Load Profile Banner */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Submitter</span>
                  <div className="font-semibold text-slate-200">{selectedTicket.userName}</div>
                  <span className="text-[10px] text-slate-400 capitalize">{selectedTicket.userRole}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Contact Phone</span>
                  <div className="font-mono text-slate-200 font-medium flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-400" />
                    <span>{selectedTicket.userPhone}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Filed On</span>
                  <div className="text-slate-300 font-medium">
                    {new Date(selectedTicket.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Linked Consignment</span>
                  {selectedTicket.relatedLoadId ? (
                    <div className="font-mono text-amber-400 font-bold flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      <span>{selectedTicket.relatedLoadId}</span>
                    </div>
                  ) : (
                    <span className="text-slate-500 italic">None (General)</span>
                  )}
                </div>
              </div>

              {/* Quick Response Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Quick Resolution Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_RESOLUTIONS.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleApplyPreset(p.text)}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-amber-400 text-[11px] font-medium transition cursor-pointer"
                    >
                      + {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conversation Log */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Case Timeline & Messages</span>
                </h4>

                <div className="max-h-80 overflow-y-auto space-y-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  {selectedTicket.messages.map((m) => {
                    const isAdmin = m.senderRole === 'admin';
                    const isSystem = m.senderRole === 'system';

                    if (isSystem) {
                      return (
                        <div key={m.id} className="text-center my-2">
                          <span className="inline-block px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-400 font-mono">
                            {m.message}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-300">{m.senderName}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border ${
                            isAdmin
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          }`}>
                            {m.senderRole}
                          </span>
                          <span>•</span>
                          <span>{new Date(m.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div
                          className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${
                            isAdmin
                              ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none'
                              : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.message}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Admin Reply Form */}
                <form onSubmit={handleSendAdminReply} className="pt-2 space-y-2">
                  <div className="flex gap-2">
                    <textarea
                      rows={3}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type official operations guidance, highway assistance details, or settlement confirmation to the customer/driver..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                    />
                    <button
                      type="submit"
                      disabled={!replyMessage.trim()}
                      className="px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex flex-col items-center justify-center transition cursor-pointer shrink-0"
                    >
                      <Send className="w-4 h-4" />
                      <span className="text-[10px] mt-1">Reply</span>
                    </button>
                  </div>
                </form>
              </div>

            </div>
          ) : (
            <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-500 text-xs">
              Select a support ticket from the list to view investigation details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
