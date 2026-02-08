// --- CONFIGURACIÓN "ROMPE-BLOQUEOS" ---
// Usamos este proxy que suele ser más rápido y permisivo para audio
const PROXY = "https://corsproxy.io/?";
// Instancia de Invidious (si falla, cambiamos esta url)
const API_URL = "https://invidious.drgns.space/api/v1"; 

// --- ESTADO ---
let playlist = [];
let currentTrackIndex = 0;
let audioPlayer = new Audio();
let isPlaying = false;

// DOM Elements
const views = document.querySelectorAll('.view');
const navBtns = document.querySelectorAll('.nav-btn');
const resultsArea = document.getElementById('resultsArea');
const playlistContainer = document.getElementById('playlistContainer');
const statusText = document.getElementById('statusText'); // Si tenés un label de estado

// --- 1. NAVEGACIÓN (ISLA) ---
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        views.forEach(v => v.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    });
});

// --- 2. BUSCADOR CON API (EL FIX) ---
const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');

searchBtn.addEventListener('click', async () => {
    const query = searchInput.value;
    if (!query) return;

    resultsArea.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Buscando...</div>';
    
    try {
        // Truco: Pasamos la URL de la API a través del Proxy
        const targetUrl = `${API_URL}/search?q=${encodeURIComponent(query)}&type=video`;
        const res = await fetch(PROXY + encodeURIComponent(targetUrl));
        const data = await res.json();
        
        resultsArea.innerHTML = ''; // Limpiar

        // Renderizar resultados
        data.slice(0, 15).forEach(video => {
            const div = document.createElement('div');
            div.className = 'queue-item'; // Reutilizamos estilo
            div.style.marginBottom = '10px';
            
            div.innerHTML = `
                <div style="flex:1;">
                    <div style="font-weight:600; color:#fff;">${video.title}</div>
                    <div style="font-size:12px; color:#aaa;">${video.author}</div>
                </div>
                <button class="download-btn" style="background:#fff; color:#000; border:none; padding:8px 15px; border-radius:20px; font-weight:bold; cursor:pointer;">
                    ⬇
                </button>
            `;
            
            // Lógica de Descarga al clickear
            const btn = div.querySelector('.download-btn');
            btn.onclick = () => descargarCancion(video.videoId, video.title, video.author, btn);
            
            resultsArea.appendChild(div);
        });
        
    } catch (e) {
        console.error(e);
        resultsArea.innerHTML = '<div style="color:red; text-align:center;">Error de API. Probá buscar de nuevo.</div>';
    }
});

// --- 3. FUNCIÓN DE DESCARGA REAL (CACHE) ---
async function descargarCancion(videoId, title, artist, btnElement) {
    btnElement.innerText = "⏳";
    btnElement.disabled = true;

    try {
        // 1. Buscar el link del audio
        const infoUrl = `${API_URL}/videos/${videoId}`;
        const resInfo = await fetch(PROXY + encodeURIComponent(infoUrl));
        const dataInfo = await resInfo.json();
        
        // 2. Filtrar solo audio (m4a es mejor calidad/peso)
        const format = dataInfo.formatStreams.find(f => f.itag === "140") || dataInfo.formatStreams[0];
        const audioUrl = format.url;

        // 3. DESCARGAR Y GUARDAR EN CACHE (Esto permite el offline)
        const cache = await caches.open('prisma-music-offline-v1');
        
        // Fetch real del archivo de audio a través del proxy
        const audioResponse = await fetch(PROXY + encodeURIComponent(audioUrl));
        const audioBlob = await audioResponse.blob();
        
        // Crear una respuesta sintética para guardar en caché
        const cacheKey = `/offline/${videoId}`;
        const responseToCache = new Response(audioBlob, {
            headers: { 'Content-Type': 'audio/mp4' }
        });
        
        await cache.put(cacheKey, responseToCache);

        // 4. Agregar a la Playlist automáticamente
        btnElement.innerText = "✅";
        addToPlaylist({
            title: title,
            artist: artist,
            url: cacheKey, // Usamos la clave del caché como URL
            isOffline: true
        });

    } catch (e) {
        console.error(e);
        btnElement.innerText = "❌";
        btnElement.disabled = false;
        alert("Falló la descarga. Probá otro tema.");
    }
}

// --- 4. REPRODUCTOR (SOPORTA OFFLINE) ---
function addToPlaylist(track) {
    playlist.push(track);
    renderPlaylist();
    // Si es la primera, cargarla
    if (playlist.length === 1) playTrack(0);
}

async function playTrack(index) {
    if (index < 0 || index >= playlist.length) return;
    currentTrackIndex = index;
    const track = playlist[index];
    
    // Actualizar UI
    document.getElementById('title').innerText = track.title;
    document.getElementById('artist').innerText = track.artist;
    
    try {
        let srcToPlay = track.url;

        // Si es offline, recuperar el Blob del caché
        if (track.isOffline) {
            const cache = await caches.open('prisma-music-offline-v1');
            const response = await cache.match(track.url);
            if (response) {
                const blob = await response.blob();
                srcToPlay = URL.createObjectURL(blob);
            }
        }
        
        audioPlayer.src = srcToPlay;
        audioPlayer.play().then(() => {
            isPlaying = true;
            updatePlayIcon();
        }).catch(e => console.log("Esperando interacción..."));

        renderPlaylist();
        
    } catch (e) {
        console.error("Error al reproducir", e);
    }
}

// Controles Básicos
const playBtn = document.getElementById('playBtn');
const progressBar = document.getElementById('progressBar');

playBtn.addEventListener('click', () => {
    if(playlist.length === 0) return;
    isPlaying ? audioPlayer.pause() : audioPlayer.play();
    isPlaying = !isPlaying;
    updatePlayIcon();
});

audioPlayer.addEventListener('ended', () => {
    if (currentTrackIndex < playlist.length - 1) playTrack(currentTrackIndex + 1);
});

audioPlayer.addEventListener('timeupdate', () => {
    if(audioPlayer.duration) {
        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressBar.style.width = `${percent}%`;
    }
});

function updatePlayIcon() {
    playBtn.innerHTML = isPlaying 
        ? '<svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>'
        : '<svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
}

function renderPlaylist() {
    playlistContainer.innerHTML = '';
    playlist.forEach((track, i) => {
        const div = document.createElement('div');
        div.className = `queue-item ${i === currentTrackIndex ? 'active' : ''}`;
        div.style.cssText = "padding:12px; border-bottom:1px solid rgba(255,255,255,0.1); cursor:pointer; display:flex; justify-content:space-between;";
        if(i === currentTrackIndex) div.style.background = "rgba(255,255,255,0.1)";
        
        div.innerHTML = `
            <div style="color:${i === currentTrackIndex ? '#fff' : '#aaa'}">${track.title}</div>
            ${track.isOffline ? '<span>💾</span>' : ''}
        `;
        div.onclick = () => playTrack(i);
        playlistContainer.appendChild(div);
    });
}

// Service Worker (Esencial para que funcione offline)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');

}


