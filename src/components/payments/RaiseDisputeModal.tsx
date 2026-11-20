import React, { useState } from 'react';
import { 
  AlertTriangle, 
  X, 
  Lock, 
  ShieldAlert, 
  Camera, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { Booking, PaymentDispute } from '../../types';
import { logisticsStore } from '../../services/store';

interface RaiseDisputeModalProps {
  booking: Booking;
  onClose: () => void;
  onDisputeRaised: (message: string) => void;
}

export const RaiseDisputeModal: React.FC<RaiseDisputeModalProps> = ({
  booking,
  onClose,
  onDisputeRaised
}) => {
  const [reason, setReason] = useState<PaymentDispute['reason']>('damaged_cargo');
  const [description, setDescription] = useState<string>('');
  const [evidencePhotoUrl, setEvidencePhotoUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const heldAmount = booking.driverFinalPayoutInr || Math.round(booking.netDriverPayableInr * 0.10);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide a brief explanation of the cargo issue.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const res = logisticsStore.raisePaymentDispute({
      bookingId: booking.id,
      reason,
      description: description.trim(),
      evidencePhotoUrl: evidencePhotoUrl || undefined
    });

    if (res.success) {
      onDisputeRaised(res.message);
      onClose();
    } else {
      setError(res.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-rose-500/30 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-rose-950/80 to-slate-900 border-b border-rose-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Raise Cargo Dispute</h3>
              <p className="text-[11px] text-rose-300/80">Freeze Driver Final Escrow Payout</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Escrow Lock Banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <Lock className="w-4 h-4" />
              <span>Automatic Payout Freeze Protection</span>
            </div>
            <p className="text-[10px] text-slate-300">
              Submitting this dispute immediately locks the transporter&apos;s final payout of{' '}
              <strong className="text-emerald-400 font-mono">₹{heldAmount.toLocaleString('en-IN')}</strong> in Cashfree
              escrow until Zuggi Admin investigates and resolves it.
            </p>
          </div>

          {/* Reason Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Dispute Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              <option value="damaged_cargo">Damaged or Broken Cargo / Wet Consignment</option>
              <option value="missing_items">Shortage of Packages / Missing Boxes</option>
              <option value="transit_delay">Excessive Unreasonable Delay & Commercial Loss</option>
              <option value="extortion_cash_demanded">Driver Demanded Unauthorized Cash / Extortion</option>
              <option value="other">Other Shipment Issue</option>
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Issue Details & Evidence Notes</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the discrepancy, condition upon arrival, or missing package numbers..."
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Evidence Photo URL or Simulator */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Cargo Damage / Unloading Photo</span>
              <button
                type="button"
                onClick={() => setEvidencePhotoUrl('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80')}
                className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
              >
                Attach Camera Photo
              </button>
            </label>
            <input
              type="text"
              value={evidencePhotoUrl}
              onChange={(e) => setEvidencePhotoUrl(e.target.value)}
              placeholder="Photo URL or click Attach above"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono text-[11px]"
            />
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition cursor-pointer flex items-center gap-1.5 active:scale-98"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Submit Dispute & Freeze Payout</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
