import React, { useState } from 'react';
import { Megaphone, X, ExternalLink, ShieldCheck } from 'lucide-react';

interface AdBannerProps {
  position: 'top' | 'middle' | 'bottom';
}

export const AdBanner: React.FC<AdBannerProps> = ({ position }) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  if (position === 'top') {
    return (
      <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-b border-amber-200/80 px-4 py-2 text-xs text-amber-900 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
              प्रायोजित
            </span>
            <Megaphone className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span className="font-medium text-amber-950">
              नेपाल कानुन आयोग तथा भू-सूचना प्रणाली तालिम कार्यक्रम २०८२/८३ — अधिकृत स्तरका लागि नयाँ भर्ना खुला।
            </span>
            <a
              href="#ad-info"
              onClick={e => e.preventDefault()}
              className="inline-flex items-center gap-1 text-amber-700 font-semibold underline underline-offset-2 hover:text-amber-900 ml-1"
            >
              थप जानकारी <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-700/70 hover:text-amber-950 p-1 rounded hover:bg-amber-100 transition-colors"
            title="विज्ञापन बन्द गर्नुहोस्"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (position === 'middle') {
    return (
      <div className="my-6 p-4 rounded-xl border border-blue-200/70 bg-gradient-to-r from-blue-50/60 via-slate-50 to-blue-50/60 shadow-xs relative overflow-hidden">
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
            विज्ञापन स्थान (Reserved Ad Slot)
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-slate-600 p-0.5"
            title="बन्द गर्नुहोस्"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              नेपाली कानुनी सफ्टवेयर तथा डिजिटल मिसिल व्यवस्थापन सुइट
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              मालपोत, नापी र स्थानीय तहका लागि पूर्ण डिजिटलाइज्ड अभिलेख, कित्ताकाट प्रमाणीकरण र अनलाइन रोक्का/फुकुवा व्यवस्था।
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <footer className="mt-8 pt-4 pb-6 border-t border-slate-200 text-center text-xs text-slate-500 bg-white/60">
      <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="text-[10px] font-bold text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">
            विज्ञापन
          </span>
          <span>डिजिटल नेपाल फ्रेमवर्क — कानुनी तथा प्रशासनिक अभिलेखीकरण परियोजना</span>
        </div>
        <div className="text-slate-400 text-[11px]">
          नेपाली कानुनी PDF सहायक © २०८२ | सुरक्षित र तीव्र स्थानीय खोज प्रणाली
        </div>
      </div>
    </footer>
  );
};
