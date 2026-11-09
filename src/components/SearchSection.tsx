import React, { useState } from 'react';
import { Search, Hash, FileText, Layers, Bookmark, BookOpen, Sparkles, X, ArrowRight } from 'lucide-react';
import { SearchType } from '../types';

interface SearchSectionProps {
  onSearch: (type: SearchType, query: string) => void;
  isSearching: boolean;
  activeType: SearchType | null;
  mode: 'single' | 'multiple';
}

export const SearchSection: React.FC<SearchSectionProps> = ({
  onSearch,
  isSearching,
  activeType,
  mode
}) => {
  // 6 independent inputs state
  const [dafaQuery, setDafaQuery] = useState('');
  const [niyamQuery, setNiyamQuery] = useState('');
  const [dharaQuery, setDharaQuery] = useState('');
  const [nirdeshanQuery, setNirdeshanQuery] = useState('');
  const [anusuchiQuery, setAnusuchiQuery] = useState('');
  const [sabdaQuery, setSabdaQuery] = useState('');

  const handleExecute = (type: SearchType, val: string) => {
    if (!val.trim()) return;
    onSearch(type, val.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: SearchType, val: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleExecute(type, val);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 sm:p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Search className="w-4 h-4 text-red-800" />
            <span>
              {mode === 'single'
                ? 'एकल कागजात खोज बाकसहरू (६ वटा स्वतन्त्र इनपुट)'
                : 'बहु-फोल्डर खोज बाकसहरू (६ वटा स्वतन्त्र इनपुट)'}
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            प्रत्येक बाकस पूर्ण रूपमा स्वतन्त्र छ। नम्बर वा शब्द प्रविष्ट गरी खोज्नुहोस्।
          </p>
        </div>

        {/* Quick test pills */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-slate-400 font-semibold text-[11px]">द्रुत परीक्षण:</span>
          <button
            onClick={() => {
              setDafaQuery('२२२');
              handleExecute('dafa', '२२२');
            }}
            className="px-2 py-0.5 bg-red-50 text-red-800 border border-red-200 rounded text-[11px] font-semibold hover:bg-red-100 transition-colors"
          >
            दफा २२२ (टायल चेक)
          </button>
          <button
            onClick={() => {
              setAnusuchiQuery('१');
              handleExecute('anusuchi', '१');
            }}
            className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-[11px] font-semibold hover:bg-slate-200 transition-colors"
          >
            अनुसूची १
          </button>
          <button
            onClick={() => {
              setAnusuchiQuery('६३');
              handleExecute('anusuchi', '६३');
            }}
            className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-[11px] font-semibold hover:bg-slate-200 transition-colors"
          >
            अनुसूची ६३
          </button>
          <button
            onClick={() => {
              setSabdaQuery('टायल चेक');
              handleExecute('sabda', 'टायल चेक');
            }}
            className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded text-[11px] font-semibold hover:bg-amber-100 transition-colors"
          >
            शब्द: टायल चेक (Header)
          </button>
        </div>
      </div>

      {/* 6 Independent Search Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {/* 1. दफा खोज */}
        <div className={`p-3 rounded-lg border transition-all ${
          activeType === 'dafa' ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-red-700" />
              १. दफा खोज (Dafa)
            </label>
            <span className="text-[10px] text-slate-400">उदा. २२२, १, २२२क</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="दफा नं. (उदा. २२२ वा 222)"
                value={dafaQuery}
                onChange={e => setDafaQuery(e.target.value)}
                onKeyDown={e => handleKeyDown(e, 'dafa', dafaQuery)}
                className="w-full text-xs sm:text-sm bg-white border border-slate-300 rounded-md px-2.5 py-1.5 pr-6 text-slate-800 focus:ring-1 focus:ring-red-700 focus:border-red-700 outline-none"
              />
              {dafaQuery && (
                <button
                  onClick={() => setDafaQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              onClick={() => handleExecute('dafa', dafaQuery)}
              disabled={isSearching || !dafaQuery.trim()}
              className="px-3 py-1.5 bg-red-900 text-white font-bold rounded-md text-xs hover:bg-red-950 disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1"
              style={{ backgroundColor: '#8B0000' }}
            >
              {isSearching && activeType === 'dafa' ? '...' : 'खोज्नुहोस्'}
            </button>
          </div>
        </div>

        {/* 2. नियम खोज */}
        <div className={`p-3 rounded-lg border transition-all ${
          activeType === 'niyam' ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-700" />
              २. नियम खोज (Niyam)
            </label>
            <span className="text-[10px] text-slate-400">उदा. १५, २७, 15</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="नियम नं. (उदा. १५ वा 15)"
                value={niyamQuery}
                onChange={e => setNiyamQuery(e.target.value)}
                onKeyDown={e => handleKeyDown(e, 'niyam', niyamQuery)}
                className="w-full text-xs sm:text-sm bg-white border border-slate-300 rounded-md px-2.5 py-1.5 pr-6 text-slate-800 focus:ring-1 focus:ring-red-700 focus:border-red-700 outline-none"
              />
              {niyamQuery && (
                <button
                  onClick={() => setNiyamQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              onClick={() => handleExecute('niyam', niyamQuery)}
              disabled={isSearching || !niyamQuery.trim()}
              className="px-3 py-1.5 bg-red-900 text-white font-bold rounded-md text-xs hover:bg-red-950 disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1"
              style={{ backgroundColor: '#8B0000' }}
            >
              {isSearching && activeType === 'niyam' ? '...' : 'खोज्नुहोस्'}
            </button>
          </div>
        </div>

        {/* 3. धारा खोज */}
        <div className={`p-3 rounded-lg border transition-all ${
          activeType === 'dhara' ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-amber-700" />
              ३. धारा खोज (Dhara)
            </label>
            <span className="text-[10px] text-slate-400">संविधान / ऐन धारा</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="धारा नं. (उदा. १७ वा 17)"
                value={dharaQuery}
                onChange={e => setDharaQuery(e.target.value)}
                onKeyDown={e => handleKeyDown(e, 'dhara', dharaQuery)}
                className="w-full text-xs sm:text-sm bg-white border border-slate-300 rounded-md px-2.5 py-1.5 pr-6 text-slate-800 focus:ring-1 focus:ring-red-700 focus:border-red-700 outline-none"
              />
              {dharaQuery && (
                <button
                  onClick={() => setDharaQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              onClick={() => handleExecute('dhara', dharaQuery)}
              disabled={isSearching || !dharaQuery.trim()}
              className="px-3 py-1.5 bg-red-900 text-white font-bold rounded-md text-xs hover:bg-red-950 disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1"
              style={{ backgroundColor: '#8B0000' }}
            >
              {isSearching && activeType === 'dhara' ? '...' : 'खोज्नुहोस्'}
            </button>
          </div>
        </div>

        {/* 4. निर्देशन खोज */}
        <div className={`p-3 rounded-lg border transition-all ${
          activeType === 'nirdeshan' ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-700" />
              ४. निर्देशन खोज (Nirdeshan)
            </label>
            <span className="text-[10px] text-slate-400">उदा. ५, ७, ५क</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="निर्देशन नं. (उदा. ५ वा 5)"
                value={nirdeshanQuery}
                onChange={e => setNirdeshanQuery(e.target.value)}
                onKeyDown={e => handleKeyDown(e, 'nirdeshan', nirdeshanQuery)}
                className="w-full text-xs sm:text-sm bg-white border border-slate-300 rounded-md px-2.5 py-1.5 pr-6 text-slate-800 focus:ring-1 focus:ring-red-700 focus:border-red-700 outline-none"
              />
              {nirdeshanQuery && (
                <button
                  onClick={() => setNirdeshanQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              onClick={() => handleExecute('nirdeshan', nirdeshanQuery)}
              disabled={isSearching || !nirdeshanQuery.trim()}
              className="px-3 py-1.5 bg-red-900 text-white font-bold rounded-md text-xs hover:bg-red-950 disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1"
              style={{ backgroundColor: '#8B0000' }}
            >
              {isSearching && activeType === 'nirdeshan' ? '...' : 'खोज्नुहोस्'}
            </button>
          </div>
        </div>

        {/* 5. अनुसूची खोज (Reverse Scan Engine) */}
        <div className={`p-3 rounded-lg border transition-all ${
          activeType === 'anusuchi' ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-purple-700" />
              ५. अनुसूची खोज (Anusuchi)
            </label>
            <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 px-1.5 py-0.2 rounded">
              Reverse Scan (१ देखि ६३)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="अनुसूची नं. वा शीर्षक (उदा. १, ६३)"
                value={anusuchiQuery}
                onChange={e => setAnusuchiQuery(e.target.value)}
                onKeyDown={e => handleKeyDown(e, 'anusuchi', anusuchiQuery)}
                className="w-full text-xs sm:text-sm bg-white border border-slate-300 rounded-md px-2.5 py-1.5 pr-6 text-slate-800 focus:ring-1 focus:ring-red-700 focus:border-red-700 outline-none"
              />
              {anusuchiQuery && (
                <button
                  onClick={() => setAnusuchiQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              onClick={() => handleExecute('anusuchi', anusuchiQuery)}
              disabled={isSearching || !anusuchiQuery.trim()}
              className="px-3 py-1.5 bg-red-900 text-white font-bold rounded-md text-xs hover:bg-red-950 disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1"
              style={{ backgroundColor: '#8B0000' }}
            >
              {isSearching && activeType === 'anusuchi' ? '...' : 'खोज्नुहोस्'}
            </button>
          </div>
        </div>

        {/* 6. शब्द खोज (Header Only) */}
        <div className={`p-3 rounded-lg border transition-all ${
          activeType === 'sabda' ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              ६. शब्द खोज (Sabda)
            </label>
            <span className="text-[10px] text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
              Header मात्र (No Body Text)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="हेडर शब्द (उदा. टायल चेक)"
                value={sabdaQuery}
                onChange={e => setSabdaQuery(e.target.value)}
                onKeyDown={e => handleKeyDown(e, 'sabda', sabdaQuery)}
                className="w-full text-xs sm:text-sm bg-white border border-slate-300 rounded-md px-2.5 py-1.5 pr-6 text-slate-800 focus:ring-1 focus:ring-red-700 focus:border-red-700 outline-none"
              />
              {sabdaQuery && (
                <button
                  onClick={() => setSabdaQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              onClick={() => handleExecute('sabda', sabdaQuery)}
              disabled={isSearching || !sabdaQuery.trim()}
              className="px-3 py-1.5 bg-red-900 text-white font-bold rounded-md text-xs hover:bg-red-950 disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1"
              style={{ backgroundColor: '#8B0000' }}
            >
              {isSearching && activeType === 'sabda' ? '...' : 'खोज्नुहोस्'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
