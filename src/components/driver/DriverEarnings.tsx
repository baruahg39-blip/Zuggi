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
  History
} from 'lucide-react';
import { Settlement, User } from '../../types';
import { logisticsStore } from '../../services/store';
import { exportDriverEarningsToCsv } from '../../utils/csvExport';

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
  const [driverBookings, setDriverBookings] = useState<any[]>([]);
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

  const handleSaveBankDetails = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = logisticsStore.updateUserBankDetails(currentUser.id, bankForm, bankForm.pan);
    if (updated) {
      setLiveUser(updated);
      setEditingBank(false);
      setBankSavedMsg('Bank & UPI payout details saved and synced!');
      setTimeout(() => setBankSavedMsg(null), 4000);
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

  const stage1Settled = settlements.filter((s) => s.settlementRef.includes('SPLIT1')).reduce((sum, s) => sum + s.netDisbursed, 0);
  const stage2Settled = settlements.filter((s) => s.settlementRef.includes('SPLIT2')).reduce((sum, s) => sum + s.netDisbursed, 0);

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
          <h2 className="text-lg sm:text-xl font-extrabold text-[#171318]">Fleet Net Earnings &amp; Cashfree Settlements</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-[#FFF0F6] text-[#E83E83] text-[10px] font-bold border border-[#E83E83]/25">
            Easy Split Enabled
          </span>
        </div>
        <p className="text-xs text-[#77717A] mt-1">
          Automated 2-stage vendor settlements: 90% released on verified pickup, remaining 10% released post-delivery and POD clearance.
        </p>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 text-xs block">Net Disbursed Earnings</span>
          <span className="text-2xl font-extrabold text-emerald-400 font-mono">
            ₹{totalDisbursed.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-500 block">Bank account credited</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 text-xs block">Total Agreed Fares</span>
          <span className="text-2xl font-extrabold text-white font-mono">
            ₹{totalGross.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-500 block">Total cargo value hauled</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 text-xs block">Zuggi Fee (5%)</span>
          <span className="text-2xl font-extrabold text-amber-400 font-mono">
            ₹{totalCommission.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-500 block">Platform commission deducted</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 text-xs block">Net Fleet Rate (95%)</span>
          <span className="text-2xl font-extrabold text-teal-400 font-mono">
            ₹{totalNetFleetEarnings.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-500 block">After 5% commission</span>
        </div>
      </div>

      {/* 2-Stage Cashfree Payout Lifecycle Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Stage 1 Payouts (Pickup - 90%)</span>
          <div className="text-lg font-bold text-emerald-400 font-mono">
            ₹{(stage1Settled || Math.round(totalDisbursed * 0.90)).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-500 block">Disbursed on verified pickup</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Stage 2 Payouts (POD - 10%)</span>
          <div className="text-lg font-bold text-slate-200 font-mono">
            ₹{(stage2Settled || Math.round(totalDisbursed * 0.10)).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-500 block">Disbursed post delivery clearance</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Held in Escrow / Disputes</span>
          <div className={`text-lg font-bold font-mono ${disputedHoldAmount > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
            ₹{disputedHoldAmount.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-500 block">
            {disputedHoldAmount > 0 ? `${activeDisputes.length} active customer dispute(s)` : 'Zero active disputes'}
          </span>
        </div>
      </div>

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
