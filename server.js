const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  pingTimeout: 60000,
  pingInterval: 25000
});

// نظام الرتب
const ranks = {
  'صاحب الموقع': { color: 'from-red-600 to-orange-400', icon: '🏆', level: 6 },
  'منشئ': { color: 'from-yellow-400 to-orange-500', icon: '👑', level: 5 },
  'سوبر ادمن': { color: 'from-red-500 to-pink-600', icon: '⭐', level: 4 },
  'ادمن': { color: 'from-purple-500 to-indigo-600', icon: '🛡️', level: 3 },
  'بريميوم': { color: 'from-green-500 to-emerald-600', icon: '💎', level: 2 },
  'جيد': { color: 'from-blue-500 to-cyan-600', icon: '❇️', level: 1 }
};

// المستخدم الخاص
const SITE_OWNER = {
  username: "Walid dz 31",
  password: "walidwalid321",
  rank: "صاحب الموقع"
};

// تخزين البيانات
let users = {};
let userRanks = {};
let userManagement = {
  mutedUsers: {},
  bannedFromRoom: {},
  bannedFromSite: {}
};
let userAvatars = {};
let userSessions = {};

// تحميل البيانات من الملفات
function loadData() {
  try {
    if (fs.existsSync('./data/users.json')) {
      users = JSON.parse(fs.readFileSync('./data/users.json', 'utf8'));
    }
    if (fs.existsSync('./data/ranks.json')) {
      userRanks = JSON.parse(fs.readFileSync('./data/ranks.json', 'utf8'));
    }
    if (fs.existsSync('./data/management.json')) {
      userManagement = JSON.parse(fs.readFileSync('./data/management.json', 'utf8'));
    }
    if (fs.existsSync('./data/avatars.json')) {
      userAvatars = JSON.parse(fs.readFileSync('./data/avatars.json', 'utf8'));
    }
    if (fs.existsSync('./data/sessions.json')) {
      userSessions = JSON.parse(fs.readFileSync('./data/sessions.json', 'utf8'));
    }
  } catch (e) {
    console.log('إنشاء ملفات بيانات جديدة...');
    if (!fs.existsSync('./data')) {
      fs.mkdirSync('./data');
    }
  }
}

// حفظ البيانات إلى الملفات
function saveData() {
  try {
    fs.writeFileSync('./data/users.json', JSON.stringify(users, null, 2));
    fs.writeFileSync('./data/ranks.json', JSON.stringify(userRanks, null, 2));
    fs.writeFileSync('./data/management.json', JSON.stringify(userManagement, null, 2));
    fs.writeFileSync('./data/avatars.json', JSON.stringify(userAvatars, null, 2));
    fs.writeFileSync('./data/sessions.json', JSON.stringify(userSessions, null, 2));
  } catch (e) {
    console.error('خطأ في حفظ البيانات:', e);
  }
}

// الغرف الثابتة
let rooms = [
  { id: 1, name: 'غرفة العامة', icon: '💬', description: 'محادثات عامة ومتنوعة', users: [] },
  { id: 2, name: 'غرفة التقنية', icon: '💻', description: 'مناقشات تقنية وبرمجة', users: [] },
  { id: 3, name: 'غرفة الرياضة', icon: '⚽', description: 'أخبار ومناقشات رياضية', users: [] },
  { id: 4, name: 'غرفة الألعاب', icon: '🎮', description: 'مناقشات الألعاب والجيمرز', users: [] },
  { id: 5, name: 'غرفة الطبخ', icon: '👨‍🍳', description: 'وصفات ونصائح الطبخ', users: [] },
  { id: 6, name: 'غرفة السفر', icon: '✈️', description: 'تجارب ونصائح السفر', users: [] },
  { id: 7, name: 'غرفة الكتب', icon: '📚', description: 'مناقشات الكتب والقراءة', users: [] },
  { id: 8, name: 'غرفة الأفلام', icon: '🎬', description: 'مراجعات ومناقشات الأفلام', users: [] },
  { id: 9, name: 'غرفة الموسيقى', icon: '🎵', description: 'مشاركة ومناقشة الموسيقى', users: [] },
  { id: 10, name: 'غرفة تخصيص المظهر', icon: '🎨', description: 'تخصيص المظهر والصورة الشخصية', users: [], protected: true },
  { id: 11, name: 'غرفة الإدارة', icon: '👑', description: 'غرفة خاصة للإدارة والمشرفين', users: [], protected: true }
];

let messages = {};
let onlineUsers = {};

// دوال التحقق من الصلاحيات
function canManageRanks(user, roomName) {
  if (roomName !== 'غرفة الإدارة') return false;
  if (user.isSiteOwner) return true;
  const userLevel = ranks[user.rank]?.level || 0;
  return userLevel >= 3;
}

function canManageUsers(user, roomName) {
  if (roomName !== 'غرفة الإدارة') return false;
  if (user.isSiteOwner) return true;
  const userLevel = ranks[user.rank]?.level || 0;
  return userLevel >= 4;
}

function canSendMessage(username, roomName) {
  if (userManagement.bannedFromSite[username]) return false;
  if (userManagement.bannedFromRoom[roomName] && userManagement.bannedFromRoom[roomName][username]) return false;
  if (userManagement.mutedUsers[roomName] && userManagement.mutedUsers[roomName][username]) {
    const muteInfo = userManagement.mutedUsers[roomName][username];
    if (new Date() < new Date(muteInfo.expiresAt)) return false;
    // إذا انتهت مدة الكتم، قم بإزالته
    delete userManagement.mutedUsers[roomName][username];
    saveData();
  }
  return true;
}

// خدمة الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// تحميل البيانات عند بدء التشغيل
loadData();

// إعداد Socket.io
io.on('connection', (socket) => {
  console.log('مستخدم جديد متصل:', socket.id);

  // التحقق من الجلسة المحفوظة
  socket.on('check session', (sessionId) => {
    if (userSessions[sessionId]) {
      const userData = userSessions[sessionId];
      if (users[userData.username] && users[userData.username].password === userData.password) {
        socket.emit('session valid', {
          name: userData.username,
          rank: userRanks[userData.username] || null,
          isSiteOwner: false,
          gender: users[userData.username].gender,
          socketId: socket.id
        });
        return;
      }
    }
    socket.emit('session invalid');
  });

  // حدث تسجيل الدخول
  socket.on('user login', (userData) => {
    if (userData.username === SITE_OWNER.username && userData.password === SITE_OWNER.password) {
      const sessionId = 'session_' + Date.now() + Math.random().toString(36).substr(2, 9);
      userSessions[sessionId] = { username: userData.username, password: userData.password };
      saveData();
      
      socket.emit('login success', {
        name: userData.username,
        rank: SITE_OWNER.rank,
        isSiteOwner: true,
        socketId: socket.id,
        sessionId: sessionId
      });
    } else if (users[userData.username] && users[userData.username].password === userData.password) {
      const sessionId = 'session_' + Date.now() + Math.random().toString(36).substr(2, 9);
      userSessions[sessionId] = { username: userData.username, password: userData.password };
      saveData();
      
      socket.emit('login success', {
        name: userData.username,
        rank: userRanks[userData.username] || null,
        isSiteOwner: false,
        gender: users[userData.username].gender,
        socketId: socket.id,
        sessionId: sessionId
      });
    } else {
      socket.emit('login error', 'اسم المستخدم أو كلمة السر غير صحيحة!');
    }
  });

  // حدث إنشاء حساب
  socket.on('user register', (userData) => {
    if (users[userData.username]) {
      socket.emit('register error', 'اسم المستخدم موجود مسبقاً!');
      return;
    }
    
    users[userData.username] = {
      password: userData.password,
      gender: userData.gender
    };
    
    const sessionId = 'session_' + Date.now() + Math.random().toString(36).substr(2, 9);
    userSessions[sessionId] = { username: userData.username, password: userData.password };
    saveData();
    
    socket.emit('register success', {
      name: userData.username,
      rank: null,
      isSiteOwner: false,
      gender: userData.gender,
      socketId: socket.id,
      sessionId: sessionId
    });
  });

  socket.on('join room', (data) => {
    const { roomId, user } = data;
    
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    
    // تخزين بيانات المستخدم
    onlineUsers[socket.id] = {
      id: socket.id,
      name: user.name,
      roomId: roomId,
      rank: user.rank,
      gender: user.gender,
      avatar: userAvatars[user.name] || null
    };
    
    // إزالة المستخدم من أي غرفة سابقة
    rooms.forEach(room => {
      room.users = room.users.filter(u => u.id !== socket.id);
    });
    
    // إضافة المستخدم للغرفة الجديدة
    room.users.push({
      id: socket.id,
      name: user.name,
      rank: user.rank,
      gender: user.gender,
      avatar: userAvatars[user.name] || null
    });
    
    // انضمام المستخدم للغرفة
    socket.join(roomId);
    
    // إرسال تحديث الغرف لجميع المستخدمين
    io.emit('rooms update', rooms);
    
    // إرسال تحديث المستخدمين المتصلين للغرفة
    io.to(roomId).emit('users update', room.users);
    
    // إرسال رسالة ترحيب
    const welcomeMessage = {
      type: 'system',
      content: `🚪 دخل العضو "${user.name}" إلى الغرفة`,
      time: new Date().toLocaleTimeString('ar-SA')
    };
    
    // إضافة الرسالة للسجل
    if (!messages[roomId]) messages[roomId] = [];
    messages[roomId].push(welcomeMessage);
    
    // إرسال الرسالة للغرفة
    io.to(roomId).emit('new message', welcomeMessage);
    
    // إرسال تاريخ المحادثة للمستخدم الجديد
    socket.emit('chat history', messages[roomId] || []);
  });
  
  socket.on('send message', (data) => {
    const { roomId, message, user } = data;
    const room = rooms.find(r => r.id === roomId);
    
    if (!room || !canSendMessage(user.name, room.name)) {
      socket.emit('message error', 'لا يمكنك إرسال الرسائل الآن. قد تكون مكتوماً أو محظوراً.');
      return;
    }
    
    const newMessage = {
      type: 'user',
      user: user.name,
      content: message,
      time: new Date().toLocaleTimeString('ar-SA'),
      gender: user.gender,
      rank: user.rank,
      avatar: userAvatars[user.name] || null
    };
    
    if (!messages[roomId]) messages[roomId] = [];
    messages[roomId].push(newMessage);
    
    io.to(roomId).emit('new message', newMessage);
  });
  
  socket.on('leave room', (data) => {
    const { roomId, user } = data;
    const room = rooms.find(r => r.id === roomId);
    
    if (room) {
      room.users = room.users.filter(u => u.id !== socket.id);
      io.emit('rooms update', rooms);
      io.to(roomId).emit('users update', room.users);
    }
    
    const leaveMessage = {
      type: 'system',
      content: `🚪 غادر العضو "${user.name}" الغرفة`,
      time: new Date().toLocaleTimeString('ar-SA')
    };
    
    if (messages[roomId]) {
      messages[roomId].push(leaveMessage);
      io.to(roomId).emit('new message', leaveMessage);
    }
    
    socket.leave(roomId);
  });

  // حدث إدارة الرتب
  socket.on('assign rank', (data) => {
    const { username, rank, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageRanks(currentUser, room.name)) {
      socket.emit('rank error', 'ليس لديك صلاحية لإدارة الرتب');
      return;
    }
    
    userRanks[username] = rank;
    saveData();
    
    // تحديث الرتبة للمستخدمين المتصلين
    Object.keys(onlineUsers).forEach(socketId => {
      if (onlineUsers[socketId].name === username) {
        onlineUsers[socketId].rank = rank;
      }
    });
    
    // تحديث الرتبة في الغرف
    rooms.forEach(r => {
      r.users.forEach(u => {
        if (u.name === username) {
          u.rank = rank;
        }
      });
    });
    
    // إرسال تحديث الغرف والمستخدمين
    io.emit('rooms update', rooms);
    io.to(room.id).emit('users update', room.users);
    
    // إرسال إشعار للجميع
    const rankInfo = ranks[rank];
    const notificationMessage = {
      type: 'system',
      content: `👑 تم منح رتبة ${rankInfo.icon} ${rank} للمستخدم ${username} من قبل ${currentUser.name}`,
      time: new Date().toLocaleTimeString('ar-SA')
    };
    
    // إرسال الإشعار لجميع الغرف
    io.emit('rank notification', notificationMessage);
    
    // حفظ الإشعار في جميع الغرف
    Object.keys(messages).forEach(roomId => {
      messages[roomId].push(notificationMessage);
    });
    
    socket.emit('rank success', `تم منح الرتبة ${rank} للمستخدم ${username} بنجاح`);
  });

  socket.on('remove rank', (data) => {
    const { username, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageRanks(currentUser, room.name)) {
      socket.emit('rank error', 'ليس لديك صلاحية لإدارة الرتب');
      return;
    }
    
    if (userRanks[username]) {
      const oldRank = userRanks[username];
      delete userRanks[username];
      saveData();
      
      // تحديث الرتبة للمستخدمين المتصلين
      Object.keys(onlineUsers).forEach(socketId => {
        if (onlineUsers[socketId].name === username) {
          onlineUsers[socketId].rank = null;
        }
      });
      
      // تحديث الرتبة في الغرف
      rooms.forEach(r => {
        r.users.forEach(u => {
          if (u.name === username) {
            u.rank = null;
          }
        });
      });
      
      // إرسال تحديث الغرف والمستخدمين
      io.emit('rooms update', rooms);
      io.to(room.id).emit('users update', room.users);
      
      const notificationMessage = {
        type: 'system',
        content: `👑 تم إزالة رتبة ${oldRank} من المستخدم ${username} من قبل ${currentUser.name}`,
        time: new Date().toLocaleTimeString('ar-SA')
      };
      
      io.emit('rank notification', notificationMessage);
      Object.keys(messages).forEach(roomId => {
        messages[roomId].push(notificationMessage);
      });
      
      socket.emit('rank success', `تم إزالة الرتبة من المستخدم ${username} بنجاح`);
    } else {
      socket.emit('rank error', 'المستخدم لا يملك رتبة');
    }
  });

  socket.on('show all ranks', (data) => {
    const { currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageRanks(currentUser, room.name)) {
      socket.emit('rank error', 'ليس لديك صلاحية لعرض الرتب');
      return;
    }
    
    let ranksList = '📋 قائمة جميع الرتب:\n\n';
    
    if (Object.keys(userRanks).length === 0) {
      ranksList += 'لا توجد رتب محددة حالياً';
    } else {
      const sortedUsers = Object.entries(userRanks).sort((a, b) => {
        const rankA = ranks[a[1]]?.level || 0;
        const rankB = ranks[b[1]]?.level || 0;
        return rankB - rankA;
      });
      
      sortedUsers.forEach(([username, rank]) => {
        const rankInfo = ranks[rank];
        ranksList += `${rankInfo.icon} ${username} - ${rank}\n`;
      });
    }
    
    const systemMessage = {
      type: 'system',
      content: ranksList,
      time: new Date().toLocaleTimeString('ar-SA')
    };
    
    socket.emit('show ranks', systemMessage);
  });

  // أحداث إدارة المستخدمين
  socket.on('mute user', (data) => {
    const { username, duration, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageUsers(currentUser, room.name)) {
      socket.emit('management error', 'ليس لديك صلاحية لإدارة المستخدمين');
      return;
    }
    
    if (!userManagement.mutedUsers[room.name]) {
      userManagement.mutedUsers[room.name] = {};
    }
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + parseInt(duration));
    
    userManagement.mutedUsers[room.name][username] = {
      mutedBy: currentUser.name,
      expiresAt: expiresAt.toISOString()
    };
    
    saveData();
    
    const notificationMessage = {
      type: 'system',
      content: `🔇 تم كتم المستخدم ${username} لمدة ${duration} دقيقة من قبل ${currentUser.name}`,
      time: new Date().toLocaleTimeString('ar-SA')
    };
    
    io.to(room.id).emit('new message', notificationMessage);
    messages[room.id].push(notificationMessage);
    
    socket.emit('management success', `تم كتم المستخدم ${username} بنجاح`);
  });

  socket.on('unmute user', (data) => {
    const { username, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageUsers(currentUser, room.name)) {
      socket.emit('management error', 'ليس لديك صلاحية لإدارة المستخدمين');
      return;
    }
    
    if (userManagement.mutedUsers[room.name] && userManagement.mutedUsers[room.name][username]) {
      delete userManagement.mutedUsers[room.name][username];
      saveData();
      
      const notificationMessage = {
        type: 'system',
        content: `🔊 تم إلغاء كتم المستخدم ${username} من قبل ${currentUser.name}`,
        time: new Date().toLocaleTimeString('ar-SA')
      };
      
      io.to(room.id).emit('new message', notificationMessage);
      messages[room.id].push(notificationMessage);
      
      socket.emit('management success', `تم إلغاء كتم المستخدم ${username} بنجاح`);
    } else {
      socket.emit('management error', 'المستخدم غير مكتوم');
    }
  });

  socket.on('ban from room', (data) => {
    const { username, reason, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageUsers(currentUser, room.name)) {
      socket.emit('management error', 'ليس لديك صلاحية لإدارة المستخدمين');
      return;
    }
    
    if (!userManagement.bannedFromRoom[room.name]) {
      userManagement.bannedFromRoom[room.name] = {};
    }
    
    userManagement.bannedFromRoom[room.name][username] = {
      bannedBy: currentUser.name,
      reason: reason || 'غير محدد',
      bannedAt: new Date().toISOString()
    };
    
    saveData();
    
    // طرد المستخدم المحظور من الغرفة إذا كان متصلاً
    const bannedUserSocket = Object.keys(onlineUsers).find(
      socketId => onlineUsers[socketId].name === username && onlineUsers[socketId].roomId === room.id
    );
    
    if (bannedUserSocket) {
      io.to(bannedUserSocket).emit('banned from room', {
        room: room.name,
        reason: reason || 'غير محدد'
      });
    }
    
    const notificationMessage = {
      type: 'system',
      content: `🚫 تم حظر المستخدم ${username} من الغرفة ${room.name} من قبل ${currentUser.name}. السبب: ${reason || 'غير محدد'}`,
      time: new Date().toLocaleTimeString('ar-SA')
    };
    
    io.to(room.id).emit('new message', notificationMessage);
    messages[room.id].push(notificationMessage);
    
    socket.emit('management success', `تم حظر المستخدم ${username} من الغرفة بنجاح`);
  });

  socket.on('unban from room', (data) => {
    const { username, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageUsers(currentUser, room.name)) {
      socket.emit('management error', 'ليس لديك صلاحية لإدارة المستخدمين');
      return;
    }
    
    if (userManagement.bannedFromRoom[room.name] && userManagement.bannedFromRoom[room.name][username]) {
      delete userManagement.bannedFromRoom[room.name][username];
      saveData();
      
      const notificationMessage = {
        type: 'system',
        content: `✅ تم إلغاء حظر المستخدم ${username} من الغرفة ${room.name} من قبل ${currentUser.name}`,
        time: new Date().toLocaleTimeString('ar-SA')
      };
      
      io.to(room.id).emit('new message', notificationMessage);
      messages[room.id].push(notificationMessage);
      
      socket.emit('management success', `تم إلغاء حظر المستخدم ${username} من الغرفة بنجاح`);
    } else {
      socket.emit('management error', 'المستخدم غير محظور من هذه الغرفة');
    }
  });

  socket.on('ban from site', (data) => {
    const { username, reason, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageUsers(currentUser, room.name)) {
      socket.emit('management error', 'ليس لديك صلاحية لإدارة المستخدمين');
      return;
    }
    
    userManagement.bannedFromSite[username] = {
      bannedBy: currentUser.name,
      reason: reason || 'غير محدد',
      bannedAt: new Date().toISOString()
    };
    
    saveData();
    
    // طرد المستخدم المحظور من الموقع إذا كان متصلاً
    const bannedUserSocket = Object.keys(onlineUsers).find(
      socketId => onlineUsers[socketId].name === username
    );
    
    if (bannedUserSocket) {
      io.to(bannedUserSocket).emit('banned from site', {
        reason: reason || 'غير محدد'
      });
    }
    
    const notificationMessage = {
      type: 'system',
      content: `⛔ تم حظر المستخدم ${username} من الموقع بالكامل من قبل ${currentUser.name}. السبب: ${reason || 'غير محدد'}`,
      time: new Date().toLocaleTimeString('ar-SA')
    };
    
    io.emit('new message', notificationMessage);
    Object.keys(messages).forEach(roomId => {
      messages[roomId].push(notificationMessage);
    });
    
    socket.emit('management success', `تم حظر المستخدم ${username} من الموقع بنجاح`);
  });

  socket.on('unban from site', (data) => {
    const { username, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageUsers(currentUser, room.name)) {
      socket.emit('management error', 'ليس لديك صلاحية لإدارة المستخدمين');
      return;
    }
    
    if (userManagement.bannedFromSite[username]) {
      delete userManagement.bannedFromSite[username];
      saveData();
      
      const notificationMessage = {
        type: 'system',
        content: `🌐 تم إلغاء حظر المستخدم ${username} من الموقع بالكامل من قبل ${currentUser.name}`,
        time: new Date().toLocaleTimeString('ar-SA')
      };
      
      io.emit('new message', notificationMessage);
      Object.keys(messages).forEach(roomId => {
        messages[roomId].push(notificationMessage);
      });
      
      socket.emit('management success', `تم إلغاء حظر المستخدم ${username} من الموقع بنجاح`);
    } else {
      socket.emit('management error', 'المستخدم غير محظور من الموقع');
    }
  });

  socket.on('delete user', (data) => {
    const { username, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageUsers(currentUser, room.name)) {
      socket.emit('management error', 'ليس لديك صلاحية لإدارة المستخدمين');
      return;
    }
    
    if (users[username]) {
      // حذف بيانات المستخدم
      delete users[username];
      if (userRanks[username]) delete userRanks[username];
      if (userAvatars[username]) delete userAvatars[username];
      
      // حذف من قوائم الإدارة
      Object.keys(userManagement.mutedUsers).forEach(roomName => {
        if (userManagement.mutedUsers[roomName][username]) {
          delete userManagement.mutedUsers[roomName][username];
        }
      });
      
      Object.keys(userManagement.bannedFromRoom).forEach(roomName => {
        if (userManagement.bannedFromRoom[roomName][username]) {
          delete userManagement.bannedFromRoom[roomName][username];
        }
      });
      
      if (userManagement.bannedFromSite[username]) {
        delete userManagement.bannedFromSite[username];
      }
      
      // حذف الجلسات
      Object.keys(userSessions).forEach(sessionId => {
        if (userSessions[sessionId].username === username) {
          delete userSessions[sessionId];
        }
      });
      
      saveData();
      
      // طرد المستخدم المحذوف إذا كان متصلاً
      const deletedUserSocket = Object.keys(onlineUsers).find(
        socketId => onlineUsers[socketId].name === username
      );
      
      if (deletedUserSocket) {
        io.to(deletedUserSocket).emit('user deleted');
      }
      
      const notificationMessage = {
        type: 'system',
        content: `🗑️ تم حذف المستخدم ${username} من قبل ${currentUser.name}`,
        time: new Date().toLocaleTimeString('ar-SA')
      };
      
      io.emit('new message', notificationMessage);
      Object.keys(messages).forEach(roomId => {
        messages[roomId].push(notificationMessage);
      });
      
      socket.emit('management success', `تم حذف المستخدم ${username} بنجاح`);
    } else {
      socket.emit('management error', 'المستخدم غير موجود');
    }
  });

  socket.on('get user status', (data) => {
    const { username, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageUsers(currentUser, room.name)) {
      socket.emit('management error', 'ليس لديك صلاحية لعرض حالة المستخدمين');
      return;
    }
    
    let status = `📋 حالة المستخدم ${username}:\n\n`;
    
    // حالة الحظر من الموقع
    if (userManagement.bannedFromSite[username]) {
      const banInfo = userManagement.bannedFromSite[username];
      status += `⛔ محظور من الموقع\n`;
      status += `👤 تم الحظر بواسطة: ${banInfo.bannedBy}\n`;
      status += `📅 وقت الحظر: ${new Date(banInfo.bannedAt).toLocaleString('ar-SA')}\n`;
      status += `📝 السبب: ${banInfo.reason}\n\n`;
    } else {
      status += `✅ غير محظور من الموقع\n\n`;
    }
    
    // حالة الحظر من الغرف
    const roomBans = Object.keys(userManagement.bannedFromRoom)
      .filter(roomName => userManagement.bannedFromRoom[roomName][username])
      .map(roomName => {
        const banInfo = userManagement.bannedFromRoom[roomName][username];
        return `🚫 محظور من ${roomName} (بواسطة: ${banInfo.bannedBy}, السبب: ${banInfo.reason})`;
      });
    
    if (roomBans.length > 0) {
      status += `🔒 محظور من الغرف:\n${roomBans.join('\n')}\n\n`;
    } else {
      status += `🔓 غير محظور من أي غرفة\n\n`;
    }
    
    // حالة الكتم
    const roomMutes = Object.keys(userManagement.mutedUsers)
      .filter(roomName => userManagement.mutedUsers[roomName][username])
      .map(roomName => {
        const muteInfo = userManagement.mutedUsers[roomName][username];
        const expiresAt = new Date(muteInfo.expiresAt);
        const timeLeft = Math.max(0, expiresAt - new Date());
        const minutesLeft = Math.ceil(timeLeft / (1000 * 60));
        return `🔇 مكتوم في ${roomName} (لمدة ${minutesLeft} دقيقة متبقية, بواسطة: ${muteInfo.mutedBy})`;
      });
    
    if (roomMutes.length > 0) {
      status += `🔇 حالة الكتم:\n${roomMutes.join('\n')}\n\n`;
    } else {
      status += `🔊 غير مكتوم في أي غرفة\n\n`;
    }
    
    // الرتبة
    if (userRanks[username]) {
      status += `👑 الرتبة: ${userRanks[username]}\n`;
    } else {
      status += `👤 بدون رتبة\n`;
    }
    
    const systemMessage = {
      type: 'system',
      content: status,
      time: new Date().toLocaleTimeString('ar-SA')
    };
    
    socket.emit('user status', systemMessage);
  });

  // حدث إدارة الصور
  socket.on('update avatar', (data) => {
    const { username, avatarUrl, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    // السماح بتعديل الصورة في غرفة تخصيص المظهر أو غرفة الإدارة
    const canEdit = (room && room.name === 'غرفة تخصيص المظهر') || 
                   (username === currentUser.name) || 
                   (room && room.name === 'غرفة الإدارة' && canManageUsers(currentUser, room.name));
    
    if (!canEdit) {
      socket.emit('avatar error', 'ليس لديك صلاحية لتعديل هذه الصورة');
      return;
    }
    
    userAvatars[username] = avatarUrl;
    saveData();
    
    // تحديث الصورة للمستخدمين المتصلين
    Object.keys(onlineUsers).forEach(socketId => {
      if (onlineUsers[socketId].name === username) {
        onlineUsers[socketId].avatar = avatarUrl;
      }
    });
    
    // تحديث الصورة في الغرف
    rooms.forEach(r => {
      r.users.forEach(u => {
        if (u.name === username) {
          u.avatar = avatarUrl;
        }
      });
    });
    
    // إرسال تحديث الغرف والمستخدمين
    io.emit('rooms update', rooms);
    if (room) {
      io.to(room.id).emit('users update', room.users);
    }
    
    socket.emit('avatar updated', { username, avatarUrl });
    io.emit('user avatar updated', { username, avatarUrl });
  });

  socket.on('get avatar', (username) => {
    socket.emit('avatar data', { username, avatarUrl: userAvatars[username] || null });
  });
  
  socket.on('disconnect', () => {
    const user = onlineUsers[socket.id];
    if (user) {
      const roomId = user.roomId;
      const room = rooms.find(r => r.id === roomId);
      
      if (room) {
        room.users = room.users.filter(u => u.id !== socket.id);
        io.emit('rooms update', rooms);
        io.to(roomId).emit('users update', room.users);
      }
      
      const leaveMessage = {
        type: 'system',
        content: `🚪 غادر العضو "${user.name}" الغرفة`,
        time: new Date().toLocaleTimeString('ar-SA')
      };
      
      if (messages[roomId]) {
        messages[roomId].push(leaveMessage);
        io.to(roomId).emit('new message', leaveMessage);
      }
      
      delete onlineUsers[socket.id];
    }
    
    console.log('مستخدم انقطع:', socket.id);
  });
});

// API للحصول على الغرف
app.get('/api/rooms', (req, res) => {
  res.json(rooms);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`السيرفر يعمل على المنفذ ${PORT}`);
});