// client.js
const socket = io();

let currentRoom = null;
let myName = '';
let isHost = false;
let lastRound = 0;
let homeMode = null; // 'create' | 'join'

const $ = (s)=>document.querySelector(s);

// ===== THEME =====
const rootEl = document.documentElement;
const themeToggleBtn = document.getElementById('themeToggle');
function applyTheme(theme){
  rootEl.setAttribute('data-theme', theme);
  try { localStorage.setItem('theme', theme); } catch(_) {}
}
(function initTheme(){
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch(_) {}
  if (!saved) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    saved = prefersDark ? 'dark' : 'light';
  }
  applyTheme(saved);
})();
if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const next = rootEl.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
}

// ===== PANTALLAS =====
const landing = $('#landing');
const home = $('#home');
const game = $('#game');

// LANDING
const goCreateBtn = $('#goCreateBtn');
const goJoinBtn   = $('#goJoinBtn');

// HOME
const nameInput    = $('#name');
const rowCreate    = $('#rowCreate');
const rowJoin      = $('#rowJoin');
const createBtn    = $('#createBtn');
const joinBtn      = $('#joinBtn');
const startBtn     = $('#startBtn');
const roomInput    = $('#room');
const poolTextarea = $('#pool');
const roomCodeTag  = $('#roomCodeTag');
const statusEl     = $('#status');
const hostBadge    = $('#hostBadge');
const playersList  = $('#playersList');
const impostorsSelect = $('#impostors');
const voteSecondsInput = $('#voteSeconds');
const scoreLobby   = $('#scoreLobby');

// GAME
const roleEl     = $('#role');
const revealBox  = $('#revealBox');
const backBtn    = $('#backBtn');
const revealBtn  = $('#revealBtn');
const nextBtn    = $('#nextBtn');
const scoreGame  = $('#scoreGame');
const currentHostGame = $('#currentHostGame');

// VOTING
const votingPanel = $('#votingPanel');
const voteCountdown = $('#voteCountdown');
const voteTargets = $('#voteTargets');
const myVoteEl = $('#myVote');
const startVoteBtn = $('#startVoteBtn');
const endVoteBtn = $('#endVoteBtn');
const voteResults = $('#voteResults');
const applyScoreBtn = $('#applyScoreBtn');

// ====== UI helpers ======
function showLanding(){
  landing.classList.remove('hidden');
  home.classList.add('hidden');
  game.classList.add('hidden');
  currentRoom = null;
  lastRound = 0;
  isHost = false;
  homeMode = null;
  statusEl.textContent = 'Jugadores en sala: 0';
  playersList.innerHTML = '';
  roomCodeTag.style.display = 'none';
  roomInput.value = '';
  hostBadge.textContent = '';
  scoreLobby.innerHTML = '';
  scoreGame.innerHTML = '';
  currentHostGame.textContent = 'Host: —';
  resetVotingUI();
}

function showHome(mode){
  homeMode = mode;
  landing.classList.add('hidden');
  game.classList.add('hidden');
  home.classList.remove('hidden');

  rowCreate.classList.toggle('hidden', mode !== 'create');
  rowJoin.classList.toggle('hidden', mode !== 'join');

  updateHostUI();
}

function showGame(){
  landing.classList.add('hidden');
  home.classList.add('hidden');
  game.classList.remove('hidden');
}

function showRoomCode(code){
  roomCodeTag.style.display = 'inline-block';
  roomCodeTag.textContent = `Sala: ${code}`;
}

function updateHostUI() {
  startBtn.disabled  = !isHost;
  revealBtn.disabled = !isHost;
  nextBtn.disabled   = !isHost;
  startVoteBtn.disabled = !isHost;
  endVoteBtn.disabled = !isHost;
  applyScoreBtn.disabled = !isHost;

  poolTextarea.disabled = !isHost;
  impostorsSelect.disabled = !isHost;
  voteSecondsInput.disabled = !isHost;

  hostBadge.textContent = isHost
    ? 'Sos el host'
    : (currentRoom ? '(El host maneja la partida)' : '');
}

// ===== VOTING =====
let voteTimer = null;
function resetVotingUI(){
  votingPanel.classList.add('hidden');
  voteResults.classList.add('hidden');
  voteResults.textContent = '';
  voteTargets.innerHTML = '';
  myVoteEl.textContent = '';
  voteCountdown.textContent = '—';
  if (voteTimer) { clearInterval(voteTimer); voteTimer = null; }
}
function startCountdown(endsAt){
  if (voteTimer) clearInterval(voteTimer);
  function tick(){
    const left = Math.max(0, Math.floor((endsAt - Date.now())/1000));
    voteCountdown.textContent = `${left}s`;
    if (left <= 0 && voteTimer) {
      clearInterval(voteTimer);
      voteTimer = null;
    }
  }
  tick();
  voteTimer = setInterval(tick, 1000);
}
function renderScoreboard(container, table){
  container.innerHTML = '';
  (table || []).forEach(({name, points}) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div class="score-name">${name}</div><div class="score-points">${points}</div>`;
    container.appendChild(row);
  });
}

// ====== LANDING ======
goCreateBtn.onclick = () => showHome('create');
goJoinBtn.onclick   = () => showHome('join');

// ====== HOME ======
createBtn.onclick = () => {
  myName = (nameInput.value || '').trim() || 'Jugador';
  socket.emit('createRoom', { name: myName });
};

joinBtn.onclick = () => {
  const code = (roomInput.value || '').trim().toUpperCase();
  myName = (nameInput.value || '').trim() || 'Jugador';
  if (!code) return alert('Ingresá un código de sala');
  currentRoom = code;
  socket.emit('joinRoom', { code, name: myName });
  showRoomCode(code);
};

startBtn.onclick = () => {
  if (!currentRoom) return alert('Primero creá o unite a una sala');
  if (!isHost) return alert('Solo el host puede iniciar la partida.');
  const customPool = (poolTextarea.value || '').split('\n').map(s=>s.trim()).filter(Boolean);
  socket.emit('setPool', { code: currentRoom, customPool });
  socket.emit('setImpostors', { code: currentRoom, impostors: impostorsSelect.value });
  socket.emit('setVoteDuration', { code: currentRoom, seconds: voteSecondsInput.value });
  socket.emit('startGame', { code: currentRoom });
};

// ====== GAME / Voting ======
startVoteBtn.onclick = () => {
  if (!isHost) return;
  socket.emit('startVote', { code: currentRoom });
};
endVoteBtn.onclick = () => {
  if (!isHost) return;
  socket.emit('endVote', { code: currentRoom });
};
applyScoreBtn.onclick = () => {
  if (!isHost) return;
  socket.emit('finalizeRound', { code: currentRoom });
};

revealBtn.onclick = () => {
  socket.emit('reveal', currentRoom);
};
nextBtn.onclick = () => {
  if (!isHost) return;
  socket.emit('startGame', { code: currentRoom });
};
backBtn.onclick = () => {
  socket.emit('leaveRoom', currentRoom);
  showLanding();
};

// ====== SOCKET EVENTS ======
socket.on('roomCreated', ({ code }) => {
  currentRoom = code;
  showRoomCode(code);
  isHost = true;
  updateHostUI();
});

socket.on('roomInfo', ({ code, isHost: hostFlag, hostName }) => {
  isHost = !!hostFlag;
  updateHostUI();
  hostBadge.textContent = isHost ? 'Sos el host' : `Host: ${hostName}`;
  currentHostGame.textContent = `Host: ${hostName}`;
});

socket.on('roomState', ({ hostName, scores }) => {
  if (scores) {
    renderScoreboard(scoreLobby, scores);
    renderScoreboard(scoreGame, scores);
  }
  currentHostGame.textContent = `Host: ${hostName}`;
});

socket.on('roundStarted', () => resetVotingUI());

socket.on('role', ({ word, hostName }) => {
  roleEl.textContent = word;
  currentHostGame.textContent = `Host: ${hostName}`;
  showGame();
});

socket.on('revealResult', ({ impostorsNames, word }) => {
  revealBox.textContent = `Impostores: ${impostorsNames.join(', ')} — Palabra: ${word}`;
  revealBox.classList.remove('hidden');
});

socket.on('voteStarted', ({ endsAt, players }) => {
  votingPanel.classList.remove('hidden');
  voteTargets.innerHTML = '';
  players.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'target';
    btn.textContent = p.name;
    btn.onclick = () => {
      socket.emit('castVote', { code: currentRoom, targetId: p.id });
      myVoteEl.textContent = `Tu voto: ${p.name}`;
    };
    voteTargets.appendChild(btn);
  });
  startCountdown(endsAt);
});

socket.on('voteEnded', ({ results }) => {
  if (voteTimer) clearInterval(voteTimer);
  voteResults.classList.remove('hidden');
  voteResults.innerHTML = results.map(r => `${r.name}: ${r.count}`).join('<br>');
});

socket.on('scoreUpdated', ({ scores }) => {
  renderScoreboard(scoreLobby, scores);
  renderScoreboard(scoreGame, scores);
});
