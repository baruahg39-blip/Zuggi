import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  MapPin,
  Route,
  ShieldCheck,
  Truck
} from 'lucide-react';
import {
  findSeoLandingPage,
  getFactualVehiclesByIds,
  SEO_LANDING_PAGE_BY_SLUG,
  SEO_LANDING_PAGES,
  type SeoLandingPageConfig
} from '../../data/seoLandingPages';
import { applyClientSeo, buildSeoLandingJsonLd, navigateSpa } from '../../utils/seo';
import highwayFleetImg from '../../assets/images/zuggi_highway_fleet_1795160250051.jpg';
import operationsHubImg from '../../assets/images/zuggi_operations_hub_1795160248893.jpg';

interface SeoLandingPageViewProps {
  pathname: string;
  onOpenAuth: (role: 'customer' | 'driver' | 'admin') => void;
  onSwitchToPartner: () => void;
}

export const SeoLandingPageView: React.FC<SeoLandingPageViewProps> = ({
  pathname,
  onOpenAuth,
  onSwitchToPartner
}) => {
  const page: SeoLandingPageConfig | null = findSeoLandingPage(pathname);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  useEffect(() => {
    setHeroImgFailed(false);
    setOpenFaqIndex(0);
    if (!page) return;
    applyClientSeo({
      title: page.seoTitle,
      description: page.metaDescription,
      canonicalPath: page.slug,
      ogType: 'website',
      robots: 'index, follow, max-image-preview:large, max-snippet:-1',
      jsonLd: buildSeoLandingJsonLd(page)
    });
  }, [page]);

  if (!page) return null;

  const vehicles = getFactualVehiclesByIds(page.featuredVehicleIds);
  const relatedPages = page.relatedSlugs
    .map((slug) => SEO_LANDING_PAGE_BY_SLUG[slug])
    .filter((p): p is SeoLandingPageConfig => Boolean(p));
  const heroSrc = page.heroImageKey === 'highway' ? highwayFleetImg : operationsHubImg;

  const handlePrimaryAction = () => {
    if (page.audience === 'transporter') {
      onSwitchToPartner();
    } else {
      onOpenAuth('customer');
    }
  };

  return (
    <div className="w-full bg-[#F8F6F8] text-[#171318]">
      {/* Breadcrumb & Hero Section */}
      <section className="bg-[#171318] text-white border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigateSpa('/');
              }}
              className="hover:text-white transition-colors"
            >
              Home
            </a>
            <span aria-hidden="true">/</span>
            <span className="text-gray-200 font-medium">{page.shortLabel}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <p className="text-xs sm:text-sm font-semibold text-[#FF85B7] tracking-tight">
                  {page.eyebrow}
                </p>
                <h1
                  className="font-black text-white tracking-tight leading-[1.1] text-balance"
                  style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)' }}
                >
                  {page.h1}
                </h1>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-2xl">
                  {page.heroLead}
                </p>
              </div>

              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handlePrimaryAction}
                    className="px-6 py-3.5 rounded-xl bg-[#E83E83] hover:bg-[#D62D72] active:scale-[0.99] text-white text-sm font-bold inline-flex items-center gap-2 transition cursor-pointer whitespace-nowrap"
                  >
                    <span>{page.primaryCtaLabel}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>

                  <a
                    href={page.secondaryCtaPath}
                    onClick={(e) => {
                      e.preventDefault();
                      navigateSpa(page.secondaryCtaPath);
                    }}
                    className="px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-semibold inline-flex items-center gap-2 transition whitespace-nowrap"
                  >
                    <span>{page.secondaryCtaLabel}</span>
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-400">
                  <span>Direct Freight Bidding</span>
                  <span aria-hidden="true">·</span>
                  <span>Live GPS Tracking</span>
                  <span aria-hidden="true">·</span>
                  <span>OTP &amp; e-POD Confirmation</span>
                  <span aria-hidden="true">·</span>
                  <span>GST Invoicing</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col">
              <div className="relative flex-1 min-h-[240px] sm:min-h-[300px] rounded-3xl overflow-hidden border border-white/10 bg-[#231B25]">
                {!heroImgFailed ? (
                  <img
                    src={heroSrc}
                    alt={page.heroImageAlt}
                    width={960}
                    height={540}
                    loading="eager"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                    <Truck className="w-10 h-10 text-[#E83E83] mb-3" />
                    <p className="text-sm font-bold text-white">{page.shortLabel}</p>
                    <p className="text-xs text-gray-400 mt-1">Zuggi Commercial Freight Marketplace</p>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-5">
                  <p className="text-xs font-mono text-gray-300">
                    Service Focus: {page.areaServed.slice(0, 4).join(' · ')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-16">
        {/* Platform Capabilities Strip */}
        <section aria-label="Key platform capabilities">
          <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              {page.highlights.map((item, idx) => (
                <div
                  key={item.label}
                  className={`${idx > 0 ? 'pt-5 sm:pt-0 sm:pl-6 lg:pl-8' : ''} space-y-1.5`}
                >
                  <p className="text-sm font-extrabold text-[#171318]">{item.label}</p>
                  <p className="text-xs sm:text-sm text-[#5E5861] leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Deep Editorial Sections (H2 + H3) */}
        <section className="space-y-10">
          {page.sections.map((sec, secIdx) => (
            <div
              key={sec.heading}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start pb-10 border-b border-gray-200 last:border-b-0 last:pb-0"
            >
              <div className="lg:col-span-5 space-y-3">
                <p className="text-xs font-mono font-semibold text-[#E83E83]">
                  0{secIdx + 1}. Platform Operations
                </p>
                <h2 className="text-2xl sm:text-3xl font-black text-[#171318] tracking-tight text-balance">
                  {sec.heading}
                </h2>
                <p className="text-sm sm:text-base text-[#5E5861] leading-relaxed">{sec.intro}</p>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 gap-5">
                {sec.subsections.map((sub) => (
                  <article
                    key={sub.subheading}
                    className="bg-white rounded-2xl border border-gray-200 p-6 space-y-2"
                  >
                    <h3 className="text-base sm:text-lg font-extrabold text-[#171318]">
                      {sub.subheading}
                    </h3>
                    <p className="text-sm text-[#5E5861] leading-relaxed">{sub.body}</p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Step-by-Step Workflow */}
        <section className="space-y-6">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-[#171318] tracking-tight text-balance">
              {page.audience === 'transporter'
                ? 'How Transporters Find Loads & Receive Settlements on Zuggi'
                : 'Step-by-Step Freight Booking & Payment Workflow'}
            </h2>
            <p className="text-sm sm:text-base text-[#5E5861]">
              Every consignment follows a documented digital workflow from load posting through OTP-verified delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {page.workflowSteps.map((ws) => (
              <div
                key={ws.step}
                className="bg-white rounded-2xl border border-gray-200 p-6 space-y-2.5"
              >
                <span className="text-xs font-mono font-bold text-[#E83E83] tabular-nums">
                  Step {ws.step}
                </span>
                <h3 className="text-base font-extrabold text-[#171318]">{ws.title}</h3>
                <p className="text-xs sm:text-sm text-[#5E5861] leading-relaxed">{ws.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Supported Commercial Vehicle Categories */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-[#171318] tracking-tight text-balance">
                Supported Commercial Vehicle Categories
              </h2>
              <p className="text-sm sm:text-base text-[#5E5861]">
                Select the vehicle tier and body type that matches your cargo weight and route conditions. Final freight rates are quoted directly by transporters on your posted load.
              </p>
            </div>
            <a
              href="/fleet"
              onClick={(e) => {
                e.preventDefault();
                navigateSpa('/fleet');
              }}
              className="text-sm font-bold text-[#E83E83] hover:underline inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span>All 10 Vehicle Categories</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-[#F8F6F8] text-xs font-bold text-[#5E5861]">
                    <th className="py-3.5 px-5">Vehicle Category</th>
                    <th className="py-3.5 px-5">Payload Capacity</th>
                    <th className="py-3.5 px-5">Deck Dimensions</th>
                    <th className="py-3.5 px-5">Body Options</th>
                    <th className="py-3.5 px-5">Typical Commercial Cargo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-[#F8F6F8]/60 transition-colors">
                      <td className="py-4 px-5 font-bold text-[#171318] whitespace-nowrap">
                        <a
                          href={`/fleet/${v.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigateSpa(`/fleet/${v.id}`);
                          }}
                          className="hover:text-[#E83E83] transition-colors"
                        >
                          {v.name}
                        </a>
                      </td>
                      <td className="py-4 px-5 font-mono text-xs sm:text-sm font-semibold text-[#171318] tabular-nums whitespace-nowrap">
                        {v.capacityKg.toLocaleString('en-IN')} kg ({v.capacityTonnes} MT)
                      </td>
                      <td className="py-4 px-5 font-mono text-xs text-[#5E5861] tabular-nums whitespace-nowrap">
                        {v.dimensions}
                      </td>
                      <td className="py-4 px-5 text-xs text-[#5E5861]">
                        {v.bodyTypes.join(' · ')}
                      </td>
                      <td className="py-4 px-5 text-xs sm:text-sm text-[#5E5861]">
                        {v.idealFor}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Supported Corridors */}
        {page.featuredRoutes.length > 0 && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="max-w-2xl space-y-2">
                <h2 className="text-2xl sm:text-3xl font-black text-[#171318] tracking-tight text-balance">
                  Supported Highway Corridors
                </h2>
                <p className="text-sm sm:text-base text-[#5E5861]">
                  Published regional corridors currently supported inside Zuggi’s dispatch and bidding network.
                </p>
              </div>
              <a
                href="/corridors"
                onClick={(e) => {
                  e.preventDefault();
                  navigateSpa('/corridors');
                }}
                className="text-sm font-bold text-[#E83E83] hover:underline inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <span>View All Corridors</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {page.featuredRoutes.map((route) => {
                const routePath = route.corridorSlug ? `/corridors/${route.corridorSlug}` : '/corridors';
                return (
                  <article
                    key={`${route.origin}-${route.destination}`}
                    className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-3 text-xs text-[#5E5861]">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-[#171318]">
                          <Route className="w-3.5 h-3.5 text-[#E83E83]" />
                          {route.highway}
                        </span>
                        <span className="font-mono font-bold text-[#171318] tabular-nums shrink-0">
                          ~{route.distanceKm} km
                        </span>
                      </div>

                      <h3 className="text-lg font-extrabold text-[#171318]">
                        {route.origin} to {route.destination}
                      </h3>

                      <p className="text-xs sm:text-sm text-[#5E5861] leading-relaxed">
                        <strong className="text-[#171318]">Common cargo:</strong> {route.typicalCargo}
                      </p>

                      <p className="text-xs text-[#5E5861]">
                        <strong className="text-[#171318]">Suitable vehicles:</strong>{' '}
                        {route.suitableVehicles.join(' · ')}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                      <a
                        href={routePath}
                        onClick={(e) => {
                          e.preventDefault();
                          navigateSpa(routePath);
                        }}
                        className="text-xs font-bold text-[#E83E83] hover:underline inline-flex items-center gap-1"
                      >
                        <span>Inspect Route Details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={handlePrimaryAction}
                        className="text-xs font-bold text-[#171318] hover:text-[#E83E83] transition-colors cursor-pointer"
                      >
                        {page.audience === 'transporter' ? 'Bid on This Lane' : 'Post Load on This Lane'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Frequently Asked Questions (Matches FAQPage JSON-LD 1-to-1) */}
        <section className="space-y-6">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-[#171318] tracking-tight text-balance">
              Frequently Asked Questions
            </h2>
            <p className="text-sm sm:text-base text-[#5E5861]">
              Clear answers about booking trucks, pricing workflow, tracking, and onboarding on Zuggi.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 divide-y divide-gray-200 overflow-hidden">
            {page.faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={faq.question} className="p-5 sm:p-6">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 text-left cursor-pointer"
                  >
                    <h3 className="text-sm sm:text-base font-extrabold text-[#171318]">
                      {faq.question}
                    </h3>
                    <ChevronDown
                      className={`w-5 h-5 text-[#5E5861] shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#E83E83]' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-sm text-[#5E5861] leading-relaxed pr-6">
                      {faq.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Conversion Call-to-Action Block */}
        <section className="bg-[#171318] text-white rounded-3xl p-8 sm:p-10 border border-gray-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#FF85B7]">
              <ShieldCheck className="w-4 h-4" />
              <span>Zuggi Commercial Freight Marketplace</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-balance">
              {page.audience === 'transporter'
                ? 'Ready to bid on commercial truck loads directly?'
                : 'Ready to post your commercial load and compare direct bids?'}
            </h2>
            <p className="text-sm text-gray-300 leading-relaxed">
              {page.audience === 'transporter'
                ? 'Onboard your trucks and drivers through Zuggi Partner to view live freight requirements, submit direct quotes, and track bank settlements.'
                : 'Create a free shipper account to post loads, compare quotes from onboarded transporters, track trips live on GPS, and download GST invoices.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="px-6 py-3.5 rounded-xl bg-[#E83E83] hover:bg-[#D62D72] text-white text-sm font-bold inline-flex items-center gap-2 transition cursor-pointer whitespace-nowrap"
            >
              <span>{page.primaryCtaLabel}</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => (page.audience === 'transporter' ? onOpenAuth('customer') : onSwitchToPartner())}
              className="px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-semibold transition cursor-pointer whitespace-nowrap"
            >
              {page.audience === 'transporter' ? 'Shipper Portal' : 'Join as Transporter'}
            </button>
          </div>
        </section>

        {/* Related Regional & Freight Pages (Internal Link Graph) */}
        <section className="space-y-5">
          <h2 className="text-xl font-black text-[#171318]">Related Commercial Freight Guides</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {relatedPages.map((rel) => (
              <a
                key={rel.slug}
                href={rel.slug}
                onClick={(e) => {
                  e.preventDefault();
                  navigateSpa(rel.slug);
                }}
                className="bg-white rounded-2xl border border-gray-200 hover:border-[#E83E83] p-5 transition-colors flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-[#E83E83]">{rel.shortLabel}</p>
                  <h3 className="text-sm font-extrabold text-[#171318] leading-snug">{rel.h1}</h3>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#171318]">
                  <span>Read Guide</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#E83E83]" />
                </span>
              </a>
            ))}
          </div>
        </section>
      </div>

      {/* Consistent Site Footer With Complete Internal Linking */}
      <footer className="bg-[#171318] text-gray-300 border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-xs">
            <div className="space-y-2.5">
              <p className="text-base font-extrabold text-white">Zuggi</p>
              <p className="text-gray-400 leading-relaxed">
                Commercial freight marketplace connecting shippers directly with truck owners, drivers, and fleet operators across Assam, Northeast India, and Pan-India corridors.
              </p>
              <p className="text-gray-400 inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#E83E83] shrink-0" />
                <span>Guwahati, Assam, India</span>
              </p>
            </div>

            <div className="space-y-2.5">
              <p className="font-bold text-white">Freight Guides</p>
              <ul className="space-y-2 text-gray-400">
                {SEO_LANDING_PAGES.slice(0, 4).map((p) => (
                  <li key={p.slug}>
                    <a
                      href={p.slug}
                      onClick={(e) => {
                        e.preventDefault();
                        navigateSpa(p.slug);
                      }}
                      className="hover:text-white transition-colors"
                    >
                      {p.shortLabel}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2.5">
              <p className="font-bold text-white">Marketplace &amp; Routes</p>
              <ul className="space-y-2 text-gray-400">
                {SEO_LANDING_PAGES.slice(4).map((p) => (
                  <li key={p.slug}>
                    <a
                      href={p.slug}
                      onClick={(e) => {
                        e.preventDefault();
                        navigateSpa(p.slug);
                      }}
                      className="hover:text-white transition-colors"
                    >
                      {p.shortLabel}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    href="/freight"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateSpa('/freight');
                    }}
                    className="hover:text-white transition-colors"
                  >
                    Live Freight Listings
                  </a>
                </li>
                <li>
                  <a
                    href="/fleet"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateSpa('/fleet');
                    }}
                    className="hover:text-white transition-colors"
                  >
                    Commercial Vehicle Categories
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <p className="font-bold text-white">Company &amp; Policies</p>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a
                    href="/about"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateSpa('/about');
                    }}
                    className="hover:text-white transition-colors"
                  >
                    About Zuggi
                  </a>
                </li>
                <li>
                  <a
                    href="/contact"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateSpa('/contact');
                    }}
                    className="hover:text-white transition-colors"
                  >
                    Contact Dispatch Desk
                  </a>
                </li>
                <li>
                  <a
                    href="/privacy"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateSpa('/privacy');
                    }}
                    className="hover:text-white transition-colors"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href="/terms"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateSpa('/terms');
                    }}
                    className="hover:text-white transition-colors"
                  >
                    Terms &amp; Conditions
                  </a>
                </li>
                <li>
                  <a
                    href="/refund-policy"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateSpa('/refund-policy');
                    }}
                    className="hover:text-white transition-colors"
                  >
                    Refund Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
            <p>© {new Date().getFullYear()} Zuggi Commercial Goods Transportation. All rights reserved.</p>
            <p>support@zuggi.in · +91 96789 44132</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
