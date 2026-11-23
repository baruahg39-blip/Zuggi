import React, { useEffect } from 'react';
import { ArrowLeft, ArrowRight, Compass } from 'lucide-react';
import { SEO_LANDING_PAGES } from '../../data/seoLandingPages';
import { applyClientSeo, navigateSpa } from '../../utils/seo';

interface NotFoundViewProps {
  pathname: string;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({ pathname }) => {
  useEffect(() => {
    applyClientSeo({
      title: 'Page Not Found (404) | Zuggi Commercial Freight',
      description:
        'The requested page could not be found on Zuggi.in. Explore commercial truck booking, Assam freight corridors, vehicle categories, and live freight listings.',
      canonicalPath: pathname || '/404',
      ogType: 'website',
      robots: 'noindex, follow',
      jsonLd: null
    });
  }, [pathname]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 space-y-10">
      <div className="bg-white rounded-3xl border border-gray-200 p-8 sm:p-12 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-[#FFF0F6] text-[#E83E83] flex items-center justify-center mx-auto">
          <Compass className="w-7 h-7" />
        </div>

        <p className="text-xs font-mono font-bold text-[#E83E83] tracking-wider">HTTP 404</p>
        <h1 className="text-3xl sm:text-4xl font-black text-[#171318] tracking-tight text-balance">
          This route does not exist on Zuggi
        </h1>
        <p className="text-sm sm:text-base text-[#5E5861] max-w-xl mx-auto leading-relaxed">
          The page <span className="font-mono text-[#171318] font-semibold">{pathname}</span> may have been moved or typed incorrectly. Use one of the links below to return to Zuggi’s commercial freight marketplace.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigateSpa('/');
            }}
            className="px-6 py-3 rounded-xl bg-[#E83E83] hover:bg-[#D62D72] text-white text-sm font-bold inline-flex items-center gap-2 transition whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </a>
          <a
            href="/freight"
            onClick={(e) => {
              e.preventDefault();
              navigateSpa('/freight');
            }}
            className="px-6 py-3 rounded-xl bg-[#171318] hover:bg-black text-white text-sm font-bold inline-flex items-center gap-2 transition whitespace-nowrap"
          >
            <span>Live Freight Listings</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-extrabold text-[#171318]">Popular Commercial Freight Pages</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {SEO_LANDING_PAGES.map((page) => (
            <a
              key={page.slug}
              href={page.slug}
              onClick={(e) => {
                e.preventDefault();
                navigateSpa(page.slug);
              }}
              className="bg-white rounded-2xl border border-gray-200 hover:border-[#E83E83] p-4 transition-colors flex items-center justify-between gap-2 text-sm font-bold text-[#171318]"
            >
              <span>{page.shortLabel}</span>
              <ArrowRight className="w-4 h-4 text-[#E83E83] shrink-0" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
};
