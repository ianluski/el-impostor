const socket = io();

let currentRoom = null;
let myName = '';
let isHost = false;
let lastRound = 0;
let homeMode = null; // 'create' | 'join'

// Shortcuts
const $ = (s)=>document.querySelector(s);

// PANTALLAS
const landing = $('#landing');
const home = $('#home');
const game = $('#game');

// LANDING
const goCreateBtn = $('#goCreateBtn');
const goJoinBtn   = $('#goJoinBtn');

// HOME (lobby)
const nameInput   = $('#name');
const rowCreate   = $('#rowCreate');
const rowJoin     = $('#rowJoin');
const createBtn   = $('#createBtn');
const joinBtn     = $('#joinBtn');
const startBtn    = $('#startBtn');
const roomInput   = $('#room');
const poolTextarea= $('#pool');
const roomCodeTag = $('#roomCodeTag');
const statusEl    = $('#status');
const hostBadge   = $('#hostBadge');
const playersList = $('#playersList');

// GAME
const roleEl     = $('#role');
const revealBox  = $('#revealBox');
const backBtn    = $('#backBtn');
const revealBtn  = $('#revealBtn');
const nextBtn    = $('#nextBtn');

// ====== UI helpers ======
function showLanding(){
  landing.classList.remove('hidden');
  home.classList.add('hidden');
  game.classList.add('hidden');
  // limpiar estado básico
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
  homeMode = mode; // 'create' | 'join'
  landing.classList.add('hidden');
  game.classList.add('hidden');
  home.classList.remove('hidden');

  // visibilidad por modo
  if (mode === 'create') {
    rowCreate.classList.remove('hidden');
    rowJoin.classList.add('hidden');
  } else {
    rowCreate.classList.add('hidden');
    rowJoin.classList.remove('hidden');
  }

  updateHostUI(); // deshabilita/ habilita botones según sea host
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

  // textarea de lista personalizada: SOLO host edita
  const disabledMsg = '(Solo el host puede editar esta lista)';
  if (!isHost) {
    poolTextarea.setAttribute('disabled', 'disabled');
    poolTextarea.placeholder = disabledMsg;
  } else {
    poolTextarea.removeAttribute('disabled');
    if (poolTextarea.placeholder === disabledMsg) {
      poolTextarea.placeholder = 'Messi\nMaradona\nRiquelme';
    }
  }
}

function genCode(){
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i=0; i<4; i++) s += A[Math.floor(Math.random()*A.length)];
  return s;
}

// ====== LANDING eventos ======
goCreateBtn.onclick = () => showHome('create');
goJoinBtn.onclick   = () => showHome('join');

// ====== HOME (flows) ======
createBtn.onclick = () => {
  myName = (nameInput.value || '').trim() || 'Jugador';
  const code = genCode();
  currentRoom = code;
  socket.emit('joinRoom', { code, name: myName }); // crea o une (si no existe)
  showRoomCode(code);
  statusEl.textContent = 'Jugadores en sala: 1 (sos el host)';
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
  const customPool = (poolTextarea.value || '').split('\n').map(s=>s.trim()).filter(Boolean);

  if (isHost) {
    // Guardar la lista en la sala y luego iniciar
    socket.emit('setPool', { code: currentRoom, customPool });
    socket.emit('startGame', { code: currentRoom }); // ya usa la pool guardada
  } else {
    alert('Solo el host puede iniciar la partida.');
  }
};

// ====== GAME acciones ======
revealBtn.onclick = () => {
  if (!currentRoom) return;
  socket.emit('reveal', currentRoom);
};

nextBtn.onclick = () => {
  if (!currentRoom) return;
  if (!isHost) return alert('Solo el host puede iniciar la siguiente ronda.');

  const customPool = (poolTextarea.value || '').split('\n').map(s=>s.trim()).filter(Boolean);
  // Opcional: si querés que cada ronda use lo que está escrito actualmente
  socket.emit('setPool', { code: currentRoom, customPool });

  revealBox.classList.add('hidden');
  revealBox.textContent = '';
  socket.emit('startGame', { code: currentRoom }); // usa la pool guardada
};

backBtn.onclick = () => {
  if (currentRoom) socket.emit('leaveRoom', currentRoom);
  showLanding();
};

// ====== Servidor → Cliente ======
socket.on('roomInfo', ({ code, isHost: hostFlag, hostName, players }) => {
  isHost = !!hostFlag;
  updateHostUI();
  statusEl.textContent = `Jugadores en sala: ${players}`;
  if (code) showRoomCode(code);
  hostBadge.textContent = isHost ? 'Sos el host' : `Host: ${hostName || 'Desconocido'}`;
});

socket.on('roomState', ({ count, names, hostName }) => {
  statusEl.textContent = `Jugadores en sala: ${count}`;
  playersList.innerHTML = '';
  names.forEach(n => {
    const li = document.createElement('li');
    li.textContent = n;
    playersList.appendChild(li);
  });
  if (!isHost && currentRoom) hostBadge.textContent = `Host: ${hostName || 'Desconocido'}`;
});

socket.on('role', (payload) => {
  let word = payload;
  let round = lastRound;

  if (typeof payload === 'object' && payload) {
    word = payload.word;
    round = payload.round || (lastRound + 1);
  }

  if (round < lastRound) return; // evita mostrar algo viejo
  lastRound = round;

  roleEl.textContent = word;
  showGame();
});

socket.on('revealResult', ({ impostorName, word }) => {
  revealBox.textContent = `Impostor: ${impostorName || 'Desconocido'} — Palabra: ${word}`;
  revealBox.classList.remove('hidden');
});

socket.on('notAllowed', (msg) => {
  alert(msg || 'Acción no permitida');
});

// Auto-rejoin si el socket se resetea (por suspensión de dispositivo, etc.)
socket.on('connect', () => {
  if (currentRoom && myName) {
    socket.emit('joinRoom', { code: currentRoom, name: myName });
  }
});
socket.on('connect_error', (e)=>console.error('Socket error', e));

// Al iniciar, mostrar la landing
showLanding();
