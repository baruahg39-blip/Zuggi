import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react';
import { Booking, CommercialVehicle, LoadItem } from '../../types';
import { GUWAHATI_DEFAULT_CENTER, OSM_TILE_ATTRIBUTION, OSM_TILE_URL } from '../../services/osmMapService';

interface AdminFleetRadarMapProps {
  vehicles: CommercialVehicle[];
  loads: LoadItem[];
  bookings: Booking[];
  onUnblockVehicle: (vehicleId: string) => void;
  onRequestBlockVehicle: (vehicle: CommercialVehicle) => void;
  onRequestBlockLoad: (load: LoadItem) => void;
  onOpenLiveTrack: (booking: Booking) => void;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function makeRadarPin(glyph: string, bg: string, borderColor: string, label?: string): L.DivIcon {
  const safeLabel = label ? escapeHtml(label.slice(0, 14)) : '';
  return L.divIcon({
    className: 'zuggi-admin-radar-pin',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);pointer-events:auto;">
        ${
          safeLabel
            ? `<div style="background:#171318;color:#fff;font-size:9px;font-weight:800;padding:1px 6px;border-radius:9999px;white-space:nowrap;margin-bottom:2px;box-shadow:0 2px 5px rgba(0,0,0,0.3);font-family:ui-monospace,monospace;">${safeLabel}</div>`
            : ''
        }
        <div style="width:28px;height:28px;border-radius:9999px;background:${bg};border:2.5px solid ${borderColor};box-shadow:0 3px 10px rgba(0,0,0,0.32);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:900;">
          ${escapeHtml(glyph)}
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [0, 0]
  });
}

export const AdminFleetRadarMap: React.FC<AdminFleetRadarMapProps> = ({
  vehicles,
  loads,
  bookings,
  onUnblockVehicle,
  onRequestBlockVehicle,
  onRequestBlockLoad,
  onOpenLiveTrack
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [selectedVehicle, setSelectedVehicle] = useState<CommercialVehicle | null>(null);
  const [selectedLoad, setSelectedLoad] = useState<LoadItem | null>(null);

  // Initialize Leaflet OSM Map centered on Assam
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: [26.25, 92.9],
      zoom: 7,
      zoomControl: false,
      attributionControl: true
    });

    L.tileLayer(OSM_TILE_URL, {
      maxZoom: 19,
      attribution: OSM_TILE_ATTRIBUTION
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    const timer = setTimeout(() => map.invalidateSize(), 150);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => map.invalidateSize()) : null;
    if (resizeObserver) resizeObserver.observe(el);

    return () => {
      clearTimeout(timer);
      resizeObserver?.disconnect();
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Render Vehicles, Open Loads, and Active Booking Geofences
  useEffect(() => {
    const layer = layerGroupRef.current;
    if (!layer) return;

    layer.clearLayers();

    // Active booking geofence circles
    bookings
      .filter((b) =>
        ['assigned', 'en_route_pickup', 'at_pickup', 'loading', 'in_transit', 'at_destination'].includes(b.status)
      )
      .forEach((b) => {
        if (Number.isFinite(b.pickup?.lat) && Number.isFinite(b.pickup?.lng)) {
          L.circle([b.pickup.lat, b.pickup.lng], {
            radius: Math.max(150, b.geofenceConfig?.pickupRadiusMeters || 800),
            color: '#10B981',
            weight: 1.5,
            dashArray: '4 4',
            fillColor: '#10B981',
            fillOpacity: b.geofenceState?.insidePickup ? 0.22 : 0.1
          }).addTo(layer);
        }
        if (Number.isFinite(b.delivery?.lat) && Number.isFinite(b.delivery?.lng)) {
          L.circle([b.delivery.lat, b.delivery.lng], {
            radius: Math.max(150, b.geofenceConfig?.deliveryRadiusMeters || 500),
            color: '#E83E83',
            weight: 1.5,
            dashArray: '4 4',
            fillColor: '#E83E83',
            fillOpacity: b.geofenceState?.insideDelivery ? 0.22 : 0.1
          }).addTo(layer);
        }
      });

    // Vehicle Pins
    vehicles.forEach((v) => {
      const pos = v.currentLocation || GUWAHATI_DEFAULT_CENTER;
      if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return;
      const bg = v.isBlocked
        ? '#DC3545'
        : !v.isOnline
        ? '#6B7280'
        : v.isAvailable
        ? '#16A36A'
        : '#E9A23B';

      const marker = L.marker([pos.lat, pos.lng], {
        icon: makeRadarPin('T', bg, '#171318', v.registrationNumber)
      }).addTo(layer);

      marker.on('click', () => {
        setSelectedLoad(null);
        setSelectedVehicle(v);
      });
    });

    // Open Load Pins
    loads
      .filter((l) => l.status !== 'completed' && l.status !== 'cancelled')
      .forEach((l) => {
        if (!Number.isFinite(l.pickup?.lat) || !Number.isFinite(l.pickup?.lng)) return;
        const marker = L.marker([l.pickup.lat, l.pickup.lng], {
          icon: makeRadarPin('L', l.isBlocked ? '#DC3545' : '#E83E83', '#FFFFFF', l.pickup.city)
        }).addTo(layer);

        marker.on('click', () => {
          setSelectedVehicle(null);
          setSelectedLoad(l);
        });
      });
  }, [vehicles, loads, bookings]);

  const handleResetView = () => {
    mapRef.current?.setView([26.25, 92.9], 7, { animate: true });
  };

  return (
    <div className="relative w-full h-full bg-[#E8EEF4]">
      <div ref={containerRef} className="w-full h-full z-0" />

      {/* Map Controls */}
      <div className="absolute right-3 bottom-4 z-[400] flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white border border-gray-300 flex items-center justify-center text-[#171318] shadow-md cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white border border-gray-300 flex items-center justify-center text-[#171318] shadow-md cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white border border-gray-300 flex items-center justify-center text-[#171318] shadow-md cursor-pointer"
          title="Reset Assam & NE View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Selected Vehicle Inspection Card */}
      {selectedVehicle && (
        <div className="absolute top-3 left-3 z-[420] bg-white rounded-2xl border border-gray-200 shadow-xl p-3.5 text-xs space-y-1.5 max-w-[260px]">
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono font-black text-sm text-[#171318]">
              {selectedVehicle.registrationNumber}
            </div>
            <button
              type="button"
              onClick={() => setSelectedVehicle(null)}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-gray-600">
            {selectedVehicle.modelName} • {selectedVehicle.driverName || selectedVehicle.transporterName}
          </div>
          <div className="text-gray-500">
            {selectedVehicle.currentLocation?.address || selectedVehicle.currentLocation?.city || 'Assam Corridor'}
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            {selectedVehicle.isBlocked ? (
              <button
                type="button"
                onClick={() => {
                  onUnblockVehicle(selectedVehicle.id);
                  setSelectedVehicle(null);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[#16A36A] text-white font-bold cursor-pointer"
              >
                Unblock Truck
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onRequestBlockVehicle(selectedVehicle);
                  setSelectedVehicle(null);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[#DC3545] text-white font-bold cursor-pointer"
              >
                Block Truck
              </button>
            )}
          </div>
        </div>
      )}

      {/* Selected Load Inspection Card */}
      {selectedLoad && (
        <div className="absolute top-3 left-3 z-[420] bg-white rounded-2xl border border-gray-200 shadow-xl p-3.5 text-xs space-y-1.5 max-w-[270px]">
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono font-bold text-[#E83E83]">#{selectedLoad.id}</div>
            <button
              type="button"
              onClick={() => setSelectedLoad(null)}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="font-bold text-[#171318]">
            {selectedLoad.pickup.city} → {selectedLoad.delivery.city}
          </div>
          <div className="text-gray-600 line-clamp-2">{selectedLoad.goodsDescription}</div>
          <div className="flex items-center gap-1.5 pt-1">
            {selectedLoad.assignedBookingId && (
              <button
                type="button"
                onClick={() => {
                  const b = bookings.find((bk) => bk.id === selectedLoad.assignedBookingId);
                  if (b) onOpenLiveTrack(b);
                  setSelectedLoad(null);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[#171318] text-white font-bold cursor-pointer"
              >
                Live Track
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onRequestBlockLoad(selectedLoad);
                setSelectedLoad(null);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-[#DC3545] text-white font-bold cursor-pointer"
            >
              Block Load
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
