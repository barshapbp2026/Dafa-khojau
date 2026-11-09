import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pdfIndexStore } from './server/pdfIndexer.js';
import { testGeminiApiKey, queryInsidePdf, queryOutsidePdf } from './server/geminiService.js';
import { securityManager } from './server/securityService.js';
import { gitLfsService } from './server/gitLfsService.js';
import { adminReviewManager } from './server/adminReviewService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const DOCUMENTS_ROOT = path.join(__dirname, 'public', 'documents');

// Ensure documents directory exists
if (!fs.existsSync(DOCUMENTS_ROOT)) {
  fs.mkdirSync(DOCUMENTS_ROOT, { recursive: true });
}

app.use(express.json({ limit: '75mb' }));
app.use(express.urlencoded({ extended: true, limit: '75mb' }));

// Helper middleware for Admin Authorization
function checkAdminAuth(req: Request): boolean {
  const token = req.headers['authorization']?.replace('Bearer ', '') ||
                (req.headers['x-admin-token'] as string) ||
                (req.query.token as string);
  if (token && adminReviewManager.isValidSession(token)) {
    return true;
  }
  const passHeader = req.headers['x-admin-password'] as string;
  if (passHeader && adminReviewManager.verifyAdminPassword(passHeader)) {
    return true;
  }
  return false;
}

// Helper to scan documents directory (excluding hidden/trash/pending)
function getFolderTree() {
  if (!fs.existsSync(DOCUMENTS_ROOT)) return [];
  const entries = fs.readdirSync(DOCUMENTS_ROOT, { withFileTypes: true });
  const folders: {
    folderName: string;
    path: string;
    files: {
      name: string;
      relativePath: string;
      sizeBytes: number;
      sizeFormatted: string;
      mtime: Date;
      isIndexed: boolean;
      isLfsTracked: boolean;
    }[];
  }[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const folderPath = path.join(DOCUMENTS_ROOT, entry.name);
      const files = fs.readdirSync(folderPath, { withFileTypes: true })
        .filter(f => f.isFile() && f.name.toLowerCase().endsWith('.pdf'))
        .map(f => {
          const filePath = path.join(folderPath, f.name);
          const stats = fs.statSync(filePath);
          const isIndexed = !!pdfIndexStore.getDocument(filePath);
          const isLfsTracked = gitLfsService.shouldTrackWithLfs(stats.size);
          return {
            name: f.name,
            relativePath: path.join(entry.name, f.name),
            sizeBytes: stats.size,
            sizeFormatted: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
            mtime: stats.mtime,
            isIndexed,
            isLfsTracked
          };
        });

      folders.push({
        folderName: entry.name,
        path: folderPath,
        files
      });
    }
  }
  return folders;
}

// 1. Get Folder Tree & PDF files
app.get('/api/folders', (req: Request, res: Response) => {
  try {
    const tree = getFolderTree();
    const loadedFolders = pdfIndexStore.getLoadedFolders();
    const docCount = pdfIndexStore.getDocumentCount();
    const allDocs = pdfIndexStore.getAllDocuments();
    const totalPages = allDocs.reduce((acc, d) => acc + d.totalPages, 0);

    // Pending review count
    const pendingList = adminReviewManager.getPendingList();
    const pendingCount = pendingList.filter(p => p.status === 'PENDING').length;

    res.json({
      success: true,
      folders: tree,
      loadedFolders,
      pendingCount,
      stats: {
        totalIndexedPdfs: docCount,
        totalPagesIndexed: totalPages,
        totalDafas: allDocs.reduce((acc, d) => acc + d.dafas.length, 0),
        totalAnusuchis: allDocs.reduce((acc, d) => acc + d.anusuchis.length, 0),
        totalSabdaHeaders: allDocs.reduce((acc, d) => acc + d.sabdaHeaders.length, 0)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Create New Folder
app.post('/api/folders/create', (req: Request, res: Response) => {
  try {
    const { folderName } = req.body;
    if (!folderName || typeof folderName !== 'string') {
      return res.status(400).json({ success: false, error: 'फोल्डरको नाम आवश्यक छ।' });
    }
    const safeName = folderName.replace(/[\/\\:*?"<>|]/g, '').trim();
    if (!safeName) {
      return res.status(400).json({ success: false, error: 'अमान्य फोल्डर नाम।' });
    }
    const targetDir = path.join(DOCUMENTS_ROOT, safeName);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      securityManager.logAction('CREATE_FOLDER', safeName, `New folder created: ${safeName}`, 'User');
    }
    res.json({ success: true, folderName: safeName });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Rename Folder
app.post('/api/folders/rename', (req: Request, res: Response) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName) {
      return res.status(400).json({ success: false, error: 'पुरानो र नयाँ फोल्डर नाम आवश्यक छ।' });
    }
    const safeOld = oldName.replace(/[\/\\:*?"<>|]/g, '').trim();
    const safeNew = newName.replace(/[\/\\:*?"<>|]/g, '').trim();
    const oldPath = path.join(DOCUMENTS_ROOT, safeOld);
    const newPath = path.join(DOCUMENTS_ROOT, safeNew);

    if (!fs.existsSync(oldPath)) {
      return res.status(404).json({ success: false, error: 'पुरानो फोल्डर फेला परेन।' });
    }
    if (fs.existsSync(newPath) && safeOld !== safeNew) {
      return res.status(400).json({ success: false, error: 'उक्त नामको फोल्डर पहिल्यै अवस्थित छ।' });
    }

    fs.renameSync(oldPath, newPath);
    pdfIndexStore.renameFolder(safeOld, safeNew);
    securityManager.logAction('RENAME_FOLDER', safeOld, `Folder renamed from "${safeOld}" to "${safeNew}"`, 'User');

    res.json({ success: true, oldName: safeOld, newName: safeNew });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Rename PDF File
app.post('/api/files/rename', (req: Request, res: Response) => {
  try {
    const { folderName, oldFileName, newFileName } = req.body;
    if (!folderName || !oldFileName || !newFileName) {
      return res.status(400).json({ success: false, error: 'फोल्डर, पुरानो नाम र नयाँ नाम आवश्यक छ।' });
    }
    const safeOld = oldFileName.replace(/[\/\\:*?"<>|]/g, '').trim();
    let safeNew = newFileName.replace(/[\/\\:*?"<>|]/g, '').trim();
    if (!safeNew.toLowerCase().endsWith('.pdf')) {
      safeNew += '.pdf';
    }

    const folderDir = path.join(DOCUMENTS_ROOT, folderName);
    const oldFilePath = path.join(folderDir, safeOld);
    const newFilePath = path.join(folderDir, safeNew);

    if (!fs.existsSync(oldFilePath)) {
      return res.status(404).json({ success: false, error: 'पुरानो PDF फाइल फेला परेन।' });
    }
    if (fs.existsSync(newFilePath) && safeOld !== safeNew) {
      return res.status(400).json({ success: false, error: 'यो नामको PDF फाइल यस फोल्डरमा पहिल्यै छ (Overwrite निषेध गरिएको छ)।' });
    }

    fs.renameSync(oldFilePath, newFilePath);
    pdfIndexStore.renameDocument(oldFilePath, newFilePath, safeNew);
    securityManager.logAction('RENAME_FILE', safeOld, `PDF renamed from "${safeOld}" to "${safeNew}" in "${folderName}"`, 'User');

    res.json({ success: true, oldFileName: safeOld, newFileName: safeNew });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Move PDF File to Another Folder
app.post('/api/files/move', (req: Request, res: Response) => {
  try {
    const { sourceFolder, targetFolder, fileName } = req.body;
    if (!sourceFolder || !targetFolder || !fileName) {
      return res.status(400).json({ success: false, error: 'स्रोत फोल्डर, गन्तव्य फोल्डर र फाइल नाम आवश्यक छ।' });
    }
    const sourceFilePath = path.join(DOCUMENTS_ROOT, sourceFolder, fileName);
    const targetDir = path.join(DOCUMENTS_ROOT, targetFolder);
    const targetFilePath = path.join(targetDir, fileName);

    if (!fs.existsSync(sourceFilePath)) {
      return res.status(404).json({ success: false, error: 'स्रोत PDF फाइल फेला परेन।' });
    }
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    if (fs.existsSync(targetFilePath) && sourceFolder !== targetFolder) {
      return res.status(400).json({ success: false, error: 'गन्तव्य फोल्डरमा उही नामको फाइल पहिल्यै छ। Overwrite हुनबाट रोकियो।' });
    }

    fs.renameSync(sourceFilePath, targetFilePath);
    pdfIndexStore.renameDocument(sourceFilePath, targetFilePath, fileName);
    securityManager.logAction('MOVE_FILE', fileName, `Moved from "${sourceFolder}" to "${targetFolder}"`, 'User');

    res.json({ success: true, message: `PDF फाइल सफलतापूर्वक "${targetFolder}" मा सारियो।` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Upload PDF file -> Staged for Admin Review with Duplicate Check & Git LFS Awareness
app.post('/api/upload', (req: Request, res: Response) => {
  try {
    const { folderName, fileName, base64Content, uploaderNotes, uploadedBy } = req.body;
    if (!folderName || !fileName || !base64Content) {
      return res.status(400).json({ success: false, error: 'अधुरो डाटा। फोल्डर, नाम र फाइल सामग्री आवश्यक छ।' });
    }

    const buffer = Buffer.from(base64Content, 'base64');
    const stageResult = adminReviewManager.stageUpload(
      folderName,
      fileName,
      buffer,
      uploadedBy || 'User',
      uploaderNotes
    );

    if (!stageResult.success) {
      return res.status(400).json({ success: false, error: stageResult.error });
    }

    const isLfs = gitLfsService.shouldTrackWithLfs(buffer.length);

    res.json({
      success: true,
      pendingItem: stageResult.pendingItem,
      isLfs,
      message: isLfs
        ? 'ठूलो PDF (50 MB भन्दा बढी) पत्ता लाग्यो। Admin Review पछि Git LFS मार्फत GitHub मा सुरक्षित गरिनेछ।'
        : 'PDF फाइल सफलतापूर्वक समीक्षाका लागि Staging मा दर्ता भयो। Admin ले स्वीकृत गरेपछि मात्र प्रकाशित हुनेछ।'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Admin Review & Git LFS Endpoints
// ==========================================

// Admin Login
app.post('/api/admin/login', (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: 'पासवर्ड आवश्यक छ।' });
    }
    const isValid = adminReviewManager.verifyAdminPassword(password);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'गलत Admin Password।' });
    }
    const token = adminReviewManager.createSession();
    res.json({ success: true, token, message: 'Admin लगइन सफल।' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Pending Uploads for Admin
app.get('/api/admin/pending', (req: Request, res: Response) => {
  try {
    const list = adminReviewManager.getPendingList();
    const lfsStatus = gitLfsService.getRepositoryLfsStatus(DOCUMENTS_ROOT);
    res.json({
      success: true,
      pendingList: list,
      lfsStatus,
      isGitHubConfigured: !!process.env.GITHUB_TOKEN
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Accept Upload
app.post('/api/admin/accept', async (req: Request, res: Response) => {
  try {
    if (!checkAdminAuth(req)) {
      return res.status(403).json({ success: false, error: 'अनधिकृत पहुँच। Admin प्रमाणीकरण आवश्यक छ।' });
    }
    const { id, notes, reviewerName } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Pending ID आवश्यक छ।' });
    }

    const result = await adminReviewManager.acceptUpload(id, reviewerName || 'Admin', notes || 'स्वीकृत');
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Reject Upload
app.post('/api/admin/reject', (req: Request, res: Response) => {
  try {
    if (!checkAdminAuth(req)) {
      return res.status(403).json({ success: false, error: 'अनधिकृत पहुँच। Admin प्रमाणीकरण आवश्यक छ।' });
    }
    const { id, reason, reviewerName } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Pending ID आवश्यक छ।' });
    }

    const result = adminReviewManager.rejectUpload(id, reviewerName || 'Admin', reason || 'अस्वीकृत');
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Git LFS Repository Status & Environment Check
app.get('/api/lfs/status', (req: Request, res: Response) => {
  try {
    const status = gitLfsService.getRepositoryLfsStatus(DOCUMENTS_ROOT);
    const envReport = gitLfsService.getEnvStatusReport();
    res.json({
      success: true,
      status,
      envReport,
      gitLfsConfig: {
        thresholdMB: 50,
        isLfsEnabled: gitLfsService.isLfsEnabled(),
        gitattributesExists: fs.existsSync(path.join(__dirname, '.gitattributes')),
        gitHubConfigured: envReport.GITHUB_TOKEN.isSet,
        branch: envReport.GITHUB_BRANCH.value,
        owner: envReport.GITHUB_OWNER.value,
        repo: envReport.GITHUB_REPO.value
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Git LFS Real Upload and Download Test Cycle
app.post('/api/lfs/test-cycle', async (req: Request, res: Response) => {
  try {
    if (!checkAdminAuth(req)) {
      return res.status(403).json({ success: false, error: 'अनधिकृत पहुँच। Admin प्रमाणीकरण आवश्यक छ।' });
    }
    const testResult = await gitLfsService.testLfsUploadAndDownload();
    res.json({
      success: true,
      testResult
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Delete Security & 2-Step Protection Endpoints
// ==========================================

// Security: Request Deletion (Step 1)
app.post('/api/security/delete-request', (req: Request, res: Response) => {
  try {
    const { itemType, targetPath, targetName, folderName, reason, requestedBy } = req.body;
    if (!itemType || !targetPath || !targetName || !reason) {
      return res.status(400).json({ success: false, error: 'Delete अनुरोधका लागि वस्तुको प्रकार, नाम र कारण अनिवार्य छ।' });
    }

    let filesContained: string[] = [];
    if (itemType === 'folder') {
      const folderFull = path.join(DOCUMENTS_ROOT, targetPath);
      if (fs.existsSync(folderFull)) {
        filesContained = fs.readdirSync(folderFull).filter(f => f.toLowerCase().endsWith('.pdf'));
      }
    }

    const newRequest = securityManager.createDeleteRequest(
      itemType,
      targetPath,
      targetName,
      folderName || targetName,
      reason,
      requestedBy || 'User',
      filesContained
    );

    res.json({
      success: true,
      message: 'Delete अनुरोध दर्ता भयो। अब यो Developer Review मा पठाइएको छ।',
      request: newRequest
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Security: Developer Review (Step 2)
app.post('/api/security/developer-review', (req: Request, res: Response) => {
  try {
    const { requestId, decision, notes, developerName } = req.body;
    if (!requestId || !decision || !notes) {
      return res.status(400).json({ success: false, error: 'RequestId, decision र समीक्षा टिप्पणी आवश्यक छ।' });
    }

    const result = securityManager.reviewRequest(requestId, decision, notes, developerName || 'Senior Developer');
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: decision === 'APPROVED'
        ? 'Developer द्वारा स्वीकृत। अब अन्तिम Delete का लागि Owner Password आवश्यक छ।'
        : 'Developer द्वारा Delete अनुरोध अस्वीकृत गरियो।',
      request: result.request
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Security: Owner Password Final Approval & Move to Trash (Step 3)
app.post('/api/security/owner-confirm-delete', (req: Request, res: Response) => {
  try {
    const { requestId, ownerPassword } = req.body;
    if (!requestId || !ownerPassword) {
      return res.status(400).json({ success: false, error: 'अन्तिम Delete का लागि Owner Password अनिवार्य छ।' });
    }

    const result = securityManager.executeOwnerDelete(requestId, ownerPassword, DOCUMENTS_ROOT);
    if (!result.success) {
      return res.status(403).json(result);
    }

    // Clean up memory index
    if (result.request?.itemType === 'pdf') {
      const fullPath = path.join(DOCUMENTS_ROOT, result.request.targetPath);
      pdfIndexStore.removeDocument(fullPath);
    }

    res.json({
      success: true,
      message: 'Owner Password प्रमाणीकरण सफल! वस्तु सुरक्षित Trash (Soft Delete) मा सारियो।',
      request: result.request
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Security: Restore from Trash
app.post('/api/security/restore', (req: Request, res: Response) => {
  try {
    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ success: false, error: 'RequestId आवश्यक छ।' });
    }

    const result = securityManager.restoreFromTrash(requestId, DOCUMENTS_ROOT);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: 'Trash बाट सफलतापूर्वक पुनर्स्थापना (Restore) गरियो।',
      request: result.request
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Security: Get Requests & Audit Logs
app.get('/api/security/dashboard', (req: Request, res: Response) => {
  try {
    const requests = securityManager.getRequests();
    const auditLogs = securityManager.getAuditLogs();
    const isOwnerPasswordSet = securityManager.isOwnerPasswordSet();

    res.json({
      success: true,
      isOwnerPasswordSet,
      pendingDeveloperCount: requests.filter(r => r.status === 'PENDING_DEVELOPER').length,
      pendingOwnerCount: requests.filter(r => r.status === 'APPROVED_BY_DEVELOPER').length,
      trashCount: requests.filter(r => r.status === 'EXECUTED_TRASH').length,
      requests,
      auditLogs
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Security: Set/Update Owner Password
app.post('/api/security/owner-set-password', (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'नयाँ पासवर्ड कम्तीमा ६ अक्षरको हुनुपर्छ।' });
    }

    if (securityManager.isOwnerPasswordSet()) {
      if (!currentPassword || !securityManager.verifyOwnerPassword(currentPassword)) {
        return res.status(403).json({ success: false, error: 'पुरानो Owner Password मिलेन।' });
      }
    }

    const success = securityManager.setOwnerPassword(newPassword);
    if (!success) {
      return res.status(400).json({ success: false, error: 'पासवर्ड सुरक्षित गर्न सकिएन।' });
    }

    res.json({ success: true, message: 'Owner Password सफलतापूर्वक अद्यावधिक भयो।' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Load & Index Selected Folders or Single PDF
app.post('/api/load-selected', async (req: Request, res: Response) => {
  try {
    const { selectedFolders, singleFolder, singlePdf, mode } = req.body;
    if (req.body.clearPrevious) {
      pdfIndexStore.clear();
    }

    const filesToIndex: { filePath: string; folderName: string }[] = [];

    if (mode === 'single' && singleFolder && singlePdf) {
      const filePath = path.join(DOCUMENTS_ROOT, singleFolder, singlePdf);
      if (fs.existsSync(filePath)) {
        filesToIndex.push({ filePath, folderName: singleFolder });
      }
    } else if (Array.isArray(selectedFolders) && selectedFolders.length > 0) {
      for (const folder of selectedFolders) {
        const folderDir = path.join(DOCUMENTS_ROOT, folder);
        if (fs.existsSync(folderDir)) {
          const files = fs.readdirSync(folderDir).filter(f => f.toLowerCase().endsWith('.pdf'));
          for (const file of files) {
            filesToIndex.push({ filePath: path.join(folderDir, file), folderName: folder });
          }
        }
      }
    }

    if (filesToIndex.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'कुनै पनि PDF फाइल फेला परेन। कृपया कम्तीमा एउटा फोल्डर वा PDF छान्नुहोस्।'
      });
    }

    for (const item of filesToIndex) {
      await pdfIndexStore.indexFile(item.filePath, item.folderName);
    }

    const allDocs = pdfIndexStore.getAllDocuments();
    const memoryUsage = process.memoryUsage();

    res.json({
      success: true,
      message: `${filesToIndex.length} कागजात सफलतापूर्वक इन्डेक्स गरियो।`,
      indexedCount: filesToIndex.length,
      totalPages: allDocs.reduce((acc, d) => acc + d.totalPages, 0),
      totalDafas: allDocs.reduce((acc, d) => acc + d.dafas.length, 0),
      totalAnusuchis: allDocs.reduce((acc, d) => acc + d.anusuchis.length, 0),
      totalSabdaHeaders: allDocs.reduce((acc, d) => acc + d.sabdaHeaders.length, 0),
      memoryMB: (memoryUsage.heapUsed / 1024 / 1024).toFixed(1)
    });
  } catch (err: any) {
    console.error('Indexing error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Local Search Endpoint (Dhara, Dafa, Niyam, Nirdeshan, Anusuchi, Sabda)
app.post('/api/search', (req: Request, res: Response) => {
  try {
    const { type, query, scope, folder, pdf } = req.body;
    if (!type || !query) {
      return res.status(400).json({ success: false, error: 'खोजको प्रकार (type) र शब्द/नम्बर (query) आवश्यक छ।' });
    }

    let filterFolder = folder;
    let filterPdf = pdf;
    if (scope === 'multiple') {
      filterPdf = undefined;
    }

    const searchResponse = pdfIndexStore.search(type, query, filterFolder, filterPdf);
    res.json({
      success: true,
      query,
      type,
      results: searchResponse.results,
      notFoundMessage: searchResponse.notFoundMessage
    });
  } catch (err: any) {
    console.error('Search error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Page Content & Highlight data for PDF viewer
app.get('/api/pdf-content', (req: Request, res: Response) => {
  try {
    const folder = req.query.folder as string;
    const file = req.query.file as string;
    const pageNum = parseInt(req.query.page as string, 10);

    if (!folder || !file || isNaN(pageNum)) {
      return res.status(400).json({ success: false, error: 'फोल्डर, फाइल र पृष्ठ नम्बर आवश्यक छ।' });
    }

    const filePath = path.join(DOCUMENTS_ROOT, folder, file);
    const doc = pdfIndexStore.getDocument(filePath);

    if (!doc) {
      return res.status(404).json({ success: false, error: 'उक्त कागजात इन्डेक्स गरिएको छैन।' });
    }

    const targetPage = doc.pages.find(p => p.num === pageNum);
    if (!targetPage) {
      return res.status(404).json({ success: false, error: `पृष्ठ ${pageNum} फेला परेन।` });
    }

    const pageHeaders = [
      ...doc.dafas.filter(d => d.page === pageNum),
      ...doc.niyams.filter(n => n.page === pageNum),
      ...doc.dharas.filter(dh => dh.page === pageNum),
      ...doc.nirdeshans.filter(nd => nd.page === pageNum),
      ...doc.anusuchis.filter(a => a.page === pageNum)
    ];

    res.json({
      success: true,
      page: pageNum,
      totalPages: doc.totalPages,
      text: targetPage.text,
      headers: pageHeaders
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Stream Raw PDF File (Git LFS resolved binary)
app.get('/api/pdf-raw', async (req: Request, res: Response) => {
  try {
    const folder = req.query.folder as string;
    const file = req.query.file as string;
    if (!folder || !file) {
      return res.status(400).send('Folder and file parameters are required');
    }
    const filePath = path.join(DOCUMENTS_ROOT, folder, file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }

    const { buffer, isPointerOnly } = await gitLfsService.getResolvedPdfBuffer(filePath);

    res.setHeader('Content-Type', isPointerOnly ? 'text/plain' : 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file)}"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

// Gemini API Key Validation
app.post('/api/gemini/test-key', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ valid: false, error: 'कृपया Gemini API कुञ्जी प्रविष्ट गर्नुहोस्।' });
    }
    const result = await testGeminiApiKey(apiKey);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

// Gemini Chat 1: Inside PDF
app.post('/api/gemini/chat-inside', async (req: Request, res: Response) => {
  try {
    const { apiKey, question, selectedPdf } = req.body;
    if (!apiKey || !question) {
      return res.status(400).json({ success: false, error: 'API कुञ्जी र प्रश्न आवश्यक छ।' });
    }
    const result = await queryInsidePdf(apiKey, question, selectedPdf);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Inside PDF Chat Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Gemini Chat 2: Outside PDF / Internet Search Grounding
app.post('/api/gemini/chat-outside', async (req: Request, res: Response) => {
  try {
    const { apiKey, question, selectedPdf } = req.body;
    if (!apiKey || !question) {
      return res.status(400).json({ success: false, error: 'API कुञ्जी र प्रश्न आवश्यक छ।' });
    }
    const result = await queryOutsidePdf(apiKey, question, selectedPdf);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Outside PDF Chat Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Netrun / Cloud Run Health Check Endpoint (Instant 200 without heavy processing)
app.get(['/health', '/api/health', '/ping'], (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'Dafa-khojau',
    uptime: Math.round(process.uptime()),
    memoryMB: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1),
    timestamp: new Date().toISOString()
  });
});

// Start Server with Vite or Static Dist
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    const indexPath = path.join(distPath, 'index.html');

    if (fs.existsSync(distPath) && fs.existsSync(indexPath)) {
      app.use(express.static(distPath));
      app.get('*', (req: Request, res: Response) => {
        res.sendFile(indexPath);
      });
    } else {
      console.warn('[Production Notice] dist/index.html not found, fallback to dynamic server to prevent crash.');
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nepali Legal PDF Assistant server running on http://0.0.0.0:${PORT} (PID: ${process.pid}, NODE_ENV: ${process.env.NODE_ENV || 'development'})`);
  });

  // Graceful shutdown on SIGTERM / SIGINT to avoid unhandled forced kill
  const shutdown = (signal: string) => {
    console.log(`[Lifecycle] Received ${signal}. Closing server gracefully...`);
    server.close(() => {
      console.log('[Lifecycle] HTTP server closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
