const socket = io();

let currentRoom = null;
let isHost = false;
let selectedVote = null;

// Pantallas
const landing = document.getElementById("landing");
const home = document.getElementById("home");
const game = document.getElementById("game");
const voteScreen = document.getElementById("voteScreen");
const voteOutcome = document.getElementById("voteOutcome");

// Lobby
const nameInput = document.getElementById("name");
const roomInput = document.getElementById("room");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");
const playersList = document.getElementById("playersList");
const statusEl = document.getElementById("status");

// Game
const roleEl = document.getElementById("role");
const startVoteBtn = document.getElementById("startVoteBtn");
const nextBtn = document.getElementById("nextBtn");
const backBtn = document.getElementById("backBtn");
const hostGame = document.getElementById("currentHostGame");

// Votación
const voteTargets = document.getElementById("voteTargets");
const voteBtn = document.getElementById("voteBtn");
const voteMessage = document.getElementById("voteMessage");
const nextRoundBtn = document.getElementById("nextRoundBtn");

// Navegación
document.getElementById("goCreateBtn").onclick = () => { landing.classList.add("hidden"); home.classList.remove("hidden"); };
document.getElementById("goJoinBtn").onclick = () => { landing.classList.add("hidden"); home.classList.remove("hidden"); };

// Crear/Unirse
createBtn.onclick = () => {
  const name = nameInput.value || "Jugador";
  socket.emit("createRoom", { name });
};
joinBtn.onclick = () => {
  const name = nameInput.value || "Jugador";
  const code = roomInput.value.trim().toUpperCase();
  socket.emit("joinRoom", { code, name });
};

// Iniciar ronda
startBtn.onclick = () => {
  if (!isHost) return alert("Solo el host puede iniciar");
  socket.emit("startRound", { code: currentRoom });
};

// Botones juego
startVoteBtn.onclick = () => {
  if (!isHost) return alert("Solo el host puede iniciar la votación");
  socket.emit("startVote", { code: currentRoom });
};
nextBtn.onclick = () => {
  if (!isHost) return alert("Solo el host puede pasar de ronda");
  socket.emit("startRound", { code: currentRoom });
};
backBtn.onclick = () => { location.reload(); };

// Votación
voteBtn.onclick = () => {
  if (!selectedVote) return;
  socket.emit("castVote", { code: currentRoom, targetId: selectedVote });
  voteBtn.disabled = true;
  voteBtn.textContent = "Voto enviado";
};

// ===== SOCKET EVENTS =====
socket.on("roomCreated", ({ code, isHost: hostFlag }) => {
  currentRoom = code;
  isHost = hostFlag;
  roomInput.value = code;
});
socket.on("roomJoined", ({ code, isHost: hostFlag }) => {
  currentRoom = code;
  isHost = hostFlag;
  home.classList.remove("hidden");
});
socket.on("playersUpdate", (names) => {
  playersList.innerHTML = "";
  names.forEach(n => {
    const li = document.createElement("li");
    li.textContent = n;
    playersList.appendChild(li);
  });
  statusEl.textContent = `Jugadores en sala: ${names.length}`;
});
socket.on("role", ({ word, hostName }) => {
  home.classList.add("hidden");
  game.classList.remove("hidden");
  roleEl.textContent = word;
  hostGame.textContent = `Host: ${hostName}`;
  if (!isHost) startVoteBtn.disabled = true;
});
socket.on("voteStarted", ({ players }) => {
  game.classList.add("hidden");
  voteScreen.classList.remove("hidden");
  voteTargets.innerHTML = "";
  selectedVote = null;
  voteBtn.disabled = true;
  voteBtn.textContent = "Votar";

  players.forEach(p => {
    const btn = document.createElement("button");
    btn.textContent = p.name;
    btn.onclick = () => {
      selectedVote = p.id;
      document.querySelectorAll("#voteTargets button").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      voteBtn.disabled = false;
    };
    voteTargets.appendChild(btn);
  });
});
socket.on("voteResult", ({ message, impostorFound }) => {
  voteScreen.classList.add("hidden");
  voteOutcome.classList.remove("hidden");
  voteMessage.textContent = message;

  if (isHost && impostorFound) {
    nextRoundBtn.classList.remove("hidden");
    nextRoundBtn.onclick = () => {
      socket.emit("startRound", { code: currentRoom });
      voteOutcome.classList.add("hidden");
      game.classList.remove("hidden");
      nextRoundBtn.classList.add("hidden");
    };
  } else if (!impostorFound) {
    // todos vuelven automáticamente después de un breve delay
    setTimeout(() => {
      voteOutcome.classList.add("hidden");
      game.classList.remove("hidden");
    }, 2500);
  }
});
