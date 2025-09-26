const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname + "/public"));

let rooms = {};

io.on("connection", (socket) => {
  console.log("Nuevo jugador conectado");

  // Crear sala
  socket.on("createRoom", (playerName) => {
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    rooms[roomCode] = { host: socket.id, players: [playerName], words: ["Messi", "Maradona", "Pelé"] };
    socket.join(roomCode);
    socket.emit("roomCreated", roomCode);
    io.to(roomCode).emit("updatePlayers", rooms[roomCode].players);
  });

  // Unirse a sala
  socket.on("joinRoom", ({ playerName, roomCode }) => {
    if (!rooms[roomCode]) return;
    rooms[roomCode].players.push(playerName);
    socket.join(roomCode);
    io.to(roomCode).emit("updatePlayers", rooms[roomCode].players);
  });

  // Iniciar juego
  socket.on("startGame", (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;
    const word = room.words[Math.floor(Math.random() * room.words.length)];
    io.to(roomCode).emit("gameStarted", word);
  });
});

server.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});
