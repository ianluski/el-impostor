const socket = io();

let playerName = "";
let roomCode = "";
let isHost = false;

// Navegación entre pantallas
const landing = document.getElementById("landing");
const home = document.getElementById("home");
const game = document.getElementById("game");
const voting = document.getElementById("voting");
const result = document.getElementById("result");

// Inputs y botones
const nameInput = document.getElementById("name");
const roomInput = document.getElementById("room");
const copyRoomBtn = document.getElementById("copyRoom");
const playersList = document.getElementById("playersList");

// Botones landing
document.getElementById("goCreate").onclick = () => {
  landing.classList.add("hidden");
  home.classList.remove("hidden");
};

document.getElementById("goJoin").onclick = () => {
  landing.classList.add("hidden");
  home.classList.remove("hidden");
};

// Copiar código de sala
copyRoomBtn.onclick = () => {
  navigator.clipboard.writeText(roomInput.value);
  alert("Código copiado: " + roomInput.value);
};

// Crear sala
document.getElementById("createBtn").onclick = () => {
  playerName = nameInput.value.trim();
  if (!playerName) return alert("Ingresa tu nombre");
  socket.emit("createRoom", playerName);
};

// Unirse a sala
document.getElementById("joinBtn").onclick = () => {
  playerName = nameInput.value.trim();
  if (!playerName) return alert("Ingresa tu nombre");
  const code = prompt("Ingresa el código de la sala:");
  if (!code) return;
  roomCode = code;
  socket.emit("joinRoom", { playerName, roomCode });
};

// Iniciar juego
document.getElementById("startBtn").onclick = () => {
  if (isHost) socket.emit("startGame", roomCode);
};

// Eventos del servidor
socket.on("roomCreated", (code) => {
  roomCode = code;
  roomInput.value = code;
  isHost = true;
});

socket.on("updatePlayers", (players) => {
  playersList.innerHTML = players.map(p => `<li>${p}</li>`).join("");
});

socket.on("gameStarted", (word) => {
  home.classList.add("hidden");
  game.classList.remove("hidden");
  document.getElementById("wordDisplay").textContent = word;
});
