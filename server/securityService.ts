import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const TRASH_DIR = path.join(__dirname, '..', 'public', 'documents', '.trash');
const CONFIG_FILE = path.join(DATA_DIR, 'owner_config.json');
const REQUESTS_FILE = path.join(DATA_DIR, 'security_requests.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit_logs.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(TRASH_DIR)) {
  fs.mkdirSync(TRASH_DIR, { recursive: true });
}

export interface SecurityRequest {
  id: string;
  itemType: 'folder' | 'pdf';
  targetPath: string;
  targetName: string;
  folderName: string;
  filesContained?: string[];
  reason: string;
  requestedAt: string;
  requestedBy: string;
  status: 'PENDING_DEVELOPER' | 'APPROVED_BY_DEVELOPER' | 'REJECTED' | 'EXECUTED_TRASH' | 'RESTORED';
  developerReview?: {
    reviewedAt: string;
    reviewedBy: string;
    notes: string;
    decision: 'APPROVED' | 'REJECTED';
  };
  ownerApproval?: {
    approvedAt: string;
    verifiedWithPassword: boolean;
  };
  trashedPath?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: 'REQUEST_DELETE' | 'DEVELOPER_APPROVE' | 'DEVELOPER_REJECT' | 'OWNER_PASSWORD_SUCCESS' | 'OWNER_PASSWORD_FAIL' | 'TRASH_MOVE' | 'RESTORE' | 'CREATE_FOLDER' | 'RENAME_FOLDER' | 'MOVE_FILE' | 'RENAME_FILE' | 'UPLOAD_FILE';
  targetName: string;
  details: string;
  actor: string;
  ip?: string;
}

// Password hashing helper (Salted SHA-256)
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

class SecurityManager {
  private ownerSalt: string = '';
  private ownerHash: string = '';
  private requests: SecurityRequest[] = [];
  private auditLogs: AuditLogEntry[] = [];

  constructor() {
    this.loadConfig();
    this.loadRequests();
    this.loadAuditLogs();
  }

  private loadConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        this.ownerSalt = data.salt || '';
        this.ownerHash = data.hash || '';
      } catch (err) {
        console.error('Error loading security config:', err);
      }
    }
    // Default initial password setup if none exists
    if (!this.ownerHash) {
      // Default initial password is "nepal@owner2082" with dynamic salt
      // User can change it anytime via the Owner Security panel
      this.setOwnerPassword('nepal@owner2082');
    }
  }

  private saveConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ salt: this.ownerSalt, hash: this.ownerHash }, null, 2));
  }

  private loadRequests() {
    if (fs.existsSync(REQUESTS_FILE)) {
      try {
        this.requests = JSON.parse(fs.readFileSync(REQUESTS_FILE, 'utf-8'));
      } catch {
        this.requests = [];
      }
    }
  }

  private saveRequests() {
    fs.writeFileSync(REQUESTS_FILE, JSON.stringify(this.requests, null, 2));
  }

  private loadAuditLogs() {
    if (fs.existsSync(AUDIT_FILE)) {
      try {
        this.auditLogs = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf-8'));
      } catch {
        this.auditLogs = [];
      }
    }
  }

  private saveAuditLogs() {
    // Keep last 500 logs
    const trimmed = this.auditLogs.slice(-500);
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(trimmed, null, 2));
  }

  public logAction(
    action: AuditLogEntry['action'],
    targetName: string,
    details: string,
    actor: string = 'System'
  ) {
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action,
      targetName,
      details,
      actor
    };
    this.auditLogs.unshift(entry);
    this.saveAuditLogs();
    return entry;
  }

  public isOwnerPasswordSet(): boolean {
    return !!this.ownerHash;
  }

  public setOwnerPassword(newPassword: string): boolean {
    if (!newPassword || newPassword.length < 6) return false;
    this.ownerSalt = crypto.randomBytes(16).toString('hex');
    this.ownerHash = hashPassword(newPassword, this.ownerSalt);
    this.saveConfig();
    this.logAction('OWNER_PASSWORD_SUCCESS', 'Owner Security', 'Owner password was updated or initialized', 'Owner');
    return true;
  }

  public verifyOwnerPassword(password: string): boolean {
    if (!this.ownerHash || !this.ownerSalt || !password) {
      this.logAction('OWNER_PASSWORD_FAIL', 'Password Verification', 'Password attempt failed - not configured or empty', 'System');
      return false;
    }
    const computed = hashPassword(password, this.ownerSalt);
    const isValid = computed === this.ownerHash;
    if (isValid) {
      this.logAction('OWNER_PASSWORD_SUCCESS', 'Password Verification', 'Owner password successfully verified', 'Owner');
    } else {
      this.logAction('OWNER_PASSWORD_FAIL', 'Password Verification', 'Incorrect password entered', 'Security Monitor');
    }
    return isValid;
  }

  // 1. Create a Delete Request
  public createDeleteRequest(
    itemType: 'folder' | 'pdf',
    targetPath: string,
    targetName: string,
    folderName: string,
    reason: string,
    requestedBy: string,
    filesContained?: string[]
  ): SecurityRequest {
    const req: SecurityRequest = {
      id: 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      itemType,
      targetPath,
      targetName,
      folderName,
      filesContained,
      reason,
      requestedAt: new Date().toISOString(),
      requestedBy: requestedBy || 'User',
      status: 'PENDING_DEVELOPER'
    };

    this.requests.unshift(req);
    this.saveRequests();
    this.logAction('REQUEST_DELETE', targetName, `Delete requested: ${reason}`, requestedBy);
    return req;
  }

  // 2. Developer Review: Approve or Reject
  public reviewRequest(
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    notes: string,
    developerName: string = 'Senior Developer'
  ): { success: boolean; request?: SecurityRequest; error?: string } {
    const req = this.requests.find(r => r.id === requestId);
    if (!req) return { success: false, error: 'अनुरोध फेला परेन।' };

    if (req.status !== 'PENDING_DEVELOPER') {
      return { success: false, error: 'यो अनुरोध पहिल्यै समीक्षा भइसकेको छ।' };
    }

    req.status = decision === 'APPROVED' ? 'APPROVED_BY_DEVELOPER' : 'REJECTED';
    req.developerReview = {
      reviewedAt: new Date().toISOString(),
      reviewedBy: developerName,
      notes,
      decision
    };

    this.saveRequests();
    this.logAction(
      decision === 'APPROVED' ? 'DEVELOPER_APPROVE' : 'DEVELOPER_REJECT',
      req.targetName,
      `Developer Review: ${decision} (${notes})`,
      developerName
    );

    return { success: true, request: req };
  }

  // 3. Owner Final Authorization with Password -> Move to Trash
  public executeOwnerDelete(
    requestId: string,
    ownerPassword: string,
    documentsRoot: string
  ): { success: boolean; request?: SecurityRequest; error?: string } {
    const req = this.requests.find(r => r.id === requestId);
    if (!req) return { success: false, error: 'अनुरोध फेला परेन।' };

    if (req.status !== 'APPROVED_BY_DEVELOPER') {
      return { success: false, error: 'पहिले Developer Review मार्फत स्वीकृत हुनुपर्छ।' };
    }

    if (!this.verifyOwnerPassword(ownerPassword)) {
      return { success: false, error: 'गलत Owner Password! Delete प्रक्रिया रोकियो।' };
    }

    // Perform Soft Delete: Move to .trash directory with timestamp
    const sourceFullPath = path.join(documentsRoot, req.targetPath);
    if (!fs.existsSync(sourceFullPath)) {
      return { success: false, error: 'फाइल वा फोल्डर फेला परेन।' };
    }

    const trashFileName = `${Date.now()}_${req.targetName}`;
    const trashFullPath = path.join(TRASH_DIR, trashFileName);

    try {
      fs.renameSync(sourceFullPath, trashFullPath);
      req.status = 'EXECUTED_TRASH';
      req.trashedPath = trashFileName;
      req.ownerApproval = {
        approvedAt: new Date().toISOString(),
        verifiedWithPassword: true
      };

      this.saveRequests();
      this.logAction('TRASH_MOVE', req.targetName, `Moved to secure Trash after Owner Password approval. Path: ${trashFileName}`, 'Owner');
      return { success: true, request: req };
    } catch (err: any) {
      return { success: false, error: `Delete असफल: ${err.message}` };
    }
  }

  // 4. Restore from Trash
  public restoreFromTrash(
    requestId: string,
    documentsRoot: string
  ): { success: boolean; request?: SecurityRequest; error?: string } {
    const req = this.requests.find(r => r.id === requestId);
    if (!req || !req.trashedPath) {
      return { success: false, error: 'Trash मा उक्त फाइल फेला परेन।' };
    }

    const trashFullPath = path.join(TRASH_DIR, req.trashedPath);
    if (!fs.existsSync(trashFullPath)) {
      return { success: false, error: 'Trash फाइल फेला परेन।' };
    }

    const targetRestorePath = path.join(documentsRoot, req.targetPath);
    // Ensure parent folder exists
    const parentDir = path.dirname(targetRestorePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    try {
      fs.renameSync(trashFullPath, targetRestorePath);
      req.status = 'RESTORED';
      this.saveRequests();
      this.logAction('RESTORE', req.targetName, `Restored from Trash to ${req.targetPath}`, 'Developer/Owner');
      return { success: true, request: req };
    } catch (err: any) {
      return { success: false, error: `Restore असफल: ${err.message}` };
    }
  }

  public getRequests(): SecurityRequest[] {
    return this.requests;
  }

  public getAuditLogs(): AuditLogEntry[] {
    return this.auditLogs;
  }
}

export const securityManager = new SecurityManager();
