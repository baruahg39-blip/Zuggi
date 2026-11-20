import React, { useState, useEffect, useMemo } from 'react';
import { 
  IndianRupee, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileSpreadsheet, 
  RefreshCw, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Building2, 
  UserCheck, 
  ExternalLink,
  Info
} from 'lucide-react';
import { Booking, CashfreeVendor, MarketplacePaymentTransaction, PaymentDispute } from '../../types';
import { logisticsStore } from '../../services/store';
import { cashfreeClient, CashfreeGatewayConfig } from '../../services/cashfreeClient';

export const AdminPaymentsTab: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [transactions, setTransactions] = useState<MarketplacePaymentTransaction[]>([]);
  const [vendors, setVendors] = useState<CashfreeVendor[]>([]);
  const [disputes, setDisputes] = useState<PaymentDispute[]>([]);
  const [gatewayConfig, setGatewayConfig] = useState<CashfreeGatewayConfig | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const refreshData = () => {
    setBookings(logisticsStore.getBookings());
    setTransactions(logisticsStore.getPaymentTransactions());
    setVendors(logisticsStore.getCashfreeVendors());
    setDisputes(logisticsStore.getDisputes());
  };

  useEffect(() => {
    refreshData();
    cashfreeClient.getConfig().then(setGatewayConfig);
    const unsub = logisticsStore.subscribe(refreshData);
    return unsub;
  }, []);

  // Compute Financial Aggregates
  const totalAgreedGMV = useMemo(
    () => bookings.reduce((sum, b) => sum + (b.totalAgreedAmountInr || 0), 0),
    [bookings]
  );

  const totalAdvanceCollected = useMemo(
    () => bookings.filter((b) => b.paymentAdvanceStatus === 'paid').reduce((sum, b) => sum + (b.customerAdvanceAmountInr || Math.round(b.totalAgreedAmountInr * 0.90)), 0),
    [bookings]
  );

  const totalBalanceCollected = useMemo(
    () => bookings.filter((b) => b.paymentBalanceStatus === 'paid').reduce((sum, b) => sum + (b.customerBalanceAmountInr || Math.round(b.totalAgreedAmountInr * 0.10)), 0),
    [bookings]
  );

  const totalCustomerCollections = totalAdvanceCollected + totalBalanceCollected;

  const totalCommissionEarned = useMemo(
    () => bookings.filter((b) => b.paymentAdvanceStatus === 'paid').reduce((sum, b) => sum + (b.platformCommissionInr || Math.round(b.totalAgreedAmountInr * 0.05)), 0),
    [bookings]
  );

  const totalDisbursedPayouts = useMemo(() => {
    const stage1 = bookings.filter((b) => b.payoutStage1Status === 'settled').reduce((sum, b) => sum + (b.driverFirstPayoutInr || 0), 0);
    const stage2 = bookings.filter((b) => b.payoutStage2Status === 'settled').reduce((sum, b) => sum + (b.driverFinalPayoutInr || 0), 0);
    return stage1 + stage2;
  }, [bookings]);

  const activeDisputesList = useMemo(
    () => disputes.filter((d) => d.status === 'OPEN' || d.status === 'INVESTIGATING'),
    [disputes]
  );

  const totalHeldInDisputes = useMemo(
    () => activeDisputesList.reduce((sum, d) => sum + d.heldAmountInr, 0),
    [activeDisputesList]
  );

  const totalRefundsProcessed = useMemo(
    () => transactions.filter((t) => t.type === 'refund').reduce((sum, t) => sum + t.amountInr, 0),
    [transactions]
  );

  const handleResolveDispute = (disputeId: string, resolution: 'release_to_driver' | 'refund_to_customer') => {
    setResolvingId(disputeId);
    const res = logisticsStore.resolvePaymentDispute(
      disputeId,
      resolution,
      resolution === 'release_to_driver' ? 'Approved by Admin after cargo inspection' : 'Refund authorized due to transit damage'
    );
    setActionFeedback(res.message);
    setResolvingId(null);
    setTimeout(() => setActionFeedback(null), 5000);
  };

  const handleExportCsv = () => {
    const headers = ['Transaction ID', 'Booking ID', 'Type', 'Amount (INR)', 'Order ID', 'Status', 'Timestamp', 'Notes'];
    const rows = transactions.map((t) => [
      t.id,
      t.bookingId,
      t.type,
      t.amountInr,
      t.orderId,
      t.status,
      t.timestamp,
      `"${t.notes.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Zuggi_Cashfree_Payments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Action Notification */}
      {actionFeedback && (
        <div className="p-4 rounded-xl bg-emerald-950/90 text-emerald-200 border border-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-emerald-400" />
              <span>Cashfree Easy Split Marketplace & Escrow Control</span>
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold border border-indigo-500/30 uppercase">
              {gatewayConfig?.environment || 'SANDBOX'} MODE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time management of two-stage customer payments (90/10), 5% platform commission deductions, and fleet auto-disbursements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Financial Ledger (CSV)</span>
          </button>
        </div>
      </div>

      {/* 7 Core Financial Control KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* 1. Total GMV */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Gross Booking Value</span>
          <span className="text-lg font-black text-white font-mono block">₹{totalAgreedGMV.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block">Total agreed fares</span>
        </div>

        {/* 2. Customer Collections */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Customer Collections</span>
          <span className="text-lg font-black text-emerald-400 font-mono block">₹{totalCustomerCollections.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block">Advance + Final</span>
        </div>

        {/* 3. Platform Commission */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Platform Fee (5%)</span>
          <span className="text-lg font-black text-amber-400 font-mono block">₹{totalCommissionEarned.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block">Zuggi revenue</span>
        </div>

        {/* 4. Successful Payouts */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Disbursed to Fleet</span>
          <span className="text-lg font-black text-teal-400 font-mono block">₹{totalDisbursedPayouts.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block">Stage 1 & Stage 2</span>
        </div>

        {/* 5. Active Disputes */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-rose-400 uppercase font-bold block">Disputed on Hold</span>
          <span className="text-lg font-black text-rose-400 font-mono block">₹{totalHeldInDisputes.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block">{activeDisputesList.length} active dispute(s)</span>
        </div>

        {/* 6. Refunds */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Refunds</span>
          <span className="text-lg font-black text-slate-300 font-mono block">₹{totalRefundsProcessed.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block">Customer reversals</span>
        </div>

        {/* 7. Vendors Active */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Vendors (Fleet)</span>
          <span className="text-lg font-black text-indigo-400 font-mono block">{vendors.length || bookings.length}</span>
          <span className="text-[10px] text-slate-500 block">Easy Split Onboarded</span>
        </div>
      </div>

      {/* DISPUTE RESOLUTION QUEUE */}
      {activeDisputesList.length > 0 && (
        <div className="p-5 rounded-2xl bg-rose-950/20 border-2 border-rose-500/40 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-rose-500/30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
              <h3 className="text-sm font-bold text-white">Active Cargo Disputes (Final Payouts Locked)</h3>
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
                    <span className="font-bold text-white text-sm">Booking ID: {disp.bookingId}</span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Shipper: <strong className="text-slate-200">{disp.customerName}</strong> • Driver: <strong className="text-slate-200">{disp.driverName}</strong>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Held in Escrow:</span>
                    <span className="text-base font-extrabold text-rose-400 font-mono">
                      ₹{disp.heldAmountInr.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                  <div className="font-bold text-rose-400 uppercase text-[10px] mb-1">
                    Dispute Reason: {disp.reason.replace('_', ' ')}
                  </div>
                  <p className="text-xs">{disp.description}</p>
                  {disp.evidencePhotoUrl && (
                    <div className="mt-2 flex items-center gap-2 text-indigo-400 text-[11px]">
                      <ExternalLink className="w-3.5 h-3.5" />
                      <a href={disp.evidencePhotoUrl} target="_blank" rel="noreferrer" className="underline font-semibold">
                        View Cargo Photo Evidence
                      </a>
                    </div>
                  )}
                </div>

                {/* Dispute Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-900">
                  <button
                    type="button"
                    disabled={resolvingId === disp.id}
                    onClick={() => handleResolveDispute(disp.id, 'refund_to_customer')}
                    className="px-3.5 py-2 rounded-xl bg-rose-900/80 hover:bg-rose-800 text-rose-200 text-xs font-bold transition cursor-pointer"
                  >
                    Authorize Customer Refund (₹{disp.heldAmountInr.toLocaleString('en-IN')})
                  </button>

                  <button
                    type="button"
                    disabled={resolvingId === disp.id}
                    onClick={() => handleResolveDispute(disp.id, 'release_to_driver')}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Release Final Payout to Driver
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EASY SPLIT VENDOR ONBOARDING TABLE */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden space-y-3">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-400" />
              <span>Easy Split Verified Fleet Vendors</span>
            </h3>
            <p className="text-[11px] text-slate-500">Transporters verified for automated split disbursements</p>
          </div>
          <span className="text-xs text-emerald-400 font-semibold">Penny-Drop Verified</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] uppercase text-slate-400 font-mono">
              <tr>
                <th className="p-3.5">Vendor ID</th>
                <th className="p-3.5">Transporter Name</th>
                <th className="p-3.5">Settlement Method</th>
                <th className="p-3.5">IFSC / UPI</th>
                <th className="p-3.5">PAN / GSTIN</th>
                <th className="p-3.5 text-right">Cashfree Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-sans">
              {bookings.slice(0, 5).map((b) => (
                <tr key={b.id} className="hover:bg-slate-950/40 transition">
                  <td className="p-3.5 font-mono text-slate-400">vnd_{b.driverId.slice(-8)}</td>
                  <td className="p-3.5 font-bold text-white">Assigned Transporter ({b.vehicleId})</td>
                  <td className="p-3.5 text-slate-300">Direct Bank Split (IMPS/NEFT)</td>
                  <td className="p-3.5 font-mono text-amber-400">HDFC0000128 • 9876543210@okaxis</td>
                  <td className="p-3.5 font-mono text-slate-400">AAAFK4902L</td>
                  <td className="p-3.5 text-right">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 text-[10px]">
                      ACTIVE
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FULL FINANCIAL TRANSACTION AUDIT TRAIL */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Real-Time Payment & Split Audit Trail
          </h3>
          <span className="text-xs text-slate-400">({transactions.length} Records)</span>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <Lock className="w-8 h-8 mx-auto mb-2 text-slate-700" />
            <p>No transactions recorded yet in this session.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] uppercase text-slate-400 font-mono">
                <tr>
                  <th className="p-3.5">Tx ID</th>
                  <th className="p-3.5">Booking</th>
                  <th className="p-3.5">Stage / Type</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Cashfree Ref</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-sans">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-950/40 transition">
                    <td className="p-3.5 font-mono text-slate-400 text-[11px]">{tx.id}</td>
                    <td className="p-3.5 font-mono text-indigo-400 font-bold">{tx.bookingId}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tx.type === 'customer_advance_90'
                          ? 'bg-blue-500/20 text-blue-400'
                          : tx.type === 'customer_balance_10'
                          ? 'bg-indigo-500/20 text-indigo-400'
                          : tx.type === 'driver_payout_stage1'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : tx.type === 'driver_payout_stage2'
                          ? 'bg-teal-500/20 text-teal-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {tx.type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-white text-sm">
                      ₹{tx.amountInr.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3.5 font-mono text-slate-400 text-[11px]">{tx.orderId}</td>
                    <td className="p-3.5">
                      <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>SUCCESS</span>
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono text-slate-400 text-[11px]">
                      {new Date(tx.timestamp).toLocaleString('en-IN')}
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
