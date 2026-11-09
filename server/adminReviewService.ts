import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { gitLfsService } from './gitLfsService.js';
import { securityManager } from './securityService.js';
import { pdfIndexStore } from './pdfIndexer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const DOCUMENTS_ROOT = path.join(__dirname, '..', 'public', 'documents');
const PRIMARY_PENDING_DIR = path.join(DATA_DIR, 'pending_staging');
const PENDING_DIR = path.join(DOCUMENTS_ROOT, '.pending_review');
const ADMIN_CONFIG_FILE = path.join(DATA_DIR, 'admin_config.json');
const PENDING_STORE_FILE = path.join(DATA_DIR, 'pending_reviews.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(PRIMARY_PENDING_DIR)) fs.mkdirSync(PRIMARY_PENDING_DIR, { recursive: true });
if (!fs.existsSync(PENDING_DIR)) fs.mkdirSync(PENDING_DIR, { recursive: true });

export interface PendingUpload {
  id: string;
  fileName: string;
  targetFolder: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  sha256: string;
  stagingPath: string; // Relative to PENDING_DIR
  uploadedAt: string;
  uploadedBy: string;
  uploaderNotes?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  adminDecision?: {
    reviewedAt: string;
    reviewer: string;
    decision: 'ACCEPTED' | 'REJECTED';
    notes: string;
    isLfsTracked: boolean;
    githubPushed: boolean;
  };
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

class AdminReviewManager {
  private adminSalt: string = '';
  private adminHash: string = '';
  private pendingList: PendingUpload[] = [];
  private activeSessions: Map<string, { username: string; expiresAt: number }> = new Map();

  constructor() {
    this.loadAdminConfig();
    this.loadPendingList();
  }

  private loadAdminConfig() {
    if (fs.existsSync(ADMIN_CONFIG_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(ADMIN_CONFIG_FILE, 'utf-8'));
        this.adminSalt = data.salt || '';
        this.adminHash = data.hash || '';
      } catch (err) {
        console.error('Error loading admin config:', err);
      }
    }
    // Default initial password setup if none exists
    if (!this.adminHash) {
      const defaultPass = process.env.ADMIN_PASSWORD || 'nepal@admin2082';
      this.setAdminPassword(defaultPass);
    }
  }

  private saveAdminConfig() {
    fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify({ salt: this.adminSalt, hash: this.adminHash }, null, 2));
  }

  private loadPendingList() {
    if (fs.existsSync(PENDING_STORE_FILE)) {
      try {
        this.pendingList = JSON.parse(fs.readFileSync(PENDING_STORE_FILE, 'utf-8'));
      } catch {
        this.pendingList = [];
      }
    }
  }

  private savePendingList() {
    fs.writeFileSync(PENDING_STORE_FILE, JSON.stringify(this.pendingList, null, 2));
  }

  public setAdminPassword(password: string): boolean {
    if (!password || password.length < 6) return false;
    this.adminSalt = crypto.randomBytes(16).toString('hex');
    this.adminHash = hashPassword(password, this.adminSalt);
    this.saveAdminConfig();
    securityManager.logAction('OWNER_PASSWORD_SUCCESS', 'Admin Security', 'Admin password initialized or updated', 'System');
    return true;
  }

  public verifyAdminPassword(password: string): boolean {
    if (!password) return false;
    
    // Check against Netrun Secrets ADMIN_PASSWORD first
    const envPass = process.env.ADMIN_PASSWORD;
    if (envPass && password === envPass) {
      return true;
    }

    // Check against salted PBKDF2 hash
    if (this.adminHash && this.adminSalt) {
      const computed = hashPassword(password, this.adminSalt);
      if (computed === this.adminHash) return true;
    }

    // Default fallback if neither is configured
    if (!envPass && !this.adminHash) {
      return password === 'nepal@admin2082';
    }

    return false;
  }

  public createSession(): string {
    const token = crypto.randomBytes(32).toString('hex');
    // Session valid for 8 hours
    this.activeSessions.set(token, {
      username: 'Administrator',
      expiresAt: Date.now() + 8 * 60 * 60 * 1000
    });
    return token;
  }

  public isValidSession(token?: string): boolean {
    if (!token) return false;
    const session = this.activeSessions.get(token);
    if (!session) return false;
    if (Date.now() > session.expiresAt) {
      this.activeSessions.delete(token);
      return false;
    }
    return true;
  }

  /**
   * Check for duplicate files using SHA-256 hash across both pending and published documents
   */
  public checkForDuplicate(sha256: string): { isDuplicate: boolean; existingLocation?: string } {
    // 1. Check in pending list
    const pendingDup = this.pendingList.find(p => p.status === 'PENDING' && p.sha256 === sha256);
    if (pendingDup) {
      return { isDuplicate: true, existingLocation: `पेन्डिङ सूचीमा पहिले नै उपस्थित (${pendingDup.fileName})` };
    }

    // 2. Check in published documents
    if (fs.existsSync(DOCUMENTS_ROOT)) {
      const folders = fs.readdirSync(DOCUMENTS_ROOT, { withFileTypes: true });
      for (const f of folders) {
        if (f.isDirectory() && !f.name.startsWith('.')) {
          const folderPath = path.join(DOCUMENTS_ROOT, f.name);
          const files = fs.readdirSync(folderPath).filter(fl => fl.toLowerCase().endsWith('.pdf'));
          for (const file of files) {
            try {
              const buf = fs.readFileSync(path.join(folderPath, file));
              const fileHash = gitLfsService.calculateSha256(buf);
              if (fileHash === sha256) {
                return { isDuplicate: true, existingLocation: `${f.name}/${file}` };
              }
            } catch {}
          }
        }
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Stage an uploaded PDF for Admin Review (Quarantine)
   */
  public stageUpload(
    targetFolder: string,
    fileName: string,
    fileBuffer: Buffer,
    uploadedBy: string = 'User',
    uploaderNotes?: string
  ): { success: boolean; pendingItem?: PendingUpload; error?: string } {
    const sha256 = gitLfsService.calculateSha256(fileBuffer);

    // Duplicate check
    const dupCheck = this.checkForDuplicate(sha256);
    if (dupCheck.isDuplicate) {
      return {
        success: false,
        error: `यो PDF फाइल पहिले नै प्रणालीमा उपलब्ध छ (हुबहु सामग्री)। स्थान: ${dupCheck.existingLocation}`
      };
    }

    const id = 'pnd_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const safeTargetFolder = targetFolder.replace(/[\/\\:*?"<>|]/g, '').trim();
    let safeFileName = fileName.replace(/[\/\\:*?"<>|]/g, '').trim();
    if (!safeFileName.toLowerCase().endsWith('.pdf')) {
      safeFileName += '.pdf';
    }

    const stagedFileName = `${id}_${safeFileName}`;
    const stagingFullPath = path.join(PRIMARY_PENDING_DIR, stagedFileName);

    fs.writeFileSync(stagingFullPath, fileBuffer);

    const pendingItem: PendingUpload = {
      id,
      fileName: safeFileName,
      targetFolder: safeTargetFolder,
      fileSizeBytes: fileBuffer.length,
      fileSizeFormatted: (fileBuffer.length / 1024 / 1024).toFixed(2) + ' MB',
      sha256,
      stagingPath: stagedFileName,
      uploadedAt: new Date().toISOString(),
      uploadedBy,
      uploaderNotes,
      status: 'PENDING'
    };

    this.pendingList.unshift(pendingItem);
    this.savePendingList();

    securityManager.logAction(
      'UPLOAD_FILE',
      safeFileName,
      `Staged for Admin Review into "${safeTargetFolder}" (${pendingItem.fileSizeFormatted}, SHA: ${sha256.slice(0, 10)})`,
      uploadedBy
    );

    return { success: true, pendingItem };
  }

  /**
   * Helper to locate staged file across primary (data/pending_staging) and legacy (public/documents/.pending_review)
   */
  private resolveStagingFilePath(stagingPath: string): string | null {
    const primary = path.join(PRIMARY_PENDING_DIR, stagingPath);
    if (fs.existsSync(primary)) return primary;

    const legacy = path.join(PENDING_DIR, stagingPath);
    if (fs.existsSync(legacy)) return legacy;

    return null;
  }

  /**
   * Admin Accept: Move to published documents, sync Git LFS, and update search index
   */
  public async acceptUpload(
    id: string,
    adminName: string = 'Administrator',
    adminNotes: string = 'स्वीकृत गरियो'
  ): Promise<{ success: boolean; error?: string; message?: string; item?: PendingUpload }> {
    const item = this.pendingList.find(p => p.id === id);
    if (!item) return { success: false, error: 'पेन्डिङ वस्तु फेला परेन।' };

    if (item.status !== 'PENDING') {
      return { success: false, error: 'यो वस्तु पहिले नै समीक्षा भइसकेको छ।' };
    }

    const stagingFullPath = this.resolveStagingFilePath(item.stagingPath);
    if (!stagingFullPath || !fs.existsSync(stagingFullPath)) {
      return {
        success: false,
        error: `Staging फाइल फेला परेन (${item.stagingPath})। कृपया पुनः अपलोड गर्नुहोस्।`
      };
    }

    const targetDir = path.join(DOCUMENTS_ROOT, item.targetFolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    let finalFileName = item.fileName;
    let finalFullPath = path.join(targetDir, finalFileName);
    // Avoid overwrite: if same filename exists, append timestamp
    if (fs.existsSync(finalFullPath)) {
      const base = path.basename(finalFileName, '.pdf');
      finalFileName = `${base}_${Date.now()}.pdf`;
      finalFullPath = path.join(targetDir, finalFileName);
    }

    const fileBuffer = fs.readFileSync(stagingFullPath);

    // 1. Move to published documents
    fs.renameSync(stagingFullPath, finalFullPath);

    // 2. Git LFS & GitHub processing
    const lfsResult = await gitLfsService.processAcceptedPdf(item.targetFolder, finalFileName, fileBuffer);

    // 3. Immediately index into local search engine
    try {
      await pdfIndexStore.indexFile(finalFullPath, item.targetFolder);
    } catch (idxErr: any) {
      console.warn(`Indexing notice for ${finalFileName}: ${idxErr.message}`);
    }

    // 4. Update status
    item.status = 'ACCEPTED';
    item.fileName = finalFileName;
    item.adminDecision = {
      reviewedAt: new Date().toISOString(),
      reviewer: adminName,
      decision: 'ACCEPTED',
      notes: adminNotes,
      isLfsTracked: lfsResult.isLfs,
      githubPushed: lfsResult.pushedToGitHub
    };

    this.savePendingList();

    securityManager.logAction(
      'UPLOAD_FILE',
      finalFileName,
      `Admin Accepted and published to "${item.targetFolder}". GitHub Pushed: ${lfsResult.pushedToGitHub ? 'Yes' : 'No'}. Notes: ${adminNotes}`,
      adminName
    );

    return {
      success: true,
      message: `सफलतापूर्वक स्वीकृत भयो! ${lfsResult.message}`,
      item
    };
  }

  /**
   * Admin Reject: Remove from staging and do not publish or index
   */
  public rejectUpload(
    id: string,
    adminName: string = 'Administrator',
    rejectReason: string = 'अस्वीकृत गरियो'
  ): { success: boolean; error?: string; message?: string } {
    const item = this.pendingList.find(p => p.id === id);
    if (!item) return { success: false, error: 'पेन्डिङ वस्तु फेला परेन।' };

    if (item.status !== 'PENDING') {
      return { success: false, error: 'यो वस्तु पहिले नै समीक्षा भइसकेको छ।' };
    }

    const stagingFullPath = this.resolveStagingFilePath(item.stagingPath);
    if (stagingFullPath && fs.existsSync(stagingFullPath)) {
      fs.unlinkSync(stagingFullPath);
    }

    item.status = 'REJECTED';
    item.adminDecision = {
      reviewedAt: new Date().toISOString(),
      reviewer: adminName,
      decision: 'REJECTED',
      notes: rejectReason,
      isLfsTracked: false,
      githubPushed: false
    };

    this.savePendingList();

    securityManager.logAction(
      'DEVELOPER_REJECT',
      item.fileName,
      `Admin Rejected: ${rejectReason}. Staged file deleted.`,
      adminName
    );

    return {
      success: true,
      message: 'अनुरोध सफलतापूर्वक अस्वीकृत गरियो र क्वारेन्टिनबाट फाइल हटाइयो।'
    };
  }

  public getPendingList(): PendingUpload[] {
    return this.pendingList;
  }
}

export const adminReviewManager = new AdminReviewManager();
