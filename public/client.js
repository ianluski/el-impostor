const socket = io();

let playerName = "";
let roomCode = "";
let isHost = false;
let mode = null; // 'create' | 'join'

// Secciones
const landing = document.getElementById("landing");
const home = document.getElementById("home");
const game = document.getElementById("game");
const voting = document.getElementById("voting");
const result = document.getElementById("result");

// Inputs / UI
const nameInput = document.getElementById("name");
const roomInput = document.getElementById("room");
const copyRoomBtn = document.getElementById("copyRoom");
const playersList = document.getElementById("playersList");
const statusEl = document.getElementById("status");

// Botones landing
document.getElementById("goCreate").onclick = () => {
  mode = "create";
  landing.classList.add("hidden");
  home.classList.remove("hidden");

  // En crear sala: el código lo pone el server -> readOnly y botón copiar visible
  roomInput.value = "";
  roomInput.placeholder = "Código de sala";
  roomInput.readOnly = true;
  copyRoomBtn.style.display = "inline-flex";
};

document.getElementById("goJoin").onclick = () => {
  mode = "join";
  landing.classList.add("hidden");
  home.classList.remove("hidden");

  // En unirse: se debe escribir el código -> editable y ocultar copiar
  roomInput.value = "";
  roomInput.placeholder = "Código de sala (ej: ABCD)";
  roomInput.readOnly = false;
  roomInput.focus();
  copyRoomBtn.style.display = "none";
};

// Copiar código (solo cuando existe)
copyRoomBtn.onclick = () => {
  if (!roomInput.value) return;
  navigator.clipboard.writeText(roomInput.value);
  alert("Código copiado: " + roomInput.value);
};

// Crear sala
document.getElementById("createBtn").onclick = () => {
  if (mode !== "create") {
    alert("Primero elige 'Crear sala'.");
    return;
  }
  playerName = (nameInput.value || "").trim();
  if (!playerName) return alert("Ingresa tu nombre");
  socket.emit("createRoom", playerName);
};

// Unirse a sala
document.getElementById("joinBtn").onclick = () => {
  if (mode !== "join") {
    alert("Primero elige 'Unirse a sala'.");
    return;
  }
  playerName = (nameInput.value || "").trim();
  if (!playerName) return alert("Ingresa tu nombre");

  const code = (roomInput.value || "").trim().toUpperCase();
  if (!code || code.length < 4) return alert("Ingresa un código válido (4+ caracteres)");

  roomCode = code;
  socket.emit("joinRoom", { playerName, roomCode });
};

// Iniciar ronda (host)
document.getElementById("startBtn").onclick = () => {
  if (!isHost) return alert("Solo el host puede iniciar la ronda");
  socket.emit("startGame", roomCode);
};

// BOTONES DE JUEGO (tu lógica aquí según tu server real)
document.getElementById("exitBtn").onclick = () => location.reload();

// ====== Eventos del servidor (estos coinciden con el server simple de ejemplo) ======
socket.on("roomCreated", (code) => {
  // Llega el código desde el servidor
  roomCode = code;
  isHost = true;
  roomInput.value = code;

  // Aseguramos estado de UI correcto para crear
  roomInput.readOnly = true;
  copyRoomBtn.style.display = "inline-flex";
});

socket.on("updatePlayers", (players) => {
  playersList.innerHTML = players.map(p => `<li>${p}</li>`).join("");
  statusEl.textContent = `Jugadores en sala: ${players.length}`;
});

socket.on("gameStarted", (word) => {
  home.classList.add("hidden");
  game.classList.remove("hidden");
  document.getElementById("wordDisplay").textContent = word;
});
