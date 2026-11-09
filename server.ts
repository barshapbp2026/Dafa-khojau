import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { pdfIndexStore } from './server/pdfIndexer.js';
import { testGeminiApiKey, queryInsidePdf, queryOutsidePdf } from './server/geminiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const DOCUMENTS_ROOT = path.join(__dirname, 'public', 'documents');

// Ensure documents directory exists
if (!fs.existsSync(DOCUMENTS_ROOT)) {
  fs.mkdirSync(DOCUMENTS_ROOT, { recursive: true });
}

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Helper to scan documents directory
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
    }[];
  }[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const folderPath = path.join(DOCUMENTS_ROOT, entry.name);
      const files = fs.readdirSync(folderPath, { withFileTypes: true })
        .filter(f => f.isFile() && f.name.toLowerCase().endsWith('.pdf'))
        .map(f => {
          const filePath = path.join(folderPath, f.name);
          const stats = fs.statSync(filePath);
          const isIndexed = !!pdfIndexStore.getDocument(filePath);
          return {
            name: f.name,
            relativePath: path.join(entry.name, f.name),
            sizeBytes: stats.size,
            sizeFormatted: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
            mtime: stats.mtime,
            isIndexed
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

    res.json({
      success: true,
      folders: tree,
      loadedFolders,
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
    const targetDir = path.join(DOCUMENTS_ROOT, safeName);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    res.json({ success: true, folderName: safeName });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Upload PDF file
app.post('/api/upload', (req: Request, res: Response) => {
  try {
    const { folderName, fileName, base64Content } = req.body;
    if (!folderName || !fileName || !base64Content) {
      return res.status(400).json({ success: false, error: 'अधुरो डाटा। फोल्डर, नाम र फाइल सामग्री आवश्यक छ।' });
    }
    const safeFolder = folderName.replace(/[\/\\:*?"<>|]/g, '').trim();
    const safeFile = fileName.replace(/[\/\\:*?"<>|]/g, '').trim();
    const folderPath = path.join(DOCUMENTS_ROOT, safeFolder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    const filePath = path.join(folderPath, safeFile.endsWith('.pdf') ? safeFile : `${safeFile}.pdf`);
    const buffer = Buffer.from(base64Content, 'base64');
    fs.writeFileSync(filePath, buffer);

    res.json({ success: true, message: 'PDF फाइल सफलतापूर्वक सुरक्षित भयो।' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Load & Index Selected Folders or Single PDF
app.post('/api/load-selected', async (req: Request, res: Response) => {
  try {
    const { selectedFolders, singleFolder, singlePdf, mode } = req.body;
    // Reset if changing scope or user requested
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

    // Index each file asynchronously
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

// 5. Local Search Endpoint
app.post('/api/search', (req: Request, res: Response) => {
  try {
    const { type, query, scope, folder, pdf } = req.body;
    if (!type || !query) {
      return res.status(400).json({ success: false, error: 'खोजको प्रकार (type) र शब्द/नम्बर (query) आवश्यक छ।' });
    }

    let filterFolder = folder;
    let filterPdf = pdf;
    if (scope === 'multiple') {
      // Multiple folders: search across all loaded documents or selected folders
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

// 6. Get Page Content & Highlight data for PDF viewer
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

    // Find any headers on this page
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

// 7. Stream Raw PDF File for PDF.js Canvas / Embed
app.get('/api/pdf-raw', (req: Request, res: Response) => {
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

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file)}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

// 8. Gemini API Key Validation
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

// 9. Gemini Chat 1: Inside PDF
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

// 10. Gemini Chat 2: Outside PDF / Internet Search Grounding
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

// Start Server with Vite
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nepali Legal PDF Assistant server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
