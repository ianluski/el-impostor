const socket = io();
let currentRoom = null;
let isHost = false;

const $ = (s)=>document.querySelector(s);

// HOME
const home = $('#home');
const nameInput = $('#name');
const roomInput = $('#room');
const statusEl = $('#status');
const createBtn = $('#createBtn');
const joinBtn = $('#joinBtn');
const startBtn = $('#startBtn');
const roomCodeTag = $('#roomCodeTag');
const poolTextarea = $('#pool');
const hostBadge = document.createElement('div'); // para mostrar si sos host o quién es host
hostBadge.className = 'muted';
home.appendChild(hostBadge);

// GAME
const game = $('#game');
const roleEl = $('#role');
const revealBox = $('#revealBox');
const backBtn = $('#backBtn');
const revealBtn = $('#revealBtn');
const nextBtn = $('#nextBtn');

// ---- helpers UI
function showHome(){
  home.classList.remove('hidden');
  game.classList.add('hidden');
  revealBox.classList.add('hidden');
  revealBox.textContent = '';
  roleEl.textContent = '—';
}

function showGame(){
  home.classList.add('hidden');
  game.classList.remove('hidden');
}

function showRoomCode(code){
  roomCodeTag.style.display = 'inline-block';
  roomCodeTag.textContent = `Sala: ${code}`;
}

function updateHostUI() {
  // Botones que solo maneja host
  startBtn.disabled  = !isHost;
  revealBtn.disabled = !isHost;
  nextBtn.disabled   = !isHost;
  hostBadge.textContent = isHost ? 'Sos el host' : '(Host: limitado a iniciar, revelar y siguiente ronda)';
}

// ---- flujo
function genCode(){
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i=0; i<4; i++) s += A[Math.floor(Math.random()*A.length)];
  return s;
}

createBtn.onclick = () => {
  const name = (nameInput.value || '').trim() || 'Jugador';
  const code = genCode();
  currentRoom = code;
  socket.emit('joinRoom', { code, name }); // crea o une
  showRoomCode(code);
  statusEl.textContent = 'Jugadores en sala: 1 (sos el host)';
};

joinBtn.onclick = () => {
  const code = (roomInput.value || '').trim().toUpperCase();
  const name = (nameInput.value || '').trim() || 'Jugador';
  if (!code) return alert('Ingresá un código de sala');
  currentRoom = code;
  socket.emit('joinRoom', { code, name });
  showRoomCode(code);
};

startBtn.onclick = () => {
  if (!currentRoom) return alert('Primero creá o unite a una sala');
  const customPool = (poolTextarea.value || '').split('\n').map(s=>s.trim()).filter(Boolean);
  socket.emit('startGame', { code: currentRoom, customPool });
};

revealBtn.onclick = () => {
  if (!currentRoom) return;
  socket.emit('reveal', currentRoom);
};

nextBtn.onclick = () => {
  if (!currentRoom) return;
  const customPool = (poolTextarea.value || '').split('\n').map(s=>s.trim()).filter(Boolean);
  // limpiar revelado
  revealBox.classList.add('hidden');
  revealBox.textContent = '';
  socket.emit('startGame', { code: currentRoom, customPool });
};

backBtn.onclick = () => {
  if (currentRoom) socket.emit('leaveRoom', currentRoom);
  currentRoom = null;
  roomInput.value = '';
  roomCodeTag.style.display = 'none';
  statusEl.textContent = 'Jugadores en sala: 0';
  showHome();
};

// ---- eventos del servidor
socket.on('roomInfo', ({ code, isHost: hostFlag, hostName, players }) => {
  // guardamos rol de host
  isHost = !!hostFlag;
  updateHostUI();
  statusEl.textContent = `Jugadores en sala: ${players}`;
  if (code) showRoomCode(code);
  if (hostName) hostBadge.textContent = isHost ? 'Sos el host' : `Host: ${hostName}`;
});

socket.on('hostUpdate', ({ hostName }) => {
  // si cambia el host (p.ej. se fue el host), actualizamos el badge
  if (!isHost) hostBadge.textContent = `Host: ${hostName || 'Desconocido'}`;
});

socket.on('updatePlayers', (n) => {
  statusEl.textContent = `Jugadores en sala: ${n}`;
});

socket.on('role', (word) => {
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

// logs
socket.on('connect', ()=>console.log('Socket conectado', socket.id));
socket.on('connect_error', (e)=>console.error('Socket error', e));
