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

function showRoomCode(code){
  roomCodeTag.style.display = 'inline-block';
  roomCodeTag.textContent = `Sala: ${code}`;
}

createBtn.onclick = () => {
  const name = (nameInput.value || '').trim() || 'Jugador';
  socket.emit('createRoom', { name });
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
  socket.emit('startGame', currentRoom);
};

socket.on('roomCreated', ({ code }) => {
  currentRoom = code;
  showRoomCode(code);
  statusEl.textContent = 'Jugadores en sala: 1 (sos el host)';
});

socket.on('updatePlayers', (n) => {
  statusEl.textContent = `Jugadores en sala: ${n}`;
});

socket.on('role', (word) => {
  roleEl.textContent = `Tu palabra es: ${word}`;
});
