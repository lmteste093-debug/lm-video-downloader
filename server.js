const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Pasta de downloads
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Mapeamento de qualidades otimizado
const QUALITY_MAP = {
    '4K': 'bestvideo[height<=2160]+bestaudio/best[height<=2160]',
    '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    '720p': 'best[height<=720]',
    '480p': 'best[height<=480]',
    '360p': 'best[height<=360]',
    'mp3': 'bestaudio'
};

// Cache de cookies (evita escrever arquivo a cada requisição)
let cachedInstagramCookies = null;
let cachedFacebookCookies = null;

// Função para obter comando otimizado por plataforma
function buildOptimizedCommand(plataforma, url, format, filepath, qualidade) {
    // Comandos base otimizados
    const baseOptions = `--no-cache-dir --rm-cache-dir --limit-rate 2M --retries 5 --fragment-retries 5`;
    
    switch(plataforma) {
        case 'tiktok':
            return `yt-dlp ${baseOptions} --impersonate chrome-131 -f "${format}" --merge-output-format mp4 -o "${filepath}" "${url}"`;
            
        case 'facebook':
            return `yt-dlp ${baseOptions} --impersonate chrome-116 -f "${format}" --merge-output-format mp4 -o "${filepath}" "${url}"`;
            
        case 'youtube':
            // YouTube com opções específicas para evitar bloqueios
            const youtubeOptions = qualidade === '720p' ? '-f "best[height<=720]"' : `-f "${format}"`;
            return `yt-dlp ${baseOptions} --extractor-retries 10 --sleep-requests 2 --sleep-interval 3 --max-sleep-interval 10 ${youtubeOptions} --merge-output-format mp4 -o "${filepath}" "${url}"`;
            
        case 'instagram':
            if (!cachedInstagramCookies) {
                cachedInstagramCookies = process.env.COOKIES_INSTAGRAM || '';
                if (cachedInstagramCookies) {
                    fs.writeFileSync('/tmp/ig_cookies.txt', cachedInstagramCookies);
                }
            }
            const cookieOpt = cachedInstagramCookies ? '--cookies "/tmp/ig_cookies.txt"' : '';
            return `yt-dlp ${baseOptions} ${cookieOpt} --add-header "Referer:https://www.instagram.com/" -f "${format}" --merge-output-format mp4 -o "${filepath}" "${url}"`;
            
        default:
            return `yt-dlp -f "best" -o "${filepath}" "${url}"`;
    }
}

// Limpeza periódica de arquivos antigos
setInterval(() => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    if (fs.existsSync(DOWNLOADS_DIR)) {
        fs.readdirSync(DOWNLOADS_DIR).forEach(file => {
            const filepath = path.join(DOWNLOADS_DIR, file);
            const stats = fs.statSync(filepath);
            if (now - stats.mtimeMs > oneHour) {
                fs.unlinkSync(filepath);
                console.log(`🗑️ Limpeza automática: ${file}`);
            }
        });
    }
}, 30 * 60 * 1000); // A cada 30 minutos

// Interface HTML inline (evita arquivos extras)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>LM Video Downloader</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
                    min-height: 100vh;
                    padding: 20px;
                }
                .container {
                    max-width: 650px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 20px;
                    padding: 30px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                h1 { text-align: center; color: #333; margin-bottom: 10px; font-size: 28px; }
                .subtitle { text-align: center; color: #666; margin-bottom: 25px; font-size: 14px; }
                input, select, button {
                    width: 100%;
                    padding: 12px;
                    margin: 8px 0;
                    border: 2px solid #ddd;
                    border-radius: 8px;
                    font-size: 14px;
                    box-sizing: border-box;
                }
                input:focus, select:focus {
                    outline: none;
                    border-color: #ff5722;
                }
                button {
                    background: #ff5722;
                    color: white;
                    border: none;
                    cursor: pointer;
                    font-weight: bold;
                    transition: opacity 0.3s;
                }
                button:hover { opacity: 0.9; }
                button:disabled { opacity: 0.5; cursor: not-allowed; }
                .badges {
                    display: flex;
                    justify-content: center;
                    gap: 10px;
                    margin: 15px 0;
                    flex-wrap: wrap;
                }
                .badge {
                    padding: 5px 15px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: bold;
                    color: white;
                }
                .badge.instagram { background: #e4405f; }
                .badge.tiktok { background: #000; }
                .badge.facebook { background: #1877f2; }
                .badge.youtube { background: #ff0000; }
                .progresso-container {
                    margin-top: 15px;
                    display: none;
                }
                .progresso-bar {
                    width: 100%;
                    height: 25px;
                    background: #e0e0e0;
                    border-radius: 12px;
                    overflow: hidden;
                }
                .progresso-fill {
                    width: 0%;
                    height: 100%;
                    background: linear-gradient(90deg, #28a745, #20c997);
                    border-radius: 12px;
                    transition: width 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 11px;
                    font-weight: bold;
                }
                .status-text {
                    font-size: 12px;
                    color: #666;
                    margin-top: 8px;
                    text-align: center;
                }
                .resultado {
                    margin-top: 15px;
                    padding: 15px;
                    border-radius: 8px;
                    display: none;
                    font-size: 13px;
                }
                .sucesso { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                .erro { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                .carregando { background: #e2e3e5; color: #383d41; }
                .download-link {
                    display: inline-block;
                    background: #28a745;
                    color: white;
                    padding: 10px 20px;
                    text-decoration: none;
                    border-radius: 5px;
                    margin-top: 10px;
                    font-weight: bold;
                }
                .info {
                    background: rgba(0,0,0,0.05);
                    border-radius: 8px;
                    padding: 10px;
                    margin-top: 15px;
                    font-size: 11px;
                    color: #666;
                    text-align: center;
                }
                @media (max-width: 768px) {
                    .container { padding: 20px; }
                    h1 { font-size: 24px; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>📥 LM Video Downloader</h1>
                <div class="subtitle">Baixe vídeos do Instagram, TikTok, Facebook e YouTube</div>
                
                <div class="badges">
                    <div class="badge instagram">📸 Instagram</div>
                    <div class="badge tiktok">🎵 TikTok</div>
                    <div class="badge facebook">📘 Facebook</div>
                    <div class="badge youtube">▶️ YouTube</div>
                </div>
                
                <input type="text" id="url" placeholder="Cole a URL do vídeo...">
                
                <select id="qualidade">
                    <option value="720p" selected>720p (HD) - Recomendado</option>
                    <option value="1080p">1080p (Full HD)</option>
                    <option value="480p">480p (SD)</option>
                    <option value="360p">360p</option>
                    <option value="mp3">🎵 Apenas Áudio (MP3)</option>
                </select>
                
                <button id="btn" onclick="baixar()">📥 Baixar Vídeo</button>
                
                <div class="progresso-container" id="progressoContainer">
                    <div class="progresso-bar">
                        <div class="progresso-fill" id="progressoFill">0%</div>
                    </div>
                    <div class="status-text" id="statusText">Aguardando...</div>
                </div>
                
                <div id="resultado" class="resultado"></div>
                
                <div class="info">
                    <p>📌 <strong>Dicas:</strong> Para TikTok use links completos | YouTube pode demorar mais | Instagram exige cookies</p>
                </div>
            </div>
            
            <script>
                let progressoInterval = null;
                
                async function baixar() {
                    const url = document.getElementById('url').value;
                    const qualidade = document.getElementById('qualidade').value;
                    const resultadoDiv = document.getElementById('resultado');
                    const btn = document.getElementById('btn');
                    const progressoContainer = document.getElementById('progressoContainer');
                    const progressoFill = document.getElementById('progressoFill');
                    const statusText = document.getElementById('statusText');
                    
                    if (!url) {
                        resultadoDiv.style.display = 'block';
                        resultadoDiv.className = 'resultado erro';
                        resultadoDiv.innerHTML = '❌ Digite uma URL válida';
                        return;
                    }
                    
                    resultadoDiv.style.display = 'none';
                    progressoContainer.style.display = 'block';
                    progressoFill.style.width = '0%';
                    progressoFill.textContent = '0%';
                    statusText.textContent = '🔄 Processando...';
                    btn.disabled = true;
                    
                    let progresso = 0;
                    if (progressoInterval) clearInterval(progressoInterval);
                    progressoInterval = setInterval(() => {
                        if (progresso < 90) {
                            progresso += Math.random() * 15;
                            if (progresso > 90) progresso = 90;
                            progressoFill.style.width = progresso + '%';
                            progressoFill.textContent = Math.floor(progresso) + '%';
                        }
                    }, 800);
                    
                    try {
                        const response = await fetch('/api/download', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url, qualidade })
                        });
                        
                        clearInterval(progressoInterval);
                        const data = await response.json();
                        
                        if (data.success) {
                            progressoFill.style.width = '100%';
                            progressoFill.textContent = '100%';
                            statusText.textContent = '✅ Concluído!';
                            resultadoDiv.style.display = 'block';
                            resultadoDiv.className = 'resultado sucesso';
                            resultadoDiv.innerHTML = \`
                                ✅ <strong>Vídeo pronto!</strong><br>
                                📹 Título: \${data.title || 'Vídeo'}<br>
                                📊 Tamanho: \${data.size} MB<br>
                                <a href="\${data.downloadUrl}" class="download-link" download>🔽 BAIXAR VÍDEO</a>
                            \`;
                        } else {
                            resultadoDiv.style.display = 'block';
                            resultadoDiv.className = 'resultado erro';
                            resultadoDiv.innerHTML = \`❌ Erro: \${data.error}\`;
                        }
                        btn.disabled = false;
                        setTimeout(() => progressoContainer.style.display = 'none', 2000);
                    } catch (error) {
                        clearInterval(progressoInterval);
                        resultadoDiv.style.display = 'block';
                        resultadoDiv.className = 'resultado erro';
                        resultadoDiv.innerHTML = \`❌ Erro: \${error.message}\`;
                        btn.disabled = false;
                        progressoContainer.style.display = 'none';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// API de download otimizada
app.post('/api/download', async (req, res) => {
    const { url, qualidade } = req.body;
    
    console.log(`📥 [${new Date().toISOString()}] URL: ${url}`);
    console.log(`🎬 Qualidade: ${qualidade}`);
    
    if (!url) {
        return res.json({ success: false, error: 'URL não fornecida' });
    }
    
    // Detecta plataforma
    let plataforma = null;
    if (url.includes('instagram.com')) plataforma = 'instagram';
    else if (url.includes('tiktok.com') || url.includes('vt.tiktok.com')) plataforma = 'tiktok';
    else if (url.includes('facebook.com') || url.includes('fb.com')) plataforma = 'facebook';
    else if (url.includes('youtube.com') || url.includes('youtu.be')) plataforma = 'youtube';
    else return res.json({ success: false, error: 'Plataforma não suportada' });
    
    console.log(`🔍 Plataforma: ${plataforma}`);
    
    const timestamp = Date.now();
    const isAudio = qualidade === 'mp3';
    const extension = isAudio ? 'mp3' : 'mp4';
    const filename = `${plataforma}_${timestamp}.${extension}`;
    const filepath = path.join(DOWNLOADS_DIR, filename);
    
    try {
        let titulo = `${plataforma}_video`;
        try {
            const { stdout } = await execPromise(`yt-dlp --get-title "${url}"`);
            titulo = stdout.trim().substring(0, 40).replace(/[^\w\s-]/gi, '');
        } catch (e) {}
        
        const format = isAudio ? 'bestaudio' : (QUALITY_MAP[qualidade] || QUALITY_MAP['720p']);
        const command = buildOptimizedCommand(plataforma, url, format, filepath, qualidade);
        
        console.log(`🔄 Executando comando otimizado...`);
        await execPromise(command);
        
        if (!fs.existsSync(filepath)) throw new Error('Arquivo não foi criado');
        
        const stats = fs.statSync(filepath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        
        console.log(`✅ Download concluído: ${filename} (${sizeMB} MB)`);
        
        setTimeout(() => {
            if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        }, 60 * 60 * 1000);
        
        res.json({
            success: true,
            title: titulo,
            filename: filename,
            size: sizeMB,
            downloadUrl: `/downloads/${filename}`
        });
        
    } catch (error) {
        console.error(`❌ Erro: ${error.message}`);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        res.json({ success: false, error: error.message });
    }
});

app.use('/downloads', express.static(DOWNLOADS_DIR));

app.listen(PORT, () => {
    console.log('');
    console.log('══════════════════════════════════════════════');
    console.log('🚀 LM VIDEO DOWNLOADER OTIMIZADO!');
    console.log(`📱 Acesse: http://localhost:${PORT}`);
    console.log('📹 Suporta: Instagram | TikTok | Facebook | YouTube');
    console.log('⚡ Otimizado para Render (plano gratuito)');
    console.log('══════════════════════════════════════════════');
    console.log('');
});