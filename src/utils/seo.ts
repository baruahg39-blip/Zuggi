import { LoadItem } from '../types';
import { VEHICLE_CATEGORIES } from '../data/mockData';

export interface ClientSeoConfig {
  title: string;
  description: string;
  canonicalPath?: string;
  ogType?: 'website' | 'product';
  ogImage?: string;
  robots?: string;
  jsonLd?: Record<string, any> | null;
}

export interface PublicFreightItem {
  id: string;
  pickupCity: string;
  pickupDistrict?: string;
  pickupState: string;
  pickupPincode?: string;
  deliveryCity: string;
  deliveryDistrict?: string;
  deliveryState: string;
  deliveryPincode?: string;
  goodsCategory: string;
  goodsCategoryLabel: string;
  goodsDescription: string;
  weightKg: number;
  packageCount?: number;
  requiredVehicleCategory: string;
  requiredVehicleName: string;
  requiredBodyType?: string;
  loadType: 'full_load' | 'part_load';
  pricingMode?: string;
  targetBudgetInr: number;
  estimatedDistanceKm: number;
  estimatedDurationHours?: number;
  pickupDateTime?: string;
  expectedDeliveryDateTime?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  matchedVehicleCount?: number;
  coveredTruck?: boolean;
  refrigerationNeeded?: boolean;
  fragile?: boolean;
}

const GOODS_LABELS: Record<string, string> = {
  agriculture_produce: 'Agricultural Produce',
  tea_packaged_bulk: 'Tea (Packaged & Bulk)',
  building_materials_cement: 'Building Materials & Steel',
  fmcg_groceries: 'FMCG & Groceries',
  furniture_household: 'Furniture & Household',
  electronics_appliances: 'Electronics & Appliances',
  industrial_machinery: 'Industrial Machinery',
  pharmaceuticals_medical: 'Pharmaceuticals & Medical',
  textiles_garments: 'Textiles & Garments',
  automobiles_spares: 'Automobiles & Spares',
  plastics_packaging: 'Plastics & Packaging',
  general_commercial: 'General Commercial Freight'
};

export function getVehicleLabel(categoryId: string): string {
  const found = VEHICLE_CATEGORIES.find((v) => v.id === categoryId);
  return found ? found.name : categoryId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getGoodsCategoryLabel(category: string): string {
  return (
    GOODS_LABELS[category] ||
    String(category || 'Commercial Freight')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function loadItemToPublicFreight(load: LoadItem): PublicFreightItem {
  return {
    id: load.id,
    pickupCity: load.pickup.city,
    pickupDistrict: load.pickup.district,
    pickupState: load.pickup.state,
    pickupPincode: load.pickup.pincode,
    deliveryCity: load.delivery.city,
    deliveryDistrict: load.delivery.district,
    deliveryState: load.delivery.state,
    deliveryPincode: load.delivery.pincode,
    goodsCategory: load.goodsCategory,
    goodsCategoryLabel: getGoodsCategoryLabel(load.goodsCategory),
    goodsDescription: load.goodsDescription,
    weightKg: load.weightKg,
    packageCount: load.packageCount,
    requiredVehicleCategory: load.requiredVehicleCategory,
    requiredVehicleName: getVehicleLabel(load.requiredVehicleCategory),
    requiredBodyType: load.requiredBodyType,
    loadType: load.loadType,
    pricingMode: load.pricingMode,
    targetBudgetInr: load.targetBudgetInr || 0,
    estimatedDistanceKm: load.estimatedDistanceKm,
    estimatedDurationHours: load.estimatedDurationHours,
    pickupDateTime: load.pickupDateTime,
    expectedDeliveryDateTime: load.expectedDeliveryDateTime,
    status: load.status,
    createdAt: load.createdAt,
    updatedAt: load.createdAt,
    matchedVehicleCount: load.matchedVehicleCount,
    coveredTruck: load.specialRequirements?.coveredTruck,
    refrigerationNeeded: load.specialRequirements?.refrigerationNeeded,
    fragile: load.specialRequirements?.fragile
  };
}

export function navigateSpa(path: string): void {
  if (typeof window === 'undefined') return;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (window.location.pathname !== normalized) {
    window.history.pushState({}, '', normalized);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function upsertMetaTag(attrName: 'name' | 'property', attrValue: string, content: string): void {
  if (typeof document === 'undefined') return;
  let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(url: string): void {
  if (typeof document === 'undefined') return;
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

export function upsertDynamicJsonLd(jsonLd: Record<string, any> | null): void {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('zuggi-dynamic-jsonld');
  if (!jsonLd) {
    if (existing) existing.remove();
    return;
  }
  const script = existing || document.createElement('script');
  script.id = 'zuggi-dynamic-jsonld';
  script.setAttribute('type', 'application/ld+json');
  script.textContent = JSON.stringify(jsonLd);
  if (!existing) {
    document.head.appendChild(script);
  }
}

export function applyClientSeo(config: ClientSeoConfig): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const origin = window.location.origin;
  const canonicalPath = config.canonicalPath ?? window.location.pathname;
  const normalizedPath = canonicalPath === '/' ? '/' : canonicalPath.replace(/\/+$/, '');
  const canonicalUrl = `${origin}${normalizedPath}`;
  const ogImage = config.ogImage || `${origin}/og-zuggi.jpg`;
  const ogType = config.ogType || 'website';

  document.title = config.title;
  upsertCanonical(canonicalUrl);

  upsertMetaTag('name', 'title', config.title);
  upsertMetaTag('name', 'description', config.description);
  if (config.robots) {
    upsertMetaTag('name', 'robots', config.robots);
  }

  upsertMetaTag('property', 'og:type', ogType);
  upsertMetaTag('property', 'og:url', canonicalUrl);
  upsertMetaTag('property', 'og:title', config.title);
  upsertMetaTag('property', 'og:description', config.description);
  upsertMetaTag('property', 'og:image', ogImage);

  upsertMetaTag('name', 'twitter:url', canonicalUrl);
  upsertMetaTag('name', 'twitter:title', config.title);
  upsertMetaTag('name', 'twitter:description', config.description);
  upsertMetaTag('name', 'twitter:image', ogImage);

  if (config.jsonLd !== undefined) {
    upsertDynamicJsonLd(config.jsonLd);
  }
}

export function buildClientFreightListingJsonLd(item: PublicFreightItem): Record<string, any> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://zuggi.in';
  const canonicalUrl = `${origin}/freight/${encodeURIComponent(item.id)}`;
  const isOpen = item.status === 'posted' || item.status === 'bidding';
  const weightTonnes = (item.weightKg / 1000).toFixed(item.weightKg >= 1000 ? 1 : 2);

  const offerNode: Record<string, any> = {
    '@type': 'Offer',
    url: canonicalUrl,
    priceCurrency: 'INR',
    availability: isOpen ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
    validFrom: item.createdAt || new Date().toISOString(),
    itemCondition: 'https://schema.org/NewCondition',
    seller: {
      '@type': 'Organization',
      name: 'Zuggi Freight',
      url: `${origin}/`
    }
  };
  if (item.targetBudgetInr > 0) {
    offerNode.price = String(Math.round(item.targetBudgetInr));
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['Service', 'Product'],
        '@id': `${canonicalUrl}#freight-listing`,
        sku: item.id,
        identifier: item.id,
        name: `${item.pickupCity} to ${item.deliveryCity} Freight Load — ${item.weightKg.toLocaleString('en-IN')} kg ${item.goodsCategoryLabel}`,
        description: `${item.goodsDescription}. Commercial freight from ${item.pickupCity}, ${item.pickupState} to ${item.deliveryCity}, ${item.deliveryState} (${item.estimatedDistanceKm} km). Required truck: ${item.requiredVehicleName}. Weight: ${item.weightKg} kg (${weightTonnes} MT).`,
        serviceType: 'Commercial Goods Transportation & Freight Listing',
        category: `${item.goodsCategoryLabel} / ${item.requiredVehicleName}`,
        image: `${origin}/og-zuggi.jpg`,
        url: canonicalUrl,
        brand: {
          '@type': 'Brand',
          name: 'Zuggi Freight'
        },
        provider: {
          '@type': 'Organization',
          '@id': `${origin}/#organization`,
          name: 'Zuggi Freight',
          url: `${origin}/`
        },
        areaServed: [
          { '@type': 'City', name: item.pickupCity },
          { '@type': 'City', name: item.deliveryCity }
        ],
        offers: offerNode,
        additionalProperty: [
          { '@type': 'PropertyValue', name: 'Origin City', value: `${item.pickupCity}, ${item.pickupState}` },
          { '@type': 'PropertyValue', name: 'Destination City', value: `${item.deliveryCity}, ${item.deliveryState}` },
          { '@type': 'PropertyValue', name: 'Cargo Weight', value: `${item.weightKg} kg (${weightTonnes} MT)` },
          { '@type': 'PropertyValue', name: 'Estimated Distance', value: `${item.estimatedDistanceKm} km` },
          { '@type': 'PropertyValue', name: 'Required Vehicle', value: item.requiredVehicleName },
          { '@type': 'PropertyValue', name: 'Load Type', value: item.loadType === 'part_load' ? 'Part Truck Load (PTL)' : 'Full Truck Load (FTL)' }
        ]
      },
      {
        '@type': 'ParcelDelivery',
        '@id': `${canonicalUrl}#delivery-route`,
        provider: {
          '@type': 'Organization',
          name: 'Zuggi Freight'
        },
        originAddress: {
          '@type': 'PostalAddress',
          addressLocality: item.pickupCity,
          addressRegion: item.pickupState,
          ...(item.pickupPincode ? { postalCode: item.pickupPincode } : {}),
          addressCountry: 'IN'
        },
        deliveryAddress: {
          '@type': 'PostalAddress',
          addressLocality: item.deliveryCity,
          addressRegion: item.deliveryState,
          ...(item.deliveryPincode ? { postalCode: item.deliveryPincode } : {}),
          addressCountry: 'IN'
        },
        ...(item.pickupDateTime ? { expectedArrivalFrom: item.pickupDateTime } : {}),
        ...(item.expectedDeliveryDateTime ? { expectedArrivalUntil: item.expectedDeliveryDateTime } : {}),
        itemShipped: {
          '@type': 'Product',
          name: item.goodsDescription
        }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Live Freight Listings', item: `${origin}/freight` },
          {
            '@type': 'ListItem',
            position: 3,
            name: `${item.pickupCity} to ${item.deliveryCity}`,
            item: canonicalUrl
          }
        ]
      }
    ]
  };
}

export function buildClientFreightDirectoryJsonLd(items: PublicFreightItem[]): Record<string, any> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://zuggi.in';
  const directoryUrl = `${origin}/freight`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        url: directoryUrl,
        name: 'Live Freight Listings & Truck Loads | Zuggi India',
        description:
          'Active commercial truck loads across Assam, Northeast India & Pan-India with direct transporter bidding and escrow protection.'
      },
      {
        '@type': 'ItemList',
        name: 'Active Freight Listings on Zuggi',
        numberOfItems: items.length,
        itemListElement: items.slice(0, 50).map((item, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          url: `${origin}/freight/${encodeURIComponent(item.id)}`,
          name: `${item.pickupCity} to ${item.deliveryCity} — ${item.weightKg} kg ${item.goodsCategoryLabel}`,
          item: {
            '@type': 'Service',
            name: `${item.pickupCity} to ${item.deliveryCity} Freight (${item.requiredVehicleName})`,
            description: item.goodsDescription,
            url: `${origin}/freight/${encodeURIComponent(item.id)}`,
            ...(item.targetBudgetInr > 0
              ? {
                  offers: {
                    '@type': 'Offer',
                    price: String(Math.round(item.targetBudgetInr)),
                    priceCurrency: 'INR',
                    availability:
                      item.status === 'posted' || item.status === 'bidding'
                        ? 'https://schema.org/InStock'
                        : 'https://schema.org/SoldOut'
                  }
                }
              : {})
          }
        }))
      }
    ]
  };
}
