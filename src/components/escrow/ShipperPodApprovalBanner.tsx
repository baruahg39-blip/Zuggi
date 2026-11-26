import React, { useEffect, useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  FileCheck2
} from 'lucide-react';
import {
  escrowClient,
  formatCountdownHMS,
  formatInrExact,
  type TripEscrowLedger,
  type EscrowPayoutTranche
} from '../../services/escrowClient';

interface ShipperPodApprovalBannerProps {
  tripId: string;
  ledger: TripEscrowLedger | null;
  tranches: EscrowPayoutTranche[];
  podUploadedFallback?: boolean;
  onLedgerUpdated?: (ledger: TripEscrowLedger, tranches: EscrowPayoutTranche[]) => void;
}

export const ShipperPodApprovalBanner: React.FC<ShipperPodApprovalBannerProps> = ({
  tripId,
  ledger,
  tranches,
  podUploadedFallback = false,
  onLedgerUpdated
}) => {
  const [, setTick] = useState(0);
  const [approving, setApproving] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const balanceTranche = tranches.find((t) => t.tranche_type === 'BALANCE_30');

  useEffect(() => {
    if (balanceTranche?.status !== 'QUEUED_FOR_RELEASE' || !balanceTranche.scheduled_release_at) {
      return;
    }
    const timer = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, [balanceTranche?.status, balanceTranche?.scheduled_release_at]);

  if (!ledger) return null;

  const isQueued = balanceTranche?.status === 'QUEUED_FOR_RELEASE';
  const isDisputeHold = ledger.escrow_state === 'DISPUTE_HOLD';
  const isFullySettled = ledger.escrow_state === 'FULLY_SETTLED' || balanceTranche?.status === 'SETTLED';
  const canApproveDirectly =
    !isDisputeHold &&
    !isFullySettled &&
    ledger.escrow_state !== 'AWAITING_PAYMENT' &&
    ledger.escrow_state !== 'REFUNDED' &&
    (isQueued || podUploadedFallback);

  if (!canApproveDirectly && !isDisputeHold && !isFullySettled) {
    return null;
  }

  const countdown = formatCountdownHMS(balanceTranche?.scheduled_release_at);

  const handleApproveNow = async () => {
    setErrorMessage(null);
    setApproving(true);
    try {
      const resp = await escrowClient.triggerPodBalance(tripId, 'approve_pod_now');
      if (!resp.success || !resp.ledger) {
        setErrorMessage(resp.message || 'Unable to approve POD and release 30% balance.');
        return;
      }
      onLedgerUpdated?.(resp.ledger, resp.tranches || []);
    } catch {
      setErrorMessage('Network error releasing 30% POD balance.');
    } finally {
      setApproving(false);
    }
  };

  const handleRaiseDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disputeReason.trim().length < 5) {
      setErrorMessage('Please describe the cargo damage, shortage, or POD discrepancy (min 5 characters).');
      return;
    }
    setErrorMessage(null);
    setSubmittingDispute(true);
    try {
      const resp = await escrowClient.raiseDispute(tripId, disputeReason.trim());
      if (!resp.success || !resp.ledger) {
        setErrorMessage(resp.message || 'Unable to freeze 30% balance.');
        return;
      }
      setShowDisputeForm(false);
      setDisputeReason('');
      onLedgerUpdated?.(resp.ledger, resp.tranches || []);
    } catch {
      setErrorMessage('Network error raising escrow dispute.');
    } finally {
      setSubmittingDispute(false);
    }
  };

  if (isFullySettled) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-emerald-950">
              POD Verified &amp; 30% Balance Settled ({formatInrExact(ledger.balance_30_amount)})
            </h4>
            <p className="text-xs text-emerald-800 mt-0.5">
              100% of net freight ({formatInrExact(ledger.net_vendor_payable_inr)}) has been settled to the fleet owner via Cashfree Easy Split.
              {balanceTranche?.cashfree_split_ref_id ? ` Ref: ${balanceTranche.cashfree_split_ref_id}` : ''}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isDisputeHold) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 space-y-2">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-950">
              30% Balance Frozen Under Dispute Hold ({formatInrExact(ledger.balance_30_amount)})
            </h4>
            <p className="text-xs text-red-800 mt-0.5">
              Automated release has been halted and our operations team has been alerted.
              {ledger.dispute_reason ? ` Reason recorded: "${ledger.dispute_reason}"` : ''}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 sm:p-5 space-y-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">
              Driver Uploaded Proof of Delivery (POD)
            </h4>
            <p className="text-xs text-slate-700 mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              {isQueued ? (
                <span>
                  Auto-releasing 30% balance ({formatInrExact(ledger.balance_30_amount)}) in{' '}
                  <strong className="font-mono tabular-nums text-amber-900">
                    {countdown.expired ? '00:00:00 (Processing)' : countdown.formatted}
                  </strong>
                </span>
              ) : (
                <span>
                  Review the signed POD and approve instant release of the remaining 30% balance ({formatInrExact(ledger.balance_30_amount)}).
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleApproveNow}
            disabled={approving || submittingDispute}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            {approving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>Approve POD Now</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setShowDisputeForm((v) => !v);
            }}
            disabled={approving || submittingDispute}
            className="px-4 py-2 rounded-lg bg-white hover:bg-red-50 border border-red-300 text-red-700 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Raise Dispute (Freeze 30%)</span>
          </button>
        </div>
      </div>

      {showDisputeForm && (
        <form onSubmit={handleRaiseDispute} className="pt-3 border-t border-amber-200/80 space-y-2.5">
          <label className="block text-xs font-semibold text-slate-800">
            Describe the delivery discrepancy to freeze {formatInrExact(ledger.balance_30_amount)} immediately:
          </label>
          <textarea
            rows={2}
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="e.g., 4 cartons damaged on arrival, shortage noted on signed LR..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowDisputeForm(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingDispute}
              className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {submittingDispute ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5" />
              )}
              <span>Confirm Freeze &amp; Alert Support</span>
            </button>
          </div>
        </form>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
