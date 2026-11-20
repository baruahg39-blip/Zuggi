import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Navigation, 
  PhoneCall, 
  RefreshCw, 
  ShieldAlert, 
  Truck, 
  Volume2, 
  VolumeX, 
  X, 
  PlusCircle, 
  ChevronRight, 
  Radio, 
  Info,
  Car,
  CloudRain,
  Eye,
  ArrowRight
} from 'lucide-react';
import { Booking } from '../../types';

export type AlertSeverity = 'critical' | 'warning' | 'advisory' | 'clear';

export interface HighwayAlertItem {
  id: string;
  highwayNumber: string;
  corridorName: string;
  stretch: string;
  severity: AlertSeverity;
  alertType: 'closure' | 'congestion' | 'landslide' | 'speed_trap' | 'toll_delay' | 'weather' | 'clear';
  title: string;
  description: string;
  expectedDelay: string;
  reportedAt: string;
  verifiedBy: string;
  alternativeRoute?: string;
  affectedCities: string[];
  isDriverReported?: boolean;
}

const INITIAL_HIGHWAY_ALERTS: HighwayAlertItem[] = [
  {
    id: 'ha_01',
    highwayNumber: 'NH-37',
    corridorName: 'Brahmaputra South Trunk (Guwahati ↔ Dibrugarh)',
    stretch: 'Kaziranga Animal Corridor (Kohora – Bagori – Jakhalabandha)',
    severity: 'warning',
    alertType: 'speed_trap',
    title: 'Strict 40 KM/H Speed Limit & Sensor Cameras Active',
    description: 'Autonomous speed radar enforcement active for animal crossing protection. Heavy commercial trucks exceeding 40 km/h will receive automatic ₹5,000 challan at Bagori barrier. Keep distance and do not halt on animal corridors.',
    expectedDelay: '+25 mins travel delay',
    reportedAt: '18 mins ago',
    verifiedBy: 'Assam Forest Dept & Highway Police',
    alternativeRoute: 'No diversion needed; maintain 35-40 km/h speed',
    affectedCities: ['Guwahati', 'Nagaon', 'Bokakhat', 'Jorhat', 'Dibrugarh']
  },
  {
    id: 'ha_02',
    highwayNumber: 'NH-6',
    corridorName: 'Meghalaya – Barak Valley Corridor',
    stretch: 'Sonapur Tunnel & Ratacherra Ghat Section',
    severity: 'critical',
    alertType: 'closure',
    title: 'One-Way Traffic Clearance due to Rock Fall clearing',
    description: 'Rock slide clearance work in progress near Sonapur tunnel mouth. NHAI earthmovers operating. Heavy 6-axle trailers and 32ft containers are being released in alternating 45-minute batches. Police checkpost stationed.',
    expectedDelay: '+1 hr 45 mins delay',
    reportedAt: '25 mins ago',
    verifiedBy: 'NHAI Regional Office & Meghalaya Police',
    alternativeRoute: 'Small commercial vehicles can take Harangajao-Silchar corridor',
    affectedCities: ['Jorabat', 'Shillong', 'Jowai', 'Silchar', 'Badarpur']
  },
  {
    id: 'ha_03',
    highwayNumber: 'NH-27',
    corridorName: 'East-West Corridor (Guwahati ↔ Siliguri)',
    stretch: 'Raha Toll Plaza & Madanpur Inter-district Crossing',
    severity: 'warning',
    alertType: 'toll_delay',
    title: 'FASTag Reader Server Glitch causing 1.5 KM Truck Queue',
    description: 'Slow scanning on lane 3 & 4 for multi-axle freight vehicles. Manual cash/counter lane activated. Keep exact toll amount or verified FASTag balance ready to avoid queue penalties.',
    expectedDelay: '+35 mins delay',
    reportedAt: '32 mins ago',
    verifiedBy: 'NHAI Toll Operations & Zuggi Dispatch',
    affectedCities: ['Guwahati', 'Nalbari', 'Bongaigaon', 'Dhubri']
  },
  {
    id: 'ha_04',
    highwayNumber: 'Saraighat Bridge',
    corridorName: 'Brahmaputra North-South Link',
    stretch: 'Old Saraighat Rail-cum-Road Bridge',
    severity: 'warning',
    alertType: 'congestion',
    title: 'Heavy Vehicles Diverted to New 3-Lane Saraighat Bridge',
    description: 'Expansion joint maintenance underway on old bridge deck. All trucks above 7.5 MT must strictly use the New 3-Lane Concrete Bridge on the downstream side.',
    expectedDelay: '+15 mins delay',
    reportedAt: '1 hour ago',
    verifiedBy: 'Guwahati Traffic Police',
    alternativeRoute: 'Use New Saraighat Bridge; follow Jalukbari rotary signs',
    affectedCities: ['Guwahati', 'Amingaon', 'Changsari', 'Baihata']
  },
  {
    id: 'ha_05',
    highwayNumber: 'NH-29',
    corridorName: 'Nagaland Trade Corridor (Dabaka ↔ Dimapur)',
    stretch: 'Chumukedima Hill Gate to Purana Bazar',
    severity: 'advisory',
    alertType: 'weather',
    title: 'Intermittent Rain & Slick Surface on Hill Descent',
    description: 'Light rains making the bitumen slippery along steep gradient curves. Use engine braking and inspect tyre tread before starting the descent from Dimapur bypass.',
    expectedDelay: '+10 mins slow movement',
    reportedAt: '45 mins ago',
    verifiedBy: 'Border Roads Organisation (BRO) Patrol',
    affectedCities: ['Dabaka', 'Diphu', 'Dimapur', 'Kohima']
  },
  {
    id: 'ha_06',
    highwayNumber: 'NH-27',
    corridorName: 'Guwahati Bypass ↔ Bongaigaon 4-Lane',
    stretch: 'Bijni – Barpeta Road 4-Lane Highway',
    severity: 'clear',
    alertType: 'clear',
    title: 'Smooth 4-Lane Flow • All Lanes Clear',
    description: 'Pavement condition optimal. All toll gates at Patgaon operational without delay. Average truck cruising speed 65-70 km/h.',
    expectedDelay: '0 mins (On Schedule)',
    reportedAt: '5 mins ago',
    verifiedBy: 'Zuggi Telemetry Network',
    affectedCities: ['Guwahati', 'Barpeta', 'Bongaigaon']
  }
];

interface NortheastHighwayAlertsProps {
  activeBooking?: Booking;
  onOpenSupport?: (loadId?: string) => void;
  className?: string;
}

export const NortheastHighwayAlerts: React.FC<NortheastHighwayAlertsProps> = ({
  activeBooking,
  onOpenSupport,
  className = ''
}) => {
  const [alerts, setAlerts] = useState<HighwayAlertItem[]>(INITIAL_HIGHWAY_ALERTS);
  const [selectedCorridor, setSelectedCorridor] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('Just now');
  const [showReportModal, setShowReportModal] = useState(false);
  const [readAloud, setReadAloud] = useState(false);

  // New report form state
  const [reportHighway, setReportHighway] = useState('NH-37');
  const [reportStretch, setReportStretch] = useState('');
  const [reportType, setReportType] = useState<'congestion' | 'closure' | 'landslide' | 'toll_delay'>('congestion');
  const [reportDesc, setReportDesc] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);

  // Filter alerts by highway / corridor
  const filteredAlerts = useMemo(() => {
    if (selectedCorridor === 'all') return alerts;
    return alerts.filter(
      (a) => a.highwayNumber.toLowerCase().includes(selectedCorridor.toLowerCase()) ||
             a.corridorName.toLowerCase().includes(selectedCorridor.toLowerCase())
    );
  }, [alerts, selectedCorridor]);

  // Check if active trip is directly impacted
  const activeTripImpacts = useMemo(() => {
    if (!activeBooking) return [];
    const pickupCity = activeBooking.pickup?.city?.toLowerCase() || '';
    const deliveryCity = activeBooking.delivery?.city?.toLowerCase() || '';

    return alerts.filter((a) => {
      const matchPickup = a.affectedCities.some((c) => c.toLowerCase().includes(pickupCity) || pickupCity.includes(c.toLowerCase()));
      const matchDelivery = a.affectedCities.some((c) => c.toLowerCase().includes(deliveryCity) || deliveryCity.includes(c.toLowerCase()));
      return matchPickup || matchDelivery;
    });
  }, [activeBooking, alerts]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastRefreshed('Just now');
    }, 700);
  };

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportStretch.trim() || !reportDesc.trim()) return;

    const newAlert: HighwayAlertItem = {
      id: `driver_rep_${Date.now()}`,
      highwayNumber: reportHighway,
      corridorName: `${reportHighway} Northeast Transport Line`,
      stretch: reportStretch.trim(),
      severity: reportType === 'closure' ? 'critical' : 'warning',
      alertType: reportType,
      title: `Driver Report: ${reportType.replace('_', ' ').toUpperCase()} on ${reportHighway}`,
      description: reportDesc.trim(),
      expectedDelay: reportType === 'closure' ? '+1 hr+ delay' : '+25-40 mins delay',
      reportedAt: 'Just now',
      verifiedBy: 'Zuggi Driver Community (Crowdsourced)',
      affectedCities: ['Guwahati', 'Nagaon', 'Jorhat', 'Dibrugarh'],
      isDriverReported: true
    };

    setAlerts([newAlert, ...alerts]);
    setReportSuccess(true);
    setTimeout(() => {
      setReportSuccess(false);
      setShowReportModal(false);
      setReportStretch('');
      setReportDesc('');
    }, 1500);
  };

  // Text-to-Speech audio announcement for drivers
  const handleToggleVoiceAlerts = () => {
    if (!readAloud && 'speechSynthesis' in window) {
      const criticalCount = alerts.filter(a => a.severity === 'critical').length;
      const warningCount = alerts.filter(a => a.severity === 'warning').length;
      const text = `Zuggi highway advisory. Attention driver: There are ${criticalCount} road closures and ${warningCount} congestion warnings on Northeast national highways today. Drive safely and maintain speed limits near Kaziranga.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.lang = 'en-IN';
      window.speechSynthesis.speak(utterance);
      setReadAloud(true);
      utterance.onend = () => setReadAloud(false);
    } else if (readAloud && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setReadAloud(false);
    }
  };

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* HEADER WIDGET: Northeast Highway Status Bar */}
      <div className="bg-[#171318] text-white rounded-3xl p-5 sm:p-6 border border-gray-800 shadow-xl relative overflow-hidden">
        {/* Subtle decorative glowing corner */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#E83E83]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#E83E83] flex items-center justify-center text-white font-black shadow-md shadow-[#E83E83]/30 shrink-0">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Northeast Highway Traffic & Road Alerts
                </h3>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live NHAI & Police Feed
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-0.5">
                Real-time road closures, animal corridor speed radars, landslides & toll queues across Assam & NE.
              </p>
            </div>
          </div>

          {/* Action buttons on widget header */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleToggleVoiceAlerts}
              className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                readAloud 
                  ? 'bg-[#E83E83] text-white border-[#E83E83]' 
                  : 'bg-white/10 hover:bg-white/20 text-gray-300 border-gray-700'
              }`}
              title="Voice announcement of highway alerts"
            >
              {readAloud ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#E83E83]" />}
              <span className="hidden md:inline">{readAloud ? 'Mute Voice' : 'Audio Alert'}</span>
            </button>

            <button
              onClick={() => setShowReportModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] active:scale-95 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-[#E83E83]/30 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Report Incident</span>
            </button>

            <button
              onClick={handleRefresh}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition cursor-pointer"
              title="Refresh Highway Status"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#E83E83]' : ''}`} />
            </button>
          </div>
        </div>

        {/* METRICS & ROUTE IMPACT BANNER */}
        <div className="mt-5 pt-4 border-t border-gray-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[#77717A] text-[10px] block font-bold uppercase tracking-wider">Road Closures</span>
            <span className="text-xl font-black text-[#DC3545] mt-0.5 block">{criticalCount} Active</span>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[#77717A] text-[10px] block font-bold uppercase tracking-wider">Traffic Congestion</span>
            <span className="text-xl font-black text-[#E9A23B] mt-0.5 block">{warningCount} Sections</span>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[#77717A] text-[10px] block font-bold uppercase tracking-wider">Fastest Corridor</span>
            <span className="text-xl font-black text-[#16A36A] mt-0.5 block">NH-27 4-Lane</span>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[#77717A] text-[10px] block font-bold uppercase tracking-wider">Feed Status</span>
            <span className="text-xs font-bold text-gray-300 mt-1 block flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#E83E83]" />
              {lastRefreshed}
            </span>
          </div>
        </div>

        {/* ACTIVE DRIVER ROUTE IMPACT ALERT (If current trip has alerts along the way) */}
        {activeBooking && activeTripImpacts.length > 0 && (
          <div className="mt-4 p-3.5 rounded-2xl bg-[#FFF0F6] border-2 border-[#E83E83]/40 text-[#171318] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#E83E83] text-white flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[#E83E83] uppercase tracking-wide">
                    Active Trip Alert: {activeBooking.pickup?.city || 'Dibrugarh'} → {activeBooking.delivery?.city || 'Guwahati'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E83E83] text-white font-bold">
                    {activeTripImpacts.length} Road Alert{activeTripImpacts.length > 1 ? 's' : ''} on your corridor
                  </span>
                </div>
                <p className="text-xs text-gray-800 mt-0.5">
                  <strong>{activeTripImpacts[0].title}</strong> — {activeTripImpacts[0].expectedDelay}. Plan your driving schedule accordingly.
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedCorridor(activeTripImpacts[0].highwayNumber)}
              className="px-3 py-1.5 rounded-xl bg-[#171318] hover:bg-black text-white text-xs font-bold shrink-0 transition flex items-center gap-1 cursor-pointer"
            >
              <span>View Route Alert</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* FILTER TABS BY HIGHWAY CORRIDORS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedCorridor('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            selectedCorridor === 'all'
              ? 'bg-[#171318] text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          All Corridors ({alerts.length})
        </button>

        <button
          onClick={() => setSelectedCorridor('NH-37')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            selectedCorridor === 'NH-37'
              ? 'bg-[#E83E83] text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span className="font-mono">NH-37</span>
          <span>(Guwahati – Dibrugarh)</span>
        </button>

        <button
          onClick={() => setSelectedCorridor('NH-27')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            selectedCorridor === 'NH-27'
              ? 'bg-[#E83E83] text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span className="font-mono">NH-27</span>
          <span>(East-West / Siliguri)</span>
        </button>

        <button
          onClick={() => setSelectedCorridor('NH-6')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            selectedCorridor === 'NH-6'
              ? 'bg-[#E83E83] text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span className="font-mono">NH-6</span>
          <span>(Shillong – Silchar)</span>
        </button>

        <button
          onClick={() => setSelectedCorridor('NH-29')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            selectedCorridor === 'NH-29'
              ? 'bg-[#E83E83] text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span className="font-mono">NH-29</span>
          <span>(Dimapur – Kohima)</span>
        </button>

        <button
          onClick={() => setSelectedCorridor('Saraighat')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            selectedCorridor === 'Saraighat'
              ? 'bg-[#E83E83] text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Major Bridges
        </button>
      </div>

      {/* ALERT CARDS LIST */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-gray-200 text-[#77717A] space-y-2">
            <CheckCircle2 className="w-10 h-10 text-[#16A36A] mx-auto" />
            <h4 className="font-extrabold text-[#171318]">No Active Incidents or Delays</h4>
            <p className="text-xs">The selected corridor currently reports smooth freight traffic movement.</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white rounded-3xl p-5 border transition shadow-sm hover:shadow-md ${
                alert.severity === 'critical'
                  ? 'border-red-300 ring-1 ring-red-100'
                  : alert.severity === 'warning'
                  ? 'border-amber-200'
                  : alert.severity === 'clear'
                  ? 'border-emerald-200 bg-emerald-50/20'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Highway Tag */}
                  <span className="px-3 py-1 rounded-xl bg-[#171318] text-white font-mono font-black text-xs">
                    {alert.highwayNumber}
                  </span>

                  {/* Severity Badge */}
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase flex items-center gap-1 ${
                    alert.severity === 'critical'
                      ? 'bg-red-100 text-[#DC3545]'
                      : alert.severity === 'warning'
                      ? 'bg-amber-100 text-[#E9A23B]'
                      : alert.severity === 'clear'
                      ? 'bg-emerald-100 text-[#16A36A]'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {alert.severity === 'critical' && <AlertTriangle className="w-3.5 h-3.5 text-[#DC3545]" />}
                    {alert.severity === 'warning' && <Clock className="w-3.5 h-3.5 text-[#E9A23B]" />}
                    {alert.severity === 'clear' && <CheckCircle2 className="w-3.5 h-3.5 text-[#16A36A]" />}
                    {alert.severity === 'critical' ? 'ROAD BLOCK / RESTRICTION' : alert.severity === 'warning' ? 'CAUTION / DELAY' : alert.severity === 'clear' ? 'NORMAL FLOW' : 'ADVISORY'}
                  </span>

                  {alert.isDriverReported && (
                    <span className="px-2 py-0.5 rounded-full bg-[#FFF0F6] text-[#E83E83] border border-[#E83E83]/30 text-[10px] font-bold">
                      Driver Report
                    </span>
                  )}
                </div>

                {/* Delay & Timestamp */}
                <div className="flex items-center gap-3 text-xs">
                  <span className={`font-black ${
                    alert.severity === 'critical' ? 'text-[#DC3545]' : alert.severity === 'warning' ? 'text-[#E9A23B]' : 'text-[#16A36A]'
                  }`}>
                    {alert.expectedDelay}
                  </span>
                  <span className="text-[11px] text-[#77717A] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gray-400" />
                    {alert.reportedAt}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="pt-3 space-y-2">
                <div className="flex items-start gap-1.5 text-xs text-[#77717A]">
                  <MapPin className="w-4 h-4 text-[#E83E83] shrink-0 mt-0.5" />
                  <span className="font-bold text-[#171318]">{alert.stretch}</span>
                  <span className="text-gray-400 hidden sm:inline">• ({alert.corridorName})</span>
                </div>

                <h4 className="text-sm font-extrabold text-[#171318] tracking-tight">
                  {alert.title}
                </h4>

                <p className="text-xs text-[#77717A] leading-relaxed">
                  {alert.description}
                </p>

                {/* Alternative Route Recommendation */}
                {alert.alternativeRoute && (
                  <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs flex items-start gap-2 text-[#171318]">
                    <Navigation className="w-4 h-4 text-[#16A36A] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-[#16A36A]">Recommended Action / Diversion:</span>
                      <p className="text-[#77717A] text-[11px] mt-0.5">{alert.alternativeRoute}</p>
                    </div>
                  </div>
                )}

                {/* Source Verification Badge */}
                <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-gray-400 gap-1">
                  <span>Verified by: <strong className="text-gray-700">{alert.verifiedBy}</strong></span>
                  <span>Connects: {alert.affectedCities.slice(0, 4).join(', ')}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* HIGHWAY EMERGENCY NUMBERS STRIP */}
      <div className="bg-[#FFF0F6] rounded-3xl p-4 sm:p-5 border border-[#E83E83]/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#E83E83] text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-[#171318]">Northeast Commercial Highway Emergency Helpline</h4>
            <p className="text-[11px] text-[#77717A]">Instant 24x7 ambulance, crane, break-down assistance & highway police</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <a
            href="tel:1033"
            className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-white text-[#171318] border border-gray-300 hover:border-[#E83E83] text-xs font-black transition flex items-center justify-center gap-1.5 shadow-xs"
          >
            <PhoneCall className="w-3.5 h-3.5 text-[#E83E83]" />
            <span>NHAI Helpline: 1033</span>
          </a>

          <a
            href="tel:112"
            className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-white text-[#171318] border border-gray-300 hover:border-[#E83E83] text-xs font-black transition flex items-center justify-center gap-1.5 shadow-xs"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-[#DC3545]" />
            <span>Police: 112</span>
          </a>

          {onOpenSupport && (
            <button
              onClick={() => onOpenSupport()}
              className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span>Zuggi Support</span>
            </button>
          )}
        </div>
      </div>

      {/* REPORT INCIDENT MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden flex flex-col text-[#171318]">
            <div className="p-4 bg-[#171318] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#E83E83] flex items-center justify-center text-white">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Report Road Incident / Jam</h3>
                  <p className="text-[10px] text-gray-400">Alert fellow truck drivers on this highway</p>
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="p-5 space-y-4 text-xs">
              {reportSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Report submitted! Broadcasting to all Northeast drivers.</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-[#171318] block mb-1">Select Highway Corridor *</label>
                <select
                  value={reportHighway}
                  onChange={(e) => setReportHighway(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-300 font-bold focus:border-[#E83E83] focus:outline-none"
                >
                  <option value="NH-37">NH-37 (Guwahati ↔ Nagaon ↔ Kaziranga ↔ Dibrugarh)</option>
                  <option value="NH-27">NH-27 (Guwahati ↔ Bongaigaon ↔ Siliguri)</option>
                  <option value="NH-6">NH-6 (Jorabat ↔ Shillong ↔ Silchar)</option>
                  <option value="NH-29">NH-29 (Dabaka ↔ Dimapur ↔ Kohima)</option>
                  <option value="NH-15">NH-15 (Baihata ↔ Mangaldai ↔ Tezpur)</option>
                  <option value="Saraighat Bridge">Saraighat Bridge (Guwahati / Kamrup)</option>
                  <option value="Bogibeel Bridge">Bogibeel Bridge (Dibrugarh / Dhemaji)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#171318] block mb-1">Exact Stretch / Landmark *</label>
                <input
                  type="text"
                  value={reportStretch}
                  onChange={(e) => setReportStretch(e.target.value)}
                  placeholder="e.g. Near Raha Toll Plaza, 4 KM before Nagaon bypass"
                  className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-300 focus:border-[#E83E83] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#171318] block mb-1">Incident Category *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReportType('congestion')}
                    className={`p-2 rounded-xl border text-center font-bold text-xs cursor-pointer ${
                      reportType === 'congestion'
                        ? 'bg-[#E83E83] text-white border-[#E83E83]'
                        : 'bg-gray-50 border-gray-200 text-gray-700'
                    }`}
                  >
                    Traffic Congestion
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportType('closure')}
                    className={`p-2 rounded-xl border text-center font-bold text-xs cursor-pointer ${
                      reportType === 'closure'
                        ? 'bg-[#DC3545] text-white border-[#DC3545]'
                        : 'bg-gray-50 border-gray-200 text-gray-700'
                    }`}
                  >
                    Road Closed / Blocked
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportType('landslide')}
                    className={`p-2 rounded-xl border text-center font-bold text-xs cursor-pointer ${
                      reportType === 'landslide'
                        ? 'bg-[#E9A23B] text-white border-[#E9A23B]'
                        : 'bg-gray-50 border-gray-200 text-gray-700'
                    }`}
                  >
                    Landslide / Slippage
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportType('toll_delay')}
                    className={`p-2 rounded-xl border text-center font-bold text-xs cursor-pointer ${
                      reportType === 'toll_delay'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 border-gray-200 text-gray-700'
                    }`}
                  >
                    Toll Gate Queue
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#171318] block mb-1">Details & Advice for Other Drivers *</label>
                <textarea
                  rows={3}
                  value={reportDesc}
                  onChange={(e) => setReportDesc(e.target.value)}
                  placeholder="e.g. Overturned trailer in right lane. Left lane is moving slowly. Expect 30 mins delay."
                  className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-300 focus:border-[#E83E83] focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] text-white font-bold shadow-md shadow-[#E83E83]/30 cursor-pointer"
                >
                  Broadcast Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
