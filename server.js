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

// ---- Estado ----
// rooms[code] = { ids: [socketId,...], names: { socketId: "Nombre"}, hostId: socketId }
const rooms = Object.create(null);
const jugadores = [
  "Messi","Cristiano","Maradona","Ronaldinho","Zidane","Iniesta","Xavi",
  "Batistuta","Ronaldo","Tevez","Haaland","Mbappé","Modric","Salah","Dybala"
];

const genCode = () => {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({length:4}, ()=> A[Math.floor(Math.random()*A.length)]).join("");
};

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name }) => {
    let code;
    do { code = genCode(); } while (rooms[code]);
    rooms[code] = { ids:[socket.id], names:{ [socket.id]: (name||"Jugador").slice(0,32) }, hostId: socket.id };
    socket.join(code);
    io.to(socket.id).emit("roomCreated", { code });
    io.to(code).emit("updatePlayers", rooms[code].ids.length);
  });

  socket.on("joinRoom", ({ code, name }) => {
    code = String(code||"").toUpperCase();
    if (!code) return;
    if (!rooms[code]) rooms[code] = { ids:[], names:{}, hostId: socket.id }; // si no existe, lo crea y te deja como host
    if (!rooms[code].ids.includes(socket.id)) rooms[code].ids.push(socket.id);
    rooms[code].names[socket.id] = (name||"Jugador").slice(0,32);
    socket.join(code);
    io.to(code).emit("updatePlayers", rooms[code].ids.length);
  });
socket.on("startGame", (code) => {
  const room = rooms[code];
  if (!room) return;
  const ids = room.ids || [];
  if (ids.length < 3) {
    // opcional: avisar al host que faltan jugadores
    io.to(socket.id).emit("updatePlayers", ids.length);
    return;
  }

  // 1) Elegimos al impostor
  const impostorIndex = Math.floor(Math.random() * ids.length);

  // 2) Elegimos UNA única palabra para todos los demás
  const secretWord = jugadores[Math.floor(Math.random() * jugadores.length)];

  // 3) Enviamos “IMPOSTOR” al impostor y la misma palabra al resto
  ids.forEach((id, i) => {
    const word = (i === impostorIndex) ? "IMPOSTOR" : secretWord;
    io.to(id).emit("role", word);
  });
});
  socket.on("disconnect", () => {
    for (const code of Object.keys(rooms)) {
      const room = rooms[code];
      room.ids = room.ids.filter(id => id !== socket.id);
      delete room.names[socket.id];
      if (!room.ids.length) { delete rooms[code]; continue; }
      if (room.hostId === socket.id) room.hostId = room.ids[0]; // reasigna host simple
      io.to(code).emit("updatePlayers", room.ids.length);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => console.log("Servidor escuchando en", PORT));
