import React, { useState, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Copy,
  Check,
  Play,
  X,
  Download,
  Maximize2,
  Loader2,
} from 'lucide-react';
import useChatStore from '../store';
import { pyodideExecutor, agentManager } from '../AgentManager';

// Custom AMOLED theme
const amoledTheme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: '#0a0a0a',
    margin: 0,
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: '#0a0a0a',
  },
};

// Code Modal - Animated
function CodeModal({ isOpen, onClose, filename, code, language }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-3 animate-fade-in">
            <span className="text-sm font-medium text-white">{filename}</span>
            <span className="text-xs text-white/30 font-mono">{language}</span>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <SyntaxHighlighter
            language={language}
            style={amoledTheme}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              fontSize: '13px',
              minHeight: '100%',
              background: '#0a0a0a',
            }}
            showLineNumbers
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
}

// Web Preview Modal - Animated
function WebPreviewModal({ isOpen, onClose, htmlContent }) {
  const iframeRef = useRef(null);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content w-full max-w-4xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <span className="text-sm font-medium text-white animate-fade-in">Preview</span>
          <button onClick={onClose} className="btn-icon">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 bg-white rounded-b-2xl overflow-hidden">
          <iframe
            ref={iframeRef}
            srcDoc={htmlContent}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-forms allow-modals"
            title="Preview"
          />
        </div>
      </div>
    </div>
  );
}

// Python Output Modal - Animated
function PythonOutputModal({ isOpen, onClose, output, isLoading, success }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content w-full max-w-xl max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2 animate-fade-in">
            <span className="text-sm font-medium text-white">Output</span>
            {isLoading && <Loader2 className="w-3 h-3 animate-spin text-white/40" />}
          </div>
          <button onClick={onClose} className="btn-icon">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-24 animate-fade-in">
              <Loader2 className="w-6 h-6 animate-spin text-white/20" />
            </div>
          ) : (
            <pre className={`font-mono text-sm whitespace-pre-wrap animate-fade-in ${
              success ? 'text-white/70' : 'text-red-400'
            }`}>
              {output || 'No output'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// Main CodeBlock - Animated AMOLED
export default function CodeBlock({ code, language, filename }) {
  const [copied, setCopied] = useState(false);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [webPreviewOpen, setWebPreviewOpen] = useState(false);
  const [pythonOutputOpen, setPythonOutputOpen] = useState(false);
  const [pythonOutput, setPythonOutput] = useState('');
  const [pythonLoading, setPythonLoading] = useState(false);
  const [pythonSuccess, setPythonSuccess] = useState(true);

  const isWebFile = filename && agentManager.isWebExecutable(filename);
  const isPythonFile = filename && agentManager.isPython(filename);
  const canExecute = isWebFile || isPythonFile;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const downloadFilename = filename || `code.${language || 'txt'}`;
    agentManager.downloadFile(downloadFilename, code);
  };

  const handleRunWeb = () => setWebPreviewOpen(true);

  const handleRunPython = async () => {
    setPythonOutputOpen(true);
    setPythonLoading(true);
    setPythonOutput('');

    try {
      const result = await pyodideExecutor.execute(code);
      setPythonOutput(result.output);
      setPythonSuccess(result.success);
    } catch (error) {
      setPythonOutput(`Error: ${error.message}`);
      setPythonSuccess(false);
    } finally {
      setPythonLoading(false);
    }
  };

  const handleRun = () => {
    if (isWebFile) handleRunWeb();
    else if (isPythonFile) handleRunPython();
  };

  const displayLanguage = language || (filename ? agentManager.getLanguageFromFilename(filename) : 'text');

  return (
    <div className="my-3 rounded-xl overflow-hidden bg-[#0a0a0a] border border-white/5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span className="text-xs text-white/40 font-mono truncate">
          {filename || displayLanguage}
        </span>
        <div className="flex items-center gap-0.5">
          {canExecute && (
            <button
              onClick={handleRun}
              className="p-1.5 rounded-lg text-emerald-400/70 hover:text-emerald-400 hover:bg-white/5 
                         transition-all press-effect"
              title="Run"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
          <button 
            onClick={() => setCodeModalOpen(true)} 
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 
                       transition-all press-effect" 
            title="Expand"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={handleDownload} 
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 
                       transition-all press-effect" 
            title="Download"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={handleCopy} 
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 
                       transition-all press-effect" 
            title="Copy"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Code */}
      <div className="max-h-80 overflow-auto">
        <SyntaxHighlighter
          language={displayLanguage}
          style={amoledTheme}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: '13px',
            background: '#0a0a0a',
            padding: '12px',
          }}
          showLineNumbers
          wrapLongLines
        >
          {code}
        </SyntaxHighlighter>
      </div>

      {/* Modals */}
      <CodeModal
        isOpen={codeModalOpen}
        onClose={() => setCodeModalOpen(false)}
        filename={filename || displayLanguage}
        code={code}
        language={displayLanguage}
      />

      {isWebFile && (
        <WebPreviewModal
          isOpen={webPreviewOpen}
          onClose={() => setWebPreviewOpen(false)}
          htmlContent={code}
        />
      )}

      {isPythonFile && (
        <PythonOutputModal
          isOpen={pythonOutputOpen}
          onClose={() => setPythonOutputOpen(false)}
          output={pythonOutput}
          isLoading={pythonLoading}
          success={pythonSuccess}
        />
      )}
    </div>
  );
}

// Inline code - Minimal
export function InlineCode({ children }) {
  return (
    <code className="px-1.5 py-0.5 bg-white/10 text-white/90 rounded text-[13px] font-mono">
      {children}
    </code>
  );
}
