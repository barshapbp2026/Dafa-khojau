import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface GitLfsPointer {
  version: string;
  oid: string;
  size: number;
}

export interface LfsSyncResult {
  success: boolean;
  isLfs: boolean;
  oid: string;
  sizeBytes: number;
  pushedToGitHub: boolean;
  error?: string;
  message?: string;
}

export class GitLfsService {
  private lfsThresholdBytes: number = 50 * 1024 * 1024; // 50 MB default as requested

  /**
   * Check if a buffer or file content is a Git LFS pointer text file
   */
  public isLfsPointer(content: Buffer | string): boolean {
    const text = typeof content === 'string' ? content : content.toString('utf-8', 0, Math.min(content.length, 500));
    return (
      text.startsWith('version https://git-lfs.github.com/spec/v1') &&
      text.includes('oid sha256:') &&
      text.includes('size ')
    );
  }

  /**
   * Parse an LFS pointer text file into OID and Size
   */
  public parseLfsPointer(content: string | Buffer): GitLfsPointer | null {
    const text = typeof content === 'string' ? content : content.toString('utf-8');
    if (!this.isLfsPointer(text)) return null;

    const oidMatch = text.match(/oid sha256:([a-fA-F0-9]{64})/);
    const sizeMatch = text.match(/size\s+(\d+)/);

    if (oidMatch && sizeMatch) {
      return {
        version: 'https://git-lfs.github.com/spec/v1',
        oid: oidMatch[1],
        size: parseInt(sizeMatch[1], 10)
      };
    }
    return null;
  }

  /**
   * Generate canonical Git LFS pointer file format
   */
  public createLfsPointer(sha256Hex: string, sizeBytes: number): string {
    return `version https://git-lfs.github.com/spec/v1\noid sha256:${sha256Hex}\nsize ${sizeBytes}\n`;
  }

  /**
   * Calculate SHA-256 hash of a buffer
   */
  public calculateSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Determine if a file needs Git LFS tracking (> 50 MB)
   */
  public shouldTrackWithLfs(sizeBytes: number): boolean {
    return sizeBytes >= this.lfsThresholdBytes;
  }

  /**
   * Resolve a file's actual binary content:
   * If the file on disk is an LFS pointer, it checks local cache or GitHub LFS API to fetch real binary content.
   */
  public async getResolvedPdfBuffer(filePath: string): Promise<{ buffer: Buffer; isLfsResolved: boolean; isPointerOnly: boolean }> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`फाइल फेला परेन: ${filePath}`);
    }

    const rawBuffer = fs.readFileSync(filePath);
    if (!this.isLfsPointer(rawBuffer)) {
      // Normal binary PDF file
      return { buffer: rawBuffer, isLfsResolved: false, isPointerOnly: false };
    }

    const pointer = this.parseLfsPointer(rawBuffer);
    if (!pointer) {
      return { buffer: rawBuffer, isLfsResolved: false, isPointerOnly: false };
    }

    // Try finding in local Git LFS storage: .git/lfs/objects/xx/yy/xxyy...
    const rootDir = path.resolve(__dirname, '..');
    const lfsCachePath = path.join(
      rootDir,
      '.git',
      'lfs',
      'objects',
      pointer.oid.slice(0, 2),
      pointer.oid.slice(2, 4),
      pointer.oid
    );

    if (fs.existsSync(lfsCachePath)) {
      const cached = fs.readFileSync(lfsCachePath);
      return { buffer: cached, isLfsResolved: true, isPointerOnly: false };
    }

    // Try downloading from GitHub LFS API if GITHUB_TOKEN is available
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER || 'barshapbp2026';
    const repo = process.env.GITHUB_REPO || 'any-pdf-';

    if (token) {
      try {
        const downloadedBuffer = await this.downloadFromGitHubLfs(owner, repo, token, pointer.oid, pointer.size);
        if (downloadedBuffer) {
          // Cache locally
          const dir = path.dirname(lfsCachePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(lfsCachePath, downloadedBuffer);
          return { buffer: downloadedBuffer, isLfsResolved: true, isPointerOnly: false };
        }
      } catch (err: any) {
        console.warn(`LFS download failed for ${pointer.oid}: ${err.message}`);
      }
    }

    // Still pointer only
    return { buffer: rawBuffer, isLfsResolved: false, isPointerOnly: true };
  }

  /**
   * Upload an LFS object directly to GitHub via LFS Batch API
   */
  public async uploadToGitHubLfs(
    owner: string,
    repo: string,
    token: string,
    buffer: Buffer,
    oid: string
  ): Promise<boolean> {
    const lfsBatchUrl = `https://github.com/${owner}/${repo}.git/info/lfs/objects/batch`;
    const payload = {
      operation: 'upload',
      transfers: ['basic'],
      ref: { name: process.env.GITHUB_BRANCH || 'feature/full-nepali-pdf-search' },
      objects: [
        {
          oid: oid,
          size: buffer.length
        }
      ]
    };

    const res = await fetch(lfsBatchUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.git-lfs+json',
        'Content-Type': 'application/vnd.git-lfs+json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.warn(`GitHub LFS Batch API returned status ${res.status}: ${await res.text()}`);
      return false;
    }

    const data: any = await res.json();
    const obj = data.objects?.[0];
    if (!obj) return false;

    // If GitHub already has this object, actions will be undefined
    if (!obj.actions || !obj.actions.upload) {
      return true; // Already exists in GitHub LFS storage
    }

    // Perform actual upload to the signed storage URL
    const uploadAction = obj.actions.upload;
    const uploadHeaders: Record<string, string> = { ...uploadAction.header };

    const uploadRes = await fetch(uploadAction.href, {
      method: 'PUT',
      headers: uploadHeaders,
      body: new Uint8Array(buffer)
    });

    return uploadRes.ok;
  }

  /**
   * Download an LFS object from GitHub via LFS Batch API
   */
  private async downloadFromGitHubLfs(
    owner: string,
    repo: string,
    token: string,
    oid: string,
    size: number
  ): Promise<Buffer | null> {
    const lfsBatchUrl = `https://github.com/${owner}/${repo}.git/info/lfs/objects/batch`;
    const payload = {
      operation: 'download',
      transfers: ['basic'],
      ref: { name: process.env.GITHUB_BRANCH || 'feature/full-nepali-pdf-search' },
      objects: [{ oid, size }]
    };

    const res = await fetch(lfsBatchUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.git-lfs+json',
        'Content-Type': 'application/vnd.git-lfs+json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) return null;

    const data: any = await res.json();
    const obj = data.objects?.[0];
    if (!obj || !obj.actions?.download) return null;

    const downloadAction = obj.actions.download;
    const downloadRes = await fetch(downloadAction.href, {
      headers: downloadAction.header || {}
    });

    if (!downloadRes.ok) return null;
    const arrayBuffer = await downloadRes.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Handle an accepted PDF: track with Git LFS if > 50 MB, push to GitHub if credentials exist
   */
  public async processAcceptedPdf(
    folderName: string,
    fileName: string,
    fileBuffer: Buffer
  ): Promise<LfsSyncResult> {
    const size = fileBuffer.length;
    const oid = this.calculateSha256(fileBuffer);
    const isLfs = this.shouldTrackWithLfs(size);

    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER || 'barshapbp2026';
    const repo = process.env.GITHUB_REPO || 'any-pdf-';

    let pushedToGitHub = false;
    let syncError: string | undefined;

    if (token && isLfs) {
      try {
        const lfsUploaded = await this.uploadToGitHubLfs(owner, repo, token, fileBuffer, oid);
        pushedToGitHub = lfsUploaded;
      } catch (err: any) {
        syncError = err.message;
      }
    }

    return {
      success: true,
      isLfs,
      oid,
      sizeBytes: size,
      pushedToGitHub,
      error: syncError,
      message: isLfs
        ? `Git LFS ट्र्याक गरिएको छ (${(size / 1024 / 1024).toFixed(2)} MB, SHA-256: ${oid.slice(0, 12)}...)`
        : `मानक भण्डारणमा सुरक्षित (${(size / 1024 / 1024).toFixed(2)} MB)`
    };
  }

  /**
   * Scan all PDFs in the repository and report migration status
   */
  public getRepositoryLfsStatus(documentsRoot: string): {
    totalFiles: number;
    largeFilesOver50MB: { folder: string; file: string; sizeMB: string; isLfsPointer: boolean; oid: string }[];
    standardFiles: { folder: string; file: string; sizeMB: string }[];
  } {
    const result = {
      totalFiles: 0,
      largeFilesOver50MB: [] as any[],
      standardFiles: [] as any[]
    };

    if (!fs.existsSync(documentsRoot)) return result;

    const entries = fs.readdirSync(documentsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const folderDir = path.join(documentsRoot, entry.name);
        const files = fs.readdirSync(folderDir).filter(f => f.toLowerCase().endsWith('.pdf'));

        for (const file of files) {
          result.totalFiles++;
          const fullPath = path.join(folderDir, file);
          const stat = fs.statSync(fullPath);
          const buf = fs.readFileSync(fullPath);
          const isPointer = this.isLfsPointer(buf);
          const oid = this.calculateSha256(buf);

          const item = {
            folder: entry.name,
            file,
            sizeMB: (stat.size / (1024 * 1024)).toFixed(2) + ' MB',
            isLfsPointer: isPointer,
            oid
          };

          if (stat.size >= this.lfsThresholdBytes || isPointer) {
            result.largeFilesOver50MB.push(item);
          } else {
            result.standardFiles.push(item);
          }
        }
      }
    }

    return result;
  }
}

export const gitLfsService = new GitLfsService();
