import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  ArrowUp,
  Menu,
  Loader2,
  Zap,
  Image,
  MessageSquare,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Wand2,
  Upload,
  RefreshCw,
  PanelLeftClose,
} from 'lucide-react';
import useChatStore from '../store';
import { streamChatCompletion, generateImage, TEXT_MODELS } from '../api';
import { agentManager } from '../AgentManager';
import CodeBlock, { InlineCode } from './CodeBlock';
import { ChatImage } from './Gallery';

// AI-Powered Prompt Enhancer
const enhancePromptWithAI = async (prompt, isImageMode, apiKey, currentModel) => {
  if (!prompt.trim()) return prompt;
  
  const enhanceSystemPrompt = isImageMode 
    ? `You are a prompt engineer for image generation. Improve the given prompt by adding artistic details, lighting, style, and quality terms. Output ONLY the enhanced prompt, nothing else. Keep it concise but detailed.`
    : `You are a prompt engineer. Improve the given prompt to get better AI responses. Make it clearer, more specific, and well-structured. Output ONLY the enhanced prompt, nothing else.`;

  try {
    let enhanced = '';
    for await (const chunk of streamChatCompletion(
      [{ role: 'user', content: `Enhance this prompt: "${prompt}"` }],
      {
        model: currentModel,
        apiKey: apiKey,
        systemPrompt: enhanceSystemPrompt,
        temperature: 0.7,
      }
    )) {
      enhanced += chunk;
    }
    return enhanced.trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error('Enhancement failed:', error);
    if (isImageMode) {
      return `${prompt}, highly detailed, professional quality, 8k resolution`;
    }
    return prompt;
  }
};

// Message component with remake option
function Message({ message, isCollapsed, onToggleCollapse, onRemake, isRemaking }) {
  const isUser = message.role === 'user';
  const contentRef = useRef(null);
  const [shouldCollapse, setShouldCollapse] = useState(false);
  const [showRemakeMenu, setShowRemakeMenu] = useState(false);
  const remakeMenuRef = useRef(null);

  useEffect(() => {
    if (contentRef.current && !isUser) {
      const height = contentRef.current.scrollHeight;
      setShouldCollapse(height > 200);
    }
  }, [message.content, isUser]);

  // Close remake menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (remakeMenuRef.current && !remakeMenuRef.current.contains(event.target)) {
        setShowRemakeMenu(false);
      }
    };

    if (showRemakeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showRemakeMenu]);

  const markdownComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const code = String(children).replace(/\n$/, '');

      if (!inline && (language || code.includes('\n'))) {
        return <CodeBlock code={code} language={language} />;
      }
      return <InlineCode {...props}>{children}</InlineCode>;
    },
    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity">
        {children}
      </a>
    ),
  };

  return (
    <div className={`flex items-start gap-2 ${isUser ? 'justify-end' : 'justify-start'} group relative`}>
      {/* Left dot for AI messages */}
      {!isUser && (
        <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-3 flex-shrink-0" />
      )}
      
      <div
        className={`message-bubble ${isUser ? 'message-user' : 'message-assistant'} ${
          shouldCollapse && isCollapsed ? 'thread-collapsed' : ''
        }`}
        style={{ whiteSpace: 'pre-wrap' }}
      >
        <div ref={contentRef}>
          {message.type === 'image' && message.image ? (
            <ChatImage image={message.image} />
          ) : (
            <div className="prose-chat">
              <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Collapse/Expand button */}
        {shouldCollapse && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(message.id);
            }}
            className={`${isCollapsed ? 'thread-expand-btn' : 'mt-2 flex items-center gap-1 text-xs text-white/40 hover:text-white/60'}`}
          >
            {isCollapsed ? (
              <>Show more <ChevronDown className="w-3 h-3" /></>
            ) : (
              <>Show less <ChevronUp className="w-3 h-3" /></>
            )}
          </button>
        )}
      </div>

      {/* Right dot for user messages */}
      {isUser && (
        <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-3 flex-shrink-0" />
      )}

      {/* Remake button for AI messages */}
      {!isUser && onRemake && (
        <div className="relative self-start mt-1" ref={remakeMenuRef}>
          <button
            onClick={() => setShowRemakeMenu(!showRemakeMenu)}
            className="remake-btn"
            title="Remake with different model"
            disabled={isRemaking}
          >
            {isRemaking ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Remake dropdown */}
          {showRemakeMenu && (
            <div className="remake-dropdown">
              <p className="px-3 py-1 text-[10px] text-white/30 uppercase tracking-wide">Remake with</p>
              {Object.entries(TEXT_MODELS).slice(0, 5).map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => {
                    onRemake(message.id, id);
                    setShowRemakeMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Typing indicator
function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start animate-fade-in">
      <div className="message-bubble message-assistant">
        <div className="typing-indicator">
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

// Main Chat Interface
export default function ChatInterface() {
  const {
    settings,
    currentChatId,
    sidebarOpen,
    setSidebarOpen,
    createChat,
    addMessage,
    updateMessage,
    updateSettings,
    deleteMessage,
    addFiles,
    addToGallery,
    getCurrentChat,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const [collapsedMessages, setCollapsedMessages] = useState(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [remakingMessageId, setRemakingMessageId] = useState(null);
  const [isEnhanceHovered, setIsEnhanceHovered] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const dropZoneRef = useRef(null);

  const currentChat = getCurrentChat();
  const isImageMode = settings.generationMode === 'image';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChat?.messages]);

  useEffect(() => {
    if (!currentChatId) createChat();
  }, [currentChatId, createChat]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [input]);

  // Auto-collapse long messages
  useEffect(() => {
    if (currentChat?.messages) {
      const newCollapsed = new Set();
      currentChat.messages.forEach((msg, index) => {
        if (msg.role === 'assistant' && index < currentChat.messages.length - 3) {
          newCollapsed.add(msg.id);
        }
      });
      setCollapsedMessages(newCollapsed);
    }
  }, [currentChat?.messages?.length]);

  const toggleCollapse = (messageId) => {
    setCollapsedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const fileNames = files.map(f => f.name).join(', ');
      setInput(prev => prev + (prev ? '\n' : '') + `[Attached: ${fileNames}]`);
    }
  }, []);

  // AI-powered enhance
  const handleEnhancePrompt = async () => {
    if (!input.trim() || isEnhancing) return;
    setIsEnhancing(true);
    
    try {
      const enhanced = await enhancePromptWithAI(
        input, 
        isImageMode, 
        settings.apiKey, 
        settings.currentModel
      );
      setInput(enhanced);
    } catch (error) {
      console.error('Enhancement error:', error);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Remake message with different model
  const handleRemake = async (messageId, newModel) => {
    if (!currentChat) return;
    
    setRemakingMessageId(messageId);
    
    const msgIndex = currentChat.messages.findIndex(m => m.id === messageId);
    if (msgIndex < 1) return;
    
    const userMessage = currentChat.messages[msgIndex - 1];
    if (userMessage.role !== 'user') return;
    
    try {
      const messages = currentChat.messages.slice(0, msgIndex).map(m => ({ 
        role: m.role, 
        content: m.content 
      }));

      let fullContent = '';
      for await (const chunk of streamChatCompletion(messages, {
        model: newModel,
        apiKey: settings.apiKey,
        systemPrompt: settings.systemPrompt,
        temperature: settings.temperature,
      })) {
        fullContent += chunk;
        updateMessage(currentChatId, messageId, fullContent);
      }
    } catch (error) {
      console.error('Remake error:', error);
    } finally {
      setRemakingMessageId(null);
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    let chatId = currentChatId || createChat();
    addMessage(chatId, { role: 'user', content: userMessage });
    setIsLoading(true);

    try {
      if (settings.generationMode === 'image') {
        const result = await generateImage(userMessage, {
          model: settings.currentImageModel,
          apiKey: settings.apiKey,
        });

        if (result.type === 'base64' || result.type === 'url') {
          addToGallery({ type: result.type, data: result.data, prompt: userMessage });
          addMessage(chatId, { role: 'assistant', content: '', type: 'image', image: result });
        } else {
          addMessage(chatId, { role: 'assistant', content: result.data });
        }
      } else {
        const messages = currentChat?.messages.map(m => ({ role: m.role, content: m.content })) || [];
        messages.push({ role: 'user', content: userMessage });

        const assistantMsgId = addMessage(chatId, { role: 'assistant', content: '' });
        setStreamingMessageId(assistantMsgId);

        let fullContent = '';
        for await (const chunk of streamChatCompletion(messages, {
          model: settings.currentModel,
          apiKey: settings.apiKey,
          systemPrompt: settings.systemPrompt,
          temperature: settings.temperature,
          agentMode: settings.agentMode,
        })) {
          fullContent += chunk;
          updateMessage(chatId, assistantMsgId, fullContent);
        }

        setStreamingMessageId(null);

        if (settings.agentMode) {
          const parsedFiles = agentManager.parseFilesFromResponse(fullContent);
          if (parsedFiles.length > 0) {
            addFiles(chatId, parsedFiles);
            agentManager.addFiles(parsedFiles);
          }
        }
      }
    } catch (error) {
      console.error('API Error:', error);
      if (streamingMessageId) {
        deleteMessage(chatId, streamingMessageId);
        setStreamingMessageId(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleImageMode = () => {
    updateSettings({ 
      generationMode: isImageMode ? 'text' : 'image' 
    });
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div 
      ref={dropZoneRef}
      className={`flex-1 flex flex-col h-full bg-transparent drop-zone ${isDragging ? 'dragging' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header with sidebar toggle */}
      <header className="flex items-center justify-between px-5 py-4">
        <button onClick={toggleSidebar} className="btn-icon" title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}>
          {sidebarOpen ? (
            <PanelLeftClose className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
        
        <div className="flex items-center gap-2">
          {settings.agentMode && (
            <span className="badge badge-accent">
              <Zap className="w-3 h-3" />
              Agent
            </span>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {!currentChat?.messages?.length ? (
          <div className="flex flex-col items-center justify-center h-full animate-fade-in">
            <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-white/30" />
            </div>
            <p className="text-white/20 text-sm mb-1">Start a conversation</p>
            <p className="text-white/10 text-xs">Drag & drop files or type below</p>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto px-4">
            {currentChat.messages.map((message) => (
              <Message
                key={message.id}
                message={message}
                isCollapsed={collapsedMessages.has(message.id)}
                onToggleCollapse={toggleCollapse}
                onRemake={message.role === 'assistant' ? handleRemake : null}
                isRemaking={remakingMessageId === message.id}
              />
            ))}
            {isLoading && !streamingMessageId && <TypingIndicator />}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Input with ambient glow */}
      <div className="p-5 pt-2">
        <div className="max-w-2xl mx-auto">
          <div className={`ambient-glow ${input.trim() ? 'has-text' : ''}`}>
            <div className="chat-input-container items-center">
              {/* Mode Toggle */}
              <button
                onClick={toggleImageMode}
                className={`mode-toggle-btn flex-shrink-0 ${isImageMode ? 'active' : ''}`}
                title={isImageMode ? 'Switch to Text' : 'Switch to Image'}
              >
                {isImageMode ? (
                  <Image className="w-4 h-4" />
                ) : (
                  <MessageSquare className="w-4 h-4" />
                )}
              </button>

              {/* Input */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isImageMode ? "Describe an image..." : "Message..."}
                className="input-minimal"
                rows={1}
                disabled={isLoading}
              />

              {/* Enhance button */}
              <button
                onClick={handleEnhancePrompt}
                onMouseEnter={() => setIsEnhanceHovered(true)}
                onMouseLeave={() => setIsEnhanceHovered(false)}
                disabled={isEnhancing || !input.trim()}
                className={`mode-toggle-btn flex-shrink-0 flex items-center gap-1 transition-all duration-200 ${
                  input.trim() ? 'text-white/30 hover:text-white/60' : 'text-white/10 cursor-default'
                }`}
                title="Enhance prompt"
              >
                {isEnhancing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                <span
                  className={`text-xs overflow-hidden whitespace-nowrap transition-all duration-200 ${
                    isEnhanceHovered && input.trim() ? 'max-w-[60px] opacity-100' : 'max-w-0 opacity-0'
                  }`}
                >
                  Enhance
                </span>
              </button>

              {/* Upload hint */}
              <button
                className="mode-toggle-btn flex-shrink-0 opacity-50 hover:opacity-100"
                title="Drag & drop files"
              >
                <Upload className="w-4 h-4" />
              </button>

              {/* Send Button */}
              <button
                onClick={handleSubmit}
                disabled={isLoading || !input.trim()}
                className={`flex-shrink-0 p-2 rounded-full transition-all ${
                  input.trim() && !isLoading
                    ? 'bg-white text-black hover:bg-white/90 active:scale-95'
                    : 'bg-white/10 text-white/20'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
