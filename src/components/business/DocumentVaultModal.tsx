import React, { useEffect, useState } from 'react';
import {
  X,
  Printer,
  Download,
  FileText,
  Receipt,
  FileCheck2,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Clock,
  ShieldCheck
} from 'lucide-react';
import type { Booking, LoadItem, User } from '../../types';
import {
  businessClient,
  type BusinessProfile
} from '../../services/businessClient';
import {
  calculateEscrow7030Breakdown,
  formatInrExact,
  type TripEscrowLedger
} from '../../services/escrowClient';

export type VaultDocumentTab = 'lr' | 'gst_invoice' | 'pod';

export interface DocumentVaultTripData {
  tripId: string;
  loadId?: string;
  booking?: Booking;
  load?: LoadItem;
  vehicleLabel: string;
  vehicleRegNumber: string;
  driverName: string;
  driverPhone: string;
  totalFareInr: number;
  escrowLedger?: TripEscrowLedger | null;
}

interface DocumentVaultModalProps {
  trip: DocumentVaultTripData;
  currentUser: User;
  businessProfile: BusinessProfile | null;
  initialTab?: VaultDocumentTab;
  onClose: () => void;
}

export const DocumentVaultModal: React.FC<DocumentVaultModalProps> = ({
  trip,
  currentUser,
  businessProfile,
  initialTab = 'lr',
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<VaultDocumentTab>(initialTab);
  const [loadingPod, setLoadingPod] = useState<boolean>(false);
  const [podUrl, setPodUrl] = useState<string | null>(
    trip.booking?.podDocumentUrl || null
  );
  const [podSource, setPodSource] = useState<string>(
    trip.booking?.podDocumentUrl ? 'booking_record' : 'none'
  );
  const [podUploadedAt, setPodUploadedAt] = useState<string | null>(
    trip.booking?.completedAt || null
  );
  const [podFileName, setPodFileName] = useState<string>(`POD_${trip.tripId}.jpg`);

  useEffect(() => {
    let active = true;
    setLoadingPod(true);
    businessClient
      .fetchTripPodDocument(trip.tripId)
      .then((res) => {
        if (!active) return;
        if (res.success && res.podUrl) {
          setPodUrl(res.podUrl);
          setPodSource(res.source || 'supabase_storage');
          if (res.fileName) setPodFileName(res.fileName);
          if (res.uploadedAt) setPodUploadedAt(res.uploadedAt);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingPod(false);
      });
    return () => {
      active = false;
    };
  }, [trip.tripId]);

  const pickup = trip.booking?.pickup || trip.load?.pickup;
  const delivery = trip.booking?.delivery || trip.load?.delivery;
  const loadItem = trip.load;

  const companyName =
    businessProfile?.company_legal_name ||
    currentUser.businessName ||
    currentUser.name ||
    'Registered Business Shipper';
  const customerGstin = (businessProfile?.gstin || currentUser.gstin || '').toUpperCase();
  const billingAddress = businessProfile?.billing_address
    ? [
        businessProfile.billing_address,
        businessProfile.billing_city,
        businessProfile.billing_state,
        businessProfile.billing_pincode
      ]
        .filter(Boolean)
        .join(', ')
    : pickup?.address || 'Guwahati, Assam';

  const contactPerson = businessProfile?.contact_person || currentUser.name;
  const contactPhone = businessProfile?.contact_phone || currentUser.phone;

  // Determine intra-state (Assam code 18) vs inter-state GST breakup (SAC 996511 — 5% GTA)
  const isAssamIntraState = customerGstin
    ? customerGstin.startsWith('18')
    : (businessProfile?.billing_state || pickup?.state || 'Assam')
        .toLowerCase()
        .includes('assam');

  const taxableFreightPaise = Math.round((trip.totalFareInr || 0) * 100);
  const totalGstPaise = Math.round(taxableFreightPaise * 0.05);
  const cgstPaise = isAssamIntraState ? Math.floor(totalGstPaise / 2) : 0;
  const sgstPaise = isAssamIntraState ? totalGstPaise - cgstPaise : 0;
  const igstPaise = isAssamIntraState ? 0 : totalGstPaise;
  const grandTotalPaise = taxableFreightPaise + totalGstPaise;

  const split7030 = calculateEscrow7030Breakdown(trip.totalFareInr || 0);
  const advance70Amt = trip.escrowLedger?.advance_70_amount ?? split7030.advance70Inr;
  const balance30Amt = trip.escrowLedger?.balance_30_amount ?? split7030.balance30Inr;

  const docDate = new Date(
    trip.booking?.createdAt || trip.load?.createdAt || Date.now()
  ).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const lrNumber = `ZUG-LR-${trip.tripId.replace(/[^A-Z0-9]/gi, '').slice(-8).toUpperCase()}`;
  const invoiceNumber = `ZUG-INV-${new Date().getFullYear()}-${trip.tripId
    .replace(/[^A-Z0-9]/gi, '')
    .slice(-6)
    .toUpperCase()}`;

  const isPodPdf = Boolean(podUrl && (podUrl.toLowerCase().includes('.pdf') || podUrl.startsWith('data:application/pdf')));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Trip Document Vault"
    >
      <div className="bg-white text-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Top Control Bar (hidden on print) */}
        <div className="no-print px-4 sm:px-5 py-3.5 bg-[#171318] text-white flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold leading-tight">
              Trip Document Vault
            </h2>
            <p className="text-[11px] text-slate-300 font-mono mt-0.5">
              Trip {trip.tripId} · {pickup?.city || 'Origin'} → {delivery?.city || 'Destination'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab !== 'pod' && (
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-1.5 rounded-lg bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save PDF</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close document vault"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Switcher Tabs (hidden on print) */}
        <div className="no-print border-b border-slate-200 bg-slate-50 px-3 sm:px-5 flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'lr' as VaultDocumentTab, label: 'Digital LR / Bilty', icon: FileText },
            { id: 'gst_invoice' as VaultDocumentTab, label: 'GST Tax Invoice', icon: Receipt },
            { id: 'pod' as VaultDocumentTab, label: 'Signed POD', icon: FileCheck2 }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-3 text-xs font-semibold inline-flex items-center gap-1.5 border-b-2 whitespace-nowrap transition cursor-pointer ${
                  active
                    ? 'border-[#E83E83] text-[#171318]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Document Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-7 bg-white">
          {/* TAB 1: DIGITAL LR (LORRY RECEIPT / BILTY) */}
          {activeTab === 'lr' && (
            <div className="space-y-5 text-xs text-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black tracking-tight text-[#171318]">Zuggi Freight</span>
                    <span className="text-[11px] font-semibold text-[#E83E83]">· Digital Consignment Note</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Transport Nagar, NH-27, Beltola, Guwahati - 781028, Assam
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    GTA GSTIN: 18AAAFK4902L1ZQ · Support: +91 96789 44132
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Digital Lorry Receipt (LR / Bilty)
                  </div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                    {lrNumber}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Issued: {docDate} · Trip Ref: <span className="font-mono">{trip.tripId}</span>
                  </div>
                </div>
              </div>

              {/* Consignor & Consignee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Consignor (Shipper)
                  </div>
                  <div className="text-sm font-bold text-slate-900">{companyName}</div>
                  <div className="text-slate-700">{contactPerson} · {contactPhone}</div>
                  <div className="text-slate-600">{pickup?.address || billingAddress}</div>
                  <div className="text-slate-600">
                    {[pickup?.city, pickup?.state, pickup?.pincode].filter(Boolean).join(', ')}
                  </div>
                  {customerGstin && (
                    <div className="pt-1 font-mono text-[11px] font-semibold text-slate-900">
                      GSTIN: {customerGstin}
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Consignee (Delivery Destination)
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {delivery?.contactName || 'Authorized Site Receiver'}
                  </div>
                  <div className="text-slate-700">
                    {delivery?.contactPhone || 'Verified at Destination OTP'}
                  </div>
                  <div className="text-slate-600">{delivery?.address || 'Destination Hub'}</div>
                  <div className="text-slate-600">
                    {[delivery?.city, delivery?.state, delivery?.pincode].filter(Boolean).join(', ')}
                  </div>
                </div>
              </div>

              {/* Vehicle & Carrier Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl border border-slate-200 bg-white">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Vehicle Type</span>
                  <span className="font-semibold text-slate-900 mt-0.5 block">{trip.vehicleLabel}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Registration No.</span>
                  <span className="font-mono font-bold text-slate-900 mt-0.5 block">{trip.vehicleRegNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Driver</span>
                  <span className="font-semibold text-slate-900 mt-0.5 block">{trip.driverName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Driver Mobile</span>
                  <span className="font-mono text-slate-900 mt-0.5 block">{trip.driverPhone || 'Assigned'}</span>
                </div>
              </div>

              {/* Goods & Freight Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <th className="py-2.5 px-3">Goods Description</th>
                      <th className="py-2.5 px-3">Packages</th>
                      <th className="py-2.5 px-3">Weight</th>
                      <th className="py-2.5 px-3">E-Way Bill</th>
                      <th className="py-2.5 px-3 text-right">Agreed Freight</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-xs text-slate-800">
                      <td className="py-3 px-3 font-medium">
                        {loadItem?.goodsDescription || loadItem?.goodsCategory?.replace(/_/g, ' ') || 'Commercial Goods Consignment'}
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums">
                        {loadItem?.packageCount || 1} units
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums">
                        {loadItem?.weightKg ? `${loadItem.weightKg.toLocaleString('en-IN')} kg` : 'FTL'}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {loadItem?.specialRequirements?.eWayBillNumber || 'Not Required / Attached'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatInrExact(trip.totalFareInr)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 70/30 Payment Terms & Signatures */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">Escrow Payment Terms (70% / 30%)</div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    70% Loading Advance ({formatInrExact(advance70Amt)}) released on Digital LR · 30% Balance ({formatInrExact(balance30Amt)}) settled on verified POD.
                  </p>
                </div>
                <div className="text-[11px] text-emerald-700 font-semibold inline-flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Digitally Signed via Zuggi</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GST TAX INVOICE (SAC 996511) */}
          {activeTab === 'gst_invoice' && (
            <div className="space-y-5 text-xs text-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-[#171318]">
                    Zuggi Freight Logistics Pvt. Ltd.
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Transport Nagar, NH-27, Beltola, Guwahati - 781028, Assam (State Code: 18)
                  </p>
                  <p className="text-[11px] text-slate-600 font-mono">
                    GSTIN: 18AAAFK4902L1ZQ · PAN: AAAFK4902L · SAC: 996511
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    GST Tax Invoice (Original for Recipient)
                  </div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                    {invoiceNumber}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Invoice Date: {docDate} · LR Ref: <span className="font-mono">{lrNumber}</span>
                  </div>
                </div>
              </div>

              {/* Billed To & Place of Supply */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Billed To (Shipper Legal Entity)
                  </div>
                  <div className="text-sm font-bold text-slate-900">{companyName}</div>
                  <div className="text-slate-600">{billingAddress}</div>
                  <div className="text-slate-700">Attn: {contactPerson} · {contactPhone}</div>
                  <div className="pt-1 font-mono text-[11px] font-semibold text-slate-900">
                    Customer GSTIN: {customerGstin || 'Unregistered / Update in Business Profile'}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Supply &amp; Transport Reference
                  </div>
                  <div className="text-slate-800">
                    <span className="text-slate-500">Route:</span>{' '}
                    <strong>{pickup?.city || 'Origin'} → {delivery?.city || 'Destination'}</strong>
                  </div>
                  <div className="text-slate-800">
                    <span className="text-slate-500">Place of Supply:</span>{' '}
                    <strong>{businessProfile?.billing_state || delivery?.state || 'Assam'}</strong>
                  </div>
                  <div className="text-slate-800">
                    <span className="text-slate-500">Vehicle:</span>{' '}
                    <span className="font-mono font-semibold">{trip.vehicleRegNumber}</span> ({trip.vehicleLabel})
                  </div>
                  <div className="text-slate-800">
                    <span className="text-slate-500">Tax Regime:</span>{' '}
                    <strong>{isAssamIntraState ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}</strong>
                  </div>
                </div>
              </div>

              {/* Line Items & Tax Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <th className="py-2.5 px-3">Service Description</th>
                      <th className="py-2.5 px-3">SAC Code</th>
                      <th className="py-2.5 px-3 text-right">Taxable Value</th>
                      <th className="py-2.5 px-3 text-right">GST Rate</th>
                      <th className="py-2.5 px-3 text-right">Total (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">
                          Road Transport Services of Goods (GTA)
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {pickup?.city || 'Origin'} to {delivery?.city || 'Destination'} · Trip {trip.tripId}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-slate-800">996511</td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {formatInrExact(taxableFreightPaise / 100)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">5.00%</td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold">
                        {formatInrExact(grandTotalPaise / 100)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tax Breakup Totals */}
              <div className="flex justify-end">
                <div className="w-full sm:w-80 space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Freight Value</span>
                    <span className="font-mono tabular-nums text-slate-900">
                      {formatInrExact(taxableFreightPaise / 100)}
                    </span>
                  </div>
                  {isAssamIntraState ? (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>CGST @ 2.5%</span>
                        <span className="font-mono tabular-nums text-slate-900">
                          {formatInrExact(cgstPaise / 100)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>SGST @ 2.5%</span>
                        <span className="font-mono tabular-nums text-slate-900">
                          {formatInrExact(sgstPaise / 100)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-slate-600">
                      <span>IGST @ 5.0%</span>
                      <span className="font-mono tabular-nums text-slate-900">
                        {formatInrExact(igstPaise / 100)}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                    <span>Grand Total (Incl. GST)</span>
                    <span className="font-mono tabular-nums">
                      {formatInrExact(grandTotalPaise / 100)}
                    </span>
                  </div>
                  <div className="pt-1 text-[11px] text-slate-500">
                    70% Advance Milestone: {formatInrExact(advance70Amt)} · 30% POD Balance: {formatInrExact(balance30Amt)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: POD (PROOF OF DELIVERY FROM SUPABASE STORAGE `trip-documents`) */}
          {activeTab === 'pod' && (
            <div className="space-y-4">
              {loadingPod ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-[#E83E83]" />
                  <span>Fetching signed Proof of Delivery from trip-documents vault...</span>
                </div>
              ) : podUrl ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-emerald-950">
                          Signed Proof of Delivery Verified
                        </div>
                        <div className="text-[11px] text-emerald-800 mt-0.5">
                          Source: {podSource === 'supabase_storage' ? 'Supabase Storage (trip-documents)' : 'Driver Verified Upload'}
                          {podUploadedAt
                            ? ` · Uploaded ${new Date(podUploadedAt).toLocaleString('en-IN')}`
                            : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={podUrl}
                        download={podFileName}
                        className="px-3.5 py-2 rounded-lg bg-[#171318] hover:bg-black text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download POD</span>
                      </a>
                      {!podUrl.startsWith('data:') && (
                        <a
                          href={podUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center min-h-[280px] p-3">
                    {isPodPdf ? (
                      <iframe
                        src={podUrl}
                        title="Signed Proof of Delivery PDF"
                        className="w-full h-[460px] rounded-lg border border-slate-200 bg-white"
                      />
                    ) : (
                      <img
                        src={podUrl}
                        alt={`Signed Proof of Delivery for trip ${trip.tripId}`}
                        className="max-h-[480px] w-auto object-contain rounded-lg shadow-xs"
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-12 px-4 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 space-y-2">
                  <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                  <h4 className="text-sm font-semibold text-slate-800">
                    Awaiting Driver Proof of Delivery (POD)
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Once the driver delivers the cargo and uploads the signed Bilty/POD photo to the <code className="font-mono text-slate-700">trip-documents</code> vault, it will appear here automatically for download and 30% balance release.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
