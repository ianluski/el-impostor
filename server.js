const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PUBLIC_DIR = path.join(__dirname, "public");

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
  "N'Golo Kanté","Hugo Lloris","Robert Lewandowski","Luka Modrić","Toni Kroos",
  "Miroslav Klose","Bastian Schweinsteiger","Philipp Lahm","Manuel Neuer","Thomas Müller",
  "Arjen Robben","Wesley Sneijder","Ruud van Nistelrooy","Clarence Seedorf","Edwin van der Sar",
  "Zlatan Ibrahimović","Gheorghe Hagi","Andriy Shevchenko","Francesco Totti","Alessandro Del Piero",
  "Andrea Pirlo","Daniele De Rossi","Gennaro Gattuso","Fabio Cannavaro","Giorgio Chiellini",
  "Alessandro Nesta","Franco Baresi","Gianluigi Buffon","Mohamed Salah","Sadio Mané",
  "Didier Drogba","Samuel Eto'o","Yaya Touré","Jay-Jay Okocha","Roger Milla",
  "George Weah","Achraf Hakimi","Virgil van Dijk","Frenkie de Jong","Matthijs de Ligt",
  "Robin van Persie","Harry Kane","Alan Shearer","Gary Lineker","Michael Owen",
  "Rio Ferdinand","David Beckham","Gareth Bale","Ian Rush","Luis Suárez",
  "Edinson Cavani","Diego Forlán","Enzo Francescoli","Álvaro Recoba","Radamel Falcao",
  "James Rodríguez","Carlos Valderrama","Freddy Rincón","Juan Cuadrado","René Higuita",
  "Teófilo Cubillas","Paolo Guerrero","Claudio Pizarro","Alexis Sánchez","Arturo Vidal",
  "Iván Zamorano","Marcelo Salas","Hugo Sánchez","Rafa Márquez","Cuauhtémoc Blanco",
  "Juan Román Riquelme","Gabriel Batistuta","Hernán Crespo","Ariel Ortega","Pablo Aimar",
  "Javier Saviola","Ubaldo Fillol","Daniel Passarella","Oscar Ruggeri","Fernando Redondo",
  "Diego Simeone","Juan Sebastián Verón","Esteban Cambiasso","Walter Samuel","Javier Mascherano",
  "Ángel Di María","Gonzalo Higuaín","Sergio Agüero","Carlos Tevez","Lautaro Martínez",
  "Julián Álvarez","Enzo Fernández","Alexis Mac Allister","Rodrigo De Paul","Emiliano Martínez",
  "Nicolás Otamendi","Paulo Dybala","Giovani Lo Celso","Mario Kempes","Sergio Goycochea"
];

// ======= Archivos estáticos + health =======
app.use(express.static(PUBLIC_DIR));
app.get("/", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));
app.get("/health", (_req, res) => res.type("text").send("ok"));

// ======= Estado en memoria =======
// rooms[code] = { ids:[socketId,...], names:{ socketId: "Nombre" }, hostId, last:{impostorId, word} }
const rooms = Object.create(null);

// Código de sala (4 chars, sin confundir O/0 ni I/1)
const genCode = () => {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join("");
};

// Info de sala a un usuario (saber si es host)
function sendRoomInfo(socket, code) {
  const room = rooms[code];
  if (!room) return;
  const isHost = room.hostId === socket.id;
  const hostName = room.names[room.hostId] || "Host";
  socket.emit("roomInfo", {
    code,
    isHost,
    hostName,
    players: room.ids.length
  });
}

// ======= Socket.IO =======
io.on("connection", (socket) => {

  // Crear sala (host)
  socket.on("createRoom", ({ name }) => {
    let code;
    do { code = genCode(); } while (rooms[code]);

    rooms[code] = {
      ids: [socket.id],
      names: { [socket.id]: (name || "Jugador").slice(0, 32) },
      hostId: socket.id,
      last: null
    };

    socket.join(code);
    socket.emit("roomCreated", { code });
    sendRoomInfo(socket, code);
    io.to(code).emit("updatePlayers", rooms[code].ids.length);
    io.to(code).emit("hostUpdate", { hostName: rooms[code].names[rooms[code].hostId] });
  });

  // Unirse a sala (si no existe, se crea y quien entra queda como host)
  socket.on("joinRoom", ({ code, name }) => {
    code = String(code || "").toUpperCase();
    if (!code) return;

    if (!rooms[code]) {
      rooms[code] = {
        ids: [],
        names: {},
        hostId: socket.id,
        last: null
      };
    }

    const room = rooms[code];
    if (!room.ids.includes(socket.id)) room.ids.push(socket.id);
    room.names[socket.id] = (name || "Jugador").slice(0, 32);

    socket.join(code);
    sendRoomInfo(socket, code);
    io.to(code).emit("updatePlayers", room.ids.length);
    io.to(code).emit("hostUpdate", { hostName: room.names[room.hostId] });
  });

  // Iniciar juego (SOLO HOST)
  // Recibe { code, customPool } donde customPool es una lista opcional de palabras cargadas por el host
  socket.on("startGame", ({ code, customPool }) => {
    const room = rooms[code];
    if (!room) return;

    // Solo host
    if (room.hostId !== socket.id) {
      socket.emit("notAllowed", "Solo el host puede iniciar la partida.");
      return;
    }

    const ids = room.ids || [];
    if (ids.length < 3) {
      socket.emit("notAllowed", "Necesitás al menos 3 jugadores.");
      return;
    }

    // Tomamos la lista personalizada si existe; si no, usamos la base interna
    let pool = Array.isArray(customPool)
      ? customPool.map(s => String(s).trim()).filter(Boolean)
      : [];
    if (pool.length < 1) pool = PLAYERS;

    // Elegimos al impostor y UNA palabra para todos los demás
    const impostorIndex = Math.floor(Math.random() * ids.length);
    const secretWord = pool[Math.floor(Math.random() * pool.length)];

    // Guardamos última ronda para poder revelar
    room.last = { impostorId: ids[impostorIndex], word: secretWord };

    // Enviamos roles
    ids.forEach((id, i) => {
      const word = (i === impostorIndex) ? "IMPOSTOR" : secretWord;
      io.to(id).emit("role", word);
    });
  });

  // Revelar (SOLO HOST): envia nombre del impostor + palabra a todos
  socket.on("reveal", (code) => {
    const room = rooms[code];
    if (!room || !room.last) return;

    if (room.hostId !== socket.id) {
      socket.emit("notAllowed", "Solo el host puede revelar.");
      return;
    }

    const { impostorId, word } = room.last;
    const impostorName = room.names[impostorId] || "Desconocido";
    io.to(code).emit("revealResult", { impostorName, word });
  });

  // Salir de la sala
  socket.on("leaveRoom", (code) => {
    const room = rooms[code];
    if (!room) return;

    room.ids = room.ids.filter(id => id !== socket.id);
    delete room.names[socket.id];

    if (!room.ids.length) {
      delete rooms[code];
      return;
    }

    // si se va el host, reasignamos al primero
    if (room.hostId === socket.id) {
      room.hostId = room.ids[0];
      io.to(code).emit("hostUpdate", { hostName: room.names[room.hostId] });
    }

    io.to(code).emit("updatePlayers", room.ids.length);
  });

  // Desconexión (limpieza y posible reasignación de host)
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
        io.to(code).emit("hostUpdate", { hostName: room.names[room.hostId] });
      }

      if (room.ids.length !== before) {
        io.to(code).emit("updatePlayers", room.ids.length);
      }
    }
  });

});

// ======= Arranque =======
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor escuchando en", PORT);
});
