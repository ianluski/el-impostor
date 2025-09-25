// client.js
const socket = io();

let currentRoom = null;
let isHost = false;
let myName = "";

// DOM
const $ = (s) => document.querySelector(s);
const landing = $("#landing");
const home = $("#home");
const game = $("#game");

const nameInput = $("#name");
const roomInput = $("#room");
const poolTextarea = $("#pool");
const impostorsSelect = $("#impostors");
const voteSecondsInput = $("#voteSeconds");

const createBtn = $("#createBtn");
const joinBtn = $("#joinBtn");
const startBtn = $("#startBtn");
const playersList = $("#playersList");
const statusEl = $("#status");
const hostBadge = $("#hostBadge");
const scoreLobby = $("#scoreLobby");
const scoreGame = $("#scoreGame");
const roomHostGame = $("#currentHostGame");
const roleEl = $("#role");
const revealBox = $("#revealBox");
const revealBtn = $("#revealBtn");
const nextBtn = $("#nextBtn");
const backBtn = $("#backBtn");

// Voting
const votingPanel = $("#votingPanel");
const voteCountdown = $("#voteCountdown");
const voteTargets = $("#voteTargets");
const myVoteEl = $("#myVote");
const startVoteBtn = $("#startVoteBtn");
const endVoteBtn = $("#endVoteBtn");
const voteResults = $("#voteResults");
const applyScoreBtn = $("#applyScoreBtn");

let voteTimer = null;

// Theme
const rootEl = document.documentElement;
$("#themeToggle").onclick = () => {
  const nx = rootEl.getAttribute("data-theme") === "dark" ? "light" : "dark";
  rootEl.setAttribute("data-theme", nx);
};

// Pantallas
function showLanding() {
  landing.classList.remove("hidden");
  home.classList.add("hidden");
  game.classList.add("hidden");
  playersList.innerHTML = "";
  statusEl.textContent = "Jugadores en sala: 0";
  scoreLobby.innerHTML = "";
  scoreGame.innerHTML = "";
  roleEl.textContent = "—";
  revealBox.classList.add("hidden");
  resetVotingUI();
}
function showHome() {
  landing.classList.add("hidden");
  home.classList.remove("hidden");
  game.classList.add("hidden");
}
function showGame() {
  landing.classList.add("hidden");
  home.classList.add("hidden");
  game.classList.remove("hidden");
}

// Voting helpers
function resetVotingUI() {
  votingPanel.classList.add("hidden");
  voteResults.classList.add("hidden");
  voteResults.textContent = "";
  voteTargets.innerHTML = "";
  myVoteEl.textContent = "";
  voteCountdown.textContent = "—";
  if (voteTimer) { clearInterval(voteTimer); voteTimer = null; }
}
function startCountdown(endsAt) {
  if (voteTimer) clearInterval(voteTimer);
  function tick() {
    const left = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
    voteCountdown.textContent = `${left}s`;
    if (left <= 0 && voteTimer) { clearInterval(voteTimer); voteTimer = null; }
  }
  tick();
  voteTimer = setInterval(tick, 1000);
}
function renderScoreboard(container, table) {
  container.innerHTML = "";
  (table || []).forEach(({ name, points }) => {
    const row = document.createElement("div");
    row.textContent = `${name}: ${points}`;
    container.appendChild(row);
  });
}
function updateHostUI() {
  hostBadge.textContent = isHost ? "Sos el host" : "(El host maneja la partida)";
  startBtn.disabled = !isHost;
  startVoteBtn.disabled = !isHost;
  endVoteBtn.disabled = !isHost;
  applyScoreBtn.disabled = !isHost;

  poolTextarea.disabled = !isHost;
  impostorsSelect.disabled = !isHost;
  voteSecondsInput.disabled = !isHost;
}

// Landing → ir a create / join
$("#goCreateBtn").onclick = () => showHome();
$("#goJoinBtn").onclick = () => showHome();

// Crear / Unirse
createBtn.onclick = () => {
  myName = (nameInput.value || "").trim() || "Jugador";
  socket.emit("createRoom", { name: myName });
};
joinBtn.onclick = () => {
  const code = (roomInput.value || "").trim().toUpperCase();
  myName = (nameInput.value || "").trim() || "Jugador";
  if (!code) return alert("Ingresá el código de sala");
  currentRoom = code;
  socket.emit("joinRoom", { code, name: myName });
};

// Iniciar partida
startBtn.onclick = () => {
  if (!currentRoom) return alert("Unite a una sala primero.");
  if (!isHost) return alert("Solo el host puede iniciar.");
  const customPool = (poolTextarea.value || "").split("\n").map(s => s.trim()).filter(Boolean);
  socket.emit("setPool", { code: currentRoom, customPool });
  socket.emit("setImpostors", { code: currentRoom, impostors: impostorsSelect.value });
  socket.emit("setVoteDuration", { code: currentRoom, seconds: voteSecondsInput.value });
  socket.emit("startGame", { code: currentRoom });
};

// Botones juego
revealBtn.onclick = () => { if (currentRoom) socket.emit("reveal", currentRoom); };
nextBtn.onclick = () => {
  if (!isHost) return alert("Solo el host puede iniciar la siguiente ronda.");
  socket.emit("startGame", { code: currentRoom });
};
backBtn.onclick = () => {
  if (currentRoom) socket.emit("leaveRoom", currentRoom);
  showLanding();
};

// Votación
startVoteBtn.onclick = () => {
  if (!isHost) return;
  socket.emit("setVoteDuration", { code: currentRoom, seconds: voteSecondsInput.value });
  socket.emit("startVote", { code: currentRoom });
};
endVoteBtn.onclick = () => {
  if (!isHost) return;
  socket.emit("endVote", currentRoom);
};
applyScoreBtn.onclick = () => {
  if (!isHost) return;
  socket.emit("finalizeRound", { code: currentRoom });
};

// ====== SOCKET EVENTS ======
socket.on("roomCreated", ({ code }) => {
  currentRoom = code;
  isHost = true;
  updateHostUI();
  showHome();
  roomInput.value = code;
});
socket.on("roomInfo", ({ code, isHost: hostFlag, hostName }) => {
  if (code) currentRoom = code;
  isHost = !!hostFlag;
  updateHostUI();
  roomHostGame.textContent = `Host: ${hostName || "—"}`;
});
socket.on("roomState", ({ hostName, names, scores, count, impostors, voteDuration }) => {
  statusEl.textContent = `Jugadores en sala: ${count || (names ? names.length : 0)}`;
  playersList.innerHTML = "";
  (names || []).forEach(n => {
    const li = document.createElement("li");
    li.textContent = n;
    playersList.appendChild(li);
  });
  if (scores) {
    renderScoreboard(scoreLobby, scores);
    renderScoreboard(scoreGame, scores);
  }
  if (impostors) impostorsSelect.value = String(impostors);
  if (voteDuration) voteSecondsInput.value = String(voteDuration);
  roomHostGame.textContent = `Host: ${hostName || "—"}`;
});
socket.on("roundStarted", () => {
  // limpiar UI y mostrar juego
  resetVotingUI();
  revealBox.classList.add("hidden");
  roleEl.style.display = "block";
  revealBtn.style.display = "inline-block";
  nextBtn.style.display = "inline-block";
});
socket.on("role", ({ word, hostName }) => {
  roleEl.textContent = word;
  roomHostGame.textContent = `Host: ${hostName || "—"}`;
  showGame();
});
socket.on("revealResult", ({ impostorsNames, word }) => {
  revealBox.textContent = `Impostores: ${impostorsNames.join(", ")} — Palabra: ${word}`;
  revealBox.classList.remove("hidden");
});

// Votación eventos
socket.on("voteStarted", ({ endsAt, players }) => {
  // Pantalla de votación: reemplaza la palabra y botones
  roleEl.style.display = "none";
  revealBtn.style.display = "none";
  nextBtn.style.display = "none";

  votingPanel.classList.remove("hidden");
  voteTargets.innerHTML = "";
  myVoteEl.textContent = "";

  (players || []).forEach(p => {
    const btn = document.createElement("button");
    btn.className = "target";
    btn.textContent = p.name;
    btn.onclick = () => {
      socket.emit("castVote", { code: currentRoom, targetId: p.id });
      myVoteEl.textContent = `Tu voto: ${p.name}`;
    };
    voteTargets.appendChild(btn);
  });

  startCountdown(endsAt);
});
socket.on("voteAck", ({ targetId }) => { /* opcional */ });
socket.on("voteEnded", ({ results }) => {
  if (voteTimer) { clearInterval(voteTimer); voteTimer = null; }
  voteResults.classList.remove("hidden");
  voteResults.innerHTML = results.map(r => `${r.name}: ${r.count}`).join(" · ");

  // Mostrar nuevamente acciones del host (si quiere aplicar marcador)
  revealBtn.style.display = "inline-block";
  nextBtn.style.display = "inline-block";
});
socket.on("scoreUpdated", ({ scores, villagersWin }) => {
  renderScoreboard(scoreLobby, scores);
  renderScoreboard(scoreGame, scores);
  const toast = document.createElement("div");
  toast.className = "reveal";
  toast.textContent = villagersWin ? "Punto para ¡No Impostores!" : "Punto para ¡Impostores!";
  game.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
});

// Errores
socket.on("errorMsg", (m) => alert(m));

// Inicio
showLanding();
