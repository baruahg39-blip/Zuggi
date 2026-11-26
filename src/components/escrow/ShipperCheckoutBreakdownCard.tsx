import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Landmark
} from 'lucide-react';
import {
  calculateEscrow7030Breakdown,
  escrowClient,
  formatInrExact,
  type TripEscrowLedger,
  type EscrowPayoutTranche,
  type FleetVendorSummary
} from '../../services/escrowClient';

interface ShipperCheckoutBreakdownCardProps {
  tripId: string;
  totalFreightInr: number;
  driverId?: string;
  vendorName?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  ledger: TripEscrowLedger | null;
  tranches: EscrowPayoutTranche[];
  vendor?: FleetVendorSummary | null;
  onLedgerUpdated?: (ledger: TripEscrowLedger, tranches: EscrowPayoutTranche[]) => void;
  compact?: boolean;
}

const STATE_META: Record<
  string,
  { label: string; colorClass: string; icon: React.ReactNode }
> = {
  AWAITING_PAYMENT: {
    label: 'Awaiting Escrow Funding',
    colorClass: 'text-amber-700',
    icon: <Clock className="w-4 h-4 text-amber-600" />
  },
  FUNDED_LOCKED: {
    label: 'Funded & Locked in Escrow',
    colorClass: 'text-emerald-700',
    icon: <Lock className="w-4 h-4 text-emerald-600" />
  },
  ADVANCE_70_RELEASED: {
    label: '70% Advance Released · 30% Held',
    colorClass: 'text-blue-700',
    icon: <CheckCircle2 className="w-4 h-4 text-blue-600" />
  },
  DISPUTE_HOLD: {
    label: 'Dispute Hold · 30% Frozen',
    colorClass: 'text-red-700',
    icon: <AlertTriangle className="w-4 h-4 text-red-600" />
  },
  FULLY_SETTLED: {
    label: 'Fully Settled (100%)',
    colorClass: 'text-emerald-700',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />
  },
  REFUNDED: {
    label: 'Refunded to Shipper',
    colorClass: 'text-slate-600',
    icon: <Clock className="w-4 h-4 text-slate-500" />
  }
};

export const ShipperCheckoutBreakdownCard: React.FC<ShipperCheckoutBreakdownCardProps> = ({
  tripId,
  totalFreightInr,
  driverId,
  vendorName,
  customerName,
  customerPhone,
  customerEmail,
  ledger,
  tranches,
  vendor,
  onLedgerUpdated,
  compact = false
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [confirmingSandbox, setConfirmingSandbox] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const computed = calculateEscrow7030Breakdown(ledger?.total_freight_inr || totalFreightInr);
  const totalInr = ledger ? ledger.total_freight_inr : computed.totalFreightInr;
  const platformFeeInr = ledger ? ledger.platform_fee_inr : computed.platformFeeInr;
  const netVendorInr = ledger ? ledger.net_vendor_payable_inr : computed.netVendorPayableInr;
  const advance70Inr = ledger ? ledger.advance_70_amount : computed.advance70Inr;
  const balance30Inr = ledger ? ledger.balance_30_amount : computed.balance30Inr;

  const advanceTranche = tranches.find((t) => t.tranche_type === 'ADVANCE_70');
  const balanceTranche = tranches.find((t) => t.tranche_type === 'BALANCE_30');
  const stateInfo = ledger ? STATE_META[ledger.escrow_state] || STATE_META.AWAITING_PAYMENT : null;

  const handleFundEscrow = async () => {
    setErrorMessage(null);
    setStatusNotice(null);
    setSubmitting(true);
    try {
      const resp = await escrowClient.createEscrowOrder({
        tripId,
        totalFreightInr: totalInr,
        driverId,
        vendorName,
        customerName,
        customerEmail,
        customerPhone
      });

      if (!resp.success || !resp.ledger) {
        setErrorMessage(resp.message || 'Unable to initialize Cashfree escrow checkout.');
        return;
      }

      onLedgerUpdated?.(resp.ledger, resp.tranches || []);

      // Launch live Cashfree JS checkout if configured & SDK loaded
      const cfSdk = (window as any).Cashfree;
      if (!resp.isSimulated && resp.payment_session_id && typeof cfSdk === 'function') {
        const cashfree = cfSdk({ mode: 'sandbox' });
        await cashfree.checkout({
          paymentSessionId: resp.payment_session_id,
          redirectTarget: '_modal'
        });
        setStatusNotice('Cashfree checkout opened. Escrow ledger will lock automatically once payment completes.');
      } else if (resp.isSimulated) {
        setStatusNotice('Cashfree Sandbox Escrow Order initialized. Confirm payment below to lock funds in escrow.');
      }
    } catch {
      setErrorMessage('Network error while creating Cashfree escrow order.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmSandbox = async () => {
    setErrorMessage(null);
    setStatusNotice(null);
    setConfirmingSandbox(true);
    try {
      const resp = await escrowClient.confirmSandboxPayment(tripId);
      if (!resp.success || !resp.ledger) {
        setErrorMessage(resp.message || 'Unable to confirm sandbox payment.');
        return;
      }
      onLedgerUpdated?.(resp.ledger, resp.tranches || []);
      setStatusNotice('Escrow funded & locked. 70% will release automatically once loading is verified.');
    } catch {
      setErrorMessage('Network error while confirming sandbox payment.');
    } finally {
      setConfirmingSandbox(false);
    }
  };

  const canInitializeCheckout = !ledger;
  const awaitingSandboxPayment = ledger?.escrow_state === 'AWAITING_PAYMENT';

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Header */}
      <div className={`${compact ? 'px-4 py-3.5' : 'px-5 py-4'} border-b border-slate-100 flex flex-wrap items-center justify-between gap-2`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 leading-tight">
              Cashfree 70/30 Escrow Checkout
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Easy Split Protection · Verified Fleet Payout Ledger
            </p>
          </div>
        </div>

        {stateInfo && (
          <div className={`inline-flex items-center gap-1.5 text-xs font-semibold ${stateInfo.colorClass}`}>
            {stateInfo.icon}
            <span>{stateInfo.label}</span>
          </div>
        )}
      </div>

      {/* Transparent Fare Split */}
      <div className={`${compact ? 'p-4' : 'p-5'} space-y-4`}>
        <div className="flex items-baseline justify-between pb-3 border-b border-slate-100">
          <span className="text-sm font-medium text-slate-600">Total Freight</span>
          <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
            {formatInrExact(totalInr)}
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span>Platform Commission (5% + 18% GST)</span>
            <span className="font-mono tabular-nums text-slate-700">
              {formatInrExact(platformFeeInr)}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-700 font-medium">
            <span>Net Fleet Payable (100% Held in Escrow)</span>
            <span className="font-mono tabular-nums text-slate-900">
              {formatInrExact(netVendorInr)}
            </span>
          </div>
        </div>

        {/* Two-Stage Split Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Tranche 1 · 70% Loading Advance</span>
              <span className="font-semibold text-slate-700">
                {advanceTranche ? advanceTranche.status.replace(/_/g, ' ') : 'LOCKED ON PAY'}
              </span>
            </div>
            <div className="mt-1.5 text-lg font-bold text-slate-900 font-mono tabular-nums">
              {formatInrExact(advance70Inr)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Released immediately to fleet owner once loading &amp; Digital LR are verified.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Tranche 2 · 30% POD Balance</span>
              <span className="font-semibold text-slate-700">
                {balanceTranche ? balanceTranche.status.replace(/_/g, ' ') : 'LOCKED UNTIL POD'}
              </span>
            </div>
            <div className="mt-1.5 text-lg font-bold text-slate-900 font-mono tabular-nums">
              {formatInrExact(balance30Inr)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Held safely in transit; auto-releases 2h after POD upload unless disputed.
            </p>
          </div>
        </div>

        {/* Escrow Protection Notice */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3.5 py-3 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-950 leading-relaxed">
            <strong className="font-semibold">Escrow Protection:</strong> 70% released to driver only after loading; 30% held safely until you receive Proof of Delivery.
          </p>
        </div>

        {/* Gateway / Vendor Metadata */}
        {(ledger || vendor) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            {ledger?.cashfree_order_id && (
              <span className="font-mono">Order: {ledger.cashfree_order_id}</span>
            )}
            {ledger?.cf_payment_id && (
              <span className="font-mono">Payment: {ledger.cf_payment_id}</span>
            )}
            {vendor?.cashfree_vendor_id && (
              <span className="inline-flex items-center gap-1">
                <Landmark className="w-3 h-3 text-slate-400" />
                Vendor: <span className="font-mono">{vendor.cashfree_vendor_id}</span> · KYC {vendor.kyc_status}
              </span>
            )}
          </div>
        )}

        {/* Feedback banners */}
        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {statusNotice && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusNotice}</span>
          </div>
        )}

        {/* Action Buttons */}
        {canInitializeCheckout && (
          <button
            type="button"
            onClick={handleFundEscrow}
            disabled={submitting || totalInr < 100}
            className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Initializing Cashfree Escrow...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Fund {formatInrExact(totalInr)} via Cashfree Escrow</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        )}

        {awaitingSandboxPayment && (
          <div className="flex flex-col sm:flex-row gap-2.5">
            {ledger?.is_simulated ? (
              <button
                type="button"
                onClick={handleConfirmSandbox}
                disabled={confirmingSandbox}
                className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {confirmingSandbox ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirming Payment...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Sandbox Escrow Payment ({formatInrExact(totalInr)})</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFundEscrow}
                disabled={submitting}
                className="flex-1 py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Resume Cashfree Checkout</span>
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
