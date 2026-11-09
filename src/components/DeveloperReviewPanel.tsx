import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, CheckCircle, XCircle, Key, Lock, RotateCcw,
  History, AlertTriangle, FileText, Folder, RefreshCw, Eye, MessageSquare
} from 'lucide-react';
import { SecurityRequestItem, AuditLogItem } from '../types';

interface DeveloperReviewPanelProps {
  onActionComplete: () => void;
}

export const DeveloperReviewPanel: React.FC<DeveloperReviewPanelProps> = ({ onActionComplete }) => {
  const [requests, setRequests] = useState<SecurityRequestItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'requests' | 'trash' | 'audit' | 'owner-settings'>('requests');

  // Review modal state
  const [selectedReq, setSelectedReq] = useState<SecurityRequestItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Owner password modal state
  const [ownerPasswordModalReq, setOwnerPasswordModalReq] = useState<SecurityRequestItem | null>(null);
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerPasswordError, setOwnerPasswordError] = useState('');
  const [isVerifyingOwner, setIsVerifyingOwner] = useState(false);

  // Owner update password state
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passUpdateMsg, setPassUpdateMsg] = useState<{ text: string; success: boolean } | null>(null);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/security/dashboard');
      const data = await res.json();
      setIsLoading(false);
      if (data.success) {
        setRequests(data.requests || []);
        setAuditLogs(data.auditLogs || []);
      }
    } catch {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Submit Developer Review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq || !reviewNotes.trim()) return;

    setIsSubmittingReview(true);
    try {
      const res = await fetch('/api/security/developer-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selectedReq.id,
          decision: reviewAction,
          notes: reviewNotes.trim(),
          developerName: 'Lead Reviewer (Developer)'
        })
      });
      const data = await res.json();
      setIsSubmittingReview(false);
      if (data.success) {
        setSelectedReq(null);
        setReviewNotes('');
        fetchDashboard();
        onActionComplete();
      } else {
        alert(data.error || 'समीक्षा असफल भयो।');
      }
    } catch (err: any) {
      setIsSubmittingReview(false);
      alert(err.message || 'त्रुटि उत्पन्न भयो।');
    }
  };

  // Submit Owner Password Delete Confirmation
  const handleConfirmOwnerDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerPasswordModalReq || !ownerPassword) {
      setOwnerPasswordError('कृपया Owner Password प्रविष्ट गर्नुहोस्।');
      return;
    }

    setIsVerifyingOwner(true);
    setOwnerPasswordError('');
    try {
      const res = await fetch('/api/security/owner-confirm-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: ownerPasswordModalReq.id,
          ownerPassword: ownerPassword
        })
      });
      const data = await res.json();
      setIsVerifyingOwner(false);

      if (data.success) {
        setOwnerPasswordModalReq(null);
        setOwnerPassword('');
        fetchDashboard();
        onActionComplete();
        alert('Owner Password प्रमाणित भयो। वस्तु सुरक्षित Trash (Soft Delete) मा सारियो।');
      } else {
        setOwnerPasswordError(data.error || 'गलत Owner Password! Delete प्रक्रिया रोकियो।');
      }
    } catch (err: any) {
      setIsVerifyingOwner(false);
      setOwnerPasswordError(err.message || 'त्रुटि उत्पन्न भयो।');
    }
  };

  // Restore from Trash
  const handleRestore = async (requestId: string) => {
    if (!confirm('के तपाईं यस वस्तुलाई Trash बाट पुनः आफ्नै स्थानमा पुनर्स्थापना (Restore) गर्न चाहनुहुन्छ?')) return;

    try {
      const res = await fetch('/api/security/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId })
      });
      const data = await res.json();
      if (data.success) {
        fetchDashboard();
        onActionComplete();
        alert('सफलतापूर्वक पुनर्स्थापना गरियो।');
      } else {
        alert(data.error || 'Restore असफल भयो।');
      }
    } catch (err: any) {
      alert(err.message || 'त्रुटि उत्पन्न भयो।');
    }
  };

  // Update Owner Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
      setPassUpdateMsg({ text: 'नयाँ पासवर्ड र कन्फर्म पासवर्ड मिलेन।', success: false });
      return;
    }

    try {
      const res = await fetch('/api/security/owner-set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currPass,
          newPassword: newPass
        })
      });
      const data = await res.json();
      if (data.success) {
        setPassUpdateMsg({ text: 'Owner Password सफलतापूर्वक अद्यावधिक भयो।', success: true });
        setCurrPass('');
        setNewPass('');
        setConfirmPass('');
        fetchDashboard();
      } else {
        setPassUpdateMsg({ text: data.error || 'अपडेट असफल भयो।', success: false });
      }
    } catch (err: any) {
      setPassUpdateMsg({ text: err.message || 'त्रुटि उत्पन्न भयो।', success: false });
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'PENDING_DEVELOPER' || r.status === 'APPROVED_BY_DEVELOPER');
  const trashedRequests = requests.filter(r => r.status === 'EXECUTED_TRASH');

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 sm:p-5 mb-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-900 text-white flex items-center justify-center shrink-0" style={{ backgroundColor: '#8B0000' }}>
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Developer Review & Owner Security Panel</span>
              <span className="text-[11px] font-semibold bg-red-100 text-red-900 px-2 py-0.5 rounded-full">
                २-चरण Delete सुरक्षा
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              कुनै पनि Folder वा PDF सिधै Delete हुँदैन — Developer Review र Owner Password अनिवार्य छ।
            </p>
          </div>
        </div>

        <button
          onClick={fetchDashboard}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>रिफ्रेस गर्नुहोस्</span>
        </button>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 mb-4 gap-2 text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('requests')}
          className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'requests'
              ? 'border-red-900 text-red-900 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Delete अनुरोधहरू ({pendingRequests.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('trash')}
          className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'trash'
              ? 'border-red-900 text-red-900 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Trash / Soft Delete ({trashedRequests.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('audit')}
          className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'audit'
              ? 'border-red-900 text-red-900 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>सुरक्षा Audit Log ({auditLogs.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('owner-settings')}
          className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'owner-settings'
              ? 'border-red-900 text-red-900 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Owner Password सेटिङ</span>
        </button>
      </div>

      {/* Tab 1: Delete Requests */}
      {activeSubTab === 'requests' && (
        <div className="space-y-3">
          {pendingRequests.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
              कुनै पनि पेन्डिङ Delete अनुरोध छैन। सबै सुरक्षित छन्।
            </div>
          ) : (
            pendingRequests.map(req => (
              <div
                key={req.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold flex items-center gap-1 text-slate-900">
                      {req.itemType === 'folder' ? <Folder className="w-4 h-4 text-amber-600" /> : <FileText className="w-4 h-4 text-red-800" />}
                      {req.targetName}
                    </span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-600">
                      प्रकार: <strong>{req.itemType === 'folder' ? 'फोल्डर' : 'PDF फाइल'}</strong>
                    </span>
                    <span className="text-slate-400">|</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      req.status === 'PENDING_DEVELOPER'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-emerald-100 text-emerald-900'
                    }`}>
                      {req.status === 'PENDING_DEVELOPER' ? 'Developer Review बाँकी' : 'Developer स्वीकृत (Owner Password बाँकी)'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700">
                    <strong>Delete कारण:</strong> {req.reason}
                  </div>

                  {req.filesContained && req.filesContained.length > 0 && (
                    <div className="text-[11px] text-slate-500">
                      यस फोल्डर भित्र <strong>{req.filesContained.length}</strong> वटा PDF फाइलहरू छन्: {req.filesContained.slice(0, 3).join(', ')} {req.filesContained.length > 3 ? '...' : ''}
                    </div>
                  )}

                  {req.developerReview && (
                    <div className="text-[11px] bg-emerald-50 text-emerald-900 p-2 rounded border border-emerald-200 mt-1">
                      <strong>Developer टिप्पणी:</strong> {req.developerReview.notes} ({new Date(req.developerReview.reviewedAt).toLocaleString()})
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {req.status === 'PENDING_DEVELOPER' && (
                    <button
                      onClick={() => {
                        setSelectedReq(req);
                        setReviewAction('APPROVED');
                        setReviewNotes('');
                      }}
                      className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      Developer Review गर्नुहोस्
                    </button>
                  )}

                  {req.status === 'APPROVED_BY_DEVELOPER' && (
                    <button
                      onClick={() => {
                        setOwnerPasswordModalReq(req);
                        setOwnerPassword('');
                        setOwnerPasswordError('');
                      }}
                      className="px-3.5 py-1.5 bg-red-900 hover:bg-red-950 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                      style={{ backgroundColor: '#8B0000' }}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Owner Password प्रविष्ट गरी Delete गर्नुहोस्</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Trash / Soft Delete */}
      {activeSubTab === 'trash' && (
        <div className="space-y-3">
          {trashedRequests.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
              Trash (Soft Delete) खाली छ।
            </div>
          ) : (
            trashedRequests.map(item => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    {item.itemType === 'folder' ? <Folder className="w-4 h-4 text-amber-600" /> : <FileText className="w-4 h-4 text-red-800" />}
                    {item.targetName}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    स्थान: {item.targetPath} | Delete मिति: {item.ownerApproval ? new Date(item.ownerApproval.approvedAt).toLocaleString() : ''}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    कारण: {item.reason}
                  </div>
                </div>

                <button
                  onClick={() => handleRestore(item.id)}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore (पुनर्स्थापना)</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Security Audit Log */}
      {activeSubTab === 'audit' && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {auditLogs.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
              कुनै पनि लग उपलब्ध छैन।
            </div>
          ) : (
            auditLogs.map(log => (
              <div
                key={log.id}
                className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    log.action.includes('SUCCESS') || log.action.includes('RESTORE')
                      ? 'bg-emerald-100 text-emerald-800'
                      : log.action.includes('FAIL') || log.action.includes('TRASH')
                      ? 'bg-red-100 text-red-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {log.action}
                  </span>
                  <span className="font-bold text-slate-800">{log.targetName}:</span>
                  <span className="text-slate-600">{log.details}</span>
                </div>
                <div className="text-[11px] text-slate-400 shrink-0">
                  {new Date(log.timestamp).toLocaleString()} ({log.actor})
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 4: Owner Password Settings */}
      {activeSubTab === 'owner-settings' && (
        <div className="max-w-md p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-red-800" />
            Owner Password व्यवस्थापन
          </h4>
          <p className="text-slate-600">
            यो पासवर्ड Delete approval का लागि मात्र प्रयोग हुन्छ। यो कहिल्यै GitHub वा frontend मा राखिँदैन, सर्भरमा PBKDF2/SHA-512 ले सुरक्षित hash गरिन्छ।
          </p>

          <form onSubmit={handleUpdatePassword} className="space-y-2.5 pt-2">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">हालको Password:</label>
              <input
                type="password"
                placeholder="हालको पासवर्ड (डिफल्ट: nepal@owner2082)"
                value={currPass}
                onChange={e => setCurrPass(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">नयाँ Password:</label>
              <input
                type="password"
                placeholder="नयाँ पासवर्ड (कम्तीमा ६ अक्षर)"
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">नयाँ Password पुनः टाइप गर्नुहोस्:</label>
              <input
                type="password"
                placeholder="पासवर्ड पुष्टि गर्नुहोस्"
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
              />
            </div>

            {passUpdateMsg && (
              <div className={`p-2 rounded ${passUpdateMsg.success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                {passUpdateMsg.text}
              </div>
            )}

            <button
              type="submit"
              className="px-4 py-2 bg-red-900 text-white font-bold rounded-lg hover:bg-red-950 transition-colors"
              style={{ backgroundColor: '#8B0000' }}
            >
              पासवर्ड सुरक्षित गर्नुहोस्
            </button>
          </form>
        </div>
      )}

      {/* Modal: Developer Review */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 text-xs">
            <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-blue-700" />
              Developer Review: {selectedReq.targetName}
            </h4>
            <p className="text-slate-600 mb-3">
              Delete कारण: <strong>"{selectedReq.reason}"</strong>
            </p>

            <form onSubmit={handleSubmitReview} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">समीक्षा निर्णय (Decision):</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      value="APPROVED"
                      checked={reviewAction === 'APPROVED'}
                      onChange={() => setReviewAction('APPROVED')}
                    />
                    <span className="font-semibold text-emerald-700">Approve (Owner Approval को लागि पठाउने)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      value="REJECTED"
                      checked={reviewAction === 'REJECTED'}
                      onChange={() => setReviewAction('REJECTED')}
                    />
                    <span className="font-semibold text-red-700">Reject (अस्वीकृत गर्ने)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Developer टिप्पणी (Review Notes):</label>
                <textarea
                  placeholder="उदा. ब्याकअप जाँच गरियो, फाइल नक्कल छैन..."
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 h-20"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedReq(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                >
                  रद्द
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="px-4 py-1.5 bg-blue-700 text-white font-bold rounded-lg hover:bg-blue-800 disabled:opacity-50"
                >
                  {isSubmittingReview ? 'सुरक्षित गर्दै...' : 'निर्णय सुरक्षित गर्नुहोस्'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Owner Password Confirmation */}
      {ownerPasswordModalReq && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl border-2 border-red-900 text-xs">
            <div className="flex items-center gap-2 mb-3 text-red-900 font-extrabold text-sm" style={{ color: '#8B0000' }}>
              <Lock className="w-5 h-5 shrink-0" />
              <span>Owner Password अनिवार्य (Final Step)</span>
            </div>

            <div className="bg-red-50 p-2.5 rounded-lg border border-red-200 text-red-950 mb-3 space-y-1">
              <div><strong>वस्तु:</strong> {ownerPasswordModalReq.targetName} ({ownerPasswordModalReq.itemType})</div>
              <div><strong>कारण:</strong> {ownerPasswordModalReq.reason}</div>
              <div className="text-[11px] text-red-800">
                Developer द्वारा स्वीकृत भइसकेको छ। अन्तिम Delete का लागि Owner Password अनिवार्य छ।
              </div>
            </div>

            <form onSubmit={handleConfirmOwnerDelete} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Owner Password प्रविष्ट गर्नुहोस्:</label>
                <input
                  type="password"
                  placeholder="Owner Password"
                  value={ownerPassword}
                  onChange={e => setOwnerPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white focus:ring-2 focus:ring-red-900 outline-none"
                  autoFocus
                  required
                />
              </div>

              {ownerPasswordError && (
                <div className="p-2 bg-red-100 text-red-900 rounded font-bold">
                  {ownerPasswordError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOwnerPasswordModalReq(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                >
                  रद्द
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingOwner}
                  className="px-4 py-1.5 bg-red-900 text-white font-bold rounded-lg hover:bg-red-950 disabled:opacity-50"
                  style={{ backgroundColor: '#8B0000' }}
                >
                  {isVerifyingOwner ? 'प्रमाणीकरण हुँदैछ...' : 'प्रमाणित गरी Delete गर्नुहोस्'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
