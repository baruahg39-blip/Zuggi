/**
 * VahanSetu Freight - Commercial Goods Transportation Platform Types
 */

export type UserRole = 'customer' | 'driver' | 'vehicle_owner' | 'transporter' | 'fleet_partner' | 'admin';

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  businessName?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  state: string;
  city: string;
  isVerified: boolean;
  isBlocked?: boolean;
  blockedReason?: string;
  blockedAt?: string;
  isTestAccount?: boolean;
  hasPasscode?: boolean;
  passcodeHash?: string;
  passcodeUpdatedAt?: string;
  bankDetails?: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
    isVerified?: boolean;
    updatedAt?: string;
  };
  createdAt: string;
}

export type VehicleCategoryType =
  | 'three_wheeler'
  | 'tata_ace'
  | 'bolero_pickup'
  | 'ashok_leyland_dost'
  | 'tata_407'
  | 'eicher_14ft'
  | 'eicher_17ft'
  | 'truck_20ft'
  | 'container_32ft'
  | 'trailer_40ft'
  | 'reefer_cold_chain';

export interface VehicleCategory {
  id: VehicleCategoryType;
  name: string;
  hindiName: string;
  assameseName: string;
  capacityKg: number;
  capacityTonnes: number;
  dimensions: {
    lengthFt: number;
    widthFt: number;
    heightFt: number;
  };
  bodyTypes: ('open' | 'closed_container' | 'tarpaulin' | 'refrigerated' | 'flatbed')[];
  basePricePerKm: number;
  minBasePrice: number;
  idealFor: string;
  imageUrl: string;
  isPopular?: boolean;
}

export type DocumentType = 'rc' | 'driving_license' | 'fitness' | 'insurance' | 'pollution' | 'national_permit';
export type KycDocumentType = 'pan' | 'aadhaar' | 'gst' | 'driving_license' | 'rc' | 'fitness' | 'cancelled_cheque';
export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export interface KycDocument {
  id: string;
  type: KycDocumentType;
  title: string;
  documentNumber: string;
  fileUrl?: string;
  fileName?: string;
  fileSizeKb?: number;
  uploadedAt?: string;
  status: 'not_uploaded' | 'uploading' | 'validating' | 'verified' | 'rejected';
  rejectionReason?: string;
}

export interface VehicleDocument {
  id: string;
  type: DocumentType;
  documentNumber: string;
  documentUrl: string;
  expiryDate: string;
  verificationStatus: VerificationStatus;
  rejectionReason?: string;
  verifiedAt?: string;
}

export interface CommercialVehicle {
  id: string;
  ownerId: string;
  transporterName: string;
  registrationNumber: string; // e.g., AS-01-EC-4921
  category: VehicleCategoryType;
  bodyType: 'open' | 'closed_container' | 'tarpaulin' | 'refrigerated' | 'flatbed';
  capacityKg: number;
  modelName: string;
  fuelType: 'diesel' | 'cng' | 'ev' | 'petrol';
  permitType: 'state' | 'national' | 'all_northeast';
  currentLocation: {
    lat: number;
    lng: number;
    address: string;
    city: string;
  };
  isOnline: boolean;
  isAvailable: boolean;
  verificationStatus: VerificationStatus;
  documents: VehicleDocument[];
  assignedDriverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverRating: number;
  completedTrips: number;
  photoUrl: string;
  isBlocked?: boolean;
  blockedReason?: string;
}

export type LoadStatus =
  | 'posted'
  | 'bidding'
  | 'booked'
  | 'assigned'
  | 'en_route_pickup'
  | 'at_pickup'
  | 'loading'
  | 'in_transit'
  | 'at_destination'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'blocked';

export interface LocationPoint {
  address: string;
  city: string;
  district?: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  contactName: string;
  contactPhone: string;
}

export type GoodsCategory =
  | 'tea_packaged_bulk'
  | 'agricultural_produce'
  | 'fmcg_groceries'
  | 'building_materials_cement'
  | 'timber_bamboo'
  | 'hardware_machinery'
  | 'pharmaceuticals'
  | 'ecommerce_parcels'
  | 'textiles_garments'
  | 'petroleum_chemicals_safe'
  | 'household_shifting'
  | 'general_freight';

export interface LoadItem {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerCompany?: string;
  customerGstin?: string;
  pickup: LocationPoint;
  delivery: LocationPoint;
  pickupDateTime: string;
  expectedDeliveryDateTime: string;
  goodsCategory: GoodsCategory;
  goodsDescription: string;
  weightKg: number;
  volumeCuFt?: number;
  packageCount: number;
  declaredValueInr: number;
  requiredVehicleCategory: VehicleCategoryType;
  requiredBodyType: 'open' | 'closed_container' | 'tarpaulin' | 'refrigerated' | 'flatbed';
  loadType: 'full_load' | 'part_load';
  specialRequirements: {
    fragile: boolean;
    coveredTruck: boolean;
    refrigerationNeeded: boolean;
    loadingHelpersNeeded: number;
    unloadingHelpersNeeded: number;
    eWayBillAvailable: boolean;
    eWayBillNumber?: string;
  };
  pricingMode: 'instant_fixed' | 'bidding' | 'shipper_budget';
  targetBudgetInr?: number;
  estimatedDistanceKm: number;
  estimatedDurationHours: number;
  status: LoadStatus;
  createdAt: string;
  matchedVehicleCount: number;
  assignedBookingId?: string;
  deliveryOtp: string; // 4-digit code generated for consignee confirmation
  isTestLoad?: boolean;
  cancellationReason?: string;
  cancelledAt?: string;
  isBlocked?: boolean;
  blockedReason?: string;
}

export interface Quotation {
  id: string;
  loadId: string;
  transporterId: string;
  transporterName: string;
  transporterPhone: string;
  vehicleId: string;
  vehicleRegNumber: string;
  vehicleCategory: VehicleCategoryType;
  driverName: string;
  driverRating: number;
  driverCompletedTrips: number;
  quoteAmountInr: number;
  chargeBreakdown: {
    baseFreight: number;
    fuelSurcharge?: number;
    loadingUnloadingCharges: number;
    tollEstimate: number;
    gstAmount: number; // 5% GTA
    platformFee: number;
  };
  estimatedPickupTime: string;
  notes?: string;
  counterOfferAmountInr?: number;
  counterOfferNote?: string;
  status: 'submitted' | 'countered' | 'accepted' | 'rejected' | 'withdrawn';
  isTestBid?: boolean;
  createdAt: string;
}

export type PracticalPaymentMethod = 'upi' | 'bank_transfer' | 'pay_driver_direct' | 'online_gateway';

export interface BusinessPaymentSettings {
  businessName: string;
  upiId: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  supportPhone?: string;
  updatedAt?: string;
}

export interface BookingLiveEta {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  staticDurationSeconds: number;
  trafficDelayMinutes: number;
  trafficCondition: 'clear' | 'moderate' | 'heavy';
  etaIso: string;
  formattedDuration: string;
  formattedArrivalTime: string;
  originLat: number;
  originLng: number;
  destinationCity: string;
  calculatedAt: string;
  source: 'google_routes_matrix' | 'gps_estimate';
}

export interface Booking {
  id: string;
  loadId: string;
  quotationId?: string;
  customerId: string;
  transporterId: string;
  driverId: string;
  vehicleId: string;
  pickup: LocationPoint;
  delivery: LocationPoint;
  goodsDescription: string;
  weightKg: number;
  totalAgreedAmountInr: number;
  platformCommissionInr: number;
  netDriverPayableInr: number;
  status: LoadStatus;
  paymentStatus: 'pending' | 'escrowed' | 'advance_paid' | 'completed' | 'refunded';
  paymentMode: 'online_upi' | 'bank_transfer' | 'cash_on_delivery' | 'to_pay_consignee';
  customerAdvanceAmountInr: number; // 90% of totalAgreedAmountInr (payable before pickup)
  customerBalanceAmountInr: number; // 10% of totalAgreedAmountInr (payable upon delivery)
  driverFirstPayoutInr: number;     // 90% of netDriverPayableInr (disbursed after verified pickup)
  driverFinalPayoutInr: number;     // 10% of netDriverPayableInr (disbursed after POD & zero dispute)
  paymentAdvanceStatus: 'pending' | 'processing' | 'paid' | 'failed';
  paymentBalanceStatus: 'pending' | 'processing' | 'paid' | 'failed';
  payoutStage1Status: 'pending' | 'processing' | 'settled' | 'failed';
  payoutStage2Status: 'pending' | 'processing' | 'settled' | 'disputed_on_hold' | 'failed';
  advancePaymentMethod?: PracticalPaymentMethod;
  advancePaymentUtr?: string;
  advanceRejectionNote?: string;
  balancePaymentMethod?: PracticalPaymentMethod;
  balancePaymentUtr?: string;
  balanceRejectionNote?: string;
  stage1PayoutUtr?: string;
  stage2PayoutUtr?: string;
  driverCommissionDueInr?: number;
  driverCommissionStatus?: 'none' | 'due' | 'verifying_utr' | 'paid' | 'adjusted_in_payout';
  driverCommissionUtr?: string;
  driverCommissionRejectionNote?: string;
  driverCommissionPaidAt?: string;
  cashfreeAdvanceOrderId?: string;
  cashfreeBalanceOrderId?: string;
  cashfreeStage1SplitId?: string;
  cashfreeStage2SplitId?: string;
  dispute?: PaymentDispute;
  deliveryOtp: string;
  pickupConfirmedAt?: string;
  loadingProofUrl?: string;
  podDocumentUrl?: string;
  podSignatureUrl?: string;
  eWayBillNumber?: string;
  trackingToken?: string;
  liveEta?: BookingLiveEta;
  geofenceConfig?: GeofenceZoneConfig;
  geofenceState?: GeofenceZoneState;
  isTestBooking?: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface PaymentDispute {
  id: string;
  bookingId: string;
  loadId: string;
  customerId: string;
  customerName: string;
  driverId: string;
  driverName: string;
  reason: 'damaged_cargo' | 'missing_items' | 'transit_delay' | 'extortion_cash_demanded' | 'other';
  description: string;
  evidencePhotoUrl?: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED_RELEASED' | 'RESOLVED_REFUNDED';
  heldAmountInr: number; // The 10% final payout amount on hold
  createdAt: string;
  resolvedAt?: string;
  adminResolutionNotes?: string;
}

export interface CashfreeVendor {
  vendorId: string;
  userId: string;
  legalName: string;
  email: string;
  phone: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  upiVpa: string;
  pan: string;
  gstin?: string;
  status: 'INITIATED' | 'IN_BENE_CREATION' | 'ACTIVE' | 'REJECTED';
  pennyDropVerified: boolean;
  registeredAt: string;
}

export interface MarketplacePaymentTransaction {
  id: string;
  bookingId: string;
  type: 'customer_advance_90' | 'customer_balance_10' | 'driver_payout_stage1' | 'driver_payout_stage2' | 'platform_commission' | 'refund';
  amountInr: number;
  orderId: string;
  splitId?: string;
  cfPaymentId?: string;
  status: 'pending' | 'success' | 'failed' | 'on_hold';
  timestamp: string;
  notes: string;
}

export interface GeofenceZoneConfig {
  pickupRadiusMeters: number;   // Default 800m around pickup gate
  deliveryRadiusMeters: number; // Default 500m around delivery godown
  autoUpdateStatus: boolean;    // Automatically advance trip/booking status on zone crossing
  updatedAt?: string;
}

export type GeofenceZoneType = 'pickup' | 'delivery';
export type GeofenceTransition = 'ENTERED' | 'EXITED';

export interface GeofenceZoneState {
  insidePickup: boolean;
  insideDelivery: boolean;
  distanceToPickupMeters?: number;
  distanceToDeliveryMeters?: number;
  lastCheckedAt?: string;
}

export interface GeofenceEvent {
  id: string;
  bookingId: string;
  tripId?: string;
  loadId?: string;
  vehicleId?: string;
  driverId?: string;
  zoneType: GeofenceZoneType;
  transition: GeofenceTransition;
  zoneLabel: string;
  city: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  radiusMeters: number;
  autoUpdatedStatus?: string;
  message: string;
  timestamp: string;
}

export interface LocationPing {
  bookingId: string;
  lat: number;
  lng: number;
  speedKmh: number;
  heading: number;
  timestamp: string;
  batteryLevel?: number;
  isGpsReliable: boolean;
  nearLandmark?: string;
}

// --- Trip Assignment & Vehicle Tracking Models ---
export type GpsTrackingType = 'MOBILE_APP' | 'WEB_LINK' | 'HARDWARE_GPS';

export interface FleetVehicle {
  id: string;
  owner_id: string;
  vehicle_number: string;
  vehicle_type: string;
  gps_type: GpsTrackingType;
  gps_device_id?: string;
  is_available?: boolean;
}

export interface FleetDriver {
  id: string;
  owner_id: string;
  name: string;
  phone_number: string;
  is_active: boolean;
}

export type TripStatus = 'ASSIGNED' | 'AT_PICKUP' | 'IN_TRANSIT' | 'DELIVERED';

export interface TripShipment {
  id: string;
  load_id: string;
  assigned_vehicle_id: string;
  assigned_driver_id: string;
  status: TripStatus;
  tracking_token: string;
  tracking_source: GpsTrackingType;
  created_at: string;
  updated_at: string;
  latest_ping?: TripLocationPing;
}

export interface TripLocationPing {
  trip_id: string;
  lat: number;
  lng: number;
  speed: number;          // in km/h
  heading: number;        // 0 - 360 degrees
  battery_level: number;  // 0 - 100 percentage
  recorded_at: string;    // ISO timestamp
  is_buffered?: boolean;  // whether ping was queued during network drop
}

export interface TripLiveTrackingResponse {
  trip_id: string;
  load_id: string;
  status: TripStatus;
  pickup: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    contact_name?: string;
    contact_phone?: string;
  };
  drop: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    contact_name?: string;
    contact_phone?: string;
  };
  route_polyline?: string;
  latest_location: TripLocationPing | null;
  location_history: TripLocationPing[];
  driver: {
    id: string;
    name: string;
    phone_number: string;
    is_active: boolean;
  };
  vehicle: {
    id: string;
    vehicle_number: string;
    vehicle_type: string;
    gps_type: GpsTrackingType;
    gps_device_id?: string;
  };
  eta: {
    minutes: number;
    formatted: string;
    distance_remaining_km: number;
    eta_iso?: string;
    formatted_arrival_time?: string;
    traffic_condition?: 'clear' | 'moderate' | 'heavy';
    traffic_delay_minutes?: number;
    source?: 'google_routes_matrix' | 'gps_estimate';
    calculated_at?: string;
  };
  tracking_token?: string;
  tracking_source: GpsTrackingType;
  offline_buffer_status: {
    is_live: boolean;
    last_ping_age_seconds: number;
    buffered_pings_count: number;
  };
  geofence_config?: GeofenceZoneConfig;
  geofence_state?: GeofenceZoneState;
  geofence_events?: GeofenceEvent[];
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. VSF/2026-27/00142
  bookingId: string;
  loadId: string;
  consignor: {
    name: string;
    company: string;
    gstin?: string;
    address: string;
    state: string;
  };
  consignee: {
    name: string;
    company?: string;
    address: string;
    state: string;
  };
  transporter: {
    name: string;
    gstin: string;
    pan: string;
    regNumber: string;
  };
  sacCode: '996511' | '996519'; // GST SAC for Road Transport of Goods
  freightAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  gstPayableUnderRcm: boolean; // Reverse Charge Mechanism standard in Indian GTA
  invoiceDate: string;
  status: 'issued' | 'paid' | 'cancelled';
}

export interface Settlement {
  id: string;
  settlementRef: string;
  driverId: string;
  driverName: string;
  bookingId: string;
  grossFreight: number;
  commission: number;
  tdsDeduction: number; // 1% / 2% TDS u/s 194C
  netDisbursed: number;
  bankAccount: {
    bankName: string;
    accountNumberMasked: string;
    ifsc: string;
    upiId: string;
  };
  status: 'processing' | 'settled' | 'failed';
  utrNumber?: string;
  settledAt: string;
}

export interface AppNotification {
  id: string;
  recipientRole: UserRole;
  recipientId: string;
  title: string;
  message: string;
  type: 'bid_received' | 'booking_confirmed' | 'trip_milestone' | 'payment_received' | 'document_verified' | 'alert';
  linkId?: string;
  read: boolean;
  timestamp: string;
}

export type TicketCategory =
  | 'payment_billing'
  | 'transit_delay'
  | 'vehicle_breakdown'
  | 'cargo_damage'
  | 'e_way_bill_gst'
  | 'fastag_toll'
  | 'kyc_verification'
  | 'app_technical'
  | 'general_inquiry';

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface TicketMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'driver' | 'vehicle_owner' | 'transporter' | 'fleet_partner' | 'admin' | 'system';
  message: string;
  timestamp: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string; // e.g. "TICK-8021"
  userId: string;
  userName: string;
  userPhone: string;
  userRole: UserRole;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  description: string;
  relatedLoadId?: string;
  relatedBookingId?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  assignedAdminName?: string;
  messages: TicketMessage[];
}

export interface TripFeedback {
  id: string;
  bookingId: string;
  loadId: string;
  customerId: string;
  customerName: string;
  customerCompany?: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehicleRegNumber: string;
  
  // Core Post-Trip Rating Criteria (1 to 5)
  punctualityRating: number;      // 1-5 stars: Pickup & delivery schedule adherence
  vehicleConditionRating: number; // 1-5 stars: Cargo bed cleanliness, tarpaulin, lashing & fitness
  communicationRating: number;    // 1-5 stars: Professionalism & highway transit status updates

  // Overall Calculated Score (1 to 5)
  overallRating: number;

  // Granular Feedback & Reviews
  tags: string[];                 // Quick compliment / issue tags
  reviewComments: string;         // Detailed written review
  tipAmountInr?: number;          // Optional driver appreciation tip
  wouldRecommend: boolean;        // Willingness to rebook
  createdAt: string;
}

// ==========================================
// VEHICLE PARTNER ONBOARDING & COMPLIANCE
// ==========================================

export type PartnerType = 'individual_owner' | 'driver' | 'fleet_partner';

export type PartnerAccountStatus = 
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'DOCUMENTS_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'EXPIRED';

export type PartnerAgreementType =
  | 'vehicle_owner_agreement'
  | 'driver_terms_conditions'
  | 'fleet_partner_agreement'
  | 'privacy_policy'
  | 'gps_tracking_consent'
  | 'load_booking_transport_terms';

export interface PartnerUploadedDoc {
  id: string;
  name: string;
  category: 
    | 'rc'
    | 'dl'
    | 'permit'
    | 'insurance'
    | 'fitness'
    | 'puc'
    | 'pan'
    | 'aadhaar'
    | 'gst'
    | 'bank_proof'
    | 'fleet_auth'
    | 'profile_photo';
  documentNumber: string;
  expiryDate?: string;
  vehicleClass?: string;
  fileUrl: string;
  status: 'pending' | 'verified' | 'rejected' | 'expired';
  rejectionReason?: string;
  uploadedAt: string;
  verifiedAt?: string;
}

export interface DigitalAcceptanceSubmission {
  userId: string;
  partnerType: PartnerType;
  legalFullName: string;
  agreedToMainTerms: boolean;
  agreedToPrivacy: boolean;
  agreedToGpsTracking: boolean;
  timestamp: string;
  agreements: {
    type: PartnerAgreementType;
    version: string;
    title: string;
  }[];
}

export interface AdminReviewLog {
  id: string;
  adminId: string;
  adminName: string;
  action: 'APPROVED' | 'REJECTED' | 'DOCUMENTS_REQUIRED' | 'SUSPENDED' | 'REACTIVATED';
  timestamp: string;
  notes?: string;
  requestedDocuments?: string[];
}

export interface PartnerApplication {
  id: string;
  userId: string;
  partnerType: PartnerType;
  status: PartnerAccountStatus;
  createdAt: string;
  updatedAt: string;
  
  // Personal / Representative Profile
  fullName: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  profilePhotoUrl?: string;

  // Emergency contact (driver & individual owner)
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };

  // Statutory & Tax
  pan?: string;
  aadhaarNumber?: string;
  gstin?: string;

  // Fleet / Enterprise Specific (for fleet_partner)
  companyDetails?: {
    companyName: string;
    authorizedRepName: string;
    authorizedRepDesignation: string;
    authorizedRepPhone: string;
    businessAddress: string;
    pan: string;
    gstin?: string;
  };

  // Bank & Settlement Details (Penny-drop / Cashfree Easy Split)
  bankDetails: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    upiId?: string;
    isVerified?: boolean;
  };

  // Registered Vehicles in Application
  registeredVehicles: {
    id: string;
    registrationNumber: string;
    category: VehicleCategoryType;
    modelName: string;
    capacityKg: number;
    permitType: 'state' | 'national' | 'all_northeast';
    insuranceExpiry?: string;
    fitnessExpiry?: string;
    pucExpiry?: string;
    rcDocNumber?: string;
  }[];

  // Registered Drivers in Application (for Fleet Partner)
  registeredDrivers?: {
    id: string;
    fullName: string;
    phone: string;
    dlNumber: string;
    dlExpiryDate: string;
    vehicleClass: string;
    emergencyPhone?: string;
  }[];

  // Document Vault
  documents: PartnerUploadedDoc[];

  // Digital Agreement Acceptance & Sign-off
  acceptance?: DigitalAcceptanceSubmission;

  // Admin Verification & Audit Trails
  reviewLogs: AdminReviewLog[];
  adminNotes?: string;
  rejectionReason?: string;
  requestedChangesNotes?: string;
}

