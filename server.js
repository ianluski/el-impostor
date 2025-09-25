const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let rooms = {};

io.on("connection", (socket) => {
  console.log("Nuevo jugador conectado:", socket.id);

  socket.on("createRoom", ({ name, room, impostors, voteTime, pool }) => {
    if (!rooms[room]) {
      rooms[room] = {
        players: {},
        host: socket.id,
        impostors: impostors || 1,
        voteTime: voteTime || 30,
        pool: pool || [],
      };
      socket.join(room);
      rooms[room].players[socket.id] = { name, score: 0 };
      io.to(socket.id).emit("roomCreated", { room, host: true });
      io.to(room).emit("updatePlayers", rooms[room].players);
    }
  });

  socket.on("joinRoom", ({ name, room }) => {
    if (rooms[room]) {
      socket.join(room);
      rooms[room].players[socket.id] = { name, score: 0 };
      io.to(room).emit("updatePlayers", rooms[room].players);
    }
  });

  socket.on("startGame", (room) => {
    if (rooms[room]) {
      const players = Object.keys(rooms[room].players);
      let chosen = [...players];
      // Elegir impostores
      let impostors = [];
      for (let i = 0; i < rooms[room].impostors; i++) {
        let idx = Math.floor(Math.random() * chosen.length);
        impostors.push(chosen[idx]);
        chosen.splice(idx, 1);
      }
      // Palabra base
      let words = rooms[room].pool.length
        ? rooms[room].pool
        : ["Messi", "Maradona", "Riquelme", "Batistuta", "Di Stéfano"];
      let word = words[Math.floor(Math.random() * words.length)];

      players.forEach((p) => {
        let roleWord = impostors.includes(p) ? "IMPOSTOR" : word;
        io.to(p).emit("roleAssigned", { word: roleWord });
      });
    }
  });

  socket.on("disconnect", () => {
    for (let room in rooms) {
      if (rooms[room].players[socket.id]) {
        delete rooms[room].players[socket.id];
        io.to(room).emit("updatePlayers", rooms[room].players);
        if (rooms[room].host === socket.id) {
          const remaining = Object.keys(rooms[room].players);
          rooms[room].host = remaining[0] || null;
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
