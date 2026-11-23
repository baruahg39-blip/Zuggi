/**
 * Zuggi.in — Shared Factual SEO Landing Pages Registry
 * Single source of truth consumed by BOTH the Express server (SSR HTML shell,
 * <head> meta tags, Schema.org JSON-LD, and /sitemap.xml) and the React SPA.
 *
 * IMPORTANT: Do NOT import image/CSS assets in this file so `tsx` server execution
 * stays 100% Node-compatible. Image keys are resolved inside client components.
 */

export interface FactualVehicleCategory {
  id: string;
  name: string;
  capacityKg: number;
  capacityTonnes: number;
  dimensions: string;
  bodyTypes: string[];
  idealFor: string;
}

export interface SupportedRouteOverview {
  origin: string;
  destination: string;
  distanceKm: number;
  highway: string;
  corridorSlug?: string;
  typicalCargo: string;
  suitableVehicles: string[];
}

export interface SeoFaqItem {
  question: string;
  answer: string;
}

export interface SeoContentSection {
  heading: string;
  intro: string;
  subsections: Array<{
    subheading: string;
    body: string;
  }>;
}

export interface SeoWorkflowStep {
  step: string;
  title: string;
  detail: string;
}

export interface SeoLandingPageConfig {
  slug: string;
  shortLabel: string;
  targetKeyword: string;
  seoTitle: string;
  metaDescription: string;
  eyebrow: string;
  h1: string;
  heroLead: string;
  heroImageKey: 'highway' | 'hub';
  heroImageAlt: string;
  audience: 'shipper' | 'transporter';
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  secondaryCtaPath: string;
  areaServed: string[];
  serviceType: string;
  highlights: Array<{ label: string; detail: string }>;
  sections: SeoContentSection[];
  featuredVehicleIds: string[];
  featuredRoutes: SupportedRouteOverview[];
  workflowSteps: SeoWorkflowStep[];
  faqs: SeoFaqItem[];
  relatedSlugs: string[];
}

export const FACTUAL_VEHICLE_CATEGORIES: FactualVehicleCategory[] = [
  {
    id: 'three_wheeler',
    name: '3-Wheeler Cargo',
    capacityKg: 500,
    capacityTonnes: 0.5,
    dimensions: '5.5ft × 4.0ft × 4.0ft',
    bodyTypes: ['Open', 'Tarpaulin'],
    idealFor: 'Local urban distribution, retail cartons, vegetables, and small commercial dispatches'
  },
  {
    id: 'tata_ace',
    name: 'Tata Ace (Chota Hathi)',
    capacityKg: 850,
    capacityTonnes: 0.85,
    dimensions: '7.0ft × 4.8ft × 5.0ft',
    bodyTypes: ['Open', 'Closed Container', 'Tarpaulin'],
    idealFor: 'Intra-city and nearby town deliveries, hardware supplies, furniture, and wholesale boxes'
  },
  {
    id: 'bolero_pickup',
    name: 'Mahindra Bolero Maxi Truck',
    capacityKg: 1300,
    capacityTonnes: 1.3,
    dimensions: '8.2ft × 5.2ft × 5.5ft',
    bodyTypes: ['Open', 'Tarpaulin'],
    idealFor: 'Hilly terrain routes, rural feeder corridors, farm produce, and building supplies'
  },
  {
    id: 'ashok_leyland_dost',
    name: 'Ashok Leyland Dost+',
    capacityKg: 1500,
    capacityTonnes: 1.5,
    dimensions: '9.8ft × 5.3ft × 6.0ft',
    bodyTypes: ['Open', 'Closed Container', 'Tarpaulin'],
    idealFor: 'Packaged tea, electronics, wholesale distribution, and regional retail supply'
  },
  {
    id: 'tata_407',
    name: 'Tata 407 LCV',
    capacityKg: 2500,
    capacityTonnes: 2.5,
    dimensions: '10.0ft × 6.5ft × 6.5ft',
    bodyTypes: ['Open', 'Closed Container', 'Tarpaulin'],
    idealFor: 'State highway cargo, wholesale cartons, FMCG shipments, and mid-size commercial loads'
  },
  {
    id: 'eicher_14ft',
    name: 'Eicher Pro 14ft Truck',
    capacityKg: 4000,
    capacityTonnes: 4.0,
    dimensions: '14.0ft × 6.8ft × 7.0ft',
    bodyTypes: ['Open', 'Closed Container', 'Tarpaulin'],
    idealFor: 'Inter-district commercial loads, plywood, packaged fertilizers, and FMCG stockists'
  },
  {
    id: 'eicher_17ft',
    name: 'Eicher Pro 17ft Medium Truck',
    capacityKg: 6500,
    capacityTonnes: 6.5,
    dimensions: '17.0ft × 7.2ft × 7.5ft',
    bodyTypes: ['Open', 'Closed Container', 'Tarpaulin'],
    idealFor: 'Assam tea consignments, steel bars, PVC pipes, industrial equipment, and bulk goods'
  },
  {
    id: 'truck_20ft',
    name: 'BharatBenz 20ft / 24ft Heavy Truck',
    capacityKg: 10000,
    capacityTonnes: 10.0,
    dimensions: '22.0ft × 7.8ft × 8.0ft',
    bodyTypes: ['Open', 'Closed Container', 'Flatbed'],
    idealFor: 'Cement bags, structural steel, factory dispatches, and long-haul interstate freight'
  },
  {
    id: 'container_32ft',
    name: '32ft Multi-Axle Container (SXL/MXL)',
    capacityKg: 15000,
    capacityTonnes: 15.0,
    dimensions: '32.0ft × 8.0ft × 8.5ft',
    bodyTypes: ['Closed Container'],
    idealFor: 'Weather-protected FMCG, white goods, pharmaceuticals, and high-volume linehaul cargo'
  },
  {
    id: 'reefer_cold_chain',
    name: 'Refrigerated Reefer Truck',
    capacityKg: 7000,
    capacityTonnes: 7.0,
    dimensions: '18.0ft × 7.5ft × 7.5ft',
    bodyTypes: ['Refrigerated'],
    idealFor: 'Temperature-sensitive medical supplies, dairy, and perishable commercial consignments'
  }
];

const SHIPPER_WORKFLOW_STEPS: SeoWorkflowStep[] = [
  {
    step: '01',
    title: 'Post Freight Requirements',
    detail:
      'Enter pickup and delivery cities, cargo category, weight in kg, load type (full truckload or part-load), body preference, and pickup schedule.'
  },
  {
    step: '02',
    title: 'Receive Direct Transporter Bids',
    detail:
      'Onboarded truck owners, fleet operators, and transporters submit competitive quotes directly on your posted load without broker chains.'
  },
  {
    step: '03',
    title: 'Track Shipment Live on GPS',
    detail:
      'Once a quote is accepted and a vehicle is assigned, monitor real-time trip progress, live ETA updates, and pickup/delivery geofence notifications.'
  },
  {
    step: '04',
    title: 'Confirm Delivery & Settle Payment',
    detail:
      'Complete unloading with Delivery OTP and electronic proof of delivery (e-POD), paired with Cashfree two-stage payment settlement and GST invoicing.'
  }
];

const TRANSPORTER_WORKFLOW_STEPS: SeoWorkflowStep[] = [
  {
    step: '01',
    title: 'Register & Complete Onboarding',
    detail:
      'Sign up through the Zuggi Partner portal with mobile OTP verification and upload driver license, vehicle RC, insurance, and commercial permit documents.'
  },
  {
    step: '02',
    title: 'Add Fleet Vehicles & Drivers',
    detail:
      'List your commercial vehicles across supported categories (from 3-wheelers and pickups to 17ft trucks and 32ft containers) and assign drivers.'
  },
  {
    step: '03',
    title: 'Browse Loads & Submit Quotes',
    detail:
      'Review posted shipper requirements—origin, destination, cargo weight, and body type—and submit your direct freight bid.'
  },
  {
    step: '04',
    title: 'Execute Trip & Receive Settlement',
    detail:
      'Share live GPS progress during transit, capture e-POD and Delivery OTP at unloading, and receive structured bank settlements through the payment workflow.'
  }
];

export const SEO_LANDING_PAGES: SeoLandingPageConfig[] = [
  {
    slug: '/truck-booking-guwahati',
    shortLabel: 'Truck Booking Guwahati',
    targetKeyword: 'Truck booking in Guwahati',
    seoTitle: 'Truck Booking in Guwahati | Commercial Freight | Zuggi',
    metaDescription:
      'Book commercial trucks in Guwahati online on Zuggi. Post loads, compare direct transporter quotes, track shipments live via GPS, and confirm delivery with e-POD.',
    eyebrow: 'Guwahati Commercial Freight Marketplace',
    h1: 'Online Commercial Truck Booking in Guwahati',
    heroLead:
      'Zuggi connects Guwahati manufacturers, wholesalers, distributors, and trading businesses directly with commercial truck owners and fleet operators for local, Assam, and interstate dispatches.',
    heroImageKey: 'hub',
    heroImageAlt: 'Commercial cargo trucks and pickups staged at a Guwahati freight dispatch yard',
    audience: 'shipper',
    primaryCtaLabel: 'Book a Truck in Guwahati',
    secondaryCtaLabel: 'View Live Freight Board',
    secondaryCtaPath: '/freight',
    areaServed: ['Guwahati', 'Kamrup Metropolitan', 'Assam', 'Northeast India'],
    serviceType: 'Commercial Truck Booking in Guwahati',
    highlights: [
      {
        label: 'Direct Freight Bidding',
        detail: 'Post your Guwahati load once and compare transparent quotes submitted directly by onboarded transporters.'
      },
      {
        label: '10 Commercial Vehicle Categories',
        detail: 'Select from 3-Wheeler Cargo, Tata Ace, Bolero Maxi Truck, Tata 407, Eicher 14ft/17ft, 20ft trucks, 32ft containers, and reefers.'
      },
      {
        label: 'Live GPS & Geofence Alerts',
        detail: 'Follow assigned vehicles in real time with automated arrival alerts near pickup and delivery coordinates.'
      },
      {
        label: 'OTP Delivery & GST Invoicing',
        detail: 'Verify unloading with Delivery OTP and electronic POD alongside Cashfree two-stage payment settlement.'
      }
    ],
    sections: [
      {
        heading: 'How Commercial Truck Booking Works From Guwahati',
        intro:
          'Guwahati serves as the primary commercial gateway for Assam and the Northeastern states, connecting wholesale markets around Beltola, GS Road, Lokhra, and industrial estates to regional highways. Zuggi replaces fragmented phone inquiries with a structured digital marketplace.',
        subsections: [
          {
            subheading: 'Post Full-Load or Part-Load Shipments Online',
            body: 'Specify exact pickup and delivery locations, cargo description, package count, weight in kilograms, and special handling needs such as covered tarpaulin, closed container, or refrigerated transport.'
          },
          {
            subheading: 'Compare Quotes Directly From Transporters',
            body: 'Instead of relying on single-source broker quotes, businesses receive bids directly from registered vehicle owners and fleet operators so pricing reflects actual route and vehicle requirements.'
          }
        ]
      },
      {
        heading: 'Built-In Shipment Visibility and Payment Controls',
        intro:
          'Commercial dispatches require clear accountability from loading bay to final unloading point. Every booking created through Zuggi follows a documented operational workflow.',
        subsections: [
          {
            subheading: 'Live GPS Route Tracking & Arrival Notifications',
            body: 'Shippers can monitor active trip location, route ETA estimates, and geofence entry alerts as the commercial vehicle approaches the loading or unloading site.'
          },
          {
            subheading: 'Structured Two-Stage Settlement & Documentation',
            body: 'Online payments run through the Cashfree workflow with a pickup advance stage after loading verification and final balance release after e-POD photo upload and Delivery OTP confirmation, accompanied by GST invoices.'
          }
        ]
      }
    ],
    featuredVehicleIds: ['tata_ace', 'bolero_pickup', 'tata_407', 'eicher_14ft', 'eicher_17ft', 'container_32ft'],
    featuredRoutes: [
      {
        origin: 'Guwahati',
        destination: 'Dibrugarh',
        distanceKm: 442,
        highway: 'NH-27 & NH-37',
        corridorSlug: 'guwahati-to-dibrugarh',
        typicalCargo: 'FMCG, tea garden supplies, hardware, pharmaceuticals, industrial cargo',
        suitableVehicles: ['Eicher Pro 17ft', 'BharatBenz 20ft / 24ft', '32ft Container']
      },
      {
        origin: 'Guwahati',
        destination: 'Shillong',
        distanceKm: 98,
        highway: 'NH-6 (GS Road Hill Corridor)',
        corridorSlug: 'guwahati-to-shillong',
        typicalCargo: 'Groceries, packaged foods, retail stock, building hardware',
        suitableVehicles: ['Tata Ace', 'Mahindra Bolero Maxi Truck', 'Tata 407 LCV']
      },
      {
        origin: 'Guwahati',
        destination: 'Jorhat',
        distanceKm: 308,
        highway: 'NH-27 & NH-715',
        corridorSlug: 'guwahati-to-jorhat',
        typicalCargo: 'Wholesale FMCG, tiles, tea estate equipment, retail cartons',
        suitableVehicles: ['Tata 407 LCV', 'Eicher Pro 14ft', 'Eicher Pro 17ft']
      },
      {
        origin: 'Guwahati',
        destination: 'Silchar',
        distanceKm: 325,
        highway: 'NH-6 (Barak Valley Route)',
        corridorSlug: 'guwahati-to-silchar',
        typicalCargo: 'Cement, wholesale grains, beverages, construction material',
        suitableVehicles: ['Mahindra Bolero Maxi Truck', 'Tata 407 LCV', 'Eicher Pro 17ft']
      }
    ],
    workflowSteps: SHIPPER_WORKFLOW_STEPS,
    faqs: [
      {
        question: 'What types of commercial trucks can I book from Guwahati on Zuggi?',
        answer:
          'Zuggi supports 10 commercial vehicle categories ranging from 500 kg 3-Wheeler Cargo and 850 kg Tata Ace pickups to 14ft and 17ft Eicher trucks, 20ft/24ft heavy trucks, 32ft SXL/MXL closed containers, and refrigerated reefer trucks.'
      },
      {
        question: 'How are freight rates decided for Guwahati truck bookings?',
        answer:
          'Zuggi does not lock you into arbitrary flat tariffs. Shippers post load specifications and receive direct bids from registered truck owners and fleet operators so you can review and select a competitive quote for your route and cargo.'
      },
      {
        question: 'Can I track my truck after it leaves Guwahati?',
        answer:
          'Yes. Assigned trips support live GPS location tracking, live ETA estimates, geofence notifications near pickup and delivery coordinates, electronic proof of delivery (e-POD), and Delivery OTP confirmation.'
      },
      {
        question: 'Are GST invoices available for commercial shipments booked on Zuggi?',
        answer:
          'Yes. Completed bookings generate digital GST-compliant consignment invoices alongside transparent records of your Cashfree payment stages.'
      }
    ],
    relatedSlugs: [
      '/truck-transport-assam',
      '/truck-hire-guwahati-dibrugarh',
      '/northeast-india-transport',
      '/logistics-companies-assam'
    ]
  },
  {
    slug: '/truck-transport-assam',
    shortLabel: 'Truck Transport Assam',
    targetKeyword: 'Commercial truck transport Assam',
    seoTitle: 'Commercial Truck Transport in Assam | Freight | Zuggi',
    metaDescription:
      'Arrange commercial truck transport across Assam on Zuggi. Connect shippers with truck owners across Guwahati, Dibrugarh, Jorhat, Tezpur, Silchar & Tinsukia.',
    eyebrow: 'Assam Commercial Freight Network',
    h1: 'Commercial Truck Transport Across Assam',
    heroLead:
      'Move tea consignments, agricultural produce, construction steel, plywood, and FMCG cargo across Lower, Central, Upper, and Barak Valley Assam through Zuggi’s direct shipper-to-transporter freight marketplace.',
    heroImageKey: 'highway',
    heroImageAlt: 'Commercial freight trucks moving along an Assam national highway corridor',
    audience: 'shipper',
    primaryCtaLabel: 'Post an Assam Freight Load',
    secondaryCtaLabel: 'Explore Supported Corridors',
    secondaryCtaPath: '/corridors',
    areaServed: ['Assam', 'Guwahati', 'Dibrugarh', 'Jorhat', 'Tezpur', 'Silchar', 'Tinsukia'],
    serviceType: 'Commercial Truck Transport in Assam',
    highlights: [
      {
        label: 'Statewide Corridor Workflows',
        detail: 'Post loads between Guwahati, Dibrugarh, Jorhat, Tinsukia, Tezpur, Nagaon, and Silchar on one platform.'
      },
      {
        label: 'Cargo-Specific Body Types',
        detail: 'Request open deck, tarpaulin-covered, closed container, flatbed, or refrigerated trucks to protect Assam monsoon-sensitive cargo.'
      },
      {
        label: 'Direct Fleet & Truck Owner Bidding',
        detail: 'Receive transparent freight quotations directly from onboarded vehicle owners and transport operators.'
      },
      {
        label: 'End-to-End Digital Audit Trail',
        detail: 'Track loading status, GPS movement, e-POD upload, Delivery OTP verification, and GST billing per consignment.'
      }
    ],
    sections: [
      {
        heading: 'Commercial Road Freight Tailored to Assam Industries',
        intro:
          'Assam’s supply chains span tea gardens in Upper Assam, wholesale hubs in Guwahati, North Bank agro-trade around Tezpur, and Barak Valley distribution in Silchar. Zuggi gives businesses a single workflow to source commercial vehicles across these lanes.',
        subsections: [
          {
            subheading: 'Weather-Protected Transport for Tea, FMCG & Pharmaceuticals',
            body: 'Shippers can specify closed-container or tarpaulin-covered requirements when posting loads, helping match moisture-sensitive cargo like CTC and orthodox tea sacks or packaged groceries with suitable trucks.'
          },
          {
            subheading: 'Heavy & Open-Body Vehicles for Steel, Cement & Plywood',
            body: 'For construction materials, TMT bars, cement, and industrial machinery, shippers can select 14ft/17ft medium trucks or 20ft/24ft heavy commercial vehicles with open or flatbed configurations.'
          }
        ]
      },
      {
        heading: 'How Zuggi Connects Assam Shippers With Transporters',
        intro:
          'Rather than acting as an opaque middleman, Zuggi operates as a commercial freight marketplace where both load requirements and transporter credentials are structured digitally.',
        subsections: [
          {
            subheading: 'Structured Transporter Onboarding',
            body: 'Truck owners, drivers, and fleet partners submit KYC details, driving licenses, vehicle registration certificates (RC), insurance, and commercial permits during platform onboarding.'
          },
          {
            subheading: 'Transparent Settlement & Delivery Verification',
            body: 'Delivery completion requires electronic proof of delivery (e-POD) and Delivery OTP confirmation from the consignee side before final payment settlement.'
          }
        ]
      }
    ],
    featuredVehicleIds: ['bolero_pickup', 'tata_407', 'eicher_14ft', 'eicher_17ft', 'truck_20ft', 'container_32ft'],
    featuredRoutes: [
      {
        origin: 'Guwahati',
        destination: 'Dibrugarh',
        distanceKm: 442,
        highway: 'NH-27 & NH-37 (Upper Assam Corridor)',
        corridorSlug: 'guwahati-to-dibrugarh',
        typicalCargo: 'FMCG, industrial machinery, tea estate inputs, pharmaceuticals',
        suitableVehicles: ['Eicher Pro 17ft', 'BharatBenz 20ft / 24ft', '32ft Container']
      },
      {
        origin: 'Guwahati',
        destination: 'Tezpur',
        distanceKm: 182,
        highway: 'NH-27 & NH-15 (North Bank Corridor)',
        corridorSlug: 'guwahati-to-tezpur',
        typicalCargo: 'Agricultural inputs, dairy, wholesale FMCG, hardware',
        suitableVehicles: ['Mahindra Bolero Maxi Truck', 'Tata 407 LCV', 'Eicher Pro 14ft']
      },
      {
        origin: 'Guwahati',
        destination: 'Tinsukia',
        distanceKm: 492,
        highway: 'NH-27 & NH-37 (Eastern Assam Hub)',
        corridorSlug: 'guwahati-to-tinsukia',
        typicalCargo: 'Oilfield spares, tea factory supplies, bulk grains, electrical goods',
        suitableVehicles: ['Eicher Pro 17ft', 'BharatBenz 20ft / 24ft', '32ft Container']
      },
      {
        origin: 'Guwahati',
        destination: 'Silchar',
        distanceKm: 325,
        highway: 'NH-6 (Barak Valley Corridor)',
        corridorSlug: 'guwahati-to-silchar',
        typicalCargo: 'Cement, consumer goods, wholesale grains, beverages',
        suitableVehicles: ['Mahindra Bolero Maxi Truck', 'Tata 407 LCV', 'Eicher Pro 17ft']
      }
    ],
    workflowSteps: SHIPPER_WORKFLOW_STEPS,
    faqs: [
      {
        question: 'Which Assam cities and corridors are supported on Zuggi?',
        answer:
          'Shippers can post commercial freight between Guwahati, Dibrugarh, Jorhat, Tinsukia, Tezpur, Nagaon, Silchar, and connecting regional hubs across Assam and neighboring states.'
      },
      {
        question: 'Can I book both full truckload (FTL) and part-load shipments in Assam?',
        answer:
          'Yes. Zuggi’s load posting workflow lets shippers choose between full truckload (FTL) and part truckload (PTL) depending on cargo weight, volume, and delivery urgency.'
      },
      {
        question: 'How does Zuggi verify delivery in remote Assam districts?',
        answer:
          'Assigned drivers update trip milestones with live GPS tracking, upload electronic proof of delivery (e-POD) photographs at unloading, and complete Delivery OTP confirmation.'
      },
      {
        question: 'Do Assam fleet owners pay to list their trucks on Zuggi?',
        answer:
          'Truck owners and fleet operators can register through the Zuggi Partner portal, upload vehicle RC and KYC documents, and bid directly on posted Assam freight loads.'
      }
    ],
    relatedSlugs: [
      '/truck-booking-guwahati',
      '/truck-hire-guwahati-dibrugarh',
      '/logistics-companies-assam',
      '/northeast-india-transport'
    ]
  },
  {
    slug: '/truck-hire-guwahati-dibrugarh',
    shortLabel: 'Guwahati to Dibrugarh Truck Hire',
    targetKeyword: 'Truck hire Guwahati to Dibrugarh',
    seoTitle: 'Truck Hire Guwahati to Dibrugarh | NH-27/37 | Zuggi',
    metaDescription:
      'Hire commercial trucks from Guwahati to Dibrugarh (~442 km via NH-27 & NH-37) on Zuggi. Compare direct transporter bids with live GPS tracking and OTP e-POD.',
    eyebrow: 'Upper Assam Highway Corridor',
    h1: 'Commercial Truck Hire: Guwahati to Dibrugarh',
    heroLead:
      'Book commercial freight transport along the ~442 km Guwahati–Dibrugarh NH-27 and NH-37 corridor. Post your load requirements, compare direct transporter quotes, and monitor transit live until confirmed delivery.',
    heroImageKey: 'highway',
    heroImageAlt: 'Heavy commercial transport truck travelling the Guwahati to Dibrugarh highway corridor',
    audience: 'shipper',
    primaryCtaLabel: 'Hire a Guwahati–Dibrugarh Truck',
    secondaryCtaLabel: 'View Guwahati–Dibrugarh Corridor',
    secondaryCtaPath: '/corridors/guwahati-to-dibrugarh',
    areaServed: ['Guwahati', 'Dibrugarh', 'Nagaon', 'Jorhat', 'Sivasagar', 'Assam'],
    serviceType: 'Truck Hire Guwahati to Dibrugarh',
    highlights: [
      {
        label: '~442 km Upper Assam Route',
        detail: 'Connects Guwahati commercial hubs to Dibrugarh via NH-27 and NH-37, serving both outbound and return loads.'
      },
      {
        label: 'Right-Sized Truck Categories',
        detail: 'Post loads for Tata 407, Eicher 14ft/17ft, BharatBenz 20ft/24ft, 32ft closed containers, or reefer trucks.'
      },
      {
        label: 'Live Highway GPS & ETA',
        detail: 'Monitor active vehicle position, real-time ETA updates, and geofence arrival notifications along the highway.'
      },
      {
        label: 'Bid-Based Market Pricing',
        detail: 'Compare live bids from transporters operating on the Upper Assam lane instead of paying opaque broker markups.'
      }
    ],
    sections: [
      {
        heading: 'Planning Freight Movement on the Guwahati–Dibrugarh Lane',
        intro:
          'The Guwahati to Dibrugarh route is one of Upper Assam’s busiest commercial highway corridors, carrying industrial equipment, FMCG distributions, pharmaceuticals, and return tea consignments from Dibrugarh back to Guwahati.',
        subsections: [
          {
            subheading: 'Choosing the Right Truck Size & Body Type',
            body: 'Medium-weight wholesale stock and hardware commonly fit Tata 407 or Eicher 14ft trucks, while bulk tea consignments, construction steel, and high-volume FMCG loads typically require Eicher 17ft, 20ft/24ft heavy trucks, or weather-sealed 32ft containers.'
          },
          {
            subheading: 'Bidirectional Freight Support (Guwahati ↔ Dibrugarh)',
            body: 'Zuggi supports load posting in both directions—outbound commercial dispatches from Guwahati to Dibrugarh and return cargo such as tea, plywood, or agricultural bulk from Dibrugarh to Guwahati.'
          }
        ]
      },
      {
        heading: 'Live Transit Monitoring and Payment Protection',
        intro:
          'Longer intra-state highway runs benefit from continuous visibility and clear payment checkpoints between pickup in Guwahati and unloading in Dibrugarh.',
        subsections: [
          {
            subheading: 'Geofence Arrival Alerts & Live ETA',
            body: 'When an assigned truck enters the pickup or delivery radius, the platform triggers arrival notifications and updates live highway ETA estimates for the shipper.'
          },
          {
            subheading: 'Two-Stage Payment Settlement & e-POD',
            body: 'Shippers confirm loading before the pickup advance stage and verify final delivery via e-POD upload and Delivery OTP before balance settlement, with GST invoicing generated on completion.'
          }
        ]
      }
    ],
    featuredVehicleIds: ['tata_407', 'eicher_14ft', 'eicher_17ft', 'truck_20ft', 'container_32ft', 'reefer_cold_chain'],
    featuredRoutes: [
      {
        origin: 'Guwahati',
        destination: 'Dibrugarh',
        distanceKm: 442,
        highway: 'NH-27 & NH-37 (Upper Assam Corridor)',
        corridorSlug: 'guwahati-to-dibrugarh',
        typicalCargo: 'FMCG, tea garden equipment, construction steel, medical supplies, industrial spares',
        suitableVehicles: ['Eicher Pro 17ft', 'BharatBenz 20ft / 24ft', '32ft Container']
      },
      {
        origin: 'Dibrugarh',
        destination: 'Guwahati',
        distanceKm: 442,
        highway: 'NH-37 & NH-27 (Return Corridor)',
        corridorSlug: 'dibrugarh-to-guwahati',
        typicalCargo: 'Assam CTC & Orthodox tea chests, plywood, bamboo products, agro bulk',
        suitableVehicles: ['Eicher Pro 14ft', 'Eicher Pro 17ft', '32ft Container']
      },
      {
        origin: 'Guwahati',
        destination: 'Tinsukia',
        distanceKm: 492,
        highway: 'NH-27 & NH-37 (Extended Upper Assam)',
        corridorSlug: 'guwahati-to-tinsukia',
        typicalCargo: 'Oilfield spares, tea factory supplies, industrial hardware',
        suitableVehicles: ['Eicher Pro 17ft', 'BharatBenz 20ft / 24ft', '32ft Container']
      }
    ],
    workflowSteps: SHIPPER_WORKFLOW_STEPS,
    faqs: [
      {
        question: 'What is the highway distance for truck transport from Guwahati to Dibrugarh?',
        answer:
          'The commercial highway route between Guwahati and Dibrugarh is approximately 442 km along NH-27 and NH-37, passing key Upper Assam transit towns.'
      },
      {
        question: 'Are freight rates fixed for Guwahati to Dibrugarh truck hire?',
        answer:
          'No. Freight pricing depends on vehicle size, cargo weight, body type, and seasonal demand. On Zuggi, you post your exact load details and compare competitive quotes directly from transporters before confirming.'
      },
      {
        question: 'Can I book a closed container or tarpaulin-covered truck for Dibrugarh?',
        answer:
          'Yes. When creating your load on Zuggi, select Closed Container, Tarpaulin Covered, or Refrigerated options so only matching vehicles quote on your consignment.'
      },
      {
        question: 'Does Zuggi also support return truck loads from Dibrugarh to Guwahati?',
        answer:
          'Yes. Shippers in Dibrugarh can post return consignments to Guwahati (such as tea or plywood), and transporters can bid on those loads through the Partner portal.'
      }
    ],
    relatedSlugs: [
      '/truck-booking-guwahati',
      '/truck-transport-assam',
      '/northeast-india-transport',
      '/truck-loads'
    ]
  },
  {
    slug: '/northeast-india-transport',
    shortLabel: 'Northeast India Transport',
    targetKeyword: 'Transport services in Northeast India',
    seoTitle: 'Transport Services in Northeast India | Freight | Zuggi',
    metaDescription:
      'Commercial freight transport across Northeast India on Zuggi. Book trucks between Assam, Shillong, Dimapur, Agartala, Siliguri & Kolkata with live GPS tracking.',
    eyebrow: 'Interstate Northeast Freight Corridors',
    h1: 'Commercial Transport Services in Northeast India',
    heroLead:
      'Coordinate interstate road freight across Assam, Meghalaya, Nagaland, Tripura, and the Siliguri–Kolkata gateway corridor through Zuggi’s direct digital freight exchange.',
    heroImageKey: 'highway',
    heroImageAlt: 'Commercial logistics vehicles crossing interstate highways in Northeast India',
    audience: 'shipper',
    primaryCtaLabel: 'Book Northeast Freight',
    secondaryCtaLabel: 'Explore All Corridors',
    secondaryCtaPath: '/corridors',
    areaServed: ['Assam', 'Meghalaya', 'Nagaland', 'Tripura', 'West Bengal', 'Northeast India'],
    serviceType: 'Interstate Commercial Transport Services in Northeast India',
    highlights: [
      {
        label: 'Hill & Plain Route Support',
        detail: 'Match hilly corridors (Shillong, Dimapur, Agartala) with agile pickups and LCVs, or highway trunk lanes with 17ft–32ft trucks.'
      },
      {
        label: 'Gateway Connections',
        detail: 'Post loads linking Guwahati and Assam districts with Shillong, Dimapur, Agartala, Siliguri, and Kolkata.'
      },
      {
        label: 'Direct Interstate Quotations',
        detail: 'Compare transparent bids from commercial vehicle owners and fleet operators who run Northeast routes.'
      },
      {
        label: 'Real-Time Transit Visibility',
        detail: 'Follow interstate trips with live GPS updates, ETA estimates, e-POD capture, and Delivery OTP confirmation.'
      }
    ],
    sections: [
      {
        heading: 'Navigating Interstate Road Freight Across the Northeast',
        intro:
          'Transporting commercial goods across Northeast India involves diverse terrain—from Brahmaputra Valley highways to hill approaches into Meghalaya, Nagaland, and Tripura, plus long-haul connections through the Siliguri corridor toward Kolkata.',
        subsections: [
          {
            subheading: 'Terrain-Appropriate Vehicle Selection',
            body: 'Hilly routes like Guwahati–Shillong or Barak Valley–Agartala often require Mahindra Bolero Maxi Trucks, Tata 407 LCVs, or 14ft/17ft Eicher trucks, while trunk corridors like Guwahati–Siliguri and Guwahati–Kolkata also accommodate 20ft/24ft trucks, 32ft containers, and reefers.'
          },
          {
            subheading: 'Single Platform for Multi-State Dispatches',
            body: 'Instead of managing separate regional brokers for Meghalaya, Nagaland, Tripura, and West Bengal lanes, shippers post every load in one dashboard and review quotes in a uniform format.'
          }
        ]
      },
      {
        heading: 'Operational Transparency on Long-Haul Regional Corridors',
        intro:
          'Interstate freight carries higher coordination stakes around transit timing, weather protection, and unloading confirmation.',
        subsections: [
          {
            subheading: 'Live GPS, ETA & Geofence Checkpoints',
            body: 'Drivers transmit live GPS locations during active trips so shippers can monitor progress across state borders and receive notifications when vehicles reach pickup or delivery zones.'
          },
          {
            subheading: 'Documented Compliance & Payment Milestones',
            body: 'Shippers can attach cargo details and GST invoicing data while settling freight through Zuggi’s structured two-stage Cashfree payment workflow tied to verified loading and OTP-confirmed delivery.'
          }
        ]
      }
    ],
    featuredVehicleIds: ['bolero_pickup', 'ashok_leyland_dost', 'tata_407', 'eicher_14ft', 'eicher_17ft', 'truck_20ft', 'container_32ft'],
    featuredRoutes: [
      {
        origin: 'Guwahati',
        destination: 'Shillong',
        distanceKm: 98,
        highway: 'NH-6 (Hill Corridor)',
        corridorSlug: 'guwahati-to-shillong',
        typicalCargo: 'FMCG, edible oil, retail electronics, construction hardware',
        suitableVehicles: ['Tata Ace', 'Mahindra Bolero Maxi Truck', 'Tata 407 LCV']
      },
      {
        origin: 'Guwahati',
        destination: 'Dimapur',
        distanceKm: 285,
        highway: 'NH-27 & NH-29',
        corridorSlug: 'guwahati-to-dimapur',
        typicalCargo: 'TMT steel, roofing sheets, FMCG distributions, hardware',
        suitableVehicles: ['Eicher Pro 14ft', 'Eicher Pro 17ft', 'BharatBenz 20ft / 24ft']
      },
      {
        origin: 'Guwahati',
        destination: 'Agartala',
        distanceKm: 540,
        highway: 'NH-6 & NH-8 (Tripura Corridor)',
        corridorSlug: 'guwahati-to-agartala',
        typicalCargo: 'Medical supplies, packaged foods, rubber industry inputs, retail stock',
        suitableVehicles: ['Eicher Pro 17ft', 'BharatBenz 20ft / 24ft', '32ft Container']
      },
      {
        origin: 'Guwahati',
        destination: 'Siliguri',
        distanceKm: 438,
        highway: 'NH-27 (East-West Gateway)',
        corridorSlug: 'guwahati-to-siliguri',
        typicalCargo: 'Tea consignments, plywood, agro produce, industrial spares',
        suitableVehicles: ['Eicher Pro 17ft', 'BharatBenz 20ft / 24ft', '32ft Container']
      },
      {
        origin: 'Guwahati',
        destination: 'Kolkata',
        distanceKm: 1015,
        highway: 'NH-27 & NH-12 (Trunk Line)',
        corridorSlug: 'guwahati-to-kolkata',
        typicalCargo: 'Auction tea, timber & bamboo goods, industrial return freight',
        suitableVehicles: ['BharatBenz 20ft / 24ft', '32ft Container', 'Refrigerated Reefer']
      }
    ],
    workflowSteps: SHIPPER_WORKFLOW_STEPS,
    faqs: [
      {
        question: 'Which Northeast India states and routes are supported on Zuggi?',
        answer:
          'Zuggi actively supports commercial freight corridors connecting Assam (Guwahati, Dibrugarh, Jorhat, Tezpur, Silchar, Tinsukia) with Shillong (Meghalaya), Dimapur (Nagaland), Agartala (Tripura), and the Siliguri–Kolkata West Bengal trunk corridors.'
      },
      {
        question: 'Which vehicles work best for hilly Northeast routes like Shillong or Agartala?',
        answer:
          'For hill-gradient corridors, shippers frequently select Mahindra Bolero Maxi Trucks (1.3 MT), Tata 407 LCVs (2.5 MT), or 14ft and 17ft Eicher trucks depending on cargo weight and road restrictions.'
      },
      {
        question: 'Can I book a refrigerated truck for medical or perishable cargo in the Northeast?',
        answer:
          'Yes. Zuggi includes a Refrigerated Reefer Truck category (7 MT) and a refrigeration requirement toggle inside the load posting workflow.'
      },
      {
        question: 'How does interstate delivery confirmation work?',
        answer:
          'Upon reaching the destination city, the assigned driver uploads electronic proof of delivery (e-POD) and verifies handover with the consignee’s Delivery OTP before final balance settlement.'
      }
    ],
    relatedSlugs: [
      '/truck-booking-guwahati',
      '/truck-transport-assam',
      '/online-freight-booking',
      '/logistics-companies-assam'
    ]
  },
  {
    slug: '/online-freight-booking',
    shortLabel: 'Online Freight Booking',
    targetKeyword: 'Freight booking online India',
    seoTitle: 'Online Freight Booking in India | Commercial Trucks | Zuggi',
    metaDescription:
      'Book commercial freight online in India with Zuggi. Post full or part loads, compare direct transporter quotes, track live GPS & complete GST-ready settlements.',
    eyebrow: 'Digital Commercial Freight Exchange',
    h1: 'Online Freight Booking for Commercial Shippers in India',
    heroLead:
      'Replace manual transport phone calls with one transparent workflow: post full-load or part-load freight online, compare direct bids from onboarded truck owners, track shipments live, and settle securely with GST invoicing.',
    heroImageKey: 'hub',
    heroImageAlt: 'Commercial freight dispatch hub managing online truck bookings and cargo loading',
    audience: 'shipper',
    primaryCtaLabel: 'Post a Commercial Load',
    secondaryCtaLabel: 'Compare All 10 Vehicle Categories',
    secondaryCtaPath: '/fleet',
    areaServed: ['India', 'Assam', 'Northeast India', 'West Bengal'],
    serviceType: 'Online Commercial Freight Booking Marketplace',
    highlights: [
      {
        label: 'Full-Load (FTL) & Part-Load (PTL)',
        detail: 'Specify exact cargo weight, package count, body type, and pickup date for either dedicated full trucks or part-loads.'
      },
      {
        label: 'Direct Quote Comparison',
        detail: 'Review side-by-side bids directly from registered truck owners, drivers, and fleet operators before assigning a vehicle.'
      },
      {
        label: 'Live GPS, ETA & Geofencing',
        detail: 'Monitor assigned trucks on live maps with automated proximity alerts near pickup and delivery points.'
      },
      {
        label: 'Cashfree Payment Workflow & GST',
        detail: 'Execute structured two-stage settlements (pickup advance and delivery balance) with digital GST consignment invoices.'
      }
    ],
    sections: [
      {
        heading: 'Core Capabilities of Zuggi’s Online Freight Platform',
        intro:
          'Zuggi is built as a practical digital freight marketplace covering every operational step between posting a commercial requirement and archiving the final GST invoice.',
        subsections: [
          {
            subheading: 'Structured Load Posting & Vehicle Matching',
            body: 'Shippers choose from 10 commercial vehicle categories—from 500 kg three-wheelers up to 15 MT 32ft multi-axle containers and 7 MT refrigerated reefers—along with cargo categories such as tea, FMCG, building materials, industrial machinery, electronics, and pharmaceuticals.'
          },
          {
            subheading: 'Competitive Freight Bidding Without Opaque Middlemen',
            body: 'Posted loads become visible to onboarded transporters and fleet owners who submit transparent quotes directly inside the platform, letting shippers choose based on bid value and vehicle fit.'
          }
        ]
      },
      {
        heading: 'From Pickup Loading to OTP-Verified Delivery & Payment',
        intro:
          'Booking a truck online is only half the job—reliable execution on the highway depends on verified milestones and clean financial documentation.',
        subsections: [
          {
            subheading: 'Real-Time Shipment Tracking & Delivery Confirmation',
            body: 'Once dispatched, trips provide live GPS coordinates, live ETA calculations, geofence arrival triggers, electronic proof of delivery (e-POD) photo uploads, and Delivery OTP verification.'
          },
          {
            subheading: 'Protected Two-Stage Payments & Digital Invoicing',
            body: 'Online settlements are processed via Cashfree with pickup advance release after verified loading and balance payout after delivery confirmation, backed by GST-compliant tax invoices.'
          }
        ]
      }
    ],
    featuredVehicleIds: ['three_wheeler', 'tata_ace', 'bolero_pickup', 'tata_407', 'eicher_14ft', 'eicher_17ft', 'truck_20ft', 'container_32ft', 'reefer_cold_chain'],
    featuredRoutes: [
      {
        origin: 'Guwahati',
        destination: 'Kolkata',
        distanceKm: 1015,
        highway: 'NH-27 & NH-12',
        corridorSlug: 'guwahati-to-kolkata',
        typicalCargo: 'Tea exports, industrial goods, containers, packaged commodities',
        suitableVehicles: ['BharatBenz 20ft / 24ft', '32ft Container', 'Refrigerated Reefer']
      },
      {
        origin: 'Guwahati',
        destination: 'Siliguri',
        distanceKm: 438,
        highway: 'NH-27',
        corridorSlug: 'guwahati-to-siliguri',
        typicalCargo: 'FMCG linehaul, tea, plywood, agro produce',
        suitableVehicles: ['Eicher Pro 17ft', 'BharatBenz 20ft / 24ft', '32ft Container']
      },
      {
        origin: 'Guwahati',
        destination: 'Dibrugarh',
        distanceKm: 442,
        highway: 'NH-27 & NH-37',
        corridorSlug: 'guwahati-to-dibrugarh',
        typicalCargo: 'Industrial machinery, steel, FMCG, tea garden supplies',
        suitableVehicles: ['Eicher Pro 17ft', 'BharatBenz 20ft / 24ft', '32ft Container']
      }
    ],
    workflowSteps: SHIPPER_WORKFLOW_STEPS,
    faqs: [
      {
        question: 'How do I book commercial freight online on Zuggi?',
        answer:
          'Sign in to the Shipper portal with your mobile number, click Post a Load, enter pickup/delivery details, cargo weight, and required truck category, then compare direct bids from registered transporters before confirming.'
      },
      {
        question: 'Does Zuggi guarantee fixed freight rates before bidding?',
        answer:
          'No. Freight quotes are submitted directly by truck owners and fleet operators based on your exact route, tonnage, vehicle body type, and schedule so you always see real market quotes.'
      },
      {
        question: 'How does the online payment workflow operate?',
        answer:
          'Zuggi uses a structured Cashfree payment workflow split into a pickup advance stage after loading confirmation and a final balance stage after electronic proof of delivery (e-POD) and Delivery OTP verification.'
      },
      {
        question: 'Can both small businesses and enterprise shippers use Zuggi?',
        answer:
          'Yes. Whether you need a 3-Wheeler Cargo or Tata Ace for local commercial cartons or a 32ft container for interstate linehaul, the same online load posting, tracking, and GST invoicing workflow applies.'
      }
    ],
    relatedSlugs: [
      '/truck-booking-guwahati',
      '/truck-transport-assam',
      '/northeast-india-transport',
      '/truck-loads'
    ]
  },
  {
    slug: '/truck-loads',
    shortLabel: 'Truck Loads for Transporters',
    targetKeyword: 'Truck loads for transporters',
    seoTitle: 'Commercial Truck Loads for Transporters & Fleet Owners | Zuggi',
    metaDescription:
      'Find commercial truck loads on Zuggi Partner. Onboard your trucks with KYC & RC, bid directly on posted shipper loads, track trips, and get structured payouts.',
    eyebrow: 'Zuggi Partner — Drivers, Truck Owners & Fleet Operators',
    h1: 'Find Commercial Truck Loads for Transporters & Fleet Owners',
    heroLead:
      'Connect directly with commercial shippers posting full-load and part-load requirements. Onboard your trucks on Zuggi Partner, bid directly on matching loads, manage drivers, and receive structured bank settlements.',
    heroImageKey: 'highway',
    heroImageAlt: 'Commercial trucks and fleet operators hauling freight loads on Indian highways',
    audience: 'transporter',
    primaryCtaLabel: 'Open Zuggi Partner Portal',
    secondaryCtaLabel: 'Browse Public Freight Listings',
    secondaryCtaPath: '/freight',
    areaServed: ['Assam', 'Northeast India', 'West Bengal', 'India'],
    serviceType: 'Commercial Truck Loads Marketplace for Transporters',
    highlights: [
      {
        label: 'Direct Freight Bidding',
        detail: 'View shipper load specifications—pickup, destination, weight, and truck type—and submit your quote directly.'
      },
      {
        label: 'Multi-Role Partner Dashboards',
        detail: 'Dedicated tools for independent drivers, single-truck vehicle owners, and multi-vehicle fleet operators.'
      },
      {
        label: 'Digital Onboarding & Fleet Management',
        detail: 'Upload Driving License, Vehicle RC, insurance, and commercial permit documents and assign drivers to vehicles.'
      },
      {
        label: 'Structured Payout Workflow',
        detail: 'Receive transparent pickup advance and post-delivery balance settlements to your registered bank account after e-POD and OTP confirmation.'
      }
    ],
    sections: [
      {
        heading: 'Built for Drivers, Vehicle Owners, and Fleet Operators',
        intro:
          'Idle trucks and empty return trips erode transporter margins. Zuggi Partner gives commercial vehicle operators direct visibility into posted shipper loads across Assam, Northeast India, and connecting trunk lanes.',
        subsections: [
          {
            subheading: 'Simple Transporter & Vehicle Onboarding',
            body: 'Register with mobile OTP verification, submit identity KYC, Driving License, Vehicle Registration Certificate (RC), fitness, insurance, and permit records, and add your vehicles to start quoting on loads.'
          },
          {
            subheading: 'Assign Drivers & Manage Live Trips',
            body: 'Fleet partners can register multiple trucks and drivers, assign a driver to an accepted booking, share live GPS trip links, update transit milestones, and record delivery via e-POD photo capture and Delivery OTP.'
          }
        ]
      },
      {
        heading: 'Transparent Load Information & Settlement Flow',
        intro:
          'Every load listing clearly specifies cargo details before you submit a bid so you can price trips accurately based on distance, terrain, and truck capacity.',
        subsections: [
          {
            subheading: 'Clear Consignment Specifications Before Bidding',
            body: 'Inspect pickup city, delivery city, estimated highway distance, cargo category, weight in kg, full-load vs. part-load requirement, and body type (open, tarpaulin, closed container, flatbed, or refrigerated) upfront.'
          },
          {
            subheading: 'Two-Stage Bank Settlements via Cashfree',
            body: 'Once your bid is accepted and loading is verified, the Cashfree settlement workflow processes the pickup advance stage followed by the final balance release after Delivery OTP and e-POD verification.'
          }
        ]
      }
    ],
    featuredVehicleIds: ['tata_ace', 'bolero_pickup', 'ashok_leyland_dost', 'tata_407', 'eicher_14ft', 'eicher_17ft', 'truck_20ft', 'container_32ft'],
    featuredRoutes: [
      {
        origin: 'Dibrugarh',
        destination: 'Guwahati',
        distanceKm: 442,
        highway: 'NH-37 & NH-27',
        corridorSlug: 'dibrugarh-to-guwahati',
        typicalCargo: 'Return tea consignments, plywood, agro bulk',
        suitableVehicles: ['Eicher Pro 14ft', 'Eicher Pro 17ft', '32ft Container']
      },
      {
        origin: 'Tezpur',
        destination: 'Dimapur',
        distanceKm: 215,
        highway: 'NH-15 & NH-29',
        corridorSlug: 'tezpur-to-dimapur',
        typicalCargo: 'TMT steel rebars, galvanized roofing sheets, hardware',
        suitableVehicles: ['Eicher Pro 17ft', 'BharatBenz 20ft / 24ft']
      },
      {
        origin: 'Guwahati',
        destination: 'Siliguri',
        distanceKm: 438,
        highway: 'NH-27',
        corridorSlug: 'guwahati-to-siliguri',
        typicalCargo: 'Tea, plywood, industrial spares, e-commerce linehaul',
        suitableVehicles: ['Eicher Pro 17ft', 'BharatBenz 20ft / 24ft', '32ft Container']
      },
      {
        origin: 'Guwahati',
        destination: 'Shillong',
        distanceKm: 98,
        highway: 'NH-6',
        corridorSlug: 'guwahati-to-shillong',
        typicalCargo: 'Packaged groceries, FMCG, retail electronics',
        suitableVehicles: ['Tata Ace', 'Mahindra Bolero Maxi Truck', 'Tata 407 LCV']
      }
    ],
    workflowSteps: TRANSPORTER_WORKFLOW_STEPS,
    faqs: [
      {
        question: 'Who can register on Zuggi to find truck loads?',
        answer:
          'Independent commercial drivers, single-vehicle truck owners, and multi-truck fleet operators or transport companies with valid commercial vehicles and KYC/RC documentation can register through the Zuggi Partner portal.'
      },
      {
        question: 'What documents are needed for transporter onboarding?',
        answer:
          'Partners submit mobile OTP verification, identity KYC (PAN/GSTIN where applicable), Driving License, Vehicle Registration Certificate (RC), insurance, commercial permit details, and bank payout details.'
      },
      {
        question: 'What commercial vehicle sizes can bid on loads?',
        answer:
          'Zuggi supports 10 commercial vehicle categories—from 3-Wheeler Cargo (500 kg) and Tata Ace (850 kg) through Bolero Pickup, Dost+, Tata 407, Eicher 14ft/17ft, 20ft/24ft trucks, 32ft SXL/MXL containers, and refrigerated reefers.'
      },
      {
        question: 'How do transporters receive freight payments?',
        answer:
          'Payments follow a two-stage settlement workflow via Cashfree: a pickup advance stage after loading verification and the remaining balance after uploading e-POD and verifying Delivery OTP.'
      }
    ],
    relatedSlugs: [
      '/truck-booking-guwahati',
      '/truck-transport-assam',
      '/truck-hire-guwahati-dibrugarh',
      '/online-freight-booking'
    ]
  },
  {
    slug: '/logistics-companies-assam',
    shortLabel: 'Logistics Companies Assam',
    targetKeyword: 'Logistics companies in Assam',
    seoTitle: 'Digital Freight & Logistics Marketplace in Assam | Zuggi',
    metaDescription:
      'Compare how Zuggi’s commercial freight marketplace in Assam connects shippers directly with onboarded truck owners, live GPS tracking, e-POD & GST billing.',
    eyebrow: 'Assam Commercial Freight Technology',
    h1: 'A Direct Commercial Freight Marketplace for Assam Logistics',
    heroLead:
      'Businesses comparing logistics companies in Assam can use Zuggi to connect directly with onboarded truck owners, fleet operators, and transporters—bringing transparent freight bidding, live GPS tracking, and digital invoicing into one platform.',
    heroImageKey: 'hub',
    heroImageAlt: 'Assam commercial logistics and freight operations hub connecting shippers with truck fleets',
    audience: 'shipper',
    primaryCtaLabel: 'Start Shipping on Zuggi',
    secondaryCtaLabel: 'Contact Guwahati Dispatch Desk',
    secondaryCtaPath: '/contact',
    areaServed: ['Assam', 'Guwahati', 'Dibrugarh', 'Jorhat', 'Silchar', 'Tezpur', 'Tinsukia'],
    serviceType: 'Commercial Freight Marketplace in Assam',
    highlights: [
      {
        label: 'Direct Marketplace Model',
        detail: 'Connect directly with onboarded Assam truck owners and fleet partners instead of multi-layer manual brokerage.'
      },
      {
        label: 'End-to-End Consignment Control',
        detail: 'Manage load posting, quotation comparison, vehicle assignment, GPS monitoring, and GST invoicing from one dashboard.'
      },
      {
        label: 'Built in Guwahati for Assam Trade',
        detail: 'Designed around Assam’s real cargo types—tea, building materials, FMCG, agro produce, and industrial supplies.'
      },
      {
        label: 'Verified Handover & Payments',
        detail: 'Combine electronic proof of delivery (e-POD), Delivery OTP checks, and structured Cashfree payment settlements.'
      }
    ],
    sections: [
      {
        heading: 'How a Digital Freight Marketplace Differs From Traditional Assam Brokers',
        intro:
          'When evaluating logistics companies in Assam, businesses often face manual rate negotiations, limited transit updates once a truck leaves the warehouse, and slow paper POD reconciliation. Zuggi digitizes these core workflows.',
        subsections: [
          {
            subheading: 'Transparent Direct Bidding vs. Manual Phone Brokerage',
            body: 'Shippers publish structured load specifications once and compare competitive bids directly from registered transporters and fleet owners rather than chasing unverified phone quotes.'
          },
          {
            subheading: 'Documented Compliance & Digital Records',
            body: 'Every transporter onboarding captures vehicle RC, driving license, and permit documents, while completed bookings store digital GST invoices and e-POD records in the shipper dashboard.'
          }
        ]
      },
      {
        heading: 'Operational Features Supporting Assam Commercial Supply Chains',
        intro:
          'Zuggi equips manufacturers, wholesale distributors, tea estates, and project contractors with practical dispatch visibility across Assam and connecting Northeast corridors.',
        subsections: [
          {
            subheading: 'Live GPS Location, ETA & Geofence Alerts',
            body: 'Track assigned trucks along NH-27, NH-37, NH-15, and NH-6 with live ETA estimates and automated notifications when the vehicle enters pickup or delivery zones.'
          },
          {
            subheading: 'Dedicated Shipper, Fleet & Operations Support',
            body: 'Use role-specific portals for shippers and fleet partners, backed by Zuggi’s Guwahati operations desk for dispatch coordination and support ticketing.'
          }
        ]
      }
    ],
    featuredVehicleIds: ['tata_ace', 'bolero_pickup', 'tata_407', 'eicher_14ft', 'eicher_17ft', 'truck_20ft', 'container_32ft'],
    featuredRoutes: [
      {
        origin: 'Guwahati',
        destination: 'Dibrugarh',
        distanceKm: 442,
        highway: 'NH-27 & NH-37',
        corridorSlug: 'guwahati-to-dibrugarh',
        typicalCargo: 'Tea garden machinery, FMCG, construction steel, pharma',
        suitableVehicles: ['Eicher Pro 17ft', 'BharatBenz 20ft / 24ft', '32ft Container']
      },
      {
        origin: 'Guwahati',
        destination: 'Jorhat',
        distanceKm: 308,
        highway: 'NH-27 & NH-715',
        corridorSlug: 'guwahati-to-jorhat',
        typicalCargo: 'Retail groceries, tea estate supplies, hardware, tiles',
        suitableVehicles: ['Tata 407 LCV', 'Eicher Pro 14ft', 'Eicher Pro 17ft']
      },
      {
        origin: 'Guwahati',
        destination: 'Silchar',
        distanceKm: 325,
        highway: 'NH-6 (Barak Valley Corridor)',
        corridorSlug: 'guwahati-to-silchar',
        typicalCargo: 'Cement, wholesale grains, beverages, consumer goods',
        suitableVehicles: ['Mahindra Bolero Maxi Truck', 'Tata 407 LCV', 'Eicher Pro 17ft']
      },
      {
        origin: 'Guwahati',
        destination: 'Tezpur',
        distanceKm: 182,
        highway: 'NH-27 & NH-15',
        corridorSlug: 'guwahati-to-tezpur',
        typicalCargo: 'Agricultural inputs, dairy, FMCG, iron & hardware',
        suitableVehicles: ['Mahindra Bolero Maxi Truck', 'Tata 407 LCV', 'Eicher Pro 14ft']
      }
    ],
    workflowSteps: SHIPPER_WORKFLOW_STEPS,
    faqs: [
      {
        question: 'Is Zuggi a traditional logistics company or a commercial freight marketplace?',
        answer:
          'Zuggi is a commercial freight marketplace headquartered in Guwahati, Assam that connects shippers directly with onboarded truck owners, drivers, and fleet operators, providing digital load posting, bidding, live GPS tracking, e-POD, and GST invoicing.'
      },
      {
        question: 'What industries in Assam use Zuggi for road freight?',
        answer:
          'Zuggi supports commercial goods categories including packaged and bulk tea, FMCG and groceries, building materials and steel, agricultural produce, industrial machinery, pharmaceuticals, textiles, and general commercial freight.'
      },
      {
        question: 'How can a business get GST invoices for Assam freight shipments?',
        answer:
          'Every completed booking on Zuggi generates a digital GST-compliant consignment invoice accessible directly from the Shipper dashboard.'
      },
      {
        question: 'Can Assam transport companies and fleet owners join Zuggi?',
        answer:
          'Yes. Fleet operators and transport companies can onboard their trucks and drivers on the Zuggi Partner portal to bid directly on commercial loads posted across Assam and Northeast India.'
      }
    ],
    relatedSlugs: [
      '/truck-booking-guwahati',
      '/truck-transport-assam',
      '/northeast-india-transport',
      '/online-freight-booking'
    ]
  }
];

export const SEO_LANDING_PAGE_BY_SLUG: Record<string, SeoLandingPageConfig> = Object.fromEntries(
  SEO_LANDING_PAGES.map((page) => [page.slug, page])
);

export function normalizePathname(pathname: string): string {
  const clean = (pathname || '/').split('?')[0].split('#')[0].replace(/\/+$/, '');
  return clean ? clean.toLowerCase() : '/';
}

export function findSeoLandingPage(pathname: string): SeoLandingPageConfig | null {
  return SEO_LANDING_PAGE_BY_SLUG[normalizePathname(pathname)] || null;
}

export function isSeoLandingRoute(pathname: string): boolean {
  return Boolean(findSeoLandingPage(pathname));
}

export function getFactualVehiclesByIds(ids: string[]): FactualVehicleCategory[] {
  const map = new Map(FACTUAL_VEHICLE_CATEGORIES.map((v) => [v.id, v]));
  return ids.map((id) => map.get(id)).filter((v): v is FactualVehicleCategory => Boolean(v));
}
