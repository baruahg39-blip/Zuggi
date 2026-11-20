import { PartnerApplication } from '../types';

export const SEED_PARTNER_APPLICATIONS: PartnerApplication[] = [
  {
    id: 'app_part_01',
    userId: 'user_driver_01',
    partnerType: 'individual_owner',
    status: 'APPROVED',
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-01-12T15:30:00.000Z',
    fullName: 'Bikash Kalita',
    phone: '9864012345',
    email: 'bikash.kalita@transport.in',
    address: 'Near NH-37 Commercial Bypass, Moranhat',
    city: 'Dibrugarh',
    state: 'Assam',
    pincode: '786692',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    emergencyContact: {
      name: 'Rupjyoti Kalita',
      phone: '9864098765',
      relationship: 'Brother'
    },
    pan: 'BNAPK9281M',
    aadhaarNumber: '4912 3819 0182',
    bankDetails: {
      accountHolderName: 'Bikash Kalita',
      accountNumber: '50100291829102',
      ifscCode: 'HDFC0000128',
      bankName: 'HDFC Bank, Dibrugarh Commercial Branch',
      upiId: 'bikash.kalita@okaxis',
      isVerified: true
    },
    registeredVehicles: [
      {
        id: 'veh_seed_01',
        registrationNumber: 'AS-03-CC-8822',
        category: 'eicher_14ft',
        modelName: 'Eicher Pro 2049 (14ft)',
        capacityKg: 4500,
        permitType: 'all_northeast',
        insuranceExpiry: '2026-12-15',
        fitnessExpiry: '2026-10-20',
        pucExpiry: '2026-08-10',
        rcDocNumber: 'RC-AS03-2022-8822'
      }
    ],
    documents: [
      {
        id: 'doc_rc_01',
        name: 'Vehicle RC Smart Card',
        category: 'rc',
        documentNumber: 'AS03CC8822',
        expiryDate: '2037-04-18',
        fileUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80',
        status: 'verified',
        uploadedAt: '2026-01-10T10:15:00.000Z',
        verifiedAt: '2026-01-12T15:20:00.000Z'
      },
      {
        id: 'doc_dl_01',
        name: 'Commercial Heavy Transport Driving License',
        category: 'dl',
        documentNumber: 'AS-03-20150029182',
        expiryDate: '2029-06-30',
        vehicleClass: 'LMV-TR, TRANS, HGV',
        fileUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
        status: 'verified',
        uploadedAt: '2026-01-10T10:18:00.000Z',
        verifiedAt: '2026-01-12T15:21:00.000Z'
      },
      {
        id: 'doc_ins_01',
        name: 'Commercial Goods Carriage Comprehensive Insurance',
        category: 'insurance',
        documentNumber: 'POL-CH-918204192',
        expiryDate: '2026-12-15',
        fileUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80',
        status: 'verified',
        uploadedAt: '2026-01-10T10:20:00.000Z',
        verifiedAt: '2026-01-12T15:22:00.000Z'
      },
      {
        id: 'doc_fit_01',
        name: 'Form 38 Motor Vehicle Fitness Certificate',
        category: 'fitness',
        documentNumber: 'FIT-DIB-2025-00192',
        expiryDate: '2026-10-20',
        fileUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
        status: 'verified',
        uploadedAt: '2026-01-10T10:22:00.000Z',
        verifiedAt: '2026-01-12T15:23:00.000Z'
      },
      {
        id: 'doc_puc_01',
        name: 'Pollution Under Control (PUC) Certificate',
        category: 'puc',
        documentNumber: 'PUC-AS03-91820',
        expiryDate: '2026-08-10',
        fileUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=800&q=80',
        status: 'verified',
        uploadedAt: '2026-01-10T10:24:00.000Z',
        verifiedAt: '2026-01-12T15:24:00.000Z'
      }
    ],
    acceptance: {
      userId: 'user_driver_01',
      partnerType: 'individual_owner',
      legalFullName: 'Bikash Kalita',
      agreedToMainTerms: true,
      agreedToPrivacy: true,
      agreedToGpsTracking: true,
      timestamp: '2026-01-10T10:30:00.000Z',
      agreements: [
        { type: 'vehicle_owner_agreement', version: 'v2.4-2026', title: 'Vehicle Owner Commercial Transport Agreement' },
        { type: 'driver_terms_conditions', version: 'v2.4-2026', title: 'Commercial Driver Code of Conduct & Operational Terms' },
        { type: 'privacy_policy', version: 'v2.4-2026', title: 'Partner Data Privacy & KYC Policy' },
        { type: 'gps_tracking_consent', version: 'v2.4-2026', title: 'Continuous Highway Telematics & GPS Tracking Consent' },
        { type: 'load_booking_transport_terms', version: 'v2.4-2026', title: 'Load Booking & Carriage Terms' }
      ]
    },
    reviewLogs: [
      {
        id: 'rev_log_01',
        adminId: 'admin_sys_01',
        adminName: 'Zuggi Compliance Desk (Devraj Das)',
        action: 'APPROVED',
        timestamp: '2026-01-12T15:30:00.000Z',
        notes: 'Parivahan Vahan verification matched RC AS03CC8822 and valid HGV commercial license. Cashfree penny drop verified.'
      }
    ]
  },

  {
    id: 'app_part_02',
    userId: 'user_applicant_02',
    partnerType: 'fleet_partner',
    status: 'UNDER_REVIEW',
    createdAt: '2026-01-18T14:20:00.000Z',
    updatedAt: '2026-01-19T09:10:00.000Z',
    fullName: 'Pranjal Baruah',
    phone: '9435019283',
    email: 'operations@brahmaputrafleet.com',
    address: 'Brahmaputra Freight Terminal, Plot 44, Amingaon Inland Container Depot',
    city: 'Guwahati',
    state: 'Assam',
    pincode: '781031',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    pan: 'AABCB9182F',
    gstin: '18AABCB9182F1Z8',
    companyDetails: {
      companyName: 'Brahmaputra Express Logistics Pvt Ltd',
      authorizedRepName: 'Pranjal Baruah',
      authorizedRepDesignation: 'Director of Operations',
      authorizedRepPhone: '9435019283',
      businessAddress: 'Plot 44, Amingaon Industrial Area, North Guwahati, Assam 781031',
      pan: 'AABCB9182F',
      gstin: '18AABCB9182F1Z8'
    },
    bankDetails: {
      accountHolderName: 'Brahmaputra Express Logistics Pvt Ltd',
      accountNumber: '921020038192019',
      ifscCode: 'UTIB0000045',
      bankName: 'Axis Bank, GS Road Corporate Branch',
      upiId: 'brahmaputra.logistics@axisbank',
      isVerified: true
    },
    registeredVehicles: [
      {
        id: 'veh_fleet_01',
        registrationNumber: 'AS-01-EC-4921',
        category: 'truck_20ft',
        modelName: 'Tata Ultra T.19 (20ft High-Deck)',
        capacityKg: 10500,
        permitType: 'national',
        insuranceExpiry: '2027-01-10',
        fitnessExpiry: '2026-11-30',
        pucExpiry: '2026-09-15',
        rcDocNumber: 'RC-AS01-2023-4921'
      },
      {
        id: 'veh_fleet_02',
        registrationNumber: 'AS-01-FC-7102',
        category: 'container_32ft',
        modelName: 'Ashok Leyland 4220 Multi-Axle (32ft MXL)',
        capacityKg: 18000,
        permitType: 'national',
        insuranceExpiry: '2026-11-20',
        fitnessExpiry: '2026-08-30',
        pucExpiry: '2026-07-15',
        rcDocNumber: 'RC-AS01-2023-7102'
      }
    ],
    registeredDrivers: [
      {
        id: 'drv_fl_01',
        fullName: 'Manash Gogoi',
        phone: '9854019281',
        dlNumber: 'AS-01-20160019281',
        dlExpiryDate: '2028-11-14',
        vehicleClass: 'HGV, TRANS',
        emergencyPhone: '9854099881'
      },
      {
        id: 'drv_fl_02',
        fullName: 'Dhiraj Saikia',
        phone: '9706019284',
        dlNumber: 'AS-04-20180028190',
        dlExpiryDate: '2030-03-22',
        vehicleClass: 'HGV, TRANS, HAZMAT',
        emergencyPhone: '9706099112'
      }
    ],
    documents: [
      {
        id: 'doc_fleet_gst_01',
        name: 'Certificate of Incorporation & GSTIN Registration',
        category: 'gst',
        documentNumber: '18AABCB9182F1Z8',
        fileUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80',
        status: 'pending',
        uploadedAt: '2026-01-18T14:30:00.000Z'
      },
      {
        id: 'doc_fleet_auth_01',
        name: 'Board Resolution & Power of Attorney for Authorized Rep',
        category: 'fleet_auth',
        documentNumber: 'BR-BELPL-2025-01',
        fileUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80',
        status: 'pending',
        uploadedAt: '2026-01-18T14:32:00.000Z'
      },
      {
        id: 'doc_fleet_rc_01',
        name: 'Commercial RC - Tata Ultra T.19 (AS-01-EC-4921)',
        category: 'rc',
        documentNumber: 'AS01EC4921',
        expiryDate: '2038-02-10',
        fileUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
        status: 'pending',
        uploadedAt: '2026-01-18T14:35:00.000Z'
      }
    ],
    acceptance: {
      userId: 'user_applicant_02',
      partnerType: 'fleet_partner',
      legalFullName: 'Pranjal Baruah',
      agreedToMainTerms: true,
      agreedToPrivacy: true,
      agreedToGpsTracking: true,
      timestamp: '2026-01-18T14:40:00.000Z',
      agreements: [
        { type: 'fleet_partner_agreement', version: 'v2.4-2026', title: 'Fleet Partner & Transporter Master Logistics Agreement' },
        { type: 'privacy_policy', version: 'v2.4-2026', title: 'Partner Data Privacy & KYC Policy' },
        { type: 'gps_tracking_consent', version: 'v2.4-2026', title: 'Continuous Highway Telematics & GPS Tracking Consent' },
        { type: 'load_booking_transport_terms', version: 'v2.4-2026', title: 'Load Booking & Carriage Terms' }
      ]
    },
    reviewLogs: []
  },

  {
    id: 'app_part_03',
    userId: 'user_applicant_03',
    partnerType: 'driver',
    status: 'DOCUMENTS_REQUIRED',
    createdAt: '2026-01-20T11:00:00.000Z',
    updatedAt: '2026-01-21T16:00:00.000Z',
    fullName: 'Debajit Deka',
    phone: '9864201928',
    email: 'debajit.driver@gmail.com',
    address: 'Near Lokhra Toll Gate, ISBT Road',
    city: 'Guwahati',
    state: 'Assam',
    pincode: '781040',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80',
    emergencyContact: {
      name: 'Anjali Deka',
      phone: '9864209999',
      relationship: 'Spouse'
    },
    pan: 'CVPPD9182N',
    aadhaarNumber: '8912 4019 9281',
    bankDetails: {
      accountHolderName: 'Debajit Deka',
      accountNumber: '201928102910',
      ifscCode: 'SBIN0000088',
      bankName: 'State Bank of India, Panbazar',
      upiId: 'debajit9864@oksbi',
      isVerified: true
    },
    registeredVehicles: [],
    documents: [
      {
        id: 'doc_drv_dl_03',
        name: 'Commercial Driving License',
        category: 'dl',
        documentNumber: 'AS-01-2018001298',
        expiryDate: '2025-12-01', // Expired!
        vehicleClass: 'LMV-TR, HGV',
        fileUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
        status: 'rejected',
        rejectionReason: 'DL validity expired on Dec 1, 2025. Please upload renewed DL endorsement or Parivahan Sarathi renewal receipt.',
        uploadedAt: '2026-01-20T11:10:00.000Z'
      },
      {
        id: 'doc_drv_pan_03',
        name: 'PAN Card',
        category: 'pan',
        documentNumber: 'CVPPD9182N',
        fileUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80',
        status: 'verified',
        uploadedAt: '2026-01-20T11:12:00.000Z',
        verifiedAt: '2026-01-21T15:50:00.000Z'
      }
    ],
    acceptance: {
      userId: 'user_applicant_03',
      partnerType: 'driver',
      legalFullName: 'Debajit Deka',
      agreedToMainTerms: true,
      agreedToPrivacy: true,
      agreedToGpsTracking: true,
      timestamp: '2026-01-20T11:20:00.000Z',
      agreements: [
        { type: 'driver_terms_conditions', version: 'v2.4-2026', title: 'Commercial Driver Code of Conduct & Operational Terms' },
        { type: 'privacy_policy', version: 'v2.4-2026', title: 'Partner Data Privacy & KYC Policy' },
        { type: 'gps_tracking_consent', version: 'v2.4-2026', title: 'Continuous Highway Telematics & GPS Tracking Consent' },
        { type: 'load_booking_transport_terms', version: 'v2.4-2026', title: 'Load Booking & Carriage Terms' }
      ]
    },
    reviewLogs: [
      {
        id: 'rev_log_03',
        adminId: 'admin_sys_01',
        adminName: 'Zuggi Compliance Desk (Devraj Das)',
        action: 'DOCUMENTS_REQUIRED',
        timestamp: '2026-01-21T16:00:00.000Z',
        notes: 'Commercial DL expired on Dec 1, 2025. Partner notified to provide RTO Form 9 or digital Parivahan Sarathi renewed license copy.',
        requestedDocuments: ['Commercial Driving License (Renewed)']
      }
    ],
    requestedChangesNotes: 'Your Commercial Driving License expired on Dec 1, 2025. Please upload the renewed license copy or the Sarathi renewal acknowledgment slip to proceed.'
  }
];
