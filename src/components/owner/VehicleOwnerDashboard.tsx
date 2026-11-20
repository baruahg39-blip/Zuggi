import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Search,
  IndianRupee,
  Layers,
  Send,
  CheckCircle2,
  Clock,
  ShieldCheck,
  UserCheck,
  Plus,
  ArrowRight,
  Phone,
  Calendar,
  AlertCircle,
  FileText,
  Building2,
  Navigation,
  Download,
  Trash2,
  MapPin,
  ChevronRight,
  Zap
} from 'lucide-react';
import { Booking, CommercialVehicle, LoadItem, Quotation, User } from '../../types';
import { logisticsStore } from '../../services/store';
import { showToast } from '../shared/Toast';

interface VehicleOwnerDashboardProps {
  currentUser: User;
  onNavigateToTrip?: (bookingId: string) => void;
  onOpenSupport?: (loadId?: string) => void;
  onViewInvoice?: (bookingId: string) => void;
}

export const VehicleOwnerDashboard: React.FC<VehicleOwnerDashboardProps> = ({
  currentUser,
  onNavigateToTrip,
  onOpenSupport,
  onViewInvoice
}) => {
  const [activeTab, setActiveTab] = useState<'find_loads' | 'vehicles' | 'bids' | 'bookings' | 'earnings' | 'drivers'>('find_loads');
  const [vehicles, setVehicles] = useState<CommercialVehicle[]>([]);
  const [loads, setLoads] = useState<LoadItem[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Bidding modal
  const [selectedLoad, setSelectedLoad] = useState<LoadItem | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [bidVehicleId, setBidVehicleId] = useState<string>('');
  const [bidSuccessMessage, setBidSuccessMessage] = useState<string | null>(null);

  // Add vehicle modal
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [newRegNumber, setNewRegNumber] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newCapacity, setNewCapacity] = useState('4500');
  const [newPermit, setNewPermit] = useState<'state' | 'national' | 'all_northeast'>('all_northeast');

  // Search in find loads
  const [originFilter, setOriginFilter] = useState('all');
  const [destFilter, setDestFilter] = useState('all');

  useEffect(() => {
    const update = () => {
      setVehicles(
        logisticsStore.getVehicles().filter(
          (v) =>
            v.ownerId === currentUser.id ||
            v.assignedDriverId === currentUser.id ||
            (currentUser.businessName && v.transporterName === currentUser.businessName) ||
            v.transporterName === currentUser.name
        )
      );
      setLoads(logisticsStore.getLoads());
      setQuotations(logisticsStore.getQuotations().filter((q) => q.transporterId === currentUser.id));
      setBookings(logisticsStore.getBookings().filter((b) => b.transporterId === currentUser.id || b.driverId === currentUser.id));
    };
    update();
    const unsub = logisticsStore.subscribe(update);
    return unsub;
  }, [currentUser.id, currentUser.businessName, currentUser.name]);

  const originCities = useMemo(() => {
    return Array.from(
      new Set(
        loads
          .filter((l) => l.status === 'posted' || l.status === 'bidding')
          .map((l) => l.pickup?.city)
          .filter(Boolean)
      )
    ).sort();
  }, [loads]);

  const destCities = useMemo(() => {
    return Array.from(
      new Set(
        loads
          .filter((l) => l.status === 'posted' || l.status === 'bidding')
          .map((l) => l.delivery?.city)
          .filter(Boolean)
      )
    ).sort();
  }, [loads]);

  // Open loads
  const availableLoads = useMemo(() => {
    return loads.filter((l) => {
      if (l.status !== 'posted' && l.status !== 'bidding') return false;
      if (originFilter !== 'all' && l.pickup.city.toLowerCase() !== originFilter.toLowerCase()) return false;
      if (destFilter !== 'all' && l.delivery.city.toLowerCase() !== destFilter.toLowerCase()) return false;
      return true;
    });
  }, [loads, originFilter, destFilter]);

  // Financial summary
  const completedBookings = bookings.filter((b) => b.status === 'completed' || b.status === 'delivered');
  const totalEarnings = completedBookings.reduce((sum, b) => sum + (b.netDriverPayableInr || 0), 0);
  const activeTrips = bookings.filter((b) =>
    ['assigned', 'en_route_pickup', 'at_pickup', 'loading', 'in_transit', 'at_destination'].includes(b.status)
  );

  // Submit quotation
  const handlePlaceBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoad || bidAmount <= 0) return;

    const chosenVehicle = vehicles.find((v) => v.id === bidVehicleId) || vehicles[0];
    const vehReg = chosenVehicle ? chosenVehicle.registrationNumber : 'AS-03-CC-8822';

    try {
      logisticsStore.submitQuotation({
        loadId: selectedLoad.id,
        transporterId: currentUser.id,
        transporterName: currentUser.businessName || currentUser.name,
        transporterPhone: currentUser.phone,
        vehicleId: chosenVehicle?.id || 'veh_owner_01',
        vehicleRegNumber: vehReg,
        vehicleCategory: chosenVehicle?.category || selectedLoad.requiredVehicleCategory,
        driverName: chosenVehicle?.driverName || currentUser.name,
        driverRating: chosenVehicle?.driverRating || 5.0,
        driverCompletedTrips: chosenVehicle?.completedTrips || 0,
        quoteAmountInr: bidAmount,
        chargeBreakdown: {
          baseFreight: Math.round(bidAmount * 0.90),
          fuelSurcharge: 0,
          tollEstimate: 250,
          loadingUnloadingCharges: 0,
          gstAmount: Math.round(bidAmount * 0.05),
          platformFee: Math.round(bidAmount * 0.05)
        },
        estimatedPickupTime: 'Ready for loading within 45 mins',
        notes: 'Commercial vehicle verified & available'
      });

      setBidSuccessMessage(`Bid of ₹${bidAmount.toLocaleString('en-IN')} submitted successfully!`);
      showToast(`Bid of ₹${bidAmount.toLocaleString('en-IN')} submitted successfully!`, 'success');
      setSelectedLoad(null);
      setTimeout(() => setBidSuccessMessage(null), 3000);
    } catch (err: any) {
      showToast(err.message || 'Could not submit bid', 'error');
    }
  };

  const handleInstantAccept = (load: LoadItem) => {
    const chosenVehicle = vehicles.find((v) => v.isAvailable && !v.isBlocked) || vehicles[0];
    const res = logisticsStore.instantAcceptLoad(load.id, currentUser, chosenVehicle?.id);
    if (!res.success || !res.bookingId) {
      showToast(res.message || 'Could not accept ride.', 'error');
      return;
    }
    showToast(res.message, 'success');
    if (onNavigateToTrip) {
      onNavigateToTrip(res.bookingId);
    }
  };

  // Add new vehicle
  const handleCreateVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegNumber.trim()) return;

    const newVeh: CommercialVehicle = {
      id: `veh_${Date.now()}`,
      ownerId: currentUser.id,
      transporterName: currentUser.businessName || currentUser.name,
      registrationNumber: newRegNumber.trim().toUpperCase(),
      category: 'truck_20ft',
      bodyType: 'closed_container',
      capacityKg: parseInt(newCapacity, 10) || 5000,
      modelName: newModel.trim() || 'Tata Commercial Truck',
      fuelType: 'diesel',
      permitType: newPermit,
      currentLocation: {
        lat: 26.1445,
        lng: 91.7362,
        address: `${currentUser.city || 'Guwahati'} Transport Yard`,
        city: currentUser.city || 'Guwahati'
      },
      isOnline: true,
      isAvailable: true,
      verificationStatus: 'verified',
      documents: [],
      assignedDriverId: currentUser.id,
      driverName: currentUser.name,
      driverPhone: currentUser.phone,
      driverRating: 5.0,
      completedTrips: 0,
      photoUrl: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=600&q=80'
    };

    logisticsStore.saveVehicle(newVeh);
    showToast(`Vehicle ${newVeh.registrationNumber} registered & online!`, 'success');
    setShowAddVehicleModal(false);
    setNewRegNumber('');
    setNewModel('');
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner with Clean Pink Highlight */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#F2E8EE] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF0F6] text-[#E83E83] text-xs font-bold">
            <Truck className="w-3.5 h-3.5" />
            <span>Vehicle Owner Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#171318] tracking-tight">
            Welcome, {currentUser.name}
          </h1>
          <p className="text-sm text-[#77717A]">
            Manage your trucks, quote on open freight, assign drivers and track your income.
          </p>
        </div>

        {/* Quick Numbers Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-[#FFF0F6] rounded-2xl p-4 border border-[#FCE1EC] text-center min-w-[110px]">
            <span className="text-xs font-semibold text-[#77717A] block">My Trucks</span>
            <span className="text-2xl font-black text-[#171318]">{vehicles.length}</span>
          </div>
          <div className="bg-[#FFF0F6] rounded-2xl p-4 border border-[#FCE1EC] text-center min-w-[110px]">
            <span className="text-xs font-semibold text-[#77717A] block">Active Trips</span>
            <span className="text-2xl font-black text-[#E83E83]">{activeTrips.length}</span>
          </div>
          <div className="bg-[#FFF0F6] rounded-2xl p-4 border border-[#FCE1EC] text-center min-w-[120px]">
            <span className="text-xs font-semibold text-[#77717A] block">Net Income</span>
            <span className="text-2xl font-black text-[#16A36A]">₹{totalEarnings.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {bidSuccessMessage && (
        <div className="p-4 rounded-2xl bg-[#E8F8F0] border border-[#BDE8D3] text-[#16A36A] font-bold text-sm flex items-center gap-2 shadow-sm animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{bidSuccessMessage}</span>
        </div>
      )}

      {/* Navigation Tabs (Pink Active Indicator) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-sm font-bold">
        {[
          { id: 'find_loads', label: `Find Loads (${availableLoads.length})`, icon: Search },
          { id: 'vehicles', label: `My Vehicles (${vehicles.length})`, icon: Truck },
          { id: 'bids', label: `My Bids (${quotations.length})`, icon: Send },
          { id: 'bookings', label: `My Bookings (${bookings.length})`, icon: Clock },
          { id: 'earnings', label: 'Earnings & Bank', icon: IndianRupee },
          { id: 'drivers', label: 'Driver Management', icon: UserCheck }
        ].map((tab) => {
          const Icon = tab.icon;
          const isSel = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition whitespace-nowrap cursor-pointer shadow-sm ${
                isSel
                  ? 'bg-[#E83E83] text-white shadow-[#E83E83]/20'
                  : 'bg-white text-[#171318] hover:bg-[#FFF0F6] border border-[#F2E8EE]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: FIND LOADS */}
      {activeTab === 'find_loads' && (
        <div className="space-y-5">
          <div className="bg-white rounded-3xl p-5 border border-[#F2E8EE] shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-[#77717A]">
              <MapPin className="w-4 h-4 text-[#E83E83]" />
              <span className="font-semibold text-[#171318]">Corridor Filter:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value)}
                className="bg-[#F8F6F8] border border-[#E7DFE5] rounded-xl px-3 py-2 text-[#171318] font-medium focus:outline-none focus:border-[#E83E83]"
              >
                <option value="all">Any Pickup City</option>
                {originCities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
              <select
                value={destFilter}
                onChange={(e) => setDestFilter(e.target.value)}
                className="bg-[#F8F6F8] border border-[#E7DFE5] rounded-xl px-3 py-2 text-[#171318] font-medium focus:outline-none focus:border-[#E83E83]"
              >
                <option value="all">Any Delivery City</option>
                {destCities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableLoads.map((load) => (
              <div
                key={load.id}
                className="bg-white rounded-3xl p-6 border border-[#F2E8EE] shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-block px-3 py-1 rounded-full bg-[#FFF0F6] text-[#E83E83] text-xs font-bold">
                      {load.goodsDescription.slice(0, 32)}
                    </span>
                    <span className="text-lg font-black text-[#171318] font-mono">
                      ₹{(load.targetBudgetInr || 24000).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Route */}
                  <div className="flex items-center gap-3 text-sm font-bold text-[#171318]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#16A36A]"></div>
                      <span>{load.pickup.city}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#77717A]" />
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#E83E83]"></div>
                      <span>{load.delivery.city}</span>
                    </div>
                    <span className="text-xs text-[#77717A] font-normal font-mono">({load.estimatedDistanceKm} km)</span>
                  </div>

                  <p className="text-xs text-[#77717A] leading-relaxed">
                    Cargo: <strong className="text-[#171318]">{load.goodsDescription}</strong> • Weight: <strong className="text-[#171318]">{(load.weightKg / 1000).toFixed(1)} MT</strong>
                  </p>
                </div>

                <div className="pt-4 border-t border-[#F2E8EE] flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-[#77717A]">
                    Shipper: <strong className="text-[#171318]">{load.customerCompany || load.customerName}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleInstantAccept(load)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition flex items-center gap-1 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Accept & Ride</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedLoad(load);
                        setBidAmount(load.targetBudgetInr || 24000);
                        if (vehicles.length > 0) setBidVehicleId(vehicles[0].id);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#E83E83] hover:bg-[#D62D72] text-white text-xs font-bold shadow-md transition cursor-pointer"
                    >
                      Quote Fare
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: MY VEHICLES */}
      {activeTab === 'vehicles' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#171318]">My Commercial Trucks & Pickups</h2>
            <button
              onClick={() => setShowAddVehicleModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#E83E83] hover:bg-[#D62D72] text-white text-xs font-bold shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Vehicle</span>
            </button>
          </div>

          {vehicles.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-[#F2E8EE] text-center space-y-3">
              <Truck className="w-10 h-10 text-[#E83E83] mx-auto" />
              <p className="text-sm font-bold text-[#171318]">No Commercial Vehicles Registered Yet</p>
              <p className="text-xs text-[#77717A]">Add your truck registration & capacity to accept instant loads and receive payouts.</p>
              <button
                onClick={() => setShowAddVehicleModal(true)}
                className="px-5 py-2.5 rounded-xl bg-[#E83E83] text-white text-xs font-bold cursor-pointer"
              >
                + Register First Truck
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  className="bg-white rounded-3xl p-6 border border-[#F2E8EE] shadow-sm space-y-4"
                >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#FFF0F6] flex items-center justify-center text-[#E83E83] font-bold">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-[#171318] font-mono">{v.registrationNumber}</h3>
                      <p className="text-xs text-[#77717A]">{v.modelName} • {(v.capacityKg / 1000).toFixed(1)} Tonne</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#E8F8F0] text-[#16A36A] text-xs font-bold border border-[#BDE8D3]">
                    Active
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs bg-[#F8F6F8] p-3.5 rounded-2xl">
                  <div>
                    <span className="text-[#77717A] block text-[11px]">Permit:</span>
                    <strong className="text-[#171318] capitalize">{v.permitType.replace('_', ' ')}</strong>
                  </div>
                  <div>
                    <span className="text-[#77717A] block text-[11px]">Assigned Driver:</span>
                    <strong className="text-[#171318]">{(v as any).driverName || 'Self / Assigned'}</strong>
                  </div>
                  <div>
                    <span className="text-[#77717A] block text-[11px]">Parivahan RC:</span>
                    <strong className="text-[#16A36A]">Verified Smart Card</strong>
                  </div>
                  <div>
                    <span className="text-[#77717A] block text-[11px]">Insurance:</span>
                    <strong className="text-[#16A36A]">Valid Comprehensive</strong>
                  </div>
                </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MY BIDS */}
      {activeTab === 'bids' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#171318]">Submitted Freight Quotations</h2>
          {quotations.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-[#F2E8EE] text-center space-y-2">
              <Send className="w-10 h-10 text-[#77717A] mx-auto opacity-50" />
              <p className="text-sm font-bold text-[#171318]">No Active Quotations</p>
              <p className="text-xs text-[#77717A]">You haven't submitted any bids yet. Tap "Find Loads" to quote on open shipments.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quotations.map((q) => (
                <div key={q.id} className="bg-white rounded-3xl p-5 border border-[#F2E8EE] shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[#77717A]">Quote #{q.id.slice(-6)}</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                      q.status === 'accepted' ? 'bg-[#E8F8F0] text-[#16A36A]' : 'bg-[#FFF0F6] text-[#E83E83]'
                    }`}>
                      {q.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#77717A]">Vehicle: <strong className="text-[#171318]">{q.vehicleRegNumber}</strong></span>
                    <span className="text-lg font-black text-[#171318] font-mono">₹{q.quoteAmountInr.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MY BOOKINGS */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#171318]">Bookings & Assigned Shipments</h2>
          {bookings.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-[#F2E8EE] text-center space-y-2">
              <Clock className="w-10 h-10 text-[#77717A] mx-auto opacity-50" />
              <p className="text-sm font-bold text-[#171318]">No Bookings Yet</p>
              <p className="text-xs text-[#77717A]">When a shipper accepts your quote, your active trip voucher appears here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bookings.map((b) => (
                <div key={b.id} className="bg-white rounded-3xl p-6 border border-[#F2E8EE] shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[#77717A]">{b.id}</span>
                    <span className="px-3 py-1 rounded-full bg-[#E8F8F0] text-[#16A36A] text-xs font-bold uppercase">
                      {b.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-[#171318] flex items-center gap-2">
                    <span>{b.pickup.city}</span>
                    <ArrowRight className="w-4 h-4 text-[#77717A]" />
                    <span>{b.delivery.city}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#F2E8EE] text-xs">
                    <span className="text-[#77717A]">Net Payable: <strong className="text-[#16A36A] font-mono text-sm">₹{b.netDriverPayableInr.toLocaleString('en-IN')}</strong></span>
                    {onNavigateToTrip && (
                      <button
                        onClick={() => onNavigateToTrip(b.id)}
                        className="px-4 py-2 rounded-xl bg-[#E83E83] text-white font-bold hover:bg-[#D62D72] cursor-pointer"
                      >
                        Track Trip
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: EARNINGS & BANK */}
      {activeTab === 'earnings' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl p-6 border border-[#F2E8EE] shadow-sm space-y-1">
              <span className="text-xs text-[#77717A] font-semibold block">Total Net Disbursed</span>
              <span className="text-2xl font-black text-[#16A36A] font-mono block">
                ₹{totalEarnings.toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-[#77717A]">Credited via Bank UTR</span>
            </div>
            <div className="bg-white rounded-3xl p-6 border border-[#F2E8EE] shadow-sm space-y-1">
              <span className="text-xs text-[#77717A] font-semibold block">Platform Fee (5%)</span>
              <span className="text-2xl font-black text-[#E83E83] font-mono block">
                ₹{Math.round(totalEarnings * 0.05).toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-[#77717A]">5% Transparent Marketplace Fee</span>
            </div>
            <div className="bg-white rounded-3xl p-6 border border-[#F2E8EE] shadow-sm space-y-1">
              <span className="text-xs text-[#77717A] font-semibold block">Payout Model</span>
              <span className="text-base font-bold text-[#171318] block">2-Stage Cashfree</span>
              <span className="text-[11px] text-[#16A36A] font-semibold">90% at Pickup • 10% on POD</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-[#F2E8EE] shadow-sm space-y-3">
            <h3 className="text-base font-bold text-[#171318]">Beneficiary Payout Account</h3>
            <p className="text-xs text-[#77717A]">
              Vendor ID: <span className="font-mono text-[#171318]">vnd_{currentUser.id.slice(-8)}</span> • Bank: <span className="font-semibold text-[#171318]">HDFC Bank</span> • IFSC: <span className="font-mono text-[#171318]">HDFC0000128</span>
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="px-3 py-1 rounded-full bg-[#E8F8F0] text-[#16A36A] text-xs font-bold border border-[#BDE8D3]">
                ✓ Penny-Drop Verified Account
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: DRIVER MANAGEMENT */}
      {activeTab === 'drivers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#171318]">Assigned Drivers</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vehicles.length === 0 ? (
              <div className="col-span-full bg-white rounded-3xl p-8 border border-[#F2E8EE] text-center text-xs text-[#77717A]">
                Register a vehicle to link drivers cleanly.
              </div>
            ) : (
              vehicles.map((v) => (
                <div key={v.id} className="bg-white rounded-3xl p-6 border border-[#F2E8EE] shadow-sm space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#FFF0F6] text-[#E83E83] flex items-center justify-center font-bold">
                      <UserCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-[#171318]">{v.driverName || currentUser.name}</h4>
                      <p className="text-xs text-[#77717A]">{v.driverPhone || currentUser.phone} • Rating ★ {v.driverRating || 4.9}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#F2E8EE] flex items-center justify-between text-xs">
                    <span className="text-[#77717A]">Assigned Truck: <strong className="text-[#171318] font-mono">{v.registrationNumber}</strong></span>
                    <a
                      href={`tel:${(v.driverPhone || currentUser.phone || '').replace(/\s+/g, '')}`}
                      className="px-3 py-1.5 rounded-xl bg-[#FFF0F6] text-[#E83E83] font-bold hover:bg-[#FCE1EC]"
                    >
                      Call Driver
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* BID SUBMISSION MODAL */}
      {selectedLoad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#171318]/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-[#F2E8EE] shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#F2E8EE]">
              <div>
                <h3 className="text-lg font-extrabold text-[#171318]">Quote Your Freight Fare</h3>
                <p className="text-xs text-[#77717A]">{selectedLoad.pickup.city} to {selectedLoad.delivery.city}</p>
              </div>
              <button onClick={() => setSelectedLoad(null)} className="p-2 text-[#77717A] hover:text-[#171318] cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handlePlaceBid} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#171318] block mb-1">Your Total Agreed Quote (₹ INR) *</label>
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(Number(e.target.value))}
                  className="w-full bg-[#F8F6F8] border border-[#E7DFE5] rounded-xl px-4 py-3 text-xl font-bold text-[#171318] font-mono focus:outline-none focus:border-[#E83E83]"
                />
                <span className="text-[11px] text-[#77717A] mt-1 block">Shipper's Expected Budget: ₹{(selectedLoad.targetBudgetInr || 24000).toLocaleString('en-IN')}</span>
              </div>

              <div>
                <label className="text-xs font-bold text-[#171318] block mb-1">Select Truck for this Load</label>
                <select
                  value={bidVehicleId}
                  onChange={(e) => setBidVehicleId(e.target.value)}
                  className="w-full bg-[#F8F6F8] border border-[#E7DFE5] rounded-xl px-3 py-2.5 text-xs text-[#171318] font-medium focus:outline-none focus:border-[#E83E83]"
                >
                  {(vehicles.length > 0 ? vehicles : [{ id: 'veh_def', registrationNumber: 'AS-03-CC-8822 (Eicher 14ft)' }]).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registrationNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-[#F2E8EE] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLoad(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#F8F6F8] text-[#77717A] hover:text-[#171318] text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#E83E83] hover:bg-[#D62D72] text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Submit Quote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD VEHICLE MODAL */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#171318]/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-[#F2E8EE] shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#F2E8EE]">
              <h3 className="text-lg font-extrabold text-[#171318]">Register Commercial Vehicle</h3>
              <button onClick={() => setShowAddVehicleModal(false)} className="p-2 text-[#77717A] hover:text-[#171318] cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#171318] block mb-1">Registration Number (e.g. AS-01-FC-4912) *</label>
                <input
                  type="text"
                  value={newRegNumber}
                  onChange={(e) => setNewRegNumber(e.target.value.toUpperCase())}
                  placeholder="AS-01-FC-4912"
                  className="w-full bg-[#F8F6F8] border border-[#E7DFE5] rounded-xl px-3 py-2.5 text-sm font-bold text-[#171318] font-mono focus:outline-none focus:border-[#E83E83]"
                />
              </div>

              <div>
                <label className="font-bold text-[#171318] block mb-1">Model & Make</label>
                <input
                  type="text"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  placeholder="e.g. Tata Ultra T.19 or Bolero Maxi Truck"
                  className="w-full bg-[#F8F6F8] border border-[#E7DFE5] rounded-xl px-3 py-2.5 text-xs text-[#171318] focus:outline-none focus:border-[#E83E83]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#171318] block mb-1">Payload Capacity (Kg)</label>
                  <input
                    type="number"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(e.target.value)}
                    className="w-full bg-[#F8F6F8] border border-[#E7DFE5] rounded-xl px-3 py-2.5 text-xs text-[#171318] focus:outline-none focus:border-[#E83E83]"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#171318] block mb-1">Permit Type</label>
                  <select
                    value={newPermit}
                    onChange={(e) => setNewPermit(e.target.value as any)}
                    className="w-full bg-[#F8F6F8] border border-[#E7DFE5] rounded-xl px-3 py-2.5 text-xs text-[#171318] focus:outline-none focus:border-[#E83E83]"
                  >
                    <option value="state">Intra-State</option>
                    <option value="all_northeast">All North-East</option>
                    <option value="national">National Permit</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-[#F2E8EE] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddVehicleModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#F8F6F8] text-[#77717A] text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#E83E83] hover:bg-[#D62D72] text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Save Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
