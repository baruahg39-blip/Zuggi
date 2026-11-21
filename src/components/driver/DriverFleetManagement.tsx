import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  ArrowLeft, 
  Plus, 
  ShieldCheck, 
  AlertCircle, 
  FileText, 
  Calendar, 
  CheckCircle2, 
  X,
  Clock,
  Layers,
  Loader2
} from 'lucide-react';
import { CommercialVehicle, DocumentType, User, VehicleCategoryType, VehicleDocument } from '../../types';
import { logisticsStore } from '../../services/store';
import { DocumentUploader } from '../shared/DocumentUploader';
import { showToast } from '../shared/Toast';

interface DriverFleetManagementProps {
  currentUser: User;
  onBack: () => void;
}

export const DriverFleetManagement: React.FC<DriverFleetManagementProps> = ({
  currentUser,
  onBack
}) => {
  const [vehicles, setVehicles] = useState<CommercialVehicle[]>([]);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const vehicleCategories = logisticsStore.getVehicleCategories();

  // Add Vehicle Form State
  const [regNumber, setRegNumber] = useState('');
  const [category, setCategory] = useState<VehicleCategoryType>('bolero_pickup');
  const [bodyType, setBodyType] = useState<CommercialVehicle['bodyType']>('tarpaulin');
  const [modelName, setModelName] = useState('Mahindra Bolero Maxi Truck Plus');
  const [fuelType, setFuelType] = useState<CommercialVehicle['fuelType']>('diesel');
  const [permitType, setPermitType] = useState<CommercialVehicle['permitType']>('all_northeast');
  const [photoUrl, setPhotoUrl] = useState('https://images.unsplash.com/photo-1559297434-fae8a1916a79?auto=format&fit=crop&w=600&q=80');

  useEffect(() => {
    const update = () => {
      setVehicles(
        logisticsStore.getVehicles().filter(
          (v) =>
            v.ownerId === currentUser.id ||
            v.assignedDriverId === currentUser.id ||
            (currentUser.businessName && v.transporterName === currentUser.businessName)
        )
      );
    };
    update();
    const unsub = logisticsStore.subscribe(update);
    return unsub;
  }, [currentUser.id, currentUser.businessName]);

  const [isSaving, setIsSaving] = useState(false);

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNumber.trim() || isSaving) return;
    setIsSaving(true);
    const chosenCat = vehicleCategories.find((c) => c.id === category) || vehicleCategories[0];

    const initialDocs: VehicleDocument[] = [
      {
        id: `doc_rc_${Date.now()}`,
        type: 'rc',
        documentNumber: regNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
        documentUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
        expiryDate: '2034-05-15',
        verificationStatus: 'pending'
      },
      {
        id: `doc_ins_${Date.now()}`,
        type: 'insurance',
        documentNumber: `POL-${Date.now().toString().slice(-6)}`,
        documentUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80',
        expiryDate: '2027-06-30',
        verificationStatus: 'pending'
      },
      {
        id: `doc_fit_${Date.now()}`,
        type: 'fitness',
        documentNumber: `FIT-AS-${Date.now().toString().slice(-4)}`,
        documentUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80',
        expiryDate: '2027-12-15',
        verificationStatus: 'pending'
      }
    ];

    const newVehicle: CommercialVehicle = {
      id: `veh_${Date.now()}`,
      ownerId: currentUser.id,
      transporterName: currentUser.businessName || currentUser.name,
      registrationNumber: regNumber.trim().toUpperCase(),
      category,
      bodyType,
      capacityKg: chosenCat.capacityKg,
      modelName,
      fuelType,
      permitType,
      currentLocation: {
        lat: 26.1445,
        lng: 91.7362,
        address: 'Transport Nagar, NH-27',
        city: 'Guwahati'
      },
      isOnline: true,
      isAvailable: true,
      verificationStatus: 'pending',
      documents: initialDocs,
      driverName: currentUser.name,
      driverPhone: currentUser.phone,
      driverRating: 5.0,
      completedTrips: 0,
      photoUrl
    };

    try {
      logisticsStore.saveVehicle(newVehicle);
      showToast(`Vehicle ${newVehicle.registrationNumber} registered successfully!`, 'success');
      setShowAddVehicleModal(false);
      setRegNumber('');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Driver Desk</span>
        </button>

        <button
          onClick={() => setShowAddVehicleModal(true)}
          className="px-4 py-2 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] text-white font-bold text-xs shadow-md shadow-[#E83E83]/25 transition cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Add Commercial Vehicle</span>
        </button>
      </div>

      <div>
        <h2 className="text-lg sm:text-xl font-extrabold text-[#171318] flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#E83E83]" />
          <span>Commercial Vehicle Fleet &amp; Document Compliance</span>
        </h2>
        <p className="text-xs text-[#77717A] mt-1">
          Registered commercial vehicles, document verification status (RC, Fitness, Insurance, Permits).
        </p>
      </div>

      {vehicles.length === 0 ? (
        <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-xl">
          <Truck className="w-12 h-12 text-slate-700 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">No Commercial Vehicles Registered</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Add your commercial truck (Tata Ace, Bolero Pickup, 14ft Eicher, 22 Wheeler) and upload your RC, Fitness, and Insurance to receive load quotations.
            </p>
          </div>
          <button
            onClick={() => setShowAddVehicleModal(true)}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition cursor-pointer"
          >
            + Register Your First Commercial Vehicle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src={v.photoUrl}
                    alt={v.modelName}
                    className="w-16 h-16 rounded-xl object-cover border border-slate-700 shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm sm:text-base text-white font-mono">
                        {v.registrationNumber}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                        v.verificationStatus === 'verified'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : v.verificationStatus === 'rejected'
                          ? 'bg-rose-950 text-rose-400 border-rose-800'
                          : 'bg-amber-950/60 text-amber-400 border-amber-800/80'
                      }`}>
                        {v.verificationStatus === 'verified' ? 'Verified' : v.verificationStatus === 'rejected' ? 'Rejected' : 'Pending Verification'}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-300">{v.modelName}</div>
                    <div className="text-[11px] text-slate-400">
                      Payload: <span className="text-amber-400 font-mono font-semibold">{v.capacityKg} kg</span> • Body: {v.bodyType}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    v.isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {v.isOnline ? 'Online' : 'Offline'}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-1">
                    {v.completedTrips} Trips Done
                  </span>
                </div>
              </div>

              {/* Document Compliance Table */}
              <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Mandatory Transport Documents
                </span>

                <div className="space-y-1.5">
                  {v.documents.length === 0 ? (
                    <div className="text-[11px] text-slate-500 italic">No documents uploaded.</div>
                  ) : (
                    v.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-semibold text-slate-200 uppercase">{doc.type}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({doc.documentNumber})</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-400">Exp: {doc.expiryDate}</span>
                          <span className={`text-[10px] font-semibold flex items-center gap-1 ${
                            doc.verificationStatus === 'verified'
                              ? 'text-emerald-400'
                              : doc.verificationStatus === 'rejected'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}>
                            {doc.verificationStatus === 'verified' ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" /> Valid
                              </>
                            ) : doc.verificationStatus === 'rejected' ? (
                              'Rejected'
                            ) : (
                              'Under Review'
                            )}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            {/* Assigned Driver & Permit */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <div>
                <span>Permit: </span>
                <span className="font-semibold text-slate-200 uppercase">{v.permitType.replace('_', ' ')}</span>
              </div>
              <div>
                <span>Driver: </span>
                <span className="font-semibold text-slate-200">{v.driverName || 'Self'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Add Vehicle Modal */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <form
            onSubmit={handleAddVehicle}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl text-slate-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Register Commercial Vehicle</h3>
              <button
                type="button"
                onClick={() => setShowAddVehicleModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Registration Number (Indian RTO format)</label>
              <input
                type="text"
                required
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                placeholder="AS-01-XX-0000"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-400 uppercase"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Vehicle Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as VehicleCategoryType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
                >
                  {vehicleCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.capacityTonnes}T)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Body Configuration</label>
                <select
                  value={bodyType}
                  onChange={(e) => setBodyType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
                >
                  <option value="open">Open Body</option>
                  <option value="tarpaulin">Open with Tarpaulin</option>
                  <option value="closed_container">Closed Container</option>
                  <option value="refrigerated">Refrigerated Reefer</option>
                  <option value="flatbed">Flatbed Trailer</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Model Name</label>
                <input
                  type="text"
                  required
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="e.g. Bolero Maxi Truck Plus"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Permit Coverage</label>
                <select
                  value={permitType}
                  onChange={(e) => setPermitType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
                >
                  <option value="all_northeast">All-Northeast Commercial Permit</option>
                  <option value="state">Assam State Transport Permit</option>
                  <option value="national">National All-India Permit</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <DocumentUploader
                documentType="rc"
                title="Registration Certificate (RC)"
                description="Upload front and back scan of commercial vehicle RC."
                documentNumber={regNumber}
                onDocumentNumberChange={setRegNumber}
                status="verified"
                fileName="vehicle_rc_smartcard.pdf"
                fileSizeKb={1840}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddVehicleModal(false)}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 disabled:cursor-not-allowed text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/20"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Registering Vehicle...</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4" />
                    <span>Register & Verify Vehicle</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
