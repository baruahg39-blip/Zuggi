import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  MapPin,
  Settings2,
  CheckCircle2,
  LogIn,
  LogOut,
  Clock,
  Sliders,
  BellRing
} from 'lucide-react';
import { GeofenceEvent, GeofenceZoneConfig, GeofenceZoneState } from '../../types';
import { formatMetersOrKm } from '../../utils/geofence';

interface GeofenceMonitorPanelProps {
  tripId: string;
  pickupCity: string;
  deliveryCity: string;
  config: GeofenceZoneConfig;
  state: GeofenceZoneState;
  events: GeofenceEvent[];
  canEditConfig?: boolean;
  darkTheme?: boolean;
  onSaveConfig?: (next: Partial<GeofenceZoneConfig>) => Promise<void> | void;
}

export const GeofenceMonitorPanel: React.FC<GeofenceMonitorPanelProps> = ({
  pickupCity,
  deliveryCity,
  config,
  state,
  events,
  canEditConfig = true,
  darkTheme = false,
  onSaveConfig
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [pickupRadius, setPickupRadius] = useState(config.pickupRadiusMeters);
  const [deliveryRadius, setDeliveryRadius] = useState(config.deliveryRadiusMeters);
  const [autoUpdateStatus, setAutoUpdateStatus] = useState(config.autoUpdateStatus);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPickupRadius(config.pickupRadiusMeters);
    setDeliveryRadius(config.deliveryRadiusMeters);
    setAutoUpdateStatus(config.autoUpdateStatus);
  }, [config.pickupRadiusMeters, config.deliveryRadiusMeters, config.autoUpdateStatus]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveConfig) return;
    setIsSaving(true);
    try {
      await onSaveConfig({
        pickupRadiusMeters: pickupRadius,
        deliveryRadiusMeters: deliveryRadius,
        autoUpdateStatus
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const containerCls = darkTheme
    ? 'bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-5 shadow-xl space-y-4'
    : 'bg-white border border-gray-200 text-[#171318] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4';

  const cardBgCls = darkTheme
    ? 'bg-slate-950/90 border-slate-800'
    : 'bg-gray-50 border-gray-200';

  return (
    <div className={containerCls}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FFF0F6] text-[#E83E83] border border-[#F4A7C5] flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black tracking-tight">Geo-Fence Zone Monitor</h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  config.autoUpdateStatus
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {config.autoUpdateStatus ? 'Auto-Status ON' : 'Alerts Only'}
              </span>
            </div>
            <p className={`text-[11px] ${darkTheme ? 'text-slate-400' : 'text-gray-500'}`}>
              Triggers instant notifications & milestone progression upon Pickup or Delivery perimeter crossings.
            </p>
          </div>
        </div>

        {canEditConfig && onSaveConfig && (
          <button
            type="button"
            onClick={() => setIsEditing((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              darkTheme
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-[#E83E83]" />
            <span>{isEditing ? 'Close Rules' : 'Configure Radii'}</span>
          </button>
        )}
      </div>

      {/* Zone Containment Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className={`p-3.5 rounded-2xl border transition ${
          state.insidePickup
            ? darkTheme
              ? 'bg-emerald-950/50 border-emerald-700/80'
              : 'bg-emerald-50 border-emerald-300'
            : cardBgCls
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-500" />
              <span>Pickup: {pickupCity}</span>
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
              state.insidePickup
                ? 'bg-emerald-600 text-white'
                : darkTheme ? 'bg-slate-800 text-slate-400' : 'bg-gray-200 text-gray-600'
            }`}>
              {state.insidePickup ? 'Inside Zone' : 'Outside Zone'}
            </span>
          </div>
          <div className={`flex items-center justify-between text-[11px] ${darkTheme ? 'text-slate-400' : 'text-gray-500'}`}>
            <span>Radius: <strong className={darkTheme ? 'text-white' : 'text-[#171318]'}>{formatMetersOrKm(config.pickupRadiusMeters)}</strong></span>
            <span>Distance: <strong className="font-mono">{formatMetersOrKm(state.distanceToPickupMeters)}</strong></span>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border transition ${
          state.insideDelivery
            ? darkTheme
              ? 'bg-pink-950/40 border-pink-700/80'
              : 'bg-[#FFF0F6] border-[#E83E83]'
            : cardBgCls
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#E83E83]" />
              <span>Delivery: {deliveryCity}</span>
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
              state.insideDelivery
                ? 'bg-[#E83E83] text-white'
                : darkTheme ? 'bg-slate-800 text-slate-400' : 'bg-gray-200 text-gray-600'
            }`}>
              {state.insideDelivery ? 'Inside Zone' : 'Outside Zone'}
            </span>
          </div>
          <div className={`flex items-center justify-between text-[11px] ${darkTheme ? 'text-slate-400' : 'text-gray-500'}`}>
            <span>Radius: <strong className={darkTheme ? 'text-white' : 'text-[#171318]'}>{formatMetersOrKm(config.deliveryRadiusMeters)}</strong></span>
            <span>Distance: <strong className="font-mono">{formatMetersOrKm(state.distanceToDeliveryMeters)}</strong></span>
          </div>
        </div>
      </div>

      {/* Inline Zone Radius Configuration Editor */}
      {isEditing && onSaveConfig && (
        <form onSubmit={handleSave} className={`p-4 rounded-2xl border space-y-3 text-xs ${cardBgCls}`}>
          <div className="flex items-center gap-1.5 font-bold text-[#E83E83]">
            <Settings2 className="w-3.5 h-3.5" />
            <span>Perimeter Rules & Automation</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1 block">
              <div className="flex justify-between">
                <span className="font-semibold">Pickup Zone Radius</span>
                <span className="font-mono font-bold text-emerald-600">{formatMetersOrKm(pickupRadius)}</span>
              </div>
              <input
                type="range"
                min={200}
                max={5000}
                step={50}
                value={pickupRadius}
                onChange={(e) => setPickupRadius(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
            </label>

            <label className="space-y-1 block">
              <div className="flex justify-between">
                <span className="font-semibold">Delivery Zone Radius</span>
                <span className="font-mono font-bold text-[#E83E83]">{formatMetersOrKm(deliveryRadius)}</span>
              </div>
              <input
                type="range"
                min={200}
                max={5000}
                step={50}
                value={deliveryRadius}
                onChange={(e) => setDeliveryRadius(Number(e.target.value))}
                className="w-full accent-[#E83E83]"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={autoUpdateStatus}
              onChange={(e) => setAutoUpdateStatus(e.target.checked)}
              className="rounded accent-[#E83E83] w-4 h-4"
            />
            <span className="font-medium">
              Automatically advance trip status (AT_PICKUP / IN_TRANSIT / AT_DESTINATION) when vehicle crosses zone boundary
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 rounded-xl bg-gray-200 text-gray-800 font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 rounded-xl bg-[#E83E83] hover:bg-[#d62c72] text-white font-bold cursor-pointer disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save Geo-Fence Rules'}
            </button>
          </div>
        </form>
      )}

      {/* Chronological Boundary Crossing Events Feed */}
      <div className="space-y-2">
        <div className={`text-[10px] font-black uppercase tracking-wider flex items-center justify-between ${darkTheme ? 'text-slate-400' : 'text-gray-400'}`}>
          <span>Boundary Crossing Events ({events.length})</span>
          {state.lastCheckedAt && (
            <span className="font-normal">
              Last Checked: {new Date(state.lastCheckedAt).toLocaleTimeString('en-IN')}
            </span>
          )}
        </div>

        {events.length === 0 ? (
          <div className={`p-3 rounded-2xl border text-xs flex items-center gap-2 ${cardBgCls} ${darkTheme ? 'text-slate-400' : 'text-gray-500'}`}>
            <Clock className="w-4 h-4 shrink-0" />
            <span>No boundary crossings triggered yet. Alerts fire once upon entering or exiting a zone.</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {events.slice(0, 12).map((evt) => {
              const isEnter = evt.transition === 'ENTERED';
              const isWarning = evt.zoneType === 'delivery' && !isEnter && !evt.autoUpdatedStatus;
              return (
                <div
                  key={evt.id}
                  className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
                    isWarning
                      ? darkTheme
                        ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                      : cardBgCls
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isWarning
                        ? 'bg-rose-600 text-white'
                        : isEnter
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isWarning ? (
                      <ShieldAlert className="w-3.5 h-3.5" />
                    ) : isEnter ? (
                      <LogIn className="w-3.5 h-3.5" />
                    ) : (
                      <LogOut className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold truncate">{evt.zoneLabel}</span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                          isWarning
                            ? 'bg-rose-600 text-white'
                            : isEnter
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-500 text-slate-950'
                        }`}
                      >
                        {evt.transition}
                      </span>
                    </div>
                    <p className={`text-[11px] mt-0.5 leading-snug ${darkTheme ? 'text-slate-300' : 'text-gray-600'}`}>
                      {evt.message}
                    </p>
                    <div className={`flex flex-wrap items-center gap-2 mt-1 text-[10px] ${darkTheme ? 'text-slate-500' : 'text-gray-400'}`}>
                      <span>{new Date(evt.timestamp).toLocaleString('en-IN')}</span>
                      {evt.autoUpdatedStatus && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          Auto-Status: {evt.autoUpdatedStatus.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
