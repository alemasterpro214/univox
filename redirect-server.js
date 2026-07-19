const http = require('http');
const fs = require('fs');

const PORT = process.env.REDIRECT_PORT || 3001;
const URL_FILE = '/tmp/univox-current-url.txt';

function getCurrentUrl() {
  try {
    if (fs.existsSync(URL_FILE)) {
      const url = fs.readFileSync(URL_FILE, 'utf8').trim();
      if (url && url.startsWith('http')) return url;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function waitingHtml() {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unyvox - Attesa link...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%);
      color: white;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .container { padding: 40px; max-width: 500px; }
    .logo { font-size: 64px; margin-bottom: 20px; }
    h1 {
      font-size: 36px;
      margin-bottom: 10px;
      background: linear-gradient(90deg, #00d2ff, #3a7bd5);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: #00d2ff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 30px auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .note { color: rgba(255,255,255,0.5); margin-top: 20px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🚀</div>
    <h1>Unyvox</h1>
    <p class="subtitle">Attesa del link pubblico...</p>
    <div class="spinner"></div>
    <p class="note">Il server sta ancora avviando il tunnel. Questa pagina si aggiornerà automaticamente.</p>
  </div>
  <script>setTimeout(() => location.reload(), 5000);</script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = getCurrentUrl();

  if (url) {
    res.writeHead(302, {
      'Location': url,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end();
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(waitingHtml());
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`> Redirect server running at http://localhost:${PORT}`);
  console.log(`> Redirects to the current Cloudflare tunnel URL`);
});
