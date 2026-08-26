const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 10000;

// Render PostgreSQL туташуусу
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Билдирүүлөр таблицасын автоматтык түзүү
pool.query(`
  CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    room VARCHAR(50),
    sender VARCHAR(100),
    text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(err => console.error('Базада таблица түзүү катасы:', err));

app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Socket.io жана PostgreSQL туташуусу
io.on('connection', (socket) => {

  // Колдонуучу чатка киргенде эски билдирүүлөрдү базадан жуктап берүү
  socket.on('join_room', async (roomId) => {
    socket.join(roomId);
    try {
      const res = await pool.query(
        'SELECT sender, text FROM messages WHERE room = $1 ORDER BY created_at ASC LIMIT 50',
        [roomId]
      );
      socket.emit('load_history', res.rows);
    } catch (err) {
      console.error('Тарыхты жүктөөдө ката:', err);
    }
  });

  // Билдирүүнү кабыл алуу, базага сактоо жана бардыгына жөнөтүү
  socket.on('send_message', async (data) => {
    try {
      await pool.query(
        'INSERT INTO messages (room, sender, text) VALUES ($1, $2, $3)',
        [data.room, data.sender, data.text]
      );
      io.to(data.room).emit('receive_message', data);
    } catch (err) {
      console.error('Билдирүүнү сактоодо ката:', err);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Apex Agro сервери жана маалымат базасы ${PORT} портунда иштеп баштады`);
});
