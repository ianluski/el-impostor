const socket = io();
let currentRoom = null;

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

// GAME
const game = $('#game');
const roleEl = $('#role');
const revealBox = $('#revealBox');
const backBtn = $('#backBtn');
const revealBtn = $('#revealBtn');
const nextBtn = $('#nextBtn');

// ---- helpers de UI
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

function genCode(){
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i=0; i<4; i++) s += A[Math.floor(Math.random()*A.length)];
  return s;
}

// ---- flujo
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

// Cuando el server te asigna palabra → pasamos a la pantalla de juego
socket.on('role', (word) => {
  roleEl.textContent = word;
  showGame();
});

// Estado de cantidad de jugadores (se ve en home)
socket.on('updatePlayers', (n) => {
  statusEl.textContent = `Jugadores en sala: ${n}`;
});

// Revelar impostor (pedimos al server y lo mostramos)
revealBtn.onclick = () => {
  if (!currentRoom) return;
  socket.emit('reveal', currentRoom);
};

socket.on('revealResult', ({ impostorName, word }) => {
  revealBox.textContent = `Impostor: ${impostorName || 'Desconocido'} — Palabra: ${word}`;
  revealBox.classList.remove('hidden');
});

// Siguiente ronda (misma sala; puede usar lista personalizada)
nextBtn.onclick = () => {
  if (!currentRoom) return;
  const customPool = (poolTextarea.value || '').split('\n').map(s=>s.trim()).filter(Boolean);
  // borrar revelado anterior
  revealBox.classList.add('hidden');
  revealBox.textContent = '';
  socket.emit('startGame', { code: currentRoom, customPool });
};

// Salir a home (dejás la sala)
backBtn.onclick = () => {
  if (currentRoom) socket.emit('leaveRoom', currentRoom);
  currentRoom = null;
  roomInput.value = '';
  roomCodeTag.style.display = 'none';
  statusEl.textContent = 'Jugadores en sala: 0';
  showHome();
};

// Logs útiles
socket.on('connect', ()=>console.log('Socket conectado', socket.id));
socket.on('connect_error', (e)=>console.error('Socket error', e));
