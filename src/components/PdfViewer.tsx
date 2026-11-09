import React, { useState, useEffect } from 'react';
import {
  FileText, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  Maximize2, Download, Copy, Check, AlertCircle, RefreshCw, Layers
} from 'lucide-react';
import { SearchResultItem, PageContentData } from '../types';

interface PdfViewerProps {
  item: SearchResultItem | null;
  onClose: () => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ item, onClose }) => {
  if (!item) return null;

  const [currentPage, setCurrentPage] = useState<number>(item.page);
  const [totalPages, setTotalPages] = useState<number>(item.page);
  const [pageData, setPageData] = useState<PageContentData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'both' | 'text' | 'pdf'>('both');

  // Load page text & header data
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchPage = async () => {
      try {
        const url = `/api/pdf-content?folder=${encodeURIComponent(item.folder)}&file=${encodeURIComponent(item.pdfName)}&page=${currentPage}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!isMounted) return;

        if (data.success) {
          setPageData(data);
          setTotalPages(data.totalPages);
        } else {
          setError(data.error || 'पृष्ठ लोड गर्न सकिएन।');
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'त्रुटि उत्पन्न भयो।');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPage();

    return () => {
      isMounted = false;
    };
  }, [item.folder, item.pdfName, currentPage]);

  const handleCopyPageText = () => {
    if (pageData?.text) {
      navigator.clipboard.writeText(pageData.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const rawPdfUrl = `/api/pdf-raw?folder=${encodeURIComponent(item.folder)}&file=${encodeURIComponent(item.pdfName)}#page=${currentPage}`;

  // Break page text into lines and highlight the matching header line
  const renderHighlightedText = () => {
    if (!pageData?.text) return null;

    const lines = pageData.text.split('\n');
    const targetHeaderClean = item.headerText.trim();
    const queryTerm = item.title || item.number;

    return lines.map((line, idx) => {
      const cleanLine = line.trim();
      if (!cleanLine) return null;

      // Check if this line is the matching header line
      const isHeaderMatch =
        (targetHeaderClean.length > 5 && (cleanLine.includes(targetHeaderClean) || targetHeaderClean.includes(cleanLine))) ||
        (cleanLine.includes(item.headerText)) ||
        (item.isAnusuchi && cleanLine.startsWith('अनुसूची') && cleanLine.includes(item.number)) ||
        (cleanLine.includes(queryTerm) && (cleanLine.startsWith(item.number) || cleanLine.includes(`दफा ${item.number}`)));

      if (isHeaderMatch) {
        return (
          <div
            key={idx}
            className="my-3 p-3.5 rounded-lg border-l-4 border-red-900 bg-red-100/70 text-red-950 font-bold shadow-xs relative ring-1 ring-red-300"
            style={{ borderLeftColor: '#8B0000', backgroundColor: 'rgba(139, 0, 0, 0.12)' }}
          >
            <div className="flex items-center justify-between text-[11px] text-red-900 font-extrabold uppercase tracking-wider mb-1">
              <span>🎯 मेल खाएको हेडर (Dark Red Highlight):</span>
              <span className="bg-red-900 text-white px-2 py-0.5 rounded text-[10px]" style={{ backgroundColor: '#8B0000' }}>
                Header Match
              </span>
            </div>
            <div className="text-base font-bold text-red-950 leading-relaxed font-sans">
              {cleanLine}
            </div>
          </div>
        );
      }

      return (
        <p key={idx} className="my-1.5 text-slate-800 text-xs sm:text-sm leading-relaxed font-sans">
          {cleanLine}
        </p>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden">
        {/* Top Control Bar */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-red-700 flex items-center justify-center shrink-0" style={{ backgroundColor: '#8B0000' }}>
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold truncate">
                {item.pdfName}
              </h4>
              <p className="text-[11px] text-slate-300 truncate">
                फोल्डर: {item.folder} | खोज: <strong>{item.headerText}</strong>
              </p>
            </div>
          </div>

          {/* Navigation & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Buttons */}
            <div className="hidden sm:flex bg-slate-800 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setViewMode('both')}
                className={`px-2 py-1 rounded ${viewMode === 'both' ? 'bg-red-800 text-white font-bold' : 'text-slate-300 hover:text-white'}`}
              >
                द्वैध दृश्य (Dual)
              </button>
              <button
                onClick={() => setViewMode('text')}
                className={`px-2 py-1 rounded ${viewMode === 'text' ? 'bg-red-800 text-white font-bold' : 'text-slate-300 hover:text-white'}`}
              >
                पाठ (Text)
              </button>
              <button
                onClick={() => setViewMode('pdf')}
                className={`px-2 py-1 rounded ${viewMode === 'pdf' ? 'bg-red-800 text-white font-bold' : 'text-slate-300 hover:text-white'}`}
              >
                मूल PDF
              </button>
            </div>

            {/* Page Jump Controls */}
            <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg text-xs">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 hover:bg-slate-700 rounded disabled:opacity-40"
                title="अघिल्लो पृष्ठ"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-semibold px-1 text-slate-200">
                पृष्ठ {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 hover:bg-slate-700 rounded disabled:opacity-40"
                title="पछिल्लो पृष्ठ"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Direct PDF Download / Open in new tab */}
            <a
              href={rawPdfUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs flex items-center gap-1"
              title="नयाँ ट्याबमा मूल PDF खोल्नुहोस्"
            >
              <Download className="w-3.5 h-3.5" />
            </a>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-red-800 text-slate-200 hover:text-white rounded-lg transition-colors ml-1"
              title="भ्यूअर बन्द गर्नुहोस्"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Highlight notification bar */}
        <div className="px-4 py-2 bg-red-950 text-white flex items-center justify-between text-xs font-semibold shrink-0" style={{ backgroundColor: '#8B0000' }}>
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-red-300 animate-pulse"></span>
            <span className="truncate">
              हाइलाइट गरिएको हेडर: <strong>{item.headerText}</strong>
            </span>
          </div>
          <button
            onClick={handleCopyPageText}
            className="inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-[11px] transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-300" />
                <span>प्रतिलिपि भयो!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>पृष्ठ पाठ कपी</span>
              </>
            )}
          </button>
        </div>

        {/* Content Body: Dual Mode or Single Mode */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-slate-100">
          {/* Panel 1: OCR Text view with Dark Red Header Highlight */}
          {(viewMode === 'both' || viewMode === 'text') && (
            <div className={`h-full flex flex-col bg-white overflow-hidden ${viewMode === 'text' ? 'col-span-2' : ''}`}>
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between shrink-0">
                <span>अभिलेख तथा पाठ दृश्य (Text & Header Highlight)</span>
                <span className="text-[11px] text-slate-500">
                  हेडर मात्र Dark Red (#8B0000) मा हाइलाइट
                </span>
              </div>
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-slate-500 gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-red-800" />
                    <span>पृष्ठ पाठ लोड हुँदैछ...</span>
                  </div>
                ) : error ? (
                  <div className="p-4 rounded-lg bg-red-50 text-red-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto">
                    {renderHighlightedText()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Panel 2: Native PDF Viewer */}
          {(viewMode === 'both' || viewMode === 'pdf') && (
            <div className={`h-full flex flex-col bg-slate-900 overflow-hidden ${viewMode === 'pdf' ? 'col-span-2' : ''}`}>
              <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 text-xs font-bold text-slate-300 flex items-center justify-between shrink-0">
                <span>मूल PDF पृष्ठ (Native Document Page {currentPage})</span>
                <span className="text-[11px] text-slate-400">
                  नेपाली फन्ट र ढाँचा सहित
                </span>
              </div>
              <div className="flex-1 w-full h-full relative">
                <iframe
                  key={rawPdfUrl}
                  src={rawPdfUrl}
                  className="w-full h-full border-0"
                  title="PDF Document Viewer"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
