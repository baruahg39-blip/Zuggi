import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  Mail,
  MapPin,
  Phone,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { applyClientSeo, navigateSpa } from '../../utils/seo';

export type LegalPageSlug = 'privacy' | 'terms' | 'refund-policy' | 'delete-account';

interface LegalPagesViewProps {
  pathname: string;
  isSignedIn?: boolean;
}

const EFFECTIVE_DATE = 'November 20, 2026';

function resolveSlug(pathname: string): LegalPageSlug {
  const clean = (pathname || '/privacy').replace(/\/+$/, '').toLowerCase();
  if (clean === '/terms') return 'terms';
  if (clean === '/refund-policy') return 'refund-policy';
  if (clean === '/delete-account') return 'delete-account';
  return 'privacy';
}

export const LegalPagesView: React.FC<LegalPagesViewProps> = ({ pathname, isSignedIn }) => {
  const activeTab = resolveSlug(pathname);
  const [delPhone, setDelPhone] = useState('');
  const [delReason, setDelReason] = useState('');
  const [delSubmitting, setDelSubmitting] = useState(false);
  const [delResult, setDelResult] = useState<{ ok: boolean; refId?: string; message: string } | null>(null);

  const handleSubmitDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = delPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      setDelResult({ ok: false, message: 'Please enter your valid 10-digit registered mobile number.' });
      return;
    }
    setDelSubmitting(true);
    setDelResult(null);
    try {
      const res = await fetch('/api/auth/request-account-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: digits.slice(-10),
          reason: delReason.trim() || 'Requested via zuggi.in/delete-account',
          source: 'web_delete_account'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setDelResult({
          ok: true,
          refId: data.referenceId,
          message: data.message || 'Account deletion request submitted successfully.'
        });
        setDelPhone('');
        setDelReason('');
      } else {
        setDelResult({ ok: false, message: data.message || 'Could not submit request. Please try again.' });
      }
    } catch {
      setDelResult({ ok: false, message: 'Network error. Please email support@zuggi.in with your mobile number.' });
    } finally {
      setDelSubmitting(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'privacy') {
      applyClientSeo({
        title: 'Privacy Policy | Zuggi Commercial Freight & Partner App',
        description:
          'Read Zuggi Freight Privacy Policy covering mobile OTP, passcode security, Parivahan KYC, live trip GPS tracking, Cashfree escrow payments, and data deletion.',
        canonicalPath: '/privacy',
        robots: 'index, follow'
      });
    } else if (activeTab === 'terms') {
      applyClientSeo({
        title: 'Terms & Conditions | Zuggi Commercial Goods Transport',
        description:
          'Terms of service for shippers, fleet owners, and drivers using zuggi.in and Zuggi Partner App: bookings, KYC, e-Way bills, escrow settlements, and liability.',
        canonicalPath: '/terms',
        robots: 'index, follow'
      });
    } else if (activeTab === 'delete-account') {
      applyClientSeo({
        title: 'Delete Account & Data | Zuggi & Zuggi Partner App',
        description:
          'Request permanent deletion of your Zuggi or Zuggi Partner App (in.zuggi.partner) account, profile, KYC documents, and personal data.',
        canonicalPath: '/delete-account',
        robots: 'index, follow'
      });
    } else {
      applyClientSeo({
        title: 'Cancellation & Refund Policy | Zuggi Freight Escrow',
        description:
          'Zuggi Freight cancellation rules, two-stage escrow settlements, dispute review, and 5–7 business day refund timelines via Cashfree Payments.',
        canonicalPath: '/refund-policy',
        robots: 'index, follow'
      });
    }
  }, [activeTab]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      {/* Top Back + Policy Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigateSpa('/')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#77717A] hover:text-[#171318] transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          {isSignedIn ? 'Back to Dashboard' : 'Back to Zuggi Home'}
        </button>

        <div className="inline-flex flex-wrap gap-1.5 bg-white p-1.5 rounded-2xl border border-gray-200 shadow-xs">
          <a
            href="/privacy"
            onClick={(e) => {
              e.preventDefault();
              navigateSpa('/privacy');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'privacy'
                ? 'bg-[#171318] text-white'
                : 'text-[#77717A] hover:text-[#171318]'
            }`}
          >
            Privacy Policy
          </a>
          <a
            href="/terms"
            onClick={(e) => {
              e.preventDefault();
              navigateSpa('/terms');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'terms'
                ? 'bg-[#171318] text-white'
                : 'text-[#77717A] hover:text-[#171318]'
            }`}
          >
            Terms &amp; Conditions
          </a>
          <a
            href="/refund-policy"
            onClick={(e) => {
              e.preventDefault();
              navigateSpa('/refund-policy');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'refund-policy'
                ? 'bg-[#171318] text-white'
                : 'text-[#77717A] hover:text-[#171318]'
            }`}
          >
            Cancellation &amp; Refund
          </a>
          <a
            href="/delete-account"
            onClick={(e) => {
              e.preventDefault();
              navigateSpa('/delete-account');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'delete-account'
                ? 'bg-rose-600 text-white'
                : 'text-[#77717A] hover:text-rose-600'
            }`}
          >
            Delete Account
          </a>
        </div>
      </div>

      {/* Main Document Card */}
      <article className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        {activeTab === 'privacy' && (
          <>
            <header className="bg-[#171318] text-white p-6 sm:p-8 space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#F4A7C5]">
                <ShieldCheck className="w-4 h-4" /> Legal &amp; Data Protection
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Privacy Policy</h1>
              <p className="text-xs sm:text-sm text-gray-300">
                Effective Date: {EFFECTIVE_DATE} · Applies to <strong>zuggi.in</strong>,{' '}
                <strong>partner.zuggi.in</strong>, and the <strong>Zuggi Partner Android App</strong> (
                <span className="font-mono">in.zuggi.partner</span>).
              </p>
            </header>

            <div className="p-6 sm:p-8 space-y-6 text-sm text-[#4b454e] leading-relaxed">
              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-[#171318]">1. Who We Are</h2>
                <p>
                  <strong>Zuggi Freight</strong> (&ldquo;Zuggi&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or
                  &ldquo;us&rdquo;) operates a commercial goods transportation marketplace connecting verified shippers
                  and businesses with commercial truck owners, drivers, and fleet operators across Assam, Northeast
                  India, and pan-India routes. This Privacy Policy explains how we collect, use, store, and safeguard
                  your personal and business data in accordance with the Information Technology Act, 2000, the IT
                  (Intermediary Guidelines) Rules, 2021, and the Digital Personal Data Protection (DPDP) Act, 2023.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-[#171318]">2. Information We Collect</h2>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    <strong>Account &amp; Authentication Information:</strong> Full name, 10-digit Indian mobile number
                    (verified via one-time SMS OTP during registration), optional email address, company name, and your
                    salted, cryptographically hashed 4–6 digit login passcode (we never store your passcode in plain
                    text).
                  </li>
                  <li>
                    <strong>KYC &amp; Vehicle Compliance Documents:</strong> For shippers — GSTIN, PAN, and business
                    address. For drivers and fleet partners — Driving License (DL), Aadhaar verification details,
                    Vehicle Registration Certificate (RC), Parivahan fitness certificate, commercial permit, insurance
                    policy, and bank account / UPI details for freight payouts.
                  </li>
                  <li>
                    <strong>Shipment &amp; Operational Data:</strong> Pickup and delivery addresses, cargo category,
                    weight, vehicle requirements, quotations, booking records, e-Way bill references, delivery OTP
                    confirmations, and electronic Proof of Delivery (e-POD) photos.
                  </li>
                  <li>
                    <strong>Location &amp; GPS Telemetry Data:</strong> For assigned drivers and vehicles during active
                    trips only, we collect real-time latitude/longitude coordinates, speed, heading, and device battery
                    status to display live route tracking to the shipper, compute ETAs, and trigger pickup/delivery
                    geofence alerts.
                  </li>
                  <li>
                    <strong>Payment &amp; Escrow Metadata:</strong> Transaction IDs, payment status, GST invoice
                    records, and payout references processed via our RBI-compliant payment gateway partner{' '}
                    <strong>Cashfree Payments India Private Limited</strong>. Zuggi does <strong>not</strong> store raw
                    credit/debit card numbers, CVV codes, or UPI PINs.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-[#171318]">
                  3. Foreground &amp; Background Location Usage (Google Play Disclosure)
                </h2>
                <p>
                  The <strong>Zuggi Partner App</strong> (<span className="font-mono">in.zuggi.partner</span>) and web
                  driver tracking link request location permission strictly to provide live highway tracking to the
                  consignor/shipper during an active commercial booking. Location updates run only while a trip is
                  active and stop automatically once delivery is verified via e-POD / Delivery OTP. We never sell
                  location history to advertisers or unrelated third parties.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-[#171318]">4. How We Use &amp; Share Data</h2>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Match commercial loads with verified nearby trucks and generate transparent quotations.</li>
                  <li>Share necessary shipper/driver contact details only after a booking is confirmed.</li>
                  <li>Process two-stage escrow payments (90% pickup advance and 10% balance after e-POD) via Cashfree.</li>
                  <li>Generate GST-compliant freight invoices, trip logs, and audit trails for dispute resolution.</li>
                  <li>
                    Publish anonymized, non-personal freight route summaries (origin city, destination city, cargo
                    type, truck size, weight) on public load boards — strictly stripping phone numbers, OTPs, GSTINs,
                    and personal addresses.
                  </li>
                  <li>Comply with lawful requests from Indian law enforcement, GST, or transport authorities.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-[#171318]">5. Data Security &amp; Retention</h2>
                <p>
                  All data is transmitted over HTTPS/TLS encryption. Login passcodes are protected using salted
                  cryptographic hashing (<span className="font-mono">scrypt</span>). KYC and GST billing records are
                  retained as required under Indian commercial and tax statutes (typically up to 8 financial years for
                  tax invoices) and deleted or anonymized once no longer legally required.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-[#171318]">6. Account &amp; Data Deletion Rights</h2>
                <p>
                  You may request correction of your profile or permanent deletion of your Zuggi account and personal
                  data at any time by emailing{' '}
                  <a href="mailto:support@zuggi.in" className="text-[#E83E83] font-bold hover:underline">
                    support@zuggi.in
                  </a>{' '}
                  from your registered email or calling{' '}
                  <a href="tel:+919678944132" className="text-[#E83E83] font-bold hover:underline">
                    +91 96789 44132
                  </a>{' '}
                  with your registered mobile number. Account deletion requests are completed within{' '}
                  <strong>7 working days</strong> (excluding statutory GST/escrow accounting records mandated by Indian
                  law).
                </p>
              </section>
            </div>
          </>
        )}

        {activeTab === 'terms' && (
          <>
            <header className="bg-[#171318] text-white p-6 sm:p-8 space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#F4A7C5]">
                <FileText className="w-4 h-4" /> Platform Agreement
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Terms &amp; Conditions</h1>
              <p className="text-xs sm:text-sm text-gray-300">
                Effective Date: {EFFECTIVE_DATE} · Governs all bookings and fleet services on{' '}
                <strong>zuggi.in</strong> and <strong>partner.zuggi.in</strong>.
              </p>
            </header>

            <div className="p-6 sm:p-8 space-y-6 text-sm text-[#4b454e] leading-relaxed">
              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-[#171318]">1. Platform Role &amp; Marketplace Model</h2>
                <p>
                  Zuggi operates a digital commercial freight exchange connecting commercial shippers/consignors with
                  independent verified vehicle owners, fleet operators, and drivers (&ldquo;Transport Partners&rdquo;).
                  Zuggi facilitates load discovery, transparent direct quotations with zero hidden brokerage, live GPS
                  tracking, GST documentation, and escrow payment protection. Physical carriage of goods is performed
                  by the assigned Transport Partner.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-[#171318]">2. Registration, KYC &amp; Passcode Access</h2>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    Users must be at least 18 years old and legally authorized to enter into commercial transport
                    contracts in India.
                  </li>
                  <li>
                    Every account requires one-time mobile OTP verification and submission of valid KYC / vehicle
                    documents (Parivahan RC, DL, Insurance, Commercial Permit, and GST/PAN where applicable).
                  </li>
                  <li>
                    After initial onboarding, users authenticate using their private 4–6 digit login passcode. You are
                    solely responsible for keeping your passcode confidential and for all bookings made from your
                    account.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-[#171318]">3. Shipper Obligations &amp; Prohibited Goods</h2>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    Shippers must accurately declare cargo weight, dimensions, packaging, pickup/delivery locations, and
                    ensure valid <strong>GST e-Way Bills</strong> and commercial invoices accompany every taxable
                    consignment exceeding statutory thresholds.
                  </li>
                  <li>
                    <strong>Strictly Prohibited Cargo:</strong> Explosives, firearms, narcotics, contraband, illegal
                    wildlife/forest produce, currency, or undeclared hazardous/flammable chemicals are strictly banned
                    on Zuggi. Any violation leads to immediate account termination and reporting to authorities.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-[#171318]">4. Transport Partner &amp; Driver Obligations</h2>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    Vehicles deployed must match the quoted registration number, vehicle category, body type (open,
                    tarpaulin, closed container, or reefer), and carry valid national/state commercial permits.
                  </li>
                  <li>
                    Drivers must keep live GPS tracking enabled throughout an active trip, handle goods with commercial
                    care, and collect receiver verification (Delivery OTP + clear e-POD photo) before marking a trip
                    delivered.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-[#171318]">5. Pricing, Escrow Payments &amp; GST</h2>
                <p>
                  Freight charges are agreed transparently between the shipper and transporter via Zuggi&apos;s
                  quotation workflow before vehicle dispatch. Payments funded through Cashfree escrow follow our
                  two-stage release structure: <strong>90% pickup advance</strong> upon verified loading/dispatch and{' '}
                  <strong>10% final balance</strong> upon verified delivery OTP and e-POD approval. Applicable tolls,
                  detention/halting charges (if loading/unloading exceeds free waiting windows), and GST are itemized on
                  the platform invoice.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-[#171318]">6. Limitation of Liability &amp; Governing Law</h2>
                <p>
                  Shippers are advised to maintain transit cargo insurance for high-value consignments. Zuggi is not
                  liable for delays caused by force majeure, natural calamities, highway landslides, bandhs/strikes, or
                  regulatory checkpoints. These Terms are governed by the laws of India, and any legal disputes shall be
                  subject to the exclusive jurisdiction of the competent courts in <strong>Guwahati, Assam</strong>.
                </p>
              </section>
            </div>
          </>
        )}

        {activeTab === 'refund-policy' && (
          <>
            <header className="bg-[#171318] text-white p-6 sm:p-8 space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#F4A7C5]">
                <RefreshCcw className="w-4 h-4" /> Escrow &amp; Settlements
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Cancellation &amp; Refund Policy</h1>
              <p className="text-xs sm:text-sm text-gray-300">
                Effective Date: {EFFECTIVE_DATE} · Transparent cancellation rules and Cashfree refund timelines for{' '}
                <strong>zuggi.in</strong>.
              </p>
            </header>

            <div className="p-6 sm:p-8 space-y-6 text-sm text-[#4b454e] leading-relaxed">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-emerald-950">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <strong>Standard Refund Timeline:</strong> All eligible refunds are processed automatically to the
                  customer&apos;s <strong>original payment method</strong> (UPI, NetBanking, Debit/Credit Card, or Bank
                  Account via Cashfree Payments) within <strong>5 to 7 business days</strong> of cancellation or dispute
                  approval.
                </div>
              </div>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-[#171318]">1. Shipper Cancellation Policy</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong>Before Vehicle Assignment (Load Posted / Bidding Stage):</strong> 100% free cancellation.
                    No fee is charged, and any pre-funded escrow deposit is refunded in full.
                  </li>
                  <li>
                    <strong>After Vehicle Assignment &amp; Before Truck Reaches Pickup:</strong> Free cancellation if
                    cancelled within 30 minutes of confirmation and before driver dispatch. If the vehicle has already
                    departed toward the pickup hub, a nominal empty-run dispatch compensation (up to ₹500 for pickups or
                    10% of base freight for heavy trucks, capped transparently) may be deducted and the remaining balance
                    refunded.
                  </li>
                  <li>
                    <strong>After Vehicle Reaches Pickup / During Transit:</strong> Once loading begins or the trip is
                    in transit, bookings cannot be self-cancelled without an operational review. Any refund or pro-rata
                    adjustment is decided by Zuggi&apos;s Dispatch Desk using live GPS distance telemetry and loading
                    records.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-[#171318]">2. Transporter No-Show or Breakdown</h2>
                <p>
                  If an assigned truck fails to report at the pickup hub within the committed window without valid
                  cause, Zuggi will immediately arrange a replacement verified truck at the agreed rate or cancel the
                  booking with a <strong>100% full refund</strong> of any advance paid by the shipper.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-[#171318]">3. Two-Stage Escrow &amp; Dispute Resolution</h2>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    <strong>90% Pickup Advance:</strong> Released to the verified transporter upon confirmed loading and
                    dispatch verification.
                  </li>
                  <li>
                    <strong>10% Final Balance:</strong> Held securely in escrow until the consignee verifies safe
                    delivery via Delivery OTP and e-POD upload.
                  </li>
                  <li>
                    <strong>Disputes:</strong> If there is a shortage, damage, or billing discrepancy, shippers or
                    transporters may raise a dispute directly inside the booking screen or email{' '}
                    <a href="mailto:support@zuggi.in" className="text-[#E83E83] font-bold hover:underline">
                      support@zuggi.in
                    </a>{' '}
                    within 24 hours of delivery. Our compliance team reviews GPS logs, e-POD photos, and weight slips to
                    issue a resolution within <strong>48 business hours</strong>.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-[#171318]">4. Duplicate or Failed Payments</h2>
                <p>
                  If an amount is debited from your bank/UPI account due to a network timeout but the booking status does
                  not confirm, Cashfree&apos;s automated reconciliation reverses the failed payment to your source
                  account within <strong>3 to 5 business days</strong>. You may also share your transaction reference
                  number with our support desk for priority tracking.
                </p>
              </section>
            </div>
          </>
        )}

        {activeTab === 'delete-account' && (
          <>
            <header className="bg-[#171318] text-white p-6 sm:p-8 space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-300">
                <Trash2 className="w-4 h-4" /> Google Play Data Safety &amp; User Rights
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Delete Your Zuggi Account &amp; Data</h1>
              <p className="text-xs sm:text-sm text-gray-300">
                Applies to <strong>Zuggi (zuggi.in)</strong> and the{' '}
                <strong>Zuggi Partner Android App</strong> (<span className="font-mono">in.zuggi.partner</span>).
              </p>
            </header>

            <div className="p-6 sm:p-8 space-y-6 text-sm text-[#4b454e] leading-relaxed">
              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-[#171318]">1. How to Delete Your Account</h2>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    <strong>Inside the Zuggi Partner App:</strong> Sign in → tap <strong>Profile</strong> → scroll down
                    and tap <strong>Delete My Account</strong>.
                  </li>
                  <li>
                    <strong>Via This Web Form (No App Required):</strong> Enter your registered 10-digit mobile number
                    below to immediately revoke login access and queue permanent erasure.
                  </li>
                </ul>
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-1.5">
                  <h3 className="font-extrabold text-rose-900">Data Permanently Deleted (Within 7 Days)</h3>
                  <ul className="list-disc pl-4 space-y-1 text-rose-800">
                    <li>Registered mobile number login &amp; encrypted passcode hash</li>
                    <li>Name, business profile, email &amp; vehicle listings</li>
                    <li>Uploaded Driving License, RC, Insurance &amp; KYC photos</li>
                    <li>Live GPS location coordinates &amp; notification preferences</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-1.5">
                  <h3 className="font-extrabold text-[#171318]">Data Retained for Indian Legal Compliance</h3>
                  <ul className="list-disc pl-4 space-y-1 text-[#4b454e]">
                    <li>Completed GST consignment invoices &amp; e-Way bill references</li>
                    <li>Cashfree settlement &amp; Section 194C TDS payout ledgers</li>
                    <li>Active dispute or fraud-audit logs (until legally closed)</li>
                  </ul>
                </div>
              </section>

              <form onSubmit={handleSubmitDeletion} className="p-5 rounded-2xl bg-[#F8F6F8] border border-gray-200 space-y-4">
                <div className="flex items-center gap-2 text-xs font-extrabold text-[#171318]">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Submit Permanent Account Deletion Request</span>
                </div>

                {delResult && (
                  <div
                    className={`p-3.5 rounded-xl text-xs font-semibold border ${
                      delResult.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    {delResult.refId && (
                      <div className="font-mono font-bold mb-1">Reference ID: {delResult.refId}</div>
                    )}
                    <div>{delResult.message}</div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#171318] mb-1">
                      Registered 10-Digit Mobile Number *
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      required
                      value={delPhone}
                      onChange={(e) => setDelPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-300 text-sm font-mono text-[#171318] focus:outline-none focus:border-[#E83E83]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#171318] mb-1">
                      Reason (Optional)
                    </label>
                    <input
                      type="text"
                      value={delReason}
                      onChange={(e) => setDelReason(e.target.value)}
                      placeholder="e.g. No longer operating commercial vehicle"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-300 text-sm text-[#171318] focus:outline-none focus:border-[#E83E83]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={delSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold transition cursor-pointer inline-flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{delSubmitting ? 'Submitting Request...' : 'Request Permanent Account Deletion'}</span>
                </button>
              </form>
            </div>
          </>
        )}

        {/* Shared Nodal Officer & Contact Block (Required by Indian IT Rules, Cashfree KYC & Play Store) */}
        <footer className="bg-[#F8F6F8] border-t border-gray-200 p-6 sm:p-8 space-y-3">
          <h3 className="text-sm font-extrabold text-[#171318] flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#E83E83]" /> Grievance &amp; Nodal Officer Contact
          </h3>
          <p className="text-xs text-[#4b454e] leading-relaxed">
            For privacy requests, account deletion, refund inquiries, or regulatory grievances under Indian IT Rules:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#171318]">
            <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-gray-200">
              <Mail className="w-4 h-4 text-[#E83E83] shrink-0" />
              <div>
                <span className="block text-[10px] font-bold uppercase text-[#77717A]">Support &amp; Grievance</span>
                <a href="mailto:support@zuggi.in" className="font-bold hover:underline">
                  support@zuggi.in
                </a>
                <span className="block text-[11px] text-[#77717A]">nodal.officer@zuggi.in</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-gray-200">
              <Phone className="w-4 h-4 text-[#E83E83] shrink-0" />
              <div>
                <span className="block text-[10px] font-bold uppercase text-[#77717A]">24/7 Dispatch Desk</span>
                <a href="tel:+919678944132" className="font-mono font-bold hover:underline">
                  +91 96789 44132
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-gray-200">
              <MapPin className="w-4 h-4 text-[#E83E83] shrink-0" />
              <div>
                <span className="block text-[10px] font-bold uppercase text-[#77717A]">Registered Office</span>
                <span className="font-bold">Beltola, GS Road, Guwahati, Assam 781028, India</span>
              </div>
            </div>
          </div>
        </footer>
      </article>
    </div>
  );
};
