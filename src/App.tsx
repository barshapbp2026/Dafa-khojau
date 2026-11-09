/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { AdBanner } from './components/AdBanner';
import { FolderSelector } from './components/FolderSelector';
import { SearchSection } from './components/SearchSection';
import { SearchResults } from './components/SearchResults';
import { PdfViewer } from './components/PdfViewer';
import { GeminiAssistant } from './components/GeminiAssistant';
import { DeveloperReviewPanel } from './components/DeveloperReviewPanel';
import { FolderItem, IndexStats, SearchResultItem, SearchType } from './types';
import { AlertCircle, CheckCircle, ShieldAlert } from 'lucide-react';

export default function App() {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [singleFolder, setSingleFolder] = useState<string>('');
  const [singlePdf, setSinglePdf] = useState<string>('');
  const [mode, setMode] = useState<'single' | 'multiple'>('single');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Security Panel State
  const [showSecurityPanel, setShowSecurityPanel] = useState<boolean>(false);
  const [pendingReviewCount, setPendingReviewCount] = useState<number>(0);

  // Search state
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [activeSearchType, setActiveSearchType] = useState<SearchType | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [notFoundMessage, setNotFoundMessage] = useState<string | undefined>(undefined);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Viewer state
  const [viewerItem, setViewerItem] = useState<SearchResultItem | null>(null);

  // Gemini state
  const [geminiActive, setGeminiActive] = useState<boolean>(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch security dashboard counts
  const fetchSecurityCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/security/dashboard');
      const data = await res.json();
      if (data.success) {
        setPendingReviewCount((data.pendingDeveloperCount || 0) + (data.pendingOwnerCount || 0));
      }
    } catch {}
  }, []);

  // Fetch folders and stats
  const fetchFolders = useCallback(async (autoIndexFirst = false) => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/folders');
      const data = await res.json();
      setIsLoading(false);

      if (data.success) {
        setFolders(data.folders);
        if (data.stats) {
          setStats(data.stats);
        }

        // Set default folder and PDF
        if (data.folders.length > 0) {
          const firstFolder = data.folders[0];
          setSingleFolder(prev => prev || firstFolder.folderName);
          if (firstFolder.files.length > 0) {
            setSinglePdf(prev => prev || firstFolder.files[0].name);
          }
          setSelectedFolders(prev => prev.length > 0 ? prev : [firstFolder.folderName]);

          // Pre-load initial document so user can search immediately
          if (autoIndexFirst && firstFolder.files.length > 0) {
            loadInitialDocument(firstFolder.folderName, firstFolder.files[0].name);
          }
        }
      }
    } catch (err: any) {
      setIsLoading(false);
      showToast(err.message || 'फोल्डर विवरण लोड गर्न सकिएन।', 'error');
    }
  }, []);

  const loadInitialDocument = async (folderName: string, fileName: string) => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/load-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'single',
          singleFolder: folderName,
          singlePdf: fileName
        })
      });
      const data = await res.json();
      setIsLoading(false);
      if (data.success) {
        setStats({
          totalIndexedPdfs: data.indexedCount,
          totalPagesIndexed: data.totalPages,
          totalDafas: data.totalDafas,
          totalAnusuchis: data.totalAnusuchis,
          totalSabdaHeaders: data.totalSabdaHeaders,
          memoryMB: data.memoryMB
        });
        showToast(`प्रारम्भिक कानुनी निर्देशिका (${data.totalPages} पृष्ठ) खोजका लागि तयार छ!`);
      }
    } catch {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders(true);
    fetchSecurityCounts();
  }, [fetchFolders, fetchSecurityCounts]);

  // Handle Load Selected
  const handleLoadSelected = async () => {
    setIsLoading(true);
    try {
      const payload: any = { mode };
      if (mode === 'single') {
        payload.singleFolder = singleFolder;
        payload.singlePdf = singlePdf;
      } else {
        payload.selectedFolders = selectedFolders;
      }

      const res = await fetch('/api/load-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setIsLoading(false);

      if (data.success) {
        setStats({
          totalIndexedPdfs: data.indexedCount,
          totalPagesIndexed: data.totalPages,
          totalDafas: data.totalDafas,
          totalAnusuchis: data.totalAnusuchis,
          totalSabdaHeaders: data.totalSabdaHeaders,
          memoryMB: data.memoryMB
        });
        showToast(data.message || 'छानिएका कागजातहरू सफलतापूर्वक इन्डेक्स गरियो!');
        fetchFolders(false);
      } else {
        showToast(data.error || 'लोड गर्न सकिएन।', 'error');
      }
    } catch (err: any) {
      setIsLoading(false);
      showToast(err.message || 'त्रुटि उत्पन्न भयो।', 'error');
    }
  };

  // Handle Search Execution
  const handleSearch = async (type: SearchType, query: string) => {
    setIsSearching(true);
    setActiveSearchType(type);
    setSearchQuery(query);
    setHasSearched(true);
    setNotFoundMessage(undefined);

    try {
      const payload: any = {
        type,
        query,
        scope: mode
      };
      if (mode === 'single') {
        payload.folder = singleFolder;
        payload.pdf = singlePdf;
      }

      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setIsSearching(false);

      if (data.success) {
        setSearchResults(data.results || []);
        setNotFoundMessage(data.notFoundMessage);
      } else {
        setSearchResults([]);
        setNotFoundMessage(data.error || 'खोज असफल भयो।');
      }
    } catch (err: any) {
      setIsSearching(false);
      setSearchResults([]);
      setNotFoundMessage(err.message || 'खोज गर्दा त्रुटि उत्पन्न भयो।');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/70 text-slate-900 font-sans">
      {/* 1. Top Ad Banner */}
      <AdBanner position="top" />

      {/* 2. Header */}
      <Header
        stats={stats}
        mode={mode}
        onModeChange={newMode => {
          setMode(newMode);
          setHasSearched(false);
          setSearchResults([]);
        }}
        geminiActive={geminiActive}
        showSecurityPanel={showSecurityPanel}
        onToggleSecurityPanel={() => setShowSecurityPanel(prev => !prev)}
        pendingReviewCount={pendingReviewCount}
      />

      {/* Toast message notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 transition-all transform animate-bounce-short">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-lg border text-xs sm:text-sm font-semibold flex items-center gap-2 ${
              toastMessage.type === 'success'
                ? 'bg-slate-900 text-white border-slate-700'
                : 'bg-red-900 text-white border-red-700'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-300" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Developer Review & Security Panel (Toggleable) */}
        {showSecurityPanel && (
          <DeveloperReviewPanel
            onActionComplete={() => {
              fetchFolders(false);
              fetchSecurityCounts();
            }}
          />
        )}

        {/* Folder / Document Selector with Rename, Move, Upload, and Delete Request */}
        <FolderSelector
          folders={folders}
          selectedFolders={selectedFolders}
          onToggleFolder={fname => {
            setSelectedFolders(prev =>
              prev.includes(fname) ? prev.filter(f => f !== fname) : [...prev, fname]
            );
          }}
          onSelectAllFolders={() => setSelectedFolders(folders.map(f => f.folderName))}
          onDeselectAllFolders={() => setSelectedFolders([])}
          onLoadSelected={handleLoadSelected}
          isLoading={isLoading}
          mode={mode}
          singleFolder={singleFolder}
          onSingleFolderChange={setSingleFolder}
          singlePdf={singlePdf}
          onSinglePdfChange={setSinglePdf}
          onRefresh={() => {
            fetchFolders(false);
            fetchSecurityCounts();
          }}
          onFolderChanged={() => {
            fetchFolders(false);
            fetchSecurityCounts();
          }}
        />

        {/* 6 Independent Search Boxes (Exact Order: Dhara, Dafa, Niyam, Nirdeshan, Anusuchi, Sabda) */}
        <SearchSection
          onSearch={handleSearch}
          isSearching={isSearching}
          activeType={activeSearchType}
          mode={mode}
        />

        {/* Search Results Display */}
        <SearchResults
          results={searchResults}
          notFoundMessage={notFoundMessage}
          hasSearched={hasSearched}
          searchType={activeSearchType}
          query={searchQuery}
          onOpenViewer={item => setViewerItem(item)}
        />

        {/* Middle Ad Slot */}
        <AdBanner position="middle" />

        {/* Gemini AI Assistant Section */}
        <GeminiAssistant
          onApiKeyChange={(key, valid) => setGeminiActive(valid)}
          selectedPdfName={mode === 'single' ? singlePdf : undefined}
        />
      </main>

      {/* Bottom Ad Slot / Footer */}
      <AdBanner position="bottom" />

      {/* PDF Viewer Modal with Dark Red Header Highlight */}
      {viewerItem && (
        <PdfViewer
          item={viewerItem}
          onClose={() => setViewerItem(null)}
        />
      )}
    </div>
  );
}
