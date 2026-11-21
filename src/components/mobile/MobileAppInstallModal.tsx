import React, { useState } from 'react';
import { 
  X, 
  Smartphone, 
  Download, 
  QrCode, 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  Terminal, 
  ShieldCheck, 
  Sparkles, 
  Truck,
  ArrowRight
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface MobileAppInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileAppInstallModal: React.FC<MobileAppInstallModalProps> = ({
  isOpen,
  onClose
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'phone' | 'apk_guide' | 'qr'>('phone');
  const [copied, setCopied] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Partner Mobile App URL (/partner) for Drivers & Fleet Owners (Play Store / Android WebAPK)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-3lhuvg5pct5dqbiwvwz2n7-107520742274.asia-southeast1.run.app';
  const appUrl = `${origin}/partner`;
  const manifestUrl = `${origin}/manifest-partner.json`;

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDirectInstall = async () => {
    setInstalling(true);
    try {
      await install();
    } finally {
      setInstalling(false);
    }
  };

  // Generate QR code URL via high quality QR service
  const qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(appUrl)}&bgcolor=020617&color=fbbf24&margin=1`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh]">
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#060309] border border-white/15 overflow-hidden flex items-center justify-center shadow-lg shadow-[#E83E83]/25 shrink-0">
              <img
                src="/assets/aistudio/Zuggi_Pink_Delivery_Logo_bf3220a3.png"
                alt="Zuggi App Icon"
                className="w-full h-full object-contain p-0.5"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">Install Zuggi Partner App</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold uppercase">
                  Driver & Fleet APK
                </span>
              </div>
              <p className="text-xs text-slate-400">Dedicated Driver & Fleet Owner mobile app for Play Store / Android</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-2 bg-[#171318] border-b border-gray-800 text-xs">
          <button
            onClick={() => setActiveTab('phone')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${
              activeTab === 'phone'
                ? 'bg-[#E83E83] text-white shadow-md font-bold'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Install on Phone</span>
          </button>

          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${
              activeTab === 'qr'
                ? 'bg-[#E83E83] text-white shadow-md font-bold'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Scan Phone QR</span>
          </button>

          <button
            onClick={() => setActiveTab('apk_guide')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${
              activeTab === 'apk_guide'
                ? 'bg-[#E83E83] text-white shadow-md font-bold'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Play Store APK</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-slate-200">
          {/* TAB 1: PHONE INSTALL (ANDROID & iOS) */}
          {activeTab === 'phone' && (
            <div className="space-y-4">
              {isInstalled ? (
                <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-white text-sm">Zuggi Partner App Already Installed!</h4>
                  <p className="text-xs text-emerald-300/80">
                    You are already using Zuggi Partner in standalone mobile app mode.
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-[#060309] border border-gray-800 rounded-2xl space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#060309] border border-white/15 overflow-hidden flex items-center justify-center shrink-0">
                        <img
                          src="/assets/aistudio/Zuggi_Pink_Delivery_Logo_bf3220a3.png"
                          alt="Zuggi Partner Icon"
                          className="w-full h-full object-contain p-0.5"
                        />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">Zuggi Partner Mobile App</h4>
                        <p className="text-xs text-gray-400">
                          Full screen, live GPS tracking, camera POD upload, instant launcher icon
                        </p>
                      </div>
                    </div>

                    {isInstallable ? (
                      <button
                        onClick={handleDirectInstall}
                        disabled={installing}
                        className="w-full py-3 bg-[#E83E83] hover:bg-[#d62e73] text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#E83E83]/25 cursor-pointer active:scale-98"
                      >
                        <Download className="w-4 h-4" />
                        <span>{installing ? 'Opening Installer...' : 'Tap to Install Zuggi Partner App'}</span>
                      </button>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-800 text-xs">
                        <div className="space-y-1.5">
                          <span className="font-bold text-[#FF85B7] block">
                            Android (Chrome)
                          </span>
                          <ol className="list-decimal list-inside space-y-1 text-gray-300 text-[11px] leading-relaxed">
                            <li>Open <strong className="text-white">zuggi.in/partner</strong> in Chrome.</li>
                            <li>Tap the <strong className="text-white">Three Dots (⋮)</strong> at top right.</li>
                            <li>Tap <strong className="text-[#FF85B7]">&quot;Install app&quot;</strong> or <strong className="text-[#FF85B7]">&quot;Add to Home screen&quot;</strong>.</li>
                          </ol>
                        </div>
                        <div className="space-y-1.5 sm:border-l sm:border-gray-800 sm:pl-3">
                          <span className="font-bold text-sky-400 block">
                            iPhone / iPad (Safari)
                          </span>
                          <ol className="list-decimal list-inside space-y-1 text-gray-300 text-[11px] leading-relaxed">
                            <li>Open <strong className="text-white">zuggi.in/partner</strong> in Safari.</li>
                            <li>Tap the <strong className="text-white">Share</strong> button at the bottom.</li>
                            <li>Scroll down &amp; tap <strong className="text-sky-400">&quot;Add to Home Screen&quot;</strong>.</li>
                          </ol>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* App Link Box */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                      Partner App Link (Share with Drivers &amp; Fleet Owners)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={appUrl}
                        className="flex-1 px-3 py-2 bg-[#060309] border border-gray-800 rounded-xl text-xs font-mono text-gray-300 focus:outline-none select-all"
                      />
                      <button
                        onClick={handleCopyUrl}
                        className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 transition"
                      >
                        {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: QR CODE */}
          {activeTab === 'qr' && (
            <div className="text-center space-y-4">
              <div className="inline-block p-4 bg-[#060309] border border-gray-800 rounded-2xl shadow-xl">
                <img
                  src={qrCodeImgUrl}
                  alt="Zuggi Mobile Install QR Code"
                  className="w-48 h-48 mx-auto rounded-lg"
                />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h4 className="font-bold text-white text-sm">Scan with Driver&apos;s Phone Camera</h4>
                <p className="text-xs text-gray-400">
                  Point any Android or iPhone camera at this QR code to open the Zuggi Partner App directly and install it on the home screen.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: STANDALONE APK / PLAY STORE GUIDE */}
          {activeTab === 'apk_guide' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-[#E83E83]/10 border border-[#E83E83]/30 rounded-xl flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-[#FF85B7] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-[#FF85B7] block">Package as Signed Google Play Store APK / AAB</span>
                  <p className="text-gray-300 text-[11px] leading-relaxed">
                    Your live site <code className="text-white font-mono">https://zuggi.in/partner</code> serves a dedicated Partner Web App Manifest, maskable app icon, service worker, and Digital Asset Links endpoint (<code className="text-white font-mono">/.well-known/assetlinks.json</code>) ready for Google Play Store Trusted Web Activity (TWA).
                  </p>
                </div>
              </div>

              {/* Method A: PWABuilder (Zero Code 1-Click APK Generator) */}
              <div className="p-3.5 bg-[#060309] border border-gray-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#E83E83] text-white font-bold flex items-center justify-center text-[10px]">1</span>
                    Method 1: PWABuilder (Instant Play Store .AAB &amp; .APK)
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    No Coding
                  </span>
                </div>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Open <strong className="text-white">PWABuilder.com</strong> with your live domain <code className="text-[#FF85B7] font-mono">https://zuggi.in/partner</code> and click <strong className="text-[#FF85B7]">&quot;Package For Stores → Android&quot;</strong> to download a signed <code className="text-white font-mono">.aab</code> (for Play Store) and <code className="text-white font-mono">.apk</code> (for direct install).
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <a
                    href="https://www.pwabuilder.com/?url=https%3A%2F%2Fzuggi.in%2Fpartner"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E83E83] hover:bg-[#d62e73] text-white font-bold rounded-lg text-xs transition"
                  >
                    <span>Package zuggi.in/partner on PWABuilder</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <a
                    href="/manifest-partner.json"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold rounded-lg text-xs transition border border-gray-700"
                  >
                    <span>View /manifest-partner.json</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Method B: Bubblewrap CLI */}
              <div className="p-3.5 bg-[#060309] border border-gray-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-gray-800 text-gray-200 font-bold flex items-center justify-center text-[10px]">2</span>
                    Method 2: Google Bubblewrap CLI (Play Store TWA)
                  </span>
                </div>
                <p className="text-gray-400 text-[11px]">
                  After building, copy your signing SHA-256 fingerprint into Render env var <code className="text-[#FF85B7] font-mono">ANDROID_TWA_SHA256_FINGERPRINT</code> to remove the browser bar completely:
                </p>
                <div className="bg-gray-900 p-2.5 rounded-lg border border-gray-800 font-mono text-[11px] text-[#FF85B7] space-y-1 select-all">
                  <div>npm i -g @bubblewrap/cli</div>
                  <div>bubblewrap init --manifest=https://zuggi.in/manifest-partner.json</div>
                  <div>bubblewrap build</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Standard Android WebAPK & TWA Compatible</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
