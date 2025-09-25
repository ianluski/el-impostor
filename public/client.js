const socket = io();

const landing = document.getElementById("landing");
const home = document.getElementById("home");
const game = document.getElementById("game");

const nameInput = document.getElementById("name");
const roomInput = document.getElementById("room");
const poolInput = document.getElementById("pool");
const impostorsInput = document.getElementById("impostors");
const voteSecondsInput = document.getElementById("voteSeconds");

const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");
const statusDiv = document.getElementById("status");
const playersList = document.getElementById("playersList");

const roleDiv = document.getElementById("role");
const revealBtn = document.getElementById("revealBtn");
const nextBtn = document.getElementById("nextBtn");
const backBtn = document.getElementById("backBtn");

document.getElementById("goCreateBtn").onclick = () => {
  landing.classList.add("hidden");
  home.classList.remove("hidden");
};

document.getElementById("goJoinBtn").onclick = () => {
  landing.classList.add("hidden");
  home.classList.remove("hidden");
};

createBtn.onclick = () => {
  socket.emit("createRoom", {
    name: nameInput.value,
    room: roomInput.value,
    impostors: parseInt(impostorsInput.value),
    voteTime: parseInt(voteSecondsInput.value),
    pool: poolInput.value
      .split("\n")
      .map((x) => x.trim())
      .filter((x) => x !== ""),
  });
};

joinBtn.onclick = () => {
  socket.emit("joinRoom", { name: nameInput.value, room: roomInput.value });
};

startBtn.onclick = () => {
  socket.emit("startGame", roomInput.value);
};

socket.on("roomCreated", ({ room, host }) => {
  console.log("Sala creada:", room, "Host:", host);
});

socket.on("updatePlayers", (players) => {
  playersList.innerHTML = "";
  Object.values(players).forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p.name;
    playersList.appendChild(li);
  });
  statusDiv.textContent = `Jugadores en sala: ${Object.keys(players).length}`;
});

socket.on("roleAssigned", ({ word }) => {
  home.classList.add("hidden");
  game.classList.remove("hidden");
  roleDiv.textContent = word;
});

revealBtn.onclick = () => {
  alert("Aquí se mostraría quién es el impostor (falta lógica).");
};

nextBtn.onclick = () => {
  alert("Pasar a la siguiente ronda (falta lógica).");
};

backBtn.onclick = () => {
  game.classList.add("hidden");
  landing.classList.remove("hidden");
};
