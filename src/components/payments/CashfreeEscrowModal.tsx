import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  X,
  CreditCard,
  Smartphone,
  Banknote,
  AlertCircle,
  ArrowRight,
  Info,
  Copy,
  Check
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
  const [selectedMethod, setSelectedMethod] = useState<'direct_upi' | 'pay_on_site' | 'online_gateway'>('direct_upi');
  const [utrReference, setUtrReference] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [gatewayConfig, setGatewayConfig] = useState<CashfreeGatewayConfig | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    cashfreeClient.getConfig().then(setGatewayConfig);
  }, []);

  const isAdvance = stage === 'advance_90';
  const totalAgreedFare = Number(booking.totalAgreedAmountInr) || 0;
  const amountToPay = isAdvance
    ? Number(booking.customerAdvanceAmountInr) || Math.round(totalAgreedFare * 0.90)
    : Number(booking.customerBalanceAmountInr) || Math.round(totalAgreedFare * 0.10);

  const platformCommission = Number(booking.platformCommissionInr) || Math.round(totalAgreedFare * 0.05);
  const netFleetEarnings = Number(booking.netDriverPayableInr) || Math.max(0, totalAgreedFare - platformCommission);

  // Use assigned driver's verified UPI if available, else Zuggi's primary merchant UPI
  const driverUser = logisticsStore.getUserById(booking.driverId);
  const merchantUpiId =
    (import.meta as any).env?.VITE_ZUGGI_MERCHANT_UPI ||
    driverUser?.bankDetails?.upiId ||
    'zuggi.freight@okaxis';
  const merchantName = (import.meta as any).env?.VITE_ZUGGI_MERCHANT_NAME || 'Zuggi Freight Logistics';

  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(merchantUpiId)}&pn=${encodeURIComponent(
    merchantName
  )}&am=${amountToPay}&cu=INR&tn=${encodeURIComponent(`Zuggi Booking ${booking.id} ${isAdvance ? 'Advance' : 'Balance'}`)}`;

  const handleCopyUpi = () => {
    navigator.clipboard?.writeText(merchantUpiId).catch(() => {});
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleProcessPayment = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      if (selectedMethod === 'direct_upi') {
        const cleanUtr = utrReference.trim();
        if (cleanUtr.length < 6) {
          setErrorMessage('Please complete the UPI payment and enter the 12-digit UPI UTR / Transaction Reference ID.');
          setIsProcessing(false);
          return;
        }
        const refId = `UPI_UTR_${cleanUtr}`;
        const updateRes = isAdvance
          ? logisticsStore.payCustomerAdvance(booking.id, refId, 'Direct UPI Transfer')
          : logisticsStore.payCustomerBalance(booking.id, refId, 'Direct UPI Transfer');

        if (!updateRes.success) throw new Error(updateRes.message);
        onPaymentSuccess(
          isAdvance
            ? `Advance payment of ₹${amountToPay.toLocaleString('en-IN')} recorded (UTR: ${cleanUtr}). Driver notified for pickup!`
            : `Final balance of ₹${amountToPay.toLocaleString('en-IN')} recorded (UTR: ${cleanUtr}). Trip settlement complete!`
        );
        onClose();
        return;
      }

      if (selectedMethod === 'pay_on_site') {
        const label = isAdvance ? 'Cash / Direct UPI at Loading Point' : 'Cash / Direct UPI at Delivery';
        const refId = `${isAdvance ? 'PAY_AT_PICKUP' : 'PAY_AT_DELIVERY'}_${Date.now().toString().slice(-6)}`;
        const updateRes = isAdvance
          ? logisticsStore.payCustomerAdvance(booking.id, refId, label)
          : logisticsStore.payCustomerBalance(booking.id, refId, label);

        if (!updateRes.success) throw new Error(updateRes.message);
        onPaymentSuccess(
          isAdvance
            ? `Confirmed ₹${amountToPay.toLocaleString('en-IN')} payable at Loading Point. Truck dispatched for pickup!`
            : `Confirmed ₹${amountToPay.toLocaleString('en-IN')} settled directly at Delivery.`
        );
        onClose();
        return;
      }

      // Online Gateway (Cashfree Escrow)
      const result = await cashfreeClient.createOrder({
        bookingId: booking.id,
        stage,
        amount: amountToPay,
        customer: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email || 'customer@zuggi.in',
          phone: currentUser.phone || ''
        },
        driverVendorId: `vnd_${booking.driverId}`,
        driverPayoutAmount: isAdvance ? booking.driverFirstPayoutInr : booking.driverFinalPayoutInr
      });

      if (!result.success) {
        throw new Error(result.message || 'Online gateway initiation failed. Please use Direct UPI or Pay at Pickup.');
      }

      await new Promise((r) => setTimeout(r, 900));

      const updateRes = isAdvance
        ? logisticsStore.payCustomerAdvance(booking.id, result.data?.order_id, 'Cashfree Online Escrow')
        : logisticsStore.payCustomerBalance(booking.id, result.data?.order_id, 'Cashfree Online Escrow');

      if (!updateRes.success) throw new Error(updateRes.message);

      onPaymentSuccess(
        isAdvance
          ? `Advance payment of ₹${amountToPay.toLocaleString('en-IN')} secured in Escrow! Transporter dispatched.`
          : `Final balance of ₹${amountToPay.toLocaleString('en-IN')} paid successfully! Trip settlement complete.`
      );
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment confirmation failed. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Zuggi Freight Payment</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 uppercase">
                  {gatewayConfig?.environment === 'PRODUCTION' ? 'LIVE ESCROW' : 'INSTANT ACTIVE'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isAdvance ? 'Stage 1: 90% Advance (Before Loading)' : 'Stage 2: 10% Final Balance (Upon Delivery)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
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
              {isAdvance ? 'Advance Freight Payable (90%)' : 'Final Balance Due (10%)'}
            </span>
            <div className="text-3xl font-black text-emerald-400 font-mono">
              ₹{amountToPay.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500">
              Total Agreed Fare: ₹{totalAgreedFare.toLocaleString('en-IN')} • Booking #{booking.id}
            </p>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Select Practical Payment Option
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedMethod('direct_upi');
                  setErrorMessage(null);
                }}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 cursor-pointer ${
                  selectedMethod === 'direct_upi'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-bold">Direct UPI</span>
                <span className="text-[9px] text-slate-400">GPay / PhonePe</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedMethod('pay_on_site');
                  setErrorMessage(null);
                }}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 cursor-pointer ${
                  selectedMethod === 'pay_on_site'
                    ? 'bg-amber-600/20 border-amber-500 text-amber-200 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Banknote className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold">{isAdvance ? 'Pay at Pickup' : 'Pay on Delivery'}</span>
                <span className="text-[9px] text-slate-400">Cash / UPI On-Site</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedMethod('online_gateway');
                  setErrorMessage(null);
                }}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 cursor-pointer ${
                  selectedMethod === 'online_gateway'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CreditCard className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-bold">Cards / NetBank</span>
                <span className="text-[9px] text-slate-400">Cashfree Escrow</span>
              </button>
            </div>
          </div>

          {/* Direct UPI Flow */}
          {selectedMethod === 'direct_upi' && (
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between gap-2 bg-slate-900 p-3 rounded-lg border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Pay to Zuggi / Fleet UPI ID</span>
                  <span className="text-sm font-mono font-bold text-emerald-400">{merchantUpiId}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                  </button>
                  <a
                    href={upiDeepLink}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold"
                  >
                    Open UPI App
                  </a>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Enter UPI UTR / Transaction Reference Number *
                </label>
                <input
                  type="text"
                  value={utrReference}
                  onChange={(e) => setUtrReference(e.target.value)}
                  placeholder="e.g. 432519876543 (from Google Pay / PhonePe / Paytm)"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>Zero extra gateway fee. UTR is logged on your booking &amp; GST invoice.</span>
                </p>
              </div>
            </div>
          )}

          {/* Pay at Pickup / Delivery Flow */}
          {selectedMethod === 'pay_on_site' && (
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2 text-xs text-amber-100">
              <p className="font-bold text-amber-300">
                {isAdvance ? 'Pay Directly at Loading Point (Cash / UPI)' : 'Pay Final Balance Directly at Unloading Point'}
              </p>
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                {isAdvance
                  ? `Confirm dispatch now and pay ₹${amountToPay.toLocaleString('en-IN')} directly to the driver or transport supervisor after the truck arrives and loading begins.`
                  : `Settle the remaining ₹${amountToPay.toLocaleString('en-IN')} directly upon safe unloading and verification of goods before sharing your 4-digit Delivery OTP.`}
              </p>
            </div>
          )}

          {/* Online Gateway Flow */}
          {selectedMethod === 'online_gateway' && (
            <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-800/40 text-[11px] text-indigo-200/90 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white">Cashfree Marketplace Escrow Protection</p>
                <p className="text-[10px] text-indigo-300/80 mt-0.5">
                  Funds are protected in escrow — 90% is released to the fleet only after confirmed loading, and the final 10% after signed POD &amp; Delivery OTP verification.
                </p>
              </div>
            </div>
          )}

          {/* Transparent Fare Breakdown */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between text-slate-300 font-semibold pb-1 border-b border-slate-800">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                <span>Transparent Fare Breakdown</span>
              </span>
              <span className="text-slate-400 text-[10px]">No Hidden Charges</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Agreed Total Booking Fare:</span>
              <span className="font-mono text-slate-200 font-bold">₹{totalAgreedFare.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Zuggi Platform Fee (5% included):</span>
              <span className="font-mono text-amber-400 font-bold">₹{platformCommission.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Net Payable to Fleet (95%):</span>
              <span className="font-mono text-emerald-400 font-bold">₹{netFleetEarnings.toLocaleString('en-IN')}</span>
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
                <span>Confirming Payment...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                <span>
                  {selectedMethod === 'direct_upi'
                    ? `Confirm UPI Payment (₹${amountToPay.toLocaleString('en-IN')})`
                    : selectedMethod === 'pay_on_site'
                    ? isAdvance
                      ? `Confirm Dispatch (Pay at Pickup)`
                      : `Confirm On-Site Settlement`
                    : `Pay ₹${amountToPay.toLocaleString('en-IN')} via Escrow`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
