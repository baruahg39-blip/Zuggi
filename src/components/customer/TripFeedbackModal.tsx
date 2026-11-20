import React, { useState, useEffect } from 'react';
import { 
  X, 
  Star, 
  Clock, 
  Truck, 
  PhoneCall, 
  Sparkles, 
  CheckCircle2, 
  ThumbsUp, 
  ShieldCheck, 
  IndianRupee, 
  Tag, 
  MessageSquare,
  Award,
  AlertCircle
} from 'lucide-react';
import { Booking, LoadItem, TripFeedback, User } from '../../types';
import { logisticsStore } from '../../services/store';

interface TripFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  load: LoadItem;
  currentUser: User;
  onFeedbackSubmitted?: (feedback: TripFeedback) => void;
}

const COMPLIMENT_TAGS = [
  'Strictly On-Time',
  'Clean Cargo Bed',
  'Waterproof Tarpaulin',
  'Careful Cargo Loading',
  'Active Highway Updates',
  'Courteous & Polite',
  'Smooth FASTag Transit',
  'Prompt POD Upload'
];

const ISSUE_TAGS = [
  'Delayed at Weighbridge',
  'Phone Occasionally Unreachable',
  'Tarpaulin Needed Adjustment'
];

export const TripFeedbackModal: React.FC<TripFeedbackModalProps> = ({
  isOpen,
  onClose,
  booking,
  load,
  currentUser,
  onFeedbackSubmitted
}) => {
  // Existing feedback if already rated
  const existingFeedback = logisticsStore.getFeedbackByBookingId(booking.id);

  // Core Rating Criteria States (1-5)
  const [punctualityRating, setPunctualityRating] = useState<number>(existingFeedback?.punctualityRating || 5);
  const [vehicleConditionRating, setVehicleConditionRating] = useState<number>(existingFeedback?.vehicleConditionRating || 5);
  const [communicationRating, setCommunicationRating] = useState<number>(existingFeedback?.communicationRating || 5);

  // Hover states for previewing stars
  const [punctualityHover, setPunctualityHover] = useState<number>(0);
  const [vehicleConditionHover, setVehicleConditionHover] = useState<number>(0);
  const [communicationHover, setCommunicationHover] = useState<number>(0);

  // Selected tags
  const [selectedTags, setSelectedTags] = useState<string[]>(
    existingFeedback?.tags || ['Strictly On-Time', 'Careful Cargo Loading']
  );

  // Detailed Comments
  const [reviewComments, setReviewComments] = useState<string>(existingFeedback?.reviewComments || '');

  // Driver Tip (INR)
  const [tipAmount, setTipAmount] = useState<number>(existingFeedback?.tipAmountInr || 0);
  const [customTip, setCustomTip] = useState<string>('');
  const [showCustomTip, setShowCustomTip] = useState(false);

  // Recommendation
  const [wouldRecommend, setWouldRecommend] = useState<boolean>(
    existingFeedback ? existingFeedback.wouldRecommend : true
  );

  // Success state
  const [submitted, setSubmitted] = useState(false);

  // Calculate dynamic overall score
  const overallRating = Number(
    ((punctualityRating + vehicleConditionRating + communicationRating) / 3).toFixed(1)
  );

  if (!isOpen) return null;

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalTip = showCustomTip ? Number(customTip) || 0 : tipAmount;

    const saved = logisticsStore.submitTripFeedback({
      bookingId: booking.id,
      loadId: load.id,
      customerId: currentUser.id,
      customerName: currentUser.name,
      customerCompany: currentUser.businessName,
      driverId: booking.driverId,
      driverName: booking.transporterId === 'user_trans_01' ? 'Bikramjit Sharma' : 'Manoj Das',
      vehicleId: booking.vehicleId,
      vehicleRegNumber: load.id === 'load_active_01' ? 'AS-01-QC-4910' : 'AS-01-MC-7822',
      punctualityRating,
      vehicleConditionRating,
      communicationRating,
      overallRating,
      tags: selectedTags,
      reviewComments: reviewComments.trim() || 'Prompt freight delivery and smooth highway coordination.',
      tipAmountInr: finalTip,
      wouldRecommend
    });

    setSubmitted(true);
    if (onFeedbackSubmitted) {
      onFeedbackSubmitted(saved);
    }

    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1200);
  };

  // Helper for star rating descriptions
  const getPunctualityLabel = (stars: number) => {
    switch (stars) {
      case 1: return 'Severely Delayed (> 4 hrs)';
      case 2: return 'Delayed Transit';
      case 3: return 'Moderate Schedule Adherence';
      case 4: return 'Good & Timely Arrival';
      case 5: return 'Flawless & Ahead of Schedule';
      default: return '';
    }
  };

  const getVehicleLabel = (stars: number) => {
    switch (stars) {
      case 1: return 'Dirty Floor & Defective Cover';
      case 2: return 'Poor Weatherproofing';
      case 3: return 'Acceptable Commercial Bed';
      case 4: return 'Clean, Sturdy & Lashed';
      case 5: return 'Pristine, Heavy-Duty & Weather-Sealed';
      default: return '';
    }
  };

  const getCommunicationLabel = (stars: number) => {
    switch (stars) {
      case 1: return 'Unreachable / Unresponsive';
      case 2: return 'Poor Route Communication';
      case 3: return 'Basic Necessary Updates';
      case 4: return 'Polite & Clear Phone Updates';
      case 5: return 'Proactive, Courteous & Exceptional';
      default: return '';
    }
  };

  const driverDisplayName = booking.transporterId === 'user_trans_01' ? 'Bikramjit Sharma' : 'Manoj Das';
  const vehicleRegNumber = load.id === 'load_active_01' ? 'AS-01-QC-4910' : 'AS-01-MC-7822';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Modal Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Star className="w-6 h-6 fill-slate-950 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">Post-Trip Rating & Feedback</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold uppercase">
                  Verified Shipper Review
                </span>
              </div>
              <p className="text-xs text-slate-400">Rate your driver across core commercial logistics standards</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Banner */}
        {submitted && (
          <div className="p-4 bg-emerald-950/90 border-b border-emerald-800 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-2 animate-pulse">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>Thank you! Your driver rating and feedback have been published.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Trip & Driver Summary Card */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">{load.pickup.city}</span>
                <span className="text-slate-500">→</span>
                <span className="font-bold text-sm text-white">{load.delivery.city}</span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                  {load.estimatedDistanceKm} km
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-1">{load.goodsDescription}</p>
              <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                <span>Driver: <strong className="text-slate-200">{driverDisplayName}</strong></span>
                <span>•</span>
                <span className="font-mono text-amber-400 font-semibold">{vehicleRegNumber}</span>
              </div>
            </div>

            {/* Overall Live Score Badge */}
            <div className="sm:text-right shrink-0 bg-slate-900/90 px-4 py-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Overall Score
              </span>
              <div className="flex items-center gap-1.5 text-xl font-black text-amber-400 font-mono">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                <span>{overallRating}</span>
                <span className="text-xs text-slate-500 font-normal">/ 5.0</span>
              </div>
            </div>
          </div>

          {/* CORE RATING CRITERIA (Punctuality, Vehicle Condition, Communication) */}
          <div className="space-y-5">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Core Performance Ratings</span>
            </h4>

            {/* 1. PUNCTUALITY & SCHEDULE ADHERENCE */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-750 transition space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white">1. Punctuality & Timeliness</span>
                    <p className="text-[11px] text-slate-400">
                      Adherence to scheduled pickup window & highway delivery ETA
                    </p>
                  </div>
                </div>

                {/* Interactive Star Bar */}
                <div className="flex items-center gap-1.5 pt-1 sm:pt-0">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setPunctualityHover(star)}
                      onMouseLeave={() => setPunctualityHover(0)}
                      onClick={() => setPunctualityRating(star)}
                      className="p-1 text-slate-600 hover:text-amber-400 transition cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 transition ${
                          star <= (punctualityHover || punctualityRating)
                            ? 'fill-amber-400 text-amber-400 scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                            : 'text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-right text-[11px] font-semibold text-amber-400/90 font-mono">
                {getPunctualityLabel(punctualityHover || punctualityRating)}
              </div>
            </div>

            {/* 2. VEHICLE & CARGO BED CONDITION */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-750 transition space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white">2. Vehicle & Cargo Deck Condition</span>
                    <p className="text-[11px] text-slate-400">
                      Clean floor, heavy-duty waterproof tarpaulin & secure lashing ropes
                    </p>
                  </div>
                </div>

                {/* Interactive Star Bar */}
                <div className="flex items-center gap-1.5 pt-1 sm:pt-0">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setVehicleConditionHover(star)}
                      onMouseLeave={() => setVehicleConditionHover(0)}
                      onClick={() => setVehicleConditionRating(star)}
                      className="p-1 text-slate-600 hover:text-amber-400 transition cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 transition ${
                          star <= (vehicleConditionHover || vehicleConditionRating)
                            ? 'fill-amber-400 text-amber-400 scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                            : 'text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-right text-[11px] font-semibold text-amber-400/90 font-mono">
                {getVehicleLabel(vehicleConditionHover || vehicleConditionRating)}
              </div>
            </div>

            {/* 3. COMMUNICATION & PROFESSIONALISM */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-750 transition space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white">3. Driver Communication</span>
                    <p className="text-[11px] text-slate-400">
                      Courtesy, responsive on calls & clear transit milestone reporting
                    </p>
                  </div>
                </div>

                {/* Interactive Star Bar */}
                <div className="flex items-center gap-1.5 pt-1 sm:pt-0">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setCommunicationHover(star)}
                      onMouseLeave={() => setCommunicationHover(0)}
                      onClick={() => setCommunicationRating(star)}
                      className="p-1 text-slate-600 hover:text-amber-400 transition cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 transition ${
                          star <= (communicationHover || communicationRating)
                            ? 'fill-amber-400 text-amber-400 scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                            : 'text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-right text-[11px] font-semibold text-amber-400/90 font-mono">
                {getCommunicationLabel(communicationHover || communicationRating)}
              </div>
            </div>
          </div>

          {/* Quick Feedback Tags */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>What stood out about this trip?</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {COMPLIMENT_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleTag(tag)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                      active
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {active ? '✓ ' : '+ '} {tag}
                  </button>
                );
              })}
              {ISSUE_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleTag(tag)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                      active
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {active ? '⚠️ ' : '+ '} {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Written Shipper Review */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>Consignor Comments & Review</span>
            </label>
            <textarea
              rows={3}
              value={reviewComments}
              onChange={(e) => setReviewComments(e.target.value)}
              placeholder="Share details about the driver's handling, punctuality at highway checkpoints, or vehicle fitness for other shippers..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white text-xs focus:outline-none placeholder:text-slate-600 leading-relaxed"
            />
          </div>

          {/* Optional Driver Appreciation Tip */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">
                  Add Appreciation Tip for Driver (Optional)
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold">100% goes to driver</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[0, 100, 200, 500].map((amt) => {
                const active = !showCustomTip && tipAmount === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setShowCustomTip(false);
                      setTipAmount(amt);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                      active
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    {amt === 0 ? 'No Tip' : `₹${amt}`}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setShowCustomTip(true)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                  showCustomTip
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
                }`}
              >
                Custom ₹
              </button>

              {showCustomTip && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono text-slate-400">₹</span>
                  <input
                    type="number"
                    min={50}
                    max={5000}
                    value={customTip}
                    onChange={(e) => setCustomTip(e.target.value)}
                    placeholder="Enter amount"
                    className="w-28 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Rehire / Recommendation Switch */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <div className="flex items-center gap-2.5">
              <ThumbsUp className={`w-4 h-4 ${wouldRecommend ? 'text-emerald-400' : 'text-slate-500'}`} />
              <div>
                <span className="font-semibold text-slate-200">Would you rebook this driver?</span>
                <p className="text-[10px] text-slate-400">Helps rank reliable transporters in marketplace bids</p>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setWouldRecommend(true)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                  wouldRecommend ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setWouldRecommend(false)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                  !wouldRecommend ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitted}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 cursor-pointer transition flex items-center gap-2 active:scale-98"
            >
              <Sparkles className="w-4 h-4" />
              <span>{existingFeedback ? 'Update Trip Rating' : 'Submit Rating & Feedback'}</span>
            </button>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Ratings directly influence transporter badge & dispatch priority</span>
          </div>
          <span className="font-semibold text-slate-400">Zuggi Quality Assurance</span>
        </div>
      </div>
    </div>
  );
};
