import React, { useState, useEffect } from 'react';
import {
  X,
  Truck,
  User as UserIcon,
  Send,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Loader2,
  MessageCircle
} from 'lucide-react';
import { FleetDriver, FleetVehicle, GpsTrackingType, LoadItem, User as UserType } from '../../types';
import { logisticsStore } from '../../services/store';
import { showToast } from '../shared/Toast';

interface TripAssignModalProps {
  load: LoadItem;
  currentUser?: UserType | null;
  isOpen: boolean;
  onClose: () => void;
  onAssigned?: (tripResult: any) => void;
  onOpenDriverSimulator?: (tripId: string, token: string) => void;
}

export const TripAssignModal: React.FC<TripAssignModalProps> = ({
  load,
  currentUser,
  isOpen,
  onClose,
  onAssigned,
  onOpenDriverSimulator
}) => {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [trackingSource, setTrackingSource] = useState<GpsTrackingType>('WEB_LINK');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [assignmentResult, setAssignmentResult] = useState<any | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Merge user's registered vehicles & hired drivers from logisticsStore with backend seed options
  useEffect(() => {
    if (!isOpen) return;

    const loadFleetOptions = async () => {
      const storeVehicles = logisticsStore
        .getVehicles()
        .filter((v) => !v.isBlocked)
        .filter((v) => {
          if (!currentUser) return true;
          return (
            v.ownerId === currentUser.id ||
            v.assignedDriverId === currentUser.id ||
            (currentUser.businessName && v.transporterName === currentUser.businessName)
          );
        })
        .map<FleetVehicle>((v) => ({
          id: v.id,
          owner_id: v.ownerId,
          vehicle_number: v.registrationNumber,
          vehicle_type: v.category,
          gps_type: 'MOBILE_APP',
          is_available: v.isAvailable
        }));

      const storeDrivers = logisticsStore
        .getUsers()
        .filter((u) => !u.isBlocked && (u.role === 'driver' || (currentUser && u.id === currentUser.id)))
        .map<FleetDriver>((u) => ({
          id: u.id,
          owner_id: currentUser?.id || u.id,
          name: u.id === currentUser?.id ? `${u.name} (You / Owner-Driver)` : u.name,
          phone_number: u.phone || '+919864012345',
          is_active: true
        }));

      let serverVehicles: FleetVehicle[] = [];
      let serverDrivers: FleetDriver[] = [];

      try {
        const [vehRes, drvRes] = await Promise.all([
          fetch('/trips/fleet/vehicles'),
          fetch('/trips/fleet/drivers')
        ]);
        const vehData = await vehRes.json();
        const drvData = await drvRes.json();
        if (Array.isArray(vehData?.vehicles)) serverVehicles = vehData.vehicles;
        if (Array.isArray(drvData?.drivers)) serverDrivers = drvData.drivers;
      } catch (err) {
        console.warn('Could not fetch backend fleet seed options:', err);
      }

      // Deduplicate keeping user's real vehicles & drivers first
      const seenVehRegs = new Set<string>();
      const mergedVehicles: FleetVehicle[] = [];
      for (const v of [...storeVehicles, ...serverVehicles]) {
        const normReg = v.vehicle_number.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        if (!seenVehRegs.has(normReg)) {
          seenVehRegs.add(normReg);
          mergedVehicles.push(v);
        }
      }

      const seenPhones = new Set<string>();
      const mergedDrivers: FleetDriver[] = [];
      for (const d of [...storeDrivers, ...serverDrivers]) {
        const normPhone = d.phone_number.replace(/\D/g, '').slice(-10) || d.id;
        if (!seenPhones.has(normPhone)) {
          seenPhones.add(normPhone);
          mergedDrivers.push(d);
        }
      }

      setVehicles(mergedVehicles);
      setDrivers(mergedDrivers);

      if (mergedVehicles.length > 0) {
        const defaultVeh = mergedVehicles.find((v) => v.is_available !== false) || mergedVehicles[0];
        setSelectedVehicleId(defaultVeh.id);
        setTrackingSource(defaultVeh.gps_type || 'WEB_LINK');
      }
      if (mergedDrivers.length > 0) {
        setSelectedDriverId(mergedDrivers[0].id);
      }
    };

    setAssignmentResult(null);
    loadFleetOptions();
  }, [isOpen, currentUser?.id, currentUser?.businessName]);

  if (!isOpen) return null;

  const handleVehicleChange = (vId: string) => {
    setSelectedVehicleId(vId);
    const found = vehicles.find((v) => v.id === vId);
    if (found?.gps_type) {
      setTrackingSource(found.gps_type);
    }
  };

  const handleAssignTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId || !selectedDriverId) {
      showToast('Please select both a vehicle and an assigned driver.', 'error');
      return;
    }

    const chosenVeh = vehicles.find((v) => v.id === selectedVehicleId);
    const chosenDrv = drivers.find((d) => d.id === selectedDriverId);

    setIsSubmitting(true);
    try {
      const tripId = load.assignedBookingId || `trip_${load.id}`;

      const res = await fetch(`/trips/${tripId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          load_id: load.id,
          vehicle_id: selectedVehicleId,
          driver_id: selectedDriverId,
          vehicle_number: chosenVeh?.vehicle_number,
          vehicle_type: chosenVeh?.vehicle_type || load.requiredVehicleCategory,
          driver_name: chosenDrv?.name?.replace(' (You / Owner-Driver)', ''),
          driver_phone: chosenDrv?.phone_number,
          owner_id: currentUser?.id || chosenVeh?.owner_id || 'fleet_owner_01',
          tracking_source: trackingSource,
          pickup: {
            lat: load.pickup.lat,
            lng: load.pickup.lng,
            address: load.pickup.address,
            city: load.pickup.city,
            contact_name: load.pickup.contactName,
            contact_phone: load.pickup.contactPhone
          },
          drop: {
            lat: load.delivery.lat,
            lng: load.delivery.lng,
            address: load.delivery.address,
            city: load.delivery.city,
            contact_name: load.delivery.contactName,
            contact_phone: load.delivery.contactPhone
          }
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Trip assignment failed.');
      }

      // Sync booking driver, vehicle & tracking token in local/Firestore logisticsStore
      if (load.assignedBookingId) {
        logisticsStore.assignBookingDriverAndVehicle(load.assignedBookingId, {
          vehicleId: selectedVehicleId,
          driverId: selectedDriverId,
          driverName: data.driver?.name || chosenDrv?.name,
          driverPhone: data.driver?.phone_number || chosenDrv?.phone_number,
          trackingToken: data.trip?.tracking_token
        });
      }

      const browserDriverLink = `${window.location.origin}/track/driver?token=${encodeURIComponent(data.trip.tracking_token)}&trip_id=${encodeURIComponent(data.trip.id)}`;
      setAssignmentResult({ ...data, browser_tracking_url: browserDriverLink });
      showToast(`Trip assigned! Tracking link dispatched to ${data.driver.name}.`, 'success');
      if (onAssigned) onAssigned(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to assign trip', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyTrackingLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    showToast('Driver tracking link copied to clipboard!', 'success');
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const buildWhatsAppShareUrl = (res: any) => {
    const cleanDigits = (res.driver?.phone_number || '').replace(/\D/g, '');
    const waPhone = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
    const link = res.browser_tracking_url || res.tracking_url;
    const text = `Zuggi Trip Dispatch\nTruck: ${res.vehicle?.vehicle_number}\nRoute: ${load.pickup.city} -> ${load.delivery.city}\n\nTap below to start Live GPS & Trip Status (No login required):\n${link}`;
    return waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF0F6] text-[#E83E83] border border-[#F4A7C5] flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#171318]">Assign Vehicle & Dispatch Driver</h3>
              <p className="text-xs text-gray-500">
                Load: {load.pickup.city} → {load.delivery.city} ({(load.weightKg / 1000).toFixed(1)}T)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#171318]">
          {assignmentResult ? (
            /* SUCCESS CONFIRMATION STATE */
            <div className="space-y-4 animate-scale-up">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">Trip Dispatched & Synced to Live Map</h4>
                  <p className="text-xs mt-0.5 opacity-90">
                    Assigned <strong>{assignmentResult.vehicle.vehicle_number}</strong> with driver{' '}
                    <strong>{assignmentResult.driver.name}</strong> ({assignmentResult.driver.phone_number}).
                  </p>
                </div>
              </div>

              {/* SMS & No-Login Web Tracker Notification */}
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between font-bold text-gray-700">
                  <span className="flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-[#E83E83]" />
                    <span>Driver Zero-Login GPS Link Ready</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold">
                    SMS + WHATSAPP
                  </span>
                </div>
                <p className="text-gray-600 text-[11px] leading-relaxed">
                  Share this link with <strong>{assignmentResult.driver.name}</strong>. They only tap once on their phone browser—no app login or OTP needed—to stream live truck GPS to the shipper.
                </p>
              </div>

              {/* Encrypted Tracking Token & Link */}
              <div className="p-4 bg-[#171318] text-white rounded-2xl border border-gray-700 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span className="font-bold uppercase tracking-wider text-[#E83E83]">Driver Web GPS URL</span>
                  <span className="font-mono text-emerald-400">TOKEN LOCKED</span>
                </div>
                <div className="p-2.5 bg-gray-900 rounded-xl font-mono text-[11px] text-gray-200 break-all select-all border border-gray-800">
                  {assignmentResult.browser_tracking_url}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => copyTrackingLink(assignmentResult.browser_tracking_url)}
                    className="py-2.5 px-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedLink ? 'Link Copied!' : 'Copy Driver Link'}</span>
                  </button>

                  <a
                    href={buildWhatsAppShareUrl(assignmentResult)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 bg-[#16A36A] hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Send via WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <a
                  href={assignmentResult.browser_tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 bg-[#E83E83] hover:bg-[#d62f73] text-white rounded-xl font-bold transition flex items-center justify-center gap-2 text-center"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Driver Tracker</span>
                </a>
                {onOpenDriverSimulator && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenDriverSimulator(assignmentResult.trip.id, assignmentResult.trip.tracking_token);
                      onClose();
                    }}
                    className="flex-1 py-3 px-4 bg-[#FFF0F6] border border-[#F4A7C5] hover:bg-[#FFE3EE] text-[#E83E83] rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>GPS Simulator</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3 px-5 bg-[#171318] hover:bg-black text-white rounded-xl font-bold transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* FORM STATE */
            <form onSubmit={handleAssignTrip} className="space-y-4">
              {/* Step 1: Select Fleet Vehicle */}
              <div>
                <label className="block font-black text-gray-700 mb-1.5 uppercase tracking-wider text-[11px]">
                  1. Select Registered Fleet Vehicle ({vehicles.length})
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto pr-1">
                  {vehicles.map((v) => (
                    <label
                      key={v.id}
                      className={`p-3 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                        selectedVehicleId === v.id
                          ? 'bg-[#FFF0F6] border-[#E83E83] text-[#171318]'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="vehicle"
                          value={v.id}
                          checked={selectedVehicleId === v.id}
                          onChange={() => handleVehicleChange(v.id)}
                          className="accent-[#E83E83]"
                        />
                        <div>
                          <div className="font-bold flex items-center gap-2">
                            <span className="font-mono">{v.vehicle_number}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-600 font-mono font-bold">
                              {v.vehicle_type.replace(/_/g, ' ').toUpperCase()}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            GPS Mode: <strong>{v.gps_type}</strong> {v.gps_device_id ? `(${v.gps_device_id})` : ''}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          v.is_available === false
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        }`}
                      >
                        {v.is_available === false ? 'ON TRIP' : 'AVAILABLE'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Step 2: Select Driver */}
              <div>
                <label className="block font-black text-gray-700 mb-1.5 uppercase tracking-wider text-[11px]">
                  2. Select Assigned Truck Driver ({drivers.length})
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto pr-1">
                  {drivers.map((d) => (
                    <label
                      key={d.id}
                      className={`p-3 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                        selectedDriverId === d.id
                          ? 'bg-[#FFF0F6] border-[#E83E83] text-[#171318]'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="driver"
                          value={d.id}
                          checked={selectedDriverId === d.id}
                          onChange={() => setSelectedDriverId(d.id)}
                          className="accent-[#E83E83]"
                        />
                        <div>
                          <div className="font-bold text-sm text-[#171318] flex items-center gap-1.5">
                            <UserIcon className="w-3.5 h-3.5 text-[#E83E83]" />
                            <span>{d.name}</span>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                          <div className="text-[11px] text-gray-500 font-mono">{d.phone_number}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700">ACTIVE</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Step 3: Tracking Source */}
              <div>
                <label className="block font-black text-gray-700 mb-1.5 uppercase tracking-wider text-[11px]">
                  3. Driver Tracking Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['WEB_LINK', 'MOBILE_APP', 'HARDWARE_GPS'] as GpsTrackingType[]).map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setTrackingSource(src)}
                      className={`p-2.5 rounded-xl border text-center transition font-bold text-[11px] cursor-pointer ${
                        trackingSource === src
                          ? 'bg-[#171318] text-white border-[#171318]'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {src === 'WEB_LINK' && 'Driver Web Link'}
                      {src === 'MOBILE_APP' && 'Driver App'}
                      {src === 'HARDWARE_GPS' && 'Hardware IoT'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dispatch Action */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-4 py-3.5 px-4 bg-[#E83E83] hover:bg-[#d62f73] text-white rounded-2xl font-black text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#E83E83]/25 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Assigning & Generating Driver Link...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Assign Trip & Generate Driver GPS Link</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
