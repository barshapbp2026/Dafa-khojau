import React, { useState } from 'react';
import { BookOpen, Scale, Sparkles, Database, FileText, Info, CheckCircle2 } from 'lucide-react';
import { IndexStats } from '../types';

interface HeaderProps {
  stats: IndexStats | null;
  mode: 'single' | 'multiple';
  onModeChange: (mode: 'single' | 'multiple') => void;
  geminiActive: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  mode,
  onModeChange,
  geminiActive
}) => {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <header className="bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3.5 gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-crimson-800 to-red-600 flex items-center justify-center text-white shadow-sm ring-2 ring-red-100 shrink-0" style={{ backgroundColor: '#8B0000' }}>
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  नेपाली कानुनी PDF सहायक
                </h1>
                <span className="text-[11px] font-semibold bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 rounded-full">
                  v2.5 Pro
                </span>
                {geminiActive && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    AI सक्रिय
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                नेपाली कानुनी तथा प्रशासनिक PDF खोज प्रणाली — दफा, नियम, धारा, निर्देशन, अनुसूची, शब्द खोज र Gemini AI
              </p>
            </div>
          </div>

          {/* Quick Actions & Mode Switcher */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Mode Selector */}
            <div className="bg-slate-100 p-1 rounded-lg flex items-center text-xs font-semibold">
              <button
                onClick={() => onModeChange('single')}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  mode === 'single'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                एकल PDF खोज (Single)
              </button>
              <button
                onClick={() => onModeChange('multiple')}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  mode === 'multiple'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                बहु-फोल्डर खोज (Multiple)
              </button>
            </div>

            {/* Help Guide Button */}
            <button
              onClick={() => setShowGuide(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-md transition-colors"
              title="प्रणाली गाइड तथा परीक्षण विवरण"
            >
              <Info className="w-3.5 h-3.5 text-slate-600" />
              <span>प्रणाली जानकारी</span>
            </button>
          </div>
        </div>

        {/* Live Status Stats Bar */}
        {stats && (
          <div className="py-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>लोड गरिएका PDF: <strong>{stats.totalIndexedPdfs}</strong></span>
              </span>
              <span>•</span>
              <span>कुल पृष्ठ: <strong>{stats.totalPagesIndexed}</strong></span>
              <span>•</span>
              <span>इन्डेक्स दफा: <strong>{stats.totalDafas}</strong></span>
              <span>•</span>
              <span>इन्डेक्स अनुसूची: <strong>{stats.totalAnusuchis}</strong></span>
              <span>•</span>
              <span>हेडर शब्द सूची: <strong>{stats.totalSabdaHeaders}</strong></span>
            </div>
            <div className="text-[11px] text-slate-400">
              स्थानीय खोज प्रणाली (Zero-Gemini Dependency)
            </div>
          </div>
        )}
      </div>

      {/* Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-red-800" />
                <h3 className="text-lg font-bold text-slate-900">
                  नेपाली कानुनी PDF सहायक — प्रयोगकर्ता गाइड
                </h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                <h4 className="font-bold text-red-950 mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-600 inline-block"></span>
                  स्थानीय खोज स्वतन्त्रता (Local Search Guarantee)
                </h4>
                <p className="text-xs text-red-900">
                  यो प्रणाली Gemini API Key नभए पनि १००% चल्छ। दफा, नियम, धारा, निर्देशन, अनुसूची र शब्द खोज स्थानीय इन्जिनमा तत्काल सम्पन्न हुन्छ।
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1.5">१. दफा, नियम, धारा र निर्देशन खोज</h4>
                <p className="text-xs text-slate-600">
                  संख्यात्मक हेडर मात्र पहिचान गरिन्छ (जस्तै: <code className="bg-slate-100 px-1 py-0.5 rounded text-red-700">२२२</code> वा <code className="bg-slate-100 px-1 py-0.5 rounded text-red-700">222</code>)। बडी टेक्स्टमा भएका उपदफा जस्तै "(१)" वा "(२)" लाई हेडर मानिँदैन।
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1.5">२. अनुसूची खोज (Reverse Scan)</h4>
                <p className="text-xs text-slate-600">
                  नेपाली कानुनमा अनुसूची कागजातको अन्त्यमा रहने भएकाले प्रणालीले पछिल्लो पृष्ठ (e.g. पृष्ठ ४५३) बाट पछाडि स्क्यान गर्छ। यसले गर्दा बडी टेक्स्टमा उल्लेख गरिएका सन्दर्भहरू नझुक्किई वास्तविक अनुसूची १ देखि ६३ सम्म तुरुन्त फेला पार्छ।
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1.5">३. शब्द खोज (Header Only Search)</h4>
                <p className="text-xs text-slate-600">
                  शब्द खोजले कुनै पनि हालतमा बडी टेक्स्ट खोज्दैन! यसले दफा र नियमका शीर्षक (Header) मा मात्र खोज्छ। जस्तै: <code className="bg-slate-100 px-1 py-0.5 rounded text-red-700">टायल चेक</code> खोज्दा दफा २२२ को हेडर "नक्सा अनुसार क्षेत्रफल संशोधन (टायल चेक) गर्नेः" सिधै फेला पर्छ।
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1.5">४. PDF भ्यूअर र Dark Red Highlight</h4>
                <p className="text-xs text-slate-600">
                  खोज नतिजामा क्लिक गर्दा सम्बन्धित PDF को तोकिएको पृष्ठ खुल्छ र भेटिएको हेडर लाइन ठ्याक्कै <strong>Dark Red (#8B0000)</strong> रङ्गमा हाइलाइट हुन्छ।
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1.5">५. Gemini AI सहायक (ऐच्छिक)</h4>
                <p className="text-xs text-slate-600">
                  तपाईंले आफ्नो Google Gemini API Key परीक्षण गरी सक्रिय गरेपछि कागजात भित्र RAG विश्लेषण र इन्टरनेट मार्फत पछिल्ला राजपत्र संशोधनहरूसँग तुलनात्मक खोज गर्न सक्नुहुन्छ।
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                बुझें, बन्द गर्नुहोस्
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
