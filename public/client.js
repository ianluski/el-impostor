const socket = io();

let playerName = "";
let roomCode = "";
let isHost = false;
let mode = null; // 'create' | 'join'
let selectedTarget = null;
let voteInterval = null;

// Secciones
const landing = document.getElementById("landing");
const home = document.getElementById("home");
const game = document.getElementById("game");
const voting = document.getElementById("voting");
const result = document.getElementById("result");

// UI lobby
const nameInput = document.getElementById("name");
const roomInput = document.getElementById("room");
const copyRoomBtn = document.getElementById("copyRoom");
const impostorCount = document.getElementById("impostorCount");
const voteSeconds = document.getElementById("voteSeconds");
const customList = document.getElementById("customList");
const applySettings = document.getElementById("applySettings");
const playersList = document.getElementById("playersList");
const statusEl = document.getElementById("status");

// UI juego
const hostBadge = document.getElementById("hostBadge");
const wordDisplay = document.getElementById("wordDisplay");
const btnStartVote = document.getElementById("btnStartVote");

// UI votación
const voteOptions = document.getElementById("voteOptions");
const voteTimer = document.getElementById("voteTimer");
const confirmVoteBtn = document.getElementById("confirmVoteBtn");

// UI resultado
const resultText = document.getElementById("resultText");
const nextRoundHostBtn = document.getElementById("nextRoundHostBtn");

/* ---------- Navegación inicial ---------- */
document.getElementById("goCreate").onclick = () => {
  mode = "create";
  landing.classList.add("hidden");
  home.classList.remove("hidden");

  // crear: código lo da el server -> readonly y copiar visible
  roomInput.value = "";
  roomInput.placeholder = "Código de sala";
  roomInput.readOnly = true;
  copyRoomBtn.style.display = "inline-flex";
};
document.getElementById("goJoin").onclick = () => {
  mode = "join";
  landing.classList.add("hidden");
  home.classList.remove("hidden");

  // unirse: editable y sin copiar
  roomInput.value = "";
  roomInput.placeholder = "Código de sala (ej: ABCD)";
  roomInput.readOnly = false;
  copyRoomBtn.style.display = "none";
  roomInput.focus();
};

/* ---------- Acciones lobby ---------- */
copyRoomBtn.onclick = () => {
  if (!roomInput.value) return;
  navigator.clipboard.writeText(roomInput.value);
  alert("Código copiado: " + roomInput.value);
};

document.getElementById("createBtn").onclick = () => {
  if (mode !== "create") return alert("Elegí 'Crear sala'.");
  playerName = (nameInput.value || "").trim();
  if (!playerName) return alert("Ingresa tu nombre");
  socket.emit("createRoom", playerName);
};

document.getElementById("joinBtn").onclick = () => {
  if (mode !== "join") return alert("Elegí 'Unirse a sala'.");
  playerName = (nameInput.value || "").trim();
  if (!playerName) return alert("Ingresa tu nombre");
  const code = (roomInput.value || "").trim().toUpperCase();
  if (code.length < 4) return alert("Código inválido");
  roomCode = code;
  socket.emit("joinRoom", { playerName, roomCode });
};

// Guardar ajustes (solo host puede editar, pero todos ven los valores)
applySettings.onclick = () => {
  if (!isHost) return alert("Solo el host puede cambiar la configuración.");
  socket.emit("saveSettings", {
    code: roomCode,
    impostors: impostorCount.value,
    voteSeconds: voteSeconds.value,
    customList: customList.value
  });
};

// Iniciar ronda
document.getElementById("startBtn").onclick = () => {
  if (!isHost) return alert("Solo el host puede iniciar.");
  // por si el host olvidó aplicar, lo enviamos igual
  socket.emit("saveSettings", {
    code: roomCode,
    impostors: impostorCount.value,
    voteSeconds: voteSeconds.value,
    customList: customList.value
  });
  socket.emit("startRound", { code: roomCode });
};

/* ---------- Juego ---------- */
btnStartVote.onclick = () => {
  if (!isHost) return alert("Solo el host puede iniciar la votación.");
  socket.emit("startVote", { code: roomCode });
};
document.getElementById("exitBtn").onclick = () => location.reload();

/* ---------- Votación ---------- */
confirmVoteBtn.onclick = () => {
  if (!selectedTarget) return;
  socket.emit("castVote", { code: roomCode, targetId: selectedTarget });
  confirmVoteBtn.disabled = true;
  confirmVoteBtn.textContent = "Voto enviado";
};

/* ---------- Resultado ---------- */
nextRoundHostBtn.onclick = () => {
  socket.emit("startRound", { code: roomCode });
  result.classList.add("hidden");
  game.classList.remove("hidden");
  nextRoundHostBtn.classList.add("hidden");
};

/* ---------- Eventos del servidor ---------- */
socket.on("roomCreated", ({ code, isHost: hostFlag, settings }) => {
  roomCode = code; isHost = hostFlag;
  roomInput.value = code; roomInput.readOnly = true; copyRoomBtn.style.display = "inline-flex";
  hydrateSettings(settings);
});

socket.on("roomJoined", ({ code, isHost: hostFlag, settings }) => {
  roomCode = code; isHost = hostFlag;
  hydrateSettings(settings);
});

socket.on("settingsApplied", (settings) => {
  hydrateSettings(settings);
});

socket.on("playersUpdate", (names) => {
  playersList.innerHTML = names.map(n => `<li>${n}</li>`).join("");
  statusEl.textContent = `Jugadores en sala: ${names.length}`;
});

socket.on("role", ({ word, hostName }) => {
  home.classList.add("hidden");
  result.classList.add("hidden");
  voting.classList.add("hidden");
  game.classList.remove("hidden");

  wordDisplay.textContent = word;
  hostBadge.textContent = `Host: ${hostName}`;
  btnStartVote.disabled = !isHost;
});

socket.on("voteStarted", ({ players, duration, endsAt }) => {
  game.classList.add("hidden");
  result.classList.add("hidden");
  voting.classList.remove("hidden");

  // Construir opciones
  voteOptions.innerHTML = "";
  selectedTarget = null;
  confirmVoteBtn.disabled = true;
  confirmVoteBtn.textContent = "Votar";

  players.forEach(p => {
    const b = document.createElement("button");
    b.textContent = p.name;
    b.onclick = () => {
      selectedTarget = p.id;
      document.querySelectorAll("#voteOptions button").forEach(x => x.classList.remove("selected"));
      b.classList.add("selected");
      confirmVoteBtn.disabled = false;
    };
    voteOptions.appendChild(b);
  });

  // Timer
  if (voteInterval) clearInterval(voteInterval);
  const tick = () => {
    const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    voteTimer.textContent = left + "s";
  };
  tick();
  voteInterval = setInterval(tick, 250);
});

socket.on("voteResult", ({ message, impostorFound }) => {
  if (voteInterval) { clearInterval(voteInterval); voteInterval = null; }

  voting.classList.add("hidden");
  result.classList.remove("hidden");
  resultText.textContent = message;

  if (isHost && impostorFound) {
    nextRoundHostBtn.classList.remove("hidden");
  } else {
    // los demás vuelven solos al juego
    setTimeout(() => {
      result.classList.add("hidden");
      game.classList.remove("hidden");
      nextRoundHostBtn.classList.add("hidden");
    }, 2500);
  }
});

/* ---------- helpers ---------- */
function hydrateSettings({ impostors, voteSeconds: secs }) {
  impostorCount.value = String(impostors || 1);
  voteSeconds.value = String(secs || 30);

  // habilitar/inhabilitar controles según rol
  const disabled = !isHost;
  impostorCount.disabled = disabled;
  voteSeconds.disabled = disabled;
  customList.disabled = disabled;
  applySettings.disabled = disabled;
}
