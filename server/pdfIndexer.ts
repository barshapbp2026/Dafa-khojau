import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';

export interface IndexedHeader {
  type: 'dafa' | 'niyam' | 'dhara' | 'nirdeshan';
  numDev: string;
  numArab: string;
  rawNum: string;
  subClause?: string;
  title: string;
  headerText: string;
  page: number;
  pdfPath: string;
  pdfName: string;
  folder: string;
}

export interface IndexedAnusuchi {
  numDev: string;
  numArab: string;
  rawNum: string;
  subClause?: string;
  title: string;
  headerText: string;
  page: number;
  pdfPath: string;
  pdfName: string;
  folder: string;
}

export interface IndexedDocument {
  pdfPath: string;
  pdfName: string;
  folder: string;
  totalPages: number;
  pages: { num: number; text: string }[];
  dafas: IndexedHeader[];
  niyams: IndexedHeader[];
  dharas: IndexedHeader[];
  nirdeshans: IndexedHeader[];
  anusuchis: IndexedAnusuchi[];
  // All headers excluding anusuchi for sabda search
  sabdaHeaders: IndexedHeader[];
}

export interface SearchResult {
  pdfName: string;
  folder: string;
  page: number;
  type: 'dafa' | 'niyam' | 'dhara' | 'nirdeshan' | 'anusuchi' | 'sabda';
  headerText: string;
  title: string;
  number: string;
  snippet?: string;
  matchStrategy: 'exact' | 'clause' | 'both_words' | 'single_word';
  isAnusuchi?: boolean;
}

// Convert numbers between Devanagari and Arabic
export function toDevanagari(str: string | number): string {
  const map: Record<string, string> = {
    '0': '०', '1': '१', '2': '२', '3': '३', '4': '४',
    '5': '५', '6': '६', '7': '७', '8': '८', '9': '९'
  };
  return String(str).replace(/[0-9]/g, d => map[d] || d);
}

export function toArabic(str: string | number): string {
  const map: Record<string, string> = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
  };
  return String(str).replace(/[०-९]/g, d => map[d] || d);
}

// Advanced Nepali font and OCR normalization
export function normalizeNepaliText(text: string): string {
  if (!text) return '';

  return text
    // Remove zero-width characters and BOM
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Normalize broken OCR matra combinations like ि followed by consonant (e.g. िेपाल -> नेपाल, िान -> मान)
    .replace(/िे([क-ह])/g, '$1े')
    .replace(/ि([क-ह])([ा-ौ्])/g, '$1ि$2')
    // Fix split syllables caused by OCR spacing (उदा. स्रेस् ता -> स्रेस्ता, मनर्दे शशका -> निर्देशिका, मसिंहर्द रवार -> सिंहदरबार)
    .replace(/स्\s+ता/g, 'स्ता')
    .replace(/र्\s+दा/g, 'र्दा')
    .replace(/ह्\s+न/g, 'ह्न')
    .replace(/न्त्\s+रालय/g, 'न्त्रालय')
    .replace(/प्र\s+शासन/g, 'प्रशासन')
    .replace(/मनर्दे\s*शशका/g, 'निर्देशिका')
    .replace(/मनर्देशशका/g, 'निर्देशिका')
    .replace(/िालपोत/g, 'मालपोत')
    .replace(/िहामनर्देशक/g, 'महानिर्देशक')
    .replace(/हवमभन्न/g, 'विभिन्न')
    .replace(/मनयि/g, 'नियम')
    .replace(/िेरफल/g, 'क्षेत्रफल')
    .replace(/र्द\s+फा/g, 'दफा')
    .replace(/र्\s+ग्\s+गा/g, 'जग्गा')
    // Normalize tabs and multiple spaces
    .replace(/\t+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanText(text: string): string {
  return normalizeNepaliText(text);
}

// Normalize search query: strip prefixes like 'दफा', 'नियम', 'धारा', 'अनुसूची'
export function normalizeQueryNumber(query: string): { arab: string; dev: string; subClause?: string } {
  const cleaned = cleanText(query)
    .replace(/^(दफा|नियम|धारा|निर्देशन|अनुसूची)\s*[-–—:]?\s*/i, '')
    .replace(/^No\.?\s*/i, '')
    .trim();

  // Extract base digits and possible subclause like क, ख, a, b, or (क), (a)
  const match = cleaned.match(/^([०-९\d]+)\s*(?:\(?([क-हa-zA-Z])\)?)?$/);
  if (match) {
    const digits = match[1];
    const sub = match[2] || '';
    return {
      arab: toArabic(digits) + sub.toLowerCase(),
      dev: toDevanagari(digits) + sub,
      subClause: sub
    };
  }

  return {
    arab: toArabic(cleaned),
    dev: toDevanagari(cleaned)
  };
}

class PdfIndexStore {
  private documents: Map<string, IndexedDocument> = new Map();
  private loadedFolders: Set<string> = new Set();

  public getDocumentCount(): number {
    return this.documents.size;
  }

  public getLoadedFolders(): string[] {
    return Array.from(this.loadedFolders);
  }

  public getDocument(pdfPath: string): IndexedDocument | undefined {
    return this.documents.get(pdfPath);
  }

  public getAllDocuments(): IndexedDocument[] {
    return Array.from(this.documents.values());
  }

  public clear() {
    this.documents.clear();
    this.loadedFolders.clear();
  }

  public removeDocument(filePath: string) {
    this.documents.delete(filePath);
  }

  public renameDocument(oldPath: string, newPath: string, newName: string) {
    const doc = this.documents.get(oldPath);
    if (doc) {
      doc.pdfPath = newPath;
      doc.pdfName = newName;
      this.documents.delete(oldPath);
      this.documents.set(newPath, doc);
    }
  }

  public renameFolder(oldFolder: string, newFolder: string) {
    if (this.loadedFolders.has(oldFolder)) {
      this.loadedFolders.delete(oldFolder);
      this.loadedFolders.add(newFolder);
    }
    for (const doc of this.documents.values()) {
      if (doc.folder === oldFolder) {
        doc.folder = newFolder;
      }
    }
  }

  /**
   * Parse a single PDF file and extract all headers, anusuchis, and pages
   */
  public async indexFile(filePath: string, folderName: string): Promise<IndexedDocument> {
    const existing = this.documents.get(filePath);
    if (existing) {
      this.loadedFolders.add(folderName);
      return existing;
    }

    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const parsedData = await parser.getText();

    const pdfName = path.basename(filePath);
    const pages = parsedData.pages.map(p => ({
      num: p.num,
      text: p.text || ''
    }));

    const dafas: IndexedHeader[] = [];
    const niyams: IndexedHeader[] = [];
    const dharas: IndexedHeader[] = [];
    const nirdeshans: IndexedHeader[] = [];
    const anusuchis: IndexedAnusuchi[] = [];
    const sabdaHeaders: IndexedHeader[] = [];

    // 1. REVERSE SCAN FOR ANUSUCHI
    // As per instruction: scan from the end of the document backwards.
    // The annexes (अनुसूची) are placed at the back of the legal document (e.g., p. 250+ to 453)
    const totalPages = pages.length;
    const seenAnusuchiNumbers = new Set<string>();

    for (let i = totalPages - 1; i >= 0; i--) {
      const page = pages[i];
      const lines = page.text.split('\n').map(l => cleanText(l)).filter(Boolean);

      // Check the top 8 lines of each page for Anusuchi headers
      for (const line of lines.slice(0, 8)) {
        // Must match actual header line starting with Anusuchi, e.g.
        // "अनुसूची १", "अनुसूची-१", "अनुसूची - ६३", "अनुसूची-63"
        const match = line.match(/^अनुसूची\s*[-–—]?\s*([०-९\d]+)([क-हa-zA-Z]?)(.*)$/i);
        if (match) {
          // Reject body references like "(१२) ... अनुसूची-१" or table of contents lines with dots
          if (line.includes('......') || line.includes('.....')) continue;

          const numPart = match[1];
          const sub = match[2] || '';
          const fullNum = numPart + sub;
          const arabNum = toArabic(numPart) + sub.toLowerCase();
          const devNum = toDevanagari(numPart) + sub;

          // If already indexed from a later page, avoid duplicate unless it's a new subpart
          const key = arabNum;
          if (!seenAnusuchiNumbers.has(key)) {
            seenAnusuchiNumbers.add(key);
            let title = cleanText(match[3].replace(/^[:ः\-–—\.]\s*/, ''));
            if (!title && lines.length > 1) {
              // Next line might be the title
              const nextLine = lines[1];
              if (!nextLine.startsWith('अनुसूची') && nextLine.length > 3) {
                title = nextLine;
              }
            }

            anusuchis.push({
              numDev: devNum,
              numArab: arabNum,
              rawNum: fullNum,
              subClause: sub,
              title: title || `अनुसूची ${devNum}`,
              headerText: line,
              page: page.num,
              pdfPath: filePath,
              pdfName,
              folder: folderName
            });
          }
          break; // only one main anusuchi header per page top
        }
      }
    }

    // Sort anusuchis by numeric order
    anusuchis.sort((a, b) => parseInt(a.numArab, 10) - parseInt(b.numArab, 10));

    // 2. FORWARD SCAN FOR DAFAS, NIYAMS, DHARAS, NIRDESHANS
    // Identify genuine legal headers (starts at line beginning, bold/separated, followed by title and colon/clause)
    for (const page of pages) {
      // Skip cover/intro pages if TOC is present, skip past start of annexes if pure annexes
      // In land administration directive, TOC is pages 1-25, Anusuchi starts p.262
      const lines = page.text.split('\n').map(l => cleanText(l)).filter(Boolean);

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];

        // Skip table of content dot lines (e.g. "२२२. टायल चेक ... 121")
        if (line.includes('.....') || line.includes('......') || line.includes('…')) {
          continue;
        }

        // Pattern A: Explicit prefix "दफा", "नियम", "धारा", "निर्देशन"
        const prefixMatch = line.match(/^(दफा|नियम|धारा|निर्देशन)\s*([०-९\d]+)([क-हa-zA-Z]?)(?:[\.\-–—:\s]+)(.+)$/i);
        if (prefixMatch) {
          const typeKeyword = prefixMatch[1].toLowerCase();
          const numPart = prefixMatch[2];
          const sub = prefixMatch[3] || '';
          const fullNum = numPart + sub;
          const arabNum = toArabic(numPart) + sub.toLowerCase();
          const devNum = toDevanagari(numPart) + sub;
          
          let titlePart = cleanText(prefixMatch[4]);
          // Strip attached sub-clause like "(१)"
          titlePart = titlePart.split(/\s*(?:\([०-९\d]+\)|[:ः]\s*\([०-९\d]+\))/)[0];
          if (titlePart.endsWith(':') || titlePart.endsWith('ः')) {
            titlePart = titlePart.slice(0, -1).trim();
          }

          let itemType: 'dafa' | 'niyam' | 'dhara' | 'nirdeshan' = 'dafa';
          if (typeKeyword.includes('नियम')) itemType = 'niyam';
          else if (typeKeyword.includes('धारा')) itemType = 'dhara';
          else if (typeKeyword.includes('निर्देशन')) itemType = 'nirdeshan';

          const item: IndexedHeader = {
            type: itemType,
            numDev: devNum,
            numArab: arabNum,
            rawNum: fullNum,
            subClause: sub,
            title: titlePart,
            headerText: line,
            page: page.num,
            pdfPath: filePath,
            pdfName,
            folder: folderName
          };

          if (itemType === 'dafa') dafas.push(item);
          else if (itemType === 'niyam') niyams.push(item);
          else if (itemType === 'dhara') dharas.push(item);
          else if (itemType === 'nirdeshan') nirdeshans.push(item);

          sabdaHeaders.push(item);
          continue;
        }

        // Pattern B: Numbered section header format:
        // E.g. "222. नक्सा अनुसार क्षेत्रफल संशोधन (टायल चेक) गर्नेः (१)..."
        // E.g. "१. संक्षिप्त नाम र प्रारम्भः"
        // E.g. "५क. विशेष व्यवस्थाः"
        // Must start with number + dot, NOT a subclause like "(१)" or "(२)"
        const numHeaderMatch = line.match(/^([०-९\d]+)([क-हa-zA-Z]?)\.\s+(.+)$/);
        if (numHeaderMatch) {
          const numPart = numHeaderMatch[1];
          const sub = numHeaderMatch[2] || '';
          const fullNum = numPart + sub;
          const arabNum = toArabic(numPart) + sub.toLowerCase();
          const devNum = toDevanagari(numPart) + sub;

          // Check if this looks like a genuine header:
          // Must not start with "(", must have meaningful title length, not sub-clause
          let titlePart = cleanText(numHeaderMatch[3]);

          // If attached with subclause (१), split it
          titlePart = titlePart.split(/\s*(?:\([०-९\d]+\)|[:ः]\s*\([०-९\d]+\))/)[0];
          if (titlePart.endsWith(':') || titlePart.endsWith('ः')) {
            titlePart = titlePart.slice(0, -1).trim();
          }

          // Exclude numbered amendment lists in preamble or sub-lists
          if (titlePart.length >= 2 && !titlePart.startsWith('उप') && !titlePart.startsWith('भूमि प्रशासन (') && page.num >= 20) {
            const item: IndexedHeader = {
              type: 'dafa', // default numbered section in directives/acts
              numDev: devNum,
              numArab: arabNum,
              rawNum: fullNum,
              subClause: sub,
              title: titlePart,
              headerText: `${fullNum}. ${titlePart}`,
              page: page.num,
              pdfPath: filePath,
              pdfName,
              folder: folderName
            };

            dafas.push(item);
            // In Nepal law directives, these can also count as nirdeshan/niyam depending on user query
            sabdaHeaders.push(item);
          }
        }
      }
    }

    const doc: IndexedDocument = {
      pdfPath: filePath,
      pdfName,
      folder: folderName,
      totalPages,
      pages,
      dafas,
      niyams,
      dharas,
      nirdeshans,
      anusuchis,
      sabdaHeaders
    };

    this.documents.set(filePath, doc);
    this.loadedFolders.add(folderName);
    return doc;
  }

  /**
   * Search across loaded documents based on criteria
   */
  public search(
    type: 'dafa' | 'niyam' | 'dhara' | 'nirdeshan' | 'anusuchi' | 'sabda',
    query: string,
    filterFolder?: string,
    filterPdf?: string
  ): { results: SearchResult[]; notFoundMessage?: string } {
    const trimmed = cleanText(query);
    if (!trimmed) {
      return { results: [], notFoundMessage: 'कृपया खोज्न चाहेको नम्बर वा शब्द प्रविष्ट गर्नुहोस्।' };
    }

    // Filter documents based on scope
    let docs = Array.from(this.documents.values());
    if (filterFolder) {
      docs = docs.filter(d => d.folder === filterFolder);
    }
    if (filterPdf) {
      docs = docs.filter(d => d.pdfName === filterPdf || d.pdfPath === filterPdf);
    }

    if (docs.length === 0) {
      return {
        results: [],
        notFoundMessage: 'खोज्नका लागि कुनै पनि PDF कागजात लोड गरिएको छैन। कृपया पहिले कागजात लोड गर्नुहोस्।'
      };
    }

    const results: SearchResult[] = [];

    // -------------------------------------------------------------
    // 1. ANUSUCHI SEARCH (अनुसूची खोज)
    // -------------------------------------------------------------
    if (type === 'anusuchi') {
      const { arab, dev } = normalizeQueryNumber(trimmed);
      const isNumericQuery = /^[०-९\d]+[क-हa-zA-Z]?$/.test(cleanText(trimmed).replace(/^(अनुसूची)\s*[-–—:]?\s*/i, ''));

      for (const doc of docs) {
        for (const item of doc.anusuchis) {
          const matchExact = item.numArab === arab || item.numDev === dev;
          const matchTitle = !isNumericQuery && (item.title.includes(trimmed) || item.headerText.includes(trimmed));

          if (matchExact) {
            results.push({
              pdfName: doc.pdfName,
              folder: doc.folder,
              page: item.page,
              type: 'anusuchi',
              headerText: item.headerText,
              title: item.title,
              number: item.numDev,
              isAnusuchi: true,
              matchStrategy: 'exact',
              snippet: `अनुसूची नं. ${item.numDev} (पृष्ठ ${toDevanagari(item.page)}): ${item.title}`
            });
          } else if (matchTitle) {
            results.push({
              pdfName: doc.pdfName,
              folder: doc.folder,
              page: item.page,
              type: 'anusuchi',
              headerText: item.headerText,
              title: item.title,
              number: item.numDev,
              isAnusuchi: true,
              matchStrategy: 'single_word',
              snippet: `अनुसूची नं. ${item.numDev} (पृष्ठ ${toDevanagari(item.page)}): ${item.title}`
            });
          }
        }
      }

      if (results.length === 0) {
        return {
          results: [],
          notFoundMessage: `अनुसूची नं. ${toDevanagari(trimmed)} लोड गरिएका कुनै पनि PDF कागजातमा भेटिएन।`
        };
      }
      return { results };
    }

    // -------------------------------------------------------------
    // 2. SABDA SEARCH (शब्द खोज — HEADER-ONLY!)
    // As per instruction:
    // - NEVER scan body text.
    // - Exclude Anusuchi headers.
    // - If searching "टायल चेक", search both words in same header.
    // - If not found, search individual words.
    // - Else report "यो शब्द कुनै Header मा भेटिएन".
    // -------------------------------------------------------------
    if (type === 'sabda') {
      const words = trimmed.split(/\s+/).filter(w => w.length > 0);

      // Strategy 1: Check if ALL words appear in the same header
      for (const doc of docs) {
        for (const header of doc.sabdaHeaders) {
          const allWordsMatch = words.every(w =>
            header.headerText.toLowerCase().includes(w.toLowerCase()) ||
            header.title.toLowerCase().includes(w.toLowerCase())
          );
          if (allWordsMatch) {
            results.push({
              pdfName: doc.pdfName,
              folder: doc.folder,
              page: header.page,
              type: 'sabda',
              headerText: header.headerText,
              title: header.title,
              number: header.numDev,
              matchStrategy: 'both_words',
              snippet: `हेडर (Header) पृष्ठ ${toDevanagari(header.page)}: ${header.headerText}`
            });
          }
        }
      }

      // Strategy 2: If multiple words and no combined match, search individual words
      if (results.length === 0 && words.length > 1) {
        for (const doc of docs) {
          for (const header of doc.sabdaHeaders) {
            const anyWordMatch = words.some(w =>
              header.headerText.toLowerCase().includes(w.toLowerCase()) ||
              header.title.toLowerCase().includes(w.toLowerCase())
            );
            if (anyWordMatch) {
              results.push({
                pdfName: doc.pdfName,
                folder: doc.folder,
                page: header.page,
                type: 'sabda',
                headerText: header.headerText,
                title: header.title,
                number: header.numDev,
                matchStrategy: 'single_word',
                snippet: `हेडर आंशिक मेल (Header) पृष्ठ ${toDevanagari(header.page)}: ${header.headerText}`
              });
            }
          }
        }
      }

      if (results.length === 0) {
        return {
          results: [],
          notFoundMessage: 'यो शब्द कुनै Header मा भेटिएन।'
        };
      }
      return { results };
    }

    // -------------------------------------------------------------
    // 3. DAFA, NIYAM, DHARA, NIRDESHAN SEARCH (दफा / नियम / धारा / निर्देशन)
    // -------------------------------------------------------------
    const { arab, dev } = normalizeQueryNumber(trimmed);

    for (const doc of docs) {
      let pool: IndexedHeader[] = [];
      if (type === 'dafa') pool = doc.dafas;
      else if (type === 'niyam') pool = doc.niyams.length > 0 ? doc.niyams : doc.dafas;
      else if (type === 'dhara') pool = doc.dharas.length > 0 ? doc.dharas : doc.dafas;
      else if (type === 'nirdeshan') pool = doc.nirdeshans.length > 0 ? doc.nirdeshans : doc.dafas;

      for (const item of pool) {
        const exactMatch = item.numArab === arab || item.numDev === dev;
        if (exactMatch) {
          results.push({
            pdfName: doc.pdfName,
            folder: doc.folder,
            page: item.page,
            type,
            headerText: item.headerText,
            title: item.title,
            number: item.numDev,
            matchStrategy: 'exact',
            snippet: `${type === 'dafa' ? 'दफा' : type === 'niyam' ? 'नियम' : type === 'dhara' ? 'धारा' : 'निर्देशन'} नं. ${item.numDev} (पृष्ठ ${toDevanagari(item.page)}): ${item.title}`
          });
        }
      }
    }

    if (results.length === 0) {
      const typeLabel =
        type === 'dafa' ? 'दफा' :
        type === 'niyam' ? 'नियम' :
        type === 'dhara' ? 'धारा' : 'निर्देशन';
      return {
        results: [],
        notFoundMessage: `${typeLabel} नं. ${toDevanagari(trimmed)} लोड गरिएका कुनै पनि कागजातमा भेटिएन।`
      };
    }

    return { results };
  }
}

export const pdfIndexStore = new PdfIndexStore();
