// --- CONFIGURACIÓN PIPED (Más estable) ---
const API_URL = "https://pipedapi.kavin.rocks"; 

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

// --- 1. NAVEGACIÓN ---
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        views.forEach(v => v.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    });
});

// --- 2. BUSCADOR (MODO PIPED) ---
const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');

searchBtn.addEventListener('click', async () => {
    const query = searchInput.value;
    if (!query) return;

    resultsArea.innerHTML = '<div style="text-align:center; padding:20px; color:#aaa;">Buscando en Piped... 🎧</div>';
    
    try {
        // Piped no suele necesitar proxy cors para la búsqueda
        const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}&filter=music_songs`);
        const data = await res.json();
        
        resultsArea.innerHTML = ''; 

        if (!data.items || data.items.length === 0) {
            resultsArea.innerHTML = '<div style="padding:20px;">No encontré nada, bro.</div>';
            return;
        }

        data.items.slice(0, 15).forEach(video => {
            // Filtramos solo videos/canciones
            if(video.type !== 'stream') return;

            const div = document.createElement('div');
            div.className = 'queue-item'; 
            div.style.marginBottom = '10px';
            
            div.innerHTML = `
                <div style="flex:1;">
                    <div style="font-weight:600; color:#fff;">${video.title}</div>
                    <div style="font-size:12px; color:#aaa;">${video.uploaderName}</div>
                </div>
                <button class="download-btn" style="background:#fff; color:#000; border:none; padding:8px 15px; border-radius:20px; font-weight:bold; cursor:pointer;">
                    ⬇
                </button>
            `;
            
            const btn = div.querySelector('.download-btn');
            // La URL del video en Piped empieza con /watch?v=
            const videoId = video.url.split('v=')[1];
            btn.onclick = () => descargarCancion(videoId, video.title, video.uploaderName, btn);
            
            resultsArea.appendChild(div);
        });
        
    } catch (e) {
        console.error(e);
        resultsArea.innerHTML = '<div style="color:red; text-align:center;">Error conectando a Piped.</div>';
    }
});

// --- 3. DESCARGA (STREAM PIPED) ---
async function descargarCancion(videoId, title, artist, btnElement) {
    btnElement.innerText = "⏳";
    btnElement.disabled = true;

    try {
        const res = await fetch(`${API_URL}/streams/${videoId}`);
        const data = await res.json();
        
        // Buscamos el audio stream (m4a)
        const audioStream = data.audioStreams.find(s => s.format === 'M4A') || data.audioStreams[0];
        
        if (!audioStream) throw new Error("No hay audio");

        // Acá sí usamos el Cache API
        const cache = await caches.open('prisma-music-offline-v1');
        
        // Fetch del audio (Piped a veces requiere proxy, a veces no. Probamos directo primero)
        let audioBlob;
        try {
            const r = await fetch(audioStream.url);
            audioBlob = await r.blob();
        } catch (err) {
            // Si falla directo, usamos proxy
            const r = await fetch("https://corsproxy.io/?" + encodeURIComponent(audioStream.url));
            audioBlob = await r.blob();
        }

        const cacheKey = `/offline/${videoId}`;
        const responseToCache = new Response(audioBlob, {
            headers: { 'Content-Type': 'audio/mp4' }
        });
        
        await cache.put(cacheKey, responseToCache);

        btnElement.innerText = "✅";
        addToPlaylist({
            title: title,
            artist: artist,
            url: cacheKey,
            isOffline: true
        });

    } catch (e) {
        console.error(e);
        btnElement.innerText = "❌";
        btnElement.disabled = false;
        alert("No se pudo bajar. Google está terrible hoy.");
    }
}

// --- 4. REPRODUCTOR ---
// (Misma lógica que antes, no hace falta cambiar mucho acá)
function addToPlaylist(track) {
    playlist.push(track);
    renderPlaylist();
    if (playlist.length === 1) playTrack(0);
}

async function playTrack(index) {
    if (index < 0 || index >= playlist.length) return;
    currentTrackIndex = index;
    const track = playlist[index];
    
    document.getElementById('title').innerText = track.title;
    document.getElementById('artist').innerText = track.artist;
    
    let srcToPlay = track.url;
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
    }).catch(e => console.log("User interaction needed"));
    
    renderPlaylist();
}

// Controles Básicos
const playBtn = document.getElementById('playBtn');
const progressBar = document.getElementById('progressBar');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');

playBtn.addEventListener('click', () => { isPlaying ? audioPlayer.pause() : audioPlayer.play(); isPlaying = !isPlaying; updatePlayIcon(); });
nextBtn.addEventListener('click', () => currentTrackIndex < playlist.length - 1 ? playTrack(currentTrackIndex + 1) : playTrack(0));
prevBtn.addEventListener('click', () => currentTrackIndex > 0 ? playTrack(currentTrackIndex - 1) : null);
audioPlayer.addEventListener('ended', () => nextBtn.click());
audioPlayer.addEventListener('timeupdate', () => { if(audioPlayer.duration) progressBar.style.width = (audioPlayer.currentTime/audioPlayer.duration)*100 + '%'; });

function updatePlayIcon() {
    playBtn.innerHTML = isPlaying 
        ? '<svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>'
        : '<svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
}

function renderPlaylist() {
    playlistContainer.innerHTML = '';
    playlist.forEach((track, i) => {
        const div = document.createElement('div');
        div.className = `queue-item`;
        div.style.cssText = `padding:12px; border-bottom:1px solid rgba(255,255,255,0.1); cursor:pointer; display:flex; justify-content:space-between; ${i === currentTrackIndex ? 'background:rgba(255,255,255,0.1);' : ''}`;
        div.innerHTML = `<div style="color:${i === currentTrackIndex ? '#fff' : '#aaa'}">${track.title}</div>${track.isOffline ? '<span>✅</span>' : ''}`;
        div.onclick = () => playTrack(i);
        playlistContainer.appendChild(div);
    });
}

// Service Worker + Carga Manual
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');

document.getElementById('multiFile').addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(file => {
        const url = URL.createObjectURL(file);
        playlist.push({ title: file.name.replace(/\.[^/.]+$/, ""), artist: "Local", url: url, isOffline: false });
    });
    renderPlaylist();
    if(playlist.length === e.target.files.length) playTrack(0);
});
