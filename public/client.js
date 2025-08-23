const socket = io();
let currentRoom = null;

const $ = (s)=>document.querySelector(s);
const nameInput = $('#name');
const roomInput = $('#room');
const statusEl = $('#status');
const roleEl = $('#role');
const joinBtn = $('#joinBtn');
const startBtn = $('#startBtn');
const createBtn = $('#createBtn');
const roomCodeTag = $('#roomCodeTag');
const poolTextarea = document.getElementById('pool');

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

createBtn.onclick = () => {
  const name = (nameInput.value || '').trim() || 'Jugador';
  const code = genCode();
  currentRoom = code;
  socket.emit('joinRoom', { code, name });
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

socket.on('updatePlayers', (n) => {
  statusEl.textContent = `Jugadores en sala: ${n}`;
});

socket.on('role', (word) => {
  roleEl.textContent = `Tu palabra es: ${word}`;
});

socket.on('connect', ()=>console.log('Socket conectado', socket.id));
socket.on('connect_error', (e)=>console.error('Socket error', e));
