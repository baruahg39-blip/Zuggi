import React from 'react';
import {
  Truck,
  Building2,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Smartphone,
  Navigation,
  FileCheck2,
  CreditCard,
  Download,
  ExternalLink
} from 'lucide-react';
import { AppPortalMode } from '../../utils/portalMode';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface LandingPageProps {
  portalMode?: AppPortalMode;
  onOpenAuth: (role: 'customer' | 'driver' | 'admin') => void;
  onOpenInstall?: () => void;
  onSwitchPortal?: (mode: AppPortalMode) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  portalMode = 'web',
  onOpenAuth,
  onOpenInstall,
  onSwitchPortal
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // ==========================================================
  // PARTNER MOBILE APP ENTRY (/partner) — DRIVER & FLEET ONLY
  // ==========================================================
  if (portalMode === 'partner') {
    return (
      <div className="w-full max-w-md mx-auto space-y-5 py-4 sm:py-8 px-2">
        <div className="bg-[#171318] text-white rounded-3xl p-6 shadow-2xl border border-gray-800 space-y-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E83E83]/20 border border-[#E83E83]/40 text-[#FF85B7] text-[10px] font-black uppercase tracking-wider">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Driver & Fleet Partner App</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              Mobile Edition
            </span>
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
              <span>Browse verified loads across Assam & Northeast highways</span>
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
  // MAIN WEBSITE ENTRY (/) — SHIPPER & ADMIN WEB PORTAL ONLY
  // ==========================================================
  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 py-4 sm:py-8 px-2 sm:px-4">
      {/* Hero Welcome Banner */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFF0F6] border border-[#E83E83]/30 text-[#E83E83] text-xs font-extrabold shadow-xs">
          <Building2 className="w-4 h-4 text-[#E83E83]" />
          <span>Shipper & Platform Governance Web Portal</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#171318] tracking-tight leading-tight">
          Commercial Transport & <br className="hidden sm:inline" />
          <span className="text-[#E83E83]">Goods Freight Exchange</span>
        </h1>

        <p className="text-sm sm:text-base text-[#77717A] max-w-2xl mx-auto leading-relaxed">
          Post freight loads across Assam and Northeast India, compare competitive transporter quotes, pay securely in escrow, and track dispatched trucks live from your browser.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs font-semibold text-[#171318]">
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Zero Brokerage Fees</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Parivahan VAHAN & SARATHI Verified</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-xs">
            <Smartphone className="w-4 h-4 text-[#E83E83]" />
            <span>Instant SIM SMS OTP</span>
          </div>
        </div>
      </div>

      {/* Main Web Portal Cards: Customer/Shipper & Admin Only */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Card 1: Customer / Shipper */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-blue-500/40 hover:border-blue-600 shadow-md hover:shadow-xl transition-all duration-200 flex flex-col justify-between group relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider py-1 px-3 rounded-bl-xl shadow-xs">
            Shipper Web
          </div>

          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-inner">
              <Building2 className="w-7 h-7 text-blue-600" />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                  Consignor & Business Portal
                </span>
              </div>
              <h3 className="text-xl font-black text-[#171318] mt-2 group-hover:text-blue-600 transition">
                Customer / Shipper
              </h3>
              <p className="text-xs text-[#77717A] mt-2 leading-relaxed">
                Post full-truck or part-load consignments, receive competitive quotes from verified fleet partners, track live GPS routes, and download GST tax invoices.
              </p>
            </div>

            <ul className="space-y-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                <span>Post loads in 30 seconds</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                <span>Compare fleet bids & instant booking</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                <span>Real-time live truck GPS tracking</span>
              </li>
            </ul>
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={() => onOpenAuth('customer')}
              className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-blue-600/25"
            >
              <span>Sign In as Shipper</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Card 2: Platform Admin Console */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-gray-200 hover:border-gray-900 shadow-md hover:shadow-xl transition-all duration-200 flex flex-col justify-between group">
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shadow-inner">
              <ShieldAlert className="w-7 h-7 text-purple-600" />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full">
                  Owner Governance
                </span>
                <span className="text-[11px] text-gray-400 font-mono">Restricted</span>
              </div>
              <h3 className="text-xl font-black text-[#171318] mt-2 group-hover:text-purple-700 transition">
                Admin Console
              </h3>
              <p className="text-xs text-[#77717A] mt-2 leading-relaxed">
                Centralized platform governance, transporter KYC verification, active corridor telemetry, escrow payouts, analytics, and 24/7 operator support desk.
              </p>
            </div>

            <ul className="space-y-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-600"></div>
                <span>KYC, RC, DL & Permit Verification</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-600"></div>
                <span>Turnaround, Route Volume & Fleet Charts</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-600"></div>
                <span>Escrow Easy-Split reconciliation</span>
              </li>
            </ul>
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={() => onOpenAuth('admin')}
              className="w-full py-3.5 px-4 rounded-2xl bg-gray-900 hover:bg-black active:scale-98 text-white font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-gray-900/20"
            >
              <span>Admin Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Dedicated Driver & Fleet Owner Mobile App Callout Banner */}
      <div className="max-w-4xl mx-auto bg-[#171318] text-white rounded-3xl p-5 sm:p-6 border border-gray-800 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#E83E83] flex items-center justify-center shrink-0 shadow-md shadow-[#E83E83]/30">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-white">Are you a Driver or Fleet Owner?</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#E83E83]/20 text-[#FF85B7] border border-[#E83E83]/40">
                Mobile Partner App
              </span>
            </div>
            <p className="text-xs text-gray-300 mt-1">
              Drivers & fleet owners use the dedicated Zuggi Partner App to bid on loads, dispatch trucks, and transmit live GPS.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
          {onOpenInstall && (
            <button
              type="button"
              onClick={onOpenInstall}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#FF85B7]" />
              <span>Install App / QR</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onSwitchPortal?.('partner')}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-[#E83E83]/30"
          >
            <span>Open Partner App</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Corridor & Trust Features Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6 text-left">
        <div className="space-y-2">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-[#E83E83] flex items-center justify-center font-bold">
            <Navigation className="w-5 h-5 text-[#E83E83]" />
          </div>
          <h4 className="text-sm font-extrabold text-[#171318]">NH-27 & NH-37 Corridors</h4>
          <p className="text-xs text-[#77717A] leading-relaxed">
            Daily freight connectivity spanning Guwahati, Jorhat, Dibrugarh, Nagaon, Silchar, and Dimapur.
          </p>
        </div>

        <div className="space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <FileCheck2 className="w-5 h-5 text-emerald-600" />
          </div>
          <h4 className="text-sm font-extrabold text-[#171318]">Commercial Fleet Verification</h4>
          <p className="text-xs text-[#77717A] leading-relaxed">
            Every vehicle is verified for fitness, commercial permit, RC, and driver commercial license.
          </p>
        </div>

        <div className="space-y-2">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <CreditCard className="w-5 h-5 text-blue-600" />
          </div>
          <h4 className="text-sm font-extrabold text-[#171318]">Escrow Easy-Split Payments</h4>
          <p className="text-xs text-[#77717A] leading-relaxed">
            Shipper payments held in secure escrow and released immediately upon verified electronic POD.
          </p>
        </div>

        <div className="space-y-2">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Smartphone className="w-5 h-5 text-amber-600" />
          </div>
          <h4 className="text-sm font-extrabold text-[#171318]">Dedicated Driver Mobile App</h4>
          <p className="text-xs text-[#77717A] leading-relaxed">
            Separate Play Store-ready mobile app for drivers & fleet partners with offline highway GPS buffering.
          </p>
        </div>
      </div>

      <div className="text-center pt-2">
        <p className="text-xs text-[#77717A]">
          Closing or cancelling the sign-in modal keeps you securely on this signed-out page without altering your session.
        </p>
      </div>
    </div>
  );
};
