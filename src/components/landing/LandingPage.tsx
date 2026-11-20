import React, { useState } from 'react';
import {
  Truck,
  Building2,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  Smartphone,
  Download,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { AppPortalMode } from '../../utils/portalMode';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import highwayFleetImg from '../../assets/images/zuggi_highway_fleet_1795160250051.jpg';
import operationsHubImg from '../../assets/images/zuggi_operations_hub_1795160248893.jpg';

interface LandingPageProps {
  portalMode?: AppPortalMode;
  onOpenAuth: (role: 'customer' | 'driver' | 'admin') => void;
  onOpenInstall?: () => void;
  onSwitchPortal?: (mode: AppPortalMode) => void;
}

const FLEET_STATS = [
  {
    value: '5,000+',
    label: 'Verified Commercial Vehicles',
    detail: 'Pickups, 14ft–32ft containers & multi-axle trucks'
  },
  {
    value: '180+',
    label: 'Cities & Industrial Hubs',
    detail: 'Assam, Northeast corridors & pan-India routes'
  },
  {
    value: '24/7',
    label: 'Live GPS & Geofence Desk',
    detail: 'Real-time vehicle tracking & automated alerts'
  },
  {
    value: '0%',
    label: 'Hidden Brokerage',
    detail: 'Direct transporter quotes with escrow protection'
  }
];

const ABOUT_PILLARS = [
  {
    number: '01.',
    title: 'Over 5,000 Verified Commercial Vehicles',
    description:
      'Every truck, container, and pickup working with Zuggi goes through Parivahan RC, fitness certificate, commercial permit, and driver license checks before taking loads.'
  },
  {
    number: '02.',
    title: 'Direct Fleet Pricing Without Middlemen',
    description:
      'Shippers post consignments in under a minute and compare transparent quotes directly from verified fleet owners and drivers.'
  },
  {
    number: '03.',
    title: 'Live Highway GPS & Geofence Alerts',
    description:
      'Track every active truck on live maps with automated pickup entry, departure, and delivery arrival notifications along NH-27, NH-37, and interstate highways.'
  },
  {
    number: '04.',
    title: 'Escrow Protection & GST Documentation',
    description:
      'Two-stage escrow settlements (90% pickup advance, 10% after verified electronic POD), GST-ready invoices, and e-Way bill compliance built in.'
  }
];

const VEHICLE_FLEET_TIERS = [
  {
    name: 'Mini Trucks & Pickups',
    capacity: '0.75 – 1.7 MT',
    examples: 'Tata Ace, Mahindra Bolero Pickup, Intra V30',
    useCase: 'City distribution, agro produce, retail & hardware'
  },
  {
    name: 'Light Commercial Vehicles (14ft – 17ft)',
    capacity: '3 – 6 MT',
    examples: 'Eicher Pro 2049, Tata 407, Ashok Leyland Dost+',
    useCase: 'Inter-district wholesale, FMCG, tea gardens & plywood'
  },
  {
    name: 'Heavy Trucks & Containers (20ft – 32ft)',
    capacity: '7 – 18 MT',
    examples: 'Tata 1615, BharatBenz 1917R, 32ft SXL/MXL',
    useCase: 'Factory dispatches, construction steel, cement & warehousing'
  },
  {
    name: 'Multi-Axle Trailers & Bulk Carriers',
    capacity: '20 – 35 MT',
    examples: '40ft High-Bed / Flatbed Trailers, 12-Wheeler & 14-Wheeler',
    useCase: 'Heavy industrial machinery, infrastructure & long-haul freight'
  }
];

const CORRIDORS = [
  'Guwahati',
  'Jorhat',
  'Dibrugarh',
  'Silchar',
  'Nagaon',
  'Tezpur',
  'Tinsukia',
  'Dimapur',
  'Shillong',
  'Agartala',
  'Siliguri',
  'Kolkata'
];

export const LandingPage: React.FC<LandingPageProps> = ({
  portalMode = 'web',
  onOpenAuth,
  onOpenInstall,
  onSwitchPortal
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Image fallback flags (Zero-Broken-Image Policy)
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [hubImgFailed, setHubImgFailed] = useState(false);

  // Reach Out / Contact Form State
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactTopic, setContactTopic] = useState('Book a Commercial Vehicle');
  const [contactMessage, setContactMessage] = useState('');
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccessRef, setContactSuccessRef] = useState<string | null>(null);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);

    const trimmedName = contactName.trim();
    const digitsPhone = contactPhone.replace(/\D/g, '');
    const trimmedMessage = contactMessage.trim();

    if (trimmedName.length < 2) {
      setContactError('Please enter your full name.');
      return;
    }
    if (digitsPhone.length < 10) {
      setContactError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      setContactError('Please enter a valid email address or leave it blank.');
      return;
    }
    if (trimmedMessage.length < 5) {
      setContactError('Please write a brief message so our team can assist you.');
      return;
    }

    setIsSubmittingContact(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          phone: contactPhone.trim(),
          email: contactEmail.trim(),
          topic: contactTopic,
          message: trimmedMessage
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to submit your inquiry right now. Please try again.');
      }

      setContactSuccessRef(data.referenceId || `ZUG-INQ-${Date.now().toString().slice(-6)}`);
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setContactMessage('');
    } catch (err: any) {
      setContactError(err?.message || 'Unable to send inquiry. Please call us directly on +91 96789 44132.');
    } finally {
      setIsSubmittingContact(false);
    }
  };

  // ==========================================================
  // PARTNER MOBILE APP ENTRY (/partner) — DRIVER & FLEET ONLY
  // ==========================================================
  if (portalMode === 'partner') {
    return (
      <div className="w-full max-w-md mx-auto space-y-5 py-4 sm:py-8 px-2">
        <div className="bg-[#171318] text-white rounded-3xl p-6 shadow-2xl border border-gray-800 space-y-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-semibold text-[#FF85B7]">Driver & Fleet Partner App</span>
            <span className="font-mono text-emerald-400">Mobile Edition</span>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-[#E83E83] flex items-center justify-center shadow-lg shadow-[#E83E83]/30 shrink-0">
              <Truck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Zuggi Partner</h1>
              <p className="text-xs text-gray-300 mt-0.5 leading-snug">
                Direct Loads, Fleet Dispatch & Fast Payouts for Commercial Drivers & Truck Owners
              </p>
            </div>
          </div>

          <ul className="space-y-2.5 pt-2 border-t border-gray-800 text-xs text-gray-200">
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Join 5,000+ verified commercial vehicles operating on Zuggi</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Dispatch trucks from your fleet & share live GPS trip links</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>90% pickup advance + 10% delivery payout directly to bank</span>
            </li>
          </ul>

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={() => onOpenAuth('driver')}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#E83E83] hover:bg-[#d62e73] active:scale-98 text-white font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-[#E83E83]/30"
            >
              <span>Driver / Fleet Owner Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {!isInstalled && (
              <button
                type="button"
                onClick={() => (isInstallable ? void install() : onOpenInstall?.())}
                className="w-full py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#FF85B7]" />
                <span>{isInstallable ? 'Install Partner App on Android' : 'How to Install App / Get APK Guide'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs flex items-center justify-between gap-3">
          <div className="text-xs">
            <p className="font-bold text-[#171318]">Booking a truck to ship goods?</p>
            <p className="text-[11px] text-[#77717A]">Shippers & Admins sign in on the Web Portal.</p>
          </div>
          <button
            type="button"
            onClick={() => onSwitchPortal?.('web')}
            className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#171318] text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1"
          >
            <span>Web Portal</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  // ==========================================================
  // MAIN WEBSITE (zuggi.in) — SHIPPER & ADMIN WEB PORTAL
  // ==========================================================
  return (
    <div id="top" className="w-full">
      <div className="w-full max-w-6xl mx-auto space-y-16 sm:space-y-20 py-6 sm:py-12 px-3 sm:px-6">
        {/* 1. HERO & PORTAL ENTRY */}
        <section className="space-y-10">
          <div className="text-center space-y-5 max-w-3xl mx-auto">
            <p className="text-xs sm:text-sm font-semibold text-[#E83E83] tracking-tight">
              Zuggi Commercial Freight Network · Assam, Northeast & Pan-India
            </p>

            <h1
              className="font-black text-[#171318] tracking-tight leading-[1.1] text-balance"
              style={{ fontSize: 'clamp(2.1rem, 4.2vw, 3.5rem)' }}
            >
              Book Verified Commercial Trucks{' '}
              <span className="text-[#E83E83]">Across 5,000+ Active Vehicles</span>
            </h1>

            <p className="text-sm sm:text-base text-[#5E5861] max-w-2xl mx-auto leading-relaxed">
              Post full-truck or part-load shipments, compare direct quotes from Parivahan-verified fleet owners, pay securely through escrow, and monitor every highway trip live from pickup to delivery.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-1 text-xs sm:text-sm font-medium text-[#5E5861]">
              <span>5,000+ Verified Vehicles</span>
              <span aria-hidden="true" className="text-gray-300">·</span>
              <span>Zero Brokerage Fees</span>
              <span aria-hidden="true" className="text-gray-300">·</span>
              <span>Parivahan VAHAN & SARATHI Verified</span>
              <span aria-hidden="true" className="text-gray-300">·</span>
              <span>24/7 Live GPS Tracking</span>
            </div>
          </div>

          {/* Primary Portal Cards: Shipper & Admin */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch">
            {/* Card 1: Customer / Shipper */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 hover:border-[#E83E83]/50 transition-colors flex flex-col justify-between shadow-sm">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFF0F6] text-[#E83E83] flex items-center justify-center">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-[#5E5861]">Consignor & Business Portal</span>
                </div>

                <div>
                  <h2 className="text-xl font-extrabold text-[#171318]">Customer / Shipper</h2>
                  <p className="text-sm text-[#5E5861] mt-2 leading-relaxed">
                    Post commercial loads in 30 seconds, compare competitive fleet quotes, track live truck GPS & geofence arrivals, and download GST invoices.
                  </p>
                </div>

                <ul className="space-y-2 pt-3 border-t border-gray-100 text-xs sm:text-sm text-[#4A454D]">
                  <li>Direct access to 5,000+ verified trucks & pickups</li>
                  <li>Transparent 90/10 escrow payment protection</li>
                  <li>Real-time live GPS route & delivery OTP verification</li>
                </ul>
              </div>

              <div className="pt-6">
                <button
                  type="button"
                  onClick={() => onOpenAuth('customer')}
                  className="w-full py-3.5 px-5 rounded-xl bg-[#E83E83] hover:bg-[#D62D72] active:scale-[0.99] text-white font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
                >
                  <span>Sign In as Shipper</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </div>

            {/* Card 2: Platform Admin Console */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 hover:border-gray-400 transition-colors flex flex-col justify-between shadow-sm">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 text-[#171318] flex items-center justify-center">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-medium text-[#77717A] font-mono">Owner Governance</span>
                </div>

                <div>
                  <h2 className="text-xl font-extrabold text-[#171318]">Admin Console</h2>
                  <p className="text-sm text-[#5E5861] mt-2 leading-relaxed">
                    Centralized dispatch governance, transporter KYC & RC approval, active highway corridor telemetry, escrow reconciliation, and 24/7 support desk.
                  </p>
                </div>

                <ul className="space-y-2 pt-3 border-t border-gray-100 text-xs sm:text-sm text-[#4A454D]">
                  <li>KYC, RC, commercial permit & DL verification</li>
                  <li>Corridor volume, fleet analytics & geofence monitoring</li>
                  <li>Escrow payout reconciliation & GST audit exports</li>
                </ul>
              </div>

              <div className="pt-6">
                <button
                  type="button"
                  onClick={() => onOpenAuth('admin')}
                  className="w-full py-3.5 px-5 rounded-xl bg-[#171318] hover:bg-black active:scale-[0.99] text-white font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
                >
                  <span>Admin Sign In</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* Dedicated Driver & Fleet Partner Strip */}
          <div className="max-w-4xl mx-auto bg-[#171318] text-white rounded-3xl p-5 sm:p-6 border border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#E83E83] flex items-center justify-center shrink-0">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Are you a Driver or Fleet Owner?</h3>
                <p className="text-xs sm:text-sm text-gray-300 mt-1">
                  Attach your truck to our 5,000+ vehicle network on the Zuggi Partner App for direct loads and fast bank payouts.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto shrink-0">
              {onOpenInstall && (
                <button
                  type="button"
                  onClick={onOpenInstall}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-[#FF85B7] shrink-0" />
                  <span>Install App</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onSwitchPortal?.('partner')}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#E83E83] hover:bg-[#D62D72] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <span>Open Partner App</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>
        </section>

        {/* 2. SCALE & FLEET NETWORK PROOF STRIP */}
        <section id="fleet-network" className="scroll-mt-24">
          <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              {FLEET_STATS.map((stat, idx) => (
                <div
                  key={stat.label}
                  className={`${idx > 0 ? 'pt-5 sm:pt-0 sm:pl-6 lg:pl-8' : ''} space-y-1.5`}
                >
                  <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#171318] font-mono tabular-nums">
                    {stat.value}
                  </div>
                  <div className="text-sm font-bold text-[#171318]">{stat.label}</div>
                  <p className="text-xs text-[#6B656E] leading-relaxed">{stat.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. KNOW ABOUT US */}
        <section id="about-us" className="scroll-mt-24 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Editorial Highway Fleet Visual */}
            <div className="lg:col-span-6 flex flex-col">
              <div className="relative flex-1 min-h-[280px] sm:min-h-[360px] rounded-3xl overflow-hidden border border-gray-200 bg-[#171318]">
                {!heroImgFailed ? (
                  <img
                    src={highwayFleetImg}
                    alt="Zuggi commercial cargo trucks operating on Northeast Indian national highways"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-white bg-gradient-to-br from-[#171318] to-[#2c1f29]">
                    <Truck className="w-12 h-12 text-[#E83E83] mb-3" />
                    <p className="text-lg font-bold">Zuggi Commercial Highway Fleet</p>
                    <p className="text-xs text-gray-300 mt-1">5,000+ Verified Vehicles Across India</p>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-5 sm:p-6">
                  <p className="text-xs font-mono text-gray-300">NH-27 & NH-37 Freight Corridors</p>
                  <p className="text-sm sm:text-base font-bold text-white mt-1">
                    Over 5,000 commercial vehicles active across Assam, Northeast India & national industrial lanes
                  </p>
                </div>
              </div>
            </div>

            {/* Company Story & Operational Commitments */}
            <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-bold text-[#E83E83]">Know About Us</p>
                <h2 className="text-2xl sm:text-3xl font-black text-[#171318] tracking-tight text-balance">
                  Built for reliable, transparent commercial freight across India
                </h2>
                <p className="text-sm sm:text-base text-[#5E5861] leading-relaxed">
                  Zuggi is a commercial goods transportation exchange headquartered in Guwahati, Assam. We bridge the gap between manufacturers, tea estates, wholesalers, construction suppliers, and independent truck owners by bringing over 5,000 verified vehicles onto one direct platform.
                </p>
                <p className="text-sm text-[#5E5861] leading-relaxed">
                  Instead of calling dozens of brokers or guessing where your cargo is, Zuggi lets you book verified vehicles at fair market rates, secure payments in escrow, and watch every kilometer on live GPS maps with automated geofence alerts.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-gray-200">
                {ABOUT_PILLARS.map((pillar) => (
                  <div key={pillar.number} className="space-y-1.5">
                    <h3 className="text-sm font-bold text-[#171318]">
                      <span className="text-[#E83E83] font-mono mr-1.5">{pillar.number}</span>
                      {pillar.title}
                    </h3>
                    <p className="text-xs text-[#6B656E] leading-relaxed">{pillar.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 4. VEHICLE TYPES & HOW IT WORKS */}
        <section id="how-it-works" className="scroll-mt-24 space-y-8">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-bold text-[#E83E83]">Our 5,000+ Vehicle Network</p>
            <h2 className="text-2xl sm:text-3xl font-black text-[#171318] tracking-tight text-balance">
              Every commercial vehicle category, ready when your cargo is
            </h2>
            <p className="text-sm text-[#5E5861] leading-relaxed">
              From local intra-city pickups to 32-foot closed containers and multi-axle highway trailers, book the exact load capacity your shipment requires.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Vehicle Fleet Tiers */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="divide-y divide-gray-100">
                {VEHICLE_FLEET_TIERS.map((tier) => (
                  <div
                    key={tier.name}
                    className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-2"
                  >
                    <div className="space-y-1">
                      <h3 className="text-sm sm:text-base font-bold text-[#171318]">{tier.name}</h3>
                      <p className="text-xs text-[#6B656E]">{tier.examples}</p>
                      <p className="text-xs text-[#5E5861]">Ideal for: {tier.useCase}</p>
                    </div>
                    <div className="text-xs sm:text-sm font-mono font-bold text-[#E83E83] whitespace-nowrap shrink-0 tabular-nums">
                      {tier.capacity}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-5 border-t border-gray-200 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenAuth('customer')}
                  className="px-5 py-3 rounded-xl bg-[#E83E83] hover:bg-[#D62D72] text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap"
                >
                  <span>Post a Load Now</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchPortal?.('partner')}
                  className="px-5 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#171318] text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap"
                >
                  Attach Your Vehicle
                </button>
              </div>
            </div>

            {/* Logistics Yard Visual & Key Cities */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              <div className="relative flex-1 min-h-[230px] rounded-3xl overflow-hidden border border-gray-200 bg-[#171318]">
                {!hubImgFailed ? (
                  <img
                    src={operationsHubImg}
                    alt="Zuggi commercial transport yard and logistics hub with pickup trucks and containers"
                    referrerPolicy="no-referrer"
                    onError={() => setHubImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white">
                    <Building2 className="w-10 h-10 text-[#E83E83] mb-2" />
                    <p className="text-sm font-bold">Zuggi Regional Freight Hubs</p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-6 space-y-3">
                <h3 className="text-sm font-bold text-[#171318]">Major Dispatch Hubs & Daily Corridors</h3>
                <p className="text-xs text-[#5E5861] leading-relaxed">
                  {CORRIDORS.join(' · ')}
                </p>
                <p className="text-xs text-[#77717A]">
                  Need dedicated monthly vehicles or inter-state contract rates? Reach out to our commercial desk below.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. REACH OUT TO US (CONTACT SECTION + REAL FORM) */}
        <section id="reach-out" className="scroll-mt-24">
          <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
              {/* Left: Direct Contact Details */}
              <div className="lg:col-span-5 space-y-6">
                <div className="space-y-2">
                  <p className="text-xs font-bold text-[#E83E83]">Reach Out to Us</p>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#171318] tracking-tight text-balance">
                    Talk to the Zuggi Freight Desk
                  </h2>
                  <p className="text-sm text-[#5E5861] leading-relaxed">
                    Whether you want to book a truck for your factory, arrange recurring business freight, or register your commercial fleet on Zuggi, our team is ready to help.
                  </p>
                </div>

                <div className="space-y-4 pt-2 text-sm">
                  <a
                    href="tel:+919678944132"
                    className="flex items-start gap-3.5 text-[#171318] hover:text-[#E83E83] transition-colors group"
                  >
                    <Phone className="w-5 h-5 text-[#E83E83] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold font-mono tabular-nums">+91 96789 44132</div>
                      <div className="text-xs text-[#6B656E]">Booking & Fleet Helpline (Call or WhatsApp)</div>
                    </div>
                  </a>

                  <a
                    href="mailto:support@zuggi.in"
                    className="flex items-start gap-3.5 text-[#171318] hover:text-[#E83E83] transition-colors"
                  >
                    <Mail className="w-5 h-5 text-[#E83E83] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">support@zuggi.in</div>
                      <div className="text-xs text-[#6B656E]">Business quotes, partnerships & grievance desk</div>
                    </div>
                  </a>

                  <div className="flex items-start gap-3.5 text-[#171318]">
                    <MapPin className="w-5 h-5 text-[#E83E83] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Guwahati Head Office</div>
                      <div className="text-xs text-[#6B656E]">
                        GS Road Commercial Corridor, Guwahati, Assam — 781005
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5 text-[#171318]">
                    <Clock className="w-5 h-5 text-[#E83E83] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">24/7 Highway Operations Support</div>
                      <div className="text-xs text-[#6B656E]">
                        Live trip monitoring & dispatch assistance all 7 days
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <a
                    href="https://wa.me/919678944132?text=Hello%20Zuggi%20Team%2C%20I%20would%20like%20to%20inquire%20about%20booking%20a%20commercial%20vehicle."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition whitespace-nowrap"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span>Chat on WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* Right: Interactive Contact / Callback Form */}
              <div className="lg:col-span-7">
                {contactSuccessRef ? (
                  <div className="h-full rounded-2xl bg-emerald-50 border border-emerald-200 p-6 sm:p-8 flex flex-col justify-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-extrabold text-[#171318]">
                        We have received your message
                      </h3>
                      <p className="text-sm text-[#4A454D] leading-relaxed">
                        Our Zuggi operations desk will call you back shortly. Your inquiry reference number is{' '}
                        <span className="font-mono font-bold text-emerald-800">{contactSuccessRef}</span>.
                      </p>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setContactSuccessRef(null)}
                        className="px-4 py-2.5 rounded-xl bg-[#171318] hover:bg-black text-white text-xs font-bold transition cursor-pointer"
                      >
                        Send Another Inquiry
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-4" noValidate>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="contact-name" className="block text-xs font-bold text-[#171318]">
                          Full Name *
                        </label>
                        <input
                          id="contact-name"
                          type="text"
                          required
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="Enter your name"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-[#171318] placeholder:text-gray-400 focus:outline-none focus:border-[#E83E83] focus:ring-2 focus:ring-[#E83E83]/20"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="contact-phone" className="block text-xs font-bold text-[#171318]">
                          Mobile Number *
                        </label>
                        <input
                          id="contact-phone"
                          type="tel"
                          required
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-[#171318] placeholder:text-gray-400 focus:outline-none focus:border-[#E83E83] focus:ring-2 focus:ring-[#E83E83]/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="contact-email" className="block text-xs font-bold text-[#171318]">
                          Email Address (Optional)
                        </label>
                        <input
                          id="contact-email"
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="name@company.com"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-[#171318] placeholder:text-gray-400 focus:outline-none focus:border-[#E83E83] focus:ring-2 focus:ring-[#E83E83]/20"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="contact-topic" className="block text-xs font-bold text-[#171318]">
                          How Can We Help?
                        </label>
                        <select
                          id="contact-topic"
                          value={contactTopic}
                          onChange={(e) => setContactTopic(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-[#171318] focus:outline-none focus:border-[#E83E83] focus:ring-2 focus:ring-[#E83E83]/20"
                        >
                          <option value="Book a Commercial Vehicle">Book a Commercial Vehicle</option>
                          <option value="Enterprise / Monthly Freight Contract">Enterprise / Monthly Freight Contract</option>
                          <option value="Attach My Truck / Fleet Partner">Attach My Truck / Fleet Partner</option>
                          <option value="Support & Tracking Help">Support & Tracking Help</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="contact-message" className="block text-xs font-bold text-[#171318]">
                        Route, Load Details or Message *
                      </label>
                      <textarea
                        id="contact-message"
                        rows={4}
                        required
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        placeholder="Example: Need a 14ft truck from Guwahati to Dibrugarh for 4 MT cargo..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-[#171318] placeholder:text-gray-400 focus:outline-none focus:border-[#E83E83] focus:ring-2 focus:ring-[#E83E83]/20 resize-y"
                      />
                    </div>

                    {contactError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{contactError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmittingContact}
                      className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#E83E83] hover:bg-[#D62D72] disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
                    >
                      <Send className="w-4 h-4 shrink-0" />
                      <span>{isSubmittingContact ? 'Sending Inquiry...' : 'Request Callback'}</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 6. QUIET PROFESSIONAL WEBSITE FOOTER */}
      <footer className="mt-12 bg-[#171318] text-gray-300 border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand Column */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#E83E83] flex items-center justify-center text-white shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <span className="text-lg font-extrabold text-white tracking-tight">Zuggi</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Commercial goods transportation marketplace connecting shippers directly with over 5,000 verified trucks, pickups, and fleet owners across India.
              </p>
            </div>

            {/* Company Links */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Company</h3>
              <ul className="space-y-2 text-xs text-gray-400">
                <li>
                  <a href="#about-us" className="hover:text-white transition-colors">
                    Know About Us
                  </a>
                </li>
                <li>
                  <a href="#fleet-network" className="hover:text-white transition-colors">
                    5,000+ Fleet Network
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-white transition-colors">
                    Vehicle Categories
                  </a>
                </li>
                <li>
                  <a href="#reach-out" className="hover:text-white transition-colors">
                    Reach Out to Us
                  </a>
                </li>
              </ul>
            </div>

            {/* Platform Portals */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Portals</h3>
              <ul className="space-y-2 text-xs text-gray-400">
                <li>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('customer')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Shipper / Customer Sign In
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onSwitchPortal?.('partner')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Zuggi Partner App (Drivers & Fleets)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('admin')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Admin Governance Console
                  </button>
                </li>
                {onOpenInstall && (
                  <li>
                    <button
                      type="button"
                      onClick={onOpenInstall}
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      Install Mobile App
                    </button>
                  </li>
                )}
              </ul>
            </div>

            {/* Contact Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Contact</h3>
              <ul className="space-y-2 text-xs text-gray-400">
                <li>
                  <a href="tel:+919678944132" className="hover:text-white transition-colors font-mono">
                    +91 96789 44132
                  </a>
                </li>
                <li>
                  <a href="mailto:support@zuggi.in" className="hover:text-white transition-colors">
                    support@zuggi.in
                  </a>
                </li>
                <li>
                  <a href="mailto:nodal.officer@zuggi.in" className="hover:text-white transition-colors">
                    nodal.officer@zuggi.in
                  </a>
                </li>
                <li>Guwahati, Assam — 781005</li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
            <p>© {new Date().getFullYear()} Zuggi Freight. All rights reserved.</p>
            <p>Parivahan Verified · Escrow Protected · GST Compliant</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
