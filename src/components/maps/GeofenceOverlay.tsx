import React, { useEffect, useRef } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

interface GeofenceOverlayProps {
  pickup: { lat: number; lng: number; city?: string };
  delivery: { lat: number; lng: number; city?: string };
  pickupRadiusMeters?: number;
  deliveryRadiusMeters?: number;
  insidePickup?: boolean;
  insideDelivery?: boolean;
}

/**
 * Renders interactive circular pickup and delivery geo-fence zones
 * directly on the Google Map using @vis.gl/react-google-maps hooks.
 */
export const GeofenceOverlay: React.FC<GeofenceOverlayProps> = ({
  pickup,
  delivery,
  pickupRadiusMeters = 800,
  deliveryRadiusMeters = 500,
  insidePickup = false,
  insideDelivery = false
}) => {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const pickupCircleRef = useRef<google.maps.Circle | null>(null);
  const deliveryCircleRef = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!map || !mapsLib) return;

    if (pickupCircleRef.current) {
      pickupCircleRef.current.setMap(null);
      pickupCircleRef.current = null;
    }
    if (deliveryCircleRef.current) {
      deliveryCircleRef.current.setMap(null);
      deliveryCircleRef.current = null;
    }

    pickupCircleRef.current = new mapsLib.Circle({
      map,
      center: { lat: pickup.lat, lng: pickup.lng },
      radius: Math.max(150, pickupRadiusMeters),
      strokeColor: '#10B981',
      strokeOpacity: insidePickup ? 0.95 : 0.75,
      strokeWeight: insidePickup ? 3 : 2,
      fillColor: '#10B981',
      fillOpacity: insidePickup ? 0.24 : 0.12,
      clickable: false,
      zIndex: 1
    });

    deliveryCircleRef.current = new mapsLib.Circle({
      map,
      center: { lat: delivery.lat, lng: delivery.lng },
      radius: Math.max(150, deliveryRadiusMeters),
      strokeColor: '#E83E83',
      strokeOpacity: insideDelivery ? 0.95 : 0.75,
      strokeWeight: insideDelivery ? 3 : 2,
      fillColor: '#E83E83',
      fillOpacity: insideDelivery ? 0.24 : 0.12,
      clickable: false,
      zIndex: 1
    });

    return () => {
      if (pickupCircleRef.current) {
        pickupCircleRef.current.setMap(null);
        pickupCircleRef.current = null;
      }
      if (deliveryCircleRef.current) {
        deliveryCircleRef.current.setMap(null);
        deliveryCircleRef.current = null;
      }
    };
  }, [
    map,
    mapsLib,
    pickup.lat,
    pickup.lng,
    delivery.lat,
    delivery.lng,
    pickupRadiusMeters,
    deliveryRadiusMeters,
    insidePickup,
    insideDelivery
  ]);

  return null;
};
