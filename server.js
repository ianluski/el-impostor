
// Servidor básico con Express y Socket.IO
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('Nuevo jugador conectado:', socket.id);
  socket.on('disconnect', () => {
    console.log('Jugador desconectado:', socket.id);
  });
});

http.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
