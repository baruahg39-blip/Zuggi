import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Building2,
  ShieldAlert,
  ArrowRightLeft,
  Bell, 
  CheckCircle2, 
  LifeBuoy, 
  LogIn, 
  LogOut, 
  User as UserIcon,
  X,
  Download
} from 'lucide-react';
import { User, UserRole, AppNotification } from '../../types';
import { logisticsStore } from '../../services/store';
import { authService } from '../../services/authService';
import { showToast } from './Toast';

import { AppPortalMode } from '../../utils/portalMode';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface HeaderProps {
  currentUser: User | null;
  portalMode?: AppPortalMode;
  onOpenProfile: () => void;
  onOpenKyc?: () => void;
  onOpenSupport?: () => void;
  onOpenAuth?: () => void;
  onOpenInstall?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  portalMode = 'web',
  onOpenProfile,
  onOpenKyc,
  onOpenSupport,
  onOpenAuth,
  onOpenInstall
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeTicketsCount, setActiveTicketsCount] = useState(0);
  const [showNotifModal, setShowNotifModal] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setActiveTicketsCount(0);
      return;
    }
    const update = () => {
      setNotifications(logisticsStore.getNotifications(currentUser.role, currentUser.id));
      const tickets = logisticsStore.getTickets(currentUser.role, currentUser.id);
      const active = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
      setActiveTicketsCount(active);
    };
    update();
    const unsub = logisticsStore.subscribe(update);
    return unsub;
  }, [currentUser?.role, currentUser?.id]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    notifications.forEach((n) => logisticsStore.markNotificationAsRead(n.id));
  };

  const handleLogout = async () => {
    await authService.logout();
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#171318] text-white border-b border-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Logo & Name */}
          {!currentUser && portalMode === 'web' ? (
            <a
              href="#top"
              className="flex items-center gap-2.5 shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E83E83] rounded-xl"
            >
              <div className="w-10 h-10 rounded-xl bg-[#060309] border border-white/10 overflow-hidden flex items-center justify-center shrink-0 shadow-md shadow-[#E83E83]/20">
                <img
                  src="/assets/aistudio/Zuggi_Pink_Delivery_Logo_bf3220a3.png"
                  alt="Zuggi Logo"
                  className="w-full h-full object-contain p-0.5"
                />
              </div>
              <span className="text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0">
                Zuggi
              </span>
            </a>
          ) : (
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#060309] border border-white/10 overflow-hidden flex items-center justify-center shadow-md shadow-[#E83E83]/25 shrink-0">
                <img
                  src="/assets/aistudio/Zuggi_Pink_Delivery_Logo_bf3220a3.png"
                  alt="Zuggi Logo"
                  className="w-full h-full object-contain p-0.5"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base sm:text-lg font-black tracking-tight text-white whitespace-nowrap shrink-0">
                    {portalMode === 'partner' ? 'Zuggi Partner' : 'Zuggi'}
                  </span>
                  <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-[#FFF0F6] text-[#E83E83] font-black uppercase tracking-wider">
                    {portalMode === 'partner' ? 'Driver App' : 'Freight'}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 hidden sm:block">
                  {portalMode === 'partner' ? 'Driver & Fleet Owner Mobile Portal' : 'Book a Truck & Freight Dispatch'}
                </p>
              </div>
            </div>
          )}

          {/* Zone 2: Public Website Navigation Links (Signed-Out Web Portal) */}
          {!currentUser && portalMode === 'web' && (
            <nav
              aria-label="Primary website navigation"
              className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-300"
            >
              <a
                href="#about-us"
                className="hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 hover:underline underline-offset-4 decoration-[#E83E83]"
              >
                About Us
              </a>
              <a
                href="#fleet-network"
                className="hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 hover:underline underline-offset-4 decoration-[#E83E83]"
              >
                Fleet Network
              </a>
              <a
                href="#how-it-works"
                className="hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 hover:underline underline-offset-4 decoration-[#E83E83]"
              >
                How It Works
              </a>
              <a
                href="#reach-out"
                className="hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 hover:underline underline-offset-4 decoration-[#E83E83]"
              >
                Reach Out
              </a>
            </nav>
          )}

          {/* Zone 3: Right Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Active Portal Badge */}
            {currentUser && (
              <div className="hidden sm:flex items-center">
                {currentUser.role === 'customer' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-950/80 text-blue-300 border border-blue-800/80 text-[11px] font-bold">
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Book a Truck</span>
                  </span>
                )}
                {(currentUser.role === 'driver' || currentUser.role === 'vehicle_owner' || currentUser.role === 'fleet_partner' || currentUser.role === 'transporter') && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 text-[11px] font-bold">
                    <Truck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Driver / Fleet</span>
                  </span>
                )}
                {currentUser.role === 'admin' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-950/80 text-purple-300 border border-purple-800/80 text-[11px] font-bold">
                    <ShieldAlert className="w-3.5 h-3.5 text-[#E83E83]" />
                    <span>Super Admin</span>
                  </span>
                )}
              </div>
            )}

            {/* Install Partner App Trigger on /partner when not already installed */}
            {portalMode === 'partner' && !isInstalled && (
              <button
                onClick={() => (isInstallable ? void install() : onOpenInstall?.())}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#E83E83]/20 hover:bg-[#E83E83]/30 border border-[#E83E83]/40 text-[#FF85B7] text-xs font-bold transition cursor-pointer active:scale-95"
                title="Install Zuggi Partner App"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Install App</span>
              </button>
            )}

            {/* Admin Portal Preview Switcher (Web Portal Admin Only) */}
            {portalMode === 'web' && currentUser?.role === 'admin' && (
              <button
                onClick={() => {
                  const switched = authService.switchRole('customer');
                  logisticsStore.setCurrentUser(switched);
                  showToast('Viewing Book a Truck Portal', 'info');
                }}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-blue-600/30 border border-white/10 hover:border-blue-500/50 text-gray-200 hover:text-blue-300 text-xs font-bold transition cursor-pointer active:scale-95 shadow-xs"
                title="Switch to Book a Truck Portal"
              >
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Book a Truck View</span>
                <ArrowRightLeft className="w-3 h-3 text-blue-400 sm:hidden" />
              </button>
            )}

            {/* Notifications Trigger Button */}
            {currentUser && (
              <button
                onClick={() => setShowNotifModal(true)}
                className="relative p-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 active:scale-95 transition cursor-pointer flex items-center justify-center shrink-0"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-[#E83E83] text-white text-[10px] font-black flex items-center justify-center shadow-md animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* Support Quick Action (Visible on Tablet/Desktop) */}
            {currentUser && onOpenSupport && (
              <button
                onClick={() => onOpenSupport()}
                className="hidden sm:flex items-center px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer shrink-0"
                title="24/7 Operations Support"
              >
                <LifeBuoy className="w-3.5 h-3.5 text-[#E83E83]" />
                <span className="ml-1.5">Support</span>
                {activeTicketsCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-[#E83E83] text-white text-[10px] font-black">
                    {activeTicketsCount}
                  </span>
                )}
              </button>
            )}

            {/* User Profile Avatar & Logout (Always Fully Visible without Clipping) */}
            {currentUser ? (
              <div className="flex items-center gap-1 sm:gap-2 pl-1.5 border-l border-gray-800 shrink-0">
                <button
                  onClick={onOpenProfile}
                  className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-white/10 active:scale-95 transition cursor-pointer shrink-0"
                  title="Account Profile & Settings"
                  aria-label="Account Profile & Settings"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#E83E83] flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm">
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
                  </div>
                  <div className="hidden md:block text-left text-xs">
                    <div className="font-bold text-white truncate max-w-[110px]">{currentUser.name}</div>
                    <div className="text-[10px] text-gray-400 truncate max-w-[110px] capitalize">
                      {currentUser.role === 'customer' ? 'Book a Truck' : currentUser.role.replace('_', ' ')}
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleLogout}
                  className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 active:scale-95 transition cursor-pointer shrink-0 flex items-center justify-center"
                  title="Log Out"
                  aria-label="Log Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-bold transition cursor-pointer shadow-md shadow-[#E83E83]/30 shrink-0"
              >
                <LogIn className="w-4 h-4" />
                <span>Log In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* FULL NOTIFICATIONS MODAL (Guaranteed 100% visible, cannot be hidden or clipped) */}
      {showNotifModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 animate-fadeIn"
          onClick={() => setShowNotifModal(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[85vh] mt-12 sm:mt-0 text-[#171318]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-[#171318] text-white flex items-center justify-between border-b border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#E83E83] flex items-center justify-center text-white">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Logistics Alerts & Updates</h3>
                  <p className="text-[10px] text-gray-400">{notifications.length} notifications</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#FFF0F6] hover:text-[#E83E83] font-bold cursor-pointer transition"
                  >
                    Mark All Read
                  </button>
                )}
                <button
                  onClick={() => setShowNotifModal(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 p-2 space-y-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-[#77717A] text-xs space-y-2">
                  <Bell className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="font-semibold text-gray-700">No Notifications Yet</p>
                  <p className="text-[11px] text-gray-400">Updates regarding your loads, bids, and trips will appear here.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => logisticsStore.markNotificationAsRead(n.id)}
                    className={`p-3.5 rounded-2xl transition cursor-pointer text-xs ${
                      n.read ? 'bg-white hover:bg-gray-50 opacity-70' : 'bg-[#FFF0F6] hover:bg-[#ffe2ee]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-extrabold text-sm text-[#171318] flex items-center gap-1.5">
                        {!n.read && <span className="w-2 h-2 rounded-full bg-[#E83E83] shrink-0" />}
                        {n.title}
                      </span>
                      <span className="text-[10px] text-[#77717A] shrink-0 font-medium">
                        {new Date(n.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[#77717A] text-xs leading-relaxed pl-3.5">{n.message}</p>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
              <button
                onClick={() => setShowNotifModal(false)}
                className="w-full py-2.5 rounded-xl bg-[#171318] hover:bg-black text-white text-xs font-bold transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
