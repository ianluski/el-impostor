const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));

const DEFAULT_POOL = [
  "Lionel Messi","Diego Maradona","Juan Román Riquelme","Gabriel Batistuta","Mario Kempes",
  "Pelé","Zinedine Zidane","Ronaldinho","Ronaldo","Neymar","Kylian Mbappé","Cristiano Ronaldo",
  "Ángel Di María","Sergio Agüero","Hernán Crespo","Ariel Ortega","Pablo Aimar","Javier Mascherano",
  "Enzo Francescoli","Paolo Maldini","Andrea Pirlo","Francesco Totti","Xavi","Iniesta","Iker Casillas",
  "Sergio Ramos","Karim Benzema","Robert Lewandowski","Luka Modrić","Toni Kroos","Wayne Rooney",
  "Thierry Henry","David Beckham"
];

const rooms = {};

function genCode() {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join("");
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name }) => {
    let code;
    do { code = genCode(); } while (rooms[code]);

    rooms[code] = {
      ids: [socket.id],
      names: { [socket.id]: name || "Jugador" },
      host: socket.id,
      pool: [],
      impostors: 1,
      round: 0,
      currentWord: null,
      impostorIds: [],
      eliminated: [],
      voting: null
    };

    socket.join(code);
    socket.emit("roomCreated", { code, isHost: true });
    io.to(code).emit("playersUpdate", Object.values(rooms[code].names));
  });

  socket.on("joinRoom", ({ code, name }) => {
    const room = rooms[code];
    if (!room) return;
    room.ids.push(socket.id);
    room.names[socket.id] = name || "Jugador";
    socket.join(code);
    socket.emit("roomJoined", { code, isHost: room.host === socket.id });
    io.to(code).emit("playersUpdate", Object.values(room.names));
  });

  socket.on("startRound", ({ code }) => {
    const room = rooms[code];
    if (!room || socket.id !== room.host) return;

    room.eliminated = [];

    const pool = room.pool.length ? room.pool : DEFAULT_POOL;
    const word = pool[Math.floor(Math.random() * pool.length)];

    const shuffled = [...room.ids].sort(() => Math.random() - 0.5);
    room.impostorIds = shuffled.slice(0, room.impostors);
    room.currentWord = word;
    room.round++;

    room.ids.forEach((id) => {
      const roleWord = room.impostorIds.includes(id) ? "IMPOSTOR" : word;
      io.to(id).emit("role", { word: roleWord, hostName: room.names[room.host] });
    });
  });

  socket.on("startVote", ({ code }) => {
    const room = rooms[code];
    if (!room || socket.id !== room.host) return;

    room.voting = { active: true, votes: {} };
    const players = room.ids
      .filter(id => !room.eliminated.includes(id))
      .map(id => ({ id, name: room.names[id] }));

    io.to(code).emit("voteStarted", { players });
  });

  socket.on("castVote", ({ code, targetId }) => {
    const room = rooms[code];
    if (!room || !room.voting?.active) return;
    if (room.eliminated.includes(targetId)) return;

    room.voting.votes[socket.id] = targetId;

    if (Object.keys(room.voting.votes).length === room.ids.length - room.eliminated.length) {
      endVote(code);
    }
  });

  socket.on("endVote", (code) => {
    const room = rooms[code];
    if (!room || socket.id !== room.host) return;
    endVote(code);
  });

  function endVote(code) {
    const room = rooms[code];
    if (!room || !room.voting?.active) return;
    room.voting.active = false;

    const counts = {};
    for (const target of Object.values(room.voting.votes)) {
      counts[target] = (counts[target] || 0) + 1;
    }

    let max = 0;
    let top = [];
    for (const [id, c] of Object.entries(counts)) {
      if (c > max) {
        max = c;
        top = [id];
      } else if (c === max) {
        top.push(id);
      }
    }

    let message, impostorFound = false;

    if (top.length !== 1) {
      message = "No se encontró al impostor. La ronda continúa.";
    } else {
      const votedId = top[0];
      const votedName = room.names[votedId];
      if (room.impostorIds.includes(votedId)) {
        message = `${votedName} era el impostor. Ronda terminada.`;
        impostorFound = true;
        room.currentWord = null;
        room.impostorIds = [];
      } else {
        room.eliminated.push(votedId);
        message = `${votedName} no era el impostor y fue eliminado. La ronda continúa.`;
      }
    }

    const activos = room.ids.filter(id => !room.eliminated.includes(id));
    if (activos.length <= 2 && !impostorFound) {
      const impostorNombres = room.impostorIds.map(id => room.names[id]);
      const label = impostorNombres.length > 1 ? "Ganaron" : "Ganó";
      message = `${label} ${impostorNombres.join(", ")}.`;
      impostorFound = true;
      room.currentWord = null;
      room.impostorIds = [];
    }

    io.to(code).emit("voteResult", { message, impostorFound });
  }

  socket.on("disconnect", () => {
    for (const [code, room] of Object.entries(rooms)) {
      if (room.ids.includes(socket.id)) {
        room.ids = room.ids.filter((id) => id !== socket.id);
        delete room.names[socket.id];
        if (room.host === socket.id) {
          room.host = room.ids[0] || null;
        }
        io.to(code).emit("playersUpdate", Object.values(room.names));
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => console.log("Servidor en puerto", PORT));
