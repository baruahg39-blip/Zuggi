import React, { useState, useEffect } from 'react';
import { 
  IndianRupee, 
  ArrowLeft, 
  Download, 
  CheckCircle2, 
  Clock, 
  Building2, 
  ShieldCheck, 
  FileText,
  ExternalLink,
  FileSpreadsheet,
  History,
  Smartphone,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';
import { Booking, BusinessPaymentSettings, Settlement, User } from '../../types';
import { logisticsStore } from '../../services/store';
import { exportDriverEarningsToCsv } from '../../utils/csvExport';
import {
  escrowClient,
  formatInrExact,
  type VendorWalletResponse
} from '../../services/escrowClient';
import { FleetEscrowTimelineCard } from '../escrow/FleetEscrowTimelineCard';

interface DriverEarningsProps {
  currentUser: User;
  onBack: () => void;
  onNavigateToHistory?: () => void;
}

export const DriverEarnings: React.FC<DriverEarningsProps> = ({
  currentUser,
  onBack,
  onNavigateToHistory
}) => {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [driverBookings, setDriverBookings] = useState<Booking[]>([]);
  const [businessPayment, setBusinessPayment] = useState<BusinessPaymentSettings>(() =>
    logisticsStore.getBusinessPaymentSettings()
  );
  const [commissionUtrs, setCommissionUtrs] = useState<Record<string, string>>({});
  const [commissionFeedback, setCommissionFeedback] = useState<{ text: string; isError?: boolean } | null>(null);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [liveUser, setLiveUser] = useState<User>(currentUser);
  const [editingBank, setEditingBank] = useState<boolean>(false);
  const [bankForm, setBankForm] = useState({
    accountHolderName: currentUser.bankDetails?.accountHolderName || currentUser.name || '',
    bankName: currentUser.bankDetails?.bankName || '',
    accountNumber: currentUser.bankDetails?.accountNumber || '',
    ifscCode: currentUser.bankDetails?.ifscCode || '',
    upiId: currentUser.bankDetails?.upiId || '',
    pan: currentUser.pan || ''
  });
  const [bankSavedMsg, setBankSavedMsg] = useState<string | null>(null);
  const [escrowWallet, setEscrowWallet] = useState<VendorWalletResponse | null>(null);
  const [registeringVendor, setRegisteringVendor] = useState<boolean>(false);
  const [vendorSyncMsg, setVendorSyncMsg] = useState<string | null>(null);

  const loadEscrowWallet = () => {
    escrowClient
      .getVendorWallet()
      .then((res) => {
        if (res.success) setEscrowWallet(res);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadEscrowWallet();
  }, [currentUser.id]);

  const handleSyncCashfreeVendor = async () => {
    setRegisteringVendor(true);
    setVendorSyncMsg(null);
    try {
      const resp = await escrowClient.registerFleetVendor({
        name: liveUser.name || currentUser.name || 'Fleet Partner',
        email: liveUser.email || currentUser.email,
        phone: liveUser.phone || currentUser.phone || '',
        bankAccountNumber: bankForm.accountNumber || liveUser.bankDetails?.accountNumber,
        bankIfsc: bankForm.ifscCode || liveUser.bankDetails?.ifscCode,
        upiId: bankForm.upiId || liveUser.bankDetails?.upiId
      });
      if (resp.success) {
        setVendorSyncMsg('Cashfree Easy Split Vendor verified & linked for automated 70/30 escrow payouts.');
        loadEscrowWallet();
      } else {
        setVendorSyncMsg(resp.message || 'Add a UPI ID or Bank Account + IFSC below first.');
      }
    } catch {
      setVendorSyncMsg('Network error syncing Cashfree Easy Split vendor.');
    } finally {
      setRegisteringVendor(false);
    }
  };

  const handleSaveBankDetails = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = logisticsStore.updateUserBankDetails(currentUser.id, bankForm, bankForm.pan);
    if (updated) {
      setLiveUser(updated);
      setEditingBank(false);
      setBankSavedMsg('Bank & UPI payout details saved and synced!');
      setTimeout(() => setBankSavedMsg(null), 4000);
      // Also register / update Cashfree Easy Split vendor record
      void escrowClient
        .registerFleetVendor({
          name: updated.name || currentUser.name,
          email: updated.email || currentUser.email,
          phone: updated.phone || currentUser.phone,
          bankAccountNumber: bankForm.accountNumber || undefined,
          bankIfsc: bankForm.ifscCode || undefined,
          upiId: bankForm.upiId || undefined
        })
        .then(() => loadEscrowWallet())
        .catch(() => {});
    }
  };

  useEffect(() => {
    const update = () => {
      const freshUser = logisticsStore.getUserById(currentUser.id) || logisticsStore.getCurrentUser() || currentUser;
      setLiveUser(freshUser);
      const myBookings = logisticsStore
        .getBookings()
        .filter((b) => b.driverId === currentUser.id || b.transporterId === currentUser.id);
      const myBookingIds = new Set(myBookings.map((b) => b.id));
      const allSettlements = logisticsStore.getSettlements();
      const mySettlements = allSettlements.filter(
        (s) => s.driverId === currentUser.id || myBookingIds.has(s.bookingId)
      );
      setDriverBookings(myBookings);
      setSettlements(mySettlements);
      setBusinessPayment(logisticsStore.getBusinessPaymentSettings());
    };
    update();
    const unsub = logisticsStore.subscribe(update);
    return unsub;
  }, [currentUser.id]);

  const totalDisbursed = settlements.reduce((acc, s) => acc + s.netDisbursed, 0);
  const totalGross = settlements.reduce((acc, s) => acc + s.grossFreight, 0);
  const totalCommission = settlements.reduce((acc, s) => acc + s.commission, 0);
  const totalTds = settlements.reduce((acc, s) => acc + s.tdsDeduction, 0);

  // Exact 95% Net Fleet Earnings calculation
  const totalNetFleetEarnings = Math.round(totalGross * 0.95);

  const activeDisputes = logisticsStore.getDisputes('driver', currentUser.id).filter(
    (d) => d.status === 'OPEN' || d.status === 'INVESTIGATING'
  );
  const disputedHoldAmount = activeDisputes.reduce((sum, d) => sum + d.heldAmountInr, 0);

  const stage1Settled = settlements
    .filter((s) => s.settlementRef.includes('SPLIT1'))
    .reduce((sum, s) => sum + s.netDisbursed, 0);
  const stage2Settled = settlements
    .filter((s) => s.settlementRef.includes('SPLIT2'))
    .reduce((sum, s) => sum + s.netDisbursed, 0);

  const pendingPayoutsDue = driverBookings.reduce((sum, b) => {
    const net = Number(b.netDriverPayableInr) || Math.round((Number(b.totalAgreedAmountInr) || 0) * 0.95);
    let due = 0;
    if (
      b.paymentAdvanceStatus === 'paid' &&
      b.advancePaymentMethod !== 'pay_driver_direct' &&
      b.payoutStage1Status !== 'settled'
    ) {
      due += Number(b.driverFirstPayoutInr) || Math.round(net * 0.90);
    }
    if (
      b.paymentBalanceStatus === 'paid' &&
      b.balancePaymentMethod !== 'pay_driver_direct' &&
      b.payoutStage2Status !== 'settled' &&
      b.payoutStage2Status !== 'disputed_on_hold'
    ) {
      due += Number(b.driverFinalPayoutInr) || Math.round(net * 0.10);
    }
    return sum + due;
  }, 0);

  const cashCommissionBookings = driverBookings.filter(
    (b) =>
      (Number(b.driverCommissionDueInr) || 0) > 0 &&
      (b.driverCommissionStatus === 'due' || b.driverCommissionStatus === 'verifying_utr')
  );
  const totalCashCommissionDue = cashCommissionBookings.reduce(
    (sum, b) => sum + (Number(b.driverCommissionDueInr) || 0),
    0
  );

  const handleSubmitCommissionUtr = (bookingId: string) => {
    const utr = (commissionUtrs[bookingId] || '').trim();
    const res = logisticsStore.submitDriverCommissionPayment(bookingId, currentUser.id, utr);
    setCommissionFeedback({ text: res.message, isError: !res.success });
    if (res.success) {
      setCommissionUtrs((prev) => ({ ...prev, [bookingId]: '' }));
    }
    setTimeout(() => setCommissionFeedback(null), 5000);
  };

  const handleCopyZuggiUpi = () => {
    if (!businessPayment.upiId) return;
    navigator.clipboard?.writeText(businessPayment.upiId).catch(() => {});
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 1800);
  };

  const handleExportCsv = () => {
    const bookings = logisticsStore.getBookings();
    exportDriverEarningsToCsv(settlements, bookings);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Driver Desk</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          {onNavigateToHistory && (
            <button
              onClick={onNavigateToHistory}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-semibold border border-slate-700 transition cursor-pointer"
            >
              <History className="w-4 h-4 text-emerald-400" />
              <span>Trip History & PODs</span>
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-bold shadow-md transition cursor-pointer"
            title="Export settlements, Section 194C TDS deductions, and UTR codes into CSV format for Tally, Excel, or CA accounting"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export CSV (Excel / Tally)</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 text-[#171318] text-xs font-semibold border border-gray-200 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Statement</span>
          </button>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <IndianRupee className="w-5 h-5 text-[#E83E83]" />
          <h2 className="text-lg sm:text-xl font-extrabold text-[#171318]">Fleet Earnings &amp; Payouts</h2>
        </div>
        <p className="text-xs text-[#77717A] mt-1">
          Automated 70/30 Cashfree Easy Split escrow: 70% loading advance released on Digital LR and 30% balance released on Proof of Delivery.
        </p>
      </div>

      {/* LIVE 70/30 CASHFREE ESCROW WALLET */}
      <section className="rounded-xl bg-white border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Cashfree 70/30 Live Escrow Wallet
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {escrowWallet?.vendor
                  ? `Vendor ${escrowWallet.vendor.cashfree_vendor_id} · KYC ${escrowWallet.vendor.kyc_status}${
                      escrowWallet.vendor.upi_id
                        ? ` · UPI ${escrowWallet.vendor.upi_id}`
                        : escrowWallet.vendor.bank_account_last4
                          ? ` · Bank ****${escrowWallet.vendor.bank_account_last4}`
                          : ''
                    }`
                  : 'Link your UPI or Bank Account to receive automated Cashfree Easy Split tranches'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSyncCashfreeVendor}
            disabled={registeringVendor}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            {registeringVendor
              ? 'Verifying Cashfree Vendor...'
              : escrowWallet?.vendor?.kyc_status === 'VERIFIED'
                ? 'Re-sync Cashfree KYC'
                : 'Verify & Link Easy Split Payout'}
          </button>
        </div>

        <div className="p-5 space-y-4">
          {vendorSyncMsg && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              {vendorSyncMsg}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
              <span className="text-xs text-slate-500 block">Locked in Escrow</span>
              <span className="mt-1 block text-xl font-bold text-slate-900 font-mono tabular-nums">
                {formatInrExact(escrowWallet?.summary.lockedInEscrowInr || 0)}
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">Releases on loading / POD</span>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
              <span className="text-xs text-slate-500 block">70% Advances Released</span>
              <span className="mt-1 block text-xl font-bold text-emerald-700 font-mono tabular-nums">
                {formatInrExact(escrowWallet?.summary.releasedAdvanceInr || 0)}
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">Loading tranche payouts</span>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
              <span className="text-xs text-slate-500 block">30% Queued (POD Timer)</span>
              <span className="mt-1 block text-xl font-bold text-amber-700 font-mono tabular-nums">
                {formatInrExact(escrowWallet?.summary.queuedBalanceInr || 0)}
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">2-hour auto-release queue</span>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
              <span className="text-xs text-slate-500 block">Total Settled (70+30)</span>
              <span className="mt-1 block text-xl font-bold text-slate-900 font-mono tabular-nums">
                {formatInrExact(escrowWallet?.summary.settledTotalInr || 0)}
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                {(escrowWallet?.summary.disputeHoldInr || 0) > 0
                  ? `Dispute Hold: ${formatInrExact(escrowWallet?.summary.disputeHoldInr || 0)}`
                  : `${escrowWallet?.summary.totalTrips || 0} escrow trip(s)`}
              </span>
            </div>
          </div>

          {escrowWallet && escrowWallet.trips.length > 0 && (
            <div className="space-y-3 pt-1">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active &amp; Recent Trip Payout Timelines
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {escrowWallet.trips.slice(0, 6).map(({ ledger, tranches }) => (
                  <FleetEscrowTimelineCard
                    key={ledger.id}
                    tripId={ledger.external_trip_id}
                    totalFreightInr={ledger.total_freight_inr}
                    ledger={ledger}
                    tranches={tranches}
                    vendor={escrowWallet.vendor}
                    onLedgerUpdated={() => loadEscrowWallet()}
                    compact
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 text-xs block">Total Received / Settled</span>
          <span className="text-2xl font-extrabold text-emerald-400 font-mono tabular-nums">
            ₹{totalDisbursed.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-500 block">Bank, UPI &amp; direct on-site</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 text-xs block">Pending Payout Due</span>
          <span className="text-2xl font-extrabold text-sky-400 font-mono tabular-nums">
            ₹{pendingPayoutsDue.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-500 block">Verified by customer · queued by Admin</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 text-xs block">Zuggi Fee (5%)</span>
          <span className="text-2xl font-extrabold text-amber-400 font-mono tabular-nums">
            ₹{totalCommission.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-500 block">Platform fee across settled trips</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 text-xs block">Net Fleet Rate (95%)</span>
          <span className="text-2xl font-extrabold text-teal-400 font-mono tabular-nums">
            ₹{totalNetFleetEarnings.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-500 block">Gross fares: ₹{totalGross.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* 2-Step Payout Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Pickup Payouts (90%)</span>
          <div className="text-lg font-bold text-emerald-400 font-mono tabular-nums">
            ₹{stage1Settled.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-500 block">Settled for pickup stage</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Final Delivery Payouts (10%)</span>
          <div className="text-lg font-bold text-slate-200 font-mono tabular-nums">
            ₹{stage2Settled.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-500 block">Settled after POD confirmation</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Cash Trip Commission Due</span>
          <div className={`text-lg font-bold font-mono tabular-nums ${totalCashCommissionDue > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
            ₹{totalCashCommissionDue.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-500 block">
            {totalCashCommissionDue > 0
              ? `${cashCommissionBookings.length} cash trip(s) · 5% Zuggi fee`
              : disputedHoldAmount > 0
              ? `Dispute hold: ₹${disputedHoldAmount.toLocaleString('en-IN')}`
              : 'All commission cleared'}
          </span>
        </div>
      </div>

      {/* ZUGGI 5% CASH-TRIP COMMISSION SETTLEMENT PANEL */}
      {cashCommissionBookings.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-amber-500/40 shadow-xl space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-amber-400" />
                <span>Zuggi 5% Commission Due (Cash / Direct Trips)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Since the customer paid you directly in cash/UPI, remit Zuggi&apos;s 5% fee via UPI/Bank below or ask Admin to adjust it from your next online trip payout.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase block">Total Due</span>
              <span className="text-xl font-black text-amber-400 font-mono tabular-nums">
                ₹{totalCashCommissionDue.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {commissionFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                commissionFeedback.isError
                  ? 'bg-rose-950/70 border-rose-700 text-rose-200'
                  : 'bg-emerald-950/70 border-emerald-700 text-emerald-200'
              }`}
            >
              {commissionFeedback.isError ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{commissionFeedback.text}</span>
            </div>
          )}

          {businessPayment.upiId && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Pay Commission to {businessPayment.businessName}</span>
                <span className="font-mono font-bold text-emerald-400">{businessPayment.upiId}</span>
                {businessPayment.accountNumber && businessPayment.ifscCode && (
                  <span className="block text-[11px] text-slate-400 font-mono mt-0.5">
                    Bank: {businessPayment.bankName || 'Account'} · A/C {businessPayment.accountNumber} · IFSC {businessPayment.ifscCode}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleCopyZuggiUpi}
                className="min-h-[36px] px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUpi ? 'Copied UPI' : 'Copy UPI ID'}</span>
              </button>
            </div>
          )}

          <div className="space-y-3">
            {cashCommissionBookings.map((b) => {
              const dueAmt = Number(b.driverCommissionDueInr) || 0;
              const isVerifying = b.driverCommissionStatus === 'verifying_utr';
              const payLink = businessPayment.upiId
                ? `upi://pay?pa=${encodeURIComponent(businessPayment.upiId)}&pn=${encodeURIComponent(
                    businessPayment.businessName || 'Zuggi Freight Logistics'
                  )}&am=${dueAmt}&cu=INR&tn=${encodeURIComponent(`Zuggi 5% Commission ${b.id}`)}`
                : '';

              return (
                <div key={b.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-white">#{b.id}</span>
                      <span className="text-slate-300 font-semibold ml-2">
                        {b.pickup.city} → {b.delivery.city}
                      </span>
                      <span className="block text-[11px] text-slate-400 mt-0.5">
                        Agreed Fare: ₹{(Number(b.totalAgreedAmountInr) || 0).toLocaleString('en-IN')} · 5% Fee Due: ₹{dueAmt.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums text-base font-black text-amber-400">
                        ₹{dueAmt.toLocaleString('en-IN')}
                      </span>
                      {payLink && !isVerifying && (
                        <a
                          href={payLink}
                          className="min-h-[34px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Pay via UPI</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {b.driverCommissionRejectionNote && !isVerifying && (
                    <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-800 text-[11px] text-rose-200">
                      <strong>Previous UTR rejected:</strong> {b.driverCommissionRejectionNote}
                    </div>
                  )}

                  {isVerifying ? (
                    <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-700/40 text-amber-200 text-[11px] flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        UTR <strong className="font-mono text-white">{b.driverCommissionUtr}</strong> submitted — waiting for Zuggi Admin bank verification.
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={commissionUtrs[b.id] || ''}
                        onChange={(e) =>
                          setCommissionUtrs((prev) => ({
                            ...prev,
                            [b.id]: e.target.value.toUpperCase()
                          }))
                        }
                        placeholder="Enter 12-digit UPI / Bank UTR after paying Zuggi"
                        className="flex-1 min-w-[200px] min-h-[40px] px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 font-mono uppercase focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSubmitCommissionUtr(b.id)}
                        className="min-h-[40px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer transition"
                      >
                        Submit Commission UTR
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Real Driver Bank / UPI Payout Account */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-white">
                  Your Bank &amp; UPI Payout Account
                </span>
                {liveUser.bankDetails?.upiId || liveUser.bankDetails?.accountNumber ? (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
                    PAYOUT DETAILS SAVED
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 font-semibold">
                    ACTION NEEDED — ADD BANK / UPI
                  </span>
                )}
              </div>
              {liveUser.bankDetails?.upiId || liveUser.bankDetails?.accountNumber ? (
                <p className="text-xs text-slate-400 mt-0.5">
                  Account Holder: <span className="text-slate-200 font-semibold">{liveUser.bankDetails.accountHolderName || liveUser.name}</span>
                  {liveUser.bankDetails.bankName ? <> • Bank: <span className="text-slate-200">{liveUser.bankDetails.bankName}</span></> : null}
                  {liveUser.bankDetails.ifscCode ? <> • IFSC: <span className="font-mono text-slate-200">{liveUser.bankDetails.ifscCode}</span></> : null}
                  {liveUser.bankDetails.accountNumber ? <> • A/C: <span className="font-mono text-slate-200">••••{liveUser.bankDetails.accountNumber.slice(-4)}</span></> : null}
                  {liveUser.bankDetails.upiId ? <> • UPI: <span className="font-mono text-amber-400">{liveUser.bankDetails.upiId}</span></> : null}
                </p>
              ) : (
                <p className="text-xs text-amber-200/80 mt-0.5">
                  Add your real UPI ID or Bank Account &amp; IFSC so Zuggi can credit your trip earnings directly.
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditingBank((v) => !v)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
          >
            {editingBank ? 'Cancel' : liveUser.bankDetails?.upiId || liveUser.bankDetails?.accountNumber ? 'Edit Bank / UPI' : '+ Add Bank / UPI'}
          </button>
        </div>

        {bankSavedMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-700 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{bankSavedMsg}</span>
          </div>
        )}

        {editingBank && (
          <form onSubmit={handleSaveBankDetails} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-slate-800">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Account Holder Name</label>
              <input
                type="text"
                value={bankForm.accountHolderName}
                onChange={(e) => setBankForm({ ...bankForm, accountHolderName: e.target.value })}
                placeholder="Full name as per bank"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">UPI ID (GPay / PhonePe / Paytm)</label>
              <input
                type="text"
                value={bankForm.upiId}
                onChange={(e) => setBankForm({ ...bankForm, upiId: e.target.value })}
                placeholder="e.g. yourname@okaxis"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Bank Name</label>
              <input
                type="text"
                value={bankForm.bankName}
                onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                placeholder="e.g. State Bank of India"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Account Number</label>
              <input
                type="text"
                value={bankForm.accountNumber}
                onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                placeholder="Bank account number"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">IFSC Code</label>
              <input
                type="text"
                value={bankForm.ifscCode}
                onChange={(e) => setBankForm({ ...bankForm, ifscCode: e.target.value.toUpperCase() })}
                placeholder="e.g. SBIN0000078"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono uppercase focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">PAN Number (for 1% TDS)</label>
              <input
                type="text"
                value={bankForm.pan}
                onChange={(e) => setBankForm({ ...bankForm, pan: e.target.value.toUpperCase() })}
                placeholder="e.g. ABCDE1234F"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono uppercase focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer transition"
              >
                Save Payout Account Details
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Settlement Records Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Settlement & Payout History
          </h3>
          <div className="flex items-center gap-3">
            {settlements.length > 0 && (
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold transition cursor-pointer"
                title="Export all settlement payout records into CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            )}
            <span className="text-xs text-slate-400">({settlements.length} Payouts)</span>
          </div>
        </div>

        {settlements.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Clock className="w-10 h-10 text-slate-700 mx-auto" />
            <p className="text-xs text-slate-400 font-medium">No settlements or payouts yet</p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Trips completed with consignee 4-digit delivery OTP are automatically settled here with 1% TDS Section 194C calculation.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] uppercase text-slate-400">
                <tr>
                  <th className="p-3.5">Reference ID</th>
                  <th className="p-3.5">Date & Time</th>
                  <th className="p-3.5">Gross Freight</th>
                  <th className="p-3.5">Fee (5%)</th>
                  <th className="p-3.5">TDS (1%)</th>
                  <th className="p-3.5">Net Disbursed</th>
                  <th className="p-3.5">Bank UTR Ref</th>
                  <th className="p-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5 font-mono text-amber-400 font-semibold">{s.settlementRef}</td>
                    <td className="p-3.5 text-slate-400">
                      {s.settledAt ? new Date(s.settledAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="p-3.5 font-mono">₹{(s.grossFreight ?? 0).toLocaleString('en-IN')}</td>
                    <td className="p-3.5 font-mono text-slate-400">-₹{(s.commission ?? 0).toLocaleString('en-IN')}</td>
                    <td className="p-3.5 font-mono text-slate-400">-₹{(s.tdsDeduction ?? 0).toLocaleString('en-IN')}</td>
                    <td className="p-3.5 font-mono font-bold text-emerald-400">
                      ₹{(s.netDisbursed ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-400">{s.utrNumber || 'CMS_PENDING'}</td>
                    <td className="p-3.5 text-right">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold uppercase">
                        {s.status}
                      </span>
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
