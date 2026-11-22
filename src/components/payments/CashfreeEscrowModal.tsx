import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  X,
  CreditCard,
  Smartphone,
  Banknote,
  Building2,
  AlertCircle,
  ArrowRight,
  Info,
  Copy,
  Check,
  Clock
} from 'lucide-react';
import { Booking, BusinessPaymentSettings, User } from '../../types';
import { logisticsStore } from '../../services/store';
import { cashfreeClient, CashfreeGatewayConfig } from '../../services/cashfreeClient';

interface CashfreeEscrowModalProps {
  booking: Booking;
  stage: 'advance_90' | 'balance_10';
  currentUser: User;
  onClose: () => void;
  onPaymentSuccess: (message: string) => void;
}

type PaymentTab = 'upi' | 'pay_driver_direct' | 'bank_transfer' | 'online_gateway';

export const CashfreeEscrowModal: React.FC<CashfreeEscrowModalProps> = ({
  booking,
  stage,
  currentUser,
  onClose,
  onPaymentSuccess
}) => {
  const [businessSettings, setBusinessSettings] = useState<BusinessPaymentSettings>(() =>
    logisticsStore.getBusinessPaymentSettings()
  );
  const [selectedMethod, setSelectedMethod] = useState<PaymentTab>(() => {
    const cfg = logisticsStore.getBusinessPaymentSettings();
    return cfg.upiId ? 'upi' : 'pay_driver_direct';
  });
  const [utrReference, setUtrReference] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [gatewayConfig, setGatewayConfig] = useState<CashfreeGatewayConfig | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    cashfreeClient.getConfig().then(setGatewayConfig);
    const unsub = logisticsStore.subscribe(() => {
      setBusinessSettings(logisticsStore.getBusinessPaymentSettings());
    });
    return unsub;
  }, []);

  const isAdvance = stage === 'advance_90';
  const totalAgreedFare = Number(booking.totalAgreedAmountInr) || 0;
  const amountToPay = isAdvance
    ? Number(booking.customerAdvanceAmountInr) || Math.round(totalAgreedFare * 0.90)
    : Number(booking.customerBalanceAmountInr) || Math.round(totalAgreedFare * 0.10);

  const platformCommission = Number(booking.platformCommissionInr) || Math.round(totalAgreedFare * 0.05);
  const netFleetEarnings = Number(booking.netDriverPayableInr) || Math.max(0, totalAgreedFare - platformCommission);

  const hasBusinessUpi = Boolean(businessSettings.upiId && businessSettings.upiId.includes('@'));
  const hasBusinessBank = Boolean(businessSettings.accountNumber && businessSettings.ifscCode);
  const isLiveGatewayReady = gatewayConfig?.environment === 'PRODUCTION' && gatewayConfig?.isConfigured;

  const rejectionNote = isAdvance ? booking.advanceRejectionNote : booking.balanceRejectionNote;

  const upiDeepLink = hasBusinessUpi
    ? `upi://pay?pa=${encodeURIComponent(businessSettings.upiId)}&pn=${encodeURIComponent(
        businessSettings.businessName || 'Zuggi Freight Logistics'
      )}&am=${amountToPay}&cu=INR&tn=${encodeURIComponent(
        `Zuggi ${booking.id} ${isAdvance ? 'Advance' : 'Balance'}`
      )}`
    : '';

  const handleCopy = (key: string, value: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      if (selectedMethod === 'upi' || selectedMethod === 'bank_transfer') {
        const cleanUtr = utrReference.trim().toUpperCase();
        if (!/^[A-Z0-9_-]{8,30}$/.test(cleanUtr)) {
          setErrorMessage(
            'Enter the real 8–30 character UTR / Transaction Reference ID from your UPI app or bank transfer receipt.'
          );
          setIsProcessing(false);
          return;
        }

        const res = logisticsStore.submitCustomerPayment(booking.id, stage, {
          method: selectedMethod,
          utrReference: cleanUtr
        });
        if (!res.success) throw new Error(res.message);

        onPaymentSuccess(res.message);
        onClose();
        return;
      }

      if (selectedMethod === 'pay_driver_direct') {
        const res = logisticsStore.submitCustomerPayment(booking.id, stage, {
          method: 'pay_driver_direct'
        });
        if (!res.success) throw new Error(res.message);

        onPaymentSuccess(res.message);
        onClose();
        return;
      }

      // Live Production Payment Gateway (only rendered when live production keys are active)
      if (selectedMethod === 'online_gateway' && isLiveGatewayReady) {
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
          throw new Error(result.message || 'Online gateway could not start. Please use UPI or Bank Transfer.');
        }

        const updateRes = isAdvance
          ? logisticsStore.payCustomerAdvance(booking.id, result.data?.order_id, 'Online Gateway')
          : logisticsStore.payCustomerBalance(booking.id, result.data?.order_id, 'Online Gateway');

        if (!updateRes.success) throw new Error(updateRes.message);
        onPaymentSuccess(updateRes.message);
        onClose();
        return;
      }

      setErrorMessage('Please select a payment method to continue.');
      setIsProcessing(false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not record payment. Please check details and try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                {isAdvance ? 'Pay Step 1: 90% Advance' : 'Pay Step 2: 10% Final Balance'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAdvance ? 'Pay before or at pickup loading' : 'Pay upon safe delivery & unloading'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment modal"
            className="w-10 h-10 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {rejectionNote && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300">Previous UTR could not be verified</p>
                <p className="text-amber-200/80 mt-0.5">{rejectionNote}</p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Payable Amount Summary */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                {isAdvance ? '90% Advance Due' : '10% Balance Due'}
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Total Fare ₹{totalAgreedFare.toLocaleString('en-IN')} · Booking #{booking.id}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tabular-nums">
              ₹{amountToPay.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Method Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">Choose how you want to pay</label>
            <div className={`grid gap-2 ${isLiveGatewayReady ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
              <button
                type="button"
                onClick={() => {
                  setSelectedMethod('upi');
                  setErrorMessage(null);
                }}
                className={`min-h-[76px] p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                  selectedMethod === 'upi'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold">UPI</span>
                <span className="text-[10px] text-slate-400">GPay / PhonePe</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedMethod('bank_transfer');
                  setErrorMessage(null);
                }}
                className={`min-h-[76px] p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                  selectedMethod === 'bank_transfer'
                    ? 'bg-sky-500/15 border-sky-500 text-sky-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold">NEFT / IMPS</span>
                <span className="text-[10px] text-slate-400">Bank Transfer</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedMethod('pay_driver_direct');
                  setErrorMessage(null);
                }}
                className={`min-h-[76px] p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                  selectedMethod === 'pay_driver_direct'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Banknote className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold">Pay Driver</span>
                <span className="text-[10px] text-slate-400">
                  {isAdvance ? 'At Pickup' : 'At Delivery'}
                </span>
              </button>

              {isLiveGatewayReady && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMethod('online_gateway');
                    setErrorMessage(null);
                  }}
                  className={`min-h-[76px] p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    selectedMethod === 'online_gateway'
                      ? 'bg-indigo-500/15 border-indigo-500 text-indigo-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold">Cards</span>
                  <span className="text-[10px] text-slate-400">Online Pay</span>
                </button>
              )}
            </div>
          </div>

          {/* 1. UPI Payment Panel */}
          {selectedMethod === 'upi' && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3.5">
              {hasBusinessUpi ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 p-3 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Pay to {businessSettings.businessName}
                      </span>
                      <span className="text-sm font-mono font-bold text-emerald-400 break-all">
                        {businessSettings.upiId}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopy('upi', businessSettings.upiId)}
                        className="min-h-[36px] px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === 'upi' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedKey === 'upi' ? 'Copied' : 'Copy'}</span>
                      </button>
                      <a
                        href={upiDeepLink}
                        className="min-h-[36px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center"
                      >
                        Open UPI App
                      </a>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-200 block mb-1.5">
                      Step 2: Enter 12-Digit UPI UTR / Reference Number *
                    </label>
                    <input
                      type="text"
                      value={utrReference}
                      onChange={(e) => setUtrReference(e.target.value.toUpperCase())}
                      placeholder="e.g. 432519876543"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono uppercase"
                    />
                    <p className="text-[11px] text-slate-400 mt-1.5 flex items-start gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        After you submit the UTR, status shows <strong>Verifying UTR</strong> until Zuggi Admin confirms receipt in the bank statement.
                      </span>
                    </p>
                  </div>
                </>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5">
                  <p className="font-bold text-amber-300">Zuggi Business UPI ID not configured yet</p>
                  <p className="text-amber-200/80">
                    The Admin can add their real Business UPI ID in <strong>Admin → Payments → Collection Account</strong>. Meanwhile, you can use <strong>Pay Driver</strong> directly on-site.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 2. Bank Transfer Panel */}
          {selectedMethod === 'bank_transfer' && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3.5">
              {hasBusinessBank ? (
                <>
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Account Holder</span>
                      <span className="font-bold text-white">{businessSettings.accountHolderName}</span>
                    </div>
                    {businessSettings.bankName && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Bank Name</span>
                        <span className="font-semibold text-slate-200">{businessSettings.bankName}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">Account No.</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sky-300">{businessSettings.accountNumber}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy('acc', businessSettings.accountNumber)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 font-semibold cursor-pointer"
                        >
                          {copiedKey === 'acc' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">IFSC Code</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sky-300">{businessSettings.ifscCode}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy('ifsc', businessSettings.ifscCode)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 font-semibold cursor-pointer"
                        >
                          {copiedKey === 'ifsc' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-200 block mb-1.5">
                      Enter NEFT / IMPS UTR Reference Number *
                    </label>
                    <input
                      type="text"
                      value={utrReference}
                      onChange={(e) => setUtrReference(e.target.value.toUpperCase())}
                      placeholder="e.g. SBINH24321987654"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono uppercase"
                    />
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      Zuggi Admin will verify this UTR in the bank statement and mark your booking paid.
                    </p>
                  </div>
                </>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5">
                  <p className="font-bold text-amber-300">Zuggi Business Bank Account not configured yet</p>
                  <p className="text-amber-200/80">
                    The Admin can add the Business Bank Account &amp; IFSC in <strong>Admin → Payments → Collection Account</strong>. Meanwhile, you can use <strong>UPI</strong> or <strong>Pay Driver</strong>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 3. Pay Driver Directly Panel */}
          {selectedMethod === 'pay_driver_direct' && (
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2 text-xs text-amber-100">
              <p className="font-bold text-amber-300">
                {isAdvance
                  ? 'Pay Driver Directly at Pickup (Cash or Direct UPI)'
                  : 'Pay Driver Directly at Delivery (Cash or Direct UPI)'}
              </p>
              <p className="text-amber-100/80 leading-relaxed">
                {isAdvance
                  ? `Pay ₹${amountToPay.toLocaleString('en-IN')} directly to the driver when the truck reaches pickup and starts loading. Once the driver taps "Confirm Received" on their screen, this step turns Paid.`
                  : `Pay the remaining ₹${amountToPay.toLocaleString('en-IN')} directly to the driver after inspecting your goods at delivery. The driver will tap "Confirm Received" on their screen to close the trip payment.`}
              </p>
              <div className="pt-1 flex items-center gap-1.5 text-[11px] text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Two-sided confirmation: both you and the driver see the verified receipt.</span>
              </div>
            </div>
          )}

          {/* 4. Live Online Gateway (Production only) */}
          {selectedMethod === 'online_gateway' && isLiveGatewayReady && (
            <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-700/40 text-xs text-indigo-200 space-y-1">
              <p className="font-bold text-white">Online Payment Gateway</p>
              <p className="text-[11px] text-indigo-200/80">
                Pay securely via Credit/Debit Card or NetBanking. Your payment is verified automatically upon completion.
              </p>
            </div>
          )}

          {/* Clear Fare Breakdown */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-300 font-semibold pb-1.5 border-b border-slate-800">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Fare Summary</span>
              </span>
              <span className="text-[11px] text-slate-400">Transparent Pricing</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Total Agreed Freight</span>
              <span className="font-mono tabular-nums text-white font-bold">
                ₹{totalAgreedFare.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Zuggi Service Fee (5% included)</span>
              <span className="font-mono tabular-nums text-amber-400 font-semibold">
                ₹{platformCommission.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Driver / Fleet Net Earnings (95%)</span>
              <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                ₹{netFleetEarnings.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              isProcessing ||
              (selectedMethod === 'upi' && !hasBusinessUpi) ||
              (selectedMethod === 'bank_transfer' && !hasBusinessBank)
            }
            className="flex-1 min-h-[44px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <span>Submitting...</span>
            ) : (
              <>
                <span>
                  {selectedMethod === 'upi'
                    ? `Submit UPI UTR (₹${amountToPay.toLocaleString('en-IN')})`
                    : selectedMethod === 'bank_transfer'
                    ? `Submit Bank UTR (₹${amountToPay.toLocaleString('en-IN')})`
                    : selectedMethod === 'pay_driver_direct'
                    ? isAdvance
                      ? `Confirm Pay Driver at Pickup`
                      : `Confirm Pay Driver at Delivery`
                    : `Pay ₹${amountToPay.toLocaleString('en-IN')}`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
