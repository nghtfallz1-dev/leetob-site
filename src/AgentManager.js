import JSZip from 'jszip';

// Virtual File System Manager
class AgentManager {
  constructor() {
    this.files = new Map();
  }

  // Parse code blocks from AI response and extract files
  parseFilesFromResponse(content) {
    const files = [];
    
    // Pattern 1: ### filename.ext followed by code block
    const headerPattern = /###\s+([^\n]+\.[a-zA-Z0-9]+)\s*\n```(?:[a-zA-Z0-9]+)?\n([\s\S]*?)```/g;
    let match;
    
    while ((match = headerPattern.exec(content)) !== null) {
      const filename = match[1].trim();
      const code = match[2].trim();
      files.push({ filename, code, language: this.getLanguageFromFilename(filename) });
    }

    // Pattern 2: ```language:filename.ext or ```language filename.ext
    const inlinePattern = /```([a-zA-Z0-9]+)[:\s]+([^\n]+\.[a-zA-Z0-9]+)\s*\n([\s\S]*?)```/g;
    
    while ((match = inlinePattern.exec(content)) !== null) {
      const language = match[1];
      const filename = match[2].trim();
      const code = match[3].trim();
      
      // Avoid duplicates
      if (!files.find(f => f.filename === filename)) {
        files.push({ filename, code, language });
      }
    }

    // Pattern 3: // filename.ext or <!-- filename.ext --> at the start of code block
    const commentPattern = /```([a-zA-Z0-9]*)\n(?:\/\/|<!--|#|\/\*)\s*([^\n]+\.[a-zA-Z0-9]+)\s*(?:-->|\*\/)?\n([\s\S]*?)```/g;
    
    while ((match = commentPattern.exec(content)) !== null) {
      const language = match[1] || 'text';
      const filename = match[2].trim();
      const code = match[3].trim();
      
      if (!files.find(f => f.filename === filename)) {
        files.push({ filename, code, language });
      }
    }

    return files;
  }

  // Get language from filename extension
  getLanguageFromFilename(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap = {
      'js': 'javascript',
      'jsx': 'jsx',
      'ts': 'typescript',
      'tsx': 'tsx',
      'py': 'python',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'md': 'markdown',
      'sql': 'sql',
      'sh': 'bash',
      'bash': 'bash',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
      'rs': 'rust',
      'go': 'go',
      'rb': 'ruby',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin',
      'vue': 'vue',
      'svelte': 'svelte',
    };
    return languageMap[ext] || 'text';
  }

  // Check if file is web-executable (HTML/CSS/JS)
  isWebExecutable(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ['html', 'htm'].includes(ext);
  }

  // Check if file is Python
  isPython(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext === 'py';
  }

  // Add files to VFS
  addFiles(files) {
    files.forEach(file => {
      this.files.set(file.filename, file);
    });
  }

  // Get all files
  getAllFiles() {
    return Array.from(this.files.values());
  }

  // Get file by name
  getFile(filename) {
    return this.files.get(filename);
  }

  // Clear all files
  clearFiles() {
    this.files.clear();
  }

  // Remove a file
  removeFile(filename) {
    this.files.delete(filename);
  }

  // Update file content
  updateFile(filename, code) {
    const file = this.files.get(filename);
    if (file) {
      file.code = code;
      this.files.set(filename, file);
    }
  }

  // Create sandbox HTML for web preview
  createWebSandbox(files) {
    // Find HTML file
    const htmlFile = files.find(f => this.isWebExecutable(f.filename));
    if (!htmlFile) return null;

    let htmlContent = htmlFile.code;

    // Find CSS files and inject them
    const cssFiles = files.filter(f => f.filename.endsWith('.css'));
    cssFiles.forEach(cssFile => {
      const styleTag = `<style>\n${cssFile.code}\n</style>`;
      if (htmlContent.includes('</head>')) {
        htmlContent = htmlContent.replace('</head>', `${styleTag}\n</head>`);
      } else if (htmlContent.includes('<body')) {
        htmlContent = htmlContent.replace('<body', `${styleTag}\n<body`);
      } else {
        htmlContent = styleTag + '\n' + htmlContent;
      }
    });

    // Find JS files and inject them
    const jsFiles = files.filter(f => f.filename.endsWith('.js') && !f.filename.endsWith('.json'));
    jsFiles.forEach(jsFile => {
      const scriptTag = `<script>\n${jsFile.code}\n</script>`;
      if (htmlContent.includes('</body>')) {
        htmlContent = htmlContent.replace('</body>', `${scriptTag}\n</body>`);
      } else {
        htmlContent = htmlContent + '\n' + scriptTag;
      }
    });

    return htmlContent;
  }

  // Generate ZIP archive
  async generateZip(files, format = 'zip') {
    const zip = new JSZip();
    
    files.forEach(file => {
      // Handle nested paths
      const path = file.filename;
      zip.file(path, file.code);
    });

    const blob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });

    return blob;
  }

  // Download ZIP
  async downloadZip(files, projectName = 'project') {
    const blob = await this.generateZip(files);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Download single file
  downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Pyodide executor singleton
class PyodideExecutor {
  constructor() {
    this.pyodide = null;
    this.loading = false;
    this.loaded = false;
  }

  async initialize() {
    if (this.loaded) return this.pyodide;
    if (this.loading) {
      // Wait for loading to complete
      while (this.loading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.pyodide;
    }

    this.loading = true;
    try {
      // eslint-disable-next-line no-undef
      this.pyodide = await loadPyodide();
      this.loaded = true;
      return this.pyodide;
    } catch (error) {
      console.error('Failed to load Pyodide:', error);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async execute(code) {
    const pyodide = await this.initialize();
    
    // Capture stdout and stderr
    let output = '';
    
    pyodide.setStdout({
      batched: (text) => { output += text + '\n'; }
    });
    
    pyodide.setStderr({
      batched: (text) => { output += '[Error] ' + text + '\n'; }
    });

    try {
      const result = await pyodide.runPythonAsync(code);
      if (result !== undefined && result !== null) {
        output += String(result);
      }
      return { success: true, output: output.trim() || 'Code executed successfully (no output)' };
    } catch (error) {
      return { success: false, output: error.message };
    }
  }
}

// Export singleton instances
export const agentManager = new AgentManager();
export const pyodideExecutor = new PyodideExecutor();

export default {
  agentManager,
  pyodideExecutor,
  AgentManager,
  PyodideExecutor,
};
