import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  LifeBuoy, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Send, 
  PlusCircle, 
  ChevronRight, 
  FileText, 
  Truck, 
  ShieldCheck, 
  PhoneCall, 
  HelpCircle,
  ArrowLeft,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { SupportTicket, TicketCategory, TicketPriority, User, LoadItem } from '../../types';
import { logisticsStore } from '../../services/store';

interface SupportTicketModalProps {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  preselectedLoadId?: string;
}

const CATEGORY_CONFIG: Record<TicketCategory, { label: string; icon: string; description: string }> = {
  payment_billing: {
    label: 'Payment & Settlement',
    icon: '💳',
    description: 'Advance freight payment, TDS u/s 194C, bank UTR transfer delay, wallet balance'
  },
  e_way_bill_gst: {
    label: 'e-Way Bill & GST Compliance',
    icon: '📜',
    description: 'Part-B vehicle number update, transshipment slip, GST RCM invoice correction'
  },
  fastag_toll: {
    label: 'Fastag & Toll Plazas',
    icon: '🛣️',
    description: 'Double toll deduction, blacklisted tag dispute on NH-27/NH-37 corridor plazas'
  },
  vehicle_breakdown: {
    label: 'Vehicle Breakdown & Recovery',
    icon: '🛠️',
    description: 'Highway mechanical failure, tire burst, towing & roadside crane assistance'
  },
  transit_delay: {
    label: 'Transit Delay & Route Block',
    icon: '⏱️',
    description: 'Hill landslide, flooding, traffic gridlock, commercial gate congestion'
  },
  cargo_damage: {
    label: 'Cargo Damage & Claims',
    icon: '📦',
    description: 'Packaging breach, transit weather moisture, insurance surveyor request'
  },
  kyc_verification: {
    label: 'KYC & Document Verification',
    icon: '🪪',
    description: 'PAN, Aadhaar, Commercial RC, Fitness, National Permit approval'
  },
  app_technical: {
    label: 'Technical / App Issue',
    icon: '📱',
    description: 'GPS telemetry lag, OTP delivery failure, booking screen error'
  },
  general_inquiry: {
    label: 'General Inquiry / Pricing',
    icon: '💬',
    description: 'Corridor rate inquiries, fleet onboarding, contract freight quotes'
  }
};

export const SupportTicketModal: React.FC<SupportTicketModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  preselectedLoadId
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [loads, setLoads] = useState<LoadItem[]>([]);

  // Form State
  const [category, setCategory] = useState<TicketCategory>('e_way_bill_gst');
  const [priority, setPriority] = useState<TicketPriority>('high');
  const [relatedLoadId, setRelatedLoadId] = useState<string>(preselectedLoadId || '');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Reply message state
  const [replyText, setReplyText] = useState('');

  const refreshTickets = () => {
    const list = logisticsStore.getTickets(currentUser.role, currentUser.id);
    setTickets(list);
    const allLoads = logisticsStore.getLoads();
    if (currentUser.role === 'admin') {
      setLoads(allLoads);
    } else if (currentUser.role === 'customer') {
      setLoads(allLoads.filter((l) => l.customerId === currentUser.id));
    } else {
      const myLoadIds = new Set(
        logisticsStore
          .getBookings()
          .filter((b) => b.driverId === currentUser.id || b.transporterId === currentUser.id)
          .map((b) => b.loadId)
      );
      setLoads(allLoads.filter((l) => myLoadIds.has(l.id)));
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshTickets();
      if (preselectedLoadId) {
        setRelatedLoadId(preselectedLoadId);
        setActiveTab('create');
        setSelectedTicketId(null);
      }
      const unsub = logisticsStore.subscribe(refreshTickets);
      return unsub;
    }
  }, [isOpen, currentUser, preselectedLoadId]);

  const selectedTicket = useMemo(() => {
    if (!selectedTicketId) return null;
    return tickets.find((t) => t.id === selectedTicketId) || null;
  }, [tickets, selectedTicketId]);

  const filteredTickets = useMemo(() => {
    if (statusFilter === 'all') return tickets;
    if (statusFilter === 'open') return tickets.filter((t) => t.status === 'open');
    if (statusFilter === 'in_progress') return tickets.filter((t) => t.status === 'in_progress');
    if (statusFilter === 'resolved') return tickets.filter((t) => t.status === 'resolved' || t.status === 'closed');
    return tickets;
  }, [tickets, statusFilter]);

  const openTicketsCount = useMemo(() => {
    return tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
  }, [tickets]);

  if (!isOpen) return null;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!subject.trim()) {
      setFormError('Please enter a brief subject for your issue.');
      return;
    }
    if (!description.trim() || description.trim().length < 15) {
      setFormError('Please describe your issue with at least 15 characters.');
      return;
    }

    const newTicket = logisticsStore.createTicket({
      userId: currentUser.id,
      userName: currentUser.name,
      userPhone: currentUser.phone,
      userRole: currentUser.role,
      category,
      priority,
      subject: subject.trim(),
      description: description.trim(),
      relatedLoadId: relatedLoadId || undefined
    });

    setSubject('');
    setDescription('');
    setSubmitSuccess(`Ticket ${newTicket.ticketNumber} submitted successfully! Our 24/7 operations desk has been alerted.`);
    setTimeout(() => {
      setSubmitSuccess(null);
      setSelectedTicketId(newTicket.id);
      setActiveTab('list');
    }, 1200);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    logisticsStore.addTicketMessage(selectedTicket.id, {
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role as any,
      message: replyText.trim()
    });

    setReplyText('');
  };

  const handleMarkResolved = (ticketId: string) => {
    logisticsStore.updateTicketStatus(
      ticketId, 
      'resolved', 
      'Case marked as resolved by user.', 
      currentUser.name
    );
  };

  const handleReopenTicket = (ticketId: string) => {
    logisticsStore.updateTicketStatus(
      ticketId, 
      'open', 
      'Ticket reopened by user for additional assistance.', 
      currentUser.name
    );
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

  const getStatusBadge = (s: string) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Zuggi 24/7 Operations & Support Desk
                </h2>
                {openTicketsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                    {openTicketsCount} Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Assam & Northeast corridor freight emergency helpline, e-Way compliance, and fast settlement support.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
              <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
              <span>Toll-Free: 1800-419-8989</span>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Close Helpdesk"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 pt-3 pb-2 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('list');
                setSelectedTicketId(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'list' && !selectedTicketId
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>My Support Cases ({tickets.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('create');
                setSelectedTicketId(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Report an Issue / New Ticket</span>
            </button>
          </div>

          {activeTab === 'list' && !selectedTicketId && (
            <div className="hidden sm:flex items-center gap-1 text-[11px]">
              <span className="text-slate-500">Filter:</span>
              {(['all', 'open', 'in_progress', 'resolved'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-2.5 py-1 rounded-md capitalize cursor-pointer transition ${
                    statusFilter === filter
                      ? 'bg-slate-800 text-amber-300 font-bold border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {filter.replace('_', ' ')}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* VIEW A: TICKET DETAIL & CONVERSATION */}
          {selectedTicket ? (
            <div className="space-y-4 max-w-3xl mx-auto">
              <button
                onClick={() => setSelectedTicketId(null)}
                className="flex items-center gap-1.5 text-xs text-amber-400 hover:underline font-semibold cursor-pointer pb-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to All Cases</span>
              </button>

              {/* Ticket Meta Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-400">
                        {selectedTicket.ticketNumber}
                      </span>
                      {getStatusBadge(selectedTicket.status)}
                      {getPriorityBadge(selectedTicket.priority)}
                    </div>
                    <h3 className="text-base font-bold text-white mt-1">
                      {selectedTicket.subject}
                    </h3>
                  </div>

                  {selectedTicket.status === 'resolved' ? (
                    <button
                      onClick={() => handleReopenTicket(selectedTicket.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Reopen Case</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleMarkResolved(selectedTicket.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-xs font-semibold border border-emerald-800 transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Resolved</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Category</span>
                    <span className="text-slate-200 font-medium">
                      {CATEGORY_CONFIG[selectedTicket.category]?.label || selectedTicket.category}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Reported By</span>
                    <span className="text-slate-200 font-medium">{selectedTicket.userName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Created</span>
                    <span className="text-slate-200 font-medium">
                      {new Date(selectedTicket.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Assigned Desk</span>
                    <span className="text-emerald-400 font-medium">
                      {selectedTicket.assignedAdminName || '24/7 Operations Officer'}
                    </span>
                  </div>
                </div>

                {selectedTicket.relatedLoadId && (
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Truck className="w-4 h-4 text-amber-400" />
                      <span>Linked Consignment Reference: <strong>{selectedTicket.relatedLoadId}</strong></span>
                    </div>
                    <span className="text-[11px] text-slate-400">NH-27 Northeast Freight</span>
                  </div>
                )}
              </div>

              {/* Chat Thread */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Case Communication Thread</span>
                </h4>

                <div className="space-y-3">
                  {selectedTicket.messages.map((msg) => {
                    const isUser = msg.senderId === currentUser.id;
                    const isSystem = msg.senderRole === 'system';

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="text-center my-3">
                          <span className="inline-block px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-[11px] text-slate-400 font-mono">
                            {msg.message}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-300">{msg.senderName}</span>
                          {!isUser && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase border border-amber-500/30">
                              Support Desk
                            </span>
                          )}
                          <span>•</span>
                          <span>{new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div
                          className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${
                            isUser
                              ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none'
                              : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Form */}
                {selectedTicket.status !== 'closed' && (
                  <form onSubmit={handleSendReply} className="pt-4 border-t border-slate-800/80 space-y-2">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Send Reply / Additional Details:
                    </label>
                    <div className="flex gap-2">
                      <textarea
                        rows={2}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your response, vehicle update, or question for the operations team..."
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                      />
                      <button
                        type="submit"
                        disabled={!replyText.trim()}
                        className="px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex flex-col items-center justify-center transition cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        <span className="text-[10px] mt-0.5">Send</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : activeTab === 'create' ? (
            /* VIEW B: CREATE NEW SUPPORT TICKET */
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-amber-400" />
                  <span>Report an Issue or Request Commercial Freight Assistance</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Our dedicated dispatch and logistics coordination desk responds within 15–30 minutes.
                </p>
              </div>

              {submitSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{submitSuccess}</span>
                </div>
              )}

              {formError && (
                <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                {/* Category Selection */}
                <div>
                  <label className="text-slate-300 font-semibold block mb-1.5">
                    Issue Category *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(Object.keys(CATEGORY_CONFIG) as TicketCategory[]).map((catKey) => {
                      const cfg = CATEGORY_CONFIG[catKey];
                      const isSelected = category === catKey;
                      return (
                        <div
                          key={catKey}
                          onClick={() => setCategory(catKey)}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-sm'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-semibold">
                            <span>{cfg.icon}</span>
                            <span className={isSelected ? 'text-amber-400' : 'text-slate-200'}>
                              {cfg.label}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                            {cfg.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Priority Selector */}
                <div>
                  <label className="text-slate-300 font-semibold block mb-1.5">
                    Severity / Priority Level *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'critical', label: 'Critical / Urgent', sub: 'Highway breakdown, police/tax stop' },
                      { id: 'high', label: 'High Priority', sub: 'Active trip delay, e-Way issue' },
                      { id: 'medium', label: 'Medium', sub: 'Fastag double charge, payout' },
                      { id: 'low', label: 'Low / General', sub: 'Invoice copy, general query' }
                    ].map((p) => {
                      const isSelected = priority === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPriority(p.id as TicketPriority)}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            isSelected
                              ? p.id === 'critical'
                                ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 font-bold'
                                : p.id === 'high'
                                ? 'bg-orange-500/20 border-orange-500/60 text-orange-300 font-bold'
                                : 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-bold'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="font-semibold text-xs">{p.label}</div>
                          <div className="text-[10px] opacity-80 mt-0.5">{p.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Related Consignment Link */}
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Related Consignment / Load (Optional)
                  </label>
                  <select
                    value={relatedLoadId}
                    onChange={(e) => setRelatedLoadId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- No specific load / General account query --</option>
                    {loads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.id} • {l.pickup.city} → {l.delivery.city} ({l.goodsDescription.slice(0, 30)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Case Subject / Summary *
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Assam e-Way Bill Part-B vehicle update needed on NH-27"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                  {/* Quick Preset Subject Chips */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-500">Quick suggestions:</span>
                    {[
                      'Fastag double deduction on NH-27 plaza',
                      'Part-B e-Way vehicle number change',
                      'Vehicle breakdown / towing assistance',
                      'Bank settlement UTR confirmation'
                    ].map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setSubject(sug)}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-amber-400 transition cursor-pointer"
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Detailed Description *
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide specific details such as vehicle registration number, toll plaza location, transshipment details, or transaction UTR..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Logged under {currentUser.name} ({currentUser.phone})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('list')}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition cursor-pointer"
                    >
                      Submit Support Ticket
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            /* VIEW C: TICKET LIST */
            <div className="space-y-4">
              {filteredTickets.length === 0 ? (
                <div className="p-10 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
                  <LifeBuoy className="w-10 h-10 text-slate-600 mx-auto" />
                  <div className="text-sm font-semibold text-slate-300">No Support Tickets Found</div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {statusFilter !== 'all'
                      ? `You don't have any tickets in "${statusFilter.replace('_', ' ')}" status.`
                      : "You haven't reported any issues. Everything is running smoothly!"}
                  </p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer"
                  >
                    Open a Support Case
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTickets.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition cursor-pointer space-y-2 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-400">{t.ticketNumber}</span>
                          {getStatusBadge(t.status)}
                          {getPriorityBadge(t.priority)}
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                            {CATEGORY_CONFIG[t.category]?.label || t.category}
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-500">
                          {new Date(t.updatedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-100">{t.subject}</h4>
                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{t.description}</p>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-900">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                            <span>{t.messages.length} Messages</span>
                          </span>
                          {t.relatedLoadId && (
                            <span className="text-[11px] text-slate-400">
                              Load: {t.relatedLoadId}
                            </span>
                          )}
                        </div>

                        <div className="text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
                          <span>View Conversation</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info strip */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Central Operations Control Center: Guwahati Hub & Regional NH-27 Intercept Posts Active</span>
          </div>
          <div>
            <span>Grievance Officer: nodal.officer@zuggi.in</span>
          </div>
        </div>
      </div>
    </div>
  );
};
