const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PUBLIC_DIR = path.join(__dirname, "public");

// Sirve /public y asegura "/" -> index.html
app.use(express.static(PUBLIC_DIR));
app.get("/", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));

// endpoint de salud para pruebas
app.get("/health", (_req, res) => res.type("text").send("ok"));

// --- lógica mínima del juego ---
const jugadores = [
  "Messi","Cristiano","Maradona","Ronaldinho","Zidane","Iniesta","Xavi",
  "Batistuta","Ronaldo","Tevez","Haaland","Mbappé","Modric","Salah","Dybala"
];
const rooms = {}; // { code: [socketId,...] }

io.on("connection", (socket) => {
  socket.on("joinRoom", (code) => {
    if (!code) return;
    if (!rooms[code]) rooms[code] = [];
    if (!rooms[code].includes(socket.id)) rooms[code].push(socket.id);
    socket.join(code);
    io.to(code).emit("updatePlayers", rooms[code].length);
  });

  socket.on("startGame", (code) => {
    const ids = rooms[code] || [];
    if (!ids.length) return;
    const impostorIndex = Math.floor(Math.random() * ids.length);
    ids.forEach((id, i) => {
      const word = i === impostorIndex ? "IMPOSTOR" : jugadores[Math.floor(Math.random()*jugadores.length)];
      io.to(id).emit("role", word);
    });
  });

  socket.on("disconnect", () => {
    for (const code of Object.keys(rooms)) {
      rooms[code] = rooms[code].filter(id => id !== socket.id);
      io.to(code).emit("updatePlayers", rooms[code].length);
      if (rooms[code].length === 0) delete rooms[code];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor escuchando en", PORT);
});
