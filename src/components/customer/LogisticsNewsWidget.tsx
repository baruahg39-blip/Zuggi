import React, { useState, useEffect } from 'react';
import { 
  Fuel, 
  TrendingUp, 
  Globe, 
  RefreshCw, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  Truck, 
  Radio, 
  Sparkles, 
  MapPin, 
  Clock
} from 'lucide-react';

interface GroundingSource {
  title: string;
  uri: string;
}

interface LogisticsIntelligenceData {
  content: string;
  sources: GroundingSource[];
  timestamp: string;
  isLiveGrounded?: boolean;
}

export const LogisticsNewsWidget: React.FC = () => {
  const [data, setData] = useState<LogisticsIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntelligence = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/logistics-intelligence');
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        throw new Error(json.error || 'Failed to retrieve logistics intelligence');
      }
    } catch (err: any) {
      console.error('Failed to load logistics intelligence:', err);
      setError(err.message || 'Unable to fetch latest intelligence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntelligence();
  }, []);

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden space-y-4">
      {/* Widget Header */}
      <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
            <Fuel className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Northeast Freight & Fuel Intelligence</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800 text-[10px] font-bold">
                <Globe className="w-3 h-3" />
                <span>Google Search Grounded</span>
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live commercial diesel price trends, highway corridor conditions, and freight advisories
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {data?.timestamp && (
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{new Date(data.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </span>
          )}
          <button
            onClick={fetchIntelligence}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-50"
            title="Refresh Intelligence"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Fuel Quick Glance Ticker */}
      <div className="px-5 pt-1">
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Guwahati (Kamrup)</span>
            <div className="font-mono font-bold text-amber-400 text-sm">₹90.35 / L</div>
            <span className="text-[10px] text-emerald-400 font-medium">Diesel (Commercial)</span>
          </div>

          <div className="space-y-0.5 border-l border-slate-800/80 pl-3">
            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Shillong (Meghalaya)</span>
            <div className="font-mono font-bold text-emerald-400 text-sm">₹87.80 / L</div>
            <span className="text-[10px] text-emerald-400 font-medium">Low Tax Slab</span>
          </div>

          <div className="space-y-0.5 border-l border-slate-800/80 pl-3">
            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Silchar (Barak Valley)</span>
            <div className="font-mono font-bold text-slate-200 text-sm">₹90.85 / L</div>
            <span className="text-[10px] text-slate-400 font-medium">Diesel</span>
          </div>

          <div className="space-y-0.5 border-l border-slate-800/80 pl-3">
            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Dimapur (Nagaland)</span>
            <div className="font-mono font-bold text-amber-400 text-sm">₹91.10 / L</div>
            <span className="text-[10px] text-slate-400 font-medium">Diesel</span>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="px-5 pb-5 space-y-4">
        {loading ? (
          <div className="p-8 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 text-amber-400 animate-pulse">
              <Globe className="w-6 h-6 animate-spin" />
            </div>
            <div className="text-xs text-slate-300 font-semibold">
              Grounding latest logistics intelligence via Google Search...
            </div>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Scanning live fuel price feeds, NHAI highway advisories, and freight reports for Assam & Northeast India.
            </p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">Unable to fetch live intelligence feed</div>
              <p className="text-[11px] text-rose-300">{error}</p>
              <button
                onClick={fetchIntelligence}
                className="mt-2 text-xs text-amber-300 font-semibold hover:underline"
              >
                Retry
              </button>
            </div>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Formatted Markdown briefing */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 leading-relaxed space-y-3">
              {data.content.split('\n\n').map((paragraph, idx) => {
                // Check if heading
                if (paragraph.startsWith('### ') || paragraph.startsWith('## ')) {
                  return (
                    <h4 key={idx} className="font-bold text-amber-300 text-sm pt-1 border-t border-slate-800/60 first:border-0 first:pt-0">
                      {paragraph.replace(/^#+\s*/, '')}
                    </h4>
                  );
                }
                // Bullet points
                if (paragraph.includes('\n- ') || paragraph.startsWith('- ')) {
                  const items = paragraph.split('\n').filter((l) => l.trim().startsWith('-'));
                  return (
                    <ul key={idx} className="space-y-1.5 pl-1">
                      {items.map((item, iIdx) => (
                        <li key={iIdx} className="flex items-start gap-2 text-slate-300">
                          <span className="text-amber-400 text-xs mt-0.5">•</span>
                          <span>
                            {item.replace(/^-\s*/, '').split('**').map((part, pIdx) =>
                              pIdx % 2 === 1 ? <strong key={pIdx} className="text-white font-semibold">{part}</strong> : part
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  );
                }
                return (
                  <p key={idx} className="text-slate-300">
                    {paragraph}
                  </p>
                );
              })}
            </div>

            {/* Grounded Web Sources and Citations */}
            {data.sources && data.sources.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Grounding Sources & Official Portals
                </span>
                <div className="flex flex-wrap gap-2">
                  {data.sources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-amber-300 text-[11px] font-medium transition cursor-pointer"
                    >
                      <span>{src.title}</span>
                      <ExternalLink className="w-3 h-3 text-slate-500" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
