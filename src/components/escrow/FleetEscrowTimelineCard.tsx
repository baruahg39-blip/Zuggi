import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Lock,
  AlertTriangle,
  Landmark,
  ArrowUpRight,
  Loader2
} from 'lucide-react';
import {
  calculateEscrow7030Breakdown,
  escrowClient,
  formatCountdownHMS,
  formatInrExact,
  type TripEscrowLedger,
  type EscrowPayoutTranche,
  type FleetVendorSummary
} from '../../services/escrowClient';

interface FleetEscrowTimelineCardProps {
  tripId: string;
  totalFreightInr: number;
  ledger: TripEscrowLedger | null;
  tranches: EscrowPayoutTranche[];
  vendor?: FleetVendorSummary | null;
  tripLoaded?: boolean;
  tripDelivered?: boolean;
  onLedgerUpdated?: (ledger: TripEscrowLedger, tranches: EscrowPayoutTranche[]) => void;
  title?: string;
  compact?: boolean;
}

export const FleetEscrowTimelineCard: React.FC<FleetEscrowTimelineCardProps> = ({
  tripId,
  totalFreightInr,
  ledger,
  tranches,
  vendor,
  tripLoaded = false,
  tripDelivered = false,
  onLedgerUpdated,
  title = '70/30 Escrow Payout Timeline',
  compact = false
}) => {
  const [, setTick] = useState(0);
  const [releasingAdvance, setReleasingAdvance] = useState(false);
  const [queueingPod, setQueueingPod] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const advanceTranche = tranches.find((t) => t.tranche_type === 'ADVANCE_70');
  const balanceTranche = tranches.find((t) => t.tranche_type === 'BALANCE_30');

  // Tick every second while BALANCE_30 is in its 2-hour POD countdown
  useEffect(() => {
    if (balanceTranche?.status !== 'QUEUED_FOR_RELEASE' || !balanceTranche.scheduled_release_at) {
      return;
    }
    const timer = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, [balanceTranche?.status, balanceTranche?.scheduled_release_at]);

  const fallbackSplit = calculateEscrow7030Breakdown(totalFreightInr);
  const advanceAmount = advanceTranche?.amount_inr ?? ledger?.advance_70_amount ?? fallbackSplit.advance70Inr;
  const balanceAmount = balanceTranche?.amount_inr ?? ledger?.balance_30_amount ?? fallbackSplit.balance30Inr;
  const netPayable = ledger?.net_vendor_payable_inr ?? fallbackSplit.netVendorPayableInr;

  const isFunded = Boolean(ledger && ledger.escrow_state !== 'AWAITING_PAYMENT' && ledger.escrow_state !== 'REFUNDED');
  const isDisputeHold = ledger?.escrow_state === 'DISPUTE_HOLD';

  const countdown = formatCountdownHMS(balanceTranche?.scheduled_release_at);

  const getAdvanceStatusLabel = (): { text: string; tone: string; icon: React.ReactNode } => {
    if (!ledger || ledger.escrow_state === 'AWAITING_PAYMENT') {
      return {
        text: 'Awaiting Shipper Escrow Deposit',
        tone: 'text-slate-500',
        icon: <Clock className="w-4 h-4 text-slate-400" />
      };
    }
    if (advanceTranche?.status === 'SETTLED') {
      return {
        text: 'Released to Bank/UPI',
        tone: 'text-emerald-700',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />
      };
    }
    if (advanceTranche?.status === 'PROCESSING') {
      return {
        text: 'Processing Bank/UPI Split',
        tone: 'text-blue-700',
        icon: <ArrowUpRight className="w-4 h-4 text-blue-600" />
      };
    }
    if (advanceTranche?.status === 'FAILED') {
      return {
        text: 'Transfer Failed — Retry Required',
        tone: 'text-red-700',
        icon: <AlertTriangle className="w-4 h-4 text-red-600" />
      };
    }
    return {
      text: 'Locked in Escrow (Releases on Loading)',
      tone: 'text-amber-700',
      icon: <Lock className="w-4 h-4 text-amber-600" />
    };
  };

  const getBalanceStatusLabel = (): { text: string; tone: string; icon: React.ReactNode } => {
    if (isDisputeHold) {
      return {
        text: 'Frozen — Shipper Dispute Hold',
        tone: 'text-red-700',
        icon: <AlertTriangle className="w-4 h-4 text-red-600" />
      };
    }
    if (!ledger || ledger.escrow_state === 'AWAITING_PAYMENT') {
      return {
        text: 'Locked until POD',
        tone: 'text-slate-500',
        icon: <Lock className="w-4 h-4 text-slate-400" />
      };
    }
    if (balanceTranche?.status === 'SETTLED') {
      return {
        text: 'Settled to Bank/UPI',
        tone: 'text-emerald-700',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />
      };
    }
    if (balanceTranche?.status === 'PROCESSING') {
      return {
        text: 'Processing Final Settlement',
        tone: 'text-blue-700',
        icon: <ArrowUpRight className="w-4 h-4 text-blue-600" />
      };
    }
    if (balanceTranche?.status === 'QUEUED_FOR_RELEASE') {
      return {
        text: countdown.expired
          ? 'Auto-release Processing Now'
          : `Auto-releasing in ${countdown.compact}`,
        tone: 'text-amber-700',
        icon: <Clock className="w-4 h-4 text-amber-600" />
      };
    }
    return {
      text: 'Locked until POD',
      tone: 'text-slate-600',
      icon: <Lock className="w-4 h-4 text-slate-500" />
    };
  };

  const advStatus = getAdvanceStatusLabel();
  const balStatus = getBalanceStatusLabel();

  const handleReleaseAdvance = async () => {
    setErrorMsg(null);
    setReleasingAdvance(true);
    try {
      const resp = await escrowClient.releaseLoadingAdvance(
        tripId,
        'Loading & Digital LR verified by Fleet Partner'
      );
      if (!resp.success || !resp.ledger) {
        setErrorMsg(resp.message || 'Unable to release 70% loading advance.');
        return;
      }
      onLedgerUpdated?.(resp.ledger, resp.tranches || []);
    } catch {
      setErrorMsg('Network error releasing 70% loading advance.');
    } finally {
      setReleasingAdvance(false);
    }
  };

  const handleQueuePodBalance = async () => {
    setErrorMsg(null);
    setQueueingPod(true);
    try {
      const resp = await escrowClient.triggerPodBalance(tripId, 'pod_uploaded');
      if (!resp.success || !resp.ledger) {
        setErrorMsg(resp.message || 'Unable to start 2-hour POD release timer.');
        return;
      }
      onLedgerUpdated?.(resp.ledger, resp.tranches || []);
    } catch {
      setErrorMsg('Network error starting POD balance countdown.');
    } finally {
      setQueueingPod(false);
    }
  };

  const showReleaseAdvanceCta =
    tripLoaded &&
    ledger?.escrow_state === 'FUNDED_LOCKED' &&
    advanceTranche?.status === 'LOCKED';

  const showQueuePodCta =
    tripDelivered &&
    isFunded &&
    !isDisputeHold &&
    balanceTranche?.status === 'LOCKED';

  const payoutDestination = vendor?.upi_id
    ? `UPI: ${vendor.upi_id}`
    : vendor?.bank_account_last4
      ? `Bank A/C ****${vendor.bank_account_last4}`
      : ledger?.cashfree_vendor_id
        ? `Cashfree Vendor ${ledger.cashfree_vendor_id}`
        : 'Cashfree Easy Split Verified Payout Account';

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      <div className={`${compact ? 'px-4 py-3' : 'px-5 py-4'} border-b border-slate-100 flex flex-wrap items-center justify-between gap-2`}>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Net Fleet Payable: <span className="font-mono tabular-nums font-semibold text-slate-800">{formatInrExact(netPayable)}</span>
            {ledger?.external_trip_id ? ` · Trip ${ledger.external_trip_id}` : ''}
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-medium text-slate-500 block">Escrow Status</span>
          <span className="text-xs font-semibold text-slate-900">
            {ledger ? ledger.escrow_state.replace(/_/g, ' ') : 'PENDING ESCROW'}
          </span>
        </div>
      </div>

      <div className={`${compact ? 'p-4' : 'p-5'} space-y-4`}>
        {/* Step 1: 70% Loading Advance */}
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center pt-0.5">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                advanceTranche?.status === 'SETTLED'
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : isFunded
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-slate-100 border-slate-300 text-slate-500'
              }`}
            >
              1
            </div>
            <div className="w-px h-10 bg-slate-200 my-1" />
          </div>

          <div className="flex-1 min-w-0 pb-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                Step 1: 70% Loading Advance
              </p>
              <span className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {formatInrExact(advanceAmount)}
              </span>
            </div>
            <div className={`mt-1 flex items-center gap-1.5 text-xs font-semibold ${advStatus.tone}`}>
              {advStatus.icon}
              <span>{advStatus.text}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
              <span>Triggers automatically on Digital LR / Loading Verified</span>
              {advanceTranche?.cashfree_split_ref_id && (
                <span className="font-mono">Ref: {advanceTranche.cashfree_split_ref_id}</span>
              )}
              {advanceTranche?.released_at && (
                <span>Settled {new Date(advanceTranche.released_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>

            {showReleaseAdvanceCta && (
              <button
                type="button"
                onClick={handleReleaseAdvance}
                disabled={releasingAdvance}
                className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                {releasingAdvance ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                )}
                <span>Release 70% Loading Advance Now</span>
              </button>
            )}
          </div>
        </div>

        {/* Step 2: 30% Delivery Balance */}
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center pt-0.5">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                balanceTranche?.status === 'SETTLED'
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : isDisputeHold
                    ? 'bg-red-600 border-red-600 text-white'
                    : balanceTranche?.status === 'QUEUED_FOR_RELEASE'
                      ? 'bg-amber-600 border-amber-600 text-white'
                      : 'bg-slate-100 border-slate-300 text-slate-500'
              }`}
            >
              2
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                Step 2: 30% Delivery Balance
              </p>
              <span className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {formatInrExact(balanceAmount)}
              </span>
            </div>
            <div className={`mt-1 flex items-center gap-1.5 text-xs font-semibold ${balStatus.tone}`}>
              {balStatus.icon}
              <span className={balanceTranche?.status === 'QUEUED_FOR_RELEASE' ? 'font-mono tabular-nums' : ''}>
                {balStatus.text}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
              {isDisputeHold && ledger?.dispute_reason ? (
                <span className="text-red-700">Reason: {ledger.dispute_reason}</span>
              ) : (
                <span>Releases automatically 2 hours after POD upload (or instantly on shipper approval)</span>
              )}
              {balanceTranche?.cashfree_split_ref_id && (
                <span className="font-mono">Ref: {balanceTranche.cashfree_split_ref_id}</span>
              )}
              {balanceTranche?.released_at && (
                <span>Settled {new Date(balanceTranche.released_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>

            {showQueuePodCta && (
              <button
                type="button"
                onClick={handleQueuePodBalance}
                disabled={queueingPod}
                className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                {queueingPod ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
                <span>Start 2-Hour POD Auto-Release Countdown</span>
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Footer: Payout Destination */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-slate-400" />
            <span>{payoutDestination}</span>
          </span>
          <span className="font-mono">
            {advanceTranche?.idempotency_key ? `Keys: ${advanceTranche.idempotency_key.slice(0, 28)}…` : 'Idempotent Cashfree Easy Split'}
          </span>
        </div>
      </div>
    </section>
  );
};
