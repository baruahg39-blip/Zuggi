import React, { useState, useEffect, useMemo } from 'react';
import {
  IndianRupee,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  Search,
  Building2,
  ExternalLink,
  Smartphone,
  Clock,
  Save,
  ChevronDown,
  ChevronUp,
  Send
} from 'lucide-react';
import {
  Booking,
  BusinessPaymentSettings,
  MarketplacePaymentTransaction,
  PaymentDispute
} from '../../types';
import { logisticsStore } from '../../services/store';

interface PendingVerificationItem {
  booking: Booking;
  stage: 'advance_90' | 'balance_10';
  amountInr: number;
  method: Booking['advancePaymentMethod'];
  utr?: string;
}

interface DueDriverPayoutItem {
  booking: Booking;
  stage: 'stage1' | 'stage2';
  amountInr: number;
  driverName: string;
  driverPhone: string;
  upiId: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
}

export const AdminPaymentsTab: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [transactions, setTransactions] = useState<MarketplacePaymentTransaction[]>([]);
  const [disputes, setDisputes] = useState<PaymentDispute[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessPaymentSettings>(() =>
    logisticsStore.getBusinessPaymentSettings()
  );
  const [showSettingsForm, setShowSettingsForm] = useState<boolean>(() => {
    const s = logisticsStore.getBusinessPaymentSettings();
    return !s.upiId && !s.accountNumber;
  });

  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [commissionNotes, setCommissionNotes] = useState<Record<string, string>>({});
  const [payoutUtrs, setPayoutUtrs] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ text: string; isError?: boolean } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const refreshData = () => {
    setBookings(logisticsStore.getBookings());
    setTransactions(logisticsStore.getPaymentTransactions());
    setDisputes(logisticsStore.getDisputes());
    setBusinessSettings(logisticsStore.getBusinessPaymentSettings());
  };

  useEffect(() => {
    refreshData();
    const unsub = logisticsStore.subscribe(refreshData);
    return unsub;
  }, []);

  const showMessage = (text: string, isError = false) => {
    setActionFeedback({ text, isError });
    setTimeout(() => setActionFeedback(null), 5000);
  };

  const formatInr = (val: unknown) => {
    const num = Number(val);
    return (Number.isFinite(num) ? num : 0).toLocaleString('en-IN');
  };

  // Pending Customer Payments awaiting Admin bank verification (or direct driver confirmation)
  const pendingCustomerPayments = useMemo<PendingVerificationItem[]>(() => {
    const items: PendingVerificationItem[] = [];
    for (const b of bookings) {
      if (b.paymentAdvanceStatus === 'processing') {
        items.push({
          booking: b,
          stage: 'advance_90',
          amountInr: Number(b.customerAdvanceAmountInr) || Math.round((Number(b.totalAgreedAmountInr) || 0) * 0.90),
          method: b.advancePaymentMethod,
          utr: b.advancePaymentUtr
        });
      }
      if (b.paymentBalanceStatus === 'processing') {
        items.push({
          booking: b,
          stage: 'balance_10',
          amountInr: Number(b.customerBalanceAmountInr) || Math.round((Number(b.totalAgreedAmountInr) || 0) * 0.10),
          method: b.balancePaymentMethod,
          utr: b.balancePaymentUtr
        });
      }
    }
    return items;
  }, [bookings]);

  // Driver / Fleet Owner Payouts Due (customer paid Zuggi, driver not yet settled)
  const dueDriverPayouts = useMemo<DueDriverPayoutItem[]>(() => {
    const items: DueDriverPayoutItem[] = [];
    for (const b of bookings) {
      const driverUser = logisticsStore.getUserById(b.driverId) || logisticsStore.getUserById(b.transporterId);
      const veh = logisticsStore.getVehicleById(b.vehicleId);
      const bank = driverUser?.bankDetails;
      const baseDriverInfo = {
        driverName: driverUser?.name || veh?.driverName || veh?.transporterName || 'Assigned Driver',
        driverPhone: driverUser?.phone || veh?.driverPhone || '',
        upiId: bank?.upiId || '',
        bankName: bank?.bankName || '',
        accountNumber: bank?.accountNumber || '',
        ifscCode: bank?.ifscCode || ''
      };

      const netPayable = Number(b.netDriverPayableInr) || Math.round((Number(b.totalAgreedAmountInr) || 0) * 0.95);

      // Stage 1 due: customer paid Zuggi advance (not direct-to-driver) and driver stage 1 is not settled
      if (
        b.paymentAdvanceStatus === 'paid' &&
        b.advancePaymentMethod !== 'pay_driver_direct' &&
        b.payoutStage1Status !== 'settled'
      ) {
        items.push({
          booking: b,
          stage: 'stage1',
          amountInr: Number(b.driverFirstPayoutInr) || Math.round(netPayable * 0.90),
          ...baseDriverInfo
        });
      }

      // Stage 2 due: customer paid Zuggi final balance (not direct-to-driver), no open dispute, and stage 2 not settled
      const openDispute =
        b.dispute && (b.dispute.status === 'OPEN' || b.dispute.status === 'INVESTIGATING');
      if (
        b.paymentBalanceStatus === 'paid' &&
        b.balancePaymentMethod !== 'pay_driver_direct' &&
        b.payoutStage2Status !== 'settled' &&
        !openDispute
      ) {
        items.push({
          booking: b,
          stage: 'stage2',
          amountInr: Number(b.driverFinalPayoutInr) || Math.round(netPayable * 0.10),
          ...baseDriverInfo
        });
      }
    }
    return items;
  }, [bookings]);

  // Financial Aggregates
  const totalAgreedGMV = useMemo(
    () => bookings.reduce((sum, b) => sum + (Number(b.totalAgreedAmountInr) || 0), 0),
    [bookings]
  );

  const totalCustomerCollections = useMemo(() => {
    return bookings.reduce((sum, b) => {
      const total = Number(b.totalAgreedAmountInr) || 0;
      let paid = 0;
      if (b.paymentAdvanceStatus === 'paid') {
        paid += Number(b.customerAdvanceAmountInr) || Math.round(total * 0.90);
      }
      if (b.paymentBalanceStatus === 'paid') {
        paid += Number(b.customerBalanceAmountInr) || Math.round(total * 0.10);
      }
      return sum + paid;
    }, 0);
  }, [bookings]);

  const totalCommissionEarned = useMemo(
    () =>
      bookings
        .filter((b) => b.paymentAdvanceStatus === 'paid')
        .reduce(
          (sum, b) =>
            sum + (Number(b.platformCommissionInr) || Math.round((Number(b.totalAgreedAmountInr) || 0) * 0.05)),
          0
        ),
    [bookings]
  );

  const totalDisbursedPayouts = useMemo(() => {
    return bookings.reduce((sum, b) => {
      let paid = 0;
      if (b.payoutStage1Status === 'settled') paid += Number(b.driverFirstPayoutInr) || 0;
      if (b.payoutStage2Status === 'settled') paid += Number(b.driverFinalPayoutInr) || 0;
      return sum + paid;
    }, 0);
  }, [bookings]);

  const totalPayoutsDueAmount = useMemo(
    () => dueDriverPayouts.reduce((sum, item) => sum + item.amountInr, 0),
    [dueDriverPayouts]
  );

  const activeDisputesList = useMemo(
    () => disputes.filter((d) => d.status === 'OPEN' || d.status === 'INVESTIGATING'),
    [disputes]
  );

  const totalHeldInDisputes = useMemo(
    () => activeDisputesList.reduce((sum, d) => sum + (Number(d.heldAmountInr) || 0), 0),
    [activeDisputesList]
  );

  // Driver Cash-Trip Commission Dues (5% fee owed by drivers who collected cash/UPI directly from customer)
  const driverCashCommissionDues = useMemo(
    () =>
      bookings.filter(
        (b) =>
          (Number(b.driverCommissionDueInr) || 0) > 0 &&
          (b.driverCommissionStatus === 'due' || b.driverCommissionStatus === 'verifying_utr')
      ),
    [bookings]
  );

  const totalCashCommissionDue = useMemo(
    () => driverCashCommissionDues.reduce((sum, b) => sum + (Number(b.driverCommissionDueInr) || 0), 0),
    [driverCashCommissionDues]
  );

  const handleVerifyDriverCommission = (
    bookingId: string,
    decision: 'approve' | 'reject' | 'adjusted'
  ) => {
    const res = logisticsStore.adminVerifyDriverCommission(bookingId, decision, commissionNotes[bookingId]);
    showMessage(res.message, !res.success);
    if (res.success) {
      setCommissionNotes((prev) => ({ ...prev, [bookingId]: '' }));
    }
  };

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(
      (t) =>
        String(t.bookingId || '').toLowerCase().includes(q) ||
        String(t.orderId || '').toLowerCase().includes(q) ||
        String(t.type || '').toLowerCase().includes(q) ||
        String(t.notes || '').toLowerCase().includes(q)
    );
  }, [transactions, searchQuery]);

  const handleSaveBusinessSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const res = logisticsStore.saveBusinessPaymentSettings(businessSettings);
    showMessage(res.message, !res.success);
    if (res.success && (res.data.upiId || res.data.accountNumber)) {
      setShowSettingsForm(false);
    }
  };

  const handleVerifyCustomerPayment = (
    item: PendingVerificationItem,
    decision: 'approve' | 'reject'
  ) => {
    const key = `${item.booking.id}_${item.stage}`;
    if (item.method === 'pay_driver_direct' && decision === 'approve') {
      const currentAdmin = logisticsStore.getCurrentUser();
      const res = logisticsStore.driverConfirmDirectPayment(
        item.booking.id,
        item.stage,
        currentAdmin?.id || 'admin'
      );
      showMessage(res.message, !res.success);
      return;
    }

    const res = logisticsStore.adminVerifyCustomerPayment(
      item.booking.id,
      item.stage,
      decision,
      rejectNotes[key]
    );
    showMessage(res.message, !res.success);
  };

  const handleRecordDriverPayout = (item: DueDriverPayoutItem) => {
    const key = `${item.booking.id}_${item.stage}`;
    const utr = (payoutUtrs[key] || '').trim();
    const modeLabel = item.upiId
      ? `UPI (${item.upiId})`
      : item.bankName
      ? `${item.bankName} Transfer`
      : 'Direct Bank / UPI';
    const res = logisticsStore.adminRecordDriverPayout(item.booking.id, item.stage, utr, modeLabel);
    showMessage(res.message, !res.success);
    if (res.success) {
      setPayoutUtrs((prev) => ({ ...prev, [key]: '' }));
    }
  };

  const handleResolveDispute = (disputeId: string, resolution: 'release_to_driver' | 'refund_to_customer') => {
    setResolvingId(disputeId);
    const res = logisticsStore.resolvePaymentDispute(
      disputeId,
      resolution,
      resolution === 'release_to_driver'
        ? 'Approved by Admin after cargo inspection'
        : 'Refund authorized due to transit damage'
    );
    showMessage(res.message, !res.success);
    setResolvingId(null);
  };

  const handleExportCsv = () => {
    const headers = ['Transaction ID', 'Booking ID', 'Type', 'Amount (INR)', 'UTR / Ref', 'Status', 'Timestamp', 'Notes'];
    const rows = transactions.map((t) => [
      t.id || '',
      t.bookingId || '',
      t.type || 'payment',
      Number(t.amountInr) || 0,
      t.orderId || '',
      t.status || '',
      t.timestamp || '',
      `"${String(t.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Zuggi_Payment_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            actionFeedback.isError
              ? 'bg-rose-950/90 text-rose-200 border-rose-800'
              : 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
          }`}
        >
          {actionFeedback.isError ? (
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-emerald-400" />
            <span>Zuggi Payment Verification &amp; Driver Payout Desk</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Verify customer UPI/NEFT UTRs against your bank statement and record real payouts to drivers &amp; truck owners.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="min-h-[40px] flex items-center gap-1.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Ledger CSV</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 font-semibold block">Gross Bookings</span>
          <span className="text-lg font-black text-white font-mono tabular-nums block">
            ₹{formatInr(totalAgreedGMV)}
          </span>
          <span className="text-[11px] text-slate-500 block">{bookings.length} total bookings</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 font-semibold block">Verified Collections</span>
          <span className="text-lg font-black text-emerald-400 font-mono tabular-nums block">
            ₹{formatInr(totalCustomerCollections)}
          </span>
          <span className="text-[11px] text-slate-500 block">Advance + Final</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] text-amber-300 font-semibold block">UTRs to Verify</span>
          <span className="text-lg font-black text-amber-400 font-mono tabular-nums block">
            {pendingCustomerPayments.length}
          </span>
          <span className="text-[11px] text-slate-500 block">Pending checks</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] text-sky-300 font-semibold block">Driver Payouts Due</span>
          <span className="text-lg font-black text-sky-400 font-mono tabular-nums block">
            ₹{formatInr(totalPayoutsDueAmount)}
          </span>
          <span className="text-[11px] text-slate-500 block">{dueDriverPayouts.length} payout(s)</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 font-semibold block">Disbursed to Fleet</span>
          <span className="text-lg font-black text-teal-400 font-mono tabular-nums block">
            ₹{formatInr(totalDisbursedPayouts)}
          </span>
          <span className="text-[11px] text-slate-500 block">Zuggi fee: ₹{formatInr(totalCommissionEarned)}</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] text-amber-300 font-semibold block">Cash Commission Due</span>
          <span className="text-lg font-black text-amber-400 font-mono tabular-nums block">
            ₹{formatInr(totalCashCommissionDue)}
          </span>
          <span className="text-[11px] text-slate-500 block">
            {driverCashCommissionDues.length} cash trip(s) · {activeDisputesList.length} dispute(s)
          </span>
        </div>
      </div>

      {/* SECTION 1: ZUGGI BUSINESS COLLECTION ACCOUNT SETTINGS */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSettingsForm((v) => !v)}
          className="w-full p-4 bg-slate-950 flex flex-wrap items-center justify-between gap-3 text-left cursor-pointer hover:bg-slate-950/80 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Zuggi Business Collection Account (Shown to Customers)</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {businessSettings.upiId || businessSettings.accountNumber
                  ? `UPI: ${businessSettings.upiId || 'Not set'} · Bank: ${businessSettings.bankName || 'Not set'} ${businessSettings.accountNumber ? `(A/C ••••${businessSettings.accountNumber.slice(-4)})` : ''}`
                  : 'Action Required: Add your real Business UPI ID and Bank Account so customers can pay Zuggi directly.'}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
            <span>{showSettingsForm ? 'Hide' : 'Edit Account'}</span>
            {showSettingsForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {showSettingsForm && (
          <form onSubmit={handleSaveBusinessSettings} className="p-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Business Display Name</label>
              <input
                type="text"
                value={businessSettings.businessName}
                onChange={(e) => setBusinessSettings({ ...businessSettings, businessName: e.target.value })}
                placeholder="e.g. Zuggi Freight Logistics"
                className="w-full min-h-[40px] px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Business UPI ID (GPay / PhonePe / Paytm)</label>
              <input
                type="text"
                value={businessSettings.upiId}
                onChange={(e) => setBusinessSettings({ ...businessSettings, upiId: e.target.value })}
                placeholder="e.g. yourbusiness@okaxis"
                className="w-full min-h-[40px] px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Account Holder Name</label>
              <input
                type="text"
                value={businessSettings.accountHolderName}
                onChange={(e) => setBusinessSettings({ ...businessSettings, accountHolderName: e.target.value })}
                placeholder="Name on bank account"
                className="w-full min-h-[40px] px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Bank Name</label>
              <input
                type="text"
                value={businessSettings.bankName}
                onChange={(e) => setBusinessSettings({ ...businessSettings, bankName: e.target.value })}
                placeholder="e.g. State Bank of India / HDFC"
                className="w-full min-h-[40px] px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Bank Account Number</label>
              <input
                type="text"
                value={businessSettings.accountNumber}
                onChange={(e) => setBusinessSettings({ ...businessSettings, accountNumber: e.target.value })}
                placeholder="Enter current/savings account number"
                className="w-full min-h-[40px] px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">IFSC Code</label>
              <input
                type="text"
                value={businessSettings.ifscCode}
                onChange={(e) => setBusinessSettings({ ...businessSettings, ifscCode: e.target.value.toUpperCase() })}
                placeholder="e.g. SBIN0000078"
                className="w-full min-h-[40px] px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex justify-end pt-1">
              <button
                type="submit"
                className="min-h-[40px] px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <Save className="w-4 h-4" />
                <span>Save Collection Account</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* SECTION 2: PENDING CUSTOMER PAYMENTS TO VERIFY */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Pending Customer Payments (Verify UTR)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Match the customer&apos;s UTR in your GPay / PhonePe / Bank statement before clicking Verify &amp; Mark Paid.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-amber-400">
            {pendingCustomerPayments.length} Pending
          </span>
        </div>

        {pendingCustomerPayments.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No customer payments awaiting verification right now.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {pendingCustomerPayments.map((item) => {
              const key = `${item.booking.id}_${item.stage}`;
              const customer = logisticsStore.getUserById(item.booking.customerId);
              const isDirect = item.method === 'pay_driver_direct';
              return (
                <div key={key} className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">#{item.booking.id}</span>
                        <span className="text-xs text-slate-300 font-semibold">
                          {item.stage === 'advance_90' ? 'Step 1: 90% Advance' : 'Step 2: 10% Final Balance'}
                        </span>
                        <span className="text-xs text-slate-500">
                          · {item.booking.pickup.city} → {item.booking.delivery.city}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Customer: <strong className="text-slate-200">{customer?.name || 'Shipper'}</strong>
                        {customer?.phone ? ` (${customer.phone})` : ''} · Method:{' '}
                        <strong className="text-amber-300">
                          {isDirect
                            ? 'Pay Driver Directly On-Site'
                            : item.method === 'bank_transfer'
                            ? 'NEFT / IMPS Bank Transfer'
                            : 'UPI Transfer'}
                        </strong>
                      </p>
                      {item.utr && (
                        <p className="text-xs text-slate-300 font-mono">
                          Submitted UTR: <span className="text-emerald-400 font-bold">{item.utr}</span>
                        </p>
                      )}
                      {isDirect && (
                        <p className="text-[11px] text-slate-400">
                          Normally the driver confirms this on their trip screen. You can also mark confirmed below if verified by phone.
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-black text-emerald-400 font-mono tabular-nums">
                        ₹{formatInr(item.amountInr)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {!isDirect && (
                      <input
                        type="text"
                        value={rejectNotes[key] || ''}
                        onChange={(e) => setRejectNotes((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder="Optional note (e.g. reason if rejecting wrong UTR)"
                        className="flex-1 min-w-[200px] min-h-[40px] px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleVerifyCustomerPayment(item, 'approve')}
                      className="min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isDirect ? 'Mark Received by Driver' : 'Verify & Mark Paid'}</span>
                    </button>
                    {!isDirect && (
                      <button
                        type="button"
                        onClick={() => handleVerifyCustomerPayment(item, 'reject')}
                        className="min-h-[40px] px-4 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject UTR</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 3: DRIVER & TRUCK OWNER PAYOUTS DUE */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-sky-400" />
              <span>Driver &amp; Truck Owner Payouts Due</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Pay the driver using their real UPI ID or Bank Account below, then enter your real bank/UPI UTR to settle.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-sky-400">
            {dueDriverPayouts.length} Due · ₹{formatInr(totalPayoutsDueAmount)}
          </span>
        </div>

        {dueDriverPayouts.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No pending driver payouts right now. Payouts appear here once a customer&apos;s UPI/NEFT payment to Zuggi is verified.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {dueDriverPayouts.map((item) => {
              const key = `${item.booking.id}_${item.stage}`;
              const hasUpi = Boolean(item.upiId && item.upiId.includes('@'));
              const hasBank = Boolean(item.accountNumber && item.ifscCode);
              const driverUpiLink = hasUpi
                ? `upi://pay?pa=${encodeURIComponent(item.upiId)}&pn=${encodeURIComponent(
                    item.driverName
                  )}&am=${item.amountInr}&cu=INR&tn=${encodeURIComponent(
                    `Zuggi Payout ${item.booking.id} ${item.stage === 'stage1' ? '90%' : '10%'}`
                  )}`
                : '';

              return (
                <div key={key} className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">#{item.booking.id}</span>
                        <span className="text-xs font-semibold text-sky-300">
                          {item.stage === 'stage1' ? '90% Pickup Payout' : '10% Final Delivery Payout'}
                        </span>
                        <span className="text-xs text-slate-500">
                          · Trip Status: {item.booking.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300">
                        Payee: <strong className="text-white">{item.driverName}</strong>
                        {item.driverPhone ? ` · ${item.driverPhone}` : ''}
                      </p>

                      {hasUpi || hasBank ? (
                        <div className="text-xs font-mono text-slate-300 space-y-0.5">
                          {hasUpi && (
                            <div>
                              UPI: <span className="text-amber-300 font-bold">{item.upiId}</span>
                            </div>
                          )}
                          {hasBank && (
                            <div>
                              Bank: {item.bankName || 'Account'} · A/C {item.accountNumber} · IFSC {item.ifscCode}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-amber-300">
                          Driver has not added UPI or Bank Account yet (ask them to add it in Driver → Earnings).
                        </p>
                      )}
                    </div>

                    <div className="text-right space-y-1.5">
                      <div className="text-lg font-black text-sky-400 font-mono tabular-nums">
                        ₹{formatInr(item.amountInr)}
                      </div>
                      {hasUpi && (
                        <a
                          href={driverUpiLink}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Pay via UPI App</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={payoutUtrs[key] || ''}
                      onChange={(e) =>
                        setPayoutUtrs((prev) => ({ ...prev, [key]: e.target.value.toUpperCase() }))
                      }
                      placeholder="Enter your Bank / UPI Payout UTR after transferring money"
                      className="flex-1 min-w-[220px] min-h-[40px] px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 font-mono uppercase focus:outline-none focus:border-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRecordDriverPayout(item)}
                      className="min-h-[40px] px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Record Payout Paid</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 3B: DRIVER CASH-TRIP COMMISSION DUES (5% FEE) */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-amber-400" />
              <span>Driver Cash-Trip Commission Dues (5% Zuggi Fee)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              When a customer pays cash/UPI directly to the driver, Zuggi&apos;s 5% fee appears here until the driver transfers it or you adjust it from an online payout.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-amber-400">
            {driverCashCommissionDues.length} Due · ₹{formatInr(totalCashCommissionDue)}
          </span>
        </div>

        {driverCashCommissionDues.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No pending cash-trip commissions right now.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {driverCashCommissionDues.map((b) => {
              const driverUser = logisticsStore.getUserById(b.driverId) || logisticsStore.getUserById(b.transporterId);
              const dueAmt = Number(b.driverCommissionDueInr) || 0;
              const isVerifying = b.driverCommissionStatus === 'verifying_utr';

              return (
                <div key={b.id} className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">#{b.id}</span>
                        <span className="text-xs font-semibold text-slate-300">
                          {b.pickup.city} → {b.delivery.city}
                        </span>
                        <span
                          className={`text-[11px] font-bold uppercase ${
                            isVerifying ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {isVerifying ? '· UTR Submitted' : '· Unpaid Due'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Driver: <strong className="text-slate-200">{driverUser?.name || 'Assigned Driver'}</strong>
                        {driverUser?.phone ? ` (${driverUser.phone})` : ''} · Total Fare: ₹{formatInr(b.totalAgreedAmountInr)}
                      </p>
                      {b.driverCommissionUtr && isVerifying && (
                        <p className="text-xs text-slate-300 font-mono">
                          Driver Submitted UTR: <span className="text-emerald-400 font-bold">{b.driverCommissionUtr}</span>
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase block">5% Fee Due</span>
                      <span className="text-lg font-black text-amber-400 font-mono tabular-nums">
                        ₹{formatInr(dueAmt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={commissionNotes[b.id] || ''}
                      onChange={(e) =>
                        setCommissionNotes((prev) => ({ ...prev, [b.id]: e.target.value }))
                      }
                      placeholder="Optional note (e.g. cash received at office / adjusted on booking #...)"
                      className="flex-1 min-w-[200px] min-h-[40px] px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleVerifyDriverCommission(b.id, 'approve')}
                      className="min-h-[40px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isVerifying ? 'Verify UTR & Clear' : 'Mark Paid (UPI / Cash)'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerifyDriverCommission(b.id, 'adjusted')}
                      className="min-h-[40px] px-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer transition"
                    >
                      Adjusted in Payout
                    </button>
                    {isVerifying && (
                      <button
                        type="button"
                        onClick={() => handleVerifyDriverCommission(b.id, 'reject')}
                        className="min-h-[40px] px-3.5 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs font-bold cursor-pointer transition"
                      >
                        Reject UTR
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 4: ACTIVE CARGO DISPUTES */}
      {activeDisputesList.length > 0 && (
        <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/40 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-rose-500/30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <h3 className="text-sm font-bold text-white">Active Cargo Disputes (Final Payout On Hold)</h3>
            </div>
            <span className="text-xs text-rose-300 font-semibold">
              {activeDisputesList.length} Pending Review
            </span>
          </div>

          <div className="space-y-3">
            {activeDisputesList.map((disp) => (
              <div
                key={disp.id}
                className="p-4 rounded-xl bg-slate-950 border border-rose-500/30 space-y-3 text-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-white text-sm">Booking #{disp.bookingId}</span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Customer: <strong className="text-slate-200">{disp.customerName}</strong> · Driver:{' '}
                      <strong className="text-slate-200">{disp.driverName}</strong>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Final Payout Held</span>
                    <span className="text-base font-extrabold text-rose-400 font-mono tabular-nums">
                      ₹{formatInr(disp.heldAmountInr)}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                  <div className="font-bold text-rose-400 uppercase text-[10px] mb-1">
                    Reason: {String(disp.reason || 'other').replace(/_/g, ' ')}
                  </div>
                  <p className="text-xs">{disp.description}</p>
                  {disp.evidencePhotoUrl && (
                    <div className="mt-2 flex items-center gap-2 text-indigo-400 text-[11px]">
                      <ExternalLink className="w-3.5 h-3.5" />
                      <a href={disp.evidencePhotoUrl} target="_blank" rel="noreferrer" className="underline font-semibold">
                        View Photo Evidence
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-900">
                  <button
                    type="button"
                    disabled={resolvingId === disp.id}
                    onClick={() => handleResolveDispute(disp.id, 'refund_to_customer')}
                    className="min-h-[40px] px-3.5 rounded-xl bg-rose-900/80 hover:bg-rose-800 text-rose-100 text-xs font-bold transition cursor-pointer"
                  >
                    Refund Customer (₹{formatInr(disp.heldAmountInr)})
                  </button>

                  <button
                    type="button"
                    disabled={resolvingId === disp.id}
                    onClick={() => handleResolveDispute(disp.id, 'release_to_driver')}
                    className="min-h-[40px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Release Final Payout to Driver
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 5: FULL PAYMENT & PAYOUT LEDGER */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Payment &amp; Payout Ledger ({filteredTransactions.length})
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search booking ID or UTR..."
              className="w-full min-h-[36px] pl-8 pr-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
            />
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No payment transactions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] uppercase text-slate-400">
                <tr>
                  <th className="p-3.5">Booking</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">UTR / Ref</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Date &amp; Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredTransactions.map((tx, idx) => (
                  <tr key={tx.id || `tx_${idx}`} className="hover:bg-slate-950/40 transition">
                    <td className="p-3.5 font-mono text-white font-semibold">{tx.bookingId || '—'}</td>
                    <td className="p-3.5 text-slate-300">
                      <span className="font-semibold block">{String(tx.type || 'payment').replace(/_/g, ' ').toUpperCase()}</span>
                      {tx.notes && <span className="text-[10px] text-slate-500 block max-w-xs truncate">{tx.notes}</span>}
                    </td>
                    <td className="p-3.5 font-mono tabular-nums font-bold text-white">
                      ₹{formatInr(tx.amountInr)}
                    </td>
                    <td className="p-3.5 font-mono text-slate-300 text-[11px]">{tx.orderId || '—'}</td>
                    <td className="p-3.5">
                      <span
                        className={`font-bold text-[11px] uppercase ${
                          tx.status === 'success'
                            ? 'text-emerald-400'
                            : tx.status === 'pending'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {tx.status || 'pending'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono tabular-nums text-slate-400 text-[11px]">
                      {tx.timestamp && !Number.isNaN(new Date(tx.timestamp).getTime())
                        ? new Date(tx.timestamp).toLocaleString('en-IN')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
