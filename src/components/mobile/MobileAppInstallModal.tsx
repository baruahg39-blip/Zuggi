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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Smartphone className="w-5 h-5 text-slate-950" />
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
        <div className="flex items-center gap-1 p-2 bg-slate-950/60 border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('phone')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${
              activeTab === 'phone'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Install on Android Phone</span>
          </button>

          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${
              activeTab === 'qr'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Scan Phone QR</span>
          </button>

          <button
            onClick={() => setActiveTab('apk_guide')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${
              activeTab === 'apk_guide'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Build Standalone APK</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-slate-200">
          {/* TAB 1: PHONE INSTALL (NATIVE WEBAPK) */}
          {activeTab === 'phone' && (
            <div className="space-y-4">
              {isInstalled ? (
                <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-white text-sm">App Already Installed!</h4>
                  <p className="text-xs text-emerald-300/80">
                    You are already using Zuggi in standalone mobile app mode.
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                        <Truck className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">Zuggi Mobile WebAPK</h4>
                        <p className="text-xs text-slate-400">
                          Full screen, offline GPS cache, launcher icon, no browser URL bar
                        </p>
                      </div>
                    </div>

                    {isInstallable ? (
                      <button
                        onClick={handleDirectInstall}
                        disabled={installing}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer active:scale-98"
                      >
                        <Download className="w-4 h-4" />
                        <span>{installing ? 'Opening Android Installer...' : 'Tap to Install Directly on This Phone'}</span>
                      </button>
                    ) : (
                      <div className="text-xs text-slate-300 space-y-2 pt-1 border-t border-slate-800">
                        <span className="font-semibold text-amber-400 block">
                          How to install on any Android phone right now:
                        </span>
                        <ol className="list-decimal list-inside space-y-1.5 text-slate-400 text-[11px] leading-relaxed">
                          <li>Open this URL in Google Chrome or Samsung Internet on your phone.</li>
                          <li>Tap the <strong className="text-slate-200">Three Dots Menu (⋮)</strong> at top right.</li>
                          <li>Select <strong className="text-amber-400">"Install app"</strong> or <strong className="text-amber-400">"Add to Home screen"</strong>.</li>
                          <li>Android will build and install the native <strong className="text-slate-200">Zuggi WebAPK</strong> with full app permissions!</li>
                        </ol>
                      </div>
                    )}
                  </div>

                  {/* App Link Box */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      App Link (Open on your mobile)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={appUrl}
                        className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 focus:outline-none select-all"
                      />
                      <button
                        onClick={handleCopyUrl}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 transition"
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
              <div className="inline-block p-4 bg-slate-950 border border-slate-800 rounded-2xl shadow-xl">
                <img
                  src={qrCodeImgUrl}
                  alt="Zuggi Mobile Install QR Code"
                  className="w-48 h-48 mx-auto rounded-lg"
                />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h4 className="font-bold text-white text-sm">Scan with Phone Camera</h4>
                <p className="text-xs text-slate-400">
                  Point your Android camera at the QR code above. It will instantly open the app in Chrome, where you can tap "Install App" to download it.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: STANDALONE APK BUILD GUIDE */}
          {activeTab === 'apk_guide' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-amber-400 block">Package as Signed Android APK / AAB</span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Because this is an active cloud web application with compliant Web App Manifest and Service Worker, you can generate a signed standalone <code className="text-amber-300 font-mono">.apk</code> file for sideloading or Google Play Store in 2 ways:
                  </p>
                </div>
              </div>

              {/* Method A: PWABuilder (Zero Code 1-Click APK Generator) */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-[10px]">1</span>
                    Method 1: PWABuilder (Instant APK Download)
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Recommended
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Go to Microsoft/Google's free tool <strong className="text-slate-200">PWABuilder.com</strong>, paste your live app URL, and click <strong className="text-amber-400">"Package for Android"</strong> to download a ready-to-install <code className="text-amber-300 font-mono">.apk</code> file.
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <a
                    href={`https://www.pwabuilder.com/?url=${encodeURIComponent(appUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition"
                  >
                    <span>Open PWABuilder Analysis (/partner)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <a
                    href="/manifest-partner.json"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs transition border border-slate-700"
                  >
                    <span>View /manifest-partner.json</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Hosting & 403 / 503 Diagnostic Advisory */}
                <div className="mt-3 p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-1.5">
                  <div className="font-bold text-amber-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Important: Why PWABuilder cloud crawler may show HTTP 403 / 503</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    AI Studio preview URLs (<code className="text-amber-300 font-mono">ais-pre-...run.app</code>) are protected behind Google Cloud Run authentication by default. External cloud crawlers (like PWABuilder's US/EU test bots) do not have your Google login cookies and receive HTTP 403 Forbidden from Cloud Run.
                  </p>
                  <p className="text-emerald-400 font-semibold">
                    ✓ On your Android phone, Chrome is already authenticated: you can tap Chrome menu (⋮) → &quot;Install app&quot; to install it immediately right now!
                  </p>
                </div>
              </div>

              {/* Method B: Bubblewrap CLI */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 font-bold flex items-center justify-center text-[10px]">2</span>
                    Method 2: Google Bubblewrap CLI (Command Line)
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  If packaging on a PC or CI/CD server, build your APK using the public manifest:
                </p>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-amber-300 space-y-1 select-all">
                  <div>npm i -g @bubblewrap/cli</div>
                  <div>bubblewrap init --manifest={manifestUrl}</div>
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
