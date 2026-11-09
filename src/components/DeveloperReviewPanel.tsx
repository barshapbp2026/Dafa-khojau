import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, CheckCircle, XCircle, Key, Lock, RotateCcw,
  History, AlertTriangle, FileText, Folder, RefreshCw, Eye,
  GitBranch, Database, ShieldCheck, Check, Copy, ExternalLink,
  UploadCloud, FileCheck, Ban, ArrowRight
} from 'lucide-react';
import {
  SecurityRequestItem, AuditLogItem, PendingUploadItem, GitLfsStatusData,
  EnvStatusReport, LfsTestReport
} from '../types';

interface DeveloperReviewPanelProps {
  onActionComplete: () => void;
}

export const DeveloperReviewPanel: React.FC<DeveloperReviewPanelProps> = ({ onActionComplete }) => {
  const [requests, setRequests] = useState<SecurityRequestItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [pendingUploads, setPendingUploads] = useState<PendingUploadItem[]>([]);
  const [lfsStatus, setLfsStatus] = useState<GitLfsStatusData | null>(null);
  const [envReport, setEnvReport] = useState<EnvStatusReport | null>(null);
  const [lfsTestReport, setLfsTestReport] = useState<LfsTestReport | null>(null);
  const [isRunningLfsTest, setIsRunningLfsTest] = useState<boolean>(false);
  const [lfsTestError, setLfsTestError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState<
    'pending-uploads' | 'lfs-status' | 'requests' | 'trash' | 'audit' | 'owner-settings'
  >('pending-uploads');

  // Admin authentication state
  const [adminToken, setAdminToken] = useState<string>('');
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [adminLoginError, setAdminLoginError] = useState<string>('');

  // Review modal state (Delete requests)
  const [selectedReq, setSelectedReq] = useState<SecurityRequestItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Owner password modal state (Delete final step)
  const [ownerPasswordModalReq, setOwnerPasswordModalReq] = useState<SecurityRequestItem | null>(null);
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerPasswordError, setOwnerPasswordError] = useState('');
  const [isVerifyingOwner, setIsVerifyingOwner] = useState(false);

  // Owner update password state
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passUpdateMsg, setPassUpdateMsg] = useState<{ text: string; success: boolean } | null>(null);

  // Pending upload review state
  const [selectedPending, setSelectedPending] = useState<PendingUploadItem | null>(null);
  const [pendingDecisionNotes, setPendingDecisionNotes] = useState<string>('');
  const [isProcessingPending, setIsProcessingPending] = useState<boolean>(false);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const resSec = await fetch('/api/security/dashboard');
      const dataSec = await resSec.json();
      if (dataSec.success) {
        setRequests(dataSec.requests || []);
        setAuditLogs(dataSec.auditLogs || []);
      }

      // Fetch pending uploads & LFS status
      const headers: Record<string, string> = {};
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
      const resPending = await fetch('/api/admin/pending', { headers });
      const dataPending = await resPending.json();
      if (dataPending.success) {
        setPendingUploads(dataPending.pendingList || []);
        setLfsStatus(dataPending.lfsStatus || null);
      }

      // Fetch Git LFS environment report
      const resLfs = await fetch('/api/lfs/status');
      const dataLfs = await resLfs.json();
      if (dataLfs.success) {
        if (dataLfs.status) setLfsStatus(dataLfs.status);
        if (dataLfs.envReport) setEnvReport(dataLfs.envReport);
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const runLfsTestCycle = async () => {
    setIsRunningLfsTest(true);
    setLfsTestError('');
    setLfsTestReport(null);
    try {
      const headers: Record<string, string> = {};
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      } else if (adminPasswordInput) {
        headers['x-admin-password'] = adminPasswordInput;
      }
      const res = await fetch('/api/lfs/test-cycle', {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (data.success && data.testResult) {
        setLfsTestReport(data.testResult);
      } else {
        setLfsTestError(data.error || 'परीक्षण असफल भयो। Admin प्रमाणीकरण आवश्यक हुन सक्छ।');
      }
    } catch (err: any) {
      setLfsTestError(err.message || 'परीक्षण गर्दा नेटवर्क त्रुटि उत्पन्न भयो।');
    } finally {
      setIsRunningLfsTest(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [adminToken]);

  // Admin login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPasswordInput) return;

    setAdminLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPasswordInput })
      });
      const data = await res.json();
      if (data.success) {
        setAdminToken(data.token);
        setIsAdminLoggedIn(true);
        setAdminPasswordInput('');
        fetchDashboard();
      } else {
        setAdminLoginError(data.error || 'गलत Admin Password');
      }
    } catch (err: any) {
      setAdminLoginError(err.message || 'लगइन त्रुटि');
    }
  };

  // Admin Accept Pending Upload (Moves to library, tracks Git LFS, updates search index)
  const handleAcceptPending = async (item: PendingUploadItem) => {
    setIsProcessingPending(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
      // Fallback: prompt for password if not logged in
      let adminPass = '';
      if (!adminToken) {
        adminPass = prompt('कृपया Admin Password प्रविष्ट गर्नुहोस् (डिफल्ट: nepal@admin2082):') || '';
        if (!adminPass) {
          setIsProcessingPending(false);
          return;
        }
        headers['x-admin-password'] = adminPass;
      }

      const res = await fetch('/api/admin/accept', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: item.id,
          notes: pendingDecisionNotes || 'Admin द्वारा स्वीकृत गरिएको कागजात',
          reviewerName: 'Admin Officer'
        })
      });
      const data = await res.json();
      setIsProcessingPending(false);

      if (data.success) {
        alert(data.message || 'PDF फाइल स्वीकृत भयो र Search Index मा समावेश गरियो!');
        setSelectedPending(null);
        setPendingDecisionNotes('');
        fetchDashboard();
        onActionComplete();
      } else {
        alert(data.error || 'स्वीकृत असफल भयो।');
      }
    } catch (err: any) {
      setIsProcessingPending(false);
      alert(err.message || 'त्रुटि उत्पन्न भयो।');
    }
  };

  // Admin Reject Pending Upload (Quarantine delete)
  const handleRejectPending = async (item: PendingUploadItem) => {
    const reason = prompt('अस्वीकृत गर्नुको कारण लेख्नुहोस् (उदा. खारेज भएको ऐन, नक्कल, गुणस्तरहीन स्क्यान):');
    if (!reason) return;

    setIsProcessingPending(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
      if (!adminToken) {
        const adminPass = prompt('कृपया Admin Password प्रविष्ट गर्नुहोस् (डिफल्ट: nepal@admin2082):') || '';
        if (!adminPass) {
          setIsProcessingPending(false);
          return;
        }
        headers['x-admin-password'] = adminPass;
      }

      const res = await fetch('/api/admin/reject', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: item.id,
          reason,
          reviewerName: 'Admin Officer'
        })
      });
      const data = await res.json();
      setIsProcessingPending(false);

      if (data.success) {
        alert(data.message || 'अनुरोध अस्वीकृत गरियो।');
        fetchDashboard();
        onActionComplete();
      } else {
        alert(data.error || 'अस्वीकृत गर्न सकिएन।');
      }
    } catch (err: any) {
      setIsProcessingPending(false);
      alert(err.message || 'त्रुटि उत्पन्न भयो।');
    }
  };

  // Submit Developer Review for Delete
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

  const pendingUploadItems = pendingUploads.filter(p => p.status === 'PENDING');
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
              <span>Admin Review & Git LFS Security Panel</span>
              <span className="text-[11px] font-semibold bg-red-100 text-red-900 px-2 py-0.5 rounded-full">
                सुरक्षित अभिलेखीकरण
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              PDF Upload समीक्षा, Git LFS ट्र्याकिङ (&gt;50MB), २-चरण Delete सुरक्षा र Owner Password व्यवस्थापन
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdminLoggedIn ? (
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Admin प्रमाणीकृत
            </span>
          ) : (
            <form onSubmit={handleAdminLogin} className="flex items-center gap-1.5 text-xs">
              <input
                type="password"
                placeholder="Admin Password"
                value={adminPasswordInput}
                onChange={e => setAdminPasswordInput(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs w-32"
              />
              <button
                type="submit"
                className="bg-slate-800 text-white px-2.5 py-1 rounded font-semibold hover:bg-slate-900"
              >
                Admin लगइन
              </button>
            </form>
          )}

          <button
            onClick={fetchDashboard}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>रिफ्रेस</span>
          </button>
        </div>
      </div>

      {adminLoginError && (
        <div className="mb-3 p-2 bg-red-50 text-red-800 text-xs rounded border border-red-200">
          {adminLoginError}
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 mb-4 gap-2 text-xs font-bold overflow-x-auto">
        {/* Tab 1: Pending Uploads (Admin Review) */}
        <button
          onClick={() => setActiveSubTab('pending-uploads')}
          className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'pending-uploads'
              ? 'border-red-900 text-red-900 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Upload समीक्षा ({pendingUploadItems.length})</span>
        </button>

        {/* Tab 2: Git LFS Status */}
        <button
          onClick={() => setActiveSubTab('lfs-status')}
          className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'lfs-status'
              ? 'border-red-900 text-red-900 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span>Git LFS & Netrun स्थिति</span>
        </button>

        {/* Tab 3: Delete Requests */}
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

        {/* Tab 4: Trash */}
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

        {/* Tab 5: Audit Log */}
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

        {/* Tab 6: Owner Password */}
        <button
          onClick={() => setActiveSubTab('owner-settings')}
          className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'owner-settings'
              ? 'border-red-900 text-red-900 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Password सेटिङ</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* SubTab 1: Admin Review for Uploaded PDFs (Quarantine Staging) */}
      {/* ============================================================ */}
      {activeSubTab === 'pending-uploads' && (
        <div className="space-y-3">
          <div className="bg-amber-50/70 p-3 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>Admin Review नियम:</strong> प्रयोगकर्ताले अपलोड गरेका कुनै पनि PDF सिधै खोज वा पुस्तकालयमा समावेश हुँदैनन्। Admin ले समीक्षा गरी <strong>Accept</strong> गरेपछि मात्र सम्बन्धित फोल्डरमा सर्छ, Search Index मा जोडिन्छ र ५० MB भन्दा ठूलो भए <strong>Git LFS</strong> मार्फत GitHub मा सुरक्षित हुन्छ।
            </div>
          </div>

          {pendingUploadItems.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
              कुनै नयाँ PDF समीक्षाका लागि बाँकी छैन।
            </div>
          ) : (
            pendingUploadItems.map(item => {
              const isOver50MB = item.fileSizeBytes >= 50 * 1024 * 1024;
              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-bold flex items-center gap-1 text-slate-900">
                        <FileText className="w-4 h-4 text-red-800" />
                        {item.fileName}
                      </span>
                      <span className="text-slate-400">|</span>
                      <span className="text-slate-600">
                        गन्तव्य फोल्डर: <strong>{item.targetFolder}</strong>
                      </span>
                      <span className="text-slate-400">|</span>
                      <span className="bg-slate-200 text-slate-800 font-semibold px-2 py-0.5 rounded text-[11px]">
                        आकार: {item.fileSizeFormatted}
                      </span>
                      {isOver50MB ? (
                        <span className="bg-purple-100 text-purple-900 font-bold px-2 py-0.5 rounded text-[11px] border border-purple-200 flex items-center gap-1">
                          <GitBranch className="w-3 h-3 text-purple-700" />
                          Git LFS आवश्यक (&gt;50MB)
                        </span>
                      ) : (
                        <span className="bg-blue-50 text-blue-800 font-semibold px-2 py-0.5 rounded text-[11px]">
                          मानक PDF
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono">
                      SHA-256: {item.sha256} | अपलोडर: {item.uploadedBy} ({new Date(item.uploadedAt).toLocaleString()})
                    </div>

                    {item.uploaderNotes && (
                      <div className="text-xs text-slate-700 italic">
                        टिप्पणी: "{item.uploaderNotes}"
                      </div>
                    )}
                  </div>

                  {/* Accept / Reject Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRejectPending(item)}
                      disabled={isProcessingPending}
                      className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                      title="अस्वीकृत गर्नुहोस्"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject (अस्वीकृत)</span>
                    </button>

                    <button
                      onClick={() => handleAcceptPending(item)}
                      disabled={isProcessingPending}
                      className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                      title="स्वीकृत गर्नुहोस् र Search Index/Git LFS मा थप्नुहोस्"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Accept & Git LFS Publish</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* SubTab 2: Git LFS & Netrun Status */}
      {/* ============================================================ */}
      {activeSubTab === 'lfs-status' && (
        <div className="space-y-4 text-xs">
          {/* LFS Architecture Card */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <GitBranch className="w-4 h-4 text-purple-700" />
              Git LFS (Large File Storage) संरचना र नियमहरू
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <div className="text-slate-500 text-[11px] font-semibold">LFS थ्रेसहोल्ड</div>
                <div className="text-sm font-bold text-purple-900 mt-1">&gt; 50 MB (मेगाबाइट)</div>
                <div className="text-[11px] text-slate-400 mt-0.5">५० MB भन्दा ठूला PDF LFS बाट ट्र्याक हुन्छन्</div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <div className="text-slate-500 text-[11px] font-semibold">.gitattributes स्थिति</div>
                <div className="text-sm font-bold text-emerald-700 mt-1 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> सक्रिय (*.pdf filter=lfs)
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">स्वचालित Git LFS ट्र्याकिङ कन्फिगर गरिएको</div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <div className="text-slate-500 text-[11px] font-semibold">GitHub LFS Push स्थिति</div>
                <div className="text-sm font-bold text-slate-800 mt-1">
                  {envReport?.GITHUB_TOKEN.isSet ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> GITHUB_TOKEN उपलब्ध
                    </span>
                  ) : (
                    <span className="text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" /> Netrun Secrets मा थप्न बाँकी
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Admin Accept पछि स्वतः Git LFS मा पुस हुन्छ</div>
              </div>
            </div>
          </div>

          {/* 6 Required Environment Variables Status Card */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-700" />
                <span>आवश्यक ६ वटा Environment Variables स्थिति (Netrun Secrets)</span>
              </h4>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${envReport?.allRequiredSet ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {envReport?.allRequiredSet ? 'सबै चरहरू उपलब्ध छन्' : `${envReport?.missingVariables.length || 0} चरहरू थप्न बाँकी`}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              सुरक्षा नियम: यी सबै चरहरू Backend बाट <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">process.env</code> मार्फत मात्र पढिन्छन्। वास्तविक टोकन वा पासवर्ड कहिल्यै पनि Frontend वा कोडमा राखिँदैन।
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
              {/* 1. GITHUB_TOKEN */}
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[11px] text-slate-800">1. GITHUB_TOKEN</span>
                  {envReport?.GITHUB_TOKEN.isSet ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> सक्रिय
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5">
                      <AlertTriangle className="w-3 h-3" /> अनुपलब्ध
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">{envReport?.GITHUB_TOKEN.message || 'जाँच गरिँदै...'}</div>
              </div>

              {/* 2. GITHUB_OWNER */}
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[11px] text-slate-800">2. GITHUB_OWNER</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-semibold">
                    {envReport?.GITHUB_OWNER.isSet ? 'कन्फिगर' : 'Default'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-700">{envReport?.GITHUB_OWNER.value || 'barshapbp2026'}</div>
              </div>

              {/* 3. GITHUB_REPO */}
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[11px] text-slate-800">3. GITHUB_REPO</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-semibold">
                    {envReport?.GITHUB_REPO.isSet ? 'कन्फिगर' : 'Default'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-700">{envReport?.GITHUB_REPO.value || 'any-pdf-'}</div>
              </div>

              {/* 4. GITHUB_BRANCH */}
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[11px] text-slate-800">4. GITHUB_BRANCH</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-semibold">
                    {envReport?.GITHUB_BRANCH.isSet ? 'कन्फिगर' : 'Default'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-700">{envReport?.GITHUB_BRANCH.value || 'feature/full-nepali-pdf-search'}</div>
              </div>

              {/* 5. ADMIN_PASSWORD */}
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[11px] text-slate-800">5. ADMIN_PASSWORD</span>
                  {envReport?.ADMIN_PASSWORD.isSet ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> सक्रिय
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5">
                      <AlertTriangle className="w-3 h-3" /> अनुपलब्ध
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">{envReport?.ADMIN_PASSWORD.message || 'जाँच गरिँदै...'}</div>
              </div>

              {/* 6. ENABLE_GIT_LFS */}
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[11px] text-slate-800">6. ENABLE_GIT_LFS</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${envReport?.ENABLE_GIT_LFS.isEnabled ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-700'}`}>
                    {envReport?.ENABLE_GIT_LFS.isEnabled ? 'LFS सक्रिय (true)' : 'निष्क्रिय'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {envReport?.ENABLE_GIT_LFS.isEnabled
                    ? '५० MB भन्दा ठूला PDF LFS मार्फत व्यवस्थापन हुन्छन्'
                    : 'Git LFS ट्र्याकिङ बन्द छ'}
                </div>
              </div>
            </div>
          </div>

          {/* Real Git LFS Upload and Download Test Execution Card */}
          <div className="p-4 bg-purple-50/40 rounded-xl border border-purple-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-purple-950 text-sm flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4 text-purple-700" />
                  <span>Git LFS Upload र Download वास्तविक परीक्षण (Live Verification Test)</span>
                </h4>
                <p className="text-[11px] text-purple-700">
                  Pointer निर्माण, स्थानीय LFS Storage बाइनरी रिजोलुसन, र GitHub API जडानको वास्तविक परीक्षण गर्नुहोस्।
                </p>
              </div>

              <button
                type="button"
                onClick={runLfsTestCycle}
                disabled={isRunningLfsTest}
                className="bg-purple-800 text-white font-bold px-3.5 py-2 rounded-lg text-xs hover:bg-purple-900 transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRunningLfsTest ? 'animate-spin' : ''}`} />
                <span>{isRunningLfsTest ? 'परीक्षण चल्दैछ...' : 'परीक्षण सुरु गर्नुहोस्'}</span>
              </button>
            </div>

            {lfsTestError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{lfsTestError}</span>
              </div>
            )}

            {lfsTestReport && (
              <div className="bg-white p-3.5 rounded-lg border border-purple-200 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-800 text-xs">परीक्षण सारांश: {lfsTestReport.summary}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(lfsTestReport.timestamp).toLocaleTimeString('ne-NP')}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {lfsTestReport.steps.map((st, idx) => (
                    <div key={idx} className="p-2 rounded bg-slate-50 border border-slate-200/80 text-xs flex items-start gap-2">
                      {st.status === 'PASSED' && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                      {st.status === 'FAILED' && <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />}
                      {st.status === 'SKIPPED' && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <span>{st.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                            st.status === 'PASSED' ? 'bg-emerald-100 text-emerald-800' :
                            st.status === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {st.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600">{st.details}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Files Over 50MB */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900">
              पुस्तकालयमा रहेका ठूला PDF हरू (Git LFS ट्र्याक गरिएका)
            </h4>
            {lfsStatus?.largeFilesOver50MB && lfsStatus.largeFilesOver50MB.length > 0 ? (
              <div className="space-y-2">
                {lfsStatus.largeFilesOver50MB.map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-purple-50/60 border border-purple-200 text-purple-950">
                    <span className="font-bold">{f.folder} / {f.file}</span>
                    <span className="font-mono">{f.sizeMB}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 text-slate-500 rounded text-center">
                हाल कुनै पनि फाइल ५० MB भन्दा ठूलो छैन (नयाँ ठूला PDF अपलोड हुँदा स्वतः यहाँ देखिनेछन्)।
              </div>
            )}
          </div>

          {/* Netrun Deployment & Secrets Instructions */}
          <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2.5">
            <h4 className="font-bold text-sm flex items-center gap-1.5 text-amber-300">
              <Database className="w-4 h-4" />
              Netrun वातावरणमा Git LFS र Secrets कन्फिगरेसन निर्देशन
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Netrun वा Docker मा Deploy गर्दा Private Repository बाट Git LFS फाइलहरू तान्न निम्न आदेश र Secrets प्रयोग गर्नुहोस्:
            </p>
            <div className="bg-black/60 p-3 rounded font-mono text-[11px] text-emerald-400 space-y-1">
              <div># १. Netrun Build वा Start Script मा Git LFS सक्षम गर्ने:</div>
              <div className="text-white">git lfs install</div>
              <div className="text-white">git lfs pull</div>
              <div className="pt-2 text-slate-400"># २. Netrun Secrets प्यानलमा निम्न कुञ्जीहरू थप्नुहोस्:</div>
              <div>GITHUB_TOKEN="ghp_your_personal_access_token"</div>
              <div>GITHUB_OWNER="barshapbp2026"</div>
              <div>GITHUB_REPO="any-pdf-"</div>
              <div>GITHUB_BRANCH="feature/full-nepali-pdf-search"</div>
              <div>ADMIN_PASSWORD="nepal@admin2082"</div>
              <div>ENABLE_GIT_LFS="true"</div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SubTab 3: Delete Requests (Developer Review) */}
      {/* ============================================================ */}
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
                      यस फोल्डर भित्र <strong>{req.filesContained.length}</strong> वटा PDF फाइलहरू छन्
                    </div>
                  )}

                  {req.developerReview && (
                    <div className="text-[11px] bg-emerald-50 text-emerald-900 p-2 rounded border border-emerald-200 mt-1">
                      <strong>Developer टिप्पणी:</strong> {req.developerReview.notes} ({new Date(req.developerReview.reviewedAt).toLocaleString()})
                    </div>
                  )}
                </div>

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

      {/* SubTab 4: Trash */}
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

      {/* SubTab 5: Audit Log */}
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
                    log.action.includes('SUCCESS') || log.action.includes('RESTORE') || log.action.includes('ACCEPT')
                      ? 'bg-emerald-100 text-emerald-800'
                      : log.action.includes('FAIL') || log.action.includes('TRASH') || log.action.includes('REJECT')
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

      {/* SubTab 6: Owner Password Settings */}
      {activeSubTab === 'owner-settings' && (
        <div className="max-w-md p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-red-800" />
            Owner & Admin Password व्यवस्थापन
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
