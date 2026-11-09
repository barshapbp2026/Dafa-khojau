import { GoogleGenAI } from '@google/genai';
import { pdfIndexStore, toDevanagari } from './pdfIndexer.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: {
    pdfName?: string;
    page?: number;
    section?: string;
    quote?: string;
    url?: string;
    title?: string;
  }[];
}

/**
 * Validates a user-provided Gemini API key with a fast ping call
 */
export async function testGeminiApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'नमस्ते, यो परीक्षण सन्देश हो।'
    });
    if (response && response.text) {
      return { valid: true };
    }
    return { valid: false, error: 'मोडेलबाट कुनै प्रतिक्रिया आएन।' };
  } catch (err: any) {
    return { valid: false, error: err.message || 'API कुञ्जी अमान्य वा म्याद सकिएको हुन सक्छ।' };
  }
}

/**
 * Chat Box 1: Search Inside PDF
 * Answers strictly based on the loaded PDF documents with specific citations.
 */
export async function queryInsidePdf(
  apiKey: string,
  userQuestion: string,
  selectedPdf?: string
): Promise<{ answer: string; citations: any[] }> {
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
  const allDocs = pdfIndexStore.getAllDocuments();

  if (allDocs.length === 0) {
    return {
      answer: 'खोज्नका लागि प्रणालीमा कुनै पनि PDF लोड गरिएको छैन। कृपया पहिले कुनै फोल्डर वा PDF लोड गर्नुहोस्।',
      citations: []
    };
  }

  // Find relevant pages/headers using lexical matching
  const queryTerms = userQuestion
    .replace(/[?,।:;()]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);

  const matchedSnippets: {
    pdfName: string;
    page: number;
    header: string;
    text: string;
    score: number;
  }[] = [];

  for (const doc of allDocs) {
    if (selectedPdf && doc.pdfName !== selectedPdf) continue;

    for (const page of doc.pages) {
      let score = 0;
      for (const term of queryTerms) {
        if (page.text.includes(term)) {
          score += 2;
        }
      }
      if (score > 0) {
        // Find nearest header on page
        const headerOnPage =
          doc.dafas.find(d => d.page === page.num) ||
          doc.anusuchis.find(a => a.page === page.num) ||
          doc.sabdaHeaders.find(s => s.page === page.num);

        matchedSnippets.push({
          pdfName: doc.pdfName,
          page: page.num,
          header: headerOnPage ? headerOnPage.headerText : `पृष्ठ ${page.num}`,
          text: page.text.slice(0, 1200),
          score
        });
      }
    }
  }

  // Sort by score and take top 6 most relevant pages
  matchedSnippets.sort((a, b) => b.score - a.score);
  const topContext = matchedSnippets.slice(0, 6);

  if (topContext.length === 0) {
    // If no keyword match, take first few sections or dafa list
    const fallbackDoc = allDocs[0];
    const topDafas = fallbackDoc.dafas.slice(0, 5).map(d => `${d.headerText} (पृष्ठ ${d.page})`).join('\n');
    topContext.push({
      pdfName: fallbackDoc.pdfName,
      page: 1,
      header: 'निर्देशिका प्रारम्भिक',
      text: `कागजात: ${fallbackDoc.pdfName}\nउपलब्ध मुख्य दफाहरू:\n${topDafas}`,
      score: 1
    });
  }

  const contextText = topContext
    .map(
      (c, i) =>
        `[कागजात ${i + 1}: ${c.pdfName} | पृष्ठ: ${c.page} | हेडर: ${c.header}]\n${c.text}\n---`
    )
    .join('\n\n');

  const systemInstruction = `तपाईं एक उच्च स्तरीय नेपाली कानुनी सहायक (Nepali Legal PDF Assistant) हुनुहुन्छ।
तपाईंको काम प्रयोगकर्ताको प्रश्नको उत्तर तल दिइएको "कागजात खण्ड" (PDF Context) को आधारमा मात्र दिनु हो।

नियमहरू:
१. बाहिरी ज्ञान प्रयोग नगर्नुहोस्। केवल दिइएको सन्दर्भमा भएको व्यवस्था मात्र भन्नुहोस्।
२. उत्तर दिँदा कुन PDF कागजातको कति पृष्ठ र कुन दफा/हेडरमा यो व्यवस्था छ, स्पष्ट रूपमा उद्धरण (Quote) सहित खुलाउनुहोस्।
३. यदि दिइएको कागजातमा उक्त प्रश्नको उत्तर छैन भने स्पष्ट भन्नुहोस्: "दिइएको PDF कागजातमा यस सम्बन्धी व्यवस्था भेटिएन।"
४. भाषा शुद्ध, शिष्ट र प्रामाणिक नेपाली कानुनी भाषा हुनुपर्छ।`;

  const prompt = `सन्दर्भ कागजातहरू:\n${contextText}\n\nप्रयोगकर्ताको प्रश्न: ${userQuestion}\n\nकृपया माथिको सन्दर्भबाट मात्र स्पष्ट कानुनी व्यवस्था, दफा/अनुसूची नम्बर, पृष्ठ नम्बर र उद्धरण सहित विस्तृत उत्तर दिनुहोस्।`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      systemInstruction
    }
  });

  const citations = topContext.map(c => ({
    pdfName: c.pdfName,
    page: c.page,
    section: c.header,
    quote: c.text.slice(0, 160) + '...'
  }));

  return {
    answer: response.text || 'कुनै उत्तर प्राप्त हुन सकेन।',
    citations
  };
}

/**
 * Chat Box 2: Search Outside PDF / Internet
 * Compares loaded PDF with real-time web search (amendments, court decisions, gazette updates).
 */
export async function queryOutsidePdf(
  apiKey: string,
  userQuestion: string,
  selectedPdf?: string
): Promise<{ answer: string; citations: any[] }> {
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
  const allDocs = pdfIndexStore.getAllDocuments();

  // Get current document summary/context to compare against
  let pdfOverview = '';
  if (allDocs.length > 0) {
    const targetDoc = selectedPdf ? allDocs.find(d => d.pdfName === selectedPdf) || allDocs[0] : allDocs[0];
    pdfOverview = `हाल प्रणालीमा लोड गरिएको कागजात: "${targetDoc.pdfName}" (कुल ${targetDoc.totalPages} पृष्ठ)।\nप्रमुख दफाहरू: ${targetDoc.dafas.slice(0, 8).map(d => d.headerText).join('; ')}`;
  }

  const systemInstruction = `तपाईं एक वरिष्ठ नेपाली कानुनी अनुसन्धानकर्ता (Nepali Legal Researcher) हुनुहुन्छ।
तपाईंले प्रयोगकर्ताको प्रश्नलाई नेपालको विद्यमान कानुन, राजपत्र (Nepal Gazette), मन्त्रालयका पछिल्ला निर्णय, सर्वोच्च अदालतका नजिर तथा इन्टरनेटमा उपलब्ध नयाँ संशोधनहरूसँग जोडेर अनुसन्धान गर्नुपर्छ।

प्रणालीमा लोड गरिएको PDF कागजातसँग तुलना गरी:
१. PDF मा भएको पुरानो/हालको व्यवस्था के छ?
२. इन्टरनेट खोज (Google Search) बाट प्राप्त पछिल्लो कानुनी संशोधन वा अद्यावधिक व्यवस्था के छ?
३. दुवैबीच के फरक (Difference/Comparison) छ?
४. वास्तविक स्रोत/लिङ्क (Citations) सहित नेपाली भाषामा स्पष्ट बुझाउनुहोस्।`;

  const prompt = `प्रणालीको आन्तरिक PDF स्थिति:\n${pdfOverview}\n\nप्रयोगकर्ताको प्रश्न / अनुसन्धान विषय:\n${userQuestion}\n\nकृपया इन्टरनेट खोज गरी नेपाल सरकारको पछिल्लो व्यवस्था, संशोधन, राजपत्र वा कानुनी अद्यावधिक स्थिति पत्ता लगाई तुलनात्मक र प्रामाणिक उत्तर दिनुहोस्।`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      systemInstruction,
      tools: [{ googleSearch: {} }]
    }
  });

  // Extract grounding citations if available
  const citations: any[] = [];
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (groundingChunks && Array.isArray(groundingChunks)) {
    for (const chunk of groundingChunks) {
      if (chunk.web?.uri) {
        citations.push({
          url: chunk.web.uri,
          title: chunk.web.title || 'नेपाल सरकार / कानुनी स्रोत'
        });
      }
    }
  }

  return {
    answer: response.text || 'कुनै उत्तर प्राप्त हुन सकेन।',
    citations
  };
}
