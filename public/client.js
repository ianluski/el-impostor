// client.js
const socket = io();

let currentRoom = null;
let myName = '';
let isHost = false;
let lastRound = 0;
let homeMode = null; // 'create' | 'join'

const $ = (s)=>document.querySelector(s);

// ===== THEME (light/dark) =====
const rootEl = document.documentElement;
const themeToggleBtn = document.getElementById('themeToggle');

function applyTheme(theme){
  rootEl.setAttribute('data-theme', theme);
  try { localStorage.setItem('theme', theme); } catch(_) {}
}
(function initTheme(){
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch(_) {}
  if (!saved) {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    saved = prefersDark ? 'dark' : 'light';
  }
  applyTheme(saved);
})();
if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const next = rootEl.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
}

// Pantallas
const landing = $('#landing');
const home = $('#home');
const game = $('#game');

// LANDING
const goCreateBtn = $('#goCreateBtn');
const goJoinBtn   = $('#goJoinBtn');

// HOME
const nameInput    = $('#name');
const rowCreate    = $('#rowCreate');
const rowJoin      = $('#rowJoin');
const createBtn    = $('#createBtn');
const joinBtn      = $('#joinBtn');
const startBtn     = $('#startBtn');
const roomInput    = $('#room');
const poolTextarea = $('#pool');
const roomCodeTag  = $('#roomCodeTag');
const statusEl     = $('#status');
const hostBadge    = $('#hostBadge');
const playersList  = $('#playersList');
const impostorsSelect = $('#impostors');

// GAME
const roleEl     = $('#role');
const revealBox  = $('#revealBox');
const backBtn    = $('#backBtn');
const revealBtn  = $('#revealBtn');
const nextBtn    = $('#nextBtn');

// ====== UI ======
function showLanding(){
  landing.classList.remove('hidden');
  home.classList.add('hidden');
  game.classList.add('hidden');
  currentRoom = null;
  lastRound = 0;
  isHost = false;
  homeMode = null;
  statusEl.textContent = 'Jugadores en sala: 0';
  playersList.innerHTML = '';
  roomCodeTag.style.display = 'none';
  roomInput.value = '';
  hostBadge.textContent = '';
}

function showHome(mode){
  homeMode = mode;
  landing.classList.add('hidden');
  game.classList.add('hidden');
  home.classList.remove('hidden');

  if (mode === 'create') {
    rowCreate.classList.remove('hidden');
    rowJoin.classList.add('hidden');
  } else {
    rowCreate.classList.add('hidden');
    rowJoin.classList.remove('hidden');
  }
  updateHostUI();
}

function showGame(){
  landing.classList.add('hidden');
  home.classList.add('hidden');
  game.classList.remove('hidden');
}

function showRoomCode(code){
  roomCodeTag.style.display = 'inline-block';
  roomCodeTag.textContent = `Sala: ${code}`;
}

function updateHostUI() {
  startBtn.disabled  = !isHost;
  revealBtn.disabled = !isHost;
  nextBtn.disabled   = !isHost;

  const disabledMsg = '(Solo el host puede editar esta lista)';
  if (!isHost) {
    poolTextarea.setAttribute('disabled', 'disabled');
    if (!poolTextarea.value) poolTextarea.placeholder = disabledMsg;
  } else {
    poolTextarea.removeAttribute('disabled');
    if (poolTextarea.placeholder === disabledMsg) {
      poolTextarea.placeholder = 'Messi\nMaradona\nRiquelme';
    }
  }
  impostorsSelect.disabled = !isHost;

  hostBadge.textContent = isHost
    ? 'Sos el host'
    : (currentRoom ? '(El host maneja: iniciar, revelar y siguiente ronda)' : '');
}

function genCode(){
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i=0; i<4; i++) s += A[Math.floor(Math.random()*A.length)];
  return s;
}

// ====== LANDING ======
goCreateBtn.onclick = () => showHome('create');
goJoinBtn.onclick   = () => showHome('join');

// ====== HOME ======
createBtn.onclick = () => {
  myName = (nameInput.value || '').trim() || 'Jugador';
  socket.emit('createRoom', { name: myName });
};

joinBtn.onclick = () => {
  const code = (roomInput.value || '').trim().toUpperCase();
  myName = (nameInput.value || '').trim() || 'Jugador';
  if (!code) return alert('Ingresá un código de sala');
  currentRoom = code;
  socket.emit('joinRoom', { code, name: myName });
  showRoomCode(code);
};

startBtn.onclick = () => {
  if (!currentRoom) return alert('Primero creá o unite a una sala');
  if (!isHost) return alert('Solo el host puede iniciar la partida.');
  const customPool = (poolTextarea.value || '').split('\n').map(s=>s.trim()).filter(Boolean);
  socket.emit('setPool', { code: currentRoom, customPool });
  socket.emit('setImpostors', { code: currentRoom, impostors: impostorsSelect.value });
  socket.emit('startGame', { code: currentRoom });
};

revealBtn.onclick = () => {
  if (!currentRoom) return;
  socket.emit('reveal', currentRoom);
};

nextBtn.onclick = () => {
  if (!currentRoom) return;
  if (!isHost) return alert('Solo el host puede iniciar la siguiente ronda.');
  const customPool = (poolTextarea.value || '').split('\n').map(s=>s.trim()).filter(Boolean);
  socket.emit('setPool', { code: currentRoom, customPool });
  socket.emit('setImpostors', { code: currentRoom, impostors: impostorsSelect.value });
  revealBox.classList.add('hidden');
  revealBox.textContent = '';
  socket.emit('startGame', { code: currentRoom });
};

backBtn.onclick = () => {
  if (currentRoom) socket.emit('leaveRoom', currentRoom);
  showLanding();
};

// ====== Servidor → Cliente ======
socket.on('roomCreated', ({ code }) => {
  currentRoom = code;
  showRoomCode(code);
  isHost = true;
  updateHostUI();
  statusEl.textContent = 'Jugadores en sala: 1 (sos el host)';
});

socket.on('roomInfo', ({ code, isHost: hostFlag, hostName, players }) => {
  isHost = !!hostFlag;
  updateHostUI();
  statusEl.textContent = `Jugadores en sala: ${players}`;
  if (code) showRoomCode(code);
  hostBadge.textContent = isHost ? 'Sos el host' : `Host: ${hostName || 'Desconocido'}`;
});

socket.on('roomState', ({ count, names, hostName, poolCount, impostors }) => {
  statusEl.textContent = `Jugadores en sala: ${count}`;
  playersList.innerHTML = '';
  (names || []).forEach(n => {
    const li = document.createElement('li');
    li.textContent = n;
    playersList.appendChild(li);
  });
  if (!isHost && currentRoom) hostBadge.textContent = `Host: ${hostName || 'Desconocido'}`;
  if (typeof impostors !== 'undefined') impostorsSelect.value = String(impostors);
});

socket.on('roundStarted', ({ round }) => {
  setTimeout(() => {
    if (round > (lastRound || 0)) {
      socket.emit('syncMe', currentRoom);
    }
  }, 700);
});

socket.on('role', (payload) => {
  let word = payload;
  let round = lastRound;

  if (typeof payload === 'object' && payload) {
    word = payload.word;
    round = payload.round || (lastRound + 1);
  }

  if (round < lastRound) return;
  lastRound = round;

  roleEl.textContent = word;
  showGame();
});

socket.on('revealResult', ({ impostorsNames, word }) => {
  const names = Array.isArray(impostorsNames) ? impostorsNames.join(', ') : String(impostorsNames || 'Desconocido');
  revealBox.textContent = `Impostores: ${names} — Palabra: ${word}`;
  revealBox.classList.remove('hidden');
});

socket.on('impostorsUpdated', ({ impostors }) => {
  impostorsSelect.value = String(impostors);
});

socket.on('notAllowed', (msg) => {
  alert(msg || 'Acción no permitida');
});

// Auto-rejoin + sync
socket.on('connect', () => {
  if (currentRoom && myName) {
    socket.emit('joinRoom', { code: currentRoom, name: myName });
    socket.emit('syncMe', currentRoom);
  }
});

// Arranque
showLanding();
