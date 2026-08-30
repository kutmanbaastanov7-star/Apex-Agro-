const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 10000;
const DATA_FILE = path.join(__dirname, "apex-data.json");

app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname));

/* =====================================================
   DATABASE
===================================================== */

const defaultData = {
  users: [],
  ads: [],
  messages: {}
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(defaultData, null, 2),
        "utf8"
      );

      return JSON.parse(JSON.stringify(defaultData));
    }

    const data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    return {
      users: Array.isArray(data.users)
        ? data.users
        : [],

      ads: Array.isArray(data.ads)
        ? data.ads
        : [],

      messages:
        data.messages &&
        typeof data.messages === "object"
          ? data.messages
          : {}
    };

  } catch (error) {
    console.error("DATABASE LOAD ERROR:", error);

    return JSON.parse(
      JSON.stringify(defaultData)
    );
  }
}

let db = loadData();

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(db, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("DATABASE SAVE ERROR:", error);
  }
}

/* =====================================================
   HELPERS
===================================================== */

function clean(value, maxLength = 500) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function normalizePhone(phone) {
  return clean(phone, 30)
    .replace(/[^\d+]/g, "");
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role
  };
}

/* =====================================================
   PASSWORD
===================================================== */

function hashPassword(
  password,
  salt = crypto.randomBytes(16).toString("hex")
) {
  const hash = crypto
    .scryptSync(String(password), salt, 64)
    .toString("hex");

  return {
    salt,
    hash
  };
}

function checkPassword(password, user) {
  try {
    const result = hashPassword(
      password,
      user.salt
    );

    return crypto.timingSafeEqual(
      Buffer.from(result.hash, "hex"),
      Buffer.from(user.passwordHash, "hex")
    );

  } catch {
    return false;
  }
}

/* =====================================================
   SESSIONS
===================================================== */

const sessions = new Map();

function createSession(userId) {
  const token = crypto
    .randomBytes(32)
    .toString("hex");

  sessions.set(token, userId);

  return token;
}

function getToken(req) {
  const header =
    req.headers.authorization || "";

  return String(header)
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function auth(req, res, next) {
  const token = getToken(req);

  if (!token) {
    return res.status(401).json({
      error: "Авторизация керек"
    });
  }

  const userId = sessions.get(token);

  if (!userId) {
    return res.status(401).json({
      error: "Сессия жараксыз"
    });
  }

  const user = db.users.find(
    u => u.id === userId
  );

  if (!user) {
    return res.status(401).json({
      error: "Колдонуучу табылган жок"
    });
  }

  req.user = user;
  req.token = token;

  next();
}

/* =====================================================
   HEALTH
===================================================== */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Apex Agro",
    users: db.users.length,
    ads: db.ads.length,
    time: new Date().toISOString()
  });
});

/* =====================================================
   HOME
===================================================== */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/* =====================================================
   REGISTER
===================================================== */

app.post("/api/register", (req, res) => {
  try {
    const name =
      clean(req.body.name, 100);

    const phone =
      normalizePhone(req.body.phone);

    const password =
      String(req.body.password || "");

    const role =
      clean(req.body.role, 100);

    if (!name || !phone) {
      return res.status(400).json({
        error: "Аты-жөнү жана телефон керек"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error:
          "Пароль кеминде 6 белгиден турушу керек"
      });
    }

    const exists =
      db.users.find(
        u => u.phone === phone
      );

    if (exists) {
      return res.status(409).json({
        error:
          "Бул телефон номер буга чейин катталган"
      });
    }

    const passwordData =
      hashPassword(password);

    const user = {
      id: crypto.randomUUID(),
      name,
      phone,
      role: role || "Сатып алуучу",
      salt: passwordData.salt,
      passwordHash: passwordData.hash,
      createdAt:
        new Date().toISOString()
    };

    db.users.push(user);

    saveData();

    const token =
      createSession(user.id);

    res.status(201).json({
      success: true,
      token,
      user: publicUser(user)
    });

  } catch (error) {
    console.error(
      "REGISTER ERROR:",
      error
    );

    res.status(500).json({
      error: "Каттоодо ката кетти"
    });
  }
});

/* =====================================================
   LOGIN
===================================================== */

app.post("/api/login", (req, res) => {
  const phone =
    normalizePhone(req.body.phone);

  const password =
    String(req.body.password || "");

  const user =
    db.users.find(
      u => u.phone === phone
    );

  if (
    !user ||
    !checkPassword(password, user)
  ) {
    return res.status(401).json({
      error:
        "Телефон же пароль туура эмес"
    });
  }

  const token =
    createSession(user.id);

  res.json({
    success: true,
    token,
    user: publicUser(user)
  });
});

/* =====================================================
   LOGOUT
===================================================== */

app.post(
  "/api/logout",
  auth,
  (req, res) => {

    sessions.delete(req.token);

    res.json({
      success: true
    });
  }
);

/* =====================================================
   CURRENT USER
===================================================== */

app.get(
  "/api/me",
  auth,
  (req, res) => {

    res.json({
      user: publicUser(req.user)
    });
  }
);

/* =====================================================
   USERS
===================================================== */

app.get(
  "/api/users",
  auth,
  (req, res) => {

    const users =
      db.users
        .filter(
          u =>
            u.id !== req.user.id
        )
        .map(publicUser);

    res.json(users);
  }
);

/* =====================================================
   ADS
===================================================== */

app.get("/api/ads", (req, res) => {
  let ads =
    [...db.ads].reverse();

  const q =
    clean(req.query.q, 100)
      .toLowerCase();

  const category =
    clean(req.query.category, 100);

  const region =
    clean(req.query.region, 100);

  if (q) {
    ads = ads.filter(ad => {

      const text = [
        ad.title,
        ad.description,
        ad.category,
        ad.region
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }

  if (category) {
    ads = ads.filter(
      ad =>
        ad.category === category
    );
  }

  if (region) {
    ads = ads.filter(
      ad =>
        ad.region === region
    );
  }

  res.json(ads);
});

/* =====================================================
   CREATE AD
===================================================== */

app.post(
  "/api/ads",
  auth,
  (req, res) => {

    const ad = {
      id: crypto.randomUUID(),

      title:
        clean(req.body.title, 150),

      category:
        clean(req.body.category, 100),

      price:
        clean(req.body.price, 100),

      region:
        clean(req.body.region, 100),

      description:
        clean(
          req.body.description,
          2000
        ),

      seller:
        publicUser(req.user),

      createdAt:
        new Date().toISOString()
    };

    if (
      !ad.title ||
      !ad.category ||
      !ad.price ||
      !ad.region
    ) {
      return res.status(400).json({
        error:
          "Товар, категория, баа жана аймак толтурулушу керек"
      });
    }

    db.ads.push(ad);

    saveData();

    res.status(201).json(ad);
  }
);

/* =====================================================
   DELETE OWN AD
===================================================== */

app.delete(
  "/api/ads/:id",
  auth,
  (req, res) => {

    const index =
      db.ads.findIndex(
        ad =>
          ad.id === req.params.id &&
          ad.seller?.id === req.user.id
      );

    if (index === -1) {
      return res.status(404).json({
        error:
          "Жарыя табылган жок"
      });
    }

    db.ads.splice(index, 1);

    saveData();

    res.json({
      success: true
    });
  }
);

/* =====================================================
   CHAT ROOM
===================================================== */

function roomId(a, b) {
  return [a, b]
    .sort()
    .join(":");
}

/* =====================================================
   CHAT HISTORY
===================================================== */

app.get(
  "/api/chats/:otherUserId/messages",
  auth,
  (req, res) => {

    const otherUser =
      db.users.find(
        u =>
          u.id ===
          req.params.otherUserId
      );

    if (!otherUser) {
      return res.status(404).json({
        error:
          "Колдонуучу табылган жок"
      });
    }

    const room =
      roomId(
        req.user.id,
        otherUser.id
      );

    res.json(
      db.messages[room] || []
    );
  }
);

/* =====================================================
   SOCKET AUTH
===================================================== */

io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token;

  if (!token) {
    return next(
      new Error("AUTH_REQUIRED")
    );
  }

  const userId =
    sessions.get(token);

  if (!userId) {
    return next(
      new Error("INVALID_SESSION")
    );
  }

  const user =
    db.users.find(
      u => u.id === userId
    );

  if (!user) {
    return next(
      new Error("USER_NOT_FOUND")
    );
  }

  socket.user = user;

  next();
});

/* =====================================================
   SOCKET CONNECTION
===================================================== */

io.on("connection", socket => {

  console.log(
    "🟢 User connected:",
    socket.user.name
  );

  socket.join(
    `user:${socket.user.id}`
  );

  socket.on(
    "join_chat",
    data => {

      const otherUserId =
        data?.otherUserId;

      if (!otherUserId) return;

      const otherUser =
        db.users.find(
          u =>
            u.id ===
            otherUserId
        );

      if (!otherUser) {
        socket.emit(
          "chat_error",
          {
            error:
              "Колдонуучу табылган жок"
          }
        );

        return;
      }

      const room =
        roomId(
          socket.user.id,
          otherUserId
        );

      socket.join(room);

      socket.emit(
        "chat_history",
        db.messages[room] || []
      );
    }
  );

  socket.on(
    "send_message",
    data => {

      const otherUserId =
        data?.otherUserId;

      const text =
        clean(
          data?.text,
          2000
        );

      if (
        !otherUserId ||
        !text
      ) {
        return;
      }

      const otherUser =
        db.users.find(
          u =>
            u.id ===
            otherUserId
        );

      if (!otherUser) return;

      const room =
        roomId(
          socket.user.id,
          otherUserId
        );

      const message = {
        id: crypto.randomUUID(),
        room,
        senderId:
          socket.user.id,
        senderName:
          socket.user.name,
        text,
        createdAt:
          new Date().toISOString()
      };

      if (!db.messages[room]) {
        db.messages[room] = [];
      }

      db.messages[room].push(
        message
      );

      db.messages[room] =
        db.messages[room].slice(-500);

      saveData();

      io.to(room).emit(
        "new_message",
        message
      );
    }
  );

  socket.on(
    "typing",
    data => {

      const otherUserId =
        data?.otherUserId;

      if (!otherUserId) return;

      io.to(
        `user:${otherUserId}`
      ).emit(
        "typing",
        {
          userId:
            socket.user.id,

          name:
            socket.user.name,

          isTyping:
            Boolean(
              data?.isTyping
            )
        }
      );
    }
  );

  socket.on(
    "disconnect",
    reason => {

      console.log(
        "🔴 User disconnected:",
        socket.user.name,
        reason
      );
    }
  );
});

/* =====================================================
   SPA FALLBACK
===================================================== */

app.use(
  (req, res, next) => {

    if (
      req.path.startsWith("/api/")
    ) {
      return next();
    }

    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      ),
      error => {
        if (error) {
          next(error);
        }
      }
    );
  }
);

/* =====================================================
   ERROR HANDLER
===================================================== */

app.use(
  (err, req, res, next) => {

    console.error(
      "SERVER ERROR:",
      err
    );

    if (res.headersSent) {
      return next(err);
    }

    res.status(500).json({
      error:
        "Сервердик ката кетти"
    });
  }
);

/* =====================================================
   START
===================================================== */

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `🚀 Apex Agro running on port ${PORT}`
    );

    console.log(
      `🌱 Users: ${db.users.length}`
    );

    console.log(
      `📦 Ads: ${db.ads.length}`
    );
  }
);
