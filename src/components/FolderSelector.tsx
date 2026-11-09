import React, { useState } from 'react';
import {
  Folder, FolderCheck, CheckSquare, Square, RefreshCw, Upload,
  FolderPlus, FileText, CheckCircle, AlertCircle, Search, Edit2,
  Trash2, Move, ArrowRight, X, ChevronDown, ChevronRight
} from 'lucide-react';
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
  onFolderChanged: () => void;
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
  onFolderChanged
}) => {
  const [filterSearch, setFilterSearch] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Modals state
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFolder, setUploadFolder] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  // Rename folder modal
  const [renameFolderData, setRenameFolderData] = useState<{ oldName: string; newName: string } | null>(null);

  // Rename PDF modal
  const [renamePdfData, setRenamePdfData] = useState<{ folderName: string; oldName: string; newName: string } | null>(null);

  // Move PDF modal
  const [movePdfData, setMovePdfData] = useState<{ sourceFolder: string; targetFolder: string; fileName: string } | null>(null);

  // Delete Request modal (Step 1 of Delete Security)
  const [deleteRequestData, setDeleteRequestData] = useState<{
    itemType: 'folder' | 'pdf';
    targetPath: string;
    targetName: string;
    folderName: string;
    reason: string;
  } | null>(null);

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
        onFolderChanged();
      } else {
        alert(data.error || 'फोल्डर बनाउन सकिएन।');
      }
    } catch (err: any) {
      alert(err.message || 'त्रुटि उत्पन्न भयो।');
    }
  };

  // Handle rename folder
  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameFolderData || !renameFolderData.newName.trim()) return;

    try {
      const res = await fetch('/api/folders/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldName: renameFolderData.oldName,
          newName: renameFolderData.newName.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setRenameFolderData(null);
        onFolderChanged();
      } else {
        alert(data.error || 'फोल्डर नाम परिवर्तन असफल भयो।');
      }
    } catch (err: any) {
      alert(err.message || 'त्रुटि उत्पन्न भयो।');
    }
  };

  // Handle rename PDF
  const handleRenamePdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamePdfData || !renamePdfData.newName.trim()) return;

    try {
      const res = await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderName: renamePdfData.folderName,
          oldFileName: renamePdfData.oldName,
          newFileName: renamePdfData.newName.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setRenamePdfData(null);
        onFolderChanged();
      } else {
        alert(data.error || 'PDF नाम परिवर्तन असफल भयो।');
      }
    } catch (err: any) {
      alert(err.message || 'त्रुटि उत्पन्न भयो।');
    }
  };

  // Handle move PDF
  const handleMovePdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movePdfData || !movePdfData.targetFolder) return;

    try {
      const res = await fetch('/api/files/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFolder: movePdfData.sourceFolder,
          targetFolder: movePdfData.targetFolder,
          fileName: movePdfData.fileName
        })
      });
      const data = await res.json();
      if (data.success) {
        setMovePdfData(null);
        onFolderChanged();
      } else {
        alert(data.error || 'PDF सार्न सकिएन।');
      }
    } catch (err: any) {
      alert(err.message || 'त्रुटि उत्पन्न भयो।');
    }
  };

  // Handle submit delete request (Step 1)
  const handleSubmitDeleteRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteRequestData || !deleteRequestData.reason.trim()) {
      alert('Delete अनुरोधका लागि कारण लेख्न अनिवार्य छ।');
      return;
    }

    try {
      const res = await fetch('/api/security/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: deleteRequestData.itemType,
          targetPath: deleteRequestData.targetPath,
          targetName: deleteRequestData.targetName,
          folderName: deleteRequestData.folderName,
          reason: deleteRequestData.reason.trim(),
          requestedBy: 'User/Operator'
        })
      });
      const data = await res.json();
      if (data.success) {
        setDeleteRequestData(null);
        alert('Delete अनुरोध दर्ता भयो! अब यो Developer Review मा पठाइएको छ। Developer स्वीकृत गरेपछि Owner Password मार्फत मात्र Delete हुनेछ।');
        onFolderChanged();
      } else {
        alert(data.error || 'Delete अनुरोध असफल भयो।');
      }
    } catch (err: any) {
      alert(err.message || 'त्रुटि उत्पन्न भयो।');
    }
  };

  // Handle upload PDF
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
          setUploadSuccess(`PDF फाइल सफलतापूर्वक सुरक्षित भयो! (${data.fileName})`);
          setUploadFile(null);
          setTimeout(() => {
            setShowUploadModal(false);
            setUploadSuccess('');
            onFolderChanged();
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

  const toggleExpand = (folderName: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderName]: !prev[folderName] }));
  };

  // Filter folders and PDFs
  const filteredFolders = folders.filter(f => {
    if (!filterSearch) return true;
    const matchFolder = f.folderName.toLowerCase().includes(filterSearch.toLowerCase());
    const matchPdf = f.files.some(file => file.name.toLowerCase().includes(filterSearch.toLowerCase()));
    return matchFolder || matchPdf;
  });

  const selectedFolderObj = folders.find(f => f.folderName === singleFolder);
  const availablePdfs = selectedFolderObj ? selectedFolderObj.files : [];

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 sm:p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-red-800" />
          <h2 className="text-base font-bold text-slate-900">
            {mode === 'single' ? 'कागजात छनोट (Single PDF Selection)' : 'फोल्डर तथा PDF व्यवस्थापन (Multiple Folders)'}
          </h2>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
            कुल फोल्डर: {folders.length} | कुल PDF: {folders.reduce((acc, f) => acc + f.files.length, 0)}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick search input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="फोल्डर वा PDF खोज्नुहोस्..."
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-2.5 py-1.5 focus:bg-white focus:border-red-700 outline-none w-44 sm:w-56"
            />
          </div>

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
        /* Mode B: Multiple Folders & PDF List */
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

          {/* Folder & File Tree */}
          <div className="space-y-3">
            {filteredFolders.map(folder => {
              const isChecked = selectedFolders.includes(folder.folderName);
              const isExpanded = !!expandedFolders[folder.folderName];

              return (
                <div
                  key={folder.folderName}
                  className={`rounded-xl border transition-all overflow-hidden ${
                    isChecked
                      ? 'bg-red-50/40 border-red-300 text-red-950 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  {/* Folder Header Row */}
                  <div className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        onClick={() => onToggleFolder(folder.folderName)}
                        className="cursor-pointer text-red-800 shrink-0"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-red-800" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </div>

                      <button
                        onClick={() => toggleExpand(folder.folderName)}
                        className="flex items-center gap-1.5 text-left font-bold text-xs sm:text-sm text-slate-900 hover:text-red-800 truncate"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        <Folder className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="truncate">{folder.folderName}</span>
                      </button>

                      <span className="text-[11px] text-slate-500 shrink-0">
                        ({folder.files.length} PDFs)
                      </span>
                    </div>

                    {/* Folder Management Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setRenameFolderData({ oldName: folder.folderName, newName: folder.folderName })}
                        className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded text-xs"
                        title="फोल्डर नाम फेर्नुहोस्"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setDeleteRequestData({
                          itemType: 'folder',
                          targetPath: folder.folderName,
                          targetName: folder.folderName,
                          folderName: folder.folderName,
                          reason: ''
                        })}
                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded text-xs"
                        title="Delete अनुरोध गर्नुहोस् (Owner Password आवश्यक)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* PDF Files Accordion / List inside Folder */}
                  {isExpanded && (
                    <div className="border-t border-slate-200/80 bg-white p-3 space-y-2">
                      {folder.files.length === 0 ? (
                        <div className="text-xs text-slate-400 italic">यस फोल्डरमा कुनै PDF छैन।</div>
                      ) : (
                        folder.files.map(file => (
                          <div
                            key={file.name}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-3.5 h-3.5 text-red-800 shrink-0" />
                              <span className="font-semibold text-slate-800 truncate" title={file.name}>
                                {file.name}
                              </span>
                              <span className="text-slate-400 text-[11px]">({file.sizeFormatted})</span>
                              {file.isIndexed && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold shrink-0">
                                  इन्डेक्स भएको
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Rename PDF */}
                              <button
                                onClick={() => setRenamePdfData({
                                  folderName: folder.folderName,
                                  oldName: file.name,
                                  newName: file.name
                                })}
                                className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded"
                                title="PDF नाम फेर्नुहोस्"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>

                              {/* Move PDF */}
                              <button
                                onClick={() => setMovePdfData({
                                  sourceFolder: folder.folderName,
                                  targetFolder: folders.find(f => f.folderName !== folder.folderName)?.folderName || '',
                                  fileName: file.name
                                })}
                                className="p-1 text-slate-500 hover:text-blue-800 hover:bg-blue-100 rounded"
                                title="अर्को फोल्डरमा सार्नुहोस्"
                              >
                                <Move className="w-3 h-3" />
                              </button>

                              {/* Delete PDF Request */}
                              <button
                                onClick={() => setDeleteRequestData({
                                  itemType: 'pdf',
                                  targetPath: `${folder.folderName}/${file.name}`,
                                  targetName: file.name,
                                  folderName: folder.folderName,
                                  reason: ''
                                })}
                                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
                                title="Delete अनुरोध गर्नुहोस् (Owner Password आवश्यक)"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
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

      {/* Modal: Rename Folder */}
      {renameFolderData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200 text-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <Edit2 className="w-4 h-4 text-red-800" />
              फोल्डरको नाम फेर्नुहोस्
            </h3>
            <form onSubmit={handleRenameFolder} className="space-y-3">
              <div>
                <label className="block text-slate-500 mb-1">नयाँ नाम:</label>
                <input
                  type="text"
                  value={renameFolderData.newName}
                  onChange={e => setRenameFolderData({ ...renameFolderData, newName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenameFolderData(null)}
                  className="px-3 py-1.5 bg-slate-100 rounded-md"
                >
                  रद्द
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-red-900 text-white font-bold rounded-md hover:bg-red-950"
                  style={{ backgroundColor: '#8B0000' }}
                >
                  नाम परिवर्तन
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Rename PDF */}
      {renamePdfData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200 text-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <Edit2 className="w-4 h-4 text-red-800" />
              PDF को नाम फेर्नुहोस्
            </h3>
            <form onSubmit={handleRenamePdf} className="space-y-3">
              <div>
                <label className="block text-slate-500 mb-1">नयाँ PDF नाम:</label>
                <input
                  type="text"
                  value={renamePdfData.newName}
                  onChange={e => setRenamePdfData({ ...renamePdfData, newName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenamePdfData(null)}
                  className="px-3 py-1.5 bg-slate-100 rounded-md"
                >
                  रद्द
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-red-900 text-white font-bold rounded-md hover:bg-red-950"
                  style={{ backgroundColor: '#8B0000' }}
                >
                  नाम परिवर्तन
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Move PDF */}
      {movePdfData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200 text-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <Move className="w-4 h-4 text-blue-700" />
              PDF फाइल अर्को फोल्डरमा सार्नुहोस्
            </h3>
            <p className="text-slate-600 mb-3">
              फाइल: <strong>{movePdfData.fileName}</strong>
            </p>
            <form onSubmit={handleMovePdf} className="space-y-3">
              <div>
                <label className="block text-slate-500 mb-1">गन्तव्य फोल्डर छान्नुहोस्:</label>
                <select
                  value={movePdfData.targetFolder}
                  onChange={e => setMovePdfData({ ...movePdfData, targetFolder: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                >
                  <option value="">-- फोल्डर छान्नुहोस् --</option>
                  {folders.map(f => (
                    <option key={f.folderName} value={f.folderName} disabled={f.folderName === movePdfData.sourceFolder}>
                      📁 {f.folderName} {f.folderName === movePdfData.sourceFolder ? '(वर्तमान)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMovePdfData(null)}
                  className="px-3 py-1.5 bg-slate-100 rounded-md"
                >
                  रद्द
                </button>
                <button
                  type="submit"
                  disabled={!movePdfData.targetFolder || movePdfData.targetFolder === movePdfData.sourceFolder}
                  className="px-3 py-1.5 bg-blue-700 text-white font-bold rounded-md hover:bg-blue-800 disabled:opacity-50"
                >
                  सार्नुहोस् (Move)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Request (Step 1 with Reason Input) */}
      {deleteRequestData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border-2 border-amber-300 text-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4 text-red-700" />
              Delete अनुरोध दर्ता (Step 1 of 2)
            </h3>
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-950 mb-3 space-y-1">
              <div><strong>लक्ष्य:</strong> {deleteRequestData.targetName} ({deleteRequestData.itemType})</div>
              <p className="text-[11px] text-amber-800">
                ⚠️ सुरक्षा नियम: यो अनुरोध पहिले <strong>Developer Review</strong> मा जानेछ। त्यसपछि मात्र <strong>Owner Password</strong> प्रमाणित गरी Delete हुनेछ।
              </p>
            </div>

            <form onSubmit={handleSubmitDeleteRequest} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Delete गर्नुको कारण (अनिवार्य):</label>
                <textarea
                  placeholder="उदा. पुरानो खारेज भएको निर्देशिका, नक्कल फाइल, नयाँ संस्करण अपलोड भएको..."
                  value={deleteRequestData.reason}
                  onChange={e => setDeleteRequestData({ ...deleteRequestData, reason: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 h-20 outline-none focus:bg-white focus:ring-1 focus:ring-red-800"
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteRequestData(null)}
                  className="px-3 py-1.5 bg-slate-100 rounded-md font-medium"
                >
                  रद्द
                </button>
                <button
                  type="submit"
                  disabled={!deleteRequestData.reason.trim()}
                  className="px-4 py-1.5 bg-red-900 text-white font-bold rounded-md hover:bg-red-950 disabled:opacity-50"
                  style={{ backgroundColor: '#8B0000' }}
                >
                  Developer Review मा पठाउनुहोस्
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
