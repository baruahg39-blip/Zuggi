import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  X, 
  CreditCard, 
  Smartphone, 
  Building2, 
  AlertCircle,
  Sparkles,
  ArrowRight,
  Info
} from 'lucide-react';
import { Booking, User } from '../../types';
import { logisticsStore } from '../../services/store';
import { cashfreeClient, CashfreeGatewayConfig } from '../../services/cashfreeClient';

interface CashfreeEscrowModalProps {
  booking: Booking;
  stage: 'advance_90' | 'balance_10';
  currentUser: User;
  onClose: () => void;
  onPaymentSuccess: (message: string) => void;
}

export const CashfreeEscrowModal: React.FC<CashfreeEscrowModalProps> = ({
  booking,
  stage,
  currentUser,
  onClose,
  onPaymentSuccess
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const sanitizedPhone = (currentUser.phone || '').replace(/\D/g, '').slice(-10);
  const [upiId, setUpiId] = useState<string>(sanitizedPhone ? `${sanitizedPhone}@okhdfcbank` : 'customer@okhdfcbank');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [gatewayConfig, setGatewayConfig] = useState<CashfreeGatewayConfig | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    cashfreeClient.getConfig().then(setGatewayConfig);
  }, []);

  const isAdvance = stage === 'advance_90';
  const amountToPay = isAdvance 
    ? (booking.customerAdvanceAmountInr || Math.round(booking.totalAgreedAmountInr * 0.90))
    : (booking.customerBalanceAmountInr || Math.round(booking.totalAgreedAmountInr * 0.10));

  const totalAgreedFare = booking.totalAgreedAmountInr;
  const platformCommission = booking.platformCommissionInr || Math.round(totalAgreedFare * 0.05);
  const netFleetEarnings = booking.netDriverPayableInr || (totalAgreedFare - platformCommission);

  const handleProcessPayment = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // 1. Call Cashfree Order Creation API
      const result = await cashfreeClient.createOrder({
        bookingId: booking.id,
        stage,
        amount: amountToPay,
        customer: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email || 'customer@zuggi.in',
          phone: currentUser.phone || '9876543210'
        },
        driverVendorId: `vnd_${booking.driverId}`,
        driverPayoutAmount: isAdvance ? booking.driverFirstPayoutInr : booking.driverFinalPayoutInr
      });

      if (!result.success) {
        throw new Error(result.message || 'Payment initiation failed.');
      }

      // Simulate a realistic gateway processing delay (1.2s)
      await new Promise((r) => setTimeout(r, 1200));

      // 2. Authoritative Store Update
      if (isAdvance) {
        const updateRes = logisticsStore.payCustomerAdvance(booking.id, result.data?.order_id);
        if (updateRes.success) {
          onPaymentSuccess(`Advance payment of ₹${amountToPay.toLocaleString('en-IN')} secured in Cashfree Escrow! Transporter dispatched.`);
        } else {
          throw new Error(updateRes.message);
        }
      } else {
        const updateRes = logisticsStore.payCustomerBalance(booking.id, result.data?.order_id);
        if (updateRes.success) {
          onPaymentSuccess(`Final balance of ₹${amountToPay.toLocaleString('en-IN')} paid successfully! Trip settlement complete.`);
        } else {
          throw new Error(updateRes.message);
        }
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment failed. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Cashfree Easy Split Escrow</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 uppercase">
                  {gatewayConfig?.environment || 'SANDBOX'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isAdvance ? 'Stage 1: 90% Advance Payment (Pre-Pickup)' : 'Stage 2: 10% Final Balance Payment (Post-Delivery)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Amount Hero */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/90 text-center space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {isAdvance ? 'Advance Escrow Deposit (90%)' : 'Remaining Balance Due (10%)'}
            </span>
            <div className="text-3xl font-black text-emerald-400 font-mono">
              ₹{amountToPay.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500">
              {isAdvance 
                ? 'Secured safely in escrow; released to driver only upon verified pickup and delivery.'
                : 'Final payout to driver will only be unlocked after POD confirmation and dispute check.'}
            </p>
          </div>

          {/* Business Split Breakdown Accordion */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-300 font-semibold pb-1.5 border-b border-slate-800">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                <span>Marketplace Split Breakdown</span>
              </span>
              <span className="text-slate-400 text-[10px]">Easy Split Auto-Settlement</span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Agreed Total Booking Fare:</span>
                <span className="font-mono text-slate-200 font-bold">₹{totalAgreedFare.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Zuggi Platform Commission (5%):</span>
                <span className="font-mono text-amber-400 font-bold">-₹{platformCommission.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Net Fleet Earnings (95%):</span>
                <span className="font-mono text-emerald-400 font-bold">₹{netFleetEarnings.toLocaleString('en-IN')}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-800/60 flex justify-between font-bold text-slate-300">
                <span>Fleet 1st Payout (90% upon pickup):</span>
                <span className="font-mono text-slate-100">₹{(booking.driverFirstPayoutInr || Math.round(netFleetEarnings * 0.90)).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-300">
                <span>Fleet Final Payout (10% upon POD):</span>
                <span className="font-mono text-slate-100">₹{(booking.driverFinalPayoutInr || Math.round(netFleetEarnings * 0.10)).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Choose Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedMethod('upi')}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 cursor-pointer ${
                  selectedMethod === 'upi'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-bold">UPI / QR</span>
                <span className="text-[9px] text-slate-500">Instant Escrow</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod('card')}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 cursor-pointer ${
                  selectedMethod === 'card'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CreditCard className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold">Cards</span>
                <span className="text-[9px] text-slate-500">Debit / Credit</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod('netbanking')}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 cursor-pointer ${
                  selectedMethod === 'netbanking'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-bold">Net Banking</span>
                <span className="text-[9px] text-slate-500">Corporate & Retail</span>
              </button>
            </div>
          </div>

          {/* Method Input Fields */}
          {selectedMethod === 'upi' && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <label className="text-[11px] font-semibold text-slate-300 block">
                Enter UPI ID (Google Pay, PhonePe, Paytm, BHIM)
              </label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="mobile@upi or username@okhdfcbank"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-400">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Zero convenience fee on UPI transfers</span>
              </div>
            </div>
          )}

          {/* Security & Regulatory Escrow Trust Note */}
          <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-800/40 text-[11px] text-indigo-200/90 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Protected by Cashfree Marketplace Escrow</p>
              <p className="text-[10px] text-indigo-300/80 mt-0.5">
                Funds are held in a nodal escrow account. The 90% advance is released only upon confirmed pickup, and the remaining 10% requires POD verification with dispute protection.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleProcessPayment}
            disabled={isProcessing}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer active:scale-98 disabled:opacity-50"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Processing Cashfree Escrow...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                <span>Pay ₹{amountToPay.toLocaleString('en-IN')} via Cashfree</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
