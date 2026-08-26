const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        apex_id VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'farmer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id VARCHAR(20) NOT NULL,
        receiver_id VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("База ийгиликтүү даярдалды!");
  } catch (err) {
    console.error("База катасы:", err);
  }
};
initDB();

app.get('/', (req, res) => {
  res.send('Apex Agro Production v4 API иштеп жатат!');
});

app.get('/api/users/:apexId', async (req, res) => {
  try {
    const { apexId } = req.params;
    const result = await pool.query('SELECT apex_id, name, phone, role FROM users WHERE apex_id = $1', [apexId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Колдонуучу табылган жок' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

io.on('connection', (socket) => {
  console.log('Жаңы түзмөк туташты:', socket.id);

  socket.on('join_room', (apexId) => {
    socket.join(apexId);
    console.log(`Колдонуучу ${apexId} бөлмөгө кирди`);
  });

  socket.on('send_message', async (data) => {
    const { sender_id, receiver_id, message } = data;
    
    try {
      await pool.query(
        'INSERT INTO messages (sender_id, receiver_id, message) VALUES ($1, $2, $3)',
        [sender_id, receiver_id, message]
      );
    } catch(e) { console.error(e); }

    io.to(receiver_id).emit('receive_message', { sender_id, message });
  });

  socket.on('disconnect', () => {
    console.log('Түзмөк ажыратылды');
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Сервер ${PORT} портунда иштеп жатат`);
});    
