import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  IndianRupee,
  MapPin,
  Package,
  Route,
  Search,
  ShieldCheck,
  Truck,
  Weight
} from 'lucide-react';
import { logisticsStore } from '../../services/store';
import {
  applyClientSeo,
  buildClientFreightDirectoryJsonLd,
  buildClientFreightListingJsonLd,
  loadItemToPublicFreight,
  navigateSpa,
  PublicFreightItem
} from '../../utils/seo';
import { showToast } from '../shared/Toast';

interface PublicCorridorItem {
  slug: string;
  originCity: string;
  originState: string;
  destinationCity: string;
  destinationState: string;
  distanceKm: number;
  transitHours: string;
  highway: string;
  startingFareInr: number;
  popularCargo: string;
  recommendedVehicles: string[];
}

interface PublicVehicleItem {
  id: string;
  name: string;
  capacityKg: number;
  capacityTonnes: number;
  dimensions: string;
  basePricePerKm: number;
  minBasePrice: number;
  idealFor: string;
  bodyTypes: string[];
}

interface PublicRouteViewProps {
  pathname: string;
  onOpenAuth: (role: 'customer' | 'driver' | 'admin') => void;
  onSwitchToPartner: () => void;
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case 'posted':
      return 'Open for Bids';
    case 'bidding':
      return 'Receiving Quotes';
    case 'assigned':
      return 'Vehicle Assigned';
    case 'in_transit':
      return 'In Transit · Live GPS';
    case 'delivered':
    case 'completed':
      return 'Completed';
    default:
      return status.replace(/_/g, ' ');
  }
}

export const PublicRouteView: React.FC<PublicRouteViewProps> = ({
  pathname,
  onOpenAuth,
  onSwitchToPartner
}) => {
  const [listings, setListings] = useState<PublicFreightItem[]>(() =>
    logisticsStore.getLoads().map(loadItemToPublicFreight)
  );
  const [corridors, setCorridors] = useState<PublicCorridorItem[]>([]);
  const [vehicles, setVehicles] = useState<PublicVehicleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const cleanPath = (pathname || '/').replace(/\/+$/, '') || '/';
  const freightDetailMatch = cleanPath.match(/^\/freight\/([^/]+)$/);
  const corridorDetailMatch = cleanPath.match(/^\/corridors\/([^/]+)$/);
  const fleetDetailMatch = cleanPath.match(/^\/fleet\/([^/]+)$/);

  const activeLoadId = freightDetailMatch ? decodeURIComponent(freightDetailMatch[1]) : null;
  const activeCorridorSlug = corridorDetailMatch ? decodeURIComponent(corridorDetailMatch[1]).toLowerCase() : null;
  const activeVehicleId = fleetDetailMatch ? decodeURIComponent(fleetDetailMatch[1]).toLowerCase() : null;

  useEffect(() => {
    let active = true;
    const fetchCatalog = async () => {
      try {
        const res = await fetch('/api/public/freight');
        if (!res.ok) return;
        const json = await res.json();
        if (!active || !json?.success) return;

        const apiListings: PublicFreightItem[] = Array.isArray(json.listings) ? json.listings : [];
        const localListings = logisticsStore.getLoads().map(loadItemToPublicFreight);
        const merged = new Map<string, PublicFreightItem>();
        for (const l of localListings) merged.set(l.id, l);
        for (const l of apiListings) merged.set(l.id, l);
        setListings(Array.from(merged.values()));

        if (Array.isArray(json.corridors)) setCorridors(json.corridors);
        if (Array.isArray(json.vehicles)) setVehicles(json.vehicles);
      } catch {
        // Fallback silently to local store seed loads
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchCatalog();
    return () => {
      active = false;
    };
  }, [cleanPath]);

  const selectedListing = useMemo(
    () => (activeLoadId ? listings.find((l) => l.id === activeLoadId) || null : null),
    [activeLoadId, listings]
  );

  const selectedCorridor = useMemo(
    () => (activeCorridorSlug ? corridors.find((c) => c.slug === activeCorridorSlug) || null : null),
    [activeCorridorSlug, corridors]
  );

  const selectedVehicle = useMemo(
    () => (activeVehicleId ? vehicles.find((v) => v.id === activeVehicleId) || null : null),
    [activeVehicleId, vehicles]
  );

  // Sync dynamic client-side meta tags + Schema.org JSON-LD on every public route transition
  useEffect(() => {
    if (activeLoadId && selectedListing) {
      applyClientSeo({
        title: `${selectedListing.pickupCity} to ${selectedListing.deliveryCity} Load (${selectedListing.weightKg}kg) | Zuggi`,
        description: `${selectedListing.goodsCategoryLabel} freight from ${selectedListing.pickupCity} to ${selectedListing.deliveryCity} (${selectedListing.estimatedDistanceKm} km). ${selectedListing.requiredVehicleName} needed. Bid directly on Zuggi.`,
        canonicalPath: `/freight/${encodeURIComponent(selectedListing.id)}`,
        ogType: 'product',
        robots: 'index, follow',
        jsonLd: buildClientFreightListingJsonLd(selectedListing)
      });
      return;
    }

    if (cleanPath === '/freight') {
      applyClientSeo({
        title: 'Live Freight Listings & Truck Loads | Zuggi India',
        description:
          'Browse active commercial truck loads across Assam, Northeast India & Pan-India. Verified transporters bid directly with zero brokerage & escrow protection.',
        canonicalPath: '/freight',
        ogType: 'website',
        robots: 'index, follow',
        jsonLd: buildClientFreightDirectoryJsonLd(listings)
      });
      return;
    }

    if (activeCorridorSlug && selectedCorridor) {
      applyClientSeo({
        title: `${selectedCorridor.originCity} to ${selectedCorridor.destinationCity} Truck Booking | Zuggi`,
        description: `Hire verified trucks from ${selectedCorridor.originCity} to ${selectedCorridor.destinationCity} (${selectedCorridor.distanceKm} km). Starting ₹${selectedCorridor.startingFareInr.toLocaleString('en-IN')} with live GPS & GST billing.`,
        canonicalPath: `/corridors/${encodeURIComponent(selectedCorridor.slug)}`,
        ogType: 'website',
        robots: 'index, follow'
      });
      return;
    }

    if (cleanPath === '/corridors') {
      applyClientSeo({
        title: 'Assam & Northeast Freight Corridors | Zuggi',
        description:
          'Book verified trucks across 12+ high-volume Assam, Northeast India & Pan-India freight corridors including Guwahati, Dibrugarh, Jorhat, Shillong, Dimapur & Kolkata.',
        canonicalPath: '/corridors',
        ogType: 'website',
        robots: 'index, follow'
      });
      return;
    }

    if (activeVehicleId && selectedVehicle) {
      applyClientSeo({
        title: `Hire ${selectedVehicle.name} (${selectedVehicle.capacityTonnes} MT) | Zuggi`,
        description: `Book Parivahan-verified ${selectedVehicle.name} (${selectedVehicle.capacityKg.toLocaleString('en-IN')} kg capacity, ${selectedVehicle.dimensions}). Base fare ₹${selectedVehicle.basePricePerKm}/km on Zuggi.`,
        canonicalPath: `/fleet/${encodeURIComponent(selectedVehicle.id)}`,
        ogType: 'website',
        robots: 'index, follow'
      });
      return;
    }

    if (cleanPath === '/fleet') {
      applyClientSeo({
        title: '5,000+ Verified Trucks & Commercial Fleet | Zuggi',
        description:
          'Explore 5,000+ Parivahan-verified pickups, Tata Ace, Bolero, Eicher 14ft/17ft, 20ft trucks, 32ft containers & reefer vehicles ready for dispatch on Zuggi.',
        canonicalPath: '/fleet',
        ogType: 'website',
        robots: 'index, follow'
      });
    }
  }, [activeLoadId, selectedListing, activeCorridorSlug, selectedCorridor, activeVehicleId, selectedVehicle, cleanPath, listings]);

  const handleCopyLink = (path: string) => {
    const fullUrl = `${window.location.origin}${path}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(fullUrl).then(() => {
        showToast('Shareable freight link copied to clipboard', 'success');
      });
    }
  };

  const filteredListings = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter(
      (l) =>
        l.pickupCity.toLowerCase().includes(q) ||
        l.deliveryCity.toLowerCase().includes(q) ||
        l.goodsCategoryLabel.toLowerCase().includes(q) ||
        l.goodsDescription.toLowerCase().includes(q) ||
        l.requiredVehicleName.toLowerCase().includes(q)
    );
  }, [listings, searchTerm]);

  // --- VIEW 1: INDIVIDUAL FREIGHT LISTING (/freight/:loadId) ---
  if (activeLoadId) {
    if (!selectedListing && !loading) {
      return (
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
          <button
            type="button"
            onClick={() => navigateSpa('/freight')}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#77717A] hover:text-[#171318] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Live Freight Listings
          </button>
          <div className="bg-white rounded-3xl border border-gray-200 p-8 text-center space-y-4 shadow-sm">
            <Package className="w-10 h-10 text-[#E83E83] mx-auto" />
            <h1 className="text-2xl font-black text-[#171318]">Freight Listing Completed or Unavailable</h1>
            <p className="text-sm text-[#77717A] max-w-md mx-auto">
              Listing <span className="font-mono font-bold text-[#171318]">{activeLoadId}</span> is no longer open for bidding. Explore other active commercial loads across Assam &amp; India.
            </p>
            <button
              type="button"
              onClick={() => navigateSpa('/freight')}
              className="px-6 py-3 rounded-xl bg-[#E83E83] text-white text-sm font-bold hover:bg-[#D12E70] transition cursor-pointer"
            >
              Browse Active Freight Loads
            </button>
          </div>
        </div>
      );
    }

    if (!selectedListing) {
      return (
        <div className="max-w-4xl mx-auto px-4 py-16 text-center text-sm text-[#77717A]">
          Loading freight listing details...
        </div>
      );
    }

    const isOpen = selectedListing.status === 'posted' || selectedListing.status === 'bidding';
    const relatedListings = listings.filter((l) => l.id !== selectedListing.id).slice(0, 3);

    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-[#77717A]">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigateSpa('/');
              }}
              className="hover:text-[#171318]"
            >
              Home
            </a>
            <span>/</span>
            <a
              href="/freight"
              onClick={(e) => {
                e.preventDefault();
                navigateSpa('/freight');
              }}
              className="hover:text-[#171318]"
            >
              Live Freight
            </a>
            <span>/</span>
            <span className="text-[#171318] font-bold">
              {selectedListing.pickupCity} → {selectedListing.deliveryCity}
            </span>
          </nav>

          <button
            type="button"
            onClick={() => handleCopyLink(`/freight/${encodeURIComponent(selectedListing.id)}`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-[#171318] hover:border-[#E83E83] transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-[#E83E83]" /> Copy Listing URL
          </button>
        </div>

        <article className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-[#171318] text-white p-6 sm:p-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  isOpen ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> {formatStatusLabel(selectedListing.status)}
              </span>
              <span className="font-mono text-xs text-gray-400">Listing ID: {selectedListing.id}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {selectedListing.pickupCity}, {selectedListing.pickupState} → {selectedListing.deliveryCity},{' '}
              {selectedListing.deliveryState}
            </h1>
            <p className="text-sm sm:text-base text-gray-300 max-w-3xl">{selectedListing.goodsDescription}</p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-[#F8F6F8] border border-gray-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#77717A] flex items-center gap-1">
                  <Weight className="w-3.5 h-3.5 text-[#E83E83]" /> Cargo Weight
                </p>
                <p className="text-lg font-black text-[#171318] mt-1">
                  {selectedListing.weightKg.toLocaleString('en-IN')} kg
                </p>
                <p className="text-xs text-[#77717A]">{(selectedListing.weightKg / 1000).toFixed(1)} Metric Tonnes</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8F6F8] border border-gray-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#77717A] flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-[#E83E83]" /> Truck Required
                </p>
                <p className="text-base font-black text-[#171318] mt-1 leading-snug">
                  {selectedListing.requiredVehicleName}
                </p>
                <p className="text-xs text-[#77717A] capitalize">
                  {(selectedListing.requiredBodyType || 'open').replace(/_/g, ' ')}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8F6F8] border border-gray-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#77717A] flex items-center gap-1">
                  <Route className="w-3.5 h-3.5 text-[#E83E83]" /> Route Distance
                </p>
                <p className="text-lg font-black text-[#171318] mt-1">{selectedListing.estimatedDistanceKm} km</p>
                <p className="text-xs text-[#77717A]">
                  Est. {selectedListing.estimatedDurationHours || Math.max(2, Math.round(selectedListing.estimatedDistanceKm / 42))} hrs highway transit
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#FFF0F6] border border-[#E83E83]/20">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#E83E83] flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5" /> Target Freight
                </p>
                <p className="text-lg font-black text-[#171318] mt-1">
                  {selectedListing.targetBudgetInr > 0
                    ? `₹${selectedListing.targetBudgetInr.toLocaleString('en-IN')}`
                    : 'Open Quotes'}
                </p>
                <p className="text-xs text-[#77717A]">0% Brokerage · Escrow</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-gray-200 space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> Pickup Hub
                </p>
                <p className="text-base font-extrabold text-[#171318]">
                  {selectedListing.pickupCity}, {selectedListing.pickupState}
                </p>
                <p className="text-xs text-[#77717A]">
                  District: {selectedListing.pickupDistrict || selectedListing.pickupCity}
                  {selectedListing.pickupPincode ? ` · PIN ${selectedListing.pickupPincode}` : ''}
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-gray-200 space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#E83E83] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> Delivery Hub
                </p>
                <p className="text-base font-extrabold text-[#171318]">
                  {selectedListing.deliveryCity}, {selectedListing.deliveryState}
                </p>
                <p className="text-xs text-[#77717A]">
                  District: {selectedListing.deliveryDistrict || selectedListing.deliveryCity}
                  {selectedListing.deliveryPincode ? ` · PIN ${selectedListing.deliveryPincode}` : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                <strong>Verified Commercial Consignment:</strong> Protected by Zuggi two-stage escrow (90% pickup advance, 10% after verified e-POD), GST invoicing, and live GPS tracking. Shipper contact details unlock immediately upon bid acceptance.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onSwitchToPartner}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#E83E83] text-white text-sm font-extrabold hover:bg-[#D12E70] transition shadow-sm cursor-pointer"
              >
                <Truck className="w-4 h-4" /> Submit Transporter Quote <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('customer')}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#171318] text-white text-sm font-extrabold hover:bg-black transition cursor-pointer"
              >
                Book a Truck for Similar Load
              </button>
            </div>
          </div>
        </article>

        {relatedListings.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-black text-[#171318]">More Active Freight Listings</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {relatedListings.map((item) => (
                <a
                  key={item.id}
                  href={`/freight/${encodeURIComponent(item.id)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateSpa(`/freight/${encodeURIComponent(item.id)}`);
                  }}
                  className="block bg-white rounded-2xl border border-gray-200 p-5 hover:border-[#E83E83] transition shadow-sm space-y-2"
                >
                  <p className="text-xs font-bold text-[#E83E83] uppercase">{formatStatusLabel(item.status)}</p>
                  <h3 className="text-sm font-extrabold text-[#171318]">
                    {item.pickupCity} → {item.deliveryCity}
                  </h3>
                  <p className="text-xs text-[#77717A] line-clamp-2">{item.goodsDescription}</p>
                  <div className="flex items-center justify-between pt-2 text-xs font-bold text-[#171318]">
                    <span>{item.weightKg.toLocaleString('en-IN')} kg</span>
                    <span>{item.targetBudgetInr > 0 ? `₹${item.targetBudgetInr.toLocaleString('en-IN')}` : 'Open Bids'}</span>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // --- VIEW 2: LIVE FREIGHT EXCHANGE DIRECTORY (/freight) ---
  if (cleanPath === '/freight') {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => navigateSpa('/')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#77717A] hover:text-[#171318] cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Zuggi Home
            </button>
            <h1 className="text-2xl sm:text-4xl font-black text-[#171318] tracking-tight">
              Live Commercial Freight Listings
            </h1>
            <p className="text-sm text-[#77717A] max-w-2xl">
              Direct commercial freight bookings across Assam, Northeast India, and Pan-India corridors. Inspect specs and bid directly with 0% brokerage.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => onOpenAuth('customer')}
              className="px-5 py-2.5 rounded-xl bg-[#E83E83] text-white text-xs sm:text-sm font-extrabold hover:bg-[#D12E70] transition cursor-pointer"
            >
              Book a Truck
            </button>
            <button
              type="button"
              onClick={onSwitchToPartner}
              className="px-5 py-2.5 rounded-xl bg-[#171318] text-white text-xs sm:text-sm font-extrabold hover:bg-black transition cursor-pointer"
            >
              Driver / Fleet Sign In
            </button>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-[#77717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by city, cargo, or truck type (e.g. Guwahati, Tea, Eicher)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:outline-none focus:border-[#E83E83]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredListings.map((item) => {
            const isOpen = item.status === 'posted' || item.status === 'bidding';
            return (
              <article
                key={item.id}
                className="bg-white rounded-3xl border border-gray-200 p-5 flex flex-col justify-between gap-4 hover:border-[#E83E83] transition shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        isOpen ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {formatStatusLabel(item.status)}
                    </span>
                    <span className="text-[11px] font-mono text-[#77717A]">{item.estimatedDistanceKm} km</span>
                  </div>

                  <div>
                    <h2 className="text-lg font-black text-[#171318]">
                      {item.pickupCity} → {item.deliveryCity}
                    </h2>
                    <p className="text-xs text-[#77717A]">
                      {item.pickupState} to {item.deliveryState} · {item.goodsCategoryLabel}
                    </p>
                  </div>

                  <p className="text-xs text-[#4b454e] line-clamp-2">{item.goodsDescription}</p>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#F8F6F8]">
                      <span className="block text-[10px] uppercase font-bold text-[#77717A]">Weight</span>
                      <span className="font-extrabold text-[#171318]">{item.weightKg.toLocaleString('en-IN')} kg</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#F8F6F8]">
                      <span className="block text-[10px] uppercase font-bold text-[#77717A]">Est. Budget</span>
                      <span className="font-extrabold text-[#E83E83]">
                        {item.targetBudgetInr > 0 ? `₹${item.targetBudgetInr.toLocaleString('en-IN')}` : 'Open Quotes'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#77717A] truncate">{item.requiredVehicleName}</span>
                  <a
                    href={`/freight/${encodeURIComponent(item.id)}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigateSpa(`/freight/${encodeURIComponent(item.id)}`);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-extrabold text-[#E83E83] hover:underline shrink-0"
                  >
                    View Load <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  // --- VIEW 3: CORRIDOR DETAIL OR INDEX (/corridors & /corridors/:slug) ---
  if (cleanPath === '/corridors' || activeCorridorSlug) {
    if (activeCorridorSlug && selectedCorridor) {
      const corridorLoads = listings.filter(
        (l) =>
          l.pickupCity.toLowerCase() === selectedCorridor.originCity.toLowerCase() ||
          l.deliveryCity.toLowerCase() === selectedCorridor.destinationCity.toLowerCase()
      );
      return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
          <button
            type="button"
            onClick={() => navigateSpa('/corridors')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#77717A] hover:text-[#171318] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> All Freight Corridors
          </button>

          <section className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[#E83E83]">Daily Commercial Route</p>
              <h1 className="text-2xl sm:text-4xl font-black text-[#171318]">
                {selectedCorridor.originCity} to {selectedCorridor.destinationCity} Truck Booking
              </h1>
              <p className="text-sm text-[#77717A]">
                {selectedCorridor.originCity}, {selectedCorridor.originState} → {selectedCorridor.destinationCity},{' '}
                {selectedCorridor.destinationState} via {selectedCorridor.highway}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-[#F8F6F8]">
                <p className="text-xs font-bold text-[#77717A]">Highway Distance</p>
                <p className="text-2xl font-black text-[#171318] mt-1">{selectedCorridor.distanceKm} km</p>
              </div>
              <div className="p-4 rounded-2xl bg-[#F8F6F8]">
                <p className="text-xs font-bold text-[#77717A]">Typical Transit</p>
                <p className="text-2xl font-black text-[#171318] mt-1 flex items-center gap-1.5">
                  <Clock className="w-5 h-5 text-[#E83E83]" /> {selectedCorridor.transitHours}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-[#FFF0F6]">
                <p className="text-xs font-bold text-[#E83E83]">Indicative Starting Fare</p>
                <p className="text-2xl font-black text-[#171318] mt-1">
                  ₹{selectedCorridor.startingFareInr.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-[#4b454e]">
              <p>
                <strong className="text-[#171318]">Popular Cargo:</strong> {selectedCorridor.popularCargo}
              </p>
              <p>
                <strong className="text-[#171318]">Recommended Trucks:</strong>{' '}
                {selectedCorridor.recommendedVehicles.join(' · ')}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onOpenAuth('customer')}
                className="px-6 py-3 rounded-xl bg-[#E83E83] text-white text-sm font-extrabold hover:bg-[#D12E70] transition cursor-pointer"
              >
                Book Truck on This Route
              </button>
              <button
                type="button"
                onClick={() => navigateSpa('/freight')}
                className="px-6 py-3 rounded-xl bg-[#171318] text-white text-sm font-extrabold hover:bg-black transition cursor-pointer"
              >
                Explore Active Loads ({corridorLoads.length || listings.length})
              </button>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => navigateSpa('/')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#77717A] hover:text-[#171318] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Zuggi Home
          </button>
          <h1 className="text-2xl sm:text-4xl font-black text-[#171318]">Assam, Northeast &amp; Pan-India Freight Corridors</h1>
          <p className="text-sm text-[#77717A] max-w-2xl">
            Daily Parivahan-verified trucks with GPS tracking and transparent rates across 12+ primary commercial routes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {corridors.map((c) => (
            <a
              key={c.slug}
              href={`/corridors/${c.slug}`}
              onClick={(e) => {
                e.preventDefault();
                navigateSpa(`/corridors/${c.slug}`);
              }}
              className="block bg-white rounded-2xl border border-gray-200 p-5 hover:border-[#E83E83] transition shadow-sm space-y-2"
            >
              <div className="flex items-center justify-between text-xs font-bold text-[#E83E83]">
                <span>{c.distanceKm} km</span>
                <span>{c.transitHours}</span>
              </div>
              <h2 className="text-lg font-black text-[#171318]">
                {c.originCity} → {c.destinationCity}
              </h2>
              <p className="text-xs text-[#77717A]">{c.highway}</p>
              <p className="text-xs font-extrabold text-[#171318] pt-1">
                From ₹{c.startingFareInr.toLocaleString('en-IN')} · Direct Quotes →
              </p>
            </a>
          ))}
        </div>
      </div>
    );
  }

  // --- VIEW 4: FLEET CATEGORY DETAIL OR INDEX (/fleet & /fleet/:categoryId) ---
  if (activeVehicleId && selectedVehicle) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <button
          type="button"
          onClick={() => navigateSpa('/fleet')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#77717A] hover:text-[#171318] cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> All Commercial Vehicle Categories
        </button>

        <section className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#E83E83]">5,000+ Parivahan-Verified Fleet</p>
            <h1 className="text-2xl sm:text-4xl font-black text-[#171318]">
              Hire {selectedVehicle.name} ({selectedVehicle.capacityTonnes} MT)
            </h1>
            <p className="text-sm text-[#77717A]">{selectedVehicle.idealFor}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[#F8F6F8]">
              <p className="text-xs font-bold text-[#77717A]">Payload Capacity</p>
              <p className="text-xl font-black text-[#171318] mt-1">{selectedVehicle.capacityKg.toLocaleString('en-IN')} kg</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#F8F6F8]">
              <p className="text-xs font-bold text-[#77717A]">Deck Dimensions</p>
              <p className="text-base font-black text-[#171318] mt-1">{selectedVehicle.dimensions}</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#F8F6F8]">
              <p className="text-xs font-bold text-[#77717A]">Base Rate</p>
              <p className="text-xl font-black text-[#E83E83] mt-1">₹{selectedVehicle.basePricePerKm}/km</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#F8F6F8]">
              <p className="text-xs font-bold text-[#77717A]">Min. Trip Fare</p>
              <p className="text-xl font-black text-[#171318] mt-1">₹{selectedVehicle.minBasePrice.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onOpenAuth('customer')}
              className="px-6 py-3 rounded-xl bg-[#E83E83] text-white text-sm font-extrabold hover:bg-[#D12E70] transition cursor-pointer"
            >
              Book {selectedVehicle.name} Now
            </button>
            <button
              type="button"
              onClick={onSwitchToPartner}
              className="px-6 py-3 rounded-xl bg-[#171318] text-white text-sm font-extrabold hover:bg-black transition cursor-pointer"
            >
              Attach Your {selectedVehicle.name}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => navigateSpa('/')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#77717A] hover:text-[#171318] cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Zuggi Home
        </button>
        <h1 className="text-2xl sm:text-4xl font-black text-[#171318]">5,000+ Verified Commercial Vehicle Fleet</h1>
        <p className="text-sm text-[#77717A] max-w-2xl">
          Choose from 10 commercial vehicle tiers ranging from 500 kg mini loaders to 15 MT 32ft multi-axle containers and cold-chain reefers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.map((v) => (
          <a
            key={v.id}
            href={`/fleet/${v.id}`}
            onClick={(e) => {
              e.preventDefault();
              navigateSpa(`/fleet/${v.id}`);
            }}
            className="block bg-white rounded-2xl border border-gray-200 p-5 hover:border-[#E83E83] transition shadow-sm space-y-2"
          >
            <div className="flex items-center justify-between text-xs font-bold text-[#E83E83]">
              <span>{v.capacityTonnes} MT ({v.capacityKg.toLocaleString('en-IN')} kg)</span>
              <span>₹{v.basePricePerKm}/km</span>
            </div>
            <h2 className="text-lg font-black text-[#171318]">{v.name}</h2>
            <p className="text-xs text-[#77717A]">{v.dimensions} · {v.bodyTypes.join(', ')}</p>
            <p className="text-xs text-[#4b454e] line-clamp-2">{v.idealFor}</p>
          </a>
        ))}
      </div>
    </div>
  );
};
