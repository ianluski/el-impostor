// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Static
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===== Base de palabras por defecto (futbolistas) =====
const DEFAULT_POOL = [
  "Lionel Messi","Diego Maradona","Juan Román Riquelme","Gabriel Batistuta","Mario Kempes",
  "Pelé","Zinedine Zidane","Ronaldinho","Ronaldo","Neymar","Kylian Mbappé","Cristiano Ronaldo",
  "Ángel Di María","Sergio Agüero","Hernán Crespo","Ariel Ortega","Pablo Aimar","Javier Mascherano",
  "Enzo Francescoli","Álvaro Recoba","Paolo Maldini","Andrea Pirlo","Francesco Totti","Alessandro Del Piero",
  "Xavi","Iniesta","Iker Casillas","Sergio Ramos","Karim Benzema","Antoine Griezmann","Robert Lewandowski",
  "Luka Modrić","Toni Kroos","Manuel Neuer","David Beckham","Wayne Rooney","Thierry Henry"
];

// ===== Estado de salas =====
// rooms[code] = {
//   ids: [socketId,...],               // jugadores
//   names: { socketId: "Nombre" },     // nombres
//   hostId: socketId,                  // host actual
//   pool: string[],                    // lista personalizada
//   impostors: number,                 // 1..5
//   voteDuration: number,              // seg (10..300)
//   scores: { [socketId]: number },    // marcador
//   round: number,                     // nro de ronda
//   last: { word:string, impostorIds:string[], round:number } | null,
//   voting: { active, endsAt, votes:{[voterId]:targetId}, options:string[], to?:Timeout } | null
// }
const rooms = Object.create(null);

// Genera código de 4 caracteres (sin confusiones O/0, I/1)
function genRoomCode() {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join("");
}

// Helpers
function buildRoomState(room) {
  return {
    hostName: room.names[room.hostId] || "Host",
    count: room.ids.length,
    names: room.ids.map(id => room.names[id]),
    impostors: room.impostors,
    voteDuration: room.voteDuration,
    scores: room.ids.map(id => ({ name: room.names[id], points: room.scores[id] || 0 }))
  };
}
function broadcastRoomState(code) {
  const room = rooms[code];
  if (!room) return;
  io.to(code).emit("roomState", buildRoomState(room));
}
function sendCurrentRole(socket, room) {
  if (!room || !room.last) return;
  const isImpostor = room.last.impostorIds.includes(socket.id);
  socket.emit("role", {
    word: isImpostor ? "IMPOSTOR" : room.last.word,
    hostName: room.names[room.hostId]
  });
}
function endVoteInternal(code) {
  const room = rooms[code];
  if (!room || !room.voting || !room.voting.active) return;

  const { votes, options } = room.voting;
  const counts = {};
  (options || []).forEach(id => (counts[id] = 0));
  for (const voterId of Object.keys(votes)) {
    const t = votes[voterId];
    if (counts[t] != null) counts[t] += 1;
  }
  let best = 0;
  let topIds = [];
  for (const id of Object.keys(counts)) {
    if (counts[id] > best) {
      best = counts[id];
      topIds = [id];
    } else if (counts[id] === best && best > 0) {
      topIds.push(id);
    }
  }
  room.voting.active = false;
  if (room.voting.to) clearTimeout(room.voting.to);
  room.voting.to = null;

  const results = Object.entries(counts)
    .map(([id, count]) => ({ id, name: room.names[id] || "?", count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  room.lastVoteResult = { counts, topIds };
  io.to(code).emit("voteEnded", { results, topIds });
}

io.on("connection", (socket) => {
  // Crear sala
  socket.on("createRoom", ({ name }) => {
    let code;
    do { code = genRoomCode(); } while (rooms[code]);

    rooms[code] = {
      ids: [socket.id],
      names: { [socket.id]: (name || "Jugador").slice(0, 32) },
      hostId: socket.id,
      pool: [],
      impostors: 1,
      voteDuration: 60,
      scores: { [socket.id]: 0 },
      round: 0,
      last: null,
      voting: null,
      lastVoteResult: null
    };
    socket.join(code);
    socket.emit("roomCreated", { code });
    socket.emit("roomInfo", { code, isHost: true, hostName: rooms[code].names[socket.id] });
    broadcastRoomState(code);
  });

  // Unirse a sala
  socket.on("joinRoom", ({ code, name }) => {
    code = String(code || "").toUpperCase();
    const room = rooms[code];
    if (!room) return socket.emit("errorMsg", "La sala no existe.");

    if (!room.ids.includes(socket.id)) room.ids.push(socket.id);
    room.names[socket.id] = (name || "Jugador").slice(0, 32);
    room.scores[socket.id] ??= 0;
    socket.join(code);

    socket.emit("roomInfo", { code, isHost: room.hostId === socket.id, hostName: room.names[room.hostId] });
    broadcastRoomState(code);
    sendCurrentRole(socket, room);
  });

  // Set lista personalizada (solo host)
  socket.on("setPool", ({ code, customPool }) => {
    const room = rooms[code];
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit("errorMsg", "Solo el host puede editar la lista.");
    const pool = Array.isArray(customPool) ? customPool.map(s => String(s).trim()).filter(Boolean) : [];
    room.pool = pool;
    broadcastRoomState(code);
  });

  // Set impostores (solo host)
  socket.on("setImpostors", ({ code, impostors }) => {
    const room = rooms[code];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    let n = parseInt(impostors, 10);
    if (!Number.isFinite(n)) n = 1;
    n = Math.max(1, Math.min(5, n));
    room.impostors = n;
    broadcastRoomState(code);
  });

  // Set duración votación (solo host)
  socket.on("setVoteDuration", ({ code, seconds }) => {
    const room = rooms[code];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    let s = parseInt(seconds, 10);
    if (!Number.isFinite(s)) s = 60;
    room.voteDuration = Math.max(10, Math.min(300, s));
    broadcastRoomState(code);
  });

  // Iniciar / siguiente ronda (solo host)
  socket.on("startGame", ({ code }) => {
    const room = rooms[code];
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit("errorMsg", "Solo el host puede iniciar.");

    // limpiar desconectados
    room.ids = room.ids.filter(id => io.sockets.sockets.has(id));
    if (room.ids.length < 3) return socket.emit("errorMsg", "Se necesitan al menos 3 jugadores.");

    // cerrar votación anterior si quedó activa
    if (room.voting?.active && room.voting.to) clearTimeout(room.voting.to);
    room.voting = null;
    room.lastVoteResult = null;

    // preparar palabra
    const pool = (room.pool && room.pool.length) ? room.pool : DEFAULT_POOL;
    const word = pool[Math.floor(Math.random() * pool.length)];

    // definir impostores
    const maxImp = Math.min(5, room.ids.length - 1);
    const impostorQty = Math.max(1, Math.min(room.impostors || 1, maxImp));
    const shuffled = [...room.ids].sort(() => Math.random() - 0.5);
    const impostorIds = shuffled.slice(0, impostorQty);

    room.round = (room.round || 0) + 1;
    room.last = { word, impostorIds, round: room.round };

    io.to(code).emit("roundStarted", { round: room.round });

    // enviar roles + hostName
    room.ids.forEach((id) => {
      const myWord = impostorIds.includes(id) ? "IMPOSTOR" : word;
      io.to(id).emit("role", { word: myWord, hostName: room.names[room.hostId] });
    });

    broadcastRoomState(code);
  });

  // Iniciar votación (solo host)
  socket.on("startVote", ({ code }) => {
    const room = rooms[code];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (!room.last) return;

    room.ids = room.ids.filter(id => io.sockets.sockets.has(id));
    const seconds = room.voteDuration || 60;
    const endsAt = Date.now() + seconds * 1000;

    room.voting = {
      active: true,
      endsAt,
      votes: {},
      options: [...room.ids],
      to: setTimeout(() => endVoteInternal(code), seconds * 1000)
    };

    const players = room.ids.map(id => ({ id, name: room.names[id] }));
    io.to(code).emit("voteStarted", { endsAt, players });
  });

  // Votar (todos)
  socket.on("castVote", ({ code, targetId }) => {
    const room = rooms[code];
    if (!room || !room.voting || !room.voting.active) return;
    if (!room.ids.includes(socket.id)) return;
    if (!room.voting.options.includes(targetId)) return;
    room.voting.votes[socket.id] = targetId;
    io.to(socket.id).emit("voteAck", { targetId });
  });

  // Cerrar votación (solo host)
  socket.on("endVote", (code) => {
    const room = rooms[code];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    endVoteInternal(code);
  });

  // Revelar resultado (solo host)
  socket.on("reveal", (code) => {
    const room = rooms[code];
    if (!room || !room.last) return;
    if (room.hostId !== socket.id) return;
    const names = room.last.impostorIds.map(id => room.names[id] || "?");
    io.to(code).emit("revealResult", { impostorsNames: names, word: room.last.word });
  });

  // Aplicar marcador (solo host)
  socket.on("finalizeRound", ({ code }) => {
    const room = rooms[code];
    if (!room || !room.last || !room.lastVoteResult) return;
    if (room.hostId !== socket.id) return;

    const impostorSet = new Set(room.last.impostorIds);
    const votedOut = room.lastVoteResult.topIds || [];
    const villagersWin = votedOut.some(id => impostorSet.has(id));

    if (villagersWin) {
      // +1 no-impostores
      room.ids.forEach(id => { if (!impostorSet.has(id)) room.scores[id] = (room.scores[id] || 0) + 1; });
    } else {
      // +1 impostores
      room.ids.forEach(id => { if (impostorSet.has(id)) room.scores[id] = (room.scores[id] || 0) + 1; });
    }

    io.to(code).emit("scoreUpdated", {
      scores: room.ids.map(id => ({ name: room.names[id], points: room.scores[id] || 0 })),
      villagersWin
    });
    broadcastRoomState(code);
  });

  // Salir
  socket.on("leaveRoom", (code) => {
    const room = rooms[code];
    if (!room) return;
    room.ids = room.ids.filter(id => id !== socket.id);
    delete room.names[socket.id];
    delete room.scores[socket.id];
    socket.leave(code);

    if (!room.ids.length) {
      if (room.voting?.to) clearTimeout(room.voting.to);
      delete rooms[code];
      return;
    }
    if (room.hostId === socket.id) room.hostId = room.ids[0];
    broadcastRoomState(code);
  });

  // Desconexión
  socket.on("disconnect", () => {
    for (const code of Object.keys(rooms)) {
      const room = rooms[code];
      if (!room) continue;
      if (!room.ids.includes(socket.id)) continue;

      room.ids = room.ids.filter(id => id !== socket.id);
      delete room.names[socket.id];
      delete room.scores[socket.id];

      if (!room.ids.length) {
        if (room.voting?.to) clearTimeout(room.voting.to);
        delete rooms[code];
        continue;
      }
      if (room.hostId === socket.id) room.hostId = room.ids[0];
      broadcastRoomState(code);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => console.log("Servidor en puerto", PORT));
