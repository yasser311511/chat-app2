import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;

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
server.listen(PORT, () => console.log(`🚀 السيرفر شغال على http://localhost:${PORT}`));
