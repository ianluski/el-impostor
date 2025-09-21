// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));
app.get("/", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));
app.get("/health", (_req, res) => res.type("text").send("ok"));

// ======= BASE de jugadores por defecto =======
const PLAYERS = [
  "Lionel Messi","Diego Maradona","Pelé","Johan Cruyff","Franz Beckenbauer",
  "Michel Platini","Zinedine Zidane","Ronaldinho","Ronaldo Nazário","Romário",
  "Garrincha","George Best","Ferenc Puskás","Lev Yashin","Paolo Maldini",
  "Roberto Baggio","Marco van Basten","Lothar Matthäus","Andrés Iniesta","Xavi Hernández",
  "Sergio Busquets","Carles Puyol","Iker Casillas","Xabi Alonso","Raúl",
  "David Villa","Sergio Ramos","Gerard Piqué","Thierry Henry","Patrick Vieira",
  "Dennis Bergkamp","Eric Cantona","Ryan Giggs","Paul Scholes","Wayne Rooney",
  "Steven Gerrard","Frank Lampard","John Terry","Didier Drogba","Petr Čech",
  "Cristiano Ronaldo","Luis Figo","Eusébio","Kaká","Rivaldo",
  "Cafú","Roberto Carlos","Neymar","Dani Alves","Thiago Silva",
  "Marcelo","Casemiro","Kylian Mbappé","Antoine Griezmann","Karim Benzema",
  "N'Golo Kanté","Robert Lewandowski","Luka Modrić","Toni Kroos","Manuel Neuer",
  "Arjen Robben","Wesley Sneijder","Ruud van Nistelrooy","Clarence Seedorf","Edwin van der Sar",
  "Zlatan Ibrahimović","Gheorghe Hagi","Andriy Shevchenko","Francesco Totti","Alessandro Del Piero",
  "Andrea Pirlo","Daniele De Rossi","Gennaro Gattuso","Fabio Cannavaro","Giorgio Chiellini",
  "Alessandro Nesta","Franco Baresi","Gianluigi Buffon","Mohamed Salah","Sadio Mané",
  "Samuel Eto'o","Yaya Touré","Jay-Jay Okocha","George Weah","Achraf Hakimi",
  "Virgil van Dijk","Frenkie de Jong","Matthijs de Ligt","Robin van Persie","Harry Kane",
  "Alan Shearer","Gary Lineker","Michael Owen","Rio Ferdinand","David Beckham",
  "Gareth Bale","Ian Rush","Luis Suárez","Edinson Cavani","Diego Forlán",
  "Enzo Francescoli","Álvaro Recoba","Radamel Falcao","James Rodríguez","Carlos Valderrama",
  "Freddy Rincón","Juan Cuadrado","René Higuita","Teófilo Cubillas","Paolo Guerrero",
  "Claudio Pizarro","Alexis Sánchez","Arturo Vidal","Iván Zamorano","Marcelo Salas",
  "Hugo Sánchez","Rafa Márquez","Cuauhtémoc Blanco",
  "Juan Román Riquelme","Gabriel Batistuta","Hernán Crespo","Ariel Ortega","Pablo Aimar",
  "Javier Saviola","Ubaldo Fillol","Daniel Passarella","Oscar Ruggeri","Fernando Redondo",
  "Diego Simeone","Juan Sebastián Verón","Esteban Cambiasso","Walter Samuel","Javier Mascherano",
  "Ángel Di María","Gonzalo Higuaín","Sergio Agüero","Carlos Tevez","Lautaro Martínez",
  "Julián Álvarez","Enzo Fernández","Alexis Mac Allister","Rodrigo De Paul","Emiliano Martínez",
  "Nicolás Otamendi","Paulo Dybala","Giovani Lo Celso","Mario Kempes","Sergio Goycochea"
];

// ======= Estado en memoria =======
// rooms[code] = {
//   ids:[socketId,...],
//   names:{ socketId: "Nombre" },
//   hostId: socketId,
//   last:{ impostorIds:string[], word:string, round:number } | null,
//   round: number,
//   pool: string[],
//   impostors: number,
//   voteDuration: number (s),
//   voting: { active, endsAt, votes:{voterId:targetId}, options:[ids], to? },
//   scores: { [socketId]: number },
//   lastVoteResult: { counts:{[targetId]:n}, topIds:string[] } | null
// }
const rooms = Object.create(null);

// Código de sala (4 chars, sin O/0 ni I/1)
const genCode = () => {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join("");
};

// Helpers para estado visible en lobby
function buildRoomState(room) {
  const names = room.ids.map(id => room.names[id]).filter(Boolean);
  const scores = room.ids.map(id => ({ name: room.names[id], points: room.scores[id] || 0 }));
  return {
    count: room.ids.length,
    names,
    hostName: room.names[room.hostId] || "Host",
    poolCount: (room.pool && room.pool.length) ? room.pool.length : 0,
    impostors: room.impostors || 1,
    voteDuration: room.voteDuration || 60,
    scores
  };
}
function broadcastRoomState(code) {
  const room = rooms[code];
  if (!room) return;
  io.to(code).emit("roomState", buildRoomState(room));
}

// Enviar el rol vigente a un socket (para sync de ronda actual)
function sendCurrentRole(socket, room) {
  if (!room || !room.last) return;
  const { impostorIds, word, round } = room.last;
  const isImpostor = Array.isArray(impostorIds) && impostorIds.includes(socket.id);
  const myWord = isImpostor ? "IMPOSTOR" : word;
  socket.emit("role", { word: myWord, round, hostName: room.names[room.hostId] || "Host" });
}

// ---- Votación: cierre y conteo
function endVoteInternal(code) {
  const room = rooms[code];
  if (!room || !room.voting || !room.voting.active) return;

  const { votes, options } = room.voting;
  const counts = {};
  (options || []).forEach(id => counts[id] = 0);
  for (const voterId of Object.keys(votes)) {
    const target = votes[voterId];
    if (counts.hasOwnProperty(target)) counts[target] += 1;
  }
  let top = 0;
  let topIds = [];
  for (const id of Object.keys(counts)) {
    if (counts[id] > top) {
      top = counts[id];
      topIds = [id];
    } else if (counts[id] === top && top > 0) {
      topIds.push(id);
    }
  }
  room.lastVoteResult = { counts, topIds };
  room.voting.active = false;
  if (room.voting.to) {
    clearTimeout(room.voting.to);
    room.voting.to = null;
  }

  const results = Object.keys(counts).map(id => ({
    id, name: room.names[id] || "?", count: counts[id]
  })).sort((a,b)=>b.count-a.count || a.name.localeCompare(b.name));

  io.to(code).emit("voteEnded", { results, topIds });
}

// ======= Socket.IO =======
io.on("connection", (socket) => {
  // ---------- Crear sala ----------
  socket.on("createRoom", ({ name }) => {
    let code;
    do { code = genCode(); } while (rooms[code]);

    rooms[code] = {
      ids: [socket.id],
      names: { [socket.id]: (name || "Jugador").slice(0, 32) },
      hostId: socket.id,
      last: null,
      round: 0,
      pool: [],
      impostors: 1,
      voteDuration: 60,
      voting: { active:false, endsAt:null, votes:{}, options:[], to:null },
      scores: { [socket.id]: 0 },
      lastVoteResult: null
    };

    socket.join(code);
    socket.emit("roomCreated", { code });
    socket.emit("roomInfo", {
      code,
      isHost: true,
      hostName: rooms[code].names[rooms[code].hostId],
      players: 1
    });
    broadcastRoomState(code);
  });

  // ---------- Unirse a sala ----------
  socket.on("joinRoom", ({ code, name }) => {
    code = String(code || "").toUpperCase();
    if (!code) return;

    if (!rooms[code]) {
      rooms[code] = {
        ids: [],
        names: {},
        hostId: socket.id,
        last: null,
        round: 0,
        pool: [],
        impostors: 1,
        voteDuration: 60,
        voting: { active:false, endsAt:null, votes:{}, options:[], to:null },
        scores: {},
        lastVoteResult: null
      };
    }

    const room = rooms[code];
    if (!room.ids.includes(socket.id)) room.ids.push(socket.id);
    room.names[socket.id] = (name || "Jugador").slice(0, 32);
    if (room.scores[socket.id] == null) room.scores[socket.id] = 0;

    socket.join(code);

    const isHost = room.hostId === socket.id;
    socket.emit("roomInfo", {
      code,
      isHost,
      hostName: room.names[room.hostId],
      players: room.ids.length
    });
    broadcastRoomState(code);

    // Sincronizar si ya hay una ronda corriendo
    sendCurrentRole(socket, room);
  });

  // ---------- Guardar lista personalizada (SOLO HOST) ----------
  socket.on("setPool", ({ code, customPool }) => {
    const room = rooms[code];
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit("notAllowed", "Solo el host puede editar la lista personalizada.");
      return;
    }
    const pool = Array.isArray(customPool)
      ? customPool.map(s => String(s).trim()).filter(Boolean)
      : [];
    room.pool = pool;
    socket.emit("poolSaved", { count: room.pool.length });
    broadcastRoomState(code);
  });

  // ---------- Cantidad de impostores (SOLO HOST) ----------
  socket.on("setImpostors", ({ code, impostors }) => {
    const room = rooms[code];
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit("notAllowed", "Solo el host puede cambiar la cantidad de impostores.");
      return;
    }
    let n = parseInt(impostors, 10);
    if (!Number.isFinite(n)) n = 1;
    n = Math.max(1, Math.min(5, n));
    room.impostors = n;
    io.to(code).emit("impostorsUpdated", { impostors: room.impostors });
    broadcastRoomState(code);
  });

  // ---------- Duración de votación (SOLO HOST) ----------
  socket.on("setVoteDuration", ({ code, seconds }) => {
    const room = rooms[code];
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit("notAllowed", "Solo el host puede cambiar el temporizador de votación.");
      return;
    }
    let s = parseInt(seconds, 10);
    if (!Number.isFinite(s)) s = 60;
    s = Math.max(10, Math.min(300, s)); // entre 10s y 5min
    room.voteDuration = s;
    io.to(code).emit("voteDurationUpdated", { seconds: s });
    broadcastRoomState(code);
  });

  // ---------- Iniciar/siguiente ronda (SOLO HOST) ----------
  socket.on("startGame", ({ code, customPool }) => {
    const room = rooms[code];
    if (!room) return;

    if (room.hostId !== socket.id) {
      socket.emit("notAllowed", "Solo el host puede iniciar la partida.");
      return;
    }

    // limpiar ids zombies
    room.ids = room.ids.filter(id => io.sockets.sockets.has(id));

    const ids = room.ids || [];
    if (ids.length < 3) {
      socket.emit("notAllowed", "Necesitás al menos 3 jugadores.");
      return;
    }

    // Cancelar votación previa si quedó activa
    if (room.voting && room.voting.active) {
      room.voting.active = false;
      if (room.voting.to) clearTimeout(room.voting.to);
      room.voting.to = null;
    }
    room.lastVoteResult = null;

    // actualizar pool si se manda
    if (Array.isArray(customPool) && customPool.length) {
      const cleaned = customPool.map(s => String(s).trim()).filter(Boolean);
      room.pool = cleaned;
    }
    const poolToUse = (room.pool && room.pool.length) ? room.pool : PLAYERS;

    // impostores válidos
    const desired = room.impostors || 1;
    const maxAllowed = Math.min(5, Math.max(1, ids.length - 1));
    const impostorQty = Math.max(1, Math.min(desired, maxAllowed));

    // ronda
    room.round = (room.round || 0) + 1;

    // sorteo impostores
    const order = [...ids.keys()];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const impostorIndexes = new Set(order.slice(0, impostorQty));
    const impostorIds = [...impostorIndexes].map(i => ids[i]);

    const secretWord = poolToUse[Math.floor(Math.random() * poolToUse.length)];
    room.last = { impostorIds, word: secretWord, round: room.round };

    // anuncio de ronda
    io.to(code).emit("roundStarted", { round: room.round });

    // envío de roles (incluye hostName)
    ids.forEach((id, i) => {
      const word = impostorIndexes.has(i) ? "IMPOSTOR" : secretWord;
      io.to(id).emit("role", { word, round: room.round, hostName: room.names[room.hostId] || "Host" });
    });

    broadcastRoomState(code);
  });

  // ---------- Iniciar votación (SOLO HOST) ----------
  socket.on("startVote", ({ code }) => {
    const room = rooms[code];
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit("notAllowed", "Solo el host puede iniciar la votación.");
      return;
    }
    if (!room.last) {
      socket.emit("notAllowed", "Primero debés iniciar una ronda.");
      return;
    }
    // limpiar ids zombies
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

    const players = room.ids.map(id => ({ id, name: room.names[id] || "?" }));
    io.to(code).emit("voteStarted", { seconds, endsAt, players });
  });

  // ---------- Votar (todos) ----------
  socket.on("castVote", ({ code, targetId }) => {
    const room = rooms[code];
    if (!room || !room.voting || !room.voting.active) return;

    // debe ser jugador de la sala
    if (!room.ids.includes(socket.id)) return;

    // objetivo válido
    if (!room.voting.options.includes(targetId)) return;

    room.voting.votes[socket.id] = targetId;
    io.to(socket.id).emit("voteAck", { targetId });
  });

  // ---------- Cerrar votación (SOLO HOST, opcional, server igual cierra solo) ----------
  socket.on("endVote", ({ code }) => {
    const room = rooms[code];
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit("notAllowed", "Solo el host puede cerrar la votación.");
      return;
    }
    endVoteInternal(code);
  });

  // ---------- Aplicar marcador (SOLO HOST) ----------
  socket.on("finalizeRound", ({ code }) => {
    const room = rooms[code];
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit("notAllowed", "Solo el host puede aplicar el marcador.");
      return;
    }
    if (!room.last || !room.lastVoteResult) {
      socket.emit("notAllowed", "Falta resultado de votación o de ronda.");
      return;
    }

    const { impostorIds } = room.last;
    const { topIds } = room.lastVoteResult;

    const setImpostors = new Set(impostorIds || []);
    let villagersWin = false;
    for (const id of topIds) {
      if (setImpostors.has(id)) { villagersWin = true; break; }
    }

    // sumar puntos
    if (villagersWin) {
      // +1 a todos los no-impostores presentes
      for (const id of room.ids) {
        if (!setImpostors.has(id)) room.scores[id] = (room.scores[id] || 0) + 1;
      }
    } else {
      // +1 a todos los impostores presentes
      for (const id of room.ids) {
        if (setImpostors.has(id)) room.scores[id] = (room.scores[id] || 0) + 1;
      }
    }

    const table = room.ids.map(id => ({ name: room.names[id] || "?", points: room.scores[id] || 0 }));
    io.to(code).emit("scoreUpdated", { scores: table, villagersWin });
    broadcastRoomState(code);
  });

  // ---------- Revelar (SOLO HOST) ----------
  socket.on("reveal", (code) => {
    const room = rooms[code];
    if (!room || !room.last) return;
    if (room.hostId !== socket.id) {
      socket.emit("notAllowed", "Solo el host puede revelar.");
      return;
    }

    const { impostorIds, word } = room.last;
    const impostorsNames = (impostorIds || []).map(id => room.names[id] || "Desconocido");
    io.to(code).emit("revealResult", { impostorsNames, word });
  });

  // ---------- Sync bajo demanda ----------
  socket.on("syncMe", (code) => {
    const room = rooms[code];
    if (!room) return;
    if (!room.ids.includes(socket.id)) {
      room.ids.push(socket.id);
      room.names[socket.id] ??= "Jugador";
      if (room.scores[socket.id] == null) room.scores[socket.id] = 0;
      socket.join(code);
      broadcastRoomState(code);
    }
    sendCurrentRole(socket, room);
  });

  // ---------- Salir ----------
  socket.on("leaveRoom", (code) => {
    const room = rooms[code];
    if (!room) return;

    room.ids = room.ids.filter(id => id !== socket.id);
    delete room.names[socket.id];
    delete room.scores[socket.id];

    if (!room.ids.length) {
      if (room.voting && room.voting.to) clearTimeout(room.voting.to);
      delete rooms[code];
      return;
    }

    if (room.hostId === socket.id) {
      room.hostId = room.ids[0]; // reasignación simple
    }
    broadcastRoomState(code);
  });

  // ---------- Desconexión ----------
  socket.on("disconnect", () => {
    for (const code of Object.keys(rooms)) {
      const room = rooms[code];
      if (!room) continue;

      const before = room.ids.length;
      room.ids = room.ids.filter(id => id !== socket.id);
      delete room.names[socket.id];
      delete room.scores[socket.id];

      if (!room.ids.length) {
        if (room.voting && room.voting.to) clearTimeout(room.voting.to);
        delete rooms[code];
        continue;
      }

      if (room.hostId === socket.id) {
        room.hostId = room.ids[0];
      }

      if (room.ids.length !== before) {
        broadcastRoomState(code);
      }
    }
  });
});

// ======= Arranque =======
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor escuchando en", PORT);
});
