const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
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
    fs.mkdirSync(DOWNLOADS_DIR);
}

// Mapeamento de qualidade para formato yt-dlp
const QUALITY_MAP = {
    '4K': 'bestvideo[height<=2160]+bestaudio/best[height<=2160]',
    '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    '720p': 'best[height<=720]',
    '480p': 'best[height<=480]',
    '360p': 'best[height<=360]',
    'Apenas Áudio': 'bestaudio'
};

// Interface HTML
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>LM Video Downloader</title>
            <meta charset="UTF-8">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    padding: 20px;
                }
                .container {
                    max-width: 650px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 20px;
                    padding: 40px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                h1 {
                    color: #333;
                    text-align: center;
                    margin-bottom: 10px;
                    font-size: 28px;
                }
                .subtitle {
                    text-align: center;
                    color: #666;
                    margin-bottom: 30px;
                    font-size: 14px;
                }
                input {
                    width: 100%;
                    padding: 15px;
                    font-size: 16px;
                    border: 2px solid #ddd;
                    border-radius: 10px;
                    margin-bottom: 15px;
                    box-sizing: border-box;
                    transition: border-color 0.3s;
                }
                input:focus {
                    outline: none;
                    border-color: #667eea;
                }
                .qualidade-group {
                    margin-bottom: 15px;
                }
                .qualidade-group label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: bold;
                    color: #333;
                }
                select {
                    width: 100%;
                    padding: 12px;
                    font-size: 14px;
                    border: 2px solid #ddd;
                    border-radius: 10px;
                    background: white;
                    cursor: pointer;
                }
                button {
                    width: 100%;
                    padding: 15px;
                    background: linear-gradient(135deg, #ff5722 0%, #e64a19 100%);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                button:hover:not(:disabled) {
                    transform: translateY(-2px);
                }
                button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .resultado {
                    margin-top: 20px;
                    padding: 20px;
                    border-radius: 10px;
                    display: none;
                }
                .sucesso {
                    background: #d4edda;
                    border: 1px solid #c3e6cb;
                    color: #155724;
                }
                .erro {
                    background: #f8d7da;
                    border: 1px solid #f5c6cb;
                    color: #721c24;
                }
                .carregando {
                    background: #e2e3e5;
                    border: 1px solid #d6d8db;
                    color: #383d41;
                }
                .info {
                    margin-top: 20px;
                    padding: 15px;
                    background: #e9ecef;
                    border-radius: 10px;
                    font-size: 12px;
                    color: #666;
                }
                .info h4 {
                    margin-bottom: 8px;
                    color: #333;
                }
                .info ul {
                    margin-left: 20px;
                }
                .btn-download {
                    display: inline-block;
                    background: #28a745;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 5px;
                    text-decoration: none;
                    font-weight: bold;
                    margin-top: 10px;
                }
                .btn-download:hover {
                    background: #218838;
                }
                .progresso-container {
                    margin-top: 20px;
                    display: none;
                }
                .progresso-label {
                    font-size: 12px;
                    color: #666;
                    margin-bottom: 5px;
                }
                .progresso-bar {
                    width: 100%;
                    height: 25px;
                    background: #e0e0e0;
                    border-radius: 12px;
                    overflow: hidden;
                    position: relative;
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
                .qualidade-info {
                    font-size: 11px;
                    color: #888;
                    margin-top: 5px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>📥 LM Video Downloader</h1>
                <div class="subtitle">YouTube | Instagram | TikTok | Facebook</div>
                
                <input type="text" id="url" placeholder="Cole a URL do vídeo aqui...">
                
                <div class="qualidade-group">
                    <label>🎬 Qualidade do vídeo:</label>
                    <select id="qualidade">
                        <option value="1080p">1080p (Full HD) - Recomendado</option>
                        <option value="720p">720p (HD) - Mais rápido</option>
                        <option value="480p">480p (SD)</option>
                        <option value="360p">360p</option>
                        <option value="4K">4K (Ultra HD) - Demora mais</option>
                        <option value="Apenas Áudio">🎵 Apenas Áudio (MP3)</option>
                    </select>
                    <div class="qualidade-info">⚠️ Qualidades mais altas demoram mais para processar</div>
                </div>
                
                <button id="btnBaixar" onclick="baixarVideo()">📥 Baixar Vídeo</button>
                
                <div class="progresso-container" id="progressoContainer">
                    <div class="progresso-label">Progresso do download:</div>
                    <div class="progresso-bar">
                        <div class="progresso-fill" id="progressoFill">0%</div>
                    </div>
                    <div class="status-text" id="statusText">Aguardando início...</div>
                </div>
                
                <div id="resultado" class="resultado"></div>
                
                <div class="info">
                    <h4>📌 Dicas:</h4>
                    <ul>
                        <li><strong>YouTube:</strong> Qualidades altas (1080p/4K) demoram mais pois combinam vídeo+áudio</li>
                        <li><strong>Instagram/TikTok/Facebook:</strong> Funcionam com todas as qualidades</li>
                        <li><strong>Apenas Áudio:</strong> Baixa o áudio em MP3 (útil para músicas)</li>
                    </ul>
                </div>
            </div>

            <script>
                let progressoInterval = null;
                
                async function baixarVideo() {
                    const url = document.getElementById('url').value;
                    const qualidade = document.getElementById('qualidade').value;
                    const resultadoDiv = document.getElementById('resultado');
                    const btn = document.getElementById('btnBaixar');
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
                    statusText.textContent = '🔄 Iniciando processamento...';
                    btn.disabled = true;
                    
                    // Simula progresso inicial
                    let progresso = 0;
                    if (progressoInterval) clearInterval(progressoInterval);
                    progressoInterval = setInterval(() => {
                        if (progresso < 90) {
                            progresso += Math.random() * 10;
                            if (progresso > 90) progresso = 90;
                            progressoFill.style.width = progresso + '%';
                            progressoFill.textContent = Math.floor(progresso) + '%';
                        }
                    }, 1000);
                    
                    try {
                        const response = await fetch('/api/download', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url: url, qualidade: qualidade })
                        });
                        
                        clearInterval(progressoInterval);
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            progressoFill.style.width = '100%';
                            progressoFill.textContent = '100%';
                            statusText.textContent = '✅ Download concluído!';
                            resultadoDiv.style.display = 'block';
                            resultadoDiv.className = 'resultado sucesso';
                            resultadoDiv.innerHTML = \`
                                ✅ <strong>Download concluído!</strong><br>
                                📹 Título: \${data.title}<br>
                                🎬 Qualidade: \${data.qualidade || qualidade}<br>
                                📊 Tamanho: \${data.size} MB<br>
                                <br>
                                <a href="/downloads/\${data.filename}" class="btn-download">🔽 CLICAR PARA BAIXAR</a>
                                <br><br>
                                <small>O arquivo ficará disponível por 1 hora</small>
                            \`;
                        } else {
                            resultadoDiv.style.display = 'block';
                            resultadoDiv.className = 'resultado erro';
                            resultadoDiv.innerHTML = \`❌ Erro: \${data.error}\`;
                            statusText.textContent = '❌ Falha no download';
                        }
                        btn.disabled = false;
                        
                        setTimeout(() => {
                            progressoContainer.style.display = 'none';
                            progressoFill.style.width = '0%';
                        }, 3000);
                        
                    } catch (error) {
                        clearInterval(progressoInterval);
                        resultadoDiv.style.display = 'block';
                        resultadoDiv.className = 'resultado erro';
                        resultadoDiv.innerHTML = \`❌ Erro: \${error.message}\`;
                        btn.disabled = false;
                        statusText.textContent = '❌ Erro na conexão';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// Rota: Baixar vídeo com qualidade selecionada
app.post('/api/download', async (req, res) => {
    const { url, qualidade } = req.body;
    
    console.log('📥 URL recebida:', url);
    console.log('🎬 Qualidade selecionada:', qualidade);
    
    if (!url) {
        return res.json({ success: false, error: 'URL não fornecida' });
    }
    
    const timestamp = Date.now();
    const isAudioOnly = qualidade === 'Apenas Áudio';
    const extension = isAudioOnly ? 'mp3' : 'mp4';
    const filename = `video_${timestamp}.${extension}`;
    const filepath = path.join(DOWNLOADS_DIR, filename);
    
    try {
        // Obtém o título
        let titulo = 'video';
        try {
            const { stdout } = await execPromise(`yt-dlp --get-title "${url}"`);
            titulo = stdout.trim().substring(0, 50);
            // Remove caracteres inválidos para nome de arquivo
            titulo = titulo.replace(/[^\w\s-]/gi, '').substring(0, 40);
        } catch (e) {}
        
        // Seleciona o formato baseado na qualidade
        let format = QUALITY_MAP[qualidade] || QUALITY_MAP['720p'];
        
        // Para áudio apenas
        if (isAudioOnly) {
            console.log('🎵 Baixando apenas áudio...');
            const command = `yt-dlp -f "bestaudio" --extract-audio --audio-format mp3 --audio-quality 0 -o "${filepath}" "${url}"`;
            await execPromise(command);
        } else {
            console.log(`🔄 Baixando vídeo na qualidade ${qualidade}...`);
            
            // Tenta primeiro com o formato específico
            try {
                const command = `yt-dlp -f "${format}" --merge-output-format mp4 -o "${filepath}" "${url}"`;
                await execPromise(command);
            } catch (firstError) {
                console.log('Tentando formato alternativo...');
                // Fallback: melhor formato disponível
                const fallbackCommand = `yt-dlp -f "best" -o "${filepath}" "${url}"`;
                await execPromise(fallbackCommand);
            }
        }
        
        if (!fs.existsSync(filepath)) {
            throw new Error('Arquivo não foi criado');
        }
        
        const stats = fs.statSync(filepath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        
        console.log(`✅ Download concluído: ${filename} (${sizeMB} MB)`);
        
        // Agenda exclusão após 1 hora
        setTimeout(() => {
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
                console.log(`🗑️ Arquivo deletado: ${filename}`);
            }
        }, 60 * 60 * 1000);
        
        res.json({
            success: true,
            title: titulo,
            filename: filename,
            size: sizeMB,
            qualidade: qualidade
        });
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
        res.json({ success: false, error: error.message });
    }
});

// Servir arquivos estáticos
app.use('/downloads', express.static(DOWNLOADS_DIR));

app.listen(PORT, () => {
    console.log('');
    console.log('══════════════════════════════════════════════');
    console.log('🚀 LM VIDEO DOWNLOADER RODANDO!');
    console.log(`📱 Acesse: http://localhost:${PORT}`);
    console.log('📹 YouTube | Instagram | TikTok | Facebook');
    console.log('🎬 Suporte a múltiplas qualidades (4K a 360p)');
    console.log('🎵 Modo apenas áudio (MP3)');
    console.log('══════════════════════════════════════════════');
    console.log('');
});