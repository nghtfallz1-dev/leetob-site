// API Configuration
const API_BASE_URL = 'https://open.anycorp.dev/v1';
const DEFAULT_API_KEY = 'sk-public';

// Text Models with friendly names
export const TEXT_MODELS = {
  'claude-haiku-4.5': 'Claude Haiku 4.5',
  'claude-opus-4.5': 'Claude Opus 4.5',
  'claude-opus-4.5-thinking': 'Claude Opus 4.5 Thinking',
  'claude-sonnet-4': 'Claude Sonnet 4',
  'claude-sonnet-4.5': 'Claude Sonnet 4.5',
  'claude-sonnet-4.5-thinking': 'Claude Sonnet 4.5 Thinking',
  'gemini-2.5-computer-use-preview': 'Gemini 2.5 Computer Use',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-3-flash-preview': 'Gemini 3 Flash Preview',
  'gemini-3-pro-preview': 'Gemini 3 Pro Preview',
};

// Image Models with friendly names
export const IMAGE_MODELS = {
  'gemini-3-pro-image-preview': 'Gemini 3 Pro Image',
  'gemini-2.5-flash-image': 'Gemini 2.5 Flash Image',
};

// Get API key from settings or use default
export const getApiKey = (customKey) => {
  return customKey || DEFAULT_API_KEY;
};

// Stream chat completion
export async function* streamChatCompletion(messages, options = {}) {
  const {
    model = 'gemini-2.5-flash',
    apiKey = DEFAULT_API_KEY,
    systemPrompt = 'You are a helpful assistant.',
    temperature = 0.7,
    agentMode = false,
  } = options;

  // Build system message
  let finalSystemPrompt = systemPrompt;
  if (agentMode) {
    finalSystemPrompt += '\n\nWhen creating apps, provide the full code for every file including filename comments (e.g., ### filename.ext or ```language:filename.ext) so I can save them. Always include complete file contents.';
  }

  const requestMessages = [
    { role: 'system', content: finalSystemPrompt },
    ...messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
  ];

  const response = await fetch(`${API_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: requestMessages,
      temperature,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || `API Error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    
    if (done) {
      // Finalize decoder and process remaining buffer
      buffer += decoder.decode();
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const content = json.choices?.[0]?.delta?.content;
        if (content) {
          yield content;
        }
      } catch (e) {
        // Skip malformed JSON
      }
    }
  }

  // Process any remaining data in the buffer after stream ends
  if (buffer.trim()) {
    const remainingLines = buffer.split('\n');
    for (const line of remainingLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const content = json.choices?.[0]?.delta?.content;
        if (content) {
          yield content;
        }
      } catch (e) {
        // Skip malformed JSON
      }
    }
  }
}

// Non-streaming chat completion
export async function chatCompletion(messages, options = {}) {
  const {
    model = 'gemini-2.5-flash',
    apiKey = DEFAULT_API_KEY,
    systemPrompt = 'You are a helpful assistant.',
    temperature = 0.7,
    agentMode = false,
  } = options;

  let finalSystemPrompt = systemPrompt;
  if (agentMode) {
    finalSystemPrompt += '\n\nWhen creating apps, provide the full code for every file including filename comments (e.g., ### filename.ext or ```language:filename.ext) so I can save them. Always include complete file contents.';
  }

  const requestMessages = [
    { role: 'system', content: finalSystemPrompt },
    ...messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
  ];

  const response = await fetch(`${API_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: requestMessages,
      temperature,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || `API Error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Generate image
export async function generateImage(prompt, options = {}) {
  const {
    model = 'gemini-2.5-flash-image',
    apiKey = DEFAULT_API_KEY,
  } = options;

  const response = await fetch(`${API_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || `API Error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  // Parse image from response - handle different response formats
  // The response might contain base64 image data or a URL
  if (content) {
    // Check if it's a base64 image
    const base64Match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
    if (base64Match) {
      return { type: 'base64', data: base64Match[0] };
    }
    
    // Check if it's a URL
    const urlMatch = content.match(/https?:\/\/[^\s"]+\.(png|jpg|jpeg|gif|webp)/i);
    if (urlMatch) {
      return { type: 'url', data: urlMatch[0] };
    }

    // Return raw content if it might be base64 without prefix
    if (content.length > 100 && /^[A-Za-z0-9+/=]+$/.test(content.trim())) {
      return { type: 'base64', data: `data:image/png;base64,${content.trim()}` };
    }
  }

  // If parsing fails, return the raw content for debugging
  return { type: 'text', data: content || 'No image generated' };
}

export default {
  streamChatCompletion,
  chatCompletion,
  generateImage,
  TEXT_MODELS,
  IMAGE_MODELS,
  getApiKey,
};
