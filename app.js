/**
 * BANS PLAYER - LOGICA APPLICATIVA
 * Riproduttore musicale Spotify-style PWA con caricamento da Google Drive.
 */

// ============================================================================
// 1. CONFIGURAZIONE PLAYLIST LOCALE
// ============================================================================
const PLAYLIST_JSON_URL = './playlist.json';
// ============================================================================

// RIMOZIONE DI EMERGENZA DEL SERVICE WORKER CON AUTO-RICARICA PER APPLICARE LE MODIFICHE
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    if (registrations.length > 0) {
      let unregisteredCount = 0;
      for (let registration of registrations) {
        registration.unregister().then(() => {
          unregisteredCount++;
          if (unregisteredCount === registrations.length) {
            console.log('Tutti i Service Worker rimossi. Ricarico la pagina...');
            window.location.reload();
          }
        });
      }
    }
  });
}

// STATO DELLO RIPRODUTTORE
const state = {
  tracks: [],              // Tutti i brani caricati
  filteredTracks: [],      // Brani filtrati dalla ricerca
  queue: [],               // Coda corrente (influenzata da shuffle)
  currentTrackIndex: -1,   // Indice brano in riproduzione nella coda
  isPlaying: false,        // Stato riproduzione
  isShuffle: false,        // Riproduzione casuale
  repeatState: 0,          // 0 = no repeat, 1 = repeat playlist, 2 = repeat track
  crossfadeEnabled: false, // Dissolvenza incrociata attiva/disattiva
  crossfadeDuration: 5,    // Durata dissolvenza in secondi
  isCrossfading: false,    // Previene conflitti durante la transizione
  audioUnlocked: false,    // Sblocco audio per dispositivi mobile
  playlistName: 'Grest PSG Playlist',
};

// DOPPIO PLAYER AUDIO PER IL CROSSFADE
const players = {
  playerA: null,
  playerB: null,
  active: null,
  inactive: null
};

// RIFERIMENTI AGLI ELEMENTI DEL DOM
let DOM = {};

// INIZIALIZZAZIONE AL CARICAMENTO DELLA PAGINA
window.addEventListener('DOMContentLoaded', () => {
  initDOM();
  setupAudioPlayers();
  setupEventListeners();
  loadSettings();
  
  // Avvio automatico dell'applicazione
  initApp();
});

// MAPPA GLI ELEMENTI DEL DOM
function initDOM() {
  DOM = {
    // Schermate e stati
    loaderView: document.getElementById('loader-view'),
    errorView: document.getElementById('error-view'),
    playlistView: document.getElementById('playlist-view'),
    errorMessage: document.getElementById('error-message'),
    btnRetry: document.getElementById('btn-retry'),
    btnInstallPwa: document.getElementById('btn-install-pwa'),
    
    // Contenuto Playlist
    playlistTitle: document.getElementById('playlist-title'),
    playlistCount: document.getElementById('playlist-count'),
    trackList: document.getElementById('track-list'),
    searchInput: document.getElementById('search-input'),
    crossfadeToggle: document.getElementById('crossfade-toggle'),
    
    // Mini Player
    miniPlayer: document.getElementById('mini-player'),
    miniProgressBar: document.getElementById('mini-progress-bar'),
    miniPlayerTrigger: document.getElementById('mini-player-trigger'),
    miniCover: document.getElementById('mini-cover'),
    miniTitle: document.getElementById('mini-title'),
    miniArtist: document.getElementById('mini-artist'),
    btnMiniPlayPause: document.getElementById('btn-mini-play-pause'),
    btnMiniNext: document.getElementById('btn-mini-next'),
    svgMiniPlay: document.getElementById('svg-mini-play'),
    svgMiniPause: document.getElementById('svg-mini-pause'),
    
    // Player Drawer
    playerDrawer: document.getElementById('player-drawer'),
    drawerOverlay: document.getElementById('drawer-overlay'),
    btnDrawerClose: document.getElementById('btn-drawer-close'),
    drawerPlaylistName: document.getElementById('drawer-playlist-name'),
    drawerCover: document.getElementById('drawer-cover'),
    drawerTrackTitle: document.getElementById('drawer-track-title'),
    drawerTrackSubtitle: document.getElementById('drawer-track-subtitle'),
    drawerSeekbar: document.getElementById('drawer-seekbar'),
    timeCurrent: document.getElementById('time-current'),
    timeDuration: document.getElementById('time-duration'),
    
    // Controlli Drawer
    btnShuffle: document.getElementById('btn-shuffle'),
    btnPrev: document.getElementById('btn-prev'),
    btnPlayPause: document.getElementById('btn-play-pause'),
    btnNext: document.getElementById('btn-next'),
    btnRepeat: document.getElementById('btn-repeat'),
    svgDrawerPlay: document.getElementById('svg-drawer-play'),
    svgDrawerPause: document.getElementById('svg-drawer-pause')
  };
}

// INIZIALIZZA E SBLOCCA I TAG AUDIO
function setupAudioPlayers() {
  players.playerA = document.getElementById('audio-1');
  players.playerB = document.getElementById('audio-2');
  
  players.active = players.playerA;
  players.inactive = players.playerB;
}

// CARICA LE IMPOSTAZIONI SALVATE
function loadSettings() {
  const savedCrossfade = localStorage.getItem('crossfade_enabled');
  if (savedCrossfade !== null) {
    state.crossfadeEnabled = savedCrossfade === 'true';
    DOM.crossfadeToggle.checked = state.crossfadeEnabled;
  }
}

// REGISTRA I GESTORI EVENTI
function setupEventListeners() {
  // Sblocco audio all'interazione (richiesto da mobile browser)
  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('touchstart', unlockAudio, { once: true });

  // Ricerca live
  DOM.searchInput.addEventListener('input', handleSearch);
  
  // Toggle Crossfade
  DOM.crossfadeToggle.addEventListener('change', (e) => {
    state.crossfadeEnabled = e.target.checked;
    localStorage.setItem('crossfade_enabled', state.crossfadeEnabled);
  });

  // Riprova in caso di errore
  DOM.btnRetry.addEventListener('click', initApp);

  // Espansione e chiusura del player
  DOM.miniPlayerTrigger.addEventListener('click', openDrawer);
  DOM.btnDrawerClose.addEventListener('click', closeDrawer);
  DOM.drawerOverlay.addEventListener('click', closeDrawer);

  // Controlli di riproduzione Mini Player
  DOM.btnMiniPlayPause.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlayPause();
  });
  DOM.btnMiniNext.addEventListener('click', (e) => {
    e.stopPropagation();
    playNext(true);
  });

  // Controlli di riproduzione Drawer
  DOM.btnPlayPause.addEventListener('click', togglePlayPause);
  DOM.btnNext.addEventListener('click', () => playNext(true));
  DOM.btnPrev.addEventListener('click', playPrevious);
  DOM.btnShuffle.addEventListener('click', toggleShuffle);
  DOM.btnRepeat.addEventListener('click', toggleRepeat);

  // Gestione avanzamento seekbar
  DOM.drawerSeekbar.addEventListener('input', handleSeekbarInput);
  DOM.drawerSeekbar.addEventListener('change', handleSeekbarChange);

  // Gestione PWA Install
  setupPwaInstall();

  // Monitoraggio eventi audio su entrambi i tag
  setupPlayerEvents(players.playerA);
  setupPlayerEvents(players.playerB);
}

// GESTIONE DEGLI EVENTI AUDIO
function setupPlayerEvents(player) {
  player.addEventListener('timeupdate', () => {
    if (player === players.active) {
      updateProgress();
      checkCrossfadeTrigger();
    }
  });

  player.addEventListener('ended', () => {
    if (player === players.active) {
      console.log('Brano concluso sul player attivo.');
      if (!state.isCrossfading) {
        handleTrackEnded();
      }
    }
  });

  player.addEventListener('error', (e) => {
    console.error('Errore di caricamento o riproduzione audio:', e);
    if (player === players.active && state.isPlaying) {
      console.log('Sorgente non riproducibile. Salto al brano successivo.');
      setTimeout(() => playNext(false), 2000);
    }
  });
}

// SBLOCCA L'AUDIO PER DISPOSITIVI MOBILE TRAMITE GESTO UTENTE
function unlockAudio() {
  if (state.audioUnlocked) return;
  console.log('Sblocco audio tag per iOS/Android...');
  try {
    players.playerA.play().then(() => players.playerA.pause()).catch(() => {});
    players.playerB.play().then(() => players.playerB.pause()).catch(() => {});
    state.audioUnlocked = true;
  } catch (e) {
    console.error('Errore durante lo sblocco dell\'audio:', e);
  }
}

// AVVIA E CARICA L'APPLICAZIONE
async function initApp() {
  showView('loaderView');

  try {
    // Carica la playlist locale
    await fetchPlaylist();
    
    // Mostra la playlist
    renderPlaylist();
    showView('playlistView');
  } catch (err) {
    console.error('Errore durante l\'inizializzazione dell\'app:', err);
    DOM.errorMessage.textContent = err.message || 'Impossibile caricare il file playlist.json. Generalo prima di avviare.';
    showView('errorView');
  }
}

// RECUPERA LE TRACCE DAL FILE PLAYLIST.JSON
async function fetchPlaylist() {
  const res = await fetch(PLAYLIST_JSON_URL);
  if (!res.ok) {
    throw new Error('Impossibile caricare la playlist. Assicurati che playlist.json sia presente nella root del progetto.');
  }
  
  const data = await res.json();
  if (!data || data.length === 0) {
    throw new Error('Nessun brano trovato nel file playlist.json.');
  }

  // I dati sono già stati ordinati e puliti dallo script di generazione
  state.tracks = data;
  state.filteredTracks = [...state.tracks];
  state.queue = [...state.tracks];
  
  // Impostiamo il nome fisso della playlist
  state.playlistName = 'Grest PSG Playlist';
  DOM.playlistTitle.textContent = state.playlistName;
  DOM.drawerPlaylistName.textContent = state.playlistName;
}

// PULISCE IL NOME DEL FILE RIMUOVENDO L'ESTENSIONE
function cleanSongName(name) {
  if (!name) return 'Traccia sconosciuta';
  return name.replace(/\.(mp3|m4a|wav|ogg|mpeg)$/i, '');
}

// MOSTRA UNA SPECIFICA VISTA NASCONDENDO LE ALTRE
function showView(viewKey) {
  const views = ['loaderView', 'errorView', 'playlistView'];
  views.forEach(k => {
    if (k === viewKey) {
      if (DOM[k]) DOM[k].classList.remove('hidden');
    } else {
      if (DOM[k]) DOM[k].classList.add('hidden');
    }
  });
}

// GENERA COLORI ARMONIOSI IN BASE AL TITOLO DEL BRANO (PER COPERTINA DINAMICA)
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

function getGradient(title) {
  const hash = hashCode(title || 'Bans');
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 140) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 75%, 60%) 0%, hsl(${h2}, 85%, 45%) 100%)`;
}

// DISEGNA LA PLAYLIST NEL DOM
function renderPlaylist() {
  DOM.trackList.innerHTML = '';
  DOM.playlistCount.textContent = `${state.filteredTracks.length} brani disponibili`;

  if (state.filteredTracks.length === 0) {
    DOM.trackList.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted); font-weight: 500;">
        Nessun brano corrisponde alla ricerca.
      </div>
    `;
    return;
  }

  state.filteredTracks.forEach((track, index) => {
    const trackItem = document.createElement('div');
    trackItem.className = 'track-item';
    
    // Controlla se è in riproduzione
    const isCurrent = isCurrentTrack(track.id);
    if (isCurrent) {
      trackItem.classList.add('playing');
    }

    const coverGradient = getGradient(track.name);
    const initialLetter = track.name.trim().charAt(0).toUpperCase();

    trackItem.innerHTML = `
      <div class="track-index">${index + 1}</div>
      <div class="playing-wave">
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
      </div>
      <div class="track-cover" style="background: ${coverGradient}">${initialLetter}</div>
      <div class="track-details">
        <span class="track-title">${track.name}</span>
      </div>
    `;

    trackItem.addEventListener('click', () => {
      // Trova l'indice della traccia nella coda di riproduzione corrente
      const queueIndex = state.queue.findIndex(t => t.id === track.id);
      if (queueIndex !== -1) {
        playTrackAtIndex(queueIndex);
      }
    });

    DOM.trackList.appendChild(trackItem);
  });
}

// VERIFICA SE UN FILE ID CORRISPONDE AL BRANO IN RIPRODUZIONE
function isCurrentTrack(trackId) {
  if (!state.isPlaying || state.currentTrackIndex === -1) return false;
  const currentTrack = state.queue[state.currentTrackIndex];
  return currentTrack && currentTrack.id === trackId;
}

// FUNZIONE DI RICERCA LIVE
function handleSearch() {
  const query = DOM.searchInput.value.trim().toLowerCase();
  
  if (!query) {
    state.filteredTracks = [...state.tracks];
  } else {
    state.filteredTracks = state.tracks.filter(track => 
      track.name.toLowerCase().includes(query)
    );
  }
  
  renderPlaylist();
}

// URL DI STREAMING LOCALE
function getStreamUrl(track) {
  // Aggiungiamo un parametro univoco per bypassare eventuali versioni corrotte bloccate nella HTTP cache del browser
  return `${track.file}?cb=${Date.now()}`;
}

// RIPRODUCE IL BRANO ALL'INDICE SPECIFICATO DELLA CODA
function playTrackAtIndex(index) {
  if (state.queue.length === 0 || index < 0 || index >= state.queue.length) return;
  
  state.currentTrackIndex = index;
  const track = state.queue[index];
  const streamUrl = getStreamUrl(track);

  // Termina eventuali crossfade attivi
  state.isCrossfading = false;
  
  // Assegna sorgente al player attivo e resetta volume a 1
  players.active.src = streamUrl;
  players.active.volume = 1;
  
  state.isPlaying = true;
  updateUI();
  updateMediaSession();

  players.active.play()
    .then(() => {
      console.log(`Ora in riproduzione: ${track.name}`);
      updateUI();
    })
    .catch(err => {
      console.error('Errore riproduzione iniziale:', err);
    });

  // Aggiorna lo stato visivo della lista
  renderPlaylist();
}

// GESTISCE LA FINE NATURALE DEL BRANO
function handleTrackEnded() {
  if (state.repeatState === 2) {
    // Ripeti singolo brano
    players.active.currentTime = 0;
    players.active.play().catch(e => console.error(e));
  } else {
    // Prossimo brano
    playNext(false);
  }
}

// PASSA AL BRANO SUCCESSIVO (CON SUPPORT CROSSFADE)
function playNext(manualSkip = false) {
  if (state.queue.length === 0) return;

  const nextIndex = getNextTrackIndex();
  if (nextIndex === -1) {
    stopPlayback();
    return;
  }

  // Esegue crossfade solo se abilitato, se la riproduzione è attiva e se non è uno skip manuale rapido
  if (state.crossfadeEnabled && state.isPlaying && !manualSkip) {
    const nextTrack = state.queue[nextIndex];
    performCrossfade(nextTrack, nextIndex);
  } else {
    playTrackAtIndex(nextIndex);
  }
}

// CALCOLA L'INDICE DEL BRANO SUCCESSIVO IN BASE ALLE IMPOSTAZIONI DI RIPETIZIONE
function getNextTrackIndex() {
  let nextIndex = state.currentTrackIndex + 1;
  if (nextIndex >= state.queue.length) {
    if (state.repeatState === 1) {
      return 0; // Ricomincia la playlist
    }
    return -1; // Ferma la riproduzione
  }
  return nextIndex;
}

// PASSA AL BRANO PRECEDENTE
function playPrevious() {
  if (state.queue.length === 0 || state.currentTrackIndex === -1) return;

  // Se il brano corrente è iniziato da più di 3 secondi, riavvia la traccia
  if (players.active.currentTime > 3) {
    players.active.currentTime = 0;
    updateProgress();
    return;
  }

  let prevIndex = state.currentTrackIndex - 1;
  if (prevIndex < 0) {
    if (state.repeatState === 1) {
      prevIndex = state.queue.length - 1; // Vai alla fine
    } else {
      players.active.currentTime = 0; // Riavvia primo brano
      updateProgress();
      return;
    }
  }

  playTrackAtIndex(prevIndex);
}

// CONTROLLO TRIGGER CROSSFADE AUTOMATICO
function checkCrossfadeTrigger() {
  if (!state.crossfadeEnabled || state.isCrossfading || state.queue.length <= 1) return;

  const duration = players.active.duration;
  const currentTime = players.active.currentTime;

  if (!duration || isNaN(duration)) return;

  const triggerTime = duration - state.crossfadeDuration;

  // Se siamo negli ultimi secondi, avvia il crossfade verso il brano successivo
  if (currentTime >= triggerTime && currentTime < duration - 0.2) {
    const nextIndex = getNextTrackIndex();
    if (nextIndex !== -1) {
      const nextTrack = state.queue[nextIndex];
      performCrossfade(nextTrack, nextIndex);
    }
  }
}

// ESEGUE LA TRANSIZIONE DI DISSOLVENZA INCROCIATA
function performCrossfade(nextTrack, nextIndex) {
  if (state.isCrossfading) return;
  state.isCrossfading = true;

  console.log(`Crossfade avviato verso: ${nextTrack.name}`);

  const activePlayer = players.active;
  const inactivePlayer = players.inactive;

  // Configura il player inattivo
  inactivePlayer.src = getStreamUrl(nextTrack);
  inactivePlayer.volume = 0;

  state.currentTrackIndex = nextIndex;
  updateMediaSession();

  inactivePlayer.play()
    .then(() => {
      const durationMs = state.crossfadeDuration * 1000;
      const stepTime = 50; // Aggiorna volume ogni 50ms
      const totalSteps = durationMs / stepTime;
      let step = 0;

      const fadeInterval = setInterval(() => {
        if (!state.isCrossfading) {
          clearInterval(fadeInterval);
          return;
        }

        step++;
        const progress = Math.min(1, step / totalSteps);

        // Curva equal power crossfade (trigonometrica)
        const volActive = Math.cos(progress * Math.PI / 2);
        const volInactive = Math.sin(progress * Math.PI / 2);

        activePlayer.volume = Math.max(0, Math.min(1, volActive));
        inactivePlayer.volume = Math.max(0, Math.min(1, volInactive));

        if (step >= totalSteps || activePlayer.paused) {
          clearInterval(fadeInterval);
          completeCrossfade();
        }
      }, stepTime);

      function completeCrossfade() {
        activePlayer.pause();
        activePlayer.volume = 1;

        // Scambia i ruoli dei player
        players.active = inactivePlayer;
        players.inactive = activePlayer;

        state.isCrossfading = false;
        
        updateUI();
        renderPlaylist();
        console.log('Crossfade completato con successo.');
      }
    })
    .catch(err => {
      console.error('Errore nell\'avvio del player inattivo per crossfade:', err);
      state.isCrossfading = false;
      
      // Fallback: continua a suonare il brano attivo, poi salta normalmente alla fine
      activePlayer.volume = 1;
      players.active = activePlayer;
    });
}

// ARRESTA LA RIPRODUZIONE AUDIO E RESETTA GLI STATI
function stopPlayback() {
  state.isPlaying = false;
  state.isCrossfading = false;
  
  players.playerA.pause();
  players.playerA.src = '';
  players.playerB.pause();
  players.playerB.src = '';

  updateUI();
  renderPlaylist();

  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'none';
  }
}

// ALTERNA PLAY E PAUSA
function togglePlayPause() {
  if (state.queue.length === 0) return;

  if (state.currentTrackIndex === -1) {
    playTrackAtIndex(0);
    return;
  }

  if (state.isPlaying) {
    players.active.pause();
    state.isPlaying = false;
  } else {
    players.active.play().catch(e => console.error('Impossibile avviare riproduzione:', e));
    state.isPlaying = true;
  }

  updateUI();
  
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
  }
}

// SHUFFLE (RIPRODUZIONE CASUALE)
function toggleShuffle() {
  state.isShuffle = !state.isShuffle;
  DOM.btnShuffle.classList.toggle('active', state.isShuffle);

  if (state.tracks.length === 0) return;

  const currentTrack = state.queue[state.currentTrackIndex];

  if (state.isShuffle) {
    // Mescola la lista dei brani, ma mantiene la traccia corrente in cima per evitare interruzioni
    const remaining = state.tracks.filter(t => t.id !== currentTrack.id);
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    state.queue = [currentTrack, ...remaining];
    state.currentTrackIndex = 0;
  } else {
    // Ripristina l'ordine alfabetico originale
    state.queue = [...state.tracks];
    state.currentTrackIndex = state.queue.findIndex(t => t.id === currentTrack.id);
  }
}

// REPEAT CODA DI RIPRODUZIONE
function toggleRepeat() {
  state.repeatState = (state.repeatState + 1) % 3; // 0, 1, 2
  
  DOM.btnRepeat.classList.remove('active');
  DOM.btnRepeat.querySelector('span')?.remove();

  if (state.repeatState === 1) {
    DOM.btnRepeat.classList.add('active'); // Ripeti playlist
  } else if (state.repeatState === 2) {
    DOM.btnRepeat.classList.add('active'); // Ripeti singolo brano
    
    // Aggiunge un badge numerico "1" sul pulsante
    const badge = document.createElement('span');
    badge.textContent = '1';
    badge.style.position = 'absolute';
    badge.style.fontSize = '9px';
    badge.style.fontWeight = 'bold';
    badge.style.background = 'var(--primary)';
    badge.style.color = '#ffffff';
    badge.style.borderRadius = '50%';
    badge.style.width = '14px';
    badge.style.height = '14px';
    badge.style.display = 'flex';
    badge.style.alignItems = 'center';
    badge.style.justifyContent = 'center';
    badge.style.bottom = '4px';
    badge.style.right = '4px';
    badge.style.border = '1px solid var(--bg-primary)';
    DOM.btnRepeat.appendChild(badge);
  }
}

// AGGIORNA SEEKBAR E TIMER DEL DRAWER
function updateProgress() {
  const player = players.active;
  if (!player || !player.duration || isNaN(player.duration)) return;

  const current = player.currentTime;
  const duration = player.duration;
  const percent = (current / duration) * 100;

  // Se l'utente non trascina la seekbar, la aggiorniamo
  if (!DOM.drawerSeekbar.dataset.dragging) {
    DOM.drawerSeekbar.value = percent;
  }

  // Aggiorna mini progress bar
  DOM.miniProgressBar.style.width = `${percent}%`;

  // Aggiorna le etichette di tempo
  DOM.timeCurrent.textContent = formatTime(current);
  DOM.timeDuration.textContent = formatTime(duration);

  // Aggiorna lo stato di avanzamento per la Media Session API
  if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
    try {
      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: player.playbackRate || 1.0,
        position: current
      });
    } catch (e) {
      // Ignora errori minori
    }
  }
}

// GESTIONE TRASCINAMENTO SEEKBAR (SLIDE)
function handleSeekbarInput() {
  DOM.drawerSeekbar.dataset.dragging = 'true';
  const player = players.active;
  if (player && player.duration) {
    const targetPercent = parseFloat(DOM.drawerSeekbar.value);
    const targetTime = (targetPercent / 100) * player.duration;
    DOM.timeCurrent.textContent = formatTime(targetTime);
  }
}

// GESTIONE TRASCINAMENTO SEEKBAR (RILASCIO)
function handleSeekbarChange() {
  const player = players.active;
  if (player && player.duration) {
    const targetPercent = parseFloat(DOM.drawerSeekbar.value);
    player.currentTime = (targetPercent / 100) * player.duration;
  }
  delete DOM.drawerSeekbar.dataset.dragging;
}

// FORMATTA I SECONDI IN MINUTI (es. 75 -> 1:15)
function formatTime(secs) {
  if (isNaN(secs)) return '0:00';
  const minutes = Math.floor(secs / 60);
  const seconds = Math.floor(secs % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// AGGIORNA GLI ELEMENTI GRAFICI DI MINI PLAYER E DRAWER PLAYER
function updateUI() {
  const hasTrack = state.queue.length > 0 && state.currentTrackIndex >= 0;
  
  if (!hasTrack) {
    DOM.miniPlayer.classList.remove('active');
    DOM.playerDrawer.classList.remove('playing');
    return;
  }

  const track = state.queue[state.currentTrackIndex];
  const initial = track.name.trim().charAt(0).toUpperCase();
  const grad = getGradient(track.name);

  // 1. MINI-PLAYER
  DOM.miniPlayer.classList.add('active');
  DOM.miniTitle.textContent = track.name;
  DOM.miniArtist.textContent = state.playlistName;
  DOM.miniCover.style.background = grad;
  DOM.miniCover.textContent = initial;

  if (state.isPlaying) {
    DOM.svgMiniPlay.style.display = 'none';
    DOM.svgMiniPause.style.display = 'block';
  } else {
    DOM.svgMiniPlay.style.display = 'block';
    DOM.svgMiniPause.style.display = 'none';
  }

  // 2. DRAWER PLAYER
  DOM.drawerTrackTitle.textContent = track.name;
  DOM.drawerTrackSubtitle.textContent = state.playlistName;
  DOM.drawerCover.style.background = grad;
  DOM.drawerCover.textContent = initial;

  if (state.isPlaying) {
    DOM.playerDrawer.classList.add('playing');
    DOM.svgDrawerPlay.style.display = 'none';
    DOM.svgDrawerPause.style.display = 'block';
  } else {
    DOM.playerDrawer.classList.remove('playing');
    DOM.svgDrawerPlay.style.display = 'block';
    DOM.svgDrawerPause.style.display = 'none';
  }
}

// GENERA ARTWORK DINAMICO PER LA MEDIA SESSION (SCHERMATA DI BLOCCO)
function generatePlaceholderArtwork(title, subtitle) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Sfondo gradiente circolare
    const gradColors = getGradientColors(title);
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, gradColors.c1);
    grad.addColorStop(1, gradColors.c2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    
    // Cerchio vetroso centrale
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(256, 256, 140, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Lettera centrale
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 160px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initial = title ? title.trim().charAt(0).toUpperCase() : 'B';
    ctx.fillText(initial, 256, 256);
    
    // Scritta brand inferiore
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '700 24px "Inter", sans-serif';
    ctx.fillText('BANS PLAYER', 256, 440);

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Errore generazione canvas artwork:', e);
    return 'icon.svg';
  }
}

// HELPER PER OTTENERE COLORI HSL
function getGradientColors(title) {
  const hash = hashCode(title || 'Bans');
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 140) % 360;
  return {
    c1: `hsl(${h1}, 75%, 60%)`,
    c2: `hsl(${h2}, 85%, 45%)`
  };
}

// CONFIGURAZIONE MEDIA SESSION API (CONTROLLI BACKGROUND / LOCKSCREEN)
function updateMediaSession() {
  if (!('mediaSession' in navigator) || state.queue.length === 0) return;

  const track = state.queue[state.currentTrackIndex];
  const placeholderUrl = generatePlaceholderArtwork(track.name, state.playlistName);

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.name,
    artist: state.playlistName,
    album: 'Bans Player',
    artwork: [
      { src: placeholderUrl, sizes: '512x512', type: 'image/png' }
    ]
  });

  // Associazione dei controlli fisici/Bluetooth del dispositivo
  navigator.mediaSession.setActionHandler('play', () => togglePlayPause());
  navigator.mediaSession.setActionHandler('pause', () => togglePlayPause());
  navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious());
  navigator.mediaSession.setActionHandler('nexttrack', () => playNext(true));
  
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (players.active && players.active.duration) {
      players.active.currentTime = details.seekTime;
      updateProgress();
    }
  });
}

// AZIONI APERTURA / CHIUSURA PLAYER DRAWER
function openDrawer() {
  DOM.playerDrawer.classList.add('open');
  document.body.style.overflow = 'hidden'; // Blocca scroll principale
}

function closeDrawer() {
  DOM.playerDrawer.classList.remove('open');
  document.body.style.overflow = ''; // Ripristina scroll
}

// GESTIONE INSTALLAZIONE PWA (BULLON IN ALTO)
let deferredPrompt;
function setupPwaInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Mostra il pulsante "Installa App"
    DOM.btnInstallPwa.classList.remove('hidden');
  });

  DOM.btnInstallPwa.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Risultato installazione: ${outcome}`);
    deferredPrompt = null;
    DOM.btnInstallPwa.classList.add('hidden');
  });

  // Rileva se l'app viene eseguita come PWA installata
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
    DOM.btnInstallPwa.classList.add('hidden');
  }
}
