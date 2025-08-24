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

// ======= BASE de jugadores (podés ampliarla sin tocar nada más) =======
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
//   pool: string[],        // lista personalizada del host (opcional)
//   impostors: number      // cantidad de impostores (1..5)
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
  return {
    count: room.ids.length,
    names,
    hostName: room.names[room.hostId] || "Host",
    poolCount: (room.pool && room.pool.length) ? room.pool.length : 0,
    impostors: room.impostors || 1
  };
}
function broadcastRoomState(code) {
  const room = rooms[code];
  if (!room) return;
  io.to(code).emit("roomState", buildRoomState(room));
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
      impostors: 1
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
        impostors: 1
      };
    }

    const room = rooms[code];
    if (!room.ids.includes(socket.id)) room.ids.push(socket.id);
    room.names[socket.id] = (name || "Jugador").slice(0, 32);

    socket.join(code);

    const isHost = room.hostId === socket.id;
    socket.emit("roomInfo", {
      code,
      isHost,
      hostName: room.names[room.hostId],
      players: room.ids.length
    });
    broadcastRoomState(code);
  });

  // ---------- Guardar/Actualizar lista personalizada (SOLO HOST) ----------
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
    room.pool = pool; // puede ser []; se usará PLAYERS como fallback
    socket.emit("poolSaved", { count: room.pool.length });
    broadcastRoomState(code);
  });

  // ---------- Selección de cantidad de impostores (SOLO HOST) ----------
  socket.on("setImpostors", ({ code, impostors }) => {
    const room = rooms[code];
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit("notAllowed", "Solo el host puede cambiar la cantidad de impostores.");
      return;
    }
    // normalizar a entero 1..5
    let n = parseInt(impostors, 10);
    if (!Number.isFinite(n)) n = 1;
    n = Math.max(1, Math.min(5, n));
    room.impostors = n;
    io.to(code).emit("impostorsUpdated", { impostors: room.impostors });
    broadcastRoomState(code);
  });

  // ---------- Iniciar/siguiente ronda (SOLO HOST) ----------
  // Recibe { code, customPool? } — si customPool viene, se guarda para la sala.
  socket.on("startGame", ({ code, customPool }) => {
    const room = rooms[code];
    if (!room) return;

    if (room.hostId !== socket.id) {
      socket.emit("notAllowed", "Solo el host puede iniciar la partida.");
      return;
    }

    const ids = room.ids || [];
    if (ids.length < 3) {
      socket.emit("notAllowed", "Necesitás al menos 3 jugadores.");
      return;
    }

    // Si el host manda una lista ahora, la guardamos para esta y próximas rondas
    if (Array.isArray(customPool) && customPool.length) {
      const cleaned = customPool.map(s => String(s).trim()).filter(Boolean);
      room.pool = cleaned;
    }

    // Pool efectiva a usar
    const poolToUse = (room.pool && room.pool.length) ? room.pool : PLAYERS;

    // Cantidad de impostores válida: 1..5 y < jugadores
    const desired = room.impostors || 1;
    const maxAllowed = Math.min(5, Math.max(1, ids.length - 1)); // no todos pueden ser impostores
    const impostorQty = Math.max(1, Math.min(desired, maxAllowed));

    // Sube número de ronda y sortea
    room.round = (room.round || 0) + 1;

    // Elegir impostorQty índices únicos
    const indices = [...ids.keys()];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const impostorIndexes = new Set(indices.slice(0, impostorQty));
    const impostorIds = [...impostorIndexes].map(i => ids[i]);

    const secretWord = poolToUse[Math.floor(Math.random() * poolToUse.length)];
    room.last = { impostorIds, word: secretWord, round: room.round };

    // Reparto con payload {word, round}
    ids.forEach((id, i) => {
      const word = impostorIndexes.has(i) ? "IMPOSTOR" : secretWord;
      io.to(id).emit("role", { word, round: room.round });
    });

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

  // ---------- Salir de sala ----------
  socket.on("leaveRoom", (code) => {
    const room = rooms[code];
    if (!room) return;

    room.ids = room.ids.filter(id => id !== socket.id);
    delete room.names[socket.id];

    if (!room.ids.length) {
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

      if (!room.ids.length) {
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
