import React, { useState } from 'react';
import { Folder, FolderCheck, CheckSquare, Square, RefreshCw, Upload, FolderPlus, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { FolderItem } from '../types';

interface FolderSelectorProps {
  folders: FolderItem[];
  selectedFolders: string[];
  onToggleFolder: (folderName: string) => void;
  onSelectAllFolders: () => void;
  onDeselectAllFolders: () => void;
  onLoadSelected: () => void;
  isLoading: boolean;
  mode: 'single' | 'multiple';
  singleFolder: string;
  onSingleFolderChange: (folder: string) => void;
  singlePdf: string;
  onSinglePdfChange: (pdf: string) => void;
  onRefresh: () => void;
  onFolderCreated: () => void;
}

export const FolderSelector: React.FC<FolderSelectorProps> = ({
  folders,
  selectedFolders,
  onToggleFolder,
  onSelectAllFolders,
  onDeselectAllFolders,
  onLoadSelected,
  isLoading,
  mode,
  singleFolder,
  onSingleFolderChange,
  singlePdf,
  onSinglePdfChange,
  onRefresh,
  onFolderCreated
}) => {
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFolder, setUploadFolder] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  // Handle create folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const res = await fetch('/api/folders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName: newFolderName.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setNewFolderName('');
        setShowNewFolderModal(false);
        onFolderCreated();
      } else {
        alert(data.error || 'फोल्डर बनाउन सकिएन।');
      }
    } catch (err: any) {
      alert(err.message || 'त्रुटि उत्पन्न भयो।');
    }
  };

  // Handle PDF upload
  const handleUploadPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadFolder) {
      setUploadError('कृपया फोल्डर र PDF फाइल छान्नुहोस्।');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderName: uploadFolder,
            fileName: uploadFile.name,
            base64Content: base64
          })
        });
        const data = await res.json();
        setUploading(false);
        if (data.success) {
          setUploadSuccess('PDF फाइल सफलतापूर्वक अपलोड भयो!');
          setUploadFile(null);
          setTimeout(() => {
            setShowUploadModal(false);
            setUploadSuccess('');
            onFolderCreated();
          }, 1200);
        } else {
          setUploadError(data.error || 'अपलोड असफल भयो।');
        }
      };
      reader.readAsDataURL(uploadFile);
    } catch (err: any) {
      setUploading(false);
      setUploadError(err.message || 'त्रुटि उत्पन्न भयो।');
    }
  };

  const selectedFolderObj = folders.find(f => f.folderName === singleFolder);
  const availablePdfs = selectedFolderObj ? selectedFolderObj.files : [];

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 sm:p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-red-800" />
          <h2 className="text-base font-bold text-slate-900">
            {mode === 'single' ? 'कागजात छनोट (Single PDF Selection)' : 'फोल्डर छनोट (Multiple Folders Selection)'}
          </h2>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
            कुल फोल्डर: {folders.length}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowNewFolderModal(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            नयाँ फोल्डर
          </button>
          <button
            onClick={() => {
              if (folders.length > 0 && !uploadFolder) setUploadFolder(folders[0].folderName);
              setShowUploadModal(true);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            PDF थप्नुहोस्
          </button>
          <button
            onClick={onRefresh}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="पुनः ताजा गर्नुहोस्"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mode A: Single PDF Selection */}
      {mode === 'single' ? (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              १. फोल्डर छान्नुहोस्
            </label>
            <select
              value={singleFolder}
              onChange={e => {
                onSingleFolderChange(e.target.value);
                const match = folders.find(f => f.folderName === e.target.value);
                if (match && match.files.length > 0) {
                  onSinglePdfChange(match.files[0].name);
                } else {
                  onSinglePdfChange('');
                }
              }}
              className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-2 focus:ring-red-700/20 focus:border-red-700 outline-none"
            >
              <option value="">-- फोल्डर चयन गर्नुहोस् --</option>
              {folders.map(f => (
                <option key={f.folderName} value={f.folderName}>
                  📁 {f.folderName} ({f.files.length} फाइलहरू)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              २. PDF फाइल छान्नुहोस्
            </label>
            <select
              value={singlePdf}
              onChange={e => onSinglePdfChange(e.target.value)}
              disabled={!singleFolder || availablePdfs.length === 0}
              className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-2 focus:ring-red-700/20 focus:border-red-700 outline-none disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="">-- PDF फाइल चयन गर्नुहोस् --</option>
              {availablePdfs.map(f => (
                <option key={f.name} value={f.name}>
                  📄 {f.name} ({f.sizeFormatted})
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              onClick={onLoadSelected}
              disabled={isLoading || !singleFolder || !singlePdf}
              className="w-full py-2 px-4 bg-red-900 hover:bg-red-950 text-white font-bold rounded-lg text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#8B0000' }}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>कागजात लोड हुँदैछ...</span>
                </>
              ) : (
                <>
                  <FolderCheck className="w-4 h-4" />
                  <span>कागजात लोड गर्नुहोस् (Load PDF)</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Mode B: Multiple Folders Selection */
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-xs text-slate-600">
              खोज्न चाहेका फोल्डरहरूमा टिक (✓) गर्नुहोस् र <strong>Load Selected</strong> बटन थिच्नुहोस्:
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={onSelectAllFolders}
                className="text-red-800 hover:text-red-950 font-semibold"
              >
                सबै छान्नुहोस्
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={onDeselectAllFolders}
                className="text-slate-500 hover:text-slate-800"
              >
                खाली गर्नुहोस्
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {folders.map(folder => {
              const isChecked = selectedFolders.includes(folder.folderName);
              return (
                <div
                  key={folder.folderName}
                  onClick={() => onToggleFolder(folder.folderName)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 select-none ${
                    isChecked
                      ? 'bg-red-50/60 border-red-300 text-red-950 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="mt-0.5 text-red-800 shrink-0">
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-red-800" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs sm:text-sm truncate">
                      {folder.folderName}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>{folder.files.length} PDF फाइल</span>
                      {folder.files.some(f => f.isIndexed) && (
                        <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                          <CheckCircle className="w-3 h-3" /> लोड भएको
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-600 font-medium">
              छानिएका फोल्डर संख्या: <strong>{selectedFolders.length}</strong>
            </span>
            <button
              onClick={onLoadSelected}
              disabled={isLoading || selectedFolders.length === 0}
              className="w-full sm:w-auto py-2 px-6 bg-red-900 hover:bg-red-950 text-white font-bold rounded-lg text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#8B0000' }}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>इन्डेक्स हुँदैछ...</span>
                </>
              ) : (
                <>
                  <FolderCheck className="w-4 h-4" />
                  <span>Load Selected (छानिएका फाइलहरू लोड गर्नुहोस्)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Create Folder */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <FolderPlus className="w-4 h-4 text-red-800" />
              नयाँ फोल्डर बनाउनुहोस्
            </h3>
            <form onSubmit={handleCreateFolder}>
              <input
                type="text"
                placeholder="उदा. भूमिसुधार तथा ऐन"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 mb-3 focus:bg-white focus:ring-2 focus:ring-red-700/20 focus:border-red-700 outline-none"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md font-medium"
                >
                  रद्द
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs bg-red-900 text-white font-bold rounded-md hover:bg-red-950"
                  style={{ backgroundColor: '#8B0000' }}
                >
                  सिर्जना गर्नुहोस्
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Upload PDF */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-red-800" />
              नयाँ नेपाली कानुनी PDF फाइल थप्नुहोस्
            </h3>
            <form onSubmit={handleUploadPdf} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  कुन फोल्डरमा राख्ने?
                </label>
                <select
                  value={uploadFolder}
                  onChange={e => setUploadFolder(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                >
                  {folders.map(f => (
                    <option key={f.folderName} value={f.folderName}>
                      {f.folderName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  PDF फाइल छान्नुहोस्
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadFile(e.target.files[0]);
                    }
                  }}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>

              {uploadError && (
                <div className="text-xs text-red-600 flex items-center gap-1 bg-red-50 p-2 rounded">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {uploadError}
                </div>
              )}
              {uploadSuccess && (
                <div className="text-xs text-emerald-700 flex items-center gap-1 bg-emerald-50 p-2 rounded">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  {uploadSuccess}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md font-medium"
                >
                  रद्द
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="px-3 py-1.5 text-xs bg-red-900 text-white font-bold rounded-md hover:bg-red-950 disabled:opacity-50"
                  style={{ backgroundColor: '#8B0000' }}
                >
                  {uploading ? 'अपलोड हुँदैछ...' : 'अपलोड गर्नुहोस्'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
