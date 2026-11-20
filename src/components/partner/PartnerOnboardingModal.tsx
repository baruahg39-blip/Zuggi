import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Truck,
  UserCheck,
  Building2,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Lock,
  Plus,
  Trash2,
  Scale,
  RefreshCw,
  HelpCircle,
  Eye,
  AlertTriangle
} from 'lucide-react';
import {
  PartnerAccountStatus,
  PartnerAgreementType,
  PartnerApplication,
  PartnerType,
  PartnerUploadedDoc,
  User,
  VehicleCategoryType
} from '../../types';
import { logisticsStore } from '../../services/store';
import { CURRENT_AGREEMENT_VERSION, PARTNER_AGREEMENTS } from '../../data/agreementsData';
import { PartnerAgreementModal } from './PartnerAgreementModal';

interface PartnerOnboardingModalProps {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PartnerOnboardingModal: React.FC<PartnerOnboardingModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onSuccess
}) => {
  // Existing Application
  const [existingApp, setExistingApp] = useState<PartnerApplication | null>(null);

  // Wizard Step (1: Type & Profile, 2: Bank, 3: Fleet/Vehicles, 4: Documents, 5: Agreements & Submit)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form State
  const [partnerType, setPartnerType] = useState<PartnerType>('individual_owner');
  const [fullName, setFullName] = useState<string>(currentUser.name || '');
  const [phone, setPhone] = useState<string>(currentUser.phone || '');
  const [email, setEmail] = useState<string>(currentUser.email || '');
  const [address, setAddress] = useState<string>(currentUser.address || '');
  const [city, setCity] = useState<string>(currentUser.city || 'Dibrugarh');
  const [state, setState] = useState<string>(currentUser.state || 'Assam');
  const [pincode, setPincode] = useState<string>('786001');

  // Emergency contact
  const [emergencyName, setEmergencyName] = useState<string>('');
  const [emergencyPhone, setEmergencyPhone] = useState<string>('');
  const [emergencyRelation, setEmergencyRelation] = useState<string>('Brother');

  // Statutory
  const [panNumber, setPanNumber] = useState<string>(currentUser.pan || '');
  const [aadhaarNumber, setAadhaarNumber] = useState<string>('');
  const [gstin, setGstin] = useState<string>(currentUser.gstin || '');

  // Fleet Specific
  const [companyName, setCompanyName] = useState<string>(currentUser.businessName || '');
  const [repName, setRepName] = useState<string>(currentUser.name || '');
  const [repDesignation, setRepDesignation] = useState<string>('Managing Director');
  const [repPhone, setRepPhone] = useState<string>(currentUser.phone || '');

  // Bank & Settlement
  const [accountHolder, setAccountHolder] = useState<string>(currentUser.name || '');
  const [accountNumber, setAccountNumber] = useState<string>('50100291829102');
  const [ifscCode, setIfscCode] = useState<string>('HDFC0000128');
  const [bankName, setBankName] = useState<string>('HDFC Bank');
  const [upiId, setUpiId] = useState<string>(`${currentUser.phone?.slice(-10) || '9864012345'}@okaxis`);

  // Vehicles list
  const [registeredVehicles, setRegisteredVehicles] = useState<Array<{
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
  }>>([
    {
      id: 'v_init_1',
      registrationNumber: 'AS-03-CC-8822',
      category: 'eicher_14ft',
      modelName: 'Eicher Pro 2049 (14ft)',
      capacityKg: 4500,
      permitType: 'all_northeast',
      insuranceExpiry: '2026-12-31',
      fitnessExpiry: '2026-10-31',
      pucExpiry: '2026-08-31'
    }
  ]);

  // Drivers list (for fleet partner)
  const [registeredDrivers, setRegisteredDrivers] = useState<Array<{
    id: string;
    fullName: string;
    phone: string;
    dlNumber: string;
    dlExpiryDate: string;
    vehicleClass: string;
    emergencyPhone?: string;
  }>>([
    {
      id: 'd_init_1',
      fullName: 'Manash Gogoi',
      phone: '9854019281',
      dlNumber: 'AS-01-20160019281',
      dlExpiryDate: '2028-11-14',
      vehicleClass: 'HGV, TRANS',
      emergencyPhone: '9854099881'
    }
  ]);

  // Documents
  const [documents, setDocuments] = useState<PartnerUploadedDoc[]>([]);

  // Digital Acceptance (Must NOT be pre-checked)
  const [agreedToMainTerms, setAgreedToMainTerms] = useState<boolean>(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState<boolean>(false);
  const [agreedToGpsTracking, setAgreedToGpsTracking] = useState<boolean>(false);
  const [electronicSignatureName, setElectronicSignatureName] = useState<string>('');

  // Agreement Viewer Modal
  const [activeViewingAgreement, setActiveViewingAgreement] = useState<PartnerAgreementType | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null);

  useEffect(() => {
    const existing = logisticsStore.getPartnerApplicationByUserId(currentUser.id);
    if (existing) {
      setExistingApp(existing);
      setPartnerType(existing.partnerType);
      setFullName(existing.fullName);
      setPhone(existing.phone);
      setEmail(existing.email || '');
      setAddress(existing.address);
      setCity(existing.city);
      setState(existing.state);
      setPincode(existing.pincode);
      if (existing.pan) setPanNumber(existing.pan);
      if (existing.aadhaarNumber) setAadhaarNumber(existing.aadhaarNumber);
      if (existing.gstin) setGstin(existing.gstin);
      if (existing.bankDetails) {
        setAccountHolder(existing.bankDetails.accountHolderName);
        setAccountNumber(existing.bankDetails.accountNumber);
        setIfscCode(existing.bankDetails.ifscCode);
        setBankName(existing.bankDetails.bankName);
        if (existing.bankDetails.upiId) setUpiId(existing.bankDetails.upiId);
      }
      if (existing.registeredVehicles && existing.registeredVehicles.length > 0) {
        setRegisteredVehicles(existing.registeredVehicles);
      }
      if (existing.registeredDrivers && existing.registeredDrivers.length > 0) {
        setRegisteredDrivers(existing.registeredDrivers);
      }
      if (existing.documents && existing.documents.length > 0) {
        setDocuments(existing.documents);
      }
      if (existing.acceptance) {
        setAgreedToMainTerms(existing.acceptance.agreedToMainTerms);
        setAgreedToPrivacy(existing.acceptance.agreedToPrivacy);
        setAgreedToGpsTracking(existing.acceptance.agreedToGpsTracking);
        setElectronicSignatureName(existing.acceptance.legalFullName);
      }
    } else {
      // Initialize default required documents based on partnerType
      initDefaultDocuments(partnerType);
    }
  }, [currentUser.id, partnerType]);

  const initDefaultDocuments = (type: PartnerType) => {
    const baseDocs: PartnerUploadedDoc[] = [
      {
        id: 'doc_pan',
        name: 'PAN Card (Income Tax Dept)',
        category: 'pan',
        documentNumber: panNumber || 'BNAPK9281M',
        fileUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
        status: 'pending',
        uploadedAt: new Date().toISOString()
      },
      {
        id: 'doc_aadhaar',
        name: 'Aadhaar Card (UIDAI)',
        category: 'aadhaar',
        documentNumber: aadhaarNumber || '4912 3819 0182',
        fileUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80',
        status: 'pending',
        uploadedAt: new Date().toISOString()
      },
      {
        id: 'doc_bank',
        name: 'Bank Passbook / Cancelled Cheque (Cashfree Penny Drop)',
        category: 'bank_proof',
        documentNumber: ifscCode || 'HDFC0000128',
        fileUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80',
        status: 'pending',
        uploadedAt: new Date().toISOString()
      }
    ];

    if (type === 'individual_owner') {
      baseDocs.push(
        {
          id: 'doc_rc',
          name: 'Vehicle Registration Certificate (RC)',
          category: 'rc',
          documentNumber: 'AS-03-CC-8822',
          expiryDate: '2037-04-18',
          fileUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
          status: 'pending',
          uploadedAt: new Date().toISOString()
        },
        {
          id: 'doc_permit',
          name: 'State / All India Commercial Goods Permit',
          category: 'permit',
          documentNumber: 'PRM-AS-2023-8822',
          expiryDate: '2028-05-15',
          fileUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80',
          status: 'pending',
          uploadedAt: new Date().toISOString()
        },
        {
          id: 'doc_insurance',
          name: 'Commercial Vehicle Insurance Policy',
          category: 'insurance',
          documentNumber: 'POL-CH-918204192',
          expiryDate: '2026-12-15',
          fileUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80',
          status: 'pending',
          uploadedAt: new Date().toISOString()
        },
        {
          id: 'doc_fitness',
          name: 'Certificate of Fitness (Form 38)',
          category: 'fitness',
          documentNumber: 'FIT-DIB-2025-00192',
          expiryDate: '2026-10-20',
          fileUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=600&q=80',
          status: 'pending',
          uploadedAt: new Date().toISOString()
        },
        {
          id: 'doc_puc',
          name: 'Pollution Under Control (PUC) Certificate',
          category: 'puc',
          documentNumber: 'PUC-AS03-91820',
          expiryDate: '2026-08-10',
          fileUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=600&q=80',
          status: 'pending',
          uploadedAt: new Date().toISOString()
        }
      );
    } else if (type === 'driver') {
      baseDocs.push(
        {
          id: 'doc_dl',
          name: 'Commercial / Transport Driving License',
          category: 'dl',
          documentNumber: 'AS-03-20150029182',
          expiryDate: '2029-06-30',
          vehicleClass: 'LMV-TR, HGV, TRANS',
          fileUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
          status: 'pending',
          uploadedAt: new Date().toISOString()
        },
        {
          id: 'doc_photo',
          name: 'Driver Passport Photograph',
          category: 'profile_photo',
          documentNumber: 'PHOTO-01',
          fileUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
          status: 'pending',
          uploadedAt: new Date().toISOString()
        }
      );
    } else if (type === 'fleet_partner') {
      baseDocs.push(
        {
          id: 'doc_gst',
          name: 'GST Registration Certificate',
          category: 'gst',
          documentNumber: gstin || '18AABCB9182F1Z8',
          fileUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
          status: 'pending',
          uploadedAt: new Date().toISOString()
        },
        {
          id: 'doc_fleet_auth',
          name: 'Company Incorporation / Board Resolution Authorization',
          category: 'fleet_auth',
          documentNumber: 'BR-2025-01',
          fileUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80',
          status: 'pending',
          uploadedAt: new Date().toISOString()
        }
      );
    }

    setDocuments(baseDocs);
  };

  const handlePartnerTypeChange = (newType: PartnerType) => {
    setPartnerType(newType);
    initDefaultDocuments(newType);
  };

  const handleAddVehicle = () => {
    setRegisteredVehicles([
      ...registeredVehicles,
      {
        id: `v_add_${Date.now()}`,
        registrationNumber: 'AS-01-FC-9912',
        category: 'truck_20ft',
        modelName: 'Tata Ultra 20ft',
        capacityKg: 10000,
        permitType: 'national',
        insuranceExpiry: '2027-01-15',
        fitnessExpiry: '2026-11-20',
        pucExpiry: '2026-09-10'
      }
    ]);
  };

  const handleRemoveVehicle = (id: string) => {
    if (registeredVehicles.length > 1) {
      setRegisteredVehicles(registeredVehicles.filter((v) => v.id !== id));
    }
  };

  const handleAddDriver = () => {
    setRegisteredDrivers([
      ...registeredDrivers,
      {
        id: `d_add_${Date.now()}`,
        fullName: 'New Commercial Driver',
        phone: '9864000111',
        dlNumber: 'AS-01-2020001928',
        dlExpiryDate: '2030-01-01',
        vehicleClass: 'HGV, TRANS'
      }
    ]);
  };

  const handleRemoveDriver = (id: string) => {
    if (registeredDrivers.length > 1) {
      setRegisteredDrivers(registeredDrivers.filter((d) => d.id !== id));
    }
  };

  const handleSubmitOnboarding = (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreedToMainTerms || !agreedToPrivacy || !agreedToGpsTracking) {
      setSubmissionFeedback('Please review and check all three mandatory legal agreement consents to proceed.');
      return;
    }

    if (!electronicSignatureName.trim() || electronicSignatureName.trim().length < 3) {
      setSubmissionFeedback('Please enter your full legal name as your electronic signature acknowledgement.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionFeedback(null);

    try {
      const agreementsList: Array<{ type: PartnerAgreementType; version: string; title: string }> = [
        {
          type: partnerType === 'fleet_partner' ? 'fleet_partner_agreement' :
                partnerType === 'driver' ? 'driver_terms_conditions' : 'vehicle_owner_agreement',
          version: CURRENT_AGREEMENT_VERSION,
          title: PARTNER_AGREEMENTS[partnerType === 'fleet_partner' ? 'fleet_partner_agreement' : partnerType === 'driver' ? 'driver_terms_conditions' : 'vehicle_owner_agreement'].title
        },
        {
          type: 'privacy_policy',
          version: CURRENT_AGREEMENT_VERSION,
          title: PARTNER_AGREEMENTS.privacy_policy.title
        },
        {
          type: 'gps_tracking_consent',
          version: CURRENT_AGREEMENT_VERSION,
          title: PARTNER_AGREEMENTS.gps_tracking_consent.title
        },
        {
          type: 'load_booking_transport_terms',
          version: CURRENT_AGREEMENT_VERSION,
          title: PARTNER_AGREEMENTS.load_booking_transport_terms.title
        }
      ];

      const submitted = logisticsStore.submitPartnerApplication({
        userId: currentUser.id,
        partnerType,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        profilePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
        emergencyContact: partnerType !== 'fleet_partner' ? {
          name: emergencyName || 'Family Member',
          phone: emergencyPhone || phone,
          relationship: emergencyRelation
        } : undefined,
        pan: panNumber.trim().toUpperCase(),
        aadhaarNumber: aadhaarNumber.trim(),
        gstin: gstin.trim().toUpperCase(),
        companyDetails: partnerType === 'fleet_partner' ? {
          companyName: companyName.trim(),
          authorizedRepName: repName.trim(),
          authorizedRepDesignation: repDesignation.trim(),
          authorizedRepPhone: repPhone.trim(),
          businessAddress: `${address}, ${city}, ${state} - ${pincode}`,
          pan: panNumber.trim().toUpperCase(),
          gstin: gstin.trim().toUpperCase()
        } : undefined,
        bankDetails: {
          accountHolderName: accountHolder.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase(),
          bankName: bankName.trim(),
          upiId: upiId.trim(),
          isVerified: true
        },
        registeredVehicles: partnerType !== 'driver' ? registeredVehicles : [],
        registeredDrivers: partnerType === 'fleet_partner' ? registeredDrivers : undefined,
        documents,
        acceptance: {
          userId: currentUser.id,
          partnerType,
          legalFullName: electronicSignatureName.trim(),
          agreedToMainTerms,
          agreedToPrivacy,
          agreedToGpsTracking,
          timestamp: new Date().toISOString(),
          agreements: agreementsList
        }
      });

      setExistingApp(submitted);
      setIsSubmitting(false);
      setSubmissionFeedback('Partner application submitted successfully! Your documents are now in the compliance verification queue.');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setIsSubmitting(false);
      setSubmissionFeedback(err?.message || 'Failed to submit application. Please check all fields.');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
        <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Vehicle Partner Onboarding & KYC Desk
                  </h3>
                  {existingApp && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      existingApp.status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : existingApp.status === 'DOCUMENTS_REQUIRED'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : existingApp.status === 'REJECTED' || existingApp.status === 'SUSPENDED'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}>
                      {existingApp.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Parivahan RC, Sarathi Commercial DL, Cashfree Penny Drop & Legal Agreement Sign-off
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Existing Status Banner if under review or documents required */}
          {existingApp && existingApp.status !== 'APPROVED' && (
            <div className={`p-4 border-b text-xs flex items-start gap-3 ${
              existingApp.status === 'DOCUMENTS_REQUIRED'
                ? 'bg-amber-950/40 border-amber-800/80 text-amber-300'
                : existingApp.status === 'REJECTED'
                ? 'bg-rose-950/40 border-rose-800/80 text-rose-300'
                : 'bg-blue-950/40 border-blue-800/80 text-blue-300'
            }`}>
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">
                  Application Status: {existingApp.status.replace('_', ' ')}
                </span>
                <p className="text-[11px] leading-relaxed">
                  {existingApp.status === 'DOCUMENTS_REQUIRED'
                    ? existingApp.requestedChangesNotes || 'The compliance desk requested updated or clearer copies of your documents. Review step 4 below and re-submit.'
                    : existingApp.status === 'SUBMITTED' || existingApp.status === 'UNDER_REVIEW'
                    ? 'Your application and uploaded commercial documents are currently being checked against RTO Parivahan records. Bidding will unlock immediately upon approval.'
                    : existingApp.status === 'REJECTED'
                    ? `Application rejected: ${existingApp.rejectionReason || 'Documents did not meet statutory compliance requirements.'}`
                    : 'Your partner account is pending administrative verification.'}
                </p>
              </div>
            </div>
          )}

          {/* Stepper Tabs */}
          <div className="flex items-center overflow-x-auto bg-slate-950/60 border-b border-slate-800 px-4 py-2 gap-2 text-xs font-semibold">
            {[
              { num: 1, title: 'Partner Profile' },
              { num: 2, title: 'Bank & Payouts' },
              { num: 3, title: partnerType === 'fleet_partner' ? 'Fleet & Drivers' : partnerType === 'driver' ? 'Driver Profile' : 'Vehicle Reg' },
              { num: 4, title: 'KYC Vault' },
              { num: 5, title: 'Agreements & Submit' }
            ].map((step) => (
              <button
                key={step.num}
                onClick={() => setCurrentStep(step.num)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
                  currentStep === step.num
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  currentStep === step.num ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'
                }`}>
                  {step.num}
                </span>
                <span>{step.title}</span>
              </button>
            ))}
          </div>

          {/* Modal Content Scroll Area */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 text-slate-200">
            {/* STEP 1: PARTNER TYPE & PERSONAL / BUSINESS PROFILE */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">
                    Select Partner Registration Category:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        type: 'individual_owner',
                        title: 'Individual Vehicle Owner',
                        desc: 'Own 1-2 trucks or pickups. Drives personally or hires local driver.',
                        icon: Truck
                      },
                      {
                        type: 'driver',
                        title: 'Commercial Driver',
                        desc: 'Holds commercial DL. Seeks driving assignments with fleet trucks.',
                        icon: UserCheck
                      },
                      {
                        type: 'fleet_partner',
                        title: 'Fleet Partner / Transporter',
                        desc: 'Corporate transport firm with multiple vehicles & employed drivers.',
                        icon: Building2
                      }
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const isSel = partnerType === opt.type;
                      return (
                        <div
                          key={opt.type}
                          onClick={() => handlePartnerTypeChange(opt.type as PartnerType)}
                          className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                            isSel
                              ? 'bg-amber-500/10 border-amber-500 shadow-lg'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className={`p-2 rounded-xl ${isSel ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-amber-400'}`}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <input
                                type="radio"
                                checked={isSel}
                                onChange={() => handlePartnerTypeChange(opt.type as PartnerType)}
                                className="accent-amber-500 cursor-pointer"
                              />
                            </div>
                            <span className="font-bold text-white text-sm block">{opt.title}</span>
                            <p className="text-xs text-slate-400 leading-relaxed">{opt.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Corporate Details if Fleet Partner */}
                {partnerType === 'fleet_partner' && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                      Enterprise Transport Company Information
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-slate-400 block mb-1">Company / Fleet Legal Name *</label>
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="e.g. Brahmaputra Logistics Pvt Ltd"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Company PAN *</label>
                        <input
                          type="text"
                          value={panNumber}
                          onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                          placeholder="e.g. AABCB9182F"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">GSTIN Number (Where Applicable)</label>
                        <input
                          type="text"
                          value={gstin}
                          onChange={(e) => setGstin(e.target.value.toUpperCase())}
                          placeholder="e.g. 18AABCB9182F1Z8"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Authorised Signatory Name *</label>
                        <input
                          type="text"
                          value={repName}
                          onChange={(e) => setRepName(e.target.value)}
                          placeholder="e.g. Pranjal Baruah"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Personal Profile Details */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    {partnerType === 'fleet_partner' ? 'Authorised Representative Profile' : 'Partner Profile Details'}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Full Name (As on Gov ID) *</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Full Legal Name"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Mobile Phone (Carrier SMS OTP) *</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="10-digit mobile"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@transport.in"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-1">
                    <div className="sm:col-span-2">
                      <label className="text-slate-400 block mb-1">Physical / Business Address *</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Street, Landmark, Ward"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">City *</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">PIN Code *</label>
                      <input
                        type="text"
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        placeholder="786001"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {partnerType !== 'fleet_partner' && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="text-[11px] font-bold text-slate-400 block mb-2">Emergency Contact Information:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="text-slate-500 block mb-1">Contact Name *</label>
                          <input
                            type="text"
                            value={emergencyName}
                            onChange={(e) => setEmergencyName(e.target.value)}
                            placeholder="Relative name"
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-slate-500 block mb-1">Contact Phone *</label>
                          <input
                            type="tel"
                            value={emergencyPhone}
                            onChange={(e) => setEmergencyPhone(e.target.value)}
                            placeholder="Emergency phone"
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-slate-500 block mb-1">Relationship</label>
                          <select
                            value={emergencyRelation}
                            onChange={(e) => setEmergencyRelation(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                          >
                            <option value="Brother">Brother</option>
                            <option value="Father">Father</option>
                            <option value="Spouse">Spouse</option>
                            <option value="Friend / Co-Driver">Friend / Co-Driver</option>
                            <option value="Manager">Manager</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: BANK & CASFREE PENNY-DROP SETTLEMENTS */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-800/50 flex items-start gap-3 text-xs text-indigo-300">
                  <Building2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">Cashfree Easy Split Marketplace Payouts:</span>
                    <p className="text-[11px] text-indigo-200 mt-0.5 leading-relaxed">
                      All net freight earnings (90% at pickup, 10% post-delivery clearance) are credited directly to this verified beneficiary account. Section 194C TDS certificate will be issued to this PAN.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Beneficiary Bank Account Details
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Account Holder Legal Name *</label>
                      <input
                        type="text"
                        value={accountHolder}
                        onChange={(e) => setAccountHolder(e.target.value)}
                        placeholder="Must match PAN / Passbook"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Bank Account Number *</label>
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="Account Number"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Bank IFSC Code *</label>
                      <input
                        type="text"
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                        placeholder="e.g. HDFC0000128"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Bank Name & Branch *</label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="Bank Name"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-slate-400 block mb-1">Instant Payout UPI Virtual Payment Address (VPA)</label>
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="e.g. phone@upi or transporter@okaxis"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-amber-400 font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: FLEET & VEHICLE SPECIFICATIONS */}
            {currentStep === 3 && (
              <div className="space-y-5">
                {partnerType !== 'driver' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Registered Commercial Vehicles ({registeredVehicles.length})
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          {partnerType === 'fleet_partner' ? 'Add all vehicles in your commercial fleet.' : 'Your primary commercial vehicle registration.'}
                        </p>
                      </div>
                      {partnerType === 'fleet_partner' && (
                        <button
                          type="button"
                          onClick={handleAddVehicle}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold border border-amber-500/30 transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Vehicle</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {registeredVehicles.map((veh, idx) => (
                        <div key={veh.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                            <span className="font-bold text-white flex items-center gap-2">
                              <Truck className="w-4 h-4 text-amber-400" />
                              <span>Vehicle #{idx + 1}: {veh.registrationNumber}</span>
                            </span>
                            {registeredVehicles.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveVehicle(veh.id)}
                                className="text-rose-400 hover:text-rose-300 p-1 rounded transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="text-slate-400 block mb-1">Registration Number *</label>
                              <input
                                type="text"
                                value={veh.registrationNumber}
                                onChange={(e) => {
                                  const updated = [...registeredVehicles];
                                  updated[idx].registrationNumber = e.target.value.toUpperCase();
                                  setRegisteredVehicles(updated);
                                }}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            <div>
                              <label className="text-slate-400 block mb-1">Model & Make *</label>
                              <input
                                type="text"
                                value={veh.modelName}
                                onChange={(e) => {
                                  const updated = [...registeredVehicles];
                                  updated[idx].modelName = e.target.value;
                                  setRegisteredVehicles(updated);
                                }}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            <div>
                              <label className="text-slate-400 block mb-1">Payload Capacity (Kg) *</label>
                              <input
                                type="number"
                                value={veh.capacityKg}
                                onChange={(e) => {
                                  const updated = [...registeredVehicles];
                                  updated[idx].capacityKg = Number(e.target.value);
                                  setRegisteredVehicles(updated);
                                }}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                            <div>
                              <label className="text-slate-400 block mb-1">Commercial Permit Type</label>
                              <select
                                value={veh.permitType}
                                onChange={(e) => {
                                  const updated = [...registeredVehicles];
                                  updated[idx].permitType = e.target.value as any;
                                  setRegisteredVehicles(updated);
                                }}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                              >
                                <option value="state">Intra-State (Assam Commercial)</option>
                                <option value="all_northeast">All North-East Corridor (7 Sisters)</option>
                                <option value="national">National Permit (All India Commercial)</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-slate-400 block mb-1">Fitness Expiry Date</label>
                              <input
                                type="date"
                                value={veh.fitnessExpiry || '2026-10-31'}
                                onChange={(e) => {
                                  const updated = [...registeredVehicles];
                                  updated[idx].fitnessExpiry = e.target.value;
                                  setRegisteredVehicles(updated);
                                }}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            <div>
                              <label className="text-slate-400 block mb-1">PUC Expiry Date</label>
                              <input
                                type="date"
                                value={veh.pucExpiry || '2026-08-31'}
                                onChange={(e) => {
                                  const updated = [...registeredVehicles];
                                  updated[idx].pucExpiry = e.target.value;
                                  setRegisteredVehicles(updated);
                                }}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Fleet Drivers if Fleet Partner */}
                    {partnerType === 'fleet_partner' && (
                      <div className="space-y-4 pt-4 border-t border-slate-800">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                              Employed Fleet Drivers ({registeredDrivers.length})
                            </h4>
                            <p className="text-[11px] text-slate-400">
                              Registered drivers authorized to operate trucks under this fleet account.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddDriver}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold border border-amber-500/30 transition cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Driver</span>
                          </button>
                        </div>

                        <div className="space-y-3">
                          {registeredDrivers.map((drv, idx) => (
                            <div key={drv.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                                <span className="font-bold text-white flex items-center gap-2">
                                  <UserCheck className="w-4 h-4 text-emerald-400" />
                                  <span>Driver #{idx + 1}: {drv.fullName}</span>
                                </span>
                                {registeredDrivers.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDriver(drv.id)}
                                    className="text-rose-400 hover:text-rose-300 p-1 rounded transition cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                  <label className="text-slate-400 block mb-1">Driver Full Name *</label>
                                  <input
                                    type="text"
                                    value={drv.fullName}
                                    onChange={(e) => {
                                      const updated = [...registeredDrivers];
                                      updated[idx].fullName = e.target.value;
                                      setRegisteredDrivers(updated);
                                    }}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-slate-400 block mb-1">Mobile Phone *</label>
                                  <input
                                    type="tel"
                                    value={drv.phone}
                                    onChange={(e) => {
                                      const updated = [...registeredDrivers];
                                      updated[idx].phone = e.target.value;
                                      setRegisteredDrivers(updated);
                                    }}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-slate-400 block mb-1">Commercial DL Number *</label>
                                  <input
                                    type="text"
                                    value={drv.dlNumber}
                                    onChange={(e) => {
                                      const updated = [...registeredDrivers];
                                      updated[idx].dlNumber = e.target.value.toUpperCase();
                                      setRegisteredDrivers(updated);
                                    }}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-amber-500"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Commercial Driver Profile */
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                      Commercial Driving License Endorsement
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-slate-400 block mb-1">Driving License Number *</label>
                        <input
                          type="text"
                          defaultValue="AS-03-20150029182"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Authorized Vehicle Classes *</label>
                        <input
                          type="text"
                          defaultValue="LMV-TR, HGV, TRANS"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">DL Expiry Date *</label>
                        <input
                          type="date"
                          defaultValue="2029-06-30"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: KYC & DOCUMENT VAULT */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3 text-xs">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">Parivahan & Statutory Document Verification:</span>
                    <p className="text-[11px] text-slate-400">
                      Uploaded certificates are verified by the Zuggi Compliance Desk against the National Register (Parivahan Vahan / Sarathi). Clear, unblurred photos or PDFs are required.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {documents.map((doc, idx) => (
                    <div
                      key={doc.id}
                      className={`p-4 rounded-2xl border space-y-3 text-xs transition ${
                        doc.status === 'rejected'
                          ? 'bg-rose-950/20 border-rose-800/80'
                          : doc.status === 'verified'
                          ? 'bg-slate-950/80 border-emerald-900/40'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-white block">{doc.name}</span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Doc Number: {doc.documentNumber || 'Required'}
                          </span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          doc.status === 'verified'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : doc.status === 'rejected'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {doc.status}
                        </span>
                      </div>

                      {doc.rejectionReason && (
                        <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-[11px] text-rose-300">
                          <strong>Admin Feedback:</strong> {doc.rejectionReason}
                        </div>
                      )}

                      {/* Document Details & Expiry */}
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <label className="text-slate-500 block mb-0.5">Certificate Number</label>
                          <input
                            type="text"
                            value={doc.documentNumber}
                            onChange={(e) => {
                              const updated = [...documents];
                              updated[idx].documentNumber = e.target.value.toUpperCase();
                              setDocuments(updated);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        {doc.expiryDate !== undefined && (
                          <div>
                            <label className="text-slate-500 block mb-0.5">Expiry Date</label>
                            <input
                              type="date"
                              value={doc.expiryDate}
                              onChange={(e) => {
                                const updated = [...documents];
                                updated[idx].expiryDate = e.target.value;
                                setDocuments(updated);
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        )}
                      </div>

                      {/* Mock File Upload Attachment */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Attached Document Active</span>
                        </span>
                        <label className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1">
                          <Upload className="w-3 h-3" />
                          <span>Re-upload</span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={() => {
                              const updated = [...documents];
                              updated[idx].status = 'pending';
                              updated[idx].rejectionReason = undefined;
                              setDocuments(updated);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 5: DIGITAL AGREEMENT ACCEPTANCE & LEGAL ACKNOWLEDGEMENT */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1.5 text-xs text-amber-200">
                  <div className="flex items-center gap-2 font-bold text-amber-400">
                    <Scale className="w-4 h-4" />
                    <span>Statutory Digital Consent & Electronic Signature (IT Act 2000)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    Pursuant to the Indian Carriage by Road Act 2007 and Information Technology Act 2000, you must open, review, and explicitly accept the relevant commercial transport agreement, privacy notice, and continuous GPS telematics consent before your partner registration can be submitted.
                  </p>
                </div>

                {/* Agreement Review Cards */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Mandatory Statutory Agreements (Click to Read Complete Legal Text)
                  </span>

                  {[
                    {
                      id: partnerType === 'fleet_partner' ? 'fleet_partner_agreement' :
                          partnerType === 'driver' ? 'driver_terms_conditions' : 'vehicle_owner_agreement',
                      doc: PARTNER_AGREEMENTS[
                        partnerType === 'fleet_partner' ? 'fleet_partner_agreement' :
                        partnerType === 'driver' ? 'driver_terms_conditions' : 'vehicle_owner_agreement'
                      ],
                      label: 'Primary Partner Agreement'
                    },
                    {
                      id: 'privacy_policy',
                      doc: PARTNER_AGREEMENTS.privacy_policy,
                      label: 'DPDP Act 2023 Privacy & Document Retention'
                    },
                    {
                      id: 'gps_tracking_consent',
                      doc: PARTNER_AGREEMENTS.gps_tracking_consent,
                      label: 'Continuous Highway Telematics & Tracking'
                    },
                    {
                      id: 'load_booking_transport_terms',
                      doc: PARTNER_AGREEMENTS.load_booking_transport_terms,
                      label: 'Carriage by Road & Demurrage Terms'
                    }
                  ].map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{item.doc.title}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                              {item.doc.version}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block">{item.label}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveViewingAgreement(item.id as PartnerAgreementType)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold border border-slate-700 transition cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Read Agreement</span>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Explicit Consent Checkboxes (NOT Pre-Checked!) */}
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 text-xs">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                    Individual Mandatory Declarations
                  </span>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={agreedToMainTerms}
                      onChange={(e) => setAgreedToMainTerms(e.target.checked)}
                      className="w-4 h-4 rounded mt-0.5 accent-amber-500 cursor-pointer"
                    />
                    <span className="text-slate-300 leading-relaxed group-hover:text-white transition">
                      I have opened, thoroughly read, and explicitly agree to be bound by the{' '}
                      <strong className="text-white">
                        {PARTNER_AGREEMENTS[
                          partnerType === 'fleet_partner' ? 'fleet_partner_agreement' :
                          partnerType === 'driver' ? 'driver_terms_conditions' : 'vehicle_owner_agreement'
                        ].title} ({CURRENT_AGREEMENT_VERSION})
                      </strong>{' '}
                      and the Commercial Carriage by Road Terms, including vehicle roadworthiness, 5% platform commission, and cargo shortage liability.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={agreedToPrivacy}
                      onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                      className="w-4 h-4 rounded mt-0.5 accent-amber-500 cursor-pointer"
                    />
                    <span className="text-slate-300 leading-relaxed group-hover:text-white transition">
                      I explicitly consent to the processing and verification of my personal identity, PAN, Aadhaar, Commercial DL, and Bank account details under the{' '}
                      <strong className="text-white">Partner Data Privacy Policy & DPDP Act, 2023</strong>.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={agreedToGpsTracking}
                      onChange={(e) => setAgreedToGpsTracking(e.target.checked)}
                      className="w-4 h-4 rounded mt-0.5 accent-amber-500 cursor-pointer"
                    />
                    <span className="text-slate-300 leading-relaxed group-hover:text-white transition">
                      I explicitly grant consent for continuous smartphone GPS telematics and vehicle location transmission during all active consignment transit milestones to consignors, consignees, and emergency highway support.
                    </span>
                  </label>

                  {/* Electronic Name Signature */}
                  <div className="pt-3 border-t border-slate-800/80 space-y-1.5">
                    <label className="text-slate-300 font-bold block text-xs">
                      Type Your Full Legal Name as Electronic Acknowledgement Signature *
                    </label>
                    <input
                      type="text"
                      value={electronicSignatureName}
                      onChange={(e) => setElectronicSignatureName(e.target.value)}
                      placeholder="e.g. Bikash Kalita or Pranjal Baruah"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-semibold text-sm focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-500 block">
                      Timestamp: {new Date().toLocaleString('en-IN')} • IP & Device Signature Record will be archived in the compliance vault.
                    </span>
                  </div>
                </div>

                {submissionFeedback && (
                  <div className={`p-4 rounded-2xl text-xs flex items-start gap-2.5 ${
                    submissionFeedback.includes('successfully')
                      ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/50 border border-rose-800 text-rose-300'
                  }`}>
                    {submissionFeedback.includes('successfully') ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    )}
                    <span>{submissionFeedback}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer Controls */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
            <div>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                Close
              </button>

              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition cursor-pointer"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitOnboarding}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-bold shadow-xl transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Submit Partner Application</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Individual Legal Agreement Viewer Drawer */}
      {activeViewingAgreement && (
        <PartnerAgreementModal
          agreementType={activeViewingAgreement}
          isOpen={true}
          onClose={() => setActiveViewingAgreement(null)}
          onAccept={() => {
            if (activeViewingAgreement === 'privacy_policy') {
              setAgreedToPrivacy(true);
            } else if (activeViewingAgreement === 'gps_tracking_consent') {
              setAgreedToGpsTracking(true);
            } else {
              setAgreedToMainTerms(true);
            }
          }}
          isAlreadyAccepted={
            (activeViewingAgreement === 'privacy_policy' && agreedToPrivacy) ||
            (activeViewingAgreement === 'gps_tracking_consent' && agreedToGpsTracking) ||
            (agreedToMainTerms)
          }
        />
      )}
    </>
  );
};
