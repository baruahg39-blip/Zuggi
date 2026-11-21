import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Lock, 
  Building2,
  UserCheck
} from 'lucide-react';
import { User } from '../../types';
import { DocumentUploader } from './DocumentUploader';
import { logisticsStore } from '../../services/store';
import { showToast } from './Toast';

interface KycManagerModalProps {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
}

export const KycManagerModal: React.FC<KycManagerModalProps> = ({
  currentUser,
  isOpen,
  onClose
}) => {
  // Document states
  const [panNumber, setPanNumber] = useState(currentUser.pan || 'AAACB1482Q');
  const [panStatus, setPanStatus] = useState<'verified' | 'uploading' | 'validating' | 'rejected' | 'pending' | 'not_uploaded'>('verified');
  const [panUrl, setPanUrl] = useState<string | undefined>('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80');

  const [aadhaarNumber, setAadhaarNumber] = useState('4912 3819 0182');
  const [aadhaarStatus, setAadhaarStatus] = useState<'verified' | 'uploading' | 'validating' | 'rejected' | 'pending' | 'not_uploaded'>('verified');
  const [aadhaarUrl, setAadhaarUrl] = useState<string | undefined>('https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80');

  const [gstNumber, setGstNumber] = useState(currentUser.gstin || '18AAACB1482Q1ZN');
  const [gstStatus, setGstStatus] = useState<'verified' | 'uploading' | 'validating' | 'rejected' | 'pending' | 'not_uploaded'>('verified');
  const [gstUrl, setGstUrl] = useState<string | undefined>('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80');

  const [activeTab, setActiveTab] = useState<'all' | 'pan' | 'aadhaar' | 'gst'>('all');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">KYC & Statutory Verification</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold uppercase">
                  Verified Account
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Manage PAN, Aadhaar, and GST registration for transport contracts & invoicing
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

        {/* Quick Filter Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-5 pt-3 gap-2 text-xs font-semibold">
          {[
            { id: 'all', label: 'All Documents (3)' },
            { id: 'pan', label: 'PAN Card' },
            { id: 'aadhaar', label: 'Aadhaar (UIDAI)' },
            { id: 'gst', label: 'GST Certificate' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-2.5 px-3 border-b-2 transition cursor-pointer ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body / Document Uploaders */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-slate-200">
          <div className="p-3.5 bg-blue-950/40 border border-blue-800/60 rounded-2xl text-xs text-blue-300 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Statutory Compliance in Indian Freight:</span>
              <span className="text-[11px] text-blue-200">
                PAN is mandated for Section 194C TDS deductions; GST Registration (Form GST REG-06) enables 5% Goods Transport Agency (GTA) invoicing; Aadhaar provides verified identity for consignor/transporter verification.
              </span>
            </div>
          </div>

          {/* 1. PAN Card Document Uploader */}
          {(activeTab === 'all' || activeTab === 'pan') && (
            <DocumentUploader
              documentType="pan"
              title="Permanent Account Number (PAN)"
              description="Upload business or proprietor PAN card scan for tax deduction at source (TDS)."
              documentNumber={panNumber}
              onDocumentNumberChange={setPanNumber}
              documentUrl={panUrl}
              fileName="business_pan_card.pdf"
              fileSizeKb={1240}
              uploadedAt="Oct 15, 2026"
              status={panStatus}
              required={true}
              onUploadSuccess={(res) => {
                setPanUrl(res.url);
                setPanStatus('verified');
              }}
              onRemoveDocument={() => {
                setPanUrl(undefined);
                setPanStatus('not_uploaded');
              }}
            />
          )}

          {/* 2. Aadhaar Card Document Uploader */}
          {(activeTab === 'all' || activeTab === 'aadhaar') && (
            <DocumentUploader
              documentType="aadhaar"
              title="Aadhaar Card (UIDAI)"
              description="Individual identity verification. Numbers are masked for privacy compliance."
              documentNumber={aadhaarNumber}
              onDocumentNumberChange={setAadhaarNumber}
              documentUrl={aadhaarUrl}
              fileName="authorized_signatory_aadhaar.pdf"
              fileSizeKb={2450}
              uploadedAt="Oct 18, 2026"
              status={aadhaarStatus}
              required={true}
              maskSensitive={true}
              onUploadSuccess={(res) => {
                setAadhaarUrl(res.url);
                setAadhaarStatus('verified');
              }}
              onRemoveDocument={() => {
                setAadhaarUrl(undefined);
                setAadhaarStatus('not_uploaded');
              }}
            />
          )}

          {/* 3. GST Registration Certificate Uploader */}
          {(activeTab === 'all' || activeTab === 'gst') && (
            <DocumentUploader
              documentType="gst"
              title="GST Registration Certificate (REG-06)"
              description="Statutory 15-digit GSTIN document with State Jurisdiction for GTA Tax Invoices."
              documentNumber={gstNumber}
              onDocumentNumberChange={setGstNumber}
              documentUrl={gstUrl}
              fileName="gst_registration_cert_assam.pdf"
              fileSizeKb={3180}
              uploadedAt="Oct 20, 2026"
              status={gstStatus}
              required={false}
              onUploadSuccess={(res) => {
                setGstUrl(res.url);
                setGstStatus('verified');
              }}
              onRemoveDocument={() => {
                setGstUrl(undefined);
                setGstStatus('not_uploaded');
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Encrypted cloud storage with DPDP compliant verification logs</span>
          </div>

          <button
            onClick={() => {
              const updatedUser: User = {
                ...currentUser,
                pan: panNumber.trim().toUpperCase(),
                gstin: gstNumber.trim().toUpperCase() || undefined
              };
              logisticsStore.saveUser(updatedUser);
              logisticsStore.setCurrentUser(updatedUser);
              showToast('KYC details updated successfully!', 'success');
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
          >
            Save &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
