import React from 'react';
import {
  X,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Truck,
  Clock
} from 'lucide-react';
import { Booking, PracticalPaymentMethod } from '../../types';
import { logisticsStore } from '../../services/store';

interface PaymentReceiptModalProps {
  booking: Booking;
  onClose: () => void;
}

function formatMethodLabel(method?: PracticalPaymentMethod, isAdvance = true): string {
  if (method === 'upi') return 'UPI Transfer to Zuggi';
  if (method === 'bank_transfer') return 'NEFT / IMPS Bank Transfer';
  if (method === 'pay_driver_direct') return isAdvance ? 'Direct to Driver at Pickup' : 'Direct to Driver at Delivery';
  if (method === 'online_gateway') return 'Online Payment Gateway';
  return 'Not Paid Yet';
}

function formatStageStatus(status: Booking['paymentAdvanceStatus'], method?: PracticalPaymentMethod): string {
  if (status === 'paid') return 'Paid & Verified';
  if (status === 'processing') {
    return method === 'pay_driver_direct' ? 'Pay Driver On-Site' : 'Verifying UTR';
  }
  return 'Unpaid';
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  booking,
  onClose
}) => {
  const transactions = logisticsStore.getPaymentTransactions(booking.id);
  const business = logisticsStore.getBusinessPaymentSettings();
  const totalAgreedFare = Number(booking.totalAgreedAmountInr) || 0;
  const advanceAmount = Number(booking.customerAdvanceAmountInr) || Math.round(totalAgreedFare * 0.90);
  const balanceAmount = Number(booking.customerBalanceAmountInr) || Math.round(totalAgreedFare * 0.10);

  const isAdvancePaid = booking.paymentAdvanceStatus === 'paid';
  const isBalancePaid = booking.paymentBalanceStatus === 'paid';
  const isAdvanceProcessing = booking.paymentAdvanceStatus === 'processing';
  const isBalanceProcessing = booking.paymentBalanceStatus === 'processing';

  const overallLabel =
    isAdvancePaid && isBalancePaid
      ? 'FULLY PAID'
      : isAdvancePaid
      ? 'ADVANCE PAID (90%)'
      : isAdvanceProcessing
      ? 'VERIFICATION PENDING'
      : 'PAYMENT PENDING';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Zuggi Freight Payment Receipt</h3>
              <p className="text-[11px] text-slate-400 font-mono">Booking #{booking.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[36px] px-3 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition cursor-pointer text-xs font-semibold flex items-center gap-1.5"
              title="Print Receipt"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close receipt"
              className="w-9 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Receipt Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300 bg-slate-900 print:bg-white print:text-black">
          <div className="flex justify-between items-start pb-4 border-b border-slate-800">
            <div>
              <div className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-amber-400" />
                <span>{(business.businessName || 'ZUGGI FREIGHT').toUpperCase()}</span>
              </div>
              <p className="text-[11px] text-slate-400">Commercial Goods Transportation Marketplace</p>
              <p className="text-[10px] text-slate-500">GST SAC Code: 996511 (Goods Transport Agency)</p>
            </div>
            <div className="text-right space-y-0.5">
              <span
                className={`text-[11px] font-bold uppercase ${
                  isAdvancePaid && isBalancePaid
                    ? 'text-emerald-400'
                    : isAdvancePaid
                    ? 'text-sky-400'
                    : 'text-amber-400'
                }`}
              >
                {overallLabel}
              </span>
              <p className="text-[10px] text-slate-400">
                Date: {new Date(booking.createdAt).toLocaleDateString('en-IN')}
              </p>
            </div>
          </div>

          {/* Route & Goods Info */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
            <div>
              <span className="text-[10px] text-slate-500 block">Pickup</span>
              <span className="font-bold text-slate-200">
                {booking.pickup.city}, {booking.pickup.state}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Delivery</span>
              <span className="font-bold text-slate-200">
                {booking.delivery.city}, {booking.delivery.state}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Goods</span>
              <span className="text-slate-300">
                {booking.goodsDescription} ({booking.weightKg} kg)
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Payment Structure</span>
              <span className="text-slate-200 font-semibold">90% Advance + 10% On Delivery</span>
            </div>
          </div>

          {/* 2-Step Payment Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Payment Breakdown</h4>
            <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800 text-[11px]">
              {/* Step 1: 90% Advance */}
              <div className="p-3.5 bg-slate-950/70 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    {isAdvancePaid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : isAdvanceProcessing ? (
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
                    )}
                    <span>Step 1: 90% Advance (Before / At Pickup)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Method: {formatMethodLabel(booking.advancePaymentMethod, true)}
                    {booking.advancePaymentUtr ? ` · UTR: ${booking.advancePaymentUtr}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono tabular-nums font-bold text-sm text-white">
                    ₹{advanceAmount.toLocaleString('en-IN')}
                  </div>
                  <span
                    className={`text-[10px] uppercase font-bold ${
                      isAdvancePaid
                        ? 'text-emerald-400'
                        : isAdvanceProcessing
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {formatStageStatus(booking.paymentAdvanceStatus, booking.advancePaymentMethod)}
                  </span>
                </div>
              </div>

              {/* Step 2: 10% Balance */}
              <div className="p-3.5 bg-slate-950/70 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    {isBalancePaid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : isBalanceProcessing ? (
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
                    )}
                    <span>Step 2: 10% Final Balance (On Delivery)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Method: {formatMethodLabel(booking.balancePaymentMethod, false)}
                    {booking.balancePaymentUtr ? ` · UTR: ${booking.balancePaymentUtr}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono tabular-nums font-bold text-sm text-white">
                    ₹{balanceAmount.toLocaleString('en-IN')}
                  </div>
                  <span
                    className={`text-[10px] uppercase font-bold ${
                      isBalancePaid
                        ? 'text-emerald-400'
                        : isBalanceProcessing
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {formatStageStatus(booking.paymentBalanceStatus, booking.balancePaymentMethod)}
                  </span>
                </div>
              </div>

              {/* Total */}
              <div className="p-3.5 bg-slate-950 flex items-center justify-between font-bold">
                <span className="text-white">Total Agreed Freight</span>
                <span className="text-base font-extrabold text-white font-mono tabular-nums">
                  ₹{totalAgreedFare.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Activity Log */}
          {transactions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment Records</h4>
              <div className="space-y-1.5">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex justify-between items-center gap-3 text-[11px]"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-200 block truncate">
                        {tx.type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {new Date(tx.timestamp).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="text-right font-mono tabular-nums shrink-0">
                      <span className="text-emerald-400 font-bold block">
                        ₹{tx.amountInr.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {tx.orderId} · {tx.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-500 text-center space-y-1">
            <p>Reverse Charge Mechanism (RCM) applicable under GST for Road Transport of Goods.</p>
            <p>Computer-generated payment record issued by {business.businessName || 'Zuggi Freight Logistics'}.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
