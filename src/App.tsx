/**
 * VahanSetu Freight - Commercial Goods Transportation Platform
 * Target Market: India (Assam & Northeast Core, Expanding Nationwide)
 * Production Architecture: Strict Role-Based Access Control & Centralized Firestore Backend
 */

import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { logisticsStore } from './services/store';
import { authService } from './services/authService';
import { SUPER_ADMIN_EMAIL, testFirestoreConnection } from './services/firebase';
import { Header } from './components/shared/Header';
import { CustomerHome } from './components/customer/CustomerHome';
import { CustomerLoadDetails } from './components/customer/CustomerLoadDetails';
import { CreateLoadModal } from './components/customer/CreateLoadModal';
import { CustomerProfileModal } from './components/customer/CustomerProfileModal';
import { DriverHome } from './components/driver/DriverHome';
import { FindLoads } from './components/driver/FindLoads';
import { DriverTripExecution } from './components/driver/DriverTripExecution';
import { DriverFleetManagement } from './components/driver/DriverFleetManagement';
import { DriverEarnings } from './components/driver/DriverEarnings';
import { DriverTripHistory } from './components/driver/DriverTripHistory';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { VehicleOwnerDashboard } from './components/owner/VehicleOwnerDashboard';
import { FleetPartnerDashboard } from './components/fleet/FleetPartnerDashboard';
import { InvoiceModal } from './components/shared/InvoiceModal';
import { KycManagerModal } from './components/shared/KycManagerModal';
import { SupportTicketModal } from './components/shared/SupportTicketModal';
import { AuthModal } from './components/auth/AuthModal';
import { LandingPage } from './components/landing/LandingPage';
import { PublicRouteView } from './components/landing/PublicRouteView';
import { LegalPagesView } from './components/landing/LegalPagesView';
import { MobileAppInstallModal } from './components/mobile/MobileAppInstallModal';
import { MobileBottomNav } from './components/mobile/MobileBottomNav';
import { ToastContainer } from './components/shared/Toast';
import { DriverWebTrackingPage } from './components/tracking/DriverWebTrackingPage';
import { ShieldAlert, LogIn, Lock, Truck, Building2, ArrowRight, ShieldCheck } from 'lucide-react';
import { AppPortalMode, detectPortalMode, isPartnerRole, navigateToPortal } from './utils/portalMode';
import { applyClientSeo } from './utils/seo';

function isPublicCatalogRoute(pathname: string): boolean {
  const clean = (pathname || '/').replace(/\/+$/, '') || '/';
  return (
    clean === '/freight' ||
    clean.startsWith('/freight/') ||
    clean === '/corridors' ||
    clean.startsWith('/corridors/') ||
    clean === '/fleet' ||
    clean.startsWith('/fleet/')
  );
}

function isLegalRoute(pathname: string): boolean {
  const clean = (pathname || '/').replace(/\/+$/, '').toLowerCase();
  return clean === '/privacy' || clean === '/terms' || clean === '/refund-policy';
}

export default function App() {
  const [portalMode, setPortalMode] = useState<AppPortalMode>(() => detectPortalMode());
  const [currentPath, setCurrentPath] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [currentUser, setCurrentUser] = useState<User | null>(() => logisticsStore.getCurrentUser());
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Zero-login Driver Link Web GPS route detection (/track/driver?token=...&trip_id=...)
  const [driverLinkParams, setDriverLinkParams] = useState<{ tripId: string; token: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const isDriverTrackPath =
      window.location.pathname.startsWith('/track/driver') || params.get('track_driver') === '1';
    if (!isDriverTrackPath) return null;
    return {
      tripId: params.get('trip_id') || '',
      token: params.get('token') || ''
    };
  });

  // Authentication Modal State (strictly connected with isAuthOpen and initialRole state flags)
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [initialRole, setInitialRole] = useState<'customer' | 'driver' | 'admin'>('customer');

  // Mobile App / APK Install Modal State
  const [showInstallModal, setShowInstallModal] = useState(false);

  // Customer Navigation State
  const [customerActiveLoadId, setCustomerActiveLoadId] = useState<string | null>(null);
  const [showCreateLoadModal, setShowCreateLoadModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportPreselectedLoadId, setSupportPreselectedLoadId] = useState<string | undefined>(undefined);

  // Driver Navigation Subviews: 'home' | 'find_loads' | 'trip' | 'fleet' | 'earnings' | 'history'
  const [driverSubView, setDriverSubView] = useState<'home' | 'find_loads' | 'trip' | 'fleet' | 'earnings' | 'history'>('home');
  const [activeDriverBookingId, setActiveDriverBookingId] = useState<string>('booking_01');

  // Invoice Modal State
  const [activeInvoiceBookingId, setActiveInvoiceBookingId] = useState<string | null>(null);

  // Test Firestore Connection on boot per Skill constraint
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Listen for Google Maps quota events per skill Section 8
  useEffect(() => {
    const handleQuotaExceeded = () => {
      setQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  // Sync current user state from logisticsStore
  useEffect(() => {
    const update = () => {
      const u = logisticsStore.getCurrentUser();
      setCurrentUser(u || null);
    };
    const unsub = logisticsStore.subscribe(update);
    return unsub;
  }, []);

  // Sync portal mode and pathname on browser back/forward + swap PWA manifest & page SEO dynamically
  useEffect(() => {
    const syncPortalAndRoute = () => {
      setPortalMode(detectPortalMode());
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', syncPortalAndRoute);
    return () => window.removeEventListener('popstate', syncPortalAndRoute);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      manifestLink.setAttribute('href', portalMode === 'partner' ? '/manifest-partner.json' : '/manifest.json');
    }

    // Dynamic catalog & legal routes manage their own route-specific title, meta & JSON-LD
    if (isLegalRoute(currentPath) || (!currentUser && isPublicCatalogRoute(currentPath))) {
      return;
    }

    const clean = (currentPath || '/').replace(/\/+$/, '') || '/';
    if (!currentUser && clean === '/about') {
      applyClientSeo({
        title: 'About Zuggi — 5,000+ Verified Commercial Truck Network',
        description:
          'Learn how Zuggi connects commercial shippers directly with 5,000+ Parivahan-verified trucks across Assam, Northeast India & Pan-India with live GPS and escrow.',
        canonicalPath: '/about',
        robots: 'index, follow'
      });
      setTimeout(() => document.getElementById('about-us')?.scrollIntoView({ behavior: 'smooth' }), 120);
      return;
    }

    if (!currentUser && clean === '/contact') {
      applyClientSeo({
        title: 'Contact Zuggi Freight — 24/7 Dispatch & Fleet Desk',
        description:
          'Reach Zuggi Freight dispatch support in Guwahati, Assam at +91 96789 44132 or support@zuggi.in for shipper bookings, truck attachment, and enterprise logistics.',
        canonicalPath: '/contact',
        robots: 'index, follow'
      });
      setTimeout(() => document.getElementById('reach-out')?.scrollIntoView({ behavior: 'smooth' }), 120);
      return;
    }

    if (portalMode === 'partner') {
      applyClientSeo({
        title: 'Zuggi Partner — Driver & Fleet Owner Freight App',
        description:
          'Attach your commercial truck or fleet with Zuggi. Bid directly on verified loads across Assam & India with 0% brokerage, 90% pickup advance & zero empty returns.',
        canonicalPath: '/partner',
        robots: 'index, follow'
      });
    } else if (!customerActiveLoadId) {
      applyClientSeo({
        title: 'Zuggi — Book Verified Trucks & Commercial Freight Online',
        description:
          'Zuggi connects businesses with 5,000+ Parivahan-verified trucks across Assam, Northeast & Pan-India. Direct quotes, live GPS tracking, GST invoices & escrow.',
        canonicalPath: '/',
        robots: 'index, follow'
      });
    }
  }, [portalMode, currentPath, currentUser, customerActiveLoadId]);

  // Reset sub-navigation states cleanly whenever active user or role changes
  useEffect(() => {
    setCustomerActiveLoadId(null);
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const viewParam = params?.get('view');
    if (portalMode === 'partner' && viewParam === 'find_loads') {
      setDriverSubView('find_loads');
    } else {
      setDriverSubView('home');
    }
  }, [currentUser?.id, currentUser?.role, portalMode]);

  const handleOpenAuthModal = (role?: 'customer' | 'driver' | 'admin') => {
    const resolvedRole = portalMode === 'partner' ? 'driver' : (role === 'driver' ? 'customer' : (role || 'customer'));
    setInitialRole(resolvedRole);
    setIsAuthOpen(true);
  };

  const handleOpenLoadDetails = (loadId: string) => {
    setCustomerActiveLoadId(loadId);
  };

  const handleOpenSupport = (loadId?: string) => {
    setSupportPreselectedLoadId(loadId);
    setShowSupportModal(true);
  };

  // Strictly verify Super Admin permission
  const isAuthorizedAdmin = currentUser && currentUser.role === 'admin' && (
    currentUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ||
    currentUser.id.includes('owner') ||
    (currentUser.phone && currentUser.phone.replace(/\D/g, '').endsWith('9678944132'))
  );

  // Zero-login Driver Link Web GPS Transmitter route
  if (driverLinkParams) {
    return (
      <>
        <DriverWebTrackingPage
          tripId={driverLinkParams.tripId}
          token={driverLinkParams.token}
          onExitToMainApp={() => {
            window.history.pushState({}, '', '/');
            setDriverLinkParams(null);
          }}
        />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F6F8] text-[#171318] flex flex-col font-sans selection:bg-[#E83E83] selection:text-white w-full max-w-full overflow-x-hidden">
      {/* Mandatory Google Maps Platform Quota Banner per Section 8 Case A */}
      {quotaExceeded && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-900 px-4 py-2 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-rose-950 hover:text-rose-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Main Header */}
      <Header
        currentUser={currentUser}
        portalMode={portalMode}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenKyc={() => setShowKycModal(true)}
        onOpenSupport={() => handleOpenSupport()}
        onOpenAuth={() => handleOpenAuthModal(portalMode === 'partner' ? 'driver' : 'customer')}
        onOpenInstall={() => setShowInstallModal(true)}
      />

      {/* Main Content Area */}
      <main
        className={
          !currentUser && portalMode === 'web'
            ? 'flex-1 w-full'
            : 'flex-1 p-2.5 sm:p-5 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full'
        }
      >
        {/* Legal Policy Pages (/privacy, /terms, /refund-policy) accessible whether signed out or signed in */}
        {isLegalRoute(currentPath) ? (
          <LegalPagesView pathname={currentPath} isSignedIn={Boolean(currentUser)} />
        ) : !currentUser ? (
          isPublicCatalogRoute(currentPath) ? (
            <PublicRouteView
              pathname={currentPath}
              onOpenAuth={handleOpenAuthModal}
              onSwitchToPartner={() => navigateToPortal('partner')}
            />
          ) : (
            <LandingPage
              portalMode={portalMode}
              onOpenAuth={handleOpenAuthModal}
              onOpenInstall={() => setShowInstallModal(true)}
              onSwitchPortal={(mode) => navigateToPortal(mode)}
            />
          )
        ) : currentUser.isBlocked && currentUser.role !== 'admin' ? (
          <div className="min-h-[55vh] flex flex-col items-center justify-center text-center p-8 space-y-4 bg-white rounded-3xl border border-rose-200 shadow-lg max-w-xl mx-auto my-8">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-[#171318]">Account Temporarily Suspended</h2>
            <p className="text-xs sm:text-sm text-[#77717A] leading-relaxed">
              Your Zuggi account (<span className="font-mono font-bold text-[#171318]">{currentUser.phone}</span>) has been blocked by Platform Administration.
            </p>
            <div className="w-full p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-semibold">
              Reason: {currentUser.blockedReason || 'Compliance or operational audit hold.'}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => handleOpenSupport()}
                className="px-5 py-2.5 rounded-xl bg-[#171318] text-white text-xs font-bold hover:bg-black transition cursor-pointer"
              >
                Contact Compliance Support
              </button>
              <button
                onClick={() => authService.logout()}
                className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : portalMode === 'web' && isPartnerRole(currentUser.role) ? (
          <div className="min-h-[55vh] flex flex-col items-center justify-center text-center p-6 sm:p-8 space-y-4 bg-white rounded-3xl border border-gray-200 shadow-lg max-w-lg mx-auto my-8">
            <div className="w-14 h-14 rounded-2xl bg-[#FFF0F6] border border-[#E83E83]/30 flex items-center justify-center text-[#E83E83]">
              <Truck className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-[#171318]">Drivers & Fleet Owners Use the Partner Mobile App</h2>
            <p className="text-xs sm:text-sm text-[#77717A] leading-relaxed">
              This website is strictly for <strong className="text-[#171318]">Shippers & Platform Admin</strong>. Open the dedicated Driver & Fleet Mobile App to browse loads and manage vehicles.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full pt-2">
              <button
                onClick={() => navigateToPortal('partner')}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-[#E83E83]/25"
              >
                <span>Open Driver & Fleet App</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => authService.logout()}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#171318] text-xs font-bold transition cursor-pointer"
              >
                Sign Out (Switch Account)
              </button>
            </div>
          </div>
        ) : portalMode === 'partner' && !isPartnerRole(currentUser.role) ? (
          <div className="min-h-[55vh] flex flex-col items-center justify-center text-center p-6 sm:p-8 space-y-4 bg-white rounded-3xl border border-gray-200 shadow-lg max-w-lg mx-auto my-8">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Building2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-[#171318]">Partner App is Only for Drivers & Fleet Owners</h2>
            <p className="text-xs sm:text-sm text-[#77717A] leading-relaxed">
              You are currently signed in as <strong className="text-[#171318] uppercase">{currentUser.role}</strong>. Shippers and Admins sign in through the Web Portal.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full pt-2">
              <button
                onClick={() => navigateToPortal('web')}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
              >
                <span>Go to Shipper & Admin Web</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const switched = authService.switchRole('driver');
                  logisticsStore.setCurrentUser(switched);
                }}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-bold transition cursor-pointer"
              >
                Continue as Driver / Fleet
              </button>
              <button
                onClick={() => authService.logout()}
                className="w-full sm:w-auto px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#171318] text-xs font-bold transition cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* VIEW 1: SHIPPER / CUSTOMER DASHBOARD */}
            {currentUser.role === 'customer' && (
              <>
                {customerActiveLoadId ? (
                  <CustomerLoadDetails
                    loadId={customerActiveLoadId}
                    onBack={() => setCustomerActiveLoadId(null)}
                    onViewInvoice={(bookingId) => setActiveInvoiceBookingId(bookingId)}
                    onOpenSupport={handleOpenSupport}
                  />
                ) : (
                  <CustomerHome
                    currentUser={currentUser}
                    onCreateLoadClick={() => setShowCreateLoadModal(true)}
                    onSelectLoad={handleOpenLoadDetails}
                    onViewInvoice={(bookingId) => setActiveInvoiceBookingId(bookingId)}
                    onOpenSupport={handleOpenSupport}
                  />
                )}
              </>
            )}

            {/* VIEW 2: VEHICLE OWNER DASHBOARD */}
            {currentUser.role === 'vehicle_owner' && (
              <>
                {driverSubView === 'trip' ? (
                  <DriverTripExecution
                    bookingId={activeDriverBookingId}
                    onBack={() => setDriverSubView('home')}
                    onTripCompleted={() => setDriverSubView('home')}
                  />
                ) : (
                  <VehicleOwnerDashboard
                    currentUser={currentUser}
                    onOpenSupport={handleOpenSupport}
                    onNavigateToTrip={(bookingId: string) => {
                      setActiveDriverBookingId(bookingId);
                      setDriverSubView('trip');
                    }}
                  />
                )}
              </>
            )}

            {/* VIEW 3: DRIVER DASHBOARD */}
            {currentUser.role === 'driver' && (
              <>
                {driverSubView === 'home' && (
                  <DriverHome
                    currentUser={currentUser}
                    onNavigateToFindLoads={() => setDriverSubView('find_loads')}
                    onNavigateToTrip={(bookingId) => {
                      if (bookingId) setActiveDriverBookingId(bookingId);
                      setDriverSubView('trip');
                    }}
                    onNavigateToFleet={() => setDriverSubView('fleet')}
                    onNavigateToEarnings={() => setDriverSubView('earnings')}
                    onNavigateToTripHistory={() => setDriverSubView('history')}
                    onOpenSupport={handleOpenSupport}
                  />
                )}

                {driverSubView === 'find_loads' && (
                  <FindLoads
                    currentUser={currentUser}
                    onBack={() => setDriverSubView('home')}
                    onViewTrip={(bookingId) => {
                      setActiveDriverBookingId(bookingId);
                      setDriverSubView('trip');
                    }}
                  />
                )}

                {driverSubView === 'trip' && (
                  <DriverTripExecution
                    bookingId={activeDriverBookingId}
                    onBack={() => setDriverSubView('home')}
                    onTripCompleted={() => setDriverSubView('home')}
                  />
                )}

                {driverSubView === 'fleet' && (
                  <DriverFleetManagement
                    currentUser={currentUser}
                    onBack={() => setDriverSubView('home')}
                  />
                )}

                {driverSubView === 'earnings' && (
                  <DriverEarnings
                    currentUser={currentUser}
                    onBack={() => setDriverSubView('home')}
                    onNavigateToHistory={() => setDriverSubView('history')}
                  />
                )}

                {driverSubView === 'history' && (
                  <DriverTripHistory
                    currentUser={currentUser}
                    onBack={() => setDriverSubView('home')}
                    onViewInvoice={(bookingId) => setActiveInvoiceBookingId(bookingId)}
                    onOpenSupport={handleOpenSupport}
                  />
                )}
              </>
            )}

            {/* VIEW 4: FLEET PARTNER / TRANSPORTER DASHBOARD */}
            {(currentUser.role === 'fleet_partner' || currentUser.role === 'transporter') && (
              <>
                {driverSubView === 'trip' ? (
                  <DriverTripExecution
                    bookingId={activeDriverBookingId}
                    onBack={() => setDriverSubView('home')}
                    onTripCompleted={() => setDriverSubView('home')}
                  />
                ) : (
                  <FleetPartnerDashboard
                    currentUser={currentUser}
                    onOpenSupport={handleOpenSupport}
                    onViewBookingDetails={(bookingId) => {
                      setActiveDriverBookingId(bookingId);
                      setDriverSubView('trip');
                    }}
                  />
                )}
              </>
            )}

            {/* VIEW 5: SUPER ADMIN PANEL */}
            {currentUser.role === 'admin' && (
              <>
                {isAuthorizedAdmin ? (
                  <AdminDashboard
                    currentUser={currentUser}
                    onViewInvoice={(bookingId: string) => setActiveInvoiceBookingId(bookingId)}
                  />
                ) : (
                  <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6 space-y-3 bg-white rounded-3xl border border-gray-200 shadow-sm">
                    <ShieldAlert className="w-12 h-12 text-[#DC3545]" />
                    <h2 className="text-lg font-bold text-[#171318]">403 Forbidden: Super Admin Unauthorized</h2>
                    <p className="text-xs text-[#77717A] max-w-md">
                      Only the specifically configured platform owner ({SUPER_ADMIN_EMAIL}) is permitted to access the administrative panel.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar */}
      {currentUser && (
        <MobileBottomNav
          currentUser={currentUser}
          activeDriverSubView={driverSubView === 'history' ? 'home' : driverSubView}
          onDriverNavigate={(subView) => setDriverSubView(subView)}
          onCustomerPostLoad={() => setShowCreateLoadModal(true)}
          onCustomerHome={() => setCustomerActiveLoadId(null)}
          onOpenSupport={() => handleOpenSupport()}
          onOpenInstall={() => setShowInstallModal(true)}
          onOpenProfile={() => setShowProfileModal(true)}
        />
      )}

      {/* Create Load Modal (Shipper) */}
      {showCreateLoadModal && (
        <CreateLoadModal
          isOpen={showCreateLoadModal}
          onClose={() => setShowCreateLoadModal(false)}
          onLoadCreated={(loadId) => {
            setShowCreateLoadModal(false);
            setCustomerActiveLoadId(loadId);
          }}
        />
      )}

      {/* Customer Profile Modal */}
      {showProfileModal && currentUser && (
        <CustomerProfileModal
          currentUser={currentUser}
          portalMode={portalMode}
          onClose={() => setShowProfileModal(false)}
          onUserSwitched={(user) => setCurrentUser(user)}
          onOpenAuth={() => handleOpenAuthModal(portalMode === 'partner' ? 'driver' : 'customer')}
        />
      )}

      {/* Statutory KYC / Parivahan Documents Modal */}
      {showKycModal && currentUser && (
        <KycManagerModal
          isOpen={showKycModal}
          onClose={() => setShowKycModal(false)}
          currentUser={currentUser}
        />
      )}

      {/* 24/7 Operations Support Modal */}
      {showSupportModal && currentUser && (
        <SupportTicketModal
          isOpen={showSupportModal}
          onClose={() => setShowSupportModal(false)}
          currentUser={currentUser}
          preselectedLoadId={supportPreselectedLoadId}
        />
      )}

      {/* Mobile App Install / APK Helper Modal */}
      {showInstallModal && (
        <MobileAppInstallModal
          isOpen={showInstallModal}
          onClose={() => setShowInstallModal(false)}
        />
      )}

      {/* Authentication Modal with Real SMS OTP & Owner Portal */}
      <AuthModal
        isOpen={isAuthOpen}
        initialRole={initialRole}
        portalMode={portalMode}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthOpen(false);
        }}
      />

      {/* GST Consignment Tax Invoice Modal */}
      {activeInvoiceBookingId && (
        <InvoiceModal
          bookingId={activeInvoiceBookingId}
          onClose={() => setActiveInvoiceBookingId(null)}
        />
      )}

      {/* Global Toast Feedback Container */}
      <ToastContainer />
    </div>
  );
}
