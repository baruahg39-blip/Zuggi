/**
 * Zuggi Freight — Server-Side SEO Engine
 * - Site-wide dynamic XML sitemap generator (/sitemap.xml, /sitemap-freight.xml)
 * - Route-specific meta tags, canonical URLs, OpenGraph & Twitter Cards
 * - Schema.org JSON-LD Structured Data for individual freight listings,
 *   freight directory, freight corridors, and vehicle categories
 * - Crawler-ready semantic HTML pre-render injection
 */

export interface PublicFreightListing {
  id: string;
  pickupCity: string;
  pickupDistrict: string;
  pickupState: string;
  pickupPincode: string;
  deliveryCity: string;
  deliveryDistrict: string;
  deliveryState: string;
  deliveryPincode: string;
  goodsCategory: string;
  goodsCategoryLabel: string;
  goodsDescription: string;
  weightKg: number;
  packageCount: number;
  requiredVehicleCategory: string;
  requiredVehicleName: string;
  requiredBodyType: string;
  loadType: 'full_load' | 'part_load';
  pricingMode: string;
  targetBudgetInr: number;
  estimatedDistanceKm: number;
  estimatedDurationHours: number;
  pickupDateTime: string;
  expectedDeliveryDateTime: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  matchedVehicleCount: number;
  coveredTruck: boolean;
  refrigerationNeeded: boolean;
  fragile: boolean;
}

export interface SeoVehicleCategory {
  id: string;
  name: string;
  capacityKg: number;
  capacityTonnes: number;
  dimensions: string;
  basePricePerKm: number;
  minBasePrice: number;
  idealFor: string;
  bodyTypes: string[];
}

export interface SeoCorridor {
  slug: string;
  originCity: string;
  originState: string;
  destinationCity: string;
  destinationState: string;
  distanceKm: number;
  transitHours: string;
  highway: string;
  startingFareInr: number;
  popularCargo: string;
  recommendedVehicles: string[];
}

export interface ResolvedRouteSeo {
  title: string;
  description: string;
  canonicalUrl: string;
  ogType: 'website' | 'product';
  ogImage: string;
  robots: string;
  jsonLd: Record<string, any> | null;
  prerenderHtml: string | null;
  httpStatus?: number;
}

export const SEO_VEHICLE_CATEGORIES: SeoVehicleCategory[] = [
  {
    id: 'three_wheeler',
    name: '3-Wheeler Cargo',
    capacityKg: 500,
    capacityTonnes: 0.5,
    dimensions: '5.5ft × 4.0ft × 4.0ft',
    basePricePerKm: 18,
    minBasePrice: 350,
    idealFor: 'Local city delivery, fruits, vegetables, small retail cartons, and FMCG dispatches',
    bodyTypes: ['Open', 'Tarpaulin']
  },
  {
    id: 'tata_ace',
    name: 'Tata Ace (Chota Hathi)',
    capacityKg: 850,
    capacityTonnes: 0.85,
    dimensions: '7.0ft × 4.8ft × 5.0ft',
    basePricePerKm: 24,
    minBasePrice: 650,
    idealFor: 'Intra-city and inter-town loads, furniture, building hardware, and grocery boxes',
    bodyTypes: ['Open', 'Closed Container', 'Tarpaulin']
  },
  {
    id: 'bolero_pickup',
    name: 'Mahindra Bolero Maxi Truck',
    capacityKg: 1300,
    capacityTonnes: 1.3,
    dimensions: '8.2ft × 5.2ft × 5.5ft',
    basePricePerKm: 29,
    minBasePrice: 950,
    idealFor: 'Rural and hilly corridors (Shillong, Dimapur), construction sand, cement, and farm produce',
    bodyTypes: ['Open', 'Tarpaulin']
  },
  {
    id: 'ashok_leyland_dost',
    name: 'Ashok Leyland Dost+',
    capacityKg: 1500,
    capacityTonnes: 1.5,
    dimensions: '9.8ft × 5.3ft × 6.0ft',
    basePricePerKm: 32,
    minBasePrice: 1100,
    idealFor: 'Electronic goods, tea bags, wholesale distributors, and packaged textiles',
    bodyTypes: ['Open', 'Closed Container', 'Tarpaulin']
  },
  {
    id: 'tata_407',
    name: 'Tata 407 LCV',
    capacityKg: 2500,
    capacityTonnes: 2.5,
    dimensions: '10.0ft × 6.5ft × 6.5ft',
    basePricePerKm: 38,
    minBasePrice: 1600,
    idealFor: 'Heavy retail cargo, mid-distance state highways, and corrugated wholesale cartons',
    bodyTypes: ['Open', 'Closed Container', 'Tarpaulin']
  },
  {
    id: 'eicher_14ft',
    name: 'Eicher Pro 14ft Truck',
    capacityKg: 4000,
    capacityTonnes: 4.0,
    dimensions: '14.0ft × 6.8ft × 7.0ft',
    basePricePerKm: 46,
    minBasePrice: 2400,
    idealFor: 'Inter-district bulk transport, plywood, packaged fertilizers, and FMCG stockists',
    bodyTypes: ['Open', 'Closed Container', 'Tarpaulin']
  },
  {
    id: 'eicher_17ft',
    name: 'Eicher Pro 17ft Medium Truck',
    capacityKg: 6500,
    capacityTonnes: 6.5,
    dimensions: '17.0ft × 7.2ft × 7.5ft',
    basePricePerKm: 54,
    minBasePrice: 3200,
    idealFor: 'Assam orthodox & CTC tea crates, TMT iron rods, PVC pipes, and industrial machinery',
    bodyTypes: ['Open', 'Closed Container', 'Tarpaulin']
  },
  {
    id: 'truck_20ft',
    name: 'BharatBenz 20ft / 24ft Heavy Truck',
    capacityKg: 10000,
    capacityTonnes: 10.0,
    dimensions: '22.0ft × 7.8ft × 8.0ft',
    basePricePerKm: 68,
    minBasePrice: 5500,
    idealFor: 'Cement bags, structural steel, and long-haul inter-state corridor freight',
    bodyTypes: ['Open', 'Closed Container', 'Flatbed']
  },
  {
    id: 'container_32ft',
    name: '32ft Multi-Axle Container (SXL/MXL)',
    capacityKg: 15000,
    capacityTonnes: 15.0,
    dimensions: '32.0ft × 8.0ft × 8.5ft',
    basePricePerKm: 85,
    minBasePrice: 9000,
    idealFor: 'E-commerce white goods, high-value FMCG, and pharmaceutical national supply chains',
    bodyTypes: ['Closed Container']
  },
  {
    id: 'reefer_cold_chain',
    name: 'Refrigerated Reefer Truck',
    capacityKg: 7000,
    capacityTonnes: 7.0,
    dimensions: '18.0ft × 7.5ft × 7.5ft',
    basePricePerKm: 75,
    minBasePrice: 6000,
    idealFor: 'Vaccines, fresh dairy, perishables, and temperature-controlled cold chain freight',
    bodyTypes: ['Refrigerated']
  }
];

export const SEO_CORRIDORS: SeoCorridor[] = [
  {
    slug: 'guwahati-to-dibrugarh',
    originCity: 'Guwahati',
    originState: 'Assam',
    destinationCity: 'Dibrugarh',
    destinationState: 'Assam',
    distanceKm: 442,
    transitHours: '9–11 hrs',
    highway: 'NH-27 & NH-37 (Upper Assam Corridor)',
    startingFareInr: 14500,
    popularCargo: 'FMCG, tea garden equipment, construction steel, pharmaceuticals & industrial machinery',
    recommendedVehicles: ['Eicher Pro 17ft', 'BharatBenz 20ft', '32ft Container']
  },
  {
    slug: 'dibrugarh-to-guwahati',
    originCity: 'Dibrugarh',
    originState: 'Assam',
    destinationCity: 'Guwahati',
    destinationState: 'Assam',
    distanceKm: 442,
    transitHours: '9–11 hrs',
    highway: 'NH-37 & NH-27',
    startingFareInr: 13800,
    popularCargo: 'Assam CTC & Orthodox tea chests, plywood, bamboo products & agricultural bulk',
    recommendedVehicles: ['Eicher Pro 17ft', 'Eicher Pro 14ft', '32ft Container']
  },
  {
    slug: 'guwahati-to-jorhat',
    originCity: 'Guwahati',
    originState: 'Assam',
    destinationCity: 'Jorhat',
    destinationState: 'Assam',
    distanceKm: 308,
    transitHours: '6.5–8 hrs',
    highway: 'NH-27 & NH-715',
    startingFareInr: 10500,
    popularCargo: 'Packaged groceries, tea estate supplies, hardware, tiles & retail stock',
    recommendedVehicles: ['Tata 407 LCV', 'Eicher Pro 14ft', 'Eicher Pro 17ft']
  },
  {
    slug: 'guwahati-to-silchar',
    originCity: 'Guwahati',
    originState: 'Assam',
    destinationCity: 'Silchar',
    destinationState: 'Assam',
    distanceKm: 325,
    transitHours: '8.5–10 hrs',
    highway: 'NH-6 (Barak Valley Corridor)',
    startingFareInr: 13200,
    popularCargo: 'Cement, consumer goods, wholesale grains, beverages & hardware supplies',
    recommendedVehicles: ['Bolero Maxi Truck', 'Tata 407 LCV', 'Eicher Pro 17ft']
  },
  {
    slug: 'guwahati-to-shillong',
    originCity: 'Guwahati',
    originState: 'Assam',
    destinationCity: 'Shillong',
    destinationState: 'Meghalaya',
    distanceKm: 98,
    transitHours: '3–4 hrs',
    highway: 'NH-6 (GS Road Hill Corridor)',
    startingFareInr: 4200,
    popularCargo: 'FMCG, packaged spices, edible oil, retail electronics & construction hardware',
    recommendedVehicles: ['Tata Ace', 'Bolero Maxi Truck', 'Tata 407 LCV']
  },
  {
    slug: 'guwahati-to-dimapur',
    originCity: 'Guwahati',
    originState: 'Assam',
    destinationCity: 'Dimapur',
    destinationState: 'Nagaland',
    distanceKm: 285,
    transitHours: '6.5–8 hrs',
    highway: 'NH-27 & NH-29',
    startingFareInr: 11200,
    popularCargo: 'TMT steel, roofing sheets, FMCG distributors, hardware & timber supplies',
    recommendedVehicles: ['Eicher Pro 14ft', 'Eicher Pro 17ft', 'BharatBenz 20ft']
  },
  {
    slug: 'tezpur-to-dimapur',
    originCity: 'Tezpur',
    originState: 'Assam',
    destinationCity: 'Dimapur',
    destinationState: 'Nagaland',
    distanceKm: 215,
    transitHours: '5.5–6.5 hrs',
    highway: 'NH-15 & NH-29',
    startingFareInr: 9200,
    popularCargo: 'TMT steel rebars, galvanized roofing sheets, cement & hardware material',
    recommendedVehicles: ['Eicher Pro 17ft', 'BharatBenz 20ft']
  },
  {
    slug: 'guwahati-to-agartala',
    originCity: 'Guwahati',
    originState: 'Assam',
    destinationCity: 'Agartala',
    destinationState: 'Tripura',
    distanceKm: 540,
    transitHours: '14–17 hrs',
    highway: 'NH-6 & NH-8 (Tripura Freight Corridor)',
    startingFareInr: 22500,
    popularCargo: 'Medical supplies, packaged foods, rubber industry inputs & retail shipments',
    recommendedVehicles: ['Eicher Pro 17ft', 'BharatBenz 20ft', '32ft Container']
  },
  {
    slug: 'guwahati-to-tezpur',
    originCity: 'Guwahati',
    originState: 'Assam',
    destinationCity: 'Tezpur',
    destinationState: 'Assam',
    distanceKm: 182,
    transitHours: '4–5 hrs',
    highway: 'NH-27 & NH-15 (North Bank Corridor)',
    startingFareInr: 6500,
    popularCargo: 'Wholesale FMCG, agricultural inputs, iron & hardware, dairy & cold chain',
    recommendedVehicles: ['Bolero Maxi Truck', 'Tata 407 LCV', 'Eicher Pro 14ft']
  },
  {
    slug: 'guwahati-to-tinsukia',
    originCity: 'Guwahati',
    originState: 'Assam',
    destinationCity: 'Tinsukia',
    destinationState: 'Assam',
    distanceKm: 492,
    transitHours: '10.5–12.5 hrs',
    highway: 'NH-27 & NH-37 (Eastern Assam Commercial Hub)',
    startingFareInr: 16200,
    popularCargo: 'Oilfield spare parts, tea factory supplies, electrical equipment & bulk grains',
    recommendedVehicles: ['Eicher Pro 17ft', 'BharatBenz 20ft', '32ft Container']
  },
  {
    slug: 'guwahati-to-siliguri',
    originCity: 'Guwahati',
    originState: 'Assam',
    destinationCity: 'Siliguri',
    destinationState: 'West Bengal',
    distanceKm: 438,
    transitHours: '9.5–11.5 hrs',
    highway: 'NH-27 (East-West National Corridor)',
    startingFareInr: 14800,
    popularCargo: 'Tea consignments, plywood, agro produce, industrial spares & e-commerce linehaul',
    recommendedVehicles: ['Eicher Pro 17ft', 'BharatBenz 20ft', '32ft Container']
  },
  {
    slug: 'guwahati-to-kolkata',
    originCity: 'Guwahati',
    originState: 'Assam',
    destinationCity: 'Kolkata',
    destinationState: 'West Bengal',
    distanceKm: 1015,
    transitHours: '24–30 hrs',
    highway: 'NH-27 & NH-12 (Northeast–Kolkata Trunk Line)',
    startingFareInr: 36500,
    popularCargo: 'Export tea auctions, bamboo & timber goods, industrial return loads & containers',
    recommendedVehicles: ['BharatBenz 20ft', '32ft Container', 'Refrigerated Reefer']
  }
];

const GOODS_CATEGORY_LABELS: Record<string, string> = {
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

export const PUBLIC_SEED_FREIGHT_LISTINGS: PublicFreightListing[] = [
  {
    id: 'load_active_01',
    pickupCity: 'Dibrugarh',
    pickupDistrict: 'Dibrugarh',
    pickupState: 'Assam',
    pickupPincode: '786001',
    deliveryCity: 'Guwahati',
    deliveryDistrict: 'Kamrup Metro',
    deliveryState: 'Assam',
    deliveryPincode: '781031',
    goodsCategory: 'tea_packaged_bulk',
    goodsCategoryLabel: 'Tea (Packaged & Bulk)',
    goodsDescription: '120 Bags Premium CTC Orthodox Black Tea in moisture-proof vacuum sacks',
    weightKg: 4800,
    packageCount: 120,
    requiredVehicleCategory: 'eicher_17ft',
    requiredVehicleName: 'Eicher Pro 17ft Medium Truck',
    requiredBodyType: 'closed_container',
    loadType: 'full_load',
    pricingMode: 'bidding',
    targetBudgetInr: 26000,
    estimatedDistanceKm: 442,
    estimatedDurationHours: 9.5,
    pickupDateTime: '2026-10-29T08:00',
    expectedDeliveryDateTime: '2026-10-30T14:00',
    status: 'in_transit',
    createdAt: '2026-10-28T09:15:00Z',
    updatedAt: new Date().toISOString(),
    matchedVehicleCount: 5,
    coveredTruck: true,
    refrigerationNeeded: false,
    fragile: false
  },
  {
    id: 'load_pending_02',
    pickupCity: 'Guwahati',
    pickupDistrict: 'Kamrup Metro',
    pickupState: 'Assam',
    pickupPincode: '781028',
    deliveryCity: 'Shillong',
    deliveryDistrict: 'East Khasi Hills',
    deliveryState: 'Meghalaya',
    deliveryPincode: '793001',
    goodsCategory: 'fmcg_groceries',
    goodsCategoryLabel: 'FMCG & Groceries',
    goodsDescription: 'Packaged spices, cooking mustard oil tins & pulses',
    weightKg: 1100,
    packageCount: 65,
    requiredVehicleCategory: 'bolero_pickup',
    requiredVehicleName: 'Mahindra Bolero Maxi Truck',
    requiredBodyType: 'tarpaulin',
    loadType: 'full_load',
    pricingMode: 'bidding',
    targetBudgetInr: 5800,
    estimatedDistanceKm: 98,
    estimatedDurationHours: 3.5,
    pickupDateTime: '2026-10-30T09:00',
    expectedDeliveryDateTime: '2026-10-30T16:00',
    status: 'bidding',
    createdAt: '2026-10-28T11:40:00Z',
    updatedAt: new Date().toISOString(),
    matchedVehicleCount: 8,
    coveredTruck: true,
    refrigerationNeeded: false,
    fragile: false
  },
  {
    id: 'load_available_03',
    pickupCity: 'Tezpur',
    pickupDistrict: 'Sonitpur',
    pickupState: 'Assam',
    pickupPincode: '784001',
    deliveryCity: 'Dimapur',
    deliveryDistrict: 'Dimapur',
    deliveryState: 'Nagaland',
    deliveryPincode: '797112',
    goodsCategory: 'building_materials_cement',
    goodsCategoryLabel: 'Building Materials & Steel',
    goodsDescription: 'TMT Steel rebars (Fe 550D) & GI Galvanized Roofing Sheets',
    weightKg: 7800,
    packageCount: 18,
    requiredVehicleCategory: 'truck_20ft',
    requiredVehicleName: 'BharatBenz 20ft / 24ft Heavy Truck',
    requiredBodyType: 'open',
    loadType: 'full_load',
    pricingMode: 'bidding',
    targetBudgetInr: 21500,
    estimatedDistanceKm: 215,
    estimatedDurationHours: 6.0,
    pickupDateTime: '2026-10-31T07:30',
    expectedDeliveryDateTime: '2026-10-31T18:00',
    status: 'posted',
    createdAt: '2026-10-28T12:10:00Z',
    updatedAt: new Date().toISOString(),
    matchedVehicleCount: 4,
    coveredTruck: false,
    refrigerationNeeded: false,
    fragile: false
  }
];

function getVehicleName(categoryId: string): string {
  const found = SEO_VEHICLE_CATEGORIES.find((v) => v.id === categoryId);
  return found ? found.name : categoryId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getGoodsLabel(category: string): string {
  return (
    GOODS_CATEGORY_LABELS[category] ||
    String(category || 'Commercial Freight')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * Strips all PII / confidential operational fields (phones, OTPs, GSTIN, e-Way bill numbers)
 * before publishing freight listings to public SEO pages, JSON-LD, or /api/public/freight.
 */
export function sanitizePublicFreightListing(raw: any, updatedAt?: string): PublicFreightListing | null {
  if (!raw || !raw.id) return null;
  const pickupCity = String(raw.pickup?.city || raw.pickupCity || '').trim();
  const deliveryCity = String(raw.delivery?.city || raw.deliveryCity || '').trim();
  if (!pickupCity || !deliveryCity) return null;

  const goodsCategory = String(raw.goodsCategory || 'general_commercial');
  const requiredVehicleCategory = String(raw.requiredVehicleCategory || 'eicher_17ft');

  return {
    id: String(raw.id),
    pickupCity,
    pickupDistrict: String(raw.pickup?.district || raw.pickupDistrict || pickupCity),
    pickupState: String(raw.pickup?.state || raw.pickupState || 'Assam'),
    pickupPincode: String(raw.pickup?.pincode || raw.pickupPincode || ''),
    deliveryCity,
    deliveryDistrict: String(raw.delivery?.district || raw.deliveryDistrict || deliveryCity),
    deliveryState: String(raw.delivery?.state || raw.deliveryState || 'Assam'),
    deliveryPincode: String(raw.delivery?.pincode || raw.deliveryPincode || ''),
    goodsCategory,
    goodsCategoryLabel: getGoodsLabel(goodsCategory),
    goodsDescription: String(raw.goodsDescription || `${getGoodsLabel(goodsCategory)} commercial consignment`).slice(0, 220),
    weightKg: Math.max(0, Number(raw.weightKg || 0)),
    packageCount: Math.max(0, Number(raw.packageCount || 0)),
    requiredVehicleCategory,
    requiredVehicleName: getVehicleName(requiredVehicleCategory),
    requiredBodyType: String(raw.requiredBodyType || 'open'),
    loadType: raw.loadType === 'part_load' ? 'part_load' : 'full_load',
    pricingMode: String(raw.pricingMode || 'bidding'),
    targetBudgetInr: Math.max(0, Number(raw.targetBudgetInr || 0)),
    estimatedDistanceKm: Math.max(0, Number(raw.estimatedDistanceKm || 0)),
    estimatedDurationHours: Math.max(0, Number(raw.estimatedDurationHours || 0)),
    pickupDateTime: String(raw.pickupDateTime || raw.createdAt || new Date().toISOString()),
    expectedDeliveryDateTime: String(raw.expectedDeliveryDateTime || raw.pickupDateTime || new Date().toISOString()),
    status: String(raw.status || 'posted'),
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(updatedAt || raw.updatedAt || raw.createdAt || new Date().toISOString()),
    matchedVehicleCount: Math.max(0, Number(raw.matchedVehicleCount || 0)),
    coveredTruck: Boolean(raw.specialRequirements?.coveredTruck ?? raw.coveredTruck),
    refrigerationNeeded: Boolean(raw.specialRequirements?.refrigerationNeeded ?? raw.refrigerationNeeded),
    fragile: Boolean(raw.specialRequirements?.fragile ?? raw.fragile)
  };
}

export function mergePublicFreightListings(
  dbRows: Array<{ data: any; updated_at?: string }>
): PublicFreightListing[] {
  const byId = new Map<string, PublicFreightListing>();
  for (const seed of PUBLIC_SEED_FREIGHT_LISTINGS) {
    byId.set(seed.id, seed);
  }
  for (const row of dbRows) {
    const sanitized = sanitizePublicFreightListing(row.data, row.updated_at);
    if (sanitized && sanitized.status !== 'cancelled') {
      byId.set(sanitized.id, sanitized);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const openWeight = (s: string) => (s === 'posted' || s === 'bidding' ? 0 : 1);
    const diff = openWeight(a.status) - openWeight(b.status);
    if (diff !== 0) return diff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toIsoDate(value?: string): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case 'posted':
      return 'Open for Bids';
    case 'bidding':
      return 'Receiving Quotes';
    case 'assigned':
      return 'Vehicle Assigned';
    case 'in_transit':
      return 'In Transit (Live GPS)';
    case 'delivered':
    case 'completed':
      return 'Completed';
    default:
      return status.replace(/_/g, ' ');
  }
}

export interface SitemapUrlEntry {
  loc: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: string;
}

export function buildSitemapEntries(baseUrl: string, listings: PublicFreightListing[]): SitemapUrlEntry[] {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set<string>();
  const entries: SitemapUrlEntry[] = [];

  const push = (entry: SitemapUrlEntry) => {
    if (seen.has(entry.loc)) return;
    seen.add(entry.loc);
    entries.push(entry);
  };

  // 1. Core canonical pages (zero #fragments — every URL is crawlable)
  push({ loc: `${cleanBase}/`, lastmod: today, changefreq: 'daily', priority: '1.0' });
  push({ loc: `${cleanBase}/freight`, lastmod: today, changefreq: 'hourly', priority: '0.95' });
  push({ loc: `${cleanBase}/corridors`, lastmod: today, changefreq: 'weekly', priority: '0.85' });
  push({ loc: `${cleanBase}/fleet`, lastmod: today, changefreq: 'weekly', priority: '0.85' });
  push({ loc: `${cleanBase}/partner`, lastmod: today, changefreq: 'weekly', priority: '0.85' });
  push({ loc: `${cleanBase}/about`, lastmod: today, changefreq: 'monthly', priority: '0.75' });
  push({ loc: `${cleanBase}/contact`, lastmod: today, changefreq: 'monthly', priority: '0.7' });

  // 2. Dynamic individual freight listings (/freight/:loadId)
  for (const load of listings) {
    const isOpen = load.status === 'posted' || load.status === 'bidding';
    push({
      loc: `${cleanBase}/freight/${encodeURIComponent(load.id)}`,
      lastmod: toIsoDate(load.updatedAt || load.createdAt),
      changefreq: isOpen ? 'hourly' : 'daily',
      priority: isOpen ? '0.9' : '0.75'
    });
  }

  // 3. Major freight corridor landing pages (/corridors/:slug)
  for (const corridor of SEO_CORRIDORS) {
    push({
      loc: `${cleanBase}/corridors/${encodeURIComponent(corridor.slug)}`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.85'
    });
  }

  // 4. Commercial vehicle category pages (/fleet/:categoryId)
  for (const vehicle of SEO_VEHICLE_CATEGORIES) {
    push({
      loc: `${cleanBase}/fleet/${encodeURIComponent(vehicle.id)}`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.8'
    });
  }

  return entries;
}

export function renderUrlsetXml(entries: SitemapUrlEntry[]): string {
  const urlsXml = entries
    .map(
      (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${escapeXml(entry.lastmod)}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;
}

export function generateSiteSitemapXml(baseUrl: string, listings: PublicFreightListing[]): string {
  return renderUrlsetXml(buildSitemapEntries(baseUrl, listings));
}

export function generateFreightOnlySitemapXml(baseUrl: string, listings: PublicFreightListing[]): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const entries: SitemapUrlEntry[] = [
    { loc: `${cleanBase}/freight`, lastmod: today, changefreq: 'hourly', priority: '0.95' },
    ...listings.map((load) => ({
      loc: `${cleanBase}/freight/${encodeURIComponent(load.id)}`,
      lastmod: toIsoDate(load.updatedAt || load.createdAt),
      changefreq: (load.status === 'posted' || load.status === 'bidding' ? 'hourly' : 'daily') as 'hourly' | 'daily',
      priority: load.status === 'posted' || load.status === 'bidding' ? '0.9' : '0.75'
    }))
  ];
  return renderUrlsetXml(entries);
}

/**
 * Schema.org JSON-LD for an individual freight listing (/freight/:loadId).
 * Combines Service + Product (for Google Rich Results price/availability snippets),
 * ParcelDelivery (origin -> destination route semantics), and BreadcrumbList.
 */
export function buildFreightListingJsonLd(baseUrl: string, listing: PublicFreightListing): Record<string, any> {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const canonicalUrl = `${cleanBase}/freight/${encodeURIComponent(listing.id)}`;
  const isOpen = listing.status === 'posted' || listing.status === 'bidding';
  const weightTonnes = (listing.weightKg / 1000).toFixed(listing.weightKg >= 1000 ? 1 : 2);
  const title = `${listing.pickupCity} to ${listing.deliveryCity} Freight Load — ${listing.weightKg.toLocaleString('en-IN')} kg ${listing.goodsCategoryLabel}`;

  const offerNode: Record<string, any> = {
    '@type': 'Offer',
    url: canonicalUrl,
    priceCurrency: 'INR',
    availability: isOpen ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
    validFrom: listing.createdAt,
    itemCondition: 'https://schema.org/NewCondition',
    seller: {
      '@type': 'Organization',
      name: 'Zuggi Freight',
      url: `${cleanBase}/`
    }
  };

  if (listing.targetBudgetInr > 0) {
    offerNode.price = String(Math.round(listing.targetBudgetInr));
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['Service', 'Product'],
        '@id': `${canonicalUrl}#freight-listing`,
        sku: listing.id,
        identifier: listing.id,
        name: title,
        description: `${listing.goodsDescription}. ${listing.loadType === 'part_load' ? 'Part-load' : 'Full truckload'} commercial freight from ${listing.pickupCity}, ${listing.pickupState} to ${listing.deliveryCity}, ${listing.deliveryState} (${listing.estimatedDistanceKm} km). Required truck: ${listing.requiredVehicleName}. Weight: ${listing.weightKg} kg (${weightTonnes} MT).`,
        serviceType: 'Commercial Goods Transportation & Freight Listing',
        category: `${listing.goodsCategoryLabel} / ${listing.requiredVehicleName}`,
        image: `${cleanBase}/og-zuggi.jpg`,
        url: canonicalUrl,
        brand: {
          '@type': 'Brand',
          name: 'Zuggi Freight'
        },
        provider: {
          '@type': 'Organization',
          '@id': `${cleanBase}/#organization`,
          name: 'Zuggi Freight',
          url: `${cleanBase}/`
        },
        areaServed: [
          {
            '@type': 'City',
            name: listing.pickupCity,
            containedInPlace: {
              '@type': 'State',
              name: listing.pickupState
            }
          },
          {
            '@type': 'City',
            name: listing.deliveryCity,
            containedInPlace: {
              '@type': 'State',
              name: listing.deliveryState
            }
          }
        ],
        offers: offerNode,
        additionalProperty: [
          { '@type': 'PropertyValue', name: 'Origin City', value: `${listing.pickupCity}, ${listing.pickupState}` },
          { '@type': 'PropertyValue', name: 'Destination City', value: `${listing.deliveryCity}, ${listing.deliveryState}` },
          { '@type': 'PropertyValue', name: 'Cargo Weight', value: `${listing.weightKg} kg (${weightTonnes} MT)` },
          { '@type': 'PropertyValue', name: 'Estimated Distance', value: `${listing.estimatedDistanceKm} km` },
          { '@type': 'PropertyValue', name: 'Required Vehicle', value: listing.requiredVehicleName },
          { '@type': 'PropertyValue', name: 'Body Type', value: listing.requiredBodyType.replace(/_/g, ' ') },
          { '@type': 'PropertyValue', name: 'Load Type', value: listing.loadType === 'part_load' ? 'Part Truck Load (PTL)' : 'Full Truck Load (FTL)' },
          { '@type': 'PropertyValue', name: 'Listing Status', value: formatStatusLabel(listing.status) }
        ]
      },
      {
        '@type': 'ParcelDelivery',
        '@id': `${canonicalUrl}#delivery-route`,
        provider: {
          '@type': 'Organization',
          '@id': `${cleanBase}/#organization`,
          name: 'Zuggi Freight'
        },
        originAddress: {
          '@type': 'PostalAddress',
          addressLocality: listing.pickupCity,
          addressRegion: listing.pickupState,
          ...(listing.pickupPincode ? { postalCode: listing.pickupPincode } : {}),
          addressCountry: 'IN'
        },
        deliveryAddress: {
          '@type': 'PostalAddress',
          addressLocality: listing.deliveryCity,
          addressRegion: listing.deliveryState,
          ...(listing.deliveryPincode ? { postalCode: listing.deliveryPincode } : {}),
          addressCountry: 'IN'
        },
        expectedArrivalFrom: listing.pickupDateTime,
        expectedArrivalUntil: listing.expectedDeliveryDateTime,
        itemShipped: {
          '@type': 'Product',
          name: listing.goodsDescription
        }
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${cleanBase}/` },
          { '@type': 'ListItem', position: 2, name: 'Live Freight Listings', item: `${cleanBase}/freight` },
          {
            '@type': 'ListItem',
            position: 3,
            name: `${listing.pickupCity} to ${listing.deliveryCity} (${listing.goodsCategoryLabel})`,
            item: canonicalUrl
          }
        ]
      }
    ]
  };
}

export function buildFreightDirectoryJsonLd(baseUrl: string, listings: PublicFreightListing[]): Record<string, any> {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const directoryUrl = `${cleanBase}/freight`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${directoryUrl}#collection`,
        url: directoryUrl,
        name: 'Live Freight Listings & Truck Loads in Assam & India | Zuggi',
        description:
          'Browse active commercial freight loads across Guwahati, Dibrugarh, Shillong, Dimapur, Tezpur, Silchar & Kolkata. Direct quotes for verified trucks.',
        isPartOf: { '@id': `${cleanBase}/#website` },
        mainEntity: { '@id': `${directoryUrl}#itemlist` }
      },
      {
        '@type': 'ItemList',
        '@id': `${directoryUrl}#itemlist`,
        name: 'Active Freight Listings on Zuggi',
        numberOfItems: listings.length,
        itemListElement: listings.slice(0, 50).map((listing, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          url: `${cleanBase}/freight/${encodeURIComponent(listing.id)}`,
          name: `${listing.pickupCity} to ${listing.deliveryCity} — ${listing.weightKg} kg ${listing.goodsCategoryLabel}`,
          item: {
            '@type': 'Service',
            name: `${listing.pickupCity} to ${listing.deliveryCity} Freight (${listing.requiredVehicleName})`,
            description: listing.goodsDescription,
            url: `${cleanBase}/freight/${encodeURIComponent(listing.id)}`,
            provider: { '@id': `${cleanBase}/#organization` },
            ...(listing.targetBudgetInr > 0
              ? {
                  offers: {
                    '@type': 'Offer',
                    price: String(Math.round(listing.targetBudgetInr)),
                    priceCurrency: 'INR',
                    availability:
                      listing.status === 'posted' || listing.status === 'bidding'
                        ? 'https://schema.org/InStock'
                        : 'https://schema.org/SoldOut'
                  }
                }
              : {})
          }
        }))
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${cleanBase}/` },
          { '@type': 'ListItem', position: 2, name: 'Live Freight Listings', item: directoryUrl }
        ]
      }
    ]
  };
}

export function buildCorridorJsonLd(baseUrl: string, corridor: SeoCorridor): Record<string, any> {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const canonicalUrl = `${cleanBase}/corridors/${encodeURIComponent(corridor.slug)}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': `${canonicalUrl}#corridor-service`,
        name: `${corridor.originCity} to ${corridor.destinationCity} Truck Booking & Freight Transport`,
        description: `Book Parivahan-verified trucks from ${corridor.originCity}, ${corridor.originState} to ${corridor.destinationCity}, ${corridor.destinationState} (${corridor.distanceKm} km via ${corridor.highway}). Estimated transit ${corridor.transitHours} with live GPS tracking and GST invoicing.`,
        serviceType: 'Interstate Commercial Freight Transport',
        url: canonicalUrl,
        provider: { '@id': `${cleanBase}/#organization` },
        areaServed: [
          { '@type': 'City', name: corridor.originCity },
          { '@type': 'City', name: corridor.destinationCity }
        ],
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          priceCurrency: 'INR',
          price: String(corridor.startingFareInr),
          availability: 'https://schema.org/InStock'
        }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${cleanBase}/` },
          { '@type': 'ListItem', position: 2, name: 'Freight Corridors', item: `${cleanBase}/corridors` },
          {
            '@type': 'ListItem',
            position: 3,
            name: `${corridor.originCity} to ${corridor.destinationCity}`,
            item: canonicalUrl
          }
        ]
      }
    ]
  };
}

export function buildVehicleCategoryJsonLd(baseUrl: string, vehicle: SeoVehicleCategory): Record<string, any> {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const canonicalUrl = `${cleanBase}/fleet/${encodeURIComponent(vehicle.id)}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': `${canonicalUrl}#vehicle-service`,
        name: `Hire ${vehicle.name} (${vehicle.capacityTonnes} MT) — Zuggi Freight`,
        description: `Book Parivahan-verified ${vehicle.name} with ${vehicle.capacityKg.toLocaleString('en-IN')} kg payload (${vehicle.dimensions}). Ideal for ${vehicle.idealFor}. Direct transporter rates starting at ₹${vehicle.basePricePerKm}/km.`,
        serviceType: 'Commercial Truck Rental & Freight Booking',
        url: canonicalUrl,
        provider: { '@id': `${cleanBase}/#organization` },
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          priceCurrency: 'INR',
          price: String(vehicle.minBasePrice),
          availability: 'https://schema.org/InStock'
        }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${cleanBase}/` },
          { '@type': 'ListItem', position: 2, name: '5,000+ Verified Fleet', item: `${cleanBase}/fleet` },
          { '@type': 'ListItem', position: 3, name: vehicle.name, item: canonicalUrl }
        ]
      }
    ]
  };
}

function renderPrerenderShell(title: string, subtitle: string, bodyHtml: string, baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  return `<div class="zuggi-ssr-shell" style="font-family:Inter,system-ui,-apple-system,sans-serif;color:#171318;background:#F8F6F8;min-height:100vh;">
    <header style="background:#ffffff;border-bottom:1px solid #e5e7eb;padding:16px 24px;">
      <div style="max-width:1120px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
        <a href="${cleanBase}/" style="font-size:20px;font-weight:800;color:#171318;text-decoration:none;">Zuggi Freight</a>
        <nav aria-label="Primary Navigation" style="display:flex;gap:18px;font-size:14px;font-weight:600;flex-wrap:wrap;">
          <a href="${cleanBase}/freight" style="color:#E83E83;text-decoration:none;">Live Freight</a>
          <a href="${cleanBase}/corridors" style="color:#4b5563;text-decoration:none;">Corridors</a>
          <a href="${cleanBase}/fleet" style="color:#4b5563;text-decoration:none;">5,000+ Fleet</a>
          <a href="${cleanBase}/about" style="color:#4b5563;text-decoration:none;">About Us</a>
          <a href="${cleanBase}/contact" style="color:#4b5563;text-decoration:none;">Contact</a>
        </nav>
      </div>
    </header>
    <main style="max-width:1120px;margin:0 auto;padding:36px 24px 64px;">
      <h1 style="font-size:32px;line-height:1.18;font-weight:900;margin:0 0 12px;color:#171318;">${escapeHtml(title)}</h1>
      <p style="font-size:16px;line-height:1.6;color:#4b5563;max-width:780px;margin:0 0 28px;">${escapeHtml(subtitle)}</p>
      ${bodyHtml}
    </main>
  </div>`;
}

export function resolveRouteSeo(
  rawPathname: string,
  baseUrl: string,
  listings: PublicFreightListing[]
): ResolvedRouteSeo {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const pathname = (rawPathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
  const defaultImage = `${cleanBase}/og-zuggi.jpg`;

  // 1. Individual freight listing: /freight/:loadId
  const freightDetailMatch = pathname.match(/^\/freight\/([^/]+)$/);
  if (freightDetailMatch) {
    const loadId = decodeURIComponent(freightDetailMatch[1]);
    const listing = listings.find((l) => l.id === loadId);
    const canonicalUrl = `${cleanBase}/freight/${encodeURIComponent(loadId)}`;

    if (!listing) {
      return {
        title: 'Freight Listing Not Found | Zuggi Freight',
        description:
          'This freight listing may have been completed or archived. Browse live commercial truck loads across Assam, Northeast India & Pan-India on Zuggi.',
        canonicalUrl,
        ogType: 'website',
        ogImage: defaultImage,
        robots: 'noindex, follow',
        jsonLd: null,
        prerenderHtml: renderPrerenderShell(
          'Freight Listing Unavailable',
          'This consignment may have already been fulfilled. Explore active commercial truck loads on Zuggi Freight Exchange.',
          `<p><a href="${cleanBase}/freight" style="color:#E83E83;font-weight:700;">View All Active Freight Listings</a></p>`,
          cleanBase
        )
      };
    }

    const title = `${listing.pickupCity} to ${listing.deliveryCity} Load (${listing.weightKg}kg) | Zuggi`.slice(0, 62);
    const budgetPart = listing.targetBudgetInr > 0 ? ` Est. budget ${formatInr(listing.targetBudgetInr)}.` : '';
    const description = `${listing.goodsCategoryLabel} freight from ${listing.pickupCity} to ${listing.deliveryCity} (${listing.estimatedDistanceKm} km). ${listing.requiredVehicleName} needed.${budgetPart} Bid directly on Zuggi.`.slice(0, 160);

    const bodyHtml = `<article style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;margin-bottom:24px;">
      <p style="font-size:13px;font-weight:700;color:#E83E83;text-transform:uppercase;margin:0 0 8px;">${escapeHtml(formatStatusLabel(listing.status))} · Listing #${escapeHtml(listing.id)}</p>
      <p style="font-size:16px;color:#171318;font-weight:600;margin:0 0 16px;">${escapeHtml(listing.goodsDescription)}</p>
      <dl style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:0;">
        <div><dt style="font-size:12px;color:#6b7280;">Pickup</dt><dd style="margin:2px 0 0;font-weight:700;">${escapeHtml(listing.pickupCity)}, ${escapeHtml(listing.pickupState)}</dd></div>
        <div><dt style="font-size:12px;color:#6b7280;">Delivery</dt><dd style="margin:2px 0 0;font-weight:700;">${escapeHtml(listing.deliveryCity)}, ${escapeHtml(listing.deliveryState)}</dd></div>
        <div><dt style="font-size:12px;color:#6b7280;">Weight</dt><dd style="margin:2px 0 0;font-weight:700;">${listing.weightKg.toLocaleString('en-IN')} kg</dd></div>
        <div><dt style="font-size:12px;color:#6b7280;">Vehicle Required</dt><dd style="margin:2px 0 0;font-weight:700;">${escapeHtml(listing.requiredVehicleName)}</dd></div>
        <div><dt style="font-size:12px;color:#6b7280;">Distance</dt><dd style="margin:2px 0 0;font-weight:700;">${listing.estimatedDistanceKm} km</dd></div>
        ${listing.targetBudgetInr > 0 ? `<div><dt style="font-size:12px;color:#6b7280;">Target Freight Budget</dt><dd style="margin:2px 0 0;font-weight:700;">${escapeHtml(formatInr(listing.targetBudgetInr))}</dd></div>` : ''}
      </dl>
    </article>
    <p><a href="${cleanBase}/freight" style="color:#E83E83;font-weight:700;">← Browse All Live Freight Listings</a></p>`;

    return {
      title,
      description,
      canonicalUrl,
      ogType: 'product',
      ogImage: defaultImage,
      robots: 'index, follow',
      jsonLd: buildFreightListingJsonLd(cleanBase, listing),
      prerenderHtml: renderPrerenderShell(
        `${listing.pickupCity} to ${listing.deliveryCity} Commercial Freight Load`,
        description,
        bodyHtml,
        cleanBase
      )
    };
  }

  // 2. Freight Directory: /freight
  if (pathname === '/freight') {
    const canonicalUrl = `${cleanBase}/freight`;
    const listItems = listings
      .slice(0, 20)
      .map(
        (l) => `<li style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px;">
          <a href="${cleanBase}/freight/${encodeURIComponent(l.id)}" style="font-size:16px;font-weight:800;color:#171318;text-decoration:none;">${escapeHtml(l.pickupCity)} → ${escapeHtml(l.deliveryCity)}: ${l.weightKg.toLocaleString('en-IN')} kg ${escapeHtml(l.goodsCategoryLabel)}</a>
          <p style="margin:6px 0 0;font-size:14px;color:#4b5563;">${escapeHtml(l.goodsDescription)} · ${escapeHtml(l.requiredVehicleName)} · ${l.estimatedDistanceKm} km${l.targetBudgetInr > 0 ? ` · Budget ${escapeHtml(formatInr(l.targetBudgetInr))}` : ''}</p>
        </li>`
      )
      .join('\n');

    return {
      title: 'Live Freight Listings & Truck Loads | Zuggi India',
      description:
        'Browse active commercial truck loads across Assam, Northeast India & Pan-India. Verified transporters bid directly with zero brokerage & escrow protection.',
      canonicalUrl,
      ogType: 'website',
      ogImage: defaultImage,
      robots: 'index, follow',
      jsonLd: buildFreightDirectoryJsonLd(cleanBase, listings),
      prerenderHtml: renderPrerenderShell(
        'Live Freight Exchange — Active Commercial Truck Loads',
        'Explore verified full-truckload (FTL) and part-load consignments across Guwahati, Dibrugarh, Shillong, Dimapur, Tezpur, and Pan-India highways.',
        `<ul style="list-style:none;padding:0;margin:0;">${listItems}</ul>`,
        cleanBase
      )
    };
  }

  // 3. Individual Corridor: /corridors/:slug
  const corridorMatch = pathname.match(/^\/corridors\/([^/]+)$/);
  if (corridorMatch) {
    const slug = decodeURIComponent(corridorMatch[1]).toLowerCase();
    const corridor = SEO_CORRIDORS.find((c) => c.slug === slug);
    const canonicalUrl = `${cleanBase}/corridors/${encodeURIComponent(slug)}`;

    if (corridor) {
      const title = `${corridor.originCity} to ${corridor.destinationCity} Truck Booking | Zuggi`.slice(0, 62);
      const description = `Hire verified trucks from ${corridor.originCity} to ${corridor.destinationCity} (${corridor.distanceKm} km, ${corridor.transitHours}). Rates from ${formatInr(corridor.startingFareInr)} with live GPS & GST billing.`.slice(0, 160);

      const bodyHtml = `<section style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-weight:700;">Highway: ${escapeHtml(corridor.highway)} · Distance: ${corridor.distanceKm} km · Transit: ${escapeHtml(corridor.transitHours)}</p>
        <p style="margin:0 0 12px;color:#4b5563;"><strong>Popular Cargo:</strong> ${escapeHtml(corridor.popularCargo)}</p>
        <p style="margin:0;color:#4b5563;"><strong>Recommended Vehicles:</strong> ${escapeHtml(corridor.recommendedVehicles.join(', '))}</p>
      </section>
      <p><a href="${cleanBase}/freight" style="color:#E83E83;font-weight:700;">View Active Freight Loads on This Route →</a></p>`;

      return {
        title,
        description,
        canonicalUrl,
        ogType: 'website',
        ogImage: defaultImage,
        robots: 'index, follow',
        jsonLd: buildCorridorJsonLd(cleanBase, corridor),
        prerenderHtml: renderPrerenderShell(
          `${corridor.originCity} to ${corridor.destinationCity} Commercial Freight Transport`,
          description,
          bodyHtml,
          cleanBase
        )
      };
    }
  }

  // 4. Corridors Index: /corridors
  if (pathname === '/corridors') {
    const canonicalUrl = `${cleanBase}/corridors`;
    const listHtml = SEO_CORRIDORS.map(
      (c) => `<li style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px;margin-bottom:10px;">
        <a href="${cleanBase}/corridors/${c.slug}" style="font-weight:800;color:#171318;text-decoration:none;">${escapeHtml(c.originCity)} to ${escapeHtml(c.destinationCity)} (${c.distanceKm} km)</a>
        <span style="display:block;font-size:13px;color:#4b5563;margin-top:4px;">${escapeHtml(c.highway)} · Starting ${escapeHtml(formatInr(c.startingFareInr))} · ${escapeHtml(c.transitHours)}</span>
      </li>`
    ).join('\n');

    return {
      title: 'Assam & Northeast Freight Corridors | Zuggi',
      description:
        'Book verified trucks across 12+ high-volume Assam, Northeast India & Pan-India freight corridors including Guwahati, Dibrugarh, Jorhat, Shillong, Dimapur & Kolkata.',
      canonicalUrl,
      ogType: 'website',
      ogImage: defaultImage,
      robots: 'index, follow',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Zuggi Commercial Freight Corridors',
        numberOfItems: SEO_CORRIDORS.length,
        itemListElement: SEO_CORRIDORS.map((c, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: `${c.originCity} to ${c.destinationCity} Freight Corridor`,
          url: `${cleanBase}/corridors/${c.slug}`
        }))
      },
      prerenderHtml: renderPrerenderShell(
        'Commercial Freight Corridors — Assam, Northeast & Pan-India',
        'Direct truck booking with real-time GPS tracking and escrow protection along NH-27, NH-37, NH-6, and national trunk routes.',
        `<ul style="list-style:none;padding:0;margin:0;">${listHtml}</ul>`,
        cleanBase
      )
    };
  }

  // 5. Individual Vehicle Category: /fleet/:categoryId
  const fleetMatch = pathname.match(/^\/fleet\/([^/]+)$/);
  if (fleetMatch) {
    const categoryId = decodeURIComponent(fleetMatch[1]).toLowerCase();
    const vehicle = SEO_VEHICLE_CATEGORIES.find((v) => v.id === categoryId);
    const canonicalUrl = `${cleanBase}/fleet/${encodeURIComponent(categoryId)}`;

    if (vehicle) {
      const title = `Hire ${vehicle.name} (${vehicle.capacityTonnes} MT) | Zuggi`.slice(0, 62);
      const description = `Book Parivahan-verified ${vehicle.name} (${vehicle.capacityKg.toLocaleString('en-IN')} kg capacity, ${vehicle.dimensions}). Base fare ₹${vehicle.basePricePerKm}/km. Instant shipper quotes on Zuggi.`.slice(0, 160);

      const bodyHtml = `<section style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;margin-bottom:24px;">
        <p style="margin:0 0 10px;"><strong>Payload Capacity:</strong> ${vehicle.capacityKg.toLocaleString('en-IN')} kg (${vehicle.capacityTonnes} MT)</p>
        <p style="margin:0 0 10px;"><strong>Deck Dimensions:</strong> ${escapeHtml(vehicle.dimensions)}</p>
        <p style="margin:0 0 10px;"><strong>Body Options:</strong> ${escapeHtml(vehicle.bodyTypes.join(', '))}</p>
        <p style="margin:0 0 10px;"><strong>Indicative Rate:</strong> ₹${vehicle.basePricePerKm}/km (Min. ${escapeHtml(formatInr(vehicle.minBasePrice))})</p>
        <p style="margin:0;color:#4b5563;"><strong>Ideal For:</strong> ${escapeHtml(vehicle.idealFor)}</p>
      </section>
      <p><a href="${cleanBase}/fleet" style="color:#E83E83;font-weight:700;">← Compare All 10 Vehicle Categories</a></p>`;

      return {
        title,
        description,
        canonicalUrl,
        ogType: 'website',
        ogImage: defaultImage,
        robots: 'index, follow',
        jsonLd: buildVehicleCategoryJsonLd(cleanBase, vehicle),
        prerenderHtml: renderPrerenderShell(
          `Book ${vehicle.name} — ${vehicle.capacityTonnes} MT Verified Fleet`,
          description,
          bodyHtml,
          cleanBase
        )
      };
    }
  }

  // 6. Fleet Network Index: /fleet
  if (pathname === '/fleet') {
    const canonicalUrl = `${cleanBase}/fleet`;
    const listHtml = SEO_VEHICLE_CATEGORIES.map(
      (v) => `<li style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px;margin-bottom:10px;">
        <a href="${cleanBase}/fleet/${v.id}" style="font-weight:800;color:#171318;text-decoration:none;">${escapeHtml(v.name)} — ${v.capacityTonnes} MT</a>
        <span style="display:block;font-size:13px;color:#4b5563;margin-top:4px;">${escapeHtml(v.dimensions)} · From ₹${v.basePricePerKm}/km · ${escapeHtml(v.idealFor)}</span>
      </li>`
    ).join('\n');

    return {
      title: '5,000+ Verified Trucks & Commercial Fleet | Zuggi',
      description:
        'Explore 5,000+ Parivahan-verified pickups, Tata Ace, Bolero, Eicher 14ft/17ft, 20ft trucks, 32ft containers & reefer vehicles ready for dispatch on Zuggi.',
      canonicalUrl,
      ogType: 'website',
      ogImage: defaultImage,
      robots: 'index, follow',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Zuggi Commercial Vehicle Categories',
        numberOfItems: SEO_VEHICLE_CATEGORIES.length,
        itemListElement: SEO_VEHICLE_CATEGORIES.map((v, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: `${v.name} (${v.capacityTonnes} MT)`,
          url: `${cleanBase}/fleet/${v.id}`
        }))
      },
      prerenderHtml: renderPrerenderShell(
        '5,000+ Verified Commercial Vehicles Ready for Dispatch',
        'Every pickup, LCV, heavy truck, and 32ft container on Zuggi is Parivahan RC verified and GPS-tracked.',
        `<ul style="list-style:none;padding:0;margin:0;">${listHtml}</ul>`,
        cleanBase
      )
    };
  }

  // 7. Partner Portal: /partner
  if (pathname === '/partner') {
    return {
      title: 'Zuggi Partner — Driver & Fleet Owner Freight App',
      description:
        'Attach your commercial truck or fleet with Zuggi. Bid directly on verified loads across Assam & India with 0% brokerage, 90% pickup advance & zero empty returns.',
      canonicalUrl: `${cleanBase}/partner`,
      ogType: 'website',
      ogImage: defaultImage,
      robots: 'index, follow',
      jsonLd: null,
      prerenderHtml: null
    };
  }

  // 8. About page: /about
  if (pathname === '/about') {
    return {
      title: 'About Zuggi — 5,000+ Verified Commercial Truck Network',
      description:
        'Learn how Zuggi connects commercial shippers directly with 5,000+ Parivahan-verified trucks across Assam, Northeast India & Pan-India with live GPS and escrow.',
      canonicalUrl: `${cleanBase}/about`,
      ogType: 'website',
      ogImage: defaultImage,
      robots: 'index, follow',
      jsonLd: null,
      prerenderHtml: null
    };
  }

  // 9. Contact page: /contact
  if (pathname === '/contact') {
    return {
      title: 'Contact Zuggi Freight — 24/7 Dispatch & Fleet Desk',
      description:
        'Reach Zuggi Freight dispatch support in Guwahati, Assam at +91 96789 44132 or support@zuggi.in for shipper bookings, truck attachment, and enterprise logistics.',
      canonicalUrl: `${cleanBase}/contact`,
      ogType: 'website',
      ogImage: defaultImage,
      robots: 'index, follow',
      jsonLd: null,
      prerenderHtml: null
    };
  }

  // 10. Private/ephemeral tracking pages should not be indexed
  if (pathname.startsWith('/track/')) {
    return {
      title: 'Live Driver GPS Telemetry | Zuggi Freight',
      description: 'Real-time commercial trip GPS transmitter for Zuggi verified drivers.',
      canonicalUrl: `${cleanBase}${pathname}`,
      ogType: 'website',
      ogImage: defaultImage,
      robots: 'noindex, nofollow',
      jsonLd: null,
      prerenderHtml: null
    };
  }

  // Default Homepage (/)
  return {
    title: 'Zuggi — Book Verified Trucks & Commercial Freight Online',
    description:
      'Zuggi connects businesses with 5,000+ Parivahan-verified trucks across Assam, Northeast & Pan-India. Direct quotes, live GPS tracking, GST invoices & escrow.',
    canonicalUrl: `${cleanBase}/`,
    ogType: 'website',
    ogImage: defaultImage,
    robots: 'index, follow, max-image-preview:large, max-snippet:-1',
    jsonLd: listings.length > 0 ? buildFreightDirectoryJsonLd(cleanBase, listings.slice(0, 10)) : null,
    prerenderHtml: null
  };
}

function replaceMetaByName(html: string, name: string, content: string): string {
  const escaped = escapeHtml(content);
  const regex = new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, 'i');
  if (regex.test(html)) {
    return html.replace(regex, `<meta name="${name}" content="${escaped}" />`);
  }
  return html.replace('</head>', `  <meta name="${name}" content="${escaped}" />\n  </head>`);
}

function replaceMetaByProperty(html: string, property: string, content: string): string {
  const escaped = escapeHtml(content);
  const regex = new RegExp(`<meta\\s+property=["']${property}["'][^>]*>`, 'i');
  if (regex.test(html)) {
    return html.replace(regex, `<meta property="${property}" content="${escaped}" />`);
  }
  return html.replace('</head>', `  <meta property="${property}" content="${escaped}" />\n  </head>`);
}

export function injectSeoIntoHtml(rawHtml: string, seo: ResolvedRouteSeo): string {
  let html = rawHtml;

  // Title
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seo.title)}</title>`);

  // Standard Meta Tags
  html = replaceMetaByName(html, 'title', seo.title);
  html = replaceMetaByName(html, 'description', seo.description);
  html = replaceMetaByName(html, 'robots', seo.robots);

  // Canonical Link
  const canonicalTag = `<link rel="canonical" href="${escapeHtml(seo.canonicalUrl)}" />`;
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, canonicalTag);
  } else {
    html = html.replace('</head>', `  ${canonicalTag}\n  </head>`);
  }

  // OpenGraph Tags
  html = replaceMetaByProperty(html, 'og:type', seo.ogType);
  html = replaceMetaByProperty(html, 'og:url', seo.canonicalUrl);
  html = replaceMetaByProperty(html, 'og:title', seo.title);
  html = replaceMetaByProperty(html, 'og:description', seo.description);
  html = replaceMetaByProperty(html, 'og:image', seo.ogImage);

  // Twitter Cards
  html = replaceMetaByName(html, 'twitter:url', seo.canonicalUrl);
  html = replaceMetaByName(html, 'twitter:title', seo.title);
  html = replaceMetaByName(html, 'twitter:description', seo.description);
  html = replaceMetaByName(html, 'twitter:image', seo.ogImage);

  // Route-Specific Schema.org JSON-LD
  if (seo.jsonLd) {
    const safeJson = JSON.stringify(seo.jsonLd).replace(/</g, '\\u003c');
    const jsonLdScript = `<script id="zuggi-route-jsonld" type="application/ld+json">${safeJson}</script>`;
    if (html.includes('<!-- ZUGGI_ROUTE_JSONLD -->')) {
      html = html.replace('<!-- ZUGGI_ROUTE_JSONLD -->', jsonLdScript);
    } else {
      html = html.replace('</head>', `  ${jsonLdScript}\n  </head>`);
    }
  } else {
    html = html.replace('<!-- ZUGGI_ROUTE_JSONLD -->', '');
  }

  // Route-Specific Pre-Rendered Semantic HTML Shell inside <div id="root">
  if (seo.prerenderHtml) {
    const markerRegex = /<!-- ZUGGI_SSR_SHELL_START -->[\s\S]*?<!-- ZUGGI_SSR_SHELL_END -->/;
    if (markerRegex.test(html)) {
      html = html.replace(
        markerRegex,
        `<!-- ZUGGI_SSR_SHELL_START -->\n      ${seo.prerenderHtml}\n      <!-- ZUGGI_SSR_SHELL_END -->`
      );
    }
  }

  return html;
}
