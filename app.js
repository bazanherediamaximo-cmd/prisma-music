// Configuración
const API_URL = "https://inv.tux.rs/api/v1";
const CACHE_NAME = "prisma-media-v1";
let audioPlayer = new Audio();
let isPlaying = false;

// Registro del Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('Service Worker: Activo'));
}

// Elementos DOM
const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');
const resultsArea = document.getElementById('resultsArea');
const playBtn = document.getElementById('playBtn');
const progressBar = document.getElementById('progressBar');
const statusText = document.getElementById('statusText');

// Lógica de Búsqueda
searchBtn.addEventListener('click', async () => {
    const query = searchInput.value;
    if (!query) return;

    statusText.innerText = "Buscando...";
    resultsArea.innerHTML = '';
    
    try {
        const res = await fetch(`${API_URL}/search?q=${query}&type=video`);
        const data = await res.json();
        
        statusText.innerText = "Resultados listos";
        
        data.slice(0, 10).forEach(video => {
            const card = document.createElement('div');
            card.className = 'track-item';
            card.innerHTML = `
                <div style="overflow: hidden;">
                    <div style="font-weight:600; font-size:14px;">${video.title}</div>
                    <div style="font-size:12px; color:#888;">${video.author}</div>
                </div>
                <button class="download-btn" onclick="descargarTrack('${video.videoId}', '${video.title.replace(/'/g, "")}', '${video.author.replace(/'/g, "")}')">
                    ⬇
                </button>
            `;
            resultsArea.appendChild(card);
        });
    } catch (e) {
        statusText.innerText = "Error de conexión";
    }
});

// Función de Descarga (Cache)
window.descargarTrack = async (id, title, artist) => {
    statusText.innerText = "Descargando...";
    const streamUrl = `${API_URL}/latest_version?id=${id}&itag=140`; // Audio MP4
    
    try {
        const cache = await caches.open(CACHE_NAME);
        await cache.add(streamUrl); // Guarda en disco
        
        statusText.innerText = "Descarga completa";
        reproducir(streamUrl, title, artist);
    } catch (e) {
        statusText.innerText = "Error al descargar";
    }
};

// Reproductor
function reproducir(url, title, artist) {
    audioPlayer.src = url;
    audioPlayer.play();
    isPlaying = true;
    
    document.getElementById('title').innerText = title;
    document.getElementById('artist').innerText = artist;
    updatePlayIcon();
    
    // Ocultar resultados para modo focus
    resultsArea.innerHTML = ''; 
}

playBtn.addEventListener('click', () => {
    if (audioPlayer.src) {
        if (isPlaying) audioPlayer.pause();
        else audioPlayer.play();
        isPlaying = !isPlaying;
        updatePlayIcon();
    }
});

function updatePlayIcon() {
    const icon = document.getElementById('playIcon');
    if (isPlaying) {
        // Icono Pause
        icon.innerHTML = '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>';
    } else {
        // Icono Play
        icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    }
}

// Barra de progreso
audioPlayer.addEventListener('timeupdate', () => {
    const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.style.width = `${percent}%`;
    document.getElementById('currentTime').innerText = formatTime(audioPlayer.currentTime);
    document.getElementById('duration').innerText = formatTime(audioPlayer.duration || 0);
});

function formatTime(s) {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min}:${sec < 10 ? '0'+sec : sec}`;
}