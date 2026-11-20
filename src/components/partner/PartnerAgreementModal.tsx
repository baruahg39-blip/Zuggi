import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  ShieldCheck, 
  Printer, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle,
  Scale,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';
import { PartnerAgreementType } from '../../types';
import { PARTNER_AGREEMENTS, CURRENT_AGREEMENT_VERSION, AgreementDocument } from '../../data/agreementsData';

interface PartnerAgreementModalProps {
  agreementType: PartnerAgreementType;
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  isAlreadyAccepted?: boolean;
}

export const PartnerAgreementModal: React.FC<PartnerAgreementModalProps> = ({
  agreementType,
  isOpen,
  onClose,
  onAccept,
  isAlreadyAccepted = false
}) => {
  const [selectedType, setSelectedType] = useState<PartnerAgreementType>(agreementType);

  if (!isOpen) return null;

  const currentDoc: AgreementDocument = PARTNER_AGREEMENTS[selectedType] || PARTNER_AGREEMENTS.vehicle_owner_agreement;

  const allAgreementKeys: PartnerAgreementType[] = [
    'vehicle_owner_agreement',
    'driver_terms_conditions',
    'fleet_partner_agreement',
    'privacy_policy',
    'gps_tracking_consent',
    'load_booking_transport_terms'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white truncate">
                  {currentDoc.title}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 font-mono font-bold border border-slate-700">
                  {currentDoc.version}
                </span>
                {isAlreadyAccepted && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Accepted Record</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">
                {currentDoc.hindiTitle} • Effective: {currentDoc.effectiveDate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => window.print()}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Print Agreement"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Agreement Selector Tabs */}
        <div className="flex items-center overflow-x-auto bg-slate-950/70 border-b border-slate-800 px-4 py-2 gap-2 text-xs">
          {allAgreementKeys.map((key) => {
            const doc = PARTNER_AGREEMENTS[key];
            const isSelected = selectedType === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedType(key)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap text-xs font-semibold transition cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {doc.title.split(' ')[0]} {doc.title.split(' ')[1]}
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 text-slate-300 text-xs sm:text-sm leading-relaxed">
          {/* Statutory Summary Banner */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1 text-xs">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Statutory Compliance Summary:</span>
            </div>
            <p className="text-slate-300">
              {currentDoc.summary}
            </p>
          </div>

          {/* Agreement Sections */}
          <div className="space-y-5 divide-y divide-slate-800/80">
            {currentDoc.sections.map((sec, idx) => (
              <div key={idx} className={idx > 0 ? 'pt-4 space-y-2' : 'space-y-2'}>
                <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span>{sec.heading}</span>
                </h4>
                <p className="text-slate-300 text-xs sm:text-[13px] leading-relaxed pl-3.5 border-l-2 border-slate-800">
                  {sec.content}
                </p>
              </div>
            ))}
          </div>

          {/* Legal Governance Footer */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
              Applicable Legal Framework
            </span>
            <p className="text-slate-400 text-[11px]">
              This document constitutes a valid electronic contract under the Information Technology Act, 2000 (Section 10A) and complies with the Carriage by Road Act, 2007, Central Motor Vehicles Rules 1989, and the Digital Personal Data Protection Act, 2023. Version: <span className="font-mono text-amber-400">{currentDoc.version}</span>.
            </p>
          </div>
        </div>

        {/* Modal Bottom Action */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 hidden sm:block">
            Please review all clauses before signing acknowledgement.
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
            >
              Close
            </button>
            {onAccept && !isAlreadyAccepted && (
              <button
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Accept & Acknowledge</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
