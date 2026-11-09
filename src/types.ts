export type SearchType = 'dhara' | 'dafa' | 'niyam' | 'nirdeshan' | 'anusuchi' | 'sabda';

export interface FolderItem {
  folderName: string;
  path: string;
  files: {
    name: string;
    relativePath: string;
    sizeBytes: number;
    sizeFormatted: string;
    mtime: string;
    isIndexed: boolean;
  }[];
}

export interface SearchResultItem {
  pdfName: string;
  folder: string;
  page: number;
  type: SearchType;
  headerText: string;
  title: string;
  number: string;
  snippet?: string;
  matchStrategy: 'exact' | 'clause' | 'both_words' | 'single_word';
  isAnusuchi?: boolean;
}

export interface IndexStats {
  totalIndexedPdfs: number;
  totalPagesIndexed: number;
  totalDafas: number;
  totalAnusuchis: number;
  totalSabdaHeaders: number;
  memoryMB?: string;
}

export interface PageContentData {
  page: number;
  totalPages: number;
  text: string;
  headers: {
    headerText: string;
    title: string;
    numDev: string;
    type: string;
    page: number;
  }[];
}

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: {
    pdfName?: string;
    page?: number;
    section?: string;
    quote?: string;
    url?: string;
    title?: string;
  }[];
}

export interface SecurityRequestItem {
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

export interface AuditLogItem {
  id: string;
  timestamp: string;
  action: string;
  targetName: string;
  details: string;
  actor: string;
}
