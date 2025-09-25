const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const PORT = process.env.PORT || 10000;

let rooms = {};

function buildRoomState(code) {
  const room = rooms[code];
  if (!room) return null;
  return {
    code,
    host: room.host,
    hostName: room.names[room.host] || "Desconocido",
    count: room.ids.length,
    names: room.ids.map(id => room.names[id]),
    scores: room.scores
  };
}

function finishVote(code) {
  const room = rooms[code];
  if (!room || !room.votes) return;
  const tally = {};
  Object.values(room.votes).forEach(id => {
    tally[id] = (tally[id] || 0) + 1;
  });
  const results = Object.entries(tally).map(([id, count]) => ({
    name: room.names[id] || "??",
    count
  }));
  io.to(code).emit("voteEnded", { results });
}

io.on("connection", (socket) => {
  // Crear sala
  socket.on("createRoom", ({ name }) => {
    const code = Math.random().toString(36).substr(2, 4).toUpperCase();
    rooms[code] = {
      host: socket.id,
      ids: [socket.id],
      names: { [socket.id]: name },
      scores: [],
      voteDuration: 30
    };
    socket.join(code);
    socket.emit("roomCreated", { code });
    io.to(code).emit("roomState", buildRoomState(code));
  });

  // Unirse a sala
  socket.on("joinRoom", ({ code, name }) => {
    const room = rooms[code];
    if (!room) return;
    room.ids.push(socket.id);
    room.names[socket.id] = name;
    socket.join(code);
    io.to(code).emit("roomState", buildRoomState(code));
  });

  // Salir de sala
  socket.on("leaveRoom", (code) => {
    const room = rooms[code];
    if (!room) return;
    room.ids = room.ids.filter(id => id !== socket.id);
    delete room.names[socket.id];
    socket.leave(code);
    if (room.host === socket.id && room.ids.length > 0) {
      room.host = room.ids[0];
    }
    io.to(code).emit("roomState", buildRoomState(code));
  });

  // Configuración
  socket.on("setPool", ({ code, customPool }) => {
    const room = rooms[code];
    if (!room || room.host !== socket.id) return;
    room.customPool = customPool;
  });
  socket.on("setImpostors", ({ code, impostors }) => {
    const room = rooms[code];
    if (!room || room.host !== socket.id) return;
    room.impostors = parseInt(impostors) || 1;
  });
  socket.on("setVoteDuration", ({ code, seconds }) => {
    const room = rooms[code];
    if (!room || room.host !== socket.id) return;
    room.voteDuration = parseInt(seconds) || 30;
  });

  // Iniciar partida
  socket.on("startGame", ({ code }) => {
    const room = rooms[code];
    if (!room || room.host !== socket.id) return;
    const players = room.ids;
    if (players.length < 3) return;

    const word = (room.customPool && room.customPool.length > 0)
      ? room.customPool[Math.floor(Math.random()*room.customPool.length)]
      : "Fútbol";

    const impostorIds = [];
    const impostorsCount = room.impostors || 1;
    while (impostorIds.length < impostorsCount) {
      const candidate = players[Math.floor(Math.random()*players.length)];
      if (!impostorIds.includes(candidate)) impostorIds.push(candidate);
    }

    players.forEach(id => {
      const myWord = impostorIds.includes(id) ? "IMPOSTOR" : word;
      io.to(id).emit("role", { word: myWord, hostName: room.names[room.host] });
    });

    room.lastWord = word;
    room.lastImpostors = impostorIds;
    io.to(code).emit("roundStarted");
  });

  // Votación
  socket.on("startVote", ({ code }) => {
    const room = rooms[code];
    if (!room || room.host !== socket.id) return;
    const duration = (room.voteDuration || 30) * 1000;
    const endsAt = Date.now() + duration;
    room.votes = {};
    const players = room.ids.map(id => ({ id, name: room.names[id] }));
    io.to(code).emit("voteStarted", { endsAt, players });
    setTimeout(() => { finishVote(code); }, duration+200);
  });

  socket.on("castVote", ({ code, targetId }) => {
    const room = rooms[code];
    if (!room) return;
    room.votes[socket.id] = targetId;
  });

  socket.on("endVote", (code) => {
    const room = rooms[code];
    if (!room || room.host !== socket.id) return;
    finishVote(code);
  });

  // Reveal
  socket.on("reveal", (code) => {
    const room = rooms[code];
    if (!room) return;
    io.to(code).emit("revealResult", {
      impostorsNames: room.lastImpostors.map(id => room.names[id]),
      word: room.lastWord
    });
  });

  // Puntuación (muy básica)
  socket.on("finalizeRound", ({ code }) => {
    const room = rooms[code];
    if (!room || room.host !== socket.id) return;
    room.scores = room.ids.map(id => ({
      name: room.names[id],
      points: Math.floor(Math.random()*10)
    }));
    io.to(code).emit("scoreUpdated", { scores: room.scores });
  });

  // Desconexión
  socket.on("disconnect", () => {
    Object.keys(rooms).forEach(code => {
      const room = rooms[code];
      if (!room) return;
      if (room.ids.includes(socket.id)) {
        room.ids = room.ids.filter(id => id !== socket.id);
        delete room.names[socket.id];
        if (room.host === socket.id && room.ids.length > 0) {
          room.host = room.ids[0];
        }
        io.to(code).emit("roomState", buildRoomState(code));
      }
    });
  });
});

server.listen(PORT, () => {
  console.log("Servidor en " + PORT);
});
