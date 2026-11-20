import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Truck,
  UserCheck,
  Calendar,
  FileText,
  Eye,
  Clock,
  RotateCcw,
  Check,
  ExternalLink,
  ChevronRight,
  X,
  AlertCircle,
  Scale,
  Ban,
  UserPlus
} from 'lucide-react';
import {
  AdminReviewLog,
  PartnerAccountStatus,
  PartnerApplication,
  PartnerType,
  PartnerUploadedDoc,
  User
} from '../../types';
import { logisticsStore } from '../../services/store';

interface AdminPartnerVerificationTabProps {
  currentUser: User;
}

export const AdminPartnerVerificationTab: React.FC<AdminPartnerVerificationTabProps> = ({
  currentUser
}) => {
  const [applications, setApplications] = useState<PartnerApplication[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | PartnerAccountStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | PartnerType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Application for Deep Review Modal
  const [selectedApp, setSelectedApp] = useState<PartnerApplication | null>(null);

  // Review Action Form State
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED' | 'DOCUMENTS_REQUIRED' | 'SUSPENDED' | 'REACTIVATED'>('APPROVED');
  const [adminNotes, setAdminNotes] = useState('');
  const [requestedDocs, setRequestedDocs] = useState<string[]>([]);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Document Inspection State
  const [previewDoc, setPreviewDoc] = useState<PartnerUploadedDoc | null>(null);

  useEffect(() => {
    const update = () => {
      setApplications(logisticsStore.getPartnerApplications());
    };
    update();
    const unsub = logisticsStore.subscribe(update);
    return unsub;
  }, []);

  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      if (statusFilter !== 'all' && app.status !== statusFilter) return false;
      if (typeFilter !== 'all' && app.partnerType !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = app.fullName.toLowerCase().includes(q);
        const matchPhone = app.phone.toLowerCase().includes(q);
        const matchCompany = app.companyDetails?.companyName.toLowerCase().includes(q);
        const matchVehicle = app.registeredVehicles.some((v) => v.registrationNumber.toLowerCase().includes(q));
        if (!matchName && !matchPhone && !matchCompany && !matchVehicle) return false;
      }
      return true;
    });
  }, [applications, statusFilter, typeFilter, searchQuery]);

  // Aggregate Counts
  const counts = useMemo(() => {
    return {
      total: applications.length,
      pending: applications.filter((a) => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW').length,
      approved: applications.filter((a) => a.status === 'APPROVED').length,
      docsRequired: applications.filter((a) => a.status === 'DOCUMENTS_REQUIRED').length,
      rejected: applications.filter((a) => a.status === 'REJECTED').length,
      suspended: applications.filter((a) => a.status === 'SUSPENDED').length
    };
  }, [applications]);

  const handleOpenReviewModal = (app: PartnerApplication) => {
    setSelectedApp(app);
    setAdminNotes(app.adminNotes || '');
    setReviewAction(app.status === 'APPROVED' ? 'SUSPENDED' : 'APPROVED');
    setRequestedDocs([]);
    setActionFeedback(null);
  };

  const handleExecuteReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;

    if (reviewAction === 'REJECTED' && !adminNotes.trim()) {
      setActionFeedback('Rejection reason is mandatory when rejecting a partner.');
      return;
    }

    if (reviewAction === 'DOCUMENTS_REQUIRED' && requestedDocs.length === 0 && !adminNotes.trim()) {
      setActionFeedback('Please specify which documents are required or provide notes.');
      return;
    }

    const adminName = currentUser.name ? `${currentUser.name} (Compliance Admin)` : 'Admin Compliance Desk';

    const result = logisticsStore.reviewPartnerApplication(selectedApp.id, {
      adminId: currentUser.id,
      adminName,
      action: reviewAction,
      notes: adminNotes.trim(),
      requestedDocuments: requestedDocs.length > 0 ? requestedDocs : undefined
    });

    if (result.success) {
      setActionFeedback(result.message);
      // Reload updated app
      const refreshed = logisticsStore.getPartnerApplicationById(selectedApp.id);
      if (refreshed) setSelectedApp(refreshed);
      setTimeout(() => {
        setSelectedApp(null);
        setActionFeedback(null);
      }, 1500);
    } else {
      setActionFeedback(result.message);
    }
  };

  const handleDocVerify = (appId: string, docId: string, newStatus: 'verified' | 'rejected') => {
    const apps = logisticsStore.getPartnerApplications();
    const app = apps.find((a) => a.id === appId);
    if (!app) return;

    const updatedDocuments = app.documents.map((docItem) => {
      if (docItem.id !== docId) return docItem;
      return {
        ...docItem,
        status: newStatus,
        verifiedAt: newStatus === 'verified' ? new Date().toISOString() : docItem.verifiedAt,
        rejectionReason:
          newStatus === 'verified'
            ? undefined
            : 'Document failed RTO Parivahan verification or is unreadable.'
      };
    });

    const updatedApp: PartnerApplication = {
      ...app,
      documents: updatedDocuments
    };
    logisticsStore.savePartnerApplication(updatedApp);
    setSelectedApp(updatedApp);
  };

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <div 
          onClick={() => setStatusFilter('all')}
          className={`p-3.5 rounded-2xl border cursor-pointer transition ${
            statusFilter === 'all' ? 'bg-amber-500/10 border-amber-500' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-[11px] text-slate-400 block">Total Partners</span>
          <span className="text-xl font-bold font-mono text-white block mt-1">{counts.total}</span>
        </div>

        <div 
          onClick={() => setStatusFilter('UNDER_REVIEW')}
          className={`p-3.5 rounded-2xl border cursor-pointer transition ${
            statusFilter === 'UNDER_REVIEW' || statusFilter === 'SUBMITTED' ? 'bg-blue-500/10 border-blue-500' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-[11px] text-blue-400 block font-semibold">Pending Review</span>
          <span className="text-xl font-bold font-mono text-blue-300 block mt-1">{counts.pending}</span>
        </div>

        <div 
          onClick={() => setStatusFilter('APPROVED')}
          className={`p-3.5 rounded-2xl border cursor-pointer transition ${
            statusFilter === 'APPROVED' ? 'bg-emerald-500/10 border-emerald-500' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-[11px] text-emerald-400 block font-semibold">Approved</span>
          <span className="text-xl font-bold font-mono text-emerald-400 block mt-1">{counts.approved}</span>
        </div>

        <div 
          onClick={() => setStatusFilter('DOCUMENTS_REQUIRED')}
          className={`p-3.5 rounded-2xl border cursor-pointer transition ${
            statusFilter === 'DOCUMENTS_REQUIRED' ? 'bg-amber-500/10 border-amber-500' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-[11px] text-amber-400 block font-semibold">Docs Required</span>
          <span className="text-xl font-bold font-mono text-amber-400 block mt-1">{counts.docsRequired}</span>
        </div>

        <div 
          onClick={() => setStatusFilter('REJECTED')}
          className={`p-3.5 rounded-2xl border cursor-pointer transition ${
            statusFilter === 'REJECTED' ? 'bg-rose-500/10 border-rose-500' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-[11px] text-rose-400 block font-semibold">Rejected</span>
          <span className="text-xl font-bold font-mono text-rose-400 block mt-1">{counts.rejected}</span>
        </div>

        <div 
          onClick={() => setStatusFilter('SUSPENDED')}
          className={`p-3.5 rounded-2xl border cursor-pointer transition ${
            statusFilter === 'SUSPENDED' ? 'bg-slate-800 border-rose-500' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-[11px] text-slate-400 block font-semibold">Suspended</span>
          <span className="text-xl font-bold font-mono text-slate-400 block mt-1">{counts.suspended}</span>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by partner name, phone, fleet company, or vehicle reg..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="all">All Partner Types</option>
            <option value="individual_owner">Individual Vehicle Owner</option>
            <option value="driver">Commercial Driver</option>
            <option value="fleet_partner">Fleet Partner / Transporter</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="DOCUMENTS_REQUIRED">Documents Required</option>
            <option value="REJECTED">Rejected</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      {/* Applications List */}
      {filteredApps.length === 0 ? (
        <div className="p-10 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-2">
          <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-white">No Partner Applications Found</h4>
          <p className="text-xs text-slate-400">
            No partner registrations matched the selected status or filter query.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredApps.map((app) => {
            const pendingDocsCount = app.documents.filter((d) => d.status === 'pending').length;
            const rejectedDocsCount = app.documents.filter((d) => d.status === 'rejected').length;

            return (
              <div
                key={app.id}
                className="p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition space-y-4 shadow-xl"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 font-bold">
                      {app.partnerType === 'fleet_partner' ? (
                        <Building2 className="w-5 h-5" />
                      ) : app.partnerType === 'driver' ? (
                        <UserCheck className="w-5 h-5" />
                      ) : (
                        <Truck className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white text-sm">
                          {app.companyDetails?.companyName || app.fullName}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700 uppercase">
                          {app.partnerType.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {app.city}, {app.state} • Mobile: <span className="font-mono text-slate-200">+91 {app.phone}</span>
                        {app.companyDetails && (
                          <span> • Rep: <strong className="text-slate-300">{app.fullName}</strong></span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                      app.status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : app.status === 'DOCUMENTS_REQUIRED'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : app.status === 'REJECTED' || app.status === 'SUSPENDED'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}>
                      {app.status.replace('_', ' ')}
                    </span>

                    <button
                      onClick={() => handleOpenReviewModal(app)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect & Review</span>
                    </button>
                  </div>
                </div>

                {/* Grid Summary Row */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  {/* Bank & Tax Details */}
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      TAX & BANK ACCOUNT
                    </span>
                    <div className="font-mono text-white text-[11px]">
                      PAN: <span className="text-amber-400 font-bold">{app.pan || 'N/A'}</span>
                    </div>
                    {app.gstin && (
                      <div className="font-mono text-[11px] text-slate-400">
                        GST: {app.gstin}
                      </div>
                    )}
                    <div className="text-[11px] text-slate-400 truncate">
                      {app.bankDetails?.bankName} ({app.bankDetails?.ifscCode})
                    </div>
                  </div>

                  {/* Registered Vehicles */}
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      FLEET VEHICLES ({app.registeredVehicles.length})
                    </span>
                    {app.registeredVehicles.length > 0 ? (
                      app.registeredVehicles.slice(0, 2).map((v) => (
                        <div key={v.id} className="font-mono text-[11px] text-white flex items-center gap-1">
                          <Truck className="w-3 h-3 text-amber-400" />
                          <span>{v.registrationNumber}</span>
                          <span className="text-slate-500">({(v.capacityKg / 1000).toFixed(1)} MT)</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-500 text-[11px]">Driver Profile (No personal truck)</span>
                    )}
                  </div>

                  {/* Documents Verification Status */}
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      DOCUMENT VAULT ({app.documents.length})
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-800">
                        {app.documents.filter((d) => d.status === 'verified').length} Verified
                      </span>
                      {pendingDocsCount > 0 && (
                        <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 text-[10px] font-bold border border-amber-800">
                          {pendingDocsCount} Pending
                        </span>
                      )}
                      {rejectedDocsCount > 0 && (
                        <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 text-[10px] font-bold border border-rose-800">
                          {rejectedDocsCount} Rejected
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Agreement Acceptance Record */}
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      DIGITAL SIGN-OFF
                    </span>
                    {app.acceptance ? (
                      <div className="space-y-0.5 text-[11px]">
                        <div className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Signed: {app.acceptance.legalFullName}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          {new Date(app.acceptance.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-amber-400 text-[11px]">Pending Acceptance</span>
                    )}
                  </div>
                </div>

                {/* Recent Admin Audit Note */}
                {app.adminNotes && (
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white">Admin Note:</strong> {app.adminNotes}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* INSPECT & REVIEW MODAL */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">
                      {selectedApp.companyDetails?.companyName || selectedApp.fullName}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700 uppercase">
                      {selectedApp.partnerType.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Application ID: <span className="font-mono text-slate-300">{selectedApp.id}</span> • Submitted: {new Date(selectedApp.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedApp(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 text-slate-200 text-xs">
              {/* Partner Profile & Bank Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">
                    PARTNER CONTACT & ADDRESS
                  </span>
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-white">{selectedApp.fullName}</div>
                    <div className="text-slate-300">Phone: +91 {selectedApp.phone}</div>
                    <div className="text-slate-300">Email: {selectedApp.email || 'N/A'}</div>
                    <div className="text-slate-400">{selectedApp.address}, {selectedApp.city}, {selectedApp.state} - {selectedApp.pincode}</div>
                    {selectedApp.emergencyContact && (
                      <div className="text-amber-400 pt-1">
                        Emergency: {selectedApp.emergencyContact.name} ({selectedApp.emergencyContact.relationship}) - +91 {selectedApp.emergencyContact.phone}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">
                    CASHFREE EASY SPLIT BENEFICIARY
                  </span>
                  <div className="space-y-1 font-mono text-[11px]">
                    <div>Holder: <strong className="text-white">{selectedApp.bankDetails?.accountHolderName}</strong></div>
                    <div>Account: <strong className="text-white">{selectedApp.bankDetails?.accountNumber}</strong></div>
                    <div>IFSC: <strong className="text-amber-400">{selectedApp.bankDetails?.ifscCode}</strong></div>
                    <div>Bank: <strong className="text-slate-300">{selectedApp.bankDetails?.bankName}</strong></div>
                    {selectedApp.bankDetails?.upiId && (
                      <div>UPI VPA: <strong className="text-emerald-400">{selectedApp.bankDetails?.upiId}</strong></div>
                    )}
                  </div>
                </div>
              </div>

              {/* Document Inspection & Verification Vault */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Uploaded Documents & Expiry Verification ({selectedApp.documents.length})
                  </span>
                  <span className="text-[11px] text-slate-500">Click document to open secure preview</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedApp.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-white block">{doc.name}</span>
                          <span className="text-[11px] font-mono text-slate-400">
                            Number: {doc.documentNumber || 'N/A'}
                          </span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          doc.status === 'verified'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : doc.status === 'rejected'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {doc.status}
                        </span>
                      </div>

                      {doc.expiryDate && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span>Valid Through: <strong>{doc.expiryDate}</strong></span>
                        </div>
                      )}

                      {doc.rejectionReason && (
                        <div className="p-2 rounded bg-rose-950/40 text-rose-300 text-[10px]">
                          {doc.rejectionReason}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="text-amber-400 hover:underline text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Document</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDocVerify(selectedApp.id, doc.id, 'verified')}
                            className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-400 text-[10px] font-bold border border-emerald-800 transition cursor-pointer"
                          >
                            Mark Verified
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDocVerify(selectedApp.id, doc.id, 'rejected')}
                            className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 text-[10px] font-bold border border-rose-800 transition cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Digital Agreement Acceptance Details */}
              {selectedApp.acceptance && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">
                    DIGITAL AGREEMENT SIGN-OFF & ELECTRONIC SIGNATURE
                  </span>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between">
                      <span className="text-slate-400">Electronic Signatory Legal Name:</span>
                      <strong className="text-emerald-400 font-mono text-sm">{selectedApp.acceptance.legalFullName}</strong>
                    </div>
                    <div className="flex flex-wrap items-center justify-between">
                      <span className="text-slate-400">Execution Timestamp:</span>
                      <span className="font-mono text-slate-300">{new Date(selectedApp.acceptance.timestamp).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {selectedApp.acceptance.agreements.map((ag) => (
                        <span key={ag.type} className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 text-[10px]">
                          ✓ {ag.title} ({ag.version})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Audit Review Logs */}
              {selectedApp.reviewLogs && selectedApp.reviewLogs.length > 0 && (
                <div className="space-y-2">
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">
                    ADMIN COMPLIANCE AUDIT HISTORY ({selectedApp.reviewLogs.length})
                  </span>
                  <div className="space-y-1.5">
                    {selectedApp.reviewLogs.map((log) => (
                      <div key={log.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-white">{log.action}</span> by <span className="text-amber-400">{log.adminName}</span>
                          {log.notes && <p className="text-slate-400 mt-0.5">{log.notes}</p>}
                        </div>
                        <span className="text-slate-500 font-mono text-[10px] shrink-0">
                          {new Date(log.timestamp).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Administrative Decision Form */}
              <form onSubmit={handleExecuteReview} className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-amber-500/30 space-y-4">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block flex items-center gap-1.5">
                  <Scale className="w-4 h-4" />
                  <span>Execute Administrative Compliance Decision</span>
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  {[
                    { id: 'APPROVED', label: 'Approve Partner', color: 'emerald' },
                    { id: 'DOCUMENTS_REQUIRED', label: 'Request Corrected Docs', color: 'amber' },
                    { id: 'REJECTED', label: 'Reject Application', color: 'rose' },
                    { id: 'SUSPENDED', label: 'Suspend Partner', color: 'rose' },
                    { id: 'REACTIVATED', label: 'Reactivate Partner', color: 'blue' }
                  ].map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setReviewAction(act.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                        reviewAction === act.id
                          ? act.color === 'emerald'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                            : act.color === 'amber'
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                            : act.color === 'blue'
                            ? 'bg-blue-500 text-white border-blue-400 shadow-md'
                            : 'bg-rose-500 text-white border-rose-400 shadow-md'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>

                {reviewAction === 'DOCUMENTS_REQUIRED' && (
                  <div className="space-y-2">
                    <label className="text-slate-400 text-xs block font-semibold">
                      Select Documents Partner Must Re-Upload:
                    </label>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {['Vehicle RC', 'Commercial DL', 'Commercial Insurance', 'Fitness Certificate', 'PUC Certificate', 'PAN Card', 'Bank Passbook / Cheque'].map((docName) => (
                        <label key={docName} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={requestedDocs.includes(docName)}
                            onChange={(e) => {
                              if (e.target.checked) setRequestedDocs([...requestedDocs, docName]);
                              else setRequestedDocs(requestedDocs.filter((d) => d !== docName));
                            }}
                            className="accent-amber-500"
                          />
                          <span>{docName}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-slate-400 text-xs block mb-1 font-semibold">
                    {reviewAction === 'REJECTED' ? 'Mandatory Rejection Reason *' : 'Compliance Notes & Feedback for Partner:'}
                  </label>
                  <textarea
                    rows={2}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Provide specific details regarding Parivahan match, document clarity, or rejection grounds..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {actionFeedback && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/50 text-amber-300 text-xs font-semibold">
                    {actionFeedback}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition cursor-pointer"
                  >
                    Confirm & Update Status
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 max-w-2xl w-full rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-sm">{previewDoc.name}</h4>
                <span className="text-[11px] font-mono text-slate-400">
                  Number: {previewDoc.documentNumber || 'N/A'} {previewDoc.expiryDate ? `• Expires: ${previewDoc.expiryDate}` : ''}
                </span>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex items-center justify-center bg-slate-950/60 max-h-[70vh] overflow-y-auto">
              <img
                src={previewDoc.fileUrl}
                alt={previewDoc.name}
                className="max-h-[60vh] max-w-full object-contain rounded-xl border border-slate-800 shadow"
              />
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Status: <strong className="text-white uppercase">{previewDoc.status}</strong></span>
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-semibold cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
