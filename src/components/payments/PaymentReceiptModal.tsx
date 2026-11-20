import React from 'react';
import { 
  X, 
  Download, 
  Printer, 
  ShieldCheck, 
  CheckCircle2, 
  Building2, 
  Truck, 
  MapPin,
  Calendar,
  Lock
} from 'lucide-react';
import { Booking, LoadItem } from '../../types';
import { logisticsStore } from '../../services/store';

interface PaymentReceiptModalProps {
  booking: Booking;
  onClose: () => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  booking,
  onClose
}) => {
  const load = logisticsStore.getLoadById(booking.loadId);
  const transactions = logisticsStore.getPaymentTransactions(booking.id);
  const totalAgreedFare = booking.totalAgreedAmountInr;
  const platformCommission = booking.platformCommissionInr;
  const advanceAmount = booking.customerAdvanceAmountInr || Math.round(totalAgreedFare * 0.90);
  const balanceAmount = booking.customerBalanceAmountInr || Math.round(totalAgreedFare * 0.10);

  const isAdvancePaid = booking.paymentAdvanceStatus === 'paid';
  const isBalancePaid = booking.paymentBalanceStatus === 'paid';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Cashfree Easy Split Payment Receipt</h3>
              <p className="text-[10px] text-slate-400 font-mono">Order ID: {booking.cashfreeAdvanceOrderId || booking.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer text-xs flex items-center gap-1"
              title="Print Receipt"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300 bg-slate-900/90 print:bg-white print:text-black">
          {/* Brand Header */}
          <div className="flex justify-between items-start pb-4 border-b border-slate-800">
            <div>
              <div className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-amber-400" />
                <span>ZUGGI FREIGHT</span>
              </div>
              <p className="text-[10px] text-slate-400">Commercial Goods Transportation Marketplace</p>
              <p className="text-[10px] text-slate-500">GST SAC Code: 996511 (Goods Transport Agency)</p>
            </div>
            <div className="text-right space-y-0.5">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 text-[10px] uppercase">
                {isBalancePaid ? 'FULLY SETTLED' : isAdvancePaid ? 'ADVANCE PAID (ESCROW)' : 'PAYMENT PENDING'}
              </span>
              <p className="text-[10px] text-slate-400">Date: {new Date(booking.createdAt).toLocaleDateString('en-IN')}</p>
            </div>
          </div>

          {/* Route & Booking Info */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
            <div>
              <span className="text-[10px] text-slate-500 block">Origin:</span>
              <span className="font-bold text-slate-200">{booking.pickup.city}, {booking.pickup.state}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Destination:</span>
              <span className="font-bold text-slate-200">{booking.delivery.city}, {booking.delivery.state}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Goods Description:</span>
              <span className="text-slate-300">{booking.goodsDescription} ({booking.weightKg} kg)</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Settlement Rail:</span>
              <span className="text-indigo-400 font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" /> Cashfree Easy Split Escrow
              </span>
            </div>
          </div>

          {/* Two-Stage Payment Matrix */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Payment Breakdown</h4>
            <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800 text-[11px]">
              {/* Row 1: 90% Advance */}
              <div className="p-3 bg-slate-950/70 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    {isAdvancePaid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-600" />
                    )}
                    <span>Stage 1: 90% Advance Escrow Payment</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Required prior to vehicle pickup dispatch</p>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-sm text-emerald-400">₹{advanceAmount.toLocaleString('en-IN')}</div>
                  <span className={`text-[9px] uppercase font-bold ${isAdvancePaid ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {isAdvancePaid ? 'Paid & Escrowed' : 'Pending'}
                  </span>
                </div>
              </div>

              {/* Row 2: 10% Balance */}
              <div className="p-3 bg-slate-950/70 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    {isBalancePaid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-600" />
                    )}
                    <span>Stage 2: 10% Final Balance Payment</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Released upon delivery & POD confirmation</p>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-sm text-slate-200">₹{balanceAmount.toLocaleString('en-IN')}</div>
                  <span className={`text-[9px] uppercase font-bold ${isBalancePaid ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {isBalancePaid ? 'Paid' : 'Pending Delivery'}
                  </span>
                </div>
              </div>

              {/* Row 3: Total Agreed */}
              <div className="p-3 bg-slate-950 flex items-center justify-between font-bold">
                <span className="text-white">Total Agreed Booking Fare</span>
                <span className="text-base font-extrabold text-white font-mono">₹{totalAgreedFare.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Audit Transactions */}
          {transactions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gateway Audit Log</h4>
              <div className="space-y-1.5">
                {transactions.map((tx) => (
                  <div key={tx.id} className="p-2 rounded-lg bg-slate-950/50 border border-slate-800 flex justify-between items-center text-[10px]">
                    <div>
                      <span className="font-mono text-slate-300 font-semibold">{tx.type.replace('_', ' ').toUpperCase()}</span>
                      <span className="text-slate-500 block">{new Date(tx.timestamp).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-emerald-400 font-bold">₹{tx.amountInr.toLocaleString('en-IN')}</span>
                      <span className="text-slate-500 block">{tx.orderId}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compliance Footer */}
          <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-500 text-center space-y-1">
            <p>Reverse Charge Mechanism (RCM) applicable under GST for Road Transport of Goods.</p>
            <p>This is a computer-generated digital receipt issued via Cashfree Payments Easy Split integration.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
