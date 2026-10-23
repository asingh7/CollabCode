// Secure API endpoint for code execution
// Proxies requests to a code-execution provider.
//
// Provider selection:
// - If PISTON_API_URL is set (e.g. a self-hosted Piston instance), it is used.
// - Otherwise Wandbox (https://wandbox.org) is used: the public Piston API
//   became whitelist-only on 2026-02-15 and rejects this app's requests.
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { language, code, stdin } = req.body || {};

    // Validate input
    if (!language || !code) {
      return res.status(400).json({ error: 'Language and code are required' });
    }

    // Security: Limit code size (100KB)
    if (code.length > 100000) {
      return res.status(400).json({ error: 'Code too large (max 100KB)' });
    }

    if (process.env.PISTON_API_URL) {
      return await executeViaPiston(req, res, { language, code, stdin });
    }
    return await executeViaWandbox(res, { language, code, stdin });
  } catch (error) {
    console.error('Error executing code:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}

// ---------------------------------------------------------------------------
// Wandbox provider
// ---------------------------------------------------------------------------

// App language -> Wandbox "language" label (see https://wandbox.org/api/list.json)
const WANDBOX_LANGUAGES = {
  javascript: 'JavaScript',
  python: 'Python',
  java: 'Java',
  c_cpp: 'C++',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  typescript: 'TypeScript',
  sql: 'SQL',
  r: 'R',
  perl: 'Perl',
  scala: 'Scala',
  haskell: 'Haskell',
  lua: 'Lua',
  elixir: 'Elixir'
  // Not offered by Wandbox: kotlin, dart
};

// Fetch with one retry: the free Wandbox service occasionally drops
// connections or answers 5xx on the first attempt.
async function fetchWithRetry(url, options = {}, retries = 1) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, options);
      if (resp.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      return resp;
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      throw lastError;
    }
  }
}

let wandboxCompilerCache = null;

function versionKey(name) {
  const m = name.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3] || '0', 10)];
}

async function pickWandboxCompiler(languageLabel) {
  if (!wandboxCompilerCache) {
    const resp = await fetchWithRetry('https://wandbox.org/api/list.json');
    if (!resp.ok) throw new Error(`Wandbox list request failed: HTTP ${resp.status}`);
    wandboxCompilerCache = await resp.json();
  }
  const candidates = wandboxCompilerCache
    .filter((c) => c.language === languageLabel)
    .filter((c) => !c.name.includes('head'))
    .filter((c) => !(languageLabel === 'Python' && c.name.includes('2.7')));
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const va = versionKey(a.name);
    const vb = versionKey(b.name);
    for (let i = 0; i < 3; i++) {
      if (vb[i] !== va[i]) return vb[i] - va[i];
    }
    return 0;
  });
  return candidates[0].name;
}

async function executeViaWandbox(res, { language, code, stdin }) {
  const languageLabel = WANDBOX_LANGUAGES[language] || null;
  if (!languageLabel) {
    return res.status(400).json({
      error: `Language ${language} is not supported by the code execution provider`,
      details: 'Supported languages: ' + Object.keys(WANDBOX_LANGUAGES).join(', ')
    });
  }

  const compiler = await pickWandboxCompiler(languageLabel);
  if (!compiler) {
    return res.status(502).json({
      error: 'Code execution failed',
      details: `No compiler available for ${languageLabel}`
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  let response;
  try {
    response = await fetchWithRetry('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compiler,
        code,
        stdin: stdin || '',
        save: false
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Wandbox API error:', errorText);
    return res.status(502).json({
      error: 'Code execution failed',
      details: errorText
    });
  }

  const result = await response.json();
  const exitCode = parseInt(result.status, 10);

  return res.status(200).json({
    success: true,
    output: result.program_output || '',
    stdout: result.program_output || '',
    stderr: result.program_error || result.compiler_error || '',
    code: Number.isNaN(exitCode) ? null : exitCode,
    signal: result.signal || null,
    compile_output: [result.compiler_output, result.compiler_error]
      .filter(Boolean)
      .join('\n')
  });
}

// ---------------------------------------------------------------------------
// Piston provider (only when PISTON_API_URL is configured, e.g. self-hosted)
// ---------------------------------------------------------------------------

const PISTON_LANGUAGE_MAP = {
  javascript: 'javascript',
  python: 'python',
  java: 'java',
  c_cpp: 'cpp',
  go: 'go',
  rust: 'rust',
  ruby: 'ruby',
  php: 'php',
  csharp: 'csharp',
  swift: 'swift',
  kotlin: 'kotlin',
  typescript: 'typescript',
  r: 'r',
  perl: 'perl',
  scala: 'scala',
  haskell: 'haskell',
  lua: 'lua',
  elixir: 'elixir',
  dart: 'dart',
  sql: 'sql'
};

async function executeViaPiston(req, res, { language, code, stdin }) {
  const PISTON_API = process.env.PISTON_API_URL;
  const pistonLanguage = PISTON_LANGUAGE_MAP[language] || language;

  const response = await fetch(`${PISTON_API}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: pistonLanguage,
      version: '*',
      files: [{ content: code }],
      stdin: stdin || '',
      args: [],
      compile_timeout: 10000,
      run_timeout: 3000,
      compile_memory_limit: -1,
      run_memory_limit: -1
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Piston API error:', error);
    return res.status(response.status).json({
      error: 'Code execution failed',
      details: error
    });
  }

  const result = await response.json();

  return res.status(200).json({
    success: true,
    output: result.run?.output || '',
    stdout: result.run?.stdout || '',
    stderr: result.run?.stderr || '',
    code: result.run?.code,
    signal: result.run?.signal,
    compile_output: result.compile?.output || ''
  });
}
