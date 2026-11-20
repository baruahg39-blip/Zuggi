import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  MapPin, 
  Truck, 
  ArrowLeft, 
  IndianRupee, 
  Clock, 
  ShieldCheck, 
  Package, 
  Filter, 
  CheckCircle2, 
  Send, 
  RotateCcw,
  SlidersHorizontal,
  Edit3,
  XCircle,
  Navigation,
  AlertTriangle,
  Loader2,
  Zap
} from 'lucide-react';
import { CommercialVehicle, LoadItem, Quotation, User, VehicleCategoryType } from '../../types';
import { logisticsStore } from '../../services/store';
import { PartnerOnboardingModal } from '../partner/PartnerOnboardingModal';
import { showToast } from '../shared/Toast';

interface FindLoadsProps {
  currentUser: User;
  onBack: () => void;
  onViewTrip: (bookingId: string) => void;
}

export const FindLoads: React.FC<FindLoadsProps> = ({
  currentUser,
  onBack,
  onViewTrip
}) => {
  const [activeTab, setActiveTab] = useState<'available' | 'my_bids'>('available');
  const [loads, setLoads] = useState<LoadItem[]>([]);
  const [vehicles, setVehicles] = useState<CommercialVehicle[]>([]);
  const [allQuotations, setAllQuotations] = useState<Quotation[]>([]);

  // Filter States
  const [selectedOrigin, setSelectedOrigin] = useState<string>('all');
  const [selectedDestination, setSelectedDestination] = useState<string>('all');
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>('all');
  const [returnLoadCity, setReturnLoadCity] = useState<string>('all');

  // Bid submission modal state
  const [activeBidLoad, setActiveBidLoad] = useState<LoadItem | null>(null);
  const [bidVehicleId, setBidVehicleId] = useState<string>('');
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [bidPickupTime, setBidPickupTime] = useState<string>('Ready for pickup within 45 mins');
  const [bidNotes, setBidNotes] = useState<string>('Experienced highway driver, GPS tracking enabled, clean waterproof tarpaulin.');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isSubmittingBid, setIsSubmittingBid] = useState<boolean>(false);

  // Revise / Withdraw Bid State
  const [reviseQuoteTarget, setReviseQuoteTarget] = useState<Quotation | null>(null);
  const [revisedAmount, setRevisedAmount] = useState<number>(0);
  const [revisedNotes, setRevisedNotes] = useState<string>('');
  const [confirmWithdrawQuoteId, setConfirmWithdrawQuoteId] = useState<string | null>(null);
  const [acceptingLoadId, setAcceptingLoadId] = useState<string | null>(null);

  // Partner Onboarding Modal
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState<boolean>(false);
  const partnerEligibility = logisticsStore.checkPartnerBookingEligibility(currentUser.id);

  useEffect(() => {
    const update = () => {
      setLoads(logisticsStore.getLoads());
      const allVehs = logisticsStore.getVehicles().filter((v) => !v.isBlocked);
      const myVehs = allVehs.filter((v) => v.ownerId === currentUser.id || v.assignedDriverId === currentUser.id);
      const driverVehicles = myVehs.length > 0 ? myVehs : allVehs;
      setVehicles(driverVehicles);
      setAllQuotations(logisticsStore.getQuotations());
      if (driverVehicles.length > 0 && !bidVehicleId) {
        setBidVehicleId(driverVehicles[0].id);
      }
    };
    update();
    const unsub = logisticsStore.subscribe(update);
    return unsub;
  }, [bidVehicleId, currentUser.id]);

  // Open loads filter
  const openLoads = useMemo(() => {
    return loads.filter((l) => {
      if (l.status !== 'posted' && l.status !== 'bidding') return false;

      if (selectedOrigin !== 'all' && l.pickup.city.toLowerCase() !== selectedOrigin.toLowerCase()) {
        return false;
      }
      if (selectedDestination !== 'all' && l.delivery.city.toLowerCase() !== selectedDestination.toLowerCase()) {
        return false;
      }
      if (selectedVehicleType !== 'all' && l.requiredVehicleCategory !== selectedVehicleType) {
        return false;
      }
      if (returnLoadCity !== 'all' && l.delivery.city.toLowerCase() !== returnLoadCity.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [loads, selectedOrigin, selectedDestination, selectedVehicleType, returnLoadCity]);

  // Driver's own submitted bids
  const myBids = useMemo(() => {
    return allQuotations.filter((q) => q.transporterId === currentUser.id);
  }, [allQuotations, currentUser.id]);

  const handleOpenBidModal = (load: LoadItem) => {
    if (!partnerEligibility.isEligible && !currentUser.isTestAccount && !currentUser.phone?.includes('99999')) {
      setIsOnboardingModalOpen(true);
      setFeedbackMessage(`Bidding is restricted: ${partnerEligibility.reason}`);
      return;
    }

    // Prevent duplicate bid: check if driver already submitted quotation for this load
    const existing = myBids.find((b) => b.loadId === load.id && b.status !== 'withdrawn');
    if (existing) {
      const msg = `You have already submitted a quotation of ₹${existing.quoteAmountInr.toLocaleString('en-IN')} for this load.`;
      setFeedbackMessage(msg);
      showToast(msg, 'info');
      return;
    }

    setActiveBidLoad(load);
    setBidAmount(load.targetBudgetInr || Math.round(load.estimatedDistanceKm * 32));
  };

  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBidLoad || bidAmount <= 0 || isSubmittingBid) return;

    if (!partnerEligibility.isEligible && !currentUser.isTestAccount && !currentUser.phone?.includes('99999')) {
      setIsOnboardingModalOpen(true);
      setFeedbackMessage(`Bidding is restricted: ${partnerEligibility.reason}`);
      return;
    }

    const chosenVehicle = vehicles.find((v) => v.id === bidVehicleId) || vehicles[0];
    if (!chosenVehicle) {
      setFeedbackMessage('Please register a commercial vehicle in "Manage Fleet" before placing quotations.');
      showToast('Please register a commercial vehicle in Manage Fleet', 'error');
      return;
    }

    setIsSubmittingBid(true);

    try {
      const baseFreight = Math.round(bidAmount * 0.88);
      const tollEstimate = activeBidLoad.estimatedDistanceKm > 80 ? 250 : 0;
      const gstAmount = Math.round(baseFreight * 0.05);

      logisticsStore.submitQuotation({
        loadId: activeBidLoad.id,
        transporterId: currentUser.id,
        transporterName: currentUser.businessName || currentUser.name,
        transporterPhone: currentUser.phone,
        vehicleId: chosenVehicle.id,
        vehicleRegNumber: chosenVehicle.registrationNumber,
        vehicleCategory: chosenVehicle.category,
        driverName: chosenVehicle.driverName || currentUser.name,
        driverRating: chosenVehicle.driverRating || 5.0,
        driverCompletedTrips: chosenVehicle.completedTrips || 0,
        quoteAmountInr: bidAmount,
        chargeBreakdown: {
          baseFreight,
          loadingUnloadingCharges: 400,
          tollEstimate,
          gstAmount,
          platformFee: Math.round(bidAmount * 0.05)
        },
        estimatedPickupTime: bidPickupTime,
        notes: bidNotes
      });

      const successMsg = `Quotation of ₹${bidAmount.toLocaleString('en-IN')} submitted to shipper.`;
      setFeedbackMessage(successMsg);
      showToast(successMsg, 'success');
      setActiveBidLoad(null);
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to submit quotation';
      setFeedbackMessage(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const handleOpenRevise = (quote: Quotation) => {
    setReviseQuoteTarget(quote);
    setRevisedAmount(quote.quoteAmountInr);
    setRevisedNotes(quote.notes || '');
  };

  const handleSaveRevision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviseQuoteTarget || revisedAmount <= 0) return;

    const res = logisticsStore.reviseQuotation(reviseQuoteTarget.id, revisedAmount, revisedNotes);
    if (res.success) {
      setFeedbackMessage(`Bid updated to ₹${revisedAmount.toLocaleString('en-IN')}. Shipper notified.`);
      setReviseQuoteTarget(null);
    } else {
      setFeedbackMessage(res.message);
    }
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleWithdrawBid = (quoteId: string) => {
    const res = logisticsStore.rejectQuotationByDriver(quoteId);
    setConfirmWithdrawQuoteId(null);
    setFeedbackMessage(res.message);
    showToast(res.message, 'info');
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleInstantAcceptLoad = (load: LoadItem) => {
    if (acceptingLoadId) return;
    setAcceptingLoadId(load.id);
    const res = logisticsStore.instantAcceptLoad(load.id, currentUser, bidVehicleId || vehicles[0]?.id);
    setAcceptingLoadId(null);
    if (!res.success || !res.bookingId) {
      showToast(res.message || 'Could not accept ride.', 'error');
      setFeedbackMessage(res.message);
      return;
    }
    showToast(res.message, 'success');
    onViewTrip(res.bookingId);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Driver Dashboard</span>
        </button>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('available')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'available'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Available Loads ({openLoads.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('my_bids')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'my_bids'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>My Submitted Bids ({myBids.length})</span>
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/90 text-emerald-200 border border-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Strict Compliance & Verification Status Banner */}
      {!partnerEligibility.isEligible && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">Commercial Partner Verification Required</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold uppercase text-[10px]">
                  {partnerEligibility.status}
                </span>
              </div>
              <p className="text-slate-300 text-[11px] mt-0.5">
                {partnerEligibility.reason}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOnboardingModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            Complete Onboarding & KYC
          </button>
        </div>
      )}

      {/* TAB 1: AVAILABLE LOADS */}
      {activeTab === 'available' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              <span>Filter Loads by Route & Vehicle</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 text-[10px]">Origin City</label>
                <select
                  value={selectedOrigin}
                  onChange={(e) => setSelectedOrigin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500 text-xs"
                >
                  <option value="all">All Origins</option>
                  <option value="Guwahati">Guwahati</option>
                  <option value="Dibrugarh">Dibrugarh</option>
                  <option value="Tezpur">Tezpur</option>
                  <option value="Silchar">Silchar</option>
                  <option value="Shillong">Shillong</option>
                  <option value="Dimapur">Dimapur</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[10px]">Destination City</label>
                <select
                  value={selectedDestination}
                  onChange={(e) => setSelectedDestination(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500 text-xs"
                >
                  <option value="all">All Destinations</option>
                  <option value="Guwahati">Guwahati</option>
                  <option value="Dibrugarh">Dibrugarh</option>
                  <option value="Tezpur">Tezpur</option>
                  <option value="Silchar">Silchar</option>
                  <option value="Shillong">Shillong</option>
                  <option value="Dimapur">Dimapur</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[10px]">Vehicle Type</label>
                <select
                  value={selectedVehicleType}
                  onChange={(e) => setSelectedVehicleType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500 text-xs"
                >
                  <option value="all">All Vehicles</option>
                  <option value="tata_ace">Tata Ace (0.85T)</option>
                  <option value="bolero_pickup">Bolero Pickup (1.3T)</option>
                  <option value="eicher_14ft">Eicher 14ft (4T)</option>
                  <option value="eicher_17ft">Eicher 17ft (6.5T)</option>
                  <option value="truck_20ft">20ft Heavy (10T)</option>
                  <option value="container_32ft">32ft Container (15T)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[10px]">Return (Backhaul)</label>
                <select
                  value={returnLoadCity}
                  onChange={(e) => setReturnLoadCity(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500 text-xs"
                >
                  <option value="all">Any Return</option>
                  <option value="Guwahati">Return to Guwahati</option>
                  <option value="Dibrugarh">Return to Dibrugarh</option>
                  <option value="Silchar">Return to Silchar</option>
                </select>
              </div>
            </div>
          </div>

          {/* Loads Cards */}
          <div className="space-y-3">
            {openLoads.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
                <Package className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-300">No matching freight loads right now.</p>
                <button
                  onClick={() => {
                    setSelectedOrigin('all');
                    setSelectedDestination('all');
                    setSelectedVehicleType('all');
                    setReturnLoadCity('all');
                  }}
                  className="text-xs text-amber-400 hover:underline"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              openLoads.map((load) => {
                const existingBid = myBids.find((b) => b.loadId === load.id && b.status !== 'withdrawn');

                return (
                <div
                  key={load.id}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition shadow-md space-y-3"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm sm:text-base text-white">
                          {load.pickup.city} → {load.delivery.city}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                          {load.estimatedDistanceKm} km
                        </span>

                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {load.goodsDescription} • {(load.weightKg / 1000).toFixed(1)} MT ({load.goodsCategory})
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 block">Shipper Budget</span>
                      <span className="text-base font-black text-amber-400 font-mono">
                        {load.targetBudgetInr ? `₹${load.targetBudgetInr.toLocaleString('en-IN')}` : 'Open Bidding'}
                      </span>
                    </div>
                  </div>

                  {/* Submitted Quote & Pending Status Badge Strip */}
                  {existingBid && (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300 font-semibold text-[11px]">Your Submitted Quote:</span>
                        <span className="font-mono font-extrabold text-emerald-400 text-sm">
                          ₹{existingBid.quoteAmountInr.toLocaleString('en-IN')}
                        </span>
                        {existingBid.counterOfferAmountInr && (
                          <span className="text-[11px] text-amber-400 font-mono">
                            (Countered: ₹{existingBid.counterOfferAmountInr.toLocaleString('en-IN')})
                          </span>
                        )}
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 uppercase tracking-wider">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Pending Shipper Review</span>
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-medium">
                        Truck: {load.requiredVehicleCategory.replace('_', ' ')}
                      </span>
                      {load.specialRequirements.coveredTruck && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px]">
                          Tarpaulin
                        </span>
                      )}
                    </div>

                    {existingBid ? (
                      <div className="flex items-center gap-2">
                        <button
                          disabled
                          className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold text-xs flex items-center gap-1.5 cursor-not-allowed opacity-95 shadow-sm"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Quotation Submitted</span>
                        </button>
                        {existingBid.status === 'submitted' && (
                          <button
                            onClick={() => handleOpenRevise(existingBid)}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                            title="Update quotation amount"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                            <span>Revise</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleInstantAcceptLoad(load)}
                          disabled={acceptingLoadId === load.id}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer active:scale-95 disabled:opacity-60"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>
                            {load.pricingMode === 'instant_fixed'
                              ? 'Accept & Start Ride'
                              : load.targetBudgetInr
                              ? `Accept @ ₹${load.targetBudgetInr.toLocaleString('en-IN')}`
                              : 'Instant Accept & Ride'}
                          </span>
                        </button>
                        <button
                          onClick={() => handleOpenBidModal(load)}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Submit Quotation</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MY SUBMITTED BIDS */}
      {activeTab === 'my_bids' && (
        <div className="space-y-3">
          {myBids.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
              <Send className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs font-semibold text-slate-300">You haven't submitted any quotations yet.</p>
              <button
                onClick={() => setActiveTab('available')}
                className="text-xs text-amber-400 hover:underline"
              >
                Browse available loads
              </button>
            </div>
          ) : (
            myBids.map((bid) => {
              const matchedLoad = loads.find((l) => l.id === bid.loadId);
              const isAwarded = bid.status === 'accepted';

              return (
                <div
                  key={bid.id}
                  className={`p-4 rounded-2xl border transition shadow-md space-y-3 ${
                    isAwarded
                      ? 'bg-emerald-950/20 border-emerald-500/50 ring-1 ring-emerald-500/30'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">
                          {matchedLoad ? `${matchedLoad.pickup.city} → ${matchedLoad.delivery.city}` : `Load #${bid.loadId.slice(-6)}`}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          isAwarded
                            ? 'bg-emerald-500 text-slate-950'
                            : bid.status === 'rejected'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : bid.status === 'withdrawn'
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {isAwarded ? '🏆 Awarded & Booked' : bid.status}
                        </span>

                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Vehicle: {bid.vehicleRegNumber} ({bid.vehicleCategory}) • Quoted {new Date(bid.createdAt).toLocaleDateString('en-IN')}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 block">Your Quote Amount</span>
                      <span className="text-base font-black text-amber-400 font-mono">
                        ₹{bid.quoteAmountInr.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-[11px] text-slate-400 truncate max-w-xs">
                      {bid.notes || 'Standard highway transit commitment.'}
                    </span>

                    <div className="flex items-center gap-2 shrink-0">
                      {bid.status === 'submitted' && (
                        <>
                          <button
                            onClick={() => handleOpenRevise(bid)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                            <span>Revise Quote</span>
                          </button>

                          {confirmWithdrawQuoteId === bid.id ? (
                            <div className="flex items-center gap-1 bg-rose-950/90 border border-rose-700 px-2 py-1 rounded-lg">
                              <span className="text-[10px] text-rose-200 font-semibold">Withdraw?</span>
                              <button
                                onClick={() => handleWithdrawBid(bid.id)}
                                className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setConfirmWithdrawQuoteId(null)}
                                className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmWithdrawQuoteId(bid.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Withdraw</span>
                            </button>
                          )}
                        </>
                      )}

                      {isAwarded && (
                        <button
                          onClick={() => {
                            if (matchedLoad?.assignedBookingId) {
                              onViewTrip(matchedLoad.assignedBookingId);
                            } else {
                              onViewTrip('booking_01');
                            }
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer active:scale-95"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Open Active Trip</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL: SUBMIT FREIGHT BID */}
      {activeBidLoad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
          <form
            onSubmit={handleSubmitBid}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 my-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">Submit Freight Quotation</h3>
                <p className="text-[11px] text-slate-400">
                  {activeBidLoad.pickup.city} → {activeBidLoad.delivery.city} ({activeBidLoad.estimatedDistanceKm} km)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveBidLoad(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Select Dispatched Vehicle</label>
              <select
                value={bidVehicleId}
                onChange={(e) => setBidVehicleId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNumber} - {v.modelName} ({v.capacityKg} kg capacity)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Your Quoted Total Freight Amount (₹)
              </label>
              <input
                type="number"
                min={100}
                value={bidAmount}
                onChange={(e) => setBidAmount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-base font-bold text-amber-400 font-mono focus:outline-none focus:border-amber-500"
                required
              />
              <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                <span>Shipper Target: ₹{activeBidLoad.targetBudgetInr?.toLocaleString('en-IN') || 'Open'}</span>
                <span>Net to Driver: ~₹{Math.round(bidAmount * 0.95).toLocaleString('en-IN')} (5% platform fee)</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Pickup Readiness Commitment</label>
              <input
                type="text"
                value={bidPickupTime}
                onChange={(e) => setBidPickupTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Transporter Notes for Shipper</label>
              <textarea
                rows={2}
                value={bidNotes}
                onChange={(e) => setBidNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveBidLoad(null)}
                disabled={isSubmittingBid}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingBid}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 disabled:cursor-not-allowed text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
              >
                {isSubmittingBid ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Submitting Quotation...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Quotation</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: REVISE FREIGHT BID */}
      {reviseQuoteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
          <form
            onSubmit={handleSaveRevision}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 my-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">Revise Submitted Quotation</h3>
                <p className="text-[11px] text-slate-400">
                  Update your price before the shipper awards the contract
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviseQuoteTarget(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">
                New Total Freight Amount (₹)
              </label>
              <input
                type="number"
                min={100}
                value={revisedAmount}
                onChange={(e) => setRevisedAmount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-base font-bold text-amber-400 font-mono focus:outline-none focus:border-amber-500"
                required
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Net to Driver: ~₹{Math.round(revisedAmount * 0.95).toLocaleString('en-IN')}
              </span>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Updated Notes for Shipper</label>
              <textarea
                rows={2}
                value={revisedNotes}
                onChange={(e) => setRevisedNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReviseQuoteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Save Revised Quotation
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Partner Onboarding & KYC Modal */}
      {isOnboardingModalOpen && (
        <PartnerOnboardingModal
          currentUser={currentUser}
          isOpen={true}
          onClose={() => setIsOnboardingModalOpen(false)}
          onSuccess={() => {
            setIsOnboardingModalOpen(false);
            setFeedbackMessage('Application submitted! Compliance desk will review your documents shortly.');
          }}
        />
      )}
    </div>
  );
};
