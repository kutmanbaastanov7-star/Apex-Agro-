const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(__dirname));

// Башкы баракчага киргенде index.html ачуу
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Платформа ичиндеги реалдуу убакыт чаты (Socket.io)
io.on('connection', (socket) => {
  console.log('Жаңы колдонуучу туташты:', socket.id);

  // Сүйлөшүү бөлмөсүнө туташуу
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
  });

  // Билдирүүлөрдү кабыл алуу жана бардыгына таратуу
  socket.on('send_message', (data) => {
    io.to(data.room).emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    console.log('Колдонуучу чыкты:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Apex Agro сервери жана Чат ${PORT} портунда иштеп жатат`);
});
