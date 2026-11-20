import React from 'react';
import { 
  Building2, 
  Truck, 
  PlusCircle, 
  Search, 
  Navigation, 
  IndianRupee, 
  LifeBuoy, 
  User as UserIcon,
  ShieldAlert,
  Package,
  Layers,
  FileText
} from 'lucide-react';
import { User } from '../../types';

interface MobileBottomNavProps {
  currentUser: User;
  activeDriverSubView?: 'home' | 'find_loads' | 'trip' | 'fleet' | 'earnings';
  onDriverNavigate?: (subView: 'home' | 'find_loads' | 'trip' | 'fleet' | 'earnings') => void;
  onCustomerPostLoad?: () => void;
  onCustomerHome?: () => void;
  onOpenSupport: () => void;
  onOpenInstall: () => void;
  onOpenProfile: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentUser,
  activeDriverSubView = 'home',
  onDriverNavigate,
  onCustomerPostLoad,
  onCustomerHome,
  onOpenSupport,
  onOpenInstall,
  onOpenProfile
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#171318] border-t border-gray-800 px-2 py-1.5 shadow-2xl safe-area-pb">
      <div className="w-full text-[10px] font-semibold text-gray-400">
        {/* 1. CUSTOMER / SHIPPER MOBILE BAR (4 evenly distributed items, centered Post Load) */}
        {currentUser.role === 'customer' && (
          <div className="grid grid-cols-4 w-full items-center text-center">
            <button
              onClick={onCustomerHome}
              className="flex flex-col items-center justify-center gap-1 p-1 hover:text-white transition active:scale-95 cursor-pointer w-full text-gray-300"
            >
              <Package className="w-5 h-5 text-[#E83E83]" />
              <span>Loads</span>
            </button>

            <button
              onClick={onCustomerPostLoad}
              className="flex flex-col items-center justify-center gap-1 p-1 text-white bg-[#E83E83] rounded-2xl px-2.5 py-1.5 font-bold shadow-md shadow-[#E83E83]/30 active:scale-95 cursor-pointer -mt-3 max-w-[84px] mx-auto w-full"
            >
              <PlusCircle className="w-5 h-5 text-white" />
              <span className="text-[10px] whitespace-nowrap">Post Load</span>
            </button>

            <button
              onClick={onOpenSupport}
              className="flex flex-col items-center justify-center gap-1 p-1 hover:text-white transition active:scale-95 cursor-pointer w-full text-gray-300"
            >
              <LifeBuoy className="w-5 h-5" />
              <span>Support</span>
            </button>

            <button
              onClick={onOpenProfile}
              className="flex flex-col items-center justify-center gap-1 p-1 hover:text-white transition active:scale-95 cursor-pointer w-full text-gray-300"
            >
              <div className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-[10px] mx-auto">
                {currentUser.name.charAt(0)}
              </div>
              <span>Profile</span>
            </button>
          </div>
        )}

        {/* 2. DRIVER MOBILE BAR (4 evenly distributed items) */}
        {currentUser.role === 'driver' && (
          <div className="grid grid-cols-4 w-full items-center text-center">
            <button
              onClick={() => onDriverNavigate && onDriverNavigate('home')}
              className={`flex flex-col items-center justify-center gap-1 p-1 transition active:scale-95 cursor-pointer w-full ${
                activeDriverSubView === 'home' ? 'text-[#E83E83] font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Truck className="w-5 h-5" />
              <span className="whitespace-nowrap">Dashboard</span>
            </button>

            <button
              onClick={() => onDriverNavigate && onDriverNavigate('find_loads')}
              className={`flex flex-col items-center justify-center gap-1 p-1 transition active:scale-95 cursor-pointer w-full ${
                activeDriverSubView === 'find_loads' ? 'text-[#E83E83] font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Search className="w-5 h-5" />
              <span className="whitespace-nowrap">Find Loads</span>
            </button>

            <button
              onClick={() => onDriverNavigate && onDriverNavigate('trip')}
              className={`flex flex-col items-center justify-center gap-1 p-1 transition active:scale-95 cursor-pointer w-full ${
                activeDriverSubView === 'trip' ? 'text-[#E83E83] font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Navigation className="w-5 h-5" />
              <span className="whitespace-nowrap">Active Trip</span>
            </button>

            <button
              onClick={() => onDriverNavigate && onDriverNavigate('earnings')}
              className={`flex flex-col items-center justify-center gap-1 p-1 transition active:scale-95 cursor-pointer w-full ${
                activeDriverSubView === 'earnings' ? 'text-[#E83E83] font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              <IndianRupee className="w-5 h-5" />
              <span className="whitespace-nowrap">Earnings</span>
            </button>
          </div>
        )}

        {/* 3. VEHICLE OWNER MOBILE BAR */}
        {currentUser.role === 'vehicle_owner' && (
          <div className="grid grid-cols-4 w-full items-center text-center">
            <button
              onClick={() => onDriverNavigate && onDriverNavigate('home')}
              className={`flex flex-col items-center justify-center gap-1 p-1 w-full cursor-pointer ${
                activeDriverSubView !== 'trip' ? 'text-[#E83E83] font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Truck className="w-5 h-5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => onDriverNavigate && onDriverNavigate('trip')}
              className={`flex flex-col items-center justify-center gap-1 p-1 w-full cursor-pointer ${
                activeDriverSubView === 'trip' ? 'text-[#E83E83] font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Navigation className="w-5 h-5" />
              <span>Active Trip</span>
            </button>

            <button
              onClick={onOpenSupport}
              className="flex flex-col items-center justify-center gap-1 p-1 text-gray-400 hover:text-white w-full cursor-pointer"
            >
              <LifeBuoy className="w-5 h-5" />
              <span>Support</span>
            </button>

            <button
              onClick={onOpenProfile}
              className="flex flex-col items-center justify-center gap-1 p-1 text-gray-400 hover:text-white w-full cursor-pointer"
            >
              <UserIcon className="w-5 h-5" />
              <span>Profile</span>
            </button>
          </div>
        )}

        {/* 4. FLEET PARTNER MOBILE BAR */}
        {(currentUser.role === 'fleet_partner' || currentUser.role === 'transporter') && (
          <div className="grid grid-cols-4 w-full items-center text-center">
            <button
              onClick={() => onDriverNavigate && onDriverNavigate('home')}
              className={`flex flex-col items-center justify-center gap-1 p-1 w-full cursor-pointer ${
                activeDriverSubView !== 'trip' ? 'text-[#E83E83] font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Layers className="w-5 h-5" />
              <span>Fleet Desk</span>
            </button>

            <button
              onClick={() => onDriverNavigate && onDriverNavigate('trip')}
              className={`flex flex-col items-center justify-center gap-1 p-1 w-full cursor-pointer ${
                activeDriverSubView === 'trip' ? 'text-[#E83E83] font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Navigation className="w-5 h-5" />
              <span>Live Trip</span>
            </button>

            <button
              onClick={onOpenSupport}
              className="flex flex-col items-center justify-center gap-1 p-1 text-gray-400 hover:text-white w-full cursor-pointer"
            >
              <LifeBuoy className="w-5 h-5" />
              <span>Support</span>
            </button>

            <button
              onClick={onOpenProfile}
              className="flex flex-col items-center justify-center gap-1 p-1 text-gray-400 hover:text-white w-full cursor-pointer"
            >
              <UserIcon className="w-5 h-5" />
              <span>Profile</span>
            </button>
          </div>
        )}

        {/* 5. ADMIN MOBILE BAR */}
        {currentUser.role === 'admin' && (
          <div className="flex items-center justify-between px-4 py-1">
            <span className="flex items-center gap-2 text-xs font-bold text-[#E83E83]">
              <ShieldAlert className="w-4 h-4" />
              <span>Super Admin Management</span>
            </span>

            <button
              onClick={onOpenProfile}
              className="flex items-center gap-1 text-xs text-gray-300 font-semibold px-3 py-1 rounded-xl bg-white/10"
            >
              <span>{currentUser.name}</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
