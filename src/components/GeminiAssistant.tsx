import React, { useState } from 'react';
import {
  Sparkles, Key, CheckCircle, AlertCircle, Send, Globe,
  FileSearch, Copy, Check, ExternalLink, RefreshCw, MessageSquare
} from 'lucide-react';
import { ChatMessageItem } from '../types';

interface GeminiAssistantProps {
  onApiKeyChange: (key: string, isValid: boolean) => void;
  selectedPdfName?: string;
}

export const GeminiAssistant: React.FC<GeminiAssistantProps> = ({
  onApiKeyChange,
  selectedPdfName
}) => {
  const [apiKey, setApiKey] = useState('');
  const [testingKey, setTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [keyError, setKeyError] = useState('');

  const [activeTab, setActiveTab] = useState<'inside' | 'outside'>('inside');

  // Chat 1 (Inside PDF)
  const [insideInput, setInsideInput] = useState('');
  const [insideLoading, setInsideLoading] = useState(false);
  const [insideMessages, setInsideMessages] = useState<ChatMessageItem[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: 'नमस्ते! म तपाईंको नेपाली कानुनी AI सहायक हुँ। हाल लोड गरिएका PDF कागजातहरूका दफा, उपदफा र अनुसूचीका आधारमा म तपाईंलाई स्पष्ट कानुनी व्यवस्था र पृष्ठ नम्बर सहित उत्तर दिन सक्छु।',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Chat 2 (Outside PDF / Web Search Grounding)
  const [outsideInput, setOutsideInput] = useState('');
  const [outsideLoading, setOutsideLoading] = useState(false);
  const [outsideMessages, setOutsideMessages] = useState<ChatMessageItem[]>([
    {
      id: 'welcome-2',
      role: 'assistant',
      content: 'नमस्ते! म बाह्य कानुनी तथा इन्टरनेट अनुसन्धान सहायक हुँ। म लोड गरिएको PDF को व्यवस्थालाई नेपाल राजपत्र, पछिल्ला संशोधनहरू र अनलाइन कानुनी स्रोतहरूसँग तुलना गरी नयाँ व्यवस्था बताउन सक्छु।',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Test API Key
  const handleTestKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!apiKey.trim()) {
      setKeyStatus('invalid');
      setKeyError('कृपया API कुञ्जी प्रविष्ट गर्नुहोस्।');
      return;
    }

    setTestingKey(true);
    setKeyError('');

    try {
      const res = await fetch('/api/gemini/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() })
      });
      const data = await res.json();
      setTestingKey(false);

      if (data.valid) {
        setKeyStatus('valid');
        onApiKeyChange(apiKey.trim(), true);
      } else {
        setKeyStatus('invalid');
        setKeyError(data.error || 'API कुञ्जी प्रमाणीकरण हुन सकेन।');
        onApiKeyChange('', false);
      }
    } catch (err: any) {
      setTestingKey(false);
      setKeyStatus('invalid');
      setKeyError(err.message || 'परीक्षण गर्दा त्रुटि उत्पन्न भयो।');
      onApiKeyChange('', false);
    }
  };

  // Submit Inside PDF Query
  const handleSendInside = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = insideInput.trim();
    if (!q || insideLoading || keyStatus !== 'valid') return;

    const userMsg: ChatMessageItem = {
      id: String(Date.now()),
      role: 'user',
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setInsideMessages(prev => [...prev, userMsg]);
    setInsideInput('');
    setInsideLoading(true);

    try {
      const res = await fetch('/api/gemini/chat-inside', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          question: q,
          selectedPdf: selectedPdfName
        })
      });
      const data = await res.json();
      setInsideLoading(false);

      if (data.success) {
        const assistantMsg: ChatMessageItem = {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: data.answer,
          citations: data.citations,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setInsideMessages(prev => [...prev, assistantMsg]);
      } else {
        const errorMsg: ChatMessageItem = {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: `त्रुटि: ${data.error || 'उत्तर प्राप्त गर्न सकिएन।'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setInsideMessages(prev => [...prev, errorMsg]);
      }
    } catch (err: any) {
      setInsideLoading(false);
      setInsideMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: `त्रुटि: ${err.message || 'अनुरोध असफल भयो।'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  // Submit Outside PDF Query
  const handleSendOutside = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = outsideInput.trim();
    if (!q || outsideLoading || keyStatus !== 'valid') return;

    const userMsg: ChatMessageItem = {
      id: String(Date.now()),
      role: 'user',
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setOutsideMessages(prev => [...prev, userMsg]);
    setOutsideInput('');
    setOutsideLoading(true);

    try {
      const res = await fetch('/api/gemini/chat-outside', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          question: q,
          selectedPdf: selectedPdfName
        })
      });
      const data = await res.json();
      setOutsideLoading(false);

      if (data.success) {
        const assistantMsg: ChatMessageItem = {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: data.answer,
          citations: data.citations,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setOutsideMessages(prev => [...prev, assistantMsg]);
      } else {
        const errorMsg: ChatMessageItem = {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: `त्रुटि: ${data.error || 'इन्टरनेट खोज उत्तर प्राप्त गर्न सकिएन।'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setOutsideMessages(prev => [...prev, errorMsg]);
      }
    } catch (err: any) {
      setOutsideLoading(false);
      setOutsideMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: `त्रुटि: ${err.message || 'अनुरोध असफल भयो।'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 sm:p-5 mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-100 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center text-white shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
              <span>Gemini AI कानुनी सहायक (AI Assistant)</span>
              <span className="text-[11px] font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                Gemini 3.8 Flash
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              ऐच्छिक सुविधा — API Key परीक्षण गरेर कागजात भित्र वा इन्टरनेट मार्फत अनुसन्धान गर्नुहोस्।
            </p>
          </div>
        </div>

        {/* API Key Status Pill */}
        <div>
          {keyStatus === 'valid' ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              API कुञ्जी सक्रिय छ
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              <Key className="w-3.5 h-3.5" />
              कुञ्जी प्रमाणीकरण आवश्यक
            </span>
          )}
        </div>
      </div>

      {/* API Key Input Panel */}
      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Key className="w-4 h-4" />
            </div>
            <input
              type="password"
              placeholder="आफ्नो Gemini API Key प्रविष्ट गर्नुहोस् (उदा. AIzaSy...)"
              value={apiKey}
              onChange={e => {
                setApiKey(e.target.value);
                if (keyStatus !== 'idle') setKeyStatus('idle');
              }}
              className="w-full text-xs sm:text-sm bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-slate-800 focus:ring-2 focus:ring-purple-700/20 focus:border-purple-600 outline-none"
            />
          </div>
          <button
            onClick={() => handleTestKey()}
            disabled={testingKey || !apiKey.trim()}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg text-xs sm:text-sm shadow-xs transition-colors shrink-0 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {testingKey ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>परीक्षण हुँदैछ...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Test API Key (परीक्षण गर्नुहोस्)</span>
              </>
            )}
          </button>
        </div>

        {keyStatus === 'valid' && (
          <div className="mt-2 text-xs text-emerald-700 flex items-center gap-1 font-medium">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            API कुञ्जी सफलतापूर्वक प्रमाणित भयो! तलका च्याट बाकसहरू प्रयोगका लागि तयार छन्।
          </div>
        )}
        {keyStatus === 'invalid' && keyError && (
          <div className="mt-2 text-xs text-red-600 flex items-center gap-1 bg-red-50 p-2 rounded">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {keyError}
          </div>
        )}
      </div>

      {/* Chat Tabs */}
      <div className="flex border-b border-slate-200 mb-4">
        <button
          onClick={() => setActiveTab('inside')}
          className={`pb-2.5 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'inside'
              ? 'border-purple-600 text-purple-900 bg-purple-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSearch className="w-4 h-4 text-purple-700" />
          <span>Chat Box 1: Search Inside PDF (कागजात भित्र मात्र खोज)</span>
        </button>
        <button
          onClick={() => setActiveTab('outside')}
          className={`pb-2.5 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'outside'
              ? 'border-blue-600 text-blue-900 bg-blue-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Globe className="w-4 h-4 text-blue-700" />
          <span>Chat Box 2: Search Outside PDF / Internet (इन्टरनेट तथा बाह्य खोज)</span>
        </button>
      </div>

      {/* Tab 1: Search Inside PDF */}
      {activeTab === 'inside' && (
        <div>
          <div className="text-xs text-slate-500 mb-3 bg-purple-50/60 p-2.5 rounded-lg border border-purple-100 flex items-center justify-between">
            <span>
              🔒 यस च्याटले हाल लोड गरिएका PDF कागजातहरू भित्र मात्र हेरेर दफा, पृष्ठ र उद्धरण खुलाउँछ।
            </span>
            {selectedPdfName && (
              <span className="font-semibold text-purple-900">
                लक्षित: {selectedPdfName}
              </span>
            )}
          </div>

          {/* Conversation history */}
          <div className="space-y-3 max-h-96 overflow-y-auto p-3 bg-slate-50/70 rounded-xl border border-slate-200 mb-3">
            {insideMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-purple-700 text-white rounded-br-none'
                      : 'bg-white border border-slate-200 text-slate-800 shadow-2xs rounded-bl-none'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Citations if available */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                      <div className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                        प्रमाणित स्रोत तथा पृष्ठ (Citations):
                      </div>
                      {msg.citations.map((c, i) => (
                        <div key={i} className="bg-slate-50 p-1.5 rounded border border-slate-200 text-[11px]">
                          <strong>{c.pdfName}</strong> (पृष्ठ {c.page}) — {c.section}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1 px-1">
                  <span>{msg.timestamp}</span>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="hover:text-slate-600 p-0.5"
                      title="प्रतिलिपि"
                    >
                      {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {insideLoading && (
              <div className="flex items-center gap-2 text-xs text-purple-700 p-3 bg-white rounded-xl border border-purple-200 max-w-xs">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>कागजात विश्लेषण गरी उत्तर तयार गर्दै...</span>
              </div>
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSendInside} className="flex gap-2">
            <input
              type="text"
              placeholder={
                keyStatus === 'valid'
                  ? 'कागजात सम्बन्धी प्रश्न सोध्नुहोस् (उदा. टायल चेक गर्ने प्रक्रिया के छ?)...'
                  : 'पहिले माथि आफ्नो Gemini API Key परीक्षण गर्नुहोस्'
              }
              value={insideInput}
              onChange={e => setInsideInput(e.target.value)}
              disabled={keyStatus !== 'valid' || insideLoading}
              className="flex-1 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-2 focus:ring-purple-700/20 focus:border-purple-600 outline-none disabled:bg-slate-100 disabled:text-slate-400"
            />
            <button
              type="submit"
              disabled={keyStatus !== 'valid' || insideLoading || !insideInput.trim()}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg text-xs sm:text-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>सोध्नुहोस्</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Search Outside PDF / Internet */}
      {activeTab === 'outside' && (
        <div>
          <div className="text-xs text-slate-500 mb-3 bg-blue-50/60 p-2.5 rounded-lg border border-blue-100 flex items-center justify-between">
            <span>
              🌐 यस च्याटले लोड गरिएको PDF को व्यवस्थालाई गुगल सर्च (Google Search Grounding) मार्फत नयाँ राजपत्र र संशोधनहरूसँग तुलना गर्छ।
            </span>
          </div>

          {/* Conversation history */}
          <div className="space-y-3 max-h-96 overflow-y-auto p-3 bg-slate-50/70 rounded-xl border border-slate-200 mb-3">
            {outsideMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-700 text-white rounded-br-none'
                      : 'bg-white border border-slate-200 text-slate-800 shadow-2xs rounded-bl-none'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Web Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs space-y-1">
                      <div className="font-bold text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1">
                        <Globe className="w-3 h-3 text-blue-600" />
                        अनलाइन स्रोत तथा लिङ्कहरू (Web Citations):
                      </div>
                      {msg.citations.map((c, i) => (
                        <a
                          key={i}
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-[11px] text-blue-700 hover:underline truncate bg-blue-50/60 p-1.5 rounded border border-blue-100"
                        >
                          🔗 {c.title || c.url}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1 px-1">
                  <span>{msg.timestamp}</span>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="hover:text-slate-600 p-0.5"
                      title="प्रतिलिपि"
                    >
                      {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {outsideLoading && (
              <div className="flex items-center gap-2 text-xs text-blue-700 p-3 bg-white rounded-xl border border-blue-200 max-w-xs">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>गुगल सर्च मार्फत नयाँ संशोधन खोजी तुलना गर्दै...</span>
              </div>
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSendOutside} className="flex gap-2">
            <input
              type="text"
              placeholder={
                keyStatus === 'valid'
                  ? 'इन्टरनेट र राजपत्र तुलनात्मक प्रश्न (उदा. भूमि प्रशासन निर्देशिकामा हालसालै के संशोधन भयो?)...'
                  : 'पहिले माथि आफ्नो Gemini API Key परीक्षण गर्नुहोस्'
              }
              value={outsideInput}
              onChange={e => setOutsideInput(e.target.value)}
              disabled={keyStatus !== 'valid' || outsideLoading}
              className="flex-1 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-700/20 focus:border-blue-600 outline-none disabled:bg-slate-100 disabled:text-slate-400"
            />
            <button
              type="submit"
              disabled={keyStatus !== 'valid' || outsideLoading || !outsideInput.trim()}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg text-xs sm:text-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>सोध्नुहोस्</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
