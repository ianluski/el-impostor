const socket = io();

let playerName = "";
let roomCode = "";
let isHost = false;
let mode = null; // 'create' | 'join'
let selectedTarget = null;
let voteInterval = null;

// ID persistente por dispositivo
let clientId = localStorage.getItem("clientId");
if (!clientId) {
  clientId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + "-" + Math.random());
  localStorage.setItem("clientId", clientId);
}

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

// Controles visibles/ocultos según modo
const settingsBox = document.getElementById("settings");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");

// UI juego
const hostBadge = document.getElementById("hostBadge");
const wordDisplay = document.getElementById("wordDisplay");
const btnStartVote = document.getElementById("btnStartVote");
const toggleHideBtn = document.getElementById("toggleHideBtn");

// Ocultar/mostrar palabra (solo local)
let hiddenWord = false;
let myCurrentWord = "—";
function renderWord() {
  wordDisplay.textContent = hiddenWord ? "••••••••" : myCurrentWord;
  toggleHideBtn.textContent = hiddenWord ? "🙈" : "👁";
}

toggleHideBtn.onclick = () => {
  hiddenWord = !hiddenWord;
  renderWord();
};

/* ---------- Helpers de UI ---------- */
function setModeCreate() {
  mode = "create";
  landing.classList.add("hidden");
  home.classList.remove("hidden");

  roomInput.value = "";
  roomInput.placeholder = "Código de sala";
  roomInput.readOnly = true;
  copyRoomBtn.style.display = "inline-flex";

  settingsBox.classList.remove("hidden");
  createBtn.classList.remove("hidden");
  startBtn.classList.remove("hidden");
  joinBtn.classList.add("hidden");
}

function setModeJoin() {
  mode = "join";
  landing.classList.add("hidden");
  home.classList.remove("hidden");

  roomInput.value = "";
  roomInput.placeholder = "Código de sala (ej: ABCD)";
  roomInput.readOnly = false;
  copyRoomBtn.style.display = "none";
  roomInput.focus();

  settingsBox.classList.add("hidden");
  createBtn.classList.add("hidden");
  startBtn.classList.add("hidden");
  joinBtn.classList.remove("hidden");
}

function hydrateSettings({ impostors, voteSeconds: secs }) {
  impostorCount.value = String(impostors || 1);
  voteSeconds.value = String(secs || 30);
  const disabled = !(isHost && mode === "create");
  impostorCount.disabled = disabled;
  voteSeconds.disabled = disabled;
  customList.disabled = disabled;
  applySettings.disabled = disabled;
}

/* ---------- Navegación inicial ---------- */
document.getElementById("goCreate").onclick = setModeCreate;
document.getElementById("goJoin").onclick = setModeJoin;

/* ---------- Acciones lobby ---------- */
copyRoomBtn.onclick = () => {
  if (!roomInput.value) return;
  navigator.clipboard.writeText(roomInput.value);
  alert("Código copiado: " + roomInput.value);
};

createBtn.onclick = () => {
  if (mode !== "create") return alert("Elegí 'Crear sala'.");
  playerName = (nameInput.value || "").trim();
  if (!playerName) return alert("Ingresa tu nombre");

  socket.emit("createRoom", { name: playerName, clientId });
  joinBtn.disabled = true;
};

joinBtn.onclick = () => {
  if (mode !== "join") return alert("Elegí 'Unirse a sala'.");
  if (joinBtn.disabled) return;
  playerName = (nameInput.value || "").trim();
  if (!playerName) return alert("Ingresa tu nombre");

  const code = (roomInput.value || "").trim().toUpperCase();
  if (code.length < 4) return alert("Código inválido");
  roomCode = code;

  socket.emit("joinRoom", { playerName, roomCode, clientId });
};

// Guardar ajustes (solo host+crear)
applySettings.onclick = () => {
  if (!(isHost && mode === "create")) return alert("Solo el host puede cambiar la configuración.");
  socket.emit("saveSettings", {
    code: roomCode,
    impostors: impostorCount.value,
    voteSeconds: voteSeconds.value,
    customList: customList.value
  });
};

// Iniciar ronda (solo host+crear)
startBtn.onclick = () => {
  if (!(isHost && mode === "create")) return alert("Solo el host puede iniciar.");
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

document.getElementById("exitBtn").onclick = () => {
  if (roomCode) socket.emit("leaveRoom", roomCode);
  location.reload();
};

/* ---------- Votación ---------- */
const voteOptions = document.getElementById("voteOptions");
const voteTimer = document.getElementById("voteTimer");
const confirmVoteBtn = document.getElementById("confirmVoteBtn");

confirmVoteBtn.onclick = () => {
  if (!selectedTarget) return;
  socket.emit("castVote", { code: roomCode, targetId: selectedTarget });
  confirmVoteBtn.disabled = true;
  confirmVoteBtn.textContent = "Voto enviado";
};

/* ---------- Resultado ---------- */
const resultText = document.getElementById("resultText");
const nextRoundHostBtn = document.getElementById("nextRoundHostBtn");

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
  joinBtn.disabled = true;
});

socket.on("roomJoined", ({ code, isHost: hostFlag, settings }) => {
  roomCode = code; isHost = hostFlag;
  hydrateSettings(settings);
  joinBtn.disabled = true;
  roomInput.readOnly = true;
});

socket.on("joinRejected", ({ reason }) => {
  if (reason === "DUPLICATE_CLIENT") {
    alert("Ya estás unido a esta sala desde este dispositivo.");
    joinBtn.disabled = true;
  }
});

// NUEVO: cuando el host expulsa a este jugador
socket.on("kicked", ({ reason }) => {
  alert("Fuiste expulsado de la sala.");
  if (roomCode) socket.emit("leaveRoom", roomCode);
  location.reload();
});

// playersUpdate ahora envía [{id, name}]
socket.on("playersUpdate", (players) => {
  statusEl.textContent = `Jugadores en sala: ${players.length}`;
  playersList.innerHTML = "";

  players.forEach(p => {
    const li = document.createElement("li");
    const nameSpan = document.createElement("span");
    nameSpan.textContent = p.name;
    li.appendChild(nameSpan);

    if (isHost && mode === "create") {
      const kick = document.createElement("button");
      kick.className = "kick-btn";
      kick.title = "Expulsar";
      kick.textContent = "✕";
      kick.onclick = () => {
        if (confirm(`¿Expulsar a ${p.name}?`)) {
          socket.emit("kickPlayer", { code: roomCode, targetId: p.id });
        }
      };
      li.appendChild(kick);
    }

    playersList.appendChild(li);
  });
});

socket.on("settingsApplied", (settings) => {
  hydrateSettings(settings);
});

socket.on("role", ({ word, hostName }) => {
  home.classList.add("hidden");
  result.classList.add("hidden");
  voting.classList.add("hidden");
  game.classList.remove("hidden");

  myCurrentWord = word;
  hiddenWord = false; // al empezar/recibir rol, mostrar por defecto
  renderWord();

  hostBadge.textContent = `Host: ${hostName}`;
  btnStartVote.disabled = !isHost;
});

socket.on("voteStarted", ({ players, duration, endsAt }) => {
  game.classList.add("hidden");
  result.classList.add("hidden");
  voting.classList.remove("hidden");

  // opciones
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
    setTimeout(() => {
      result.classList.add("hidden");
      game.classList.remove("hidden");
      nextRoundHostBtn.classList.add("hidden");
    }, 2500);
  }
});

/* ---------- Salida limpia ---------- */
window.addEventListener("beforeunload", () => {
  if (roomCode) socket.emit("leaveRoom", roomCode);
});
