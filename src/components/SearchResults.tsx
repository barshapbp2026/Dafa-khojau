import React from 'react';
import { FileText, Eye, AlertCircle, Copy, Check, Hash, ExternalLink, BookmarkCheck } from 'lucide-react';
import { SearchResultItem, SearchType } from '../types';

interface SearchResultsProps {
  results: SearchResultItem[];
  notFoundMessage?: string;
  hasSearched: boolean;
  searchType: SearchType | null;
  query: string;
  onOpenViewer: (item: SearchResultItem) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  notFoundMessage,
  hasSearched,
  searchType,
  query,
  onOpenViewer
}) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  if (!hasSearched) return null;

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const getTypeLabel = (type: SearchType) => {
    switch (type) {
      case 'dafa': return 'दफा';
      case 'niyam': return 'नियम';
      case 'dhara': return 'धारा';
      case 'nirdeshan': return 'निर्देशन';
      case 'anusuchi': return 'अनुसूची';
      case 'sabda': return 'हेडर शब्द';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 sm:p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-100 gap-2">
        <div className="flex items-center gap-2">
          <BookmarkCheck className="w-5 h-5 text-red-800" />
          <h3 className="text-base font-bold text-slate-900">
            खोज नतिजा (Search Results)
          </h3>
          <span className="text-xs bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full font-bold">
            {results.length} भेटिएका
          </span>
        </div>
        <div className="text-xs text-slate-500">
          खोजिएको: <strong className="text-slate-800">{query}</strong> ({getTypeLabel(searchType || 'dafa')})
        </div>
      </div>

      {/* If No Results */}
      {results.length === 0 ? (
        <div className="p-6 rounded-xl bg-amber-50/70 border border-amber-200 text-center">
          <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-amber-950 mb-1">
            {notFoundMessage || 'कुनै नतिजा भेटिएन'}
          </h4>
          <p className="text-xs text-amber-800 max-w-md mx-auto">
            {searchType === 'sabda'
              ? 'यो शब्द कुनै Header मा भेटिएन। (नोट: शब्द खोजले बडी टेक्स्टमा नखोजेर शीर्षक/हेडरमा मात्र खोज गर्दछ)'
              : 'कृपया नम्बर, हिज्जे वा अर्को फोल्डर जाँच गरी पुनः खोज्नुहोस्।'}
          </p>
        </div>
      ) : (
        /* Results Cards */
        <div className="space-y-3">
          {results.map((item, index) => (
            <div
              key={`${item.pdfName}-${item.page}-${index}`}
              className="p-4 rounded-xl border border-slate-200 hover:border-red-300 bg-slate-50/40 hover:bg-white transition-all shadow-2xs group"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  {/* File & Location Badge */}
                  <div className="flex items-center flex-wrap gap-2 text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200">
                      <FileText className="w-3.5 h-3.5 text-red-800" />
                      {item.pdfName}
                    </span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-500 font-medium">
                      फोल्डर: <strong>{item.folder}</strong>
                    </span>
                    <span className="text-slate-400">|</span>
                    <span className="bg-red-900 text-white font-bold px-2 py-0.5 rounded text-[11px]" style={{ backgroundColor: '#8B0000' }}>
                      पृष्ठ नं. {item.page}
                    </span>
                    {item.matchStrategy === 'both_words' && (
                      <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded text-[11px]">
                        दुवै शब्द मेल (All Words)
                      </span>
                    )}
                    {item.isAnusuchi && (
                      <span className="bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded text-[11px]">
                        Reverse Scanned Annex
                      </span>
                    )}
                  </div>

                  {/* Header text with Dark Red Highlight Box */}
                  <div className="p-2.5 rounded-lg border-l-4 border-red-900 bg-red-50/50 mt-2">
                    <div className="text-[11px] font-bold text-red-900 uppercase tracking-wider mb-0.5">
                      वास्तविक हेडर (Exact Header):
                    </div>
                    <div className="text-sm sm:text-base font-bold text-slate-900">
                      {item.headerText}
                    </div>
                  </div>

                  {item.snippet && (
                    <div className="text-xs text-slate-600 mt-1 italic">
                      {item.snippet}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center sm:self-center gap-2 shrink-0 pt-2 md:pt-0">
                  <button
                    onClick={() => handleCopy(item.headerText, index)}
                    className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors text-xs flex items-center gap-1"
                    title="हेडर प्रतिलिपि गर्नुहोस्"
                  >
                    {copiedIndex === index ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">कपी भयो</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>कपी</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => onOpenViewer(item)}
                    className="px-3.5 py-2 bg-red-900 hover:bg-red-950 text-white font-bold rounded-lg text-xs shadow-xs transition-all flex items-center gap-1.5"
                    style={{ backgroundColor: '#8B0000' }}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>PDF मा हेर्नुहोस् (पृष्ठ {item.page})</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
