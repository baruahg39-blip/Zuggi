import React, { useState, useRef, useId } from 'react';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Eye, 
  Trash2, 
  RefreshCw, 
  Lock, 
  FileCheck,
  ShieldAlert,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { KycDocumentType } from '../../types';

export interface DocumentUploaderProps {
  documentType: KycDocumentType;
  title: string;
  description?: string;
  documentNumber: string;
  onDocumentNumberChange?: (val: string) => void;
  documentUrl?: string;
  fileName?: string;
  fileSizeKb?: number;
  uploadedAt?: string;
  status?: 'not_uploaded' | 'uploading' | 'validating' | 'verified' | 'rejected' | 'pending';
  rejectionReason?: string;
  onUploadSuccess?: (result: { url: string; fileName: string; fileSizeKb: number }) => void;
  onRemoveDocument?: () => void;
  required?: boolean;
  maskSensitive?: boolean;
}

// Regex patterns for authentic Indian KYC documents
const KYC_VALIDATION_RULES: Record<
  KycDocumentType,
  {
    regex: RegExp;
    formatPlaceholder: string;
    helperText: string;
    example: string;
  }
> = {
  pan: {
    regex: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
    formatPlaceholder: 'ABCDE1234F',
    helperText: '10-character alphanumeric (5 letters, 4 digits, 1 letter)',
    example: 'AAACB1482Q'
  },
  aadhaar: {
    regex: /^(\d{4}\s?){3}$/,
    formatPlaceholder: '•••• •••• ••••',
    helperText: '12-digit Indian UIDAI Aadhaar number',
    example: '4912 3819 0182'
  },
  gst: {
    regex: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    formatPlaceholder: '18AAACB1482Q1ZN',
    helperText: '15-character GSTIN (State code + PAN + entity + Z + check)',
    example: '18AAACB1482Q1ZN'
  },
  driving_license: {
    regex: /^[A-Z]{2}[0-9]{2}\s?[0-9]{11}$/,
    formatPlaceholder: 'AS01 20210048192',
    helperText: 'State code, RTO code, year and license digits',
    example: 'AS01 20210048192'
  },
  rc: {
    regex: /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/,
    formatPlaceholder: 'AS01MC7822',
    helperText: 'Vehicle Registration Certificate number',
    example: 'AS-01-MC-7822'
  },
  fitness: {
    regex: /^.+$/,
    formatPlaceholder: 'FIT-DIB-2025',
    helperText: 'Commercial vehicle fitness certificate reference',
    example: 'FIT-DIB-2025'
  },
  cancelled_cheque: {
    regex: /^.+$/,
    formatPlaceholder: 'SBIN0000078',
    helperText: 'IFSC / Bank Account verification document',
    example: 'SBIN0000078'
  }
};

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  documentType,
  title,
  description,
  documentNumber,
  onDocumentNumberChange,
  documentUrl,
  fileName = 'kyc_document.pdf',
  fileSizeKb = 1840,
  uploadedAt,
  status = 'not_uploaded',
  rejectionReason,
  onUploadSuccess,
  onRemoveDocument,
  required = false,
  maskSensitive = false
}) => {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentStatus, setCurrentStatus] = useState(status);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [docNumInput, setDocNumInput] = useState(documentNumber);
  const [docNumError, setDocNumError] = useState<string | null>(null);

  const rule = KYC_VALIDATION_RULES[documentType] || KYC_VALIDATION_RULES.pan;

  // Format Aadhaar with spaces automatically
  const handleDocNumberChange = (raw: string) => {
    let formatted = raw.toUpperCase();
    if (documentType === 'aadhaar') {
      const clean = raw.replace(/\D/g, '').slice(0, 12);
      formatted = clean.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    }

    setDocNumInput(formatted);
    onDocumentNumberChange?.(formatted);

    // Validate format
    const cleanNum = formatted.replace(/\s+/g, '');
    if (cleanNum.length > 0) {
      if (documentType === 'aadhaar') {
        if (cleanNum.length !== 12) {
          setDocNumError('Aadhaar must be exactly 12 digits');
        } else {
          setDocNumError(null);
        }
      } else if (!rule.regex.test(formatted)) {
        setDocNumError(rule.helperText);
      } else {
        setDocNumError(null);
      }
    } else {
      setDocNumError(null);
    }
  };

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (file: File) => {
    setErrorMessage(null);

    // Validate size (max 10MB)
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      setErrorMessage('File size exceeds 10MB limit. Please upload a compressed PDF or image.');
      return;
    }

    // Validate format
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMessage('Unsupported format. Please upload PDF, PNG, or JPEG files.');
      return;
    }

    // Begin simulated chunked upload with progress
    setCurrentStatus('uploading');
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          // Transition to OCR validation
          setCurrentStatus('validating');
          setTimeout(() => {
            setCurrentStatus('verified');
            const mockUrl = URL.createObjectURL(file);
            onUploadSuccess?.({
              url: mockUrl,
              fileName: file.name,
              fileSizeKb: Math.round(file.size / 1024)
            });
          }, 1200);
          return 100;
        }
        return prev + 15;
      });
    }, 180);
  };

  // Mask display for sensitive documents like Aadhaar
  const displayedDocNumber = maskSensitive && docNumInput.length >= 8
    ? `•••• •••• ${docNumInput.slice(-4)}`
    : docNumInput;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700/80 transition shadow-lg space-y-4">
      {/* Top Document Title & Verification Badge */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>{title}</span>
              {required && <span className="text-rose-400 text-xs">*</span>}
            </h4>
          </div>
          {description && <p className="text-xs text-slate-400">{description}</p>}
        </div>

        {/* Dynamic Verification Badge */}
        <div>
          {currentStatus === 'verified' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified & Active</span>
            </span>
          )}

          {currentStatus === 'uploading' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-950/80 text-blue-400 border border-blue-800 text-xs font-semibold animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Uploading ({uploadProgress}%)</span>
            </span>
          )}

          {currentStatus === 'validating' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800 text-xs font-semibold">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Verifying OCR Checksum...</span>
            </span>
          )}

          {currentStatus === 'pending' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800 text-xs font-semibold">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Under Verification</span>
            </span>
          )}

          {currentStatus === 'rejected' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800 text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Rejected</span>
            </span>
          )}

          {currentStatus === 'not_uploaded' && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold">
              Pending Upload
            </span>
          )}
        </div>
      </div>

      {/* Document Number Input with Validation */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <label className="text-slate-300 font-semibold">{title} Number / Identifier</label>
          <span className="text-[10px] text-slate-500 font-mono">e.g. {rule.example}</span>
        </div>
        <div className="relative">
          <input
            type="text"
            value={docNumInput}
            onChange={(e) => handleDocNumberChange(e.target.value)}
            placeholder={rule.formatPlaceholder}
            className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold tracking-wider transition ${
              docNumError
                ? 'border-rose-500 text-rose-300 focus:ring-1 focus:ring-rose-500'
                : 'border-slate-700 text-amber-400 focus:border-amber-500'
            }`}
          />
          {docNumInput && !docNumError && (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 absolute right-3 top-3 pointer-events-none" />
          )}
        </div>
        {docNumError ? (
          <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{docNumError}</span>
          </p>
        ) : (
          <p className="text-[10px] text-slate-500 mt-1">{rule.helperText}</p>
        )}
      </div>

      {/* Rejection Alert (If Any) */}
      {currentStatus === 'rejected' && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Document Verification Issue:</span>
            <span>{rejectionReason || 'Document photo is unclear or blurred. Please upload a high-resolution color scan.'}</span>
          </div>
        </div>
      )}

      {/* Upload Progress Bar (Visible when uploading or validating) */}
      {(currentStatus === 'uploading' || currentStatus === 'validating') && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-blue-400 animate-bounce" />
              <span>{currentStatus === 'validating' ? 'Verifying OCR authenticity...' : 'Uploading secure encrypted document...'}</span>
            </span>
            <span className="font-mono text-blue-400 font-bold">{uploadProgress}%</span>
          </div>

          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 via-amber-500 to-emerald-400 h-full transition-all duration-300 ease-out rounded-full"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>{Math.round((fileSizeKb * (uploadProgress / 100)) / 1024 * 10) / 10} MB / {Math.round(fileSizeKb / 1024 * 10) / 10} MB</span>
            <span>AES-256 Cloud Storage</span>
          </div>
        </div>
      )}

      {/* Document Attached Preview Card (When Uploaded/Verified) */}
      {(currentStatus === 'verified' || currentStatus === 'pending') && (
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-slate-100 truncate max-w-[200px] sm:max-w-xs">
                {fileName}
              </div>
              <div className="text-[10px] text-slate-400">
                {fileSizeKb} KB • Uploaded {uploadedAt || 'Today'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPreviewModalOpen(true)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
              title="View Document"
            >
              <Eye className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                fileInputRef.current?.click();
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 transition cursor-pointer"
              title="Replace File"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {onRemoveDocument && (
              <button
                type="button"
                onClick={() => {
                  setCurrentStatus('not_uploaded');
                  onRemoveDocument();
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-rose-300 transition cursor-pointer"
                title="Remove Document"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Drag & Drop Upload Zone (When not yet uploaded or rejected) */}
      {(currentStatus === 'not_uploaded' || currentStatus === 'rejected') && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer flex flex-col items-center justify-center gap-2 ${
            dragActive
              ? 'border-amber-400 bg-amber-500/10'
              : 'border-slate-800 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-950'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 shadow-md">
            <UploadCloud className="w-6 h-6" />
          </div>

          <div>
            <div className="text-xs font-bold text-slate-200">
              <span className="text-amber-400 hover:underline">Click to upload</span> or drag and drop document
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              PDF, PNG, JPG, or WEBP (Max file size: 10 MB)
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Security note */}
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
        <Lock className="w-3 h-3 text-slate-400" />
        <span>End-to-end encrypted storage under Indian Digital Personal Data Protection (DPDP) Act.</span>
      </div>

      {/* Full Document Preview Modal */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-bold text-white">{title} - {docNumInput}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-4 flex flex-col items-center justify-center min-h-[300px]">
              <img
                src={documentUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80'}
                alt={title}
                className="max-h-[360px] object-contain rounded-lg border border-slate-800 shadow-md"
              />
              <div className="text-xs text-slate-400 mt-3 font-mono">
                {fileName} • Verified Certificate Scan
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
