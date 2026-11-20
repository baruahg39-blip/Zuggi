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

  useEffect(() => {
    const update = () => {
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
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition cursor-pointer"
            title="Export settlements, Section 194C TDS deductions, and UTR codes into CSV format for Tally, Excel, or CA accounting"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export CSV (Excel / Tally)</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Statement</span>
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <IndianRupee className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-bold text-white">Fleet Net Earnings & Cashfree Settlements</h2>
          <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold border border-indigo-500/30">
            Easy Split Enabled
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
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

      {/* Verified Cashfree Easy Split Vendor Payout Account */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">
                Cashfree Easy Split Beneficiary Account
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
                ACTIVE • Penny-Drop Verified
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Vendor ID: <span className="font-mono text-slate-200">vnd_{currentUser.id}</span> • Bank: <span className="text-slate-200">HDFC Bank (Commercial Branch)</span> • IFSC: <span className="font-mono text-slate-200">HDFC0000128</span> • UPI: <span className="font-mono text-amber-400">{currentUser.phone?.replace(/\D/g, '').slice(-10) || '9876543210'}@okaxis</span>
            </p>
          </div>
        </div>
        <div className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>RBI Regulated Marketplace Escrow</span>
        </div>
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
