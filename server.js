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

const PLAYERS = ["Lionel Messi", "Diego Maradona", "Pelé", "Johan Cruyff", "Franz Beckenbauer", "Michel Platini", "Zinedine Zidane", "Ronaldinho", "Ronaldo Nazário", "Romário", "Garrincha", "George Best", "Ferenc Puskás", "Lev Yashin", "Paolo Maldini", "Roberto Baggio", "Marco van Basten", "Lothar Matthäus", "Andrés Iniesta", "Xavi Hernández", "Sergio Busquets", "Carles Puyol", "Iker Casillas", "Xabi Alonso", "Raúl", "Fernando Hierro", "David Villa", "Sergio Ramos", "Gerard Piqué", "Thierry Henry", "Patrick Vieira", "Dennis Bergkamp", "Eric Cantona", "Ryan Giggs", "Paul Scholes", "Wayne Rooney", "Steven Gerrard", "Frank Lampard", "John Terry", "Didier Drogba", "Petr Čech", "Ashley Cole", "Cristiano Ronaldo", "Luis Figo", "Eusébio", "Deco", "Paulo Futre", "Ricardo Carvalho", "Kaká", "Rivaldo", "Cafú", "Roberto Carlos", "Dida", "Emerson", "Neymar", "Dani Alves", "Thiago Silva", "Marcelo", "Casemiro", "Kylian Mbappé", "Antoine Griezmann", "Karim Benzema", "N'Golo Kanté", "Hugo Lloris", "Paul Pogba", "Robert Lewandowski", "Luka Modrić", "Ivan Rakitić", "Mario Mandžukić", "Toni Kroos", "Miroslav Klose", "Bastian Schweinsteiger", "Philipp Lahm", "Manuel Neuer", "Thomas Müller", "Mesut Özil", "Jerome Boateng", "Arjen Robben", "Wesley Sneijder", "Ruud van Nistelrooy", "Clarence Seedorf", "Edwin van der Sar", "Frank de Boer", "Ronald Koeman", "Jari Litmanen", "Henrik Larsson", "Zlatan Ibrahimović", "Hakan Şükür", "Gheorghe Hagi", "Andriy Shevchenko", "Oleh Blokhin", "Paolo Rossi", "Francesco Totti", "Alessandro Del Piero", "Andrea Pirlo", "Daniele De Rossi", "Gennaro Gattuso", "Fabio Cannavaro", "Giorgio Chiellini", "Leonardo Bonucci", "Alessandro Nesta", "Franco Baresi", "Gianni Rivera", "Dino Zoff", "Gianluigi Buffon", "Antonio Conte", "Riyad Mahrez", "Mohamed Salah", "Sadio Mané", "Didier Drogba", "Samuel Eto'o", "Yaya Touré", "Jay-Jay Okocha", "Nwankwo Kanu", "Roger Milla", "George Weah", "Kalidou Koulibaly", "Achraf Hakimi", "Virgil van Dijk", "Memphis Depay", "Frenkie de Jong", "Matthijs de Ligt", "Georginio Wijnaldum", "Robin van Persie", "Harry Kane", "Alan Shearer", "Gary Lineker", "Michael Owen", "Rio Ferdinand", "Sol Campbell", "David Beckham", "Joe Cole", "Gareth Bale", "Aaron Ramsey", "Ian Rush", "Robbie Fowler", "Luis Suárez", "Edinson Cavani", "Diego Forlán", "Enzo Francescoli", "Álvaro Recoba", "Obdulio Varela", "Radamel Falcao", "James Rodríguez", "Carlos Valderrama", "Freddy Rincón", "Juan Cuadrado", "René Higuita", "Teófilo Cubillas", "Paolo Guerrero", "Claudio Pizarro", "Nolberto Solano", "Jefferson Farfán", "Edison Flores", "Alexis Sánchez", "Arturo Vidal", "Gary Medel", "Iván Zamorano", "Marcelo Salas", "Jorge Valdivia", "Hugo Sánchez", "Jared Borgetti", "Rafa Márquez", "Cuauhtémoc Blanco", "Andrés Guardado", "Héctor Herrera", "Keylor Navas", "Bryan Ruiz", "Paolo Wanchope", "Clint Dempsey", "Landon Donovan", "Tim Howard", "Christian Pulisic", "Weston McKennie", "Giovanni Reyna", "Tyler Adams", "Jozy Altidore", "Michael Bradley", "Juan Román Riquelme", "Gabriel Batistuta", "Hernán Crespo", "Ariel Ortega", "Pablo Aimar", "Javier Saviola", "Marcelo Gallardo", "Enzo Francescoli", "Norberto Alonso", "Ubaldo Fillol", "Américo Gallego", "Daniel Passarella", "Oscar Ruggeri", "Jorge Burruchaga", "Jorge Valdano", "Ricardo Bochini", "Claudio Caniggia", "Fernando Redondo", "Diego Simeone", "Matías Almeyda", "Juan Sebastián Verón", "Esteban Cambiasso", "Walter Samuel", "Nicolás Burdisso", "Gabriel Heinze", "Pablo Zabaleta", "Javier Mascherano", "Ángel Di María", "Gonzalo Higuaín", "Sergio Agüero", "Carlos Tevez", "Ezequiel Lavezzi", "Ever Banega", "Lisandro López", "Diego Milito", "Mauro Icardi", "Lautaro Martínez", "Julián Álvarez", "Enzo Fernández", "Alexis Mac Allister", "Rodrigo De Paul", "Leandro Paredes", "Germán Pezzella", "Nicolás Otamendi", "Marcos Rojo", "Martín Demichelis", "Juan Foyth", "Emiliano Martínez", "Franco Armani", "Sergio Romero", "Willy Caballero", "Agustín Marchesín", "Nahuel Molina", "Gonzalo Montiel", "Marcos Acuña", "Nicolás Tagliafico", "Guido Rodríguez", "Exequiel Palacios", "Nicolás González", "Lucas Ocampos", "Paulo Dybala", "Giovani Lo Celso", "Erik Lamela", "Papu Gómez", "Lucas Biglia", "Mario Kempes", "Jorge Olguín", "Alberto Tarantini", "Osvaldo Ardiles", "Ricardo Giusti", "Pedro Troglio", "Sergio Goycochea", "Claudio Borghi", "Marcelo Bielsa", "César Menotti", "Alfio Basile", "José Pekerman", "Pep Guardiola", "Luis Enrique", "Hristo Stoichkov", "Sami Khedira", "Álvaro Arbeloa", "Pepe", "Jordi Alba", "Dani Carvajal", "Isco", "Marco Asensio", "João Félix", "Jan Oblak", "Diego Godín", "Koke", "Saúl Ñíguez", "Vinícius Júnior", "Rodrygo", "Eduardo Camavinga", "Jude Bellingham", "Erling Haaland", "Kevin De Bruyne", "Bernardo Silva", "Phil Foden", "Rúben Dias", "Rodri", "Ilkay Gündogan", "Jack Grealish", "John Stones", "Aymeric Laporte", "Ederson", "Bukayo Saka", "Martin Ødegaard", "Gabriel Jesus", "Gabriel Martinelli", "William Saliba", "Ben White", "Zico", "Sócrates", "Falcão", "Tostão", "Rivelino", "Careca", "Valderrama", "Higuita", "Asprilla", "Francescoli", "Zamora", "Meazza", "Zoff", "Rivera", "Mazzola", "Baggio", "Laudrup", "Schmeichel", "Neeskens", "Krol", "Boniek", "Lato", "Dalglish", "Souness", "Gascoigne", "Pearce", "Platt", "Waddle", "Hoddle", "Butragueño", "Michel", "Sanchís", "Zubizarreta", "Julen Guerrero", "Abidal", "Makelele", "Desailly", "Petit", "Trezeguet", "Anelka", "Pires", "Campbell", "Lehmann", "Kolo Touré", "Nedvěd", "Šmicer", "Berbatov", "Prosinečki", "Boban", "Šuker", "Hagi", "Mutu", "Chivu", "Popescu", "Lionel Messi *", "Diego Maradona *", "Pelé *", "Johan Cruyff *", "Franz Beckenbauer *", "Michel Platini *", "Zinedine Zidane *", "Ronaldinho *", "Ronaldo Nazário *", "Romário *", "Garrincha *", "George Best *", "Ferenc Puskás *", "Lev Yashin *", "Paolo Maldini *", "Roberto Baggio *", "Marco van Basten *", "Lothar Matthäus *", "Andrés Iniesta *", "Xavi Hernández *", "Sergio Busquets *", "Carles Puyol *", "Iker Casillas *", "Xabi Alonso *", "Raúl *", "Fernando Hierro *", "David Villa *", "Sergio Ramos *", "Gerard Piqué *", "Thierry Henry *", "Patrick Vieira *", "Dennis Bergkamp *", "Eric Cantona *", "Ryan Giggs *", "Paul Scholes *", "Wayne Rooney *", "Steven Gerrard *", "Frank Lampard *", "John Terry *", "Didier Drogba *", "Petr Čech *", "Ashley Cole *", "Cristiano Ronaldo *", "Luis Figo *", "Eusébio *", "Deco *", "Paulo Futre *", "Ricardo Carvalho *", "Kaká *", "Rivaldo *", "Cafú *", "Roberto Carlos *", "Dida *", "Emerson *", "Neymar *", "Dani Alves *", "Thiago Silva *", "Marcelo *", "Casemiro *", "Kylian Mbappé *", "Antoine Griezmann *", "Karim Benzema *", "N'Golo Kanté *", "Hugo Lloris *", "Paul Pogba *", "Robert Lewandowski *", "Luka Modrić *", "Ivan Rakitić *", "Mario Mandžukić *", "Toni Kroos *", "Miroslav Klose *", "Bastian Schweinsteiger *", "Philipp Lahm *", "Manuel Neuer *", "Thomas Müller *", "Mesut Özil *", "Jerome Boateng *", "Arjen Robben *", "Wesley Sneijder *", "Ruud van Nistelrooy *", "Clarence Seedorf *", "Edwin van der Sar *", "Frank de Boer *", "Ronald Koeman *", "Jari Litmanen *", "Henrik Larsson *", "Zlatan Ibrahimović *", "Hakan Şükür *", "Gheorghe Hagi *", "Andriy Shevchenko *", "Oleh Blokhin *", "Paolo Rossi *", "Francesco Totti *", "Alessandro Del Piero *", "Andrea Pirlo *", "Daniele De Rossi *", "Gennaro Gattuso *", "Fabio Cannavaro *", "Giorgio Chiellini *", "Leonardo Bonucci *", "Alessandro Nesta *", "Franco Baresi *", "Gianni Rivera *", "Dino Zoff *", "Gianluigi Buffon *", "Antonio Conte *", "Riyad Mahrez *", "Mohamed Salah *", "Sadio Mané *", "Didier Drogba *", "Samuel Eto'o *", "Yaya Touré *", "Jay-Jay Okocha *", "Nwankwo Kanu *", "Roger Milla *", "George Weah *", "Kalidou Koulibaly *", "Achraf Hakimi *", "Virgil van Dijk *", "Memphis Depay *", "Frenkie de Jong *", "Matthijs de Ligt *", "Georginio Wijnaldum *", "Robin van Persie *", "Harry Kane *", "Alan Shearer *", "Gary Lineker *", "Michael Owen *", "Rio Ferdinand *", "Sol Campbell *", "David Beckham *", "Joe Cole *", "Gareth Bale *", "Aaron Ramsey *", "Ian Rush *", "Robbie Fowler *", "Luis Suárez *", "Edinson Cavani *", "Diego Forlán *", "Enzo Francescoli *", "Álvaro Recoba *", "Obdulio Varela *", "Radamel Falcao *", "James Rodríguez *", "Carlos Valderrama *", "Freddy Rincón *", "Juan Cuadrado *", "René Higuita *", "Teófilo Cubillas *", "Paolo Guerrero *", "Claudio Pizarro *", "Nolberto Solano *", "Jefferson Farfán *", "Edison Flores *", "Alexis Sánchez *"];

const rooms = Object.create(null);
const genCode = () => {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({length:4}, () => A[Math.floor(Math.random()*A.length)]).join("");
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
    if (!rooms[code]) rooms[code] = { ids:[], names:{}, hostId: socket.id };
    if (!rooms[code].ids.includes(socket.id)) rooms[code].ids.push(socket.id);
    rooms[code].names[socket.id] = (name||"Jugador").slice(0,32);
    socket.join(code);
    io.to(code).emit("updatePlayers", rooms[code].ids.length);
  });

  socket.on("startGame", ({ code, customPool }) => {
    const room = rooms[code];
    if (!room) return;
    const ids = room.ids || [];
    if (ids.length < 3) return;

    const impostorIndex = Math.floor(Math.random() * ids.length);

    let pool = Array.isArray(customPool) ? customPool.map(s=>String(s).trim()).filter(Boolean) : [];
    if (pool.length < 1) pool = PLAYERS;

    const secretWord = pool[Math.floor(Math.random() * pool.length)];

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
      if (room.hostId === socket.id) room.hostId = room.ids[0];
      io.to(code).emit("updatePlayers", room.ids.length);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => console.log("Servidor escuchando en", PORT));
