/**
 * Zuggi Logistics Marketplace - Partner Legal Agreements & Statutory Terms
 * Formatted as reviewable commercial freight agreements compliant with Indian Law
 * (Carriage by Road Act 2007, Motor Vehicles Act 1988/2019, IT Act 2000, DPDP Act 2023)
 */

import { PartnerAgreementType } from '../types';

export interface AgreementDocument {
  id: PartnerAgreementType;
  title: string;
  hindiTitle: string;
  version: string;
  effectiveDate: string;
  category: 'onboarding' | 'compliance' | 'operational';
  applicableRoles: ('individual_owner' | 'driver' | 'fleet_partner')[];
  summary: string;
  sections: {
    heading: string;
    content: string;
  }[];
}

export const CURRENT_AGREEMENT_VERSION = 'v2.4-2026';

export const PARTNER_AGREEMENTS: Record<PartnerAgreementType, AgreementDocument> = {
  vehicle_owner_agreement: {
    id: 'vehicle_owner_agreement',
    title: 'Individual Vehicle Owner Commercial Transport Agreement',
    hindiTitle: 'व्यक्तिगत वाहन मालिक वाणिज्यिक परिवहन अनुबंध',
    version: CURRENT_AGREEMENT_VERSION,
    effectiveDate: 'January 1, 2026',
    category: 'onboarding',
    applicableRoles: ['individual_owner'],
    summary: 'Governs the registration of commercial vehicles, roadworthiness obligations, insurance, tariff disbursement, and platform commission for individual truck & pickup owners.',
    sections: [
      {
        heading: '1. Representation, Authenticity of Title & Ownership',
        content: 'The Vehicle Owner represents and warrants that they are the registered legal owner or authorized lessee holding legal rights under Section 2(30) of the Motor Vehicles Act, 1988. All uploaded Registration Certificates (RC), State/All-India Permits, Insurance policies, and Fitness certificates must be genuine, legally valid, unencumbered, and up-to-date.'
      },
      {
        heading: '2. Vehicle Maintenance, Roadworthiness & Fitness',
        content: 'The Vehicle Owner covenants that each vehicle listed on Zuggi shall at all times possess a valid Certificate of Fitness issued under Section 56 of the Motor Vehicles Act, a valid Pollution Under Control (PUC) certificate, and comprehensive motor insurance covering commercial goods carriage. The Owner shall ensure adequate tyres, braking systems, lighting, cargo bed integrity, and waterproof tarpaulin sheets.'
      },
      {
        heading: '3. Carriage of Goods & Consignment Obligations',
        content: 'Upon accepting a transport quotation or assignment via the Zuggi marketplace, the Owner undertakes to carry the designated cargo safely, diligently, and expeditiously from the origin to destination without unauthorized transshipment or deviation from designated highway corridors.'
      },
      {
        heading: '4. Platform Commission, GST & Payout Settlement',
        content: 'The Owner agrees to a fixed platform facilitation fee of 5% on gross agreed freight. Payouts are executed via RBI-regulated Cashfree marketplace escrow in two stages: 90% released immediately upon OTP-verified cargo pickup, and 10% released upon clean Proof of Delivery (POD) upload and consignee confirmation. TDS under Section 194C of the Income Tax Act will be deducted where statutory thresholds apply.'
      },
      {
        heading: '5. Damage, Shortage, Theft & Insurance Responsibilities',
        content: 'The Owner acknowledges liability as a common carrier pursuant to the Carriage by Road Act, 2007 for any loss, damage, pilferage, or deterioration of cargo entrusted to them, except where directly caused by an Act of God or verified packaging defect by consignor. The Owner must maintain active third-party cargo protection.'
      },
      {
        heading: '6. Suspension, Termination & Jurisdiction',
        content: 'Zuggi reserves the right to suspend or terminate partner accounts for document forgery, permit lapse, safety violations, or repeated cancellations. This Agreement is governed by the laws of India, and disputes shall be subject to arbitration in Guwahati / Kamrup Metropolitan jurisdiction.'
      }
    ]
  },

  driver_terms_conditions: {
    id: 'driver_terms_conditions',
    title: 'Commercial Driver Code of Conduct & Operational Terms',
    hindiTitle: 'वाणिज्यिक चालक आचार संहिता एवं संचालन शर्तें',
    version: CURRENT_AGREEMENT_VERSION,
    effectiveDate: 'January 1, 2026',
    category: 'onboarding',
    applicableRoles: ['driver', 'individual_owner'],
    summary: 'Establishes driver obligations regarding valid commercial driving licenses, zero-tolerance intoxication, cargo handling safety, and prompt delivery execution.',
    sections: [
      {
        heading: '1. Commercial Driving License & Endorsements',
        content: 'The Driver represents and warrants that they hold a valid Commercial / Transport Driving License with appropriate vehicle endorsements (e.g. LMV-TR, HGV, TRANS) issued by an authorized Regional Transport Authority (RTA). The Driver must maintain a clean record and notify Zuggi immediately of any license suspension or disqualification.'
      },
      {
        heading: '2. Zero-Tolerance Safety, Alcohol & Substance Policy',
        content: 'Zuggi enforces a zero-tolerance policy regarding driving under the influence of alcohol, narcotics, psychotropic substances, or sleep-inducing medication. Breach will result in immediate permanent deactivation, police notification, and platform blacklisting.'
      },
      {
        heading: '3. Highway Operations, Trip Execution & Punctuality',
        content: 'The Driver must report promptly at origin loading yards, supervise loading to ensure weight limits are adhered to under axle load regulations, secure cargo with proper lashing, and verify seal integrity before departure. The Driver must obtain consignor sign-off and confirm pickup in the app.'
      },
      {
        heading: '4. Delivery Verification & Consignee OTP Confirmation',
        content: 'Consignment delivery is deemed complete ONLY when the designated consignee inspects the consignment, confirms the 4-digit digital Delivery OTP, and physically signs the delivery challan or lorry receipt (LR), which the Driver must photograph and upload as the Proof of Delivery (POD).'
      },
      {
        heading: '5. Accident, Emergency & Breakdown Protocols',
        content: 'In the event of road accidents, vehicle breakdowns, road blockages, or cargo distress, the Driver must immediately activate the in-app emergency button, contact 24/7 Zuggi Highway Support, and notify local law enforcement / NHAI patrol where required.'
      },
      {
        heading: '6. Non-Poaching & Direct Solicitations',
        content: 'The Driver agrees not to solicit or accept off-platform freight arrangements directly with shippers or consignees introduced via the Zuggi network during the term of active engagement.'
      }
    ]
  },

  fleet_partner_agreement: {
    id: 'fleet_partner_agreement',
    title: 'Fleet Partner & Transporter Master Logistics Agreement',
    hindiTitle: 'फ्लीट पार्टनर और ट्रांसपोर्टर मास्टर लॉजिस्टिक्स अनुबंध',
    version: CURRENT_AGREEMENT_VERSION,
    effectiveDate: 'January 1, 2026',
    category: 'onboarding',
    applicableRoles: ['fleet_partner'],
    summary: 'Governs corporate transport companies, fleet managers, and aggregators dispatching multiple commercial vehicles and managing employed drivers on the platform.',
    sections: [
      {
        heading: '1. Corporate Authority, Representative & GST Registration',
        content: 'The Fleet Partner represents that they are a legally constituted commercial transport business (Proprietorship, Partnership, LLP, or Private Limited) holding a valid PAN and GSTIN (where mandatory). The authorized representative holds full authority to bind the firm.'
      },
      {
        heading: '2. Fleet Vetting, Multi-Vehicle Management & Driver Supervision',
        content: 'The Fleet Partner is directly responsible for verifying the legal credentials, driving history, background checks, and valid commercial licenses of all drivers registered under their fleet account. The Partner shall maintain updated RC, permit, and fitness records for all registered vehicles.'
      },
      {
        heading: '3. Multi-Vehicle Dispatch & Sub-Contracting Rules',
        content: 'Only vehicles and drivers registered, vetted, and approved under the Fleet Partner account may be assigned to accepted shipments. Third-party brokering or unauthorized re-assignment of booked loads to unverified outside trucks is strictly prohibited and constitutes grounds for immediate account suspension.'
      },
      {
        heading: '4. Enterprise Settlements & Automated Split Payouts',
        content: 'Payouts for completed trips across all fleet vehicles are routed directly to the verified corporate bank account of the Fleet Partner. The Fleet Partner assumes sole statutory responsibility for wages, incentives, employee provident fund, and statutory benefits payable to their assigned drivers.'
      },
      {
        heading: '5. Cargo Loss Liability & Indemnity',
        content: 'The Fleet Partner shall defend, indemnify, and hold harmless Zuggi, shippers, and consignees against all third-party claims, fines, vehicle impoundments, environmental cleanup costs, or cargo loss arising from gross negligence or willful misconduct of their employed drivers.'
      },
      {
        heading: '6. Term, Inactivity & Audits',
        content: 'Zuggi reserves the right to conduct periodic digital audits of vehicle permits, driver licenses, and maintenance records. This Agreement may be terminated by either party upon 30 days written notice.'
      }
    ]
  },

  privacy_policy: {
    id: 'privacy_policy',
    title: 'Partner Data Privacy & KYC Information Policy',
    hindiTitle: 'पार्टनर डेटा गोपनीयता एवं केवाईसी सूचना नीति',
    version: CURRENT_AGREEMENT_VERSION,
    effectiveDate: 'January 1, 2026',
    category: 'compliance',
    applicableRoles: ['individual_owner', 'driver', 'fleet_partner'],
    summary: 'Compliant with the Digital Personal Data Protection (DPDP) Act 2023 and Information Technology Act 2000, detailing how partner identity, documents, and banking information are processed and safeguarded.',
    sections: [
      {
        heading: '1. Information We Collect from Vehicle Partners',
        content: 'We collect personal identification data (full legal name, phone number, address, government IDs including Aadhaar, PAN, and Commercial Driving License), commercial vehicle records (RC, permits, fitness, PUC, insurance), financial records (bank account numbers, IFSC codes, UPI handles), and real-time highway telematics.'
      },
      {
        heading: '2. Purpose of Document Processing & Statutory Verification',
        content: 'Partner documents are processed strictly for: (a) regulatory compliance under the Carriage by Road Act and Motor Vehicles Act; (b) Parivahan Vahan & Sarathi API cross-verification; (c) Cashfree penny-drop bank account validation; and (d) generating legal Goods Consignment Notes (LRs) and e-Way Bills.'
      },
      {
        heading: '3. Data Security, Access Control & Storage',
        content: 'All uploaded identity and vehicle documents are encrypted in transit via TLS 1.3 and stored in secure, access-controlled cloud repositories located within the territory of India in accordance with RBI and MeitY data localization mandates. Only authorized compliance officers possess verification access.'
      },
      {
        heading: '4. Sharing of Information with Shippers & Statutory Authorities',
        content: 'During an active consignment, vehicle registration numbers, driver name, commercial photo, and live GPS coordinates are shared with the consignor and consignee for tracking and safety purposes. We do not sell or monetize partner data.'
      },
      {
        heading: '5. Partner Rights & Grievance Redressal',
        content: 'Partners may review their uploaded documents, request rectification of inaccurate data, or request account closure subject to statutory retention requirements for financial and tax records. The Platform Grievance Officer can be contacted at privacy@zuggi.in.'
      }
    ]
  },

  gps_tracking_consent: {
    id: 'gps_tracking_consent',
    title: 'Continuous Highway Telematics & GPS Tracking Consent',
    hindiTitle: 'सतत हाईवे टेलीमैटिक्स एवं जीपीएस ट्रैकिंग सहमति',
    version: CURRENT_AGREEMENT_VERSION,
    effectiveDate: 'January 1, 2026',
    category: 'compliance',
    applicableRoles: ['individual_owner', 'driver', 'fleet_partner'],
    summary: 'Mandatory consent enabling real-time smartphone GPS and AIS-140 device location transmission to monitor cargo transit, geofence milestones, and ensure highway safety.',
    sections: [
      {
        heading: '1. Mandatory Active Shipment Tracking Consent',
        content: 'The Partner explicitly consents to the continuous acquisition and transmission of precise geolocation coordinates (latitude, longitude, speed, heading, and bearing) from the partner mobile application or installed AIS-140 vehicle telematics unit during all stages of an active shipment.'
      },
      {
        heading: '2. Tracking Activation & Deactivation Milestones',
        content: 'Real-time location sharing initiates automatically when a driver sets status to "En Route to Pickup" or "Loading Yard", and concludes strictly when the consignee verifies the 4-digit delivery OTP and the trip is marked Completed. Location tracking is paused when the driver is offline.'
      },
      {
        heading: '3. Safety Monitoring & Geofenced Milestones',
        content: 'Telematics data is analyzed to provide consignors with accurate estimated time of arrival (ETA), confirm toll and corridor passage along national highways (e.g. NH-27/NH-37), and detect emergency deviations or vehicle breakdowns.'
      },
      {
        heading: '4. Device Battery, Permissions & Signal Integrity',
        content: 'The Driver agrees to keep smartphone location services enabled with "Always Allow" or "While Using App" permissions, maintain adequate phone battery charge, and not use mock location or GPS spoofing applications. Deliberate disabling of GPS during active transit is a contractual breach.'
      }
    ]
  },

  load_booking_transport_terms: {
    id: 'load_booking_transport_terms',
    title: 'Load Booking, Consignment Carriage & Transport Terms',
    hindiTitle: 'लोड बुकिंग, माल ढुलाई एवं परिवहन नियम व शर्तें',
    version: CURRENT_AGREEMENT_VERSION,
    effectiveDate: 'January 1, 2026',
    category: 'operational',
    applicableRoles: ['individual_owner', 'driver', 'fleet_partner'],
    summary: 'Comprehensive operational guidelines covering e-Way bills, cargo loading protocols, detention charges, cancellation penalties, and damage dispute procedures.',
    sections: [
      {
        heading: '1. Contract Formation upon Booking Confirmation',
        content: 'When a shipper accepts a partner quotation or when a partner accepts a fixed-rate load, a legally binding contract for carriage is formed governed by the Carriage by Road Act, 2007. The agreed rate is inclusive of all fuel, driver batta, and standard highway tolls unless explicitly noted otherwise.'
      },
      {
        heading: '2. e-Way Bill & Statutory Transport Documentation',
        content: 'No consignment shall be loaded or transported without a valid GST e-Way Bill generated by the consignor where the consignment value exceeds ₹50,000 (or state-specified threshold). The Driver must carry a physical or digital copy of Part B with updated vehicle registration.'
      },
      {
        heading: '3. Prohibited & Hazardous Goods',
        content: 'Partners shall not carry contraband, illegal narcotics, unregistered explosives, weapons, wildlife trophies, or hazardous chemicals without specialized class-endorsed permits and statutory approvals. Zuggi will immediately cooperate with law enforcement in case of violations.'
      },
      {
        heading: '4. Detention, Waiting Charges & Demurrage',
        content: 'Standard free loading and unloading time is 3 hours at each end. In cases of shipper or consignee delay exceeding free time, detention charges shall accrue at ₹250 per hour (for Small Commercial Vehicles) up to ₹600 per hour (for heavy multi-axle trailers), subject to GPS timestamp verification.'
      },
      {
        heading: '5. Cancellation & No-Show Penalties',
        content: 'Cancellation by a partner after load confirmation causes commercial disruption. Partner cancellations within 2 hours of scheduled pickup without a verified mechanical breakdown incur a ₹500 penalty deducted from future settlements.'
      },
      {
        heading: '6. Damage, Shortage & POD Claims',
        content: 'All cargo shortages or physical damage must be noted directly on the physical Lorry Receipt (LR) before consignee signature. Claims filed after unreserved delivery OTP confirmation cannot be entertained against the driver or platform.'
      }
    ]
  }
};
