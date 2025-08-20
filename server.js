// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 1) Ruta ABSOLUTA a /public
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// 2) Fallback: si alguien pide "/", devolvé index.html explícitamente
app.get("/", (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

/* --- tu lógica de juego igual que antes --- */

const jugadores = ["Messi","Cristiano","Maradona","Ronaldinho","Zidane","Iniesta","Xavi","Batistuta","Ronaldo","Tevez"];
let salas = {};

io.on("connection", (socket) => {
  socket.on("joinRoom", (room) => {
    if (!salas[room]) salas[room] = [];
    salas[room].push(socket.id);
    socket.join(room);
    io.to(room).emit("updatePlayers", salas[room].length);
  });

  socket.on("startGame", (room) => {
    const players = salas[room];
    if (!players) return;
    const impostorIndex = Math.floor(Math.random() * players.length);
    players.forEach((id, i) => {
      const word = (i === impostorIndex) ? "IMPOSTOR" : jugadores[Math.floor(Math.random() * jugadores.length)];
      io.to(id).emit("role", word);
    });
  });

  socket.on("disconnect", () => {
    for (const room in salas) {
      salas[room] = salas[room].filter((id) => id !== socket.id);
      io.to(room).emit("updatePlayers", salas[room].length);
    }
  });
});

const PORT = process.env.PORT || 3000;
// MUY IMPORTANTE: 0.0.0.0 en Render
server.listen(PORT, "0.0.0.0", () => console.log(`Servidor en ${PORT}`));
