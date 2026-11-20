import React, { useState, useEffect, useMemo } from 'react';
import { 
  Truck, 
  Users, 
  Plus, 
  Search, 
  FileText, 
  IndianRupee, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  AlertCircle, 
  ChevronRight, 
  ArrowUpRight, 
  Filter, 
  Phone, 
  Calendar,
  Building2,
  Navigation,
  Download,
  Check,
  X,
  Radio,
  Send,
  Eye,
  Zap
} from 'lucide-react';
import { User, CommercialVehicle, Booking, LoadItem, VehicleCategoryType } from '../../types';
import { logisticsStore } from '../../services/store';
import { TripAssignModal } from './TripAssignModal';
import { DriverGpsSimulatorModal } from '../tracking/DriverGpsSimulatorModal';
import { ShipperLiveTrackingScreen } from '../tracking/ShipperLiveTrackingScreen';
import { showToast as emitAppToast } from '../shared/Toast';
import { exportAdminMasterReportCsv } from '../../utils/csvExport';

interface FleetPartnerDashboardProps {
  currentUser: User;
  onOpenSupport?: (loadId?: string) => void;
  onViewBookingDetails?: (bookingId: string) => void;
}

export const FleetPartnerDashboard: React.FC<FleetPartnerDashboardProps> = ({
  currentUser,
  onOpenSupport,
  onViewBookingDetails
}) => {
  const [activeTab, setActiveTab] = useState<
    'fleet' | 'add_vehicle' | 'drivers' | 'loads' | 'bookings' | 'earnings'
  >('fleet');

  const [vehicles, setVehicles] = useState<CommercialVehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loads, setLoads] = useState<LoadItem[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New vehicle form state
  const [newRegNo, setNewRegNo] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newCategory, setNewCategory] = useState<VehicleCategoryType>('tata_ace');
  const [newCapacity, setNewCapacity] = useState('2.5');
  const [newDriverId, setNewDriverId] = useState('');

  // New driver form state
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');

  // Load bidding state
  const [selectedLoadForBid, setSelectedLoadForBid] = useState<LoadItem | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [selectedVehicleForBid, setSelectedVehicleForBid] = useState<string>('');

  // Trip Assignment & Live Tracking modal state
  const [selectedLoadForAssign, setSelectedLoadForAssign] = useState<LoadItem | null>(null);
  const [showDriverSimulator, setShowDriverSimulator] = useState<boolean>(false);
  const [simulatorTripId, setSimulatorTripId] = useState<string>('trip_demo_01');
  const [simulatorToken, setSimulatorToken] = useState<string>('trk_sec_993821739182371928371923');
  const [showLiveTrackingModal, setShowLiveTrackingModal] = useState<boolean>(false);
  const [liveTrackingTripId, setLiveTrackingTripId] = useState<string>('trip_demo_01');

  const vehicleCategories = logisticsStore.getVehicleCategories();

  useEffect(() => {
    const update = () => {
      const ownedVehicles = logisticsStore.getVehicles().filter(
        (v) =>
          v.ownerId === currentUser.id ||
          v.assignedDriverId === currentUser.id ||
          (currentUser.businessName && v.transporterName === currentUser.businessName)
      );
      setVehicles(ownedVehicles);
      const ownedVehIds = new Set(ownedVehicles.map((v) => v.id));
      setBookings(
        logisticsStore
          .getBookings()
          .filter(
            (b) =>
              b.transporterId === currentUser.id ||
              b.driverId === currentUser.id ||
              ownedVehIds.has(b.vehicleId)
          )
      );
      setLoads(logisticsStore.getLoads());
      const allUsers = logisticsStore.getUsers();
      setDrivers(allUsers.filter((u) => u.role === 'driver' && !u.isBlocked));
    };
    update();
    const unsub = logisticsStore.subscribe(update);
    return unsub;
  }, [currentUser.id, currentUser.businessName]);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    emitAppToast(msg, type);
    if (type === 'success') {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegNo.trim() || !newModel.trim()) return;

    const capacityTons = parseFloat(newCapacity) || 2.5;
    const assignedDrv = drivers.find(d => d.id === newDriverId);

    const newVeh: CommercialVehicle = {
      id: `veh_${Date.now()}`,
      ownerId: currentUser.id,
      transporterName: currentUser.businessName || currentUser.name,
      registrationNumber: newRegNo.toUpperCase().trim(),
      category: newCategory,
      bodyType: 'closed_container',
      capacityKg: Math.round(capacityTons * 1000),
      modelName: newModel.trim(),
      fuelType: 'diesel',
      permitType: 'national',
      currentLocation: {
        address: 'Guwahati Logistics Park, Assam',
        city: 'Guwahati',
        lat: 26.1445,
        lng: 91.7362
      },
      isOnline: true,
      isAvailable: true,
      verificationStatus: 'verified',
      documents: [],
      assignedDriverId: newDriverId || undefined,
      driverName: assignedDrv?.name,
      driverPhone: assignedDrv?.phone,
      driverRating: 5.0,
      completedTrips: 0,
      photoUrl: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=600'
    };

    logisticsStore.saveVehicle(newVeh);
    setNewRegNo('');
    setNewModel('');
    showToast(`Vehicle ${newVeh.registrationNumber} added to fleet successfully!`);
    setActiveTab('fleet');
  };

  const handleAddDriver = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName.trim() || !driverPhone.trim()) return;

    const newDrv: User = {
      id: `driver_${Date.now()}`,
      role: 'driver',
      name: driverName.trim(),
      email: `${driverPhone.trim()}@zuggi.in`,
      phone: driverPhone.trim(),
      state: 'Assam',
      city: 'Guwahati',
      isVerified: true,
      createdAt: new Date().toISOString()
    };

    logisticsStore.saveUser(newDrv);
    setDriverName('');
    setDriverPhone('');
    setShowAddDriverModal(false);
    showToast(`Driver ${newDrv.name} registered and added to fleet!`);
  };

  const handlePlaceBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoadForBid || bidAmount <= 0) return;

    const chosenVeh = vehicles.find((v) => v.id === selectedVehicleForBid) || vehicles[0];

    try {
      logisticsStore.submitQuotation({
        loadId: selectedLoadForBid.id,
        transporterId: currentUser.id,
        transporterName: currentUser.businessName || currentUser.name || 'Fleet Operator',
        transporterPhone: currentUser.phone || '9876543210',
        vehicleId: chosenVeh?.id || 'veh_01',
        vehicleRegNumber: chosenVeh?.registrationNumber || 'AS-01-EE-4491',
        vehicleCategory: chosenVeh?.category || selectedLoadForBid.requiredVehicleCategory,
        driverName: chosenVeh?.driverName || currentUser.name,
        driverRating: chosenVeh?.driverRating || 5.0,
        driverCompletedTrips: chosenVeh?.completedTrips || 0,
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

      showToast(`Quotation of ₹${bidAmount.toLocaleString('en-IN')} submitted for ${selectedLoadForBid.goodsDescription}!`, 'success');
      setSelectedLoadForBid(null);
    } catch (err: any) {
      showToast(err?.message || 'Unable to submit fleet quotation.', 'error');
    }
  };

  const handleInstantAcceptLoad = (load: LoadItem) => {
    const chosenVeh = vehicles.find((v) => v.isAvailable && !v.isBlocked) || vehicles[0];
    const res = logisticsStore.instantAcceptLoad(load.id, currentUser, chosenVeh?.id);
    if (!res.success || !res.bookingId) {
      showToast(res.message || 'Unable to accept load.', 'error');
      return;
    }
    showToast(res.message, 'success');
    if (onViewBookingDetails) {
      onViewBookingDetails(res.bookingId);
    }
  };

  // Fleet stats
  const totalFleetCount = vehicles.length;
  const activeFleetCount = vehicles.filter(v => v.isOnline && !v.isBlocked).length;
  const activeBookingsCount = bookings.filter(b => b.status !== 'completed' && b.status !== 'cancelled').length;
  const totalFleetRevenue = bookings
    .filter(b => b.status === 'completed' || b.status === 'delivered')
    .reduce((sum, b) => sum + (b.netDriverPayableInr || b.totalAgreedAmountInr || 0), 0);
  const inEscrowTotal = bookings
    .filter(b => b.status !== 'completed' && b.status !== 'cancelled')
    .reduce((sum, b) => sum + (b.netDriverPayableInr || b.totalAgreedAmountInr || 0), 0);

  return (
    <div className="space-y-6 pb-20">
      {/* Toast Notification */}
      {successMsg && (
        <div className="fixed top-18 right-4 z-50 bg-[#16A36A] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-emerald-400">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Fleet Partner Header Card */}
      <div className="bg-[#171318] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF0F6] text-[#E83E83] text-xs font-bold">
              <Building2 className="w-3.5 h-3.5" />
              <span>Fleet Partner Control Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {currentUser.businessName || currentUser.name || 'Assam Regional Fleet'}
            </h1>
            <p className="text-sm text-gray-300 max-w-xl">
              Manage your commercial trucks, assign professional drivers, place bids on Northeast freight corridors, and monitor real-time company earnings.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
              <span className="text-xs text-gray-300 block font-medium">Total Trucks</span>
              <span className="text-2xl font-black text-white">{totalFleetCount}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
              <span className="text-xs text-gray-300 block font-medium">Active Trips</span>
              <span className="text-2xl font-black text-[#E83E83]">{activeBookingsCount}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center col-span-2 sm:col-span-1">
              <span className="text-xs text-gray-300 block font-medium">Completed Revenue</span>
              <span className="text-xl font-black text-[#16A36A]">₹{(totalFleetRevenue).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* 6 Tab Navigation Pills */}
        <div className="mt-8 pt-6 border-t border-gray-800 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setActiveTab('fleet')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'fleet'
                ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>My Fleet ({vehicles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('add_vehicle')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'add_vehicle'
                ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Add Vehicle</span>
          </button>

          <button
            onClick={() => setActiveTab('drivers')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'drivers'
                ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Manage Drivers ({drivers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('loads')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'loads'
                ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Available Loads ({loads.filter(l => l.status === 'posted' || l.status === 'bidding').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'bookings'
                ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Active Bookings ({bookings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('earnings')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'earnings'
                ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <IndianRupee className="w-4 h-4" />
            <span>Fleet Earnings</span>
          </button>
        </div>
      </div>

      {/* TAB 1: MY FLEET */}
      {activeTab === 'fleet' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#171318]">Commercial Fleet Inventory</h2>
            <button
              onClick={() => setActiveTab('add_vehicle')}
              className="px-4 py-2 bg-[#E83E83] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#d62e73] transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Truck</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((v) => {
              const assignedDrv = drivers.find(d => d.id === v.assignedDriverId);
              return (
                <div 
                  key={v.id} 
                  className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-base font-extrabold text-[#171318] block">
                        {v.registrationNumber}
                      </span>
                      <span className="text-xs text-[#77717A] font-medium">{v.modelName}</span>
                    </div>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${
                      v.isOnline 
                        ? 'bg-emerald-50 text-[#16A36A] border border-emerald-200' 
                        : 'bg-gray-100 text-[#77717A]'
                    }`}>
                      {v.isOnline ? 'Available' : 'Off Duty'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-gray-100">
                    <div>
                      <span className="text-[#77717A] block">Capacity</span>
                      <span className="font-bold text-[#171318]">{(v.capacityKg ? (v.capacityKg / 1000).toFixed(1) : '3.5')} MT</span>
                    </div>
                    <div>
                      <span className="text-[#77717A] block">Completed Trips</span>
                      <span className="font-bold text-[#171318]">{v.completedTrips || 0}</span>
                    </div>
                  </div>

                  <div className="text-xs space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#77717A] shrink-0">Assigned Driver:</span>
                      <select
                        value={v.assignedDriverId || ''}
                        onChange={(e) => {
                          const selectedDrv = drivers.find((d) => d.id === e.target.value);
                          logisticsStore.saveVehicle({
                            ...v,
                            assignedDriverId: selectedDrv?.id || undefined,
                            driverName: selectedDrv?.name || undefined,
                            driverPhone: selectedDrv?.phone || undefined
                          });
                          showToast(
                            selectedDrv
                              ? `Assigned ${selectedDrv.name} to ${v.registrationNumber}`
                              : `Unassigned driver from ${v.registrationNumber}`,
                            'success'
                          );
                        }}
                        className="text-xs font-semibold text-[#171318] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 max-w-[165px] focus:outline-none focus:border-[#E83E83]"
                      >
                        <option value="">
                          {v.driverName ? `${v.driverName} (Current)` : '-- Unassigned --'}
                        </option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.phone})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#77717A]">Current Location:</span>
                      <span className="font-medium text-[#171318] truncate max-w-[150px]">
                        {v.currentLocation?.city || 'Guwahati, Assam'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => {
                        logisticsStore.toggleVehicleOnline(v.id, !v.isOnline);
                        showToast(`Status updated for ${v.registrationNumber}`);
                      }}
                      className="flex-1 py-2 rounded-xl text-xs font-bold border border-gray-300 hover:bg-gray-50 text-[#171318] transition cursor-pointer"
                    >
                      {v.isOnline ? 'Mark Offline' : 'Mark Online'}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedVehicleForBid(v.id);
                        setActiveTab('loads');
                      }}
                      className="px-3 py-2 bg-[#FFF0F6] text-[#E83E83] rounded-xl text-xs font-bold hover:bg-[#ffe2ee] transition cursor-pointer"
                    >
                      Find Load
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: ADD VEHICLE */}
      {activeTab === 'add_vehicle' && (
        <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-[#171318]">Add Commercial Vehicle to Fleet</h2>
            <p className="text-xs text-[#77717A]">
              Register trucks, trailers, or mini-trucks. Vehicles are automatically linked to your fleet operator account.
            </p>
          </div>

          <form onSubmit={handleAddVehicle} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#171318]">Vehicle Registration Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AS-01-GB-9921"
                  value={newRegNo}
                  onChange={(e) => setNewRegNo(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#E83E83]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#171318]">Make & Model *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tata 407 Gold / Eicher Pro"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#E83E83]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#171318]">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as VehicleCategoryType)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#E83E83]"
                >
                  {vehicleCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.capacityTonnes}T)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#171318]">Payload Capacity (Metric Tons)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder="e.g. 4.5"
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#E83E83]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#171318]">Assign Driver (Optional)</label>
              <select
                value={newDriverId}
                onChange={(e) => setNewDriverId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#E83E83]"
              >
                <option value="">-- Assign Later --</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.phone})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('fleet')}
                className="px-5 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-[#171318] hover:bg-gray-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#E83E83] text-white text-sm font-bold rounded-xl shadow-md hover:bg-[#d62e73] transition cursor-pointer"
              >
                Save Vehicle to Fleet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: MANAGE DRIVERS */}
      {activeTab === 'drivers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#171318]">Fleet Drivers</h2>
              <p className="text-xs text-[#77717A]">Assign drivers to trucks, verify licenses, and monitor safety</p>
            </div>
            <button
              onClick={() => setShowAddDriverModal(true)}
              className="px-4 py-2 bg-[#E83E83] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#d62e73] transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Driver</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {drivers.map((drv) => {
              const assignedVeh = vehicles.find(v => v.assignedDriverId === drv.id);
              return (
                <div 
                  key={drv.id}
                  className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#FFF0F6] text-[#E83E83] font-black text-sm flex items-center justify-center">
                        {drv.name.charAt(0)}
                      </div>
                      <div>
                        <span className="font-bold text-sm text-[#171318] block">{drv.name}</span>
                        <span className="text-xs text-[#77717A] flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <span>{drv.phone}</span>
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-[#16A36A] font-bold border border-emerald-200">
                      Verified
                    </span>
                  </div>

                  <div className="text-xs space-y-1 bg-gray-50 rounded-2xl p-3">
                    <div className="flex justify-between">
                      <span className="text-[#77717A]">Assigned Truck:</span>
                      <span className="font-bold text-[#171318]">
                        {assignedVeh ? assignedVeh.registrationNumber : 'None'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href={`tel:${drv.phone}`}
                      className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#171318] text-white text-center hover:bg-black transition"
                    >
                      Call Driver
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Driver Modal */}
          {showAddDriverModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-[#171318]">Register Fleet Driver</h3>
                  <button 
                    onClick={() => setShowAddDriverModal(false)}
                    className="p-1 rounded-lg text-gray-400 hover:text-black cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAddDriver} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#171318]">Driver Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kalita"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#E83E83]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#171318]">Mobile Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="10-digit mobile number"
                      value={driverPhone}
                      onChange={(e) => setDriverPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#E83E83]"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddDriverModal(false)}
                      className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-[#171318]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#E83E83] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#d62e73]"
                    >
                      Add Driver
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AVAILABLE LOADS */}
      {activeTab === 'loads' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#171318]">Available Northeast Loads</h2>
              <p className="text-xs text-[#77717A]">Submit competitive quotations directly from your commercial fleet</p>
            </div>
          </div>

          <div className="space-y-3">
            {loads.filter(l => l.status === 'posted' || l.status === 'bidding').map((load) => (
              <div 
                key={load.id}
                className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-base text-[#171318] block">{load.goodsDescription}</span>
                    <span className="text-xs text-[#77717A]">Weight: {(load.weightKg ? (load.weightKg / 1000).toFixed(1) : '3.5')} MT • Vehicle: {load.requiredVehicleCategory}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-[#77717A] block">Target Freight Budget</span>
                    <span className="text-lg font-black text-[#16A36A]">₹{(load.targetBudgetInr || 22000).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 rounded-2xl p-3 text-xs">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-[#E83E83] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[#77717A] block">Pickup Location</span>
                      <span className="font-semibold text-[#171318]">{load.pickup?.city || 'Guwahati'}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-[#16A36A] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[#77717A] block">Delivery Location</span>
                      <span className="font-semibold text-[#171318]">{load.delivery?.city || 'Dibrugarh'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-[#77717A]">
                    Posted by: <span className="font-semibold text-[#171318]">{load.customerName || 'Verified Shipper'}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleInstantAcceptLoad(load)}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Instant Accept & Dispatch</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedLoadForBid(load);
                        setBidAmount(load.targetBudgetInr || 20000);
                        setSelectedVehicleForBid(vehicles[0]?.id || '');
                      }}
                      className="px-5 py-2.5 bg-[#E83E83] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#d62e73] transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Submit Fleet Bid</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bid Modal */}
          {selectedLoadForBid && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-[#171318]">Submit Quotation</h3>
                  <button 
                    onClick={() => setSelectedLoadForBid(null)}
                    className="p-1 rounded-lg text-gray-400 hover:text-black cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-gray-50 rounded-2xl p-3 text-xs space-y-1">
                  <p className="font-bold text-[#171318]">{selectedLoadForBid.goodsDescription}</p>
                  <p className="text-[#77717A]">
                    {selectedLoadForBid.pickup?.city} → {selectedLoadForBid.delivery?.city}
                  </p>
                </div>

                <form onSubmit={handlePlaceBid} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#171318]">Select Fleet Vehicle</label>
                    <select
                      value={selectedVehicleForBid}
                      onChange={(e) => setSelectedVehicleForBid(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#E83E83]"
                    >
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.registrationNumber} ({v.modelName} - {(v.capacityKg ? (v.capacityKg / 1000).toFixed(1) : '3.5')} MT)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#171318]">Your Freight Quote (₹ INR) *</label>
                    <input
                      type="number"
                      required
                      min="1000"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(parseInt(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-base font-bold text-[#171318] focus:outline-none focus:ring-2 focus:ring-[#E83E83]"
                    />
                    <p className="text-[11px] text-[#77717A]">Payment secured via escrow upon customer acceptance</p>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedLoadForBid(null)}
                      className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-[#171318]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#E83E83] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#d62e73]"
                    >
                      Confirm Bid
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ACTIVE BOOKINGS */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#171318]">Active Fleet Bookings</h2>
          </div>

          <div className="space-y-3">
            {bookings.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center text-[#77717A] text-sm border border-gray-200">
                No active bookings currently. Bid on available loads to receive consignments.
              </div>
            ) : (
              bookings.map((booking) => (
                <div 
                  key={booking.id}
                  className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs text-[#E83E83] font-bold block">
                        Booking #{booking.id}
                      </span>
                      <span className="font-bold text-base text-[#171318]">
                        {booking.pickup?.city || 'Guwahati'} → {booking.delivery?.city || 'Dibrugarh'}
                      </span>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase self-start sm:self-auto ${
                      booking.status === 'completed'
                        ? 'bg-emerald-50 text-[#16A36A]'
                        : 'bg-amber-50 text-[#E9A23B]'
                    }`}>
                      {booking.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 rounded-2xl p-3 text-xs">
                    <div>
                      <span className="text-[#77717A] block">Truck Assigned</span>
                      <span className="font-bold text-[#171318] font-mono">
                        {logisticsStore.getVehicleById(booking.vehicleId)?.registrationNumber || booking.vehicleId || 'Pending'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#77717A] block">Driver</span>
                      <span className="font-bold text-[#171318]">
                        {logisticsStore.getVehicleById(booking.vehicleId)?.driverName ||
                          logisticsStore.getUserById(booking.driverId)?.name ||
                          'Fleet Driver'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#77717A] block">Driver Payable</span>
                      <span className="font-bold text-[#16A36A]">₹{(booking.netDriverPayableInr || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[#77717A] block">Payment Status</span>
                      <span className="font-bold text-[#171318] capitalize">{booking.paymentStatus || 'Secured'}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100">
                    <span className="text-xs text-[#77717A]">
                      Cargo: <strong>{booking.goodsDescription}</strong> ({((booking.weightKg || 0) / 1000).toFixed(1)}T)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const l = loads.find(item => item.id === booking.loadId) || {
                            id: booking.loadId,
                            customerId: booking.customerId,
                            customerName: 'Verified Shipper',
                            customerPhone: '+919864012345',
                            pickup: booking.pickup,
                            delivery: booking.delivery,
                            goodsCategory: 'general_freight' as any,
                            goodsDescription: booking.goodsDescription,
                            weightKg: booking.weightKg,
                            packageCount: 1,
                            declaredValueInr: booking.totalAgreedAmountInr,
                            requiredVehicleCategory: 'tata_407',
                            requiredBodyType: 'closed_container',
                            loadType: 'full_load',
                            specialRequirements: { fragile: false, coveredTruck: true, refrigerationNeeded: false, loadingHelpersNeeded: 1, unloadingHelpersNeeded: 1, eWayBillAvailable: true },
                            pricingMode: 'instant_fixed',
                            estimatedDistanceKm: 420,
                            estimatedDurationHours: 10,
                            status: booking.status,
                            createdAt: new Date().toISOString(),
                            pickupDateTime: new Date().toISOString(),
                            expectedDeliveryDateTime: new Date(Date.now() + 86400000).toISOString(),
                            matchedVehicleCount: 1,
                            deliveryOtp: booking.deliveryOtp,
                            assignedBookingId: booking.id
                          };
                          setSelectedLoadForAssign(l);
                        }}
                        className="px-3.5 py-1.5 bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Assign Vehicle & Driver</span>
                      </button>

                      <button
                        onClick={() => {
                          setLiveTrackingTripId(booking.id || 'trip_demo_01');
                          setShowLiveTrackingModal(true);
                        }}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>Live GPS Tracker</span>
                      </button>

                      {onViewBookingDetails && (
                        <button
                          onClick={() => onViewBookingDetails(booking.id)}
                          className="px-3.5 py-1.5 bg-[#171318] text-white text-xs font-semibold rounded-xl hover:bg-black transition cursor-pointer"
                        >
                          Trip Details
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 6: FLEET EARNINGS */}
      {activeTab === 'earnings' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-2">
              <span className="text-xs font-bold text-[#77717A] uppercase tracking-wider block">Total Disbursed</span>
              <span className="text-3xl font-black text-[#16A36A]">₹{(totalFleetRevenue).toLocaleString('en-IN')}</span>
              <p className="text-xs text-[#77717A]">Direct settlements into registered bank account</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-2">
              <span className="text-xs font-bold text-[#77717A] uppercase tracking-wider block">In Escrow (Transit)</span>
              <span className="text-3xl font-black text-[#E83E83]">₹{inEscrowTotal.toLocaleString('en-IN')}</span>
              <p className="text-xs text-[#77717A]">Released upon delivery confirmation</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-2">
              <span className="text-xs font-bold text-[#77717A] uppercase tracking-wider block">Active Fleet</span>
              <span className="text-3xl font-black text-[#171318]">{activeFleetCount} / {totalFleetCount}</span>
              <p className="text-xs text-[#77717A]">Trucks online generating revenue</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[#171318]">Vehicle-Wise Earnings Breakdown</h3>
              <button
                onClick={() => {
                  exportAdminMasterReportCsv(bookings, loads);
                  showToast('Fleet bookings CSV report downloaded.', 'success');
                }}
                className="px-3.5 py-1.5 bg-[#FFF0F6] text-[#E83E83] rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-[#ffe2ee] transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Report</span>
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {vehicles.map((v) => {
                const vehicleBookings = bookings.filter((b) => b.vehicleId === v.id && (b.status === 'completed' || b.status === 'delivered'));
                const tripCount = Math.max(vehicleBookings.length, v.completedTrips || 0);
                const actualRevenue = vehicleBookings.reduce((sum, b) => sum + (b.netDriverPayableInr || b.totalAgreedAmountInr || 0), 0);
                const avgFare = vehicleBookings.length > 0 ? Math.round(actualRevenue / vehicleBookings.length) : 0;
                return (
                  <div key={v.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-sm text-[#171318] block">{v.registrationNumber}</span>
                      <span className="text-[#77717A]">{v.modelName} • {tripCount} trips completed</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-sm text-[#16A36A] block">
                        ₹{actualRevenue.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-[#77717A]">
                        {vehicleBookings.length > 0 ? `Avg ₹${avgFare.toLocaleString('en-IN')} / trip` : `${tripCount} historical trips`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TRIP ASSIGNMENT MODAL */}
      {selectedLoadForAssign && (
        <TripAssignModal
          load={selectedLoadForAssign}
          currentUser={currentUser}
          isOpen={true}
          onClose={() => setSelectedLoadForAssign(null)}
          onAssigned={(tripRes) => {
            showToast(`Vehicle ${tripRes.vehicle.vehicle_number} and driver ${tripRes.driver.name} assigned!`);
          }}
          onOpenDriverSimulator={(tId, tok) => {
            setSimulatorTripId(tId);
            setSimulatorToken(tok);
            setShowDriverSimulator(true);
          }}
        />
      )}

      {/* DRIVER GPS PINGER & OFFLINE BUFFER SIMULATOR MODAL */}
      {showDriverSimulator && (
        <DriverGpsSimulatorModal
          tripId={simulatorTripId}
          trackingToken={simulatorToken}
          isOpen={true}
          onClose={() => setShowDriverSimulator(false)}
        />
      )}

      {/* LIVE SHIPPER TRACKING SCREEN MODAL (PREVIEW FOR FLEET OWNER) */}
      {showLiveTrackingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[92vh] p-4 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                <h3 className="font-black text-sm text-[#171318]">Live Shipper Tracking View Preview</h3>
              </div>
              <button
                onClick={() => setShowLiveTrackingModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-black cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <ShipperLiveTrackingScreen
                tripId={liveTrackingTripId}
                onOpenDriverSimulator={(tId, tok) => {
                  setShowLiveTrackingModal(false);
                  setSimulatorTripId(tId);
                  setSimulatorToken(tok);
                  setShowDriverSimulator(true);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
