import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public"));

const onlineUsers = new Map();

// هنا البداية الصحيحة
io.on("connection", (socket) => {
  console.log("✅ مستخدم اتصل:", socket.id);

  // حدث join
  socket.on("join", (username) => {
    username = String(username || "ضيف").trim().slice(0, 20);
    onlineUsers.set(socket.id, username);

    socket.join("global");

    io.to("global").emit("system_message", `${username} انضم`);
    io.to("global").emit("online_list", Array.from(onlineUsers.values()));
  });

  // حدث chat_message
  socket.on("chat_message", (msg) => {
    const username = onlineUsers.get(socket.id) || "ضيف";
    io.to("global").emit("chat_message", {
      from: username,
      text: msg,
    });
  });

  // عند المغادرة
  socket.on("disconnect", () => {
    const username = onlineUsers.get(socket.id);
    if (username) {
      onlineUsers.delete(socket.id);
      io.to("global").emit("system_message", `${username} خرج`);
      io.to("global").emit("online_list", Array.from(onlineUsers.values()));
    }
  });
});
// هنا النهاية
const PORT = process.env.PORT || 3000;
const users = {}; // { socket.id: { name, muted, banned } }

io.on("connection", (socket) => {
  console.log("مستخدم جديد:", socket.id);

  // استقبال الاسم من المستخدم
  socket.on("setUsername", (username) => {
    users[socket.id] = { name: username, muted: false, banned: false };
    io.emit("userList", Object.values(users)); // إرسال قائمة للموجودين
  });

  // عند فصل الاتصال
  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("userList", Object.values(users));
  });
});
socket.on("chatMessage", (msg) => {
  if (users[socket.id].banned) {
    socket.emit("message", "❌ تم حظرك من الدردشة");
    socket.disconnect(); // يطرده
    return;
  }
  if (users[socket.id].muted) {
    socket.emit("message", "🔇 تم كتمك من قبل الإدارة");
    return;
  }

  // إذا مو مكتوم ولا محظور → يرسل
  io.emit("message", `${users[socket.id].name}: ${msg}`);
});
socket.on("adminCommand", ({ action, targetName }) => {
  if (users[socket.id].name !== "admin") return; // بس الادمن يقدر

  const targetSocketId = Object.keys(users).find(
    (id) => users[id].name === targetName
  );

  if (!targetSocketId) return;

  if (action === "mute") users[targetSocketId].muted = true;
  if (action === "unmute") users[targetSocketId].muted = false;
  if (action === "ban") users[targetSocketId].banned = true;
});

server.listen(PORT, () => console.log(`🚀 السيرفر شغال على http://localhost:${PORT}`));
