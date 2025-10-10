const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));

const DEFAULT_POOL = [
  // 🐐 Leyendas del fútbol mundial
  "Pelé","Diego Maradona","Lionel Messi","Zinedine Zidane","Ronaldinho",
  "Ronaldo Nazário","Cristiano Ronaldo","Kaká","Franz Beckenbauer","Johan Cruyff",
  "Paolo Maldini","George Best","Eric Cantona","Zico","Michel Platini",
  
  // 🇦🇷 Leyendas argentinas
  "Alfredo Di Stéfano","Mario Kempes","Daniel Passarella","Osvaldo Ardiles","Ricardo Bochini",
  "Gabriel Batistuta","Claudio Caniggia","Ariel Ortega","Fernando Redondo","Juan Román Riquelme",
  "Pablo Aimar","Hernán Crespo","Javier Zanetti","Carlos Tévez","Diego Simeone",
  "Walter Samuel","Roberto Ayala","Esteban Cambiasso","Martín Palermo","Maxi Rodríguez",

  // 🇦🇷 Campeones del mundo 2022
  "Lionel Messi","Ángel Di María","Emiliano Martínez","Rodrigo De Paul","Leandro Paredes",
  "Enzo Fernández","Alexis Mac Allister","Julián Álvarez","Nahuel Molina","Cristian Romero",
  "Nicolás Otamendi","Lautaro Martínez","Marcos Acuña","Gonzalo Montiel","Lisandro Martínez",
  "Paulo Dybala","Exequiel Palacios","Germán Pezzella","Guido Rodríguez","Thiago Almada",

  // 🇦🇷 Jugadores destacados en la Liga Profesional
  "Edinson Cavani","Sergio Romero","Ezequiel Barco","Miguel Borja","Facundo Colidio",
  "Cristian Lema","Equi Fernández","Luca Langoni","Martín Demichelis","Juanfer Quintero",
  "Gastón Togni","Alan Varela","Cristian Medina","Milton Casco","Enzo Pérez",
  "Nicolás De La Cruz","Ignacio Fernández","Agustín Palavecino","Ayrton Costa","Juan Ignacio Nardoni",
  "Leandro Godoy","Benjamín Domínguez","Santiago Solari","Matías Rojas","Gabriel Arias",

  // 🌍 Estrellas internacionales actuales
  "Kylian Mbappé","Erling Haaland","Kevin De Bruyne","Luka Modrić","Robert Lewandowski",
  "Karim Benzema","Vinícius Júnior","Jude Bellingham","Antoine Griezmann","Neymar",
  "Harry Kane","Mohamed Salah","Sadio Mané","Marcus Rashford","Jack Grealish",
  "Declan Rice","Phil Foden","Gavi","Pedri","Frenkie de Jong",
  "Joshua Kimmich","Jamal Musiala","Raphaël Varane","Achraf Hakimi","Bruno Fernandes",
  "Riyad Mahrez","Son Heung-min","Victor Osimhen","Federico Chiesa","Nicolò Barella"
];

const rooms = {}; // code -> room state

function genCode() {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join("");
}

io.on("connection", (socket) => {

  // Crear sala
  socket.on("createRoom", (name) => {
    let code;
    do code = genCode(); while (rooms[code]);

    rooms[code] = {
      host: socket.id,
      ids: [socket.id],
      names: { [socket.id]: name || "Jugador" },

      // ajustes
      impostors: 1,
      voteSeconds: 30,
      pool: [], // si está vacío se usa DEFAULT_POOL

      // estado de ronda
      round: 0,
      currentWord: null,
      impostorIds: [],
      eliminated: [],

      // votación
      voting: null // {active, votes:{voterId:targetId}, endsAt, timer}
    };

    socket.join(code);
    socket.emit("roomCreated", { code, isHost: true, settings: getSettings(rooms[code]) });
    io.to(code).emit("playersUpdate", Object.values(rooms[code].names));
  });

  // Unirse a sala
  socket.on("joinRoom", ({ playerName, roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.ids.push(socket.id);
    room.names[socket.id] = playerName || "Jugador";
    socket.join(roomCode);

    socket.emit("roomJoined", {
      code: roomCode,
      isHost: room.host === socket.id,
      settings: getSettings(room)
    });
    io.to(roomCode).emit("playersUpdate", Object.values(room.names));
  });

  // Guardar ajustes (solo host)
  socket.on("saveSettings", ({ code, impostors, voteSeconds, customList }) => {
    const room = rooms[code];
    if (!room || room.host !== socket.id) return;

    // sanitizar
    const imp = Math.max(1, Math.min(5, parseInt(impostors || 1, 10)));
    const secs = Math.max(10, Math.min(300, parseInt(voteSeconds || 30, 10)));

    room.impostors = imp;
    room.voteSeconds = secs;

    if (typeof customList === "string") {
      const parts = customList
        .split(/[\n,]/g)
        .map(t => t.trim())
        .filter(Boolean);
      room.pool = Array.from(new Set(parts)); // únicos
    }

    io.to(code).emit("settingsApplied", getSettings(room));
  });

  // Iniciar ronda (alias startGame)
  socket.on("startGame", (code) => startRound(socket, code));
  socket.on("startRound", ({ code }) => startRound(socket, code));

  function startRound(sock, code) {
    const room = rooms[code];
    if (!room || sock.id !== room.host) return;

    const activeIds = room.ids.filter(id => !room.eliminated.includes(id));
    const maxImpostors = Math.max(1, Math.min(room.impostors, Math.max(1, activeIds.length - 1)));
    room.eliminated = []; // nueva ronda, todos activos

    const pool = room.pool.length ? room.pool : DEFAULT_POOL;
    const word = pool[Math.floor(Math.random() * pool.length)];

    const shuffled = [...activeIds].sort(() => Math.random() - 0.5);
    room.impostorIds = shuffled.slice(0, maxImpostors);
    room.currentWord = word;
    room.round++;

    const hostName = room.names[room.host] || "Host";

    room.ids.forEach((id) => {
      const roleWord = room.impostorIds.includes(id) ? "IMPOSTOR" : word;
      io.to(id).emit("role", { word: roleWord, hostName });
    });
  }

  // Iniciar votación (solo host)
  socket.on("startVote", ({ code }) => {
    const room = rooms[code];
    if (!room || socket.id !== room.host) return;

    // construir lista de candidatos activos
    const players = room.ids
      .filter(id => !room.eliminated.includes(id))
      .map(id => ({ id, name: room.names[id] }));

    room.voting = {
      active: true,
      votes: {},
      endsAt: Date.now() + room.voteSeconds * 1000,
      timer: null
    };

    // temporizador de corte
    room.voting.timer = setTimeout(() => endVote(code), room.voteSeconds * 1000);

    io.to(code).emit("voteStarted", {
      players,
      duration: room.voteSeconds,
      endsAt: room.voting.endsAt
    });
  });

  // Recibir voto
  socket.on("castVote", ({ code, targetId }) => {
    const room = rooms[code];
    if (!room || !room.voting?.active) return;
    if (room.eliminated.includes(targetId)) return;

    const activeVoters = room.ids.filter(id => !room.eliminated.includes(id));
    // registrar
    room.voting.votes[socket.id] = targetId;

    // ¿votaron todos los activos?
    if (Object.keys(room.voting.votes).length >= activeVoters.length) {
      if (room.voting.timer) clearTimeout(room.voting.timer);
      endVote(code);
    }
  });

  // Cierra votación (host o timeout)
  socket.on("endVote", (code) => {
    const room = rooms[code];
    if (!room || socket.id !== room.host) return;
    if (room.voting?.timer) clearTimeout(room.voting.timer);
    endVote(code);
  });

  function endVote(code) {
    const room = rooms[code];
    if (!room || !room.voting?.active) return;
    room.voting.active = false;

    // conteo
    const counts = {};
    for (const target of Object.values(room.voting.votes)) {
      counts[target] = (counts[target] || 0) + 1;
    }

    let max = 0;
    let top = [];
    for (const [id, c] of Object.entries(counts)) {
      if (c > max) { max = c; top = [id]; }
      else if (c === max) top.push(id);
    }

    let message = "";
    let impostorFound = false;

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
        if (!room.eliminated.includes(votedId)) room.eliminated.push(votedId);
        message = `${votedName} no era el impostor y fue eliminado. La ronda continúa.`;
      }
    }

    // condición de victoria automática: quedan 2 jugadores vivos
    const vivos = room.ids.filter(id => !room.eliminated.includes(id));
    if (vivos.length <= 2 && !impostorFound) {
      const nombresImp = room.impostorIds.map(id => room.names[id]);
      const label = nombresImp.length > 1 ? "Ganaron" : "Ganó";
      message = `${label} ${nombresImp.join(", ")}.`;
      impostorFound = true;
      room.currentWord = null;
      room.impostorIds = [];
    }

    io.to(code).emit("voteResult", { message, impostorFound });
  }

  // Desconexión
  socket.on("disconnect", () => {
    for (const [code, room] of Object.entries(rooms)) {
      if (!room.ids.includes(socket.id)) continue;

      room.ids = room.ids.filter(id => id !== socket.id);
      delete room.names[socket.id];
      room.eliminated = room.eliminated.filter(id => id !== socket.id);
      room.impostorIds = room.impostorIds.filter(id => id !== socket.id);

      if (room.host === socket.id) room.host = room.ids[0] || null;

      io.to(code).emit("playersUpdate", Object.values(room.names));
    }
  });
});

// helper
function getSettings(room) {
  return {
    impostors: room.impostors,
    voteSeconds: room.voteSeconds,
    customCount: room.pool.length
  };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => console.log("Servidor en puerto", PORT));
