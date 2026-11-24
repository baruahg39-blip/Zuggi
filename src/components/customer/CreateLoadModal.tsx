import React, { useState, useMemo } from 'react';
import { 
  X, 
  MapPin, 
  Truck, 
  Package, 
  IndianRupee, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  Users, 
  FileCheck,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Building
} from 'lucide-react';
import { GoodsCategory, LocationPoint, VehicleCategoryType } from '../../types';
import { logisticsStore } from '../../services/store';
import { showToast } from '../shared/Toast';
import { FreightLocationPicker, FreightLocationPayload } from '../maps/FreightLocationPicker';
import { LocationAutocompleteInput, SelectedPlace } from '../shared/LocationAutocompleteInput';

interface CreateLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadCreated: (loadId: string) => void;
}

const GOODS_CATEGORIES: { id: GoodsCategory; label: string; icon: string }[] = [
  { id: 'tea_packaged_bulk', label: 'Tea (Bulk / Packaged Crates)', icon: '🍃' },
  { id: 'agricultural_produce', label: 'Farm Produce / Spices / Mandi Goods', icon: '🌾' },
  { id: 'fmcg_groceries', label: 'FMCG & Packaged Groceries', icon: '📦' },
  { id: 'building_materials_cement', label: 'Cement, TMT Steel & Hardware', icon: '🏗️' },
  { id: 'timber_bamboo', label: 'Timber, Bamboo & Plywood', icon: '🪵' },
  { id: 'hardware_machinery', label: 'Heavy Machinery & Industrial Equipment', icon: '⚙️' },
  { id: 'pharmaceuticals', label: 'Pharmaceuticals & Medical Supplies', icon: '💊' },
  { id: 'textiles_garments', label: 'Textiles, Handloom & Apparel', icon: '🧵' },
  { id: 'ecommerce_parcels', label: 'E-commerce Parcels & White Goods', icon: '🚚' },
  { id: 'general_freight', label: 'General Commercial Freight', icon: '📦' }
];

export const CreateLoadModal: React.FC<CreateLoadModalProps> = ({
  isOpen,
  onClose,
  onLoadCreated
}) => {
  const vehicleCategories = useMemo(() => logisticsStore.getVehicleCategories(), []);
  const currentUser = logisticsStore.getCurrentUser();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [locationInputMode, setLocationInputMode] = useState<'map' | 'manual'>('map');

  // Exact coordinates and structured details from map picker or live address search
  const [pickupPointState, setPickupPointState] = useState<LocationPoint | null>(null);
  const [deliveryPointState, setDeliveryPointState] = useState<LocationPoint | null>(null);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const [routeDurationMins, setRouteDurationMins] = useState<number | null>(null);

  // Form State — open for ANY street, locality, town, village, or city across the state & India
  const [pickupSearchText, setPickupSearchText] = useState('');
  const [pickupCustomAddress, setPickupCustomAddress] = useState('');
  const [pickupCity, setPickupCity] = useState('');
  const [pickupState, setPickupState] = useState('Assam');
  const [pickupPincode, setPickupPincode] = useState('');
  const [pickupContactName, setPickupContactName] = useState(currentUser?.name || '');
  const [pickupContactPhone, setPickupContactPhone] = useState(currentUser?.phone || '');
  const [pickupDateTime, setPickupDateTime] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return d.toISOString().slice(0, 16);
  });

  const [deliverySearchText, setDeliverySearchText] = useState('');
  const [deliveryCustomAddress, setDeliveryCustomAddress] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryState, setDeliveryState] = useState('Assam');
  const [deliveryPincode, setDeliveryPincode] = useState('');
  const [deliveryContactName, setDeliveryContactName] = useState('');
  const [deliveryContactPhone, setDeliveryContactPhone] = useState('');

  // Cargo state
  const [goodsCategory, setGoodsCategory] = useState<GoodsCategory>('general_freight');
  const [goodsDescription, setGoodsDescription] = useState('');
  const [weightKg, setWeightKg] = useState<number>(1000);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'tonnes'>('kg');
  const [packageCount, setPackageCount] = useState<number>(10);
  const [declaredValueInr, setDeclaredValueInr] = useState<number>(50000);
  const [loadType, setLoadType] = useState<'full_load' | 'part_load'>('full_load');
  const [requiredVehicleCategory, setRequiredVehicleCategory] = useState<VehicleCategoryType>('bolero_pickup');
  const [coveredTruck, setCoveredTruck] = useState(true);
  const [fragile, setFragile] = useState(false);
  const [refrigeration, setRefrigeration] = useState(false);
  const [helpersNeeded, setHelpersNeeded] = useState(0);
  const [eWayBillNumber, setEWayBillNumber] = useState('');

  // Pricing mode state
  const [pricingMode, setPricingMode] = useState<'instant_fixed' | 'bidding' | 'shipper_budget'>('bidding');
  const [targetBudgetInr, setTargetBudgetInr] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Default map center fallback (Guwahati, Assam) only when user hasn't picked a pin yet
  const defaultPickupCoord = { lat: 26.1445, lng: 91.7362 };
  const defaultDropCoord = { lat: 26.7509, lng: 94.2037 };

  // Live sync helper from FreightLocationPicker (keeps CreateLoadModal synced for both "Save & Apply" and "Next Step")
  const syncMapLocationPayload = (payload: FreightLocationPayload, advanceToNextStep: boolean) => {
    if (payload.pickup.formatted_address) setPickupCustomAddress(payload.pickup.formatted_address);
    if (payload.pickup.city) setPickupCity(payload.pickup.city);
    if (payload.pickup.pincode) setPickupPincode(payload.pickup.pincode);
    if (payload.pickup.state) setPickupState(payload.pickup.state);
    if (payload.pickup.contactName) setPickupContactName(payload.pickup.contactName);
    if (payload.pickup.contactPhone) setPickupContactPhone(payload.pickup.contactPhone);

    if (payload.drop.formatted_address) setDeliveryCustomAddress(payload.drop.formatted_address);
    if (payload.drop.city) setDeliveryCity(payload.drop.city);
    if (payload.drop.pincode) setDeliveryPincode(payload.drop.pincode);
    if (payload.drop.state) setDeliveryState(payload.drop.state);
    if (payload.drop.contactName) setDeliveryContactName(payload.drop.contactName);
    if (payload.drop.contactPhone) setDeliveryContactPhone(payload.drop.contactPhone);

    setPickupPointState({
      address: payload.pickup.formatted_address,
      city: payload.pickup.city,
      district: payload.pickup.city,
      state: payload.pickup.state || pickupState || 'Assam',
      pincode: payload.pickup.pincode,
      lat: payload.pickup.lat,
      lng: payload.pickup.lng,
      contactName: payload.pickup.contactName || pickupContactName,
      contactPhone: payload.pickup.contactPhone || pickupContactPhone
    });

    setDeliveryPointState({
      address: payload.drop.formatted_address,
      city: payload.drop.city,
      district: payload.drop.city,
      state: payload.drop.state || deliveryState || 'Assam',
      pincode: payload.drop.pincode,
      lat: payload.drop.lat,
      lng: payload.drop.lng,
      contactName: payload.drop.contactName || deliveryContactName,
      contactPhone: payload.drop.contactPhone || deliveryContactPhone
    });

    setRouteDistanceKm(payload.route_meta.distance_km);
    setRouteDurationMins(payload.route_meta.duration_mins);

    if (advanceToNextStep) {
      setStep(2);
    }
  };

  // Callback from FreightLocationPicker final confirm button
  const handleMapLocationPayload = (payload: FreightLocationPayload) => {
    syncMapLocationPayload(payload, true);
  };

  // Live Estimate calculation
  const estimate = useMemo(() => {
    const lat1 = pickupPointState?.lat ?? defaultPickupCoord.lat;
    const lng1 = pickupPointState?.lng ?? defaultPickupCoord.lng;
    const lat2 = deliveryPointState?.lat ?? defaultDropCoord.lat;
    const lng2 = deliveryPointState?.lng ?? defaultDropCoord.lng;

    return logisticsStore.calculateEstimatedFreight(
      lat1,
      lng1,
      lat2,
      lng2,
      requiredVehicleCategory,
      loadType,
      helpersNeeded
    );
  }, [pickupPointState, deliveryPointState, requiredVehicleCategory, loadType, helpersNeeded]);

  if (!isOpen) return null;

  const handleSelectPickupPlace = (place: SelectedPlace) => {
    setPickupSearchText(place.label);
    setPickupCustomAddress(place.address);
    setPickupCity(place.city || place.label);
    setPickupState(place.state || 'Assam');
    setPickupPincode(place.pincode || '');
    setPickupPointState({
      address: place.address,
      city: place.city || place.label,
      district: place.district || place.city || place.label,
      state: place.state || 'Assam',
      pincode: place.pincode || '',
      lat: place.lat,
      lng: place.lng,
      contactName: pickupContactName,
      contactPhone: pickupContactPhone
    });
  };

  const handleSelectDeliveryPlace = (place: SelectedPlace) => {
    setDeliverySearchText(place.label);
    setDeliveryCustomAddress(place.address);
    setDeliveryCity(place.city || place.label);
    setDeliveryState(place.state || 'Assam');
    setDeliveryPincode(place.pincode || '');
    setDeliveryPointState({
      address: place.address,
      city: place.city || place.label,
      district: place.district || place.city || place.label,
      state: place.state || 'Assam',
      pincode: place.pincode || '',
      lat: place.lat,
      lng: place.lng,
      contactName: deliveryContactName,
      contactPhone: deliveryContactPhone
    });
  };

  const handleNextStep = () => {
    const resolvedPickupCity = (pickupCity || pickupSearchText || pickupCustomAddress).trim();
    const resolvedDropCity = (deliveryCity || deliverySearchText || deliveryCustomAddress).trim();
    if (step === 1 && (!resolvedPickupCity || !resolvedDropCity)) {
      showToast('Please enter both Pickup and Delivery locations.', 'error');
      return;
    }
    if (step === 2) {
      if (!goodsDescription.trim()) {
        showToast('Please enter a brief description of the cargo goods.', 'error');
        return;
      }
      if (!Number.isFinite(weightKg) || weightKg <= 0) {
        showToast('Cargo weight must be greater than zero.', 'error');
        return;
      }
    }
    setStep((step + 1) as 1 | 2 | 3 | 4);
  };

  const handleSubmitLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const resolvedDescription = goodsDescription.trim();
    if (!resolvedDescription) {
      showToast('Please add cargo goods description in Step 2 before publishing.', 'error');
      setStep(2);
      return;
    }

    const actualWeightKg = weightUnit === 'tonnes' ? weightKg * 1000 : weightKg;
    if (!Number.isFinite(actualWeightKg) || actualWeightKg <= 0) {
      showToast('Cargo weight must be greater than zero.', 'error');
      setStep(2);
      return;
    }

    setIsSubmitting(true);

    try {
      const resolvedPickupCity = (pickupCity || pickupSearchText || 'Pickup Location').trim();
      const resolvedDeliveryCity = (deliveryCity || deliverySearchText || 'Drop Location').trim();

      const pickupPoint: LocationPoint = {
        address: (pickupCustomAddress || pickupSearchText || resolvedPickupCity).trim(),
        city: resolvedPickupCity,
        district: pickupPointState?.district || resolvedPickupCity,
        state: pickupState || pickupPointState?.state || 'Assam',
        pincode: pickupPincode || pickupPointState?.pincode || '',
        lat: pickupPointState?.lat ?? defaultPickupCoord.lat,
        lng: pickupPointState?.lng ?? defaultPickupCoord.lng,
        contactName: pickupContactName,
        contactPhone: pickupContactPhone
      };

      const deliveryPoint: LocationPoint = {
        address: (deliveryCustomAddress || deliverySearchText || resolvedDeliveryCity).trim(),
        city: resolvedDeliveryCity,
        district: deliveryPointState?.district || resolvedDeliveryCity,
        state: deliveryState || deliveryPointState?.state || 'Assam',
        pincode: deliveryPincode || deliveryPointState?.pincode || '',
        lat: deliveryPointState?.lat ?? defaultDropCoord.lat,
        lng: deliveryPointState?.lng ?? defaultDropCoord.lng,
        contactName: deliveryContactName,
        contactPhone: deliveryContactPhone
      };

      const finalDistanceKm = routeDistanceKm && routeDistanceKm > 0 ? routeDistanceKm : estimate.distanceKm;
      const finalDurationHours =
        routeDurationMins && routeDurationMins > 0
          ? Math.round((routeDurationMins / 60) * 10) / 10
          : estimate.estimatedHours;

      const newLoad = logisticsStore.createLoad({
        customerId: currentUser?.id || `shipper_${Date.now()}`,
        customerName: currentUser?.name || pickupContactName || 'Consignor Shipper',
        customerPhone: currentUser?.phone || pickupContactPhone || '',
        customerCompany: currentUser?.businessName || '',
        customerGstin: currentUser?.gstin || '',
        pickup: pickupPoint,
        delivery: deliveryPoint,
        pickupDateTime,
        expectedDeliveryDateTime: new Date(Date.now() + 1000 * 60 * 60 * (finalDurationHours + 6)).toISOString().slice(0, 16),
        goodsCategory,
        goodsDescription: resolvedDescription,
        weightKg: actualWeightKg,
        packageCount: Math.max(1, packageCount || 1),
        declaredValueInr: Math.max(1000, declaredValueInr || 1000),
        requiredVehicleCategory,
        requiredBodyType: coveredTruck ? 'closed_container' : 'open',
        loadType,
        specialRequirements: {
          fragile,
          coveredTruck,
          refrigerationNeeded: refrigeration,
          loadingHelpersNeeded: helpersNeeded,
          unloadingHelpersNeeded: helpersNeeded,
          eWayBillAvailable: Boolean(eWayBillNumber),
          eWayBillNumber
        },
        pricingMode,
        targetBudgetInr: pricingMode === 'instant_fixed' ? estimate.totalEstimate : targetBudgetInr,
        estimatedDistanceKm: finalDistanceKm,
        estimatedDurationHours: finalDurationHours
      }, { skipImmediateSync: true });

      const syncResult = await logisticsStore.syncLoadToCloud(newLoad);
      if (syncResult.authRequired) {
        showToast(
          'Load saved locally, but your login session expired. Please sign in again so transporters can see this load.',
          'info'
        );
      } else {
        showToast('Commercial load published to marketplace!', 'success');
      }
      onLoadCreated(newLoad.id);
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Failed to create load', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Create Commercial Load</h2>
              <p className="text-xs text-slate-400">Post load to Assam & Northeast Transporter Network</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progression Tabs */}
        <div className="grid grid-cols-4 bg-slate-950/60 border-b border-slate-800 text-xs text-center font-semibold">
          {[
            { num: 1, label: '1. Route & Timing' },
            { num: 2, label: '2. Cargo Details' },
            { num: 3, label: '3. Vehicle & Load' },
            { num: 4, label: '4. Price & Publish' }
          ].map((tab) => (
            <button
              key={tab.num}
              onClick={() => setStep(tab.num as 1 | 2 | 3 | 4)}
              className={`py-3 px-2 transition border-b-2 cursor-pointer ${
                step === tab.num
                  ? 'border-amber-500 text-amber-400 bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body / Steps */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-slate-200">
          {/* STEP 1: ROUTE & TIMING */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Mode Toggle: Interactive Map vs Search Any Address */}
              <div className="flex items-center justify-between p-1 bg-slate-900 border border-slate-800 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setLocationInputMode('map')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    locationInputMode === 'map'
                      ? 'bg-[#E83E83] text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Map Pinpoint (GPS)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLocationInputMode('manual')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    locationInputMode === 'manual'
                      ? 'bg-slate-700 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Type Any Address / City</span>
                </button>
              </div>

              {locationInputMode === 'map' ? (
                /* INTERACTIVE 2-STEP LOCATION PICKER WITH PLACES AUTOCOMPLETE & REVERSE GEOCODING */
                <FreightLocationPicker
                  initialPickup={{
                    lat: pickupPointState?.lat ?? defaultPickupCoord.lat,
                    lng: pickupPointState?.lng ?? defaultPickupCoord.lng,
                    formatted_address: pickupCustomAddress || '',
                    city: pickupCity || '',
                    pincode: pickupPincode || '',
                    contactName: pickupContactName,
                    contactPhone: pickupContactPhone
                  }}
                  initialDrop={{
                    lat: deliveryPointState?.lat ?? defaultDropCoord.lat,
                    lng: deliveryPointState?.lng ?? defaultDropCoord.lng,
                    formatted_address: deliveryCustomAddress || '',
                    city: deliveryCity || '',
                    pincode: deliveryPincode || '',
                    contactName: deliveryContactName,
                    contactPhone: deliveryContactPhone
                  }}
                  onLocationsChange={(payload) => syncMapLocationPayload(payload, false)}
                  onLocationSelected={handleMapLocationPayload}
                />
              ) : (
                /* UNIVERSAL ADDRESS ENTRY VIEW (ANY STREET, TOWN, VILLAGE OR CITY) */
                <div className="space-y-4">
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Enter any pickup &amp; drop address across your city, district, state, or anywhere in India — or tap the GPS icon to auto-detect your location.
                    </span>
                  </div>

                  {/* Pickup Section */}
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                      <span>Pickup Location (Any Area / Town / City)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Search Pickup Area, Town, City or Pincode *</label>
                        <LocationAutocompleteInput
                          value={pickupSearchText}
                          onChangeText={(txt) => {
                            const prev = pickupSearchText;
                            setPickupSearchText(txt);
                            if (!pickupCity || pickupCity === prev) {
                              setPickupCity(txt);
                            }
                          }}
                          onSelectPlace={handleSelectPickupPlace}
                          placeholder="e.g. Six Mile Guwahati, Nagaon, Jorhat..."
                          theme="dark"
                          showGpsButton={true}
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Pickup Date &amp; Time</label>
                        <input
                          type="datetime-local"
                          value={pickupDateTime}
                          onChange={(e) => setPickupDateTime(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">City / Town *</label>
                        <input
                          type="text"
                          value={pickupCity}
                          onChange={(e) => setPickupCity(e.target.value)}
                          placeholder="e.g. Guwahati, Tezpur, Silchar..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">State</label>
                        <input
                          type="text"
                          value={pickupState}
                          onChange={(e) => setPickupState(e.target.value)}
                          placeholder="e.g. Assam, Meghalaya..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Pincode</label>
                        <input
                          type="text"
                          value={pickupPincode}
                          onChange={(e) => setPickupPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="e.g. 781001"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Detailed Pickup Address / Shop / Landmark</label>
                      <input
                        type="text"
                        value={pickupCustomAddress}
                        onChange={(e) => setPickupCustomAddress(e.target.value)}
                        placeholder="Shop / House / Godown / Street / Landmark..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Contact Person Name</label>
                        <input
                          type="text"
                          value={pickupContactName}
                          onChange={(e) => setPickupContactName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Contact Phone</label>
                        <input
                          type="tel"
                          value={pickupContactPhone}
                          onChange={(e) => setPickupContactPhone(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Delivery Section */}
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-rose-400">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                      <span>Delivery Destination (Any Area / Town / City)</span>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Search Drop Area, Town, City or Pincode *</label>
                      <LocationAutocompleteInput
                        value={deliverySearchText}
                        onChangeText={(txt) => {
                          const prev = deliverySearchText;
                          setDeliverySearchText(txt);
                          if (!deliveryCity || deliveryCity === prev) {
                            setDeliveryCity(txt);
                          }
                        }}
                        onSelectPlace={handleSelectDeliveryPlace}
                        placeholder="e.g. Dibrugarh, Tinsukia, Shillong, Siliguri, Kolkata..."
                        theme="dark"
                        showGpsButton={false}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">City / Town *</label>
                        <input
                          type="text"
                          value={deliveryCity}
                          onChange={(e) => setDeliveryCity(e.target.value)}
                          placeholder="e.g. Dibrugarh, Dimapur..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">State</label>
                        <input
                          type="text"
                          value={deliveryState}
                          onChange={(e) => setDeliveryState(e.target.value)}
                          placeholder="e.g. Assam, Nagaland..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Pincode</label>
                        <input
                          type="text"
                          value={deliveryPincode}
                          onChange={(e) => setDeliveryPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="e.g. 786001"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Detailed Delivery Address / Shop / Landmark</label>
                      <input
                        type="text"
                        value={deliveryCustomAddress}
                        onChange={(e) => setDeliveryCustomAddress(e.target.value)}
                        placeholder="Delivery shop, warehouse, house or landmark..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Consignee Name</label>
                        <input
                          type="text"
                          value={deliveryContactName}
                          onChange={(e) => setDeliveryContactName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Consignee Phone</label>
                        <input
                          type="tel"
                          value={deliveryContactPhone}
                          onChange={(e) => setDeliveryContactPhone(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Highway Route Metrics Preview */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block">Est. Road Distance</span>
                      <span className="text-amber-400 font-bold font-mono text-sm">{estimate.distanceKm} km</span>
                    </div>
                    <div className="border-l border-slate-800 pl-4">
                      <span className="text-slate-400 block">Transit Time</span>
                      <span className="text-slate-200 font-bold font-mono text-sm">~{estimate.estimatedHours} hrs</span>
                    </div>
                    <div className="border-l border-slate-800 pl-4">
                      <span className="text-slate-400 block">Highway Tolls</span>
                      <span className="text-slate-200 font-bold font-mono text-sm">₹{estimate.tollEstimate}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: CARGO DETAILS */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-2">Goods Category</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {GOODS_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setGoodsCategory(cat.id)}
                      className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer flex items-center gap-2 ${
                        goodsCategory === cat.id
                          ? 'bg-amber-500/20 border-amber-500 text-amber-200 font-semibold'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="text-base">{cat.icon}</span>
                      <span className="truncate">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Goods Description</label>
                <textarea
                  rows={2}
                  value={goodsDescription}
                  onChange={(e) => setGoodsDescription(e.target.value)}
                  placeholder="Describe goods, packaging type (cartons/sacks/crates), fragile nature..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Weight</label>
                  <div className="flex">
                    <input
                      type="number"
                      value={weightKg}
                      onChange={(e) => setWeightKg(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-l-lg px-3 py-2 text-xs text-slate-100"
                    />
                    <select
                      value={weightUnit}
                      onChange={(e) => setWeightUnit(e.target.value as 'kg' | 'tonnes')}
                      className="bg-slate-800 border border-l-0 border-slate-700 rounded-r-lg px-2 text-xs text-slate-300"
                    >
                      <option value="kg">kg</option>
                      <option value="tonnes">Tonnes</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Package / Carton Count</label>
                  <input
                    type="number"
                    value={packageCount}
                    onChange={(e) => setPackageCount(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Declared Goods Value (₹)</label>
                  <input
                    type="number"
                    value={declaredValueInr}
                    onChange={(e) => setDeclaredValueInr(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              {/* Special Handling Requirements */}
              <div className="pt-2">
                <label className="text-xs text-slate-300 font-semibold block mb-2">Special Requirements</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/40 border border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={coveredTruck}
                      onChange={(e) => setCoveredTruck(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-0"
                    />
                    <span>Covered / Container</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/40 border border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fragile}
                      onChange={(e) => setFragile(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-0"
                    />
                    <span>Fragile Goods</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/40 border border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refrigeration}
                      onChange={(e) => setRefrigeration(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-0"
                    />
                    <span>Cold Chain / Reefer</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Loading/Unloading Helpers Needed</label>
                  <select
                    value={helpersNeeded}
                    onChange={(e) => setHelpersNeeded(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                  >
                    <option value={0}>No helpers needed (Self-handled)</option>
                    <option value={1}>1 Helper (+₹450)</option>
                    <option value={2}>2 Helpers (+₹900)</option>
                    <option value={4}>4 Helpers (+₹1,800)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">GST e-Way Bill Number (Mandatory &gt; ₹50k)</label>
                  <input
                    type="text"
                    value={eWayBillNumber}
                    onChange={(e) => setEWayBillNumber(e.target.value)}
                    placeholder="12-digit e-Way Bill..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: VEHICLE & LOAD CONFIGURATION */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Full Load vs Part Load */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLoadType('full_load')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    loadType === 'full_load'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-200'
                      : 'bg-slate-800/40 border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs">Full Truck Load (FTL)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Dedicated vehicle for entire shipment. Direct transit.</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLoadType('part_load')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    loadType === 'part_load'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-200'
                      : 'bg-slate-800/40 border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <span>Part Load (PTL / Shared)</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                      Save 35%
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Share space on compatible route. Cost effective.</div>
                </button>
              </div>

              {/* Vehicle Selection Carousel */}
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-2">
                  Select Required Commercial Vehicle
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {vehicleCategories.map((v) => {
                    const isSelected = requiredVehicleCategory === v.id;
                    const canCarry = (weightUnit === 'tonnes' ? weightKg * 1000 : weightKg) <= v.capacityKg;
                    return (
                      <div
                        key={v.id}
                        onClick={() => setRequiredVehicleCategory(v.id)}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 shadow-md ring-1 ring-amber-500'
                            : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={v.imageUrl}
                            alt={v.name}
                            className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                              <span>{v.name}</span>
                              {v.isPopular && (
                                <span className="text-[9px] px-1 rounded bg-amber-500 text-slate-950 font-black">
                                  POPULAR
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Payload: <span className="text-amber-400 font-mono font-semibold">{v.capacityTonnes}T ({v.capacityKg} kg)</span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Dim: {v.dimensions.lengthFt} x {v.dimensions.widthFt} x {v.dimensions.heightFt} ft
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-slate-200">₹{v.basePricePerKm}/km</span>
                          {!canCarry && (
                            <span className="block text-[9px] text-rose-400 font-semibold mt-0.5">
                              Exceeds Payload
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: PRICING & PUBLISH */}
          {step === 4 && (
            <div className="space-y-4">
              {/* Pricing Modes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-300 font-semibold">Freight Booking Preference</label>
                  <span className="text-[11px] font-bold text-emerald-400">
                    {logisticsStore.getVehicles().filter((v) => v.isOnline && v.isAvailable && !v.isBlocked).length} Verified Trucks Online Nearby
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPricingMode('instant_fixed');
                      setTargetBudgetInr(estimate.totalEstimate);
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      pricingMode === 'instant_fixed'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500/50'
                        : 'bg-slate-800/40 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <span>⚡ Instant Dispatch</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-black">1-TAP RIDE</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Like Uber/Rapido: nearest online driver accepts & starts pickup immediately at ₹{estimate.totalEstimate.toLocaleString('en-IN')}.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPricingMode('bidding')}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      pricingMode === 'bidding'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                        : 'bg-slate-800/40 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs">Transporter Bidding</div>
                    <div className="text-[11px] text-slate-400 mt-1">Get competitive quotes from verified drivers & fleets. Negotiate best rate.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPricingMode('shipper_budget');
                      if (!targetBudgetInr) setTargetBudgetInr(estimate.totalEstimate);
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      pricingMode === 'shipper_budget'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                        : 'bg-slate-800/40 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs">Target Budget</div>
                    <div className="text-[11px] text-slate-400 mt-1">Specify your fixed budget. Drivers can instant-accept or counter.</div>
                  </button>
                </div>
              </div>

              {pricingMode === 'shipper_budget' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Your Offered Target Freight (₹)</label>
                  <input
                    type="number"
                    value={targetBudgetInr}
                    onChange={(e) => setTargetBudgetInr(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-amber-400 font-mono"
                  />
                </div>
              )}

              {/* Transparent Freight Breakdown */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200 pb-2 border-b border-slate-800">
                  <span>Standard Platform Freight Breakdown</span>
                  <span className="text-slate-400">{estimate.distanceKm} km transit</span>
                </div>

                <div className="flex justify-between text-xs text-slate-300">
                  <span>Base Freight ({estimate.distanceKm} km @ ₹{estimate.ratePerKm}/km)</span>
                  <span className="font-mono">₹{estimate.baseFreight.toLocaleString('en-IN')}</span>
                </div>

                {estimate.helperCharges > 0 && (
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Loading / Unloading Assistance ({helpersNeeded} helpers)</span>
                    <span className="font-mono">₹{estimate.helperCharges.toLocaleString('en-IN')}</span>
                  </div>
                )}

                {estimate.tollEstimate > 0 && (
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Estimated Fastag Tolls</span>
                    <span className="font-mono">₹{estimate.tollEstimate.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="flex justify-between text-xs text-slate-300">
                  <span>GST (5% GTA Freight - Reverse Charge or Direct)</span>
                  <span className="font-mono">₹{estimate.gstAmount.toLocaleString('en-IN')}</span>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                  <span className="text-sm font-bold text-white">Estimated Total Freight</span>
                  <span className="text-base font-extrabold text-amber-400 font-mono">
                    ₹{estimate.totalEstimate.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  All bookings are backed by Zuggi SafeTransit: Verified commercial RC, transit insurance support, and delivery OTP authentication.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Navigation */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
            >
              Back
            </button>
          ) : (
            <div></div>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer ml-auto"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmitLoad}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer ml-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Publishing Load...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Publish Load to Marketplace</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
