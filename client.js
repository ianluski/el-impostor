const socket = io();
let currentRoom = null;

const $ = (s)=>document.querySelector(s);
const roomInput = $('#room');
const statusEl = $('#status');
const roleEl = $('#role');
const joinBtn = $('#joinBtn');
const startBtn = $('#startBtn');

joinBtn.onclick = () => {
  const code = (roomInput.value || '').trim().toUpperCase();
  if (!code) return alert('Ingresá un código de sala');
  currentRoom = code;
  socket.emit('joinRoom', code);
};

startBtn.onclick = () => {
  if (!currentRoom) return alert('Primero unite a una sala');
  socket.emit('startGame', currentRoom);
};

socket.on('updatePlayers', (n) => {
  statusEl.textContent = `Jugadores en sala: ${n}`;
});

socket.on('role', (word) => {
  roleEl.textContent = `Tu palabra es: ${word}`;
});
