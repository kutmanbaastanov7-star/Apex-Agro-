const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Билдирүүлөрдү серведин эс тутумунда убактылуу сактоо
const messageHistory = [];

io.on('connection', (socket) => {
  console.log('Жаңы колдонуучу туташты:', socket.id);

  // Сүйлөшүү бөлмөсүнө кирүү жана эски билдирүүлөрдү берүү
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    socket.emit('load_history', messageHistory);
  });

  // Билдирүүнү кабыл алуу жана БАРДЫК колдонуучуларга таркатуу
  socket.on('send_message', (data) => {
    if (data && data.text) {
      messageHistory.push(data);
      if (messageHistory.length > 100) messageHistory.shift(); // Акыркы 100 смс сакталат
      
      // Бөлмөдөгү бардык адамдарга жөнөтүү
      io.to(data.room).emit('receive_message', data);
    }
  });

  socket.on('disconnect', () => {
    console.log('Колдонуучу чыкты:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Apex Agro сервери ${PORT} портунда иштеп жатат`);
});
