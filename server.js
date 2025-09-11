require('dotenv').config();
const bcrypt = require('bcryptjs');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

// إنشاء اتصال بقاعدة البيانات
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  protocol: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false
});

// تعريف نماذج قاعدة البيانات
const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, primaryKey: true },
  password: { type: DataTypes.STRING, allowNull: false },
  gender: { type: DataTypes.STRING, allowNull: false }
});

const UserRank = sequelize.define('UserRank', {
  username: { type: DataTypes.STRING, primaryKey: true },
  rank: { type: DataTypes.STRING, allowNull: false }
});

const UserManagement = sequelize.define('UserManagement', {
  username: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false },
  roomName: { type: DataTypes.STRING, allowNull: true },
  mutedBy: { type: DataTypes.STRING, allowNull: true },
  bannedBy: { type: DataTypes.STRING, allowNull: true },
  reason: { type: DataTypes.TEXT, allowNull: true },
  expiresAt: { type: DataTypes.DATE, allowNull: true },
  bannedAt: { type: DataTypes.DATE, allowNull: true }
});

const UserAvatar = sequelize.define('UserAvatar', {
  username: { type: DataTypes.STRING, primaryKey: true },
  avatarUrl: { type: DataTypes.TEXT, allowNull: false }
});

const UserSession = sequelize.define('UserSession', {
  sessionId: { type: DataTypes.STRING, primaryKey: true },
  username: { type: DataTypes.STRING, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false }
});

const PrivateMessage = sequelize.define('PrivateMessage', {
  conversationId: { type: DataTypes.STRING, allowNull: false },
  fromUser: { type: DataTypes.STRING, allowNull: false },
  toUser: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  time: { type: DataTypes.STRING, allowNull: false },
  timestamp: { type: DataTypes.BIGINT, allowNull: false }
});

const UserFriend = sequelize.define('UserFriend', {
  username: { type: DataTypes.STRING, allowNull: false },
  friendUsername: { type: DataTypes.STRING, allowNull: false }
});

const FriendRequest = sequelize.define('FriendRequest', {
  fromUser: { type: DataTypes.STRING, allowNull: false },
  toUser: { type: DataTypes.STRING, allowNull: false }
});

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
  rank: "صاحب الموقع"
};

// تخزين البيانات في الذاكرة
let users = {};
let userRanks = {};
let userManagement = {
  mutedUsers: {},
  bannedFromRoom: {},
  bannedFromSite: {}
};
let userAvatars = {};
let userSessions = {};
let privateMessages = {};
let userFriends = {};
let friendRequests = {};

// تحميل البيانات من قاعدة البيانات
async function loadData() {
  try {
    await sequelize.authenticate();
    console.log('تم الاتصال بقاعدة البيانات بنجاح!');
    
    await sequelize.sync();
    
    // تحميل المستخدمين
    const usersData = await User.findAll();
    usersData.forEach(user => {
      users[user.username] = {
        password: user.password,
        gender: user.gender
      };
    });
    
    // تحميل الرتب
    const ranksData = await UserRank.findAll();
    ranksData.forEach(rank => {
      userRanks[rank.username] = rank.rank;
    });
    
    // تحميل إدارة المستخدمين
    const mutedUsers = await UserManagement.findAll({ where: { type: 'mute' } });
    mutedUsers.forEach(mute => {
      userManagement.mutedUsers[mute.username] = {
        mutedBy: mute.mutedBy,
        expiresAt: mute.expiresAt
      };
    });
    
    const roomBans = await UserManagement.findAll({ where: { type: 'room_ban' } });
    roomBans.forEach(ban => {
      if (!userManagement.bannedFromRoom[ban.roomName]) {
        userManagement.bannedFromRoom[ban.roomName] = {};
      }
      userManagement.bannedFromRoom[ban.roomName][ban.username] = {
        bannedBy: ban.bannedBy,
        reason: ban.reason,
        bannedAt: ban.bannedAt
      };
    });
    
    const siteBans = await UserManagement.findAll({ where: { type: 'site_ban' } });
    siteBans.forEach(ban => {
      userManagement.bannedFromSite[ban.username] = {
        bannedBy: ban.bannedBy,
        reason: ban.reason,
        bannedAt: ban.bannedAt
      };
    });
    
    // تحميل الصور
    const avatarsData = await UserAvatar.findAll();
    avatarsData.forEach(avatar => {
      userAvatars[avatar.username] = avatar.avatarUrl;
    });
    
    // تحميل الجلسات
    const sessionsData = await UserSession.findAll();
    sessionsData.forEach(session => {
      userSessions[session.sessionId] = {
        username: session.username,
        password: session.password
      };
    });
    
    // تحميل الأصدقاء
    const friendsData = await UserFriend.findAll();
    friendsData.forEach(friend => {
      if (!userFriends[friend.username]) {
        userFriends[friend.username] = [];
      }
      userFriends[friend.username].push(friend.friendUsername);
    });
    
    // تحميل طلبات الصداقة
    const requestsData = await FriendRequest.findAll();
    requestsData.forEach(request => {
      if (!friendRequests[request.toUser]) {
        friendRequests[request.toUser] = [];
      }
      friendRequests[request.toUser].push(request.fromUser);
    });
    // تحميل الرسائل الخاصة
    const privateMessagesData = await PrivateMessage.findAll({
      order: [['timestamp', 'ASC']]
    });
    privateMessagesData.forEach(msg => {
      const conversationId = msg.conversationId;
      if (!privateMessages[conversationId]) {
        privateMessages[conversationId] = [];
      }
      privateMessages[conversationId].push({
        from: msg.fromUser,
        to: msg.toUser,
        content: msg.content,
        time: msg.time,
        timestamp: msg.timestamp
      });
    });
    
    // التأكد من وجود حساب صاحب الموقع
    if (!users[SITE_OWNER.username]) {
      await User.create({
        username: SITE_OWNER.username,
        password: SITE_OWNER.password,
        gender: 'male'
      });
      
      await UserRank.create({
        username: SITE_OWNER.username,
        rank: SITE_OWNER.rank
      });
      
      users[SITE_OWNER.username] = {
        password: SITE_OWNER.password,
        gender: 'male'
      };
      
      userRanks[SITE_OWNER.username] = SITE_OWNER.rank;
    }
    
    console.log('تم تحميل البيانات من قاعدة البيانات بنجاح!');
  } catch (error) {
    console.log('خطأ في تحميل البيانات:', error);
  }
}

// دوال الحفظ في قاعدة البيانات
async function saveUser(username, userData) {
  try {
    const [user, created] = await User.findOrCreate({
      where: { username },
      defaults: {
        password: userData.password,
        gender: userData.gender
      }
    });
    
    if (!created) {
      await user.update({
        password: userData.password,
        gender: userData.gender
      });
    }
  } catch (error) {
    console.error('خطأ في حفظ المستخدم:', error);
  }
}

async function saveUserRank(username, rank) {
  try {
    const [userRank, created] = await UserRank.findOrCreate({
      where: { username },
      defaults: { rank }
    });
    
    if (!created) {
      await userRank.update({ rank });
    }
  } catch (error) {
    console.error('خطأ في حفظ رتبة المستخدم:', error);
  }
}

async function removeUserRank(username) {
  try {
    await UserRank.destroy({ where: { username } });
  } catch (error) {
    console.error('خطأ في إزالة رتبة المستخدم:', error);
  }
}

async function saveUserAvatar(username, avatarUrl) {
  try {
    const [avatar, created] = await UserAvatar.findOrCreate({
      where: { username },
      defaults: { avatarUrl }
    });
    
    if (!created) {
      await avatar.update({ avatarUrl });
    }
  } catch (error) {
    console.error('خطأ في حفظ صورة المستخدم:', error);
  }
}

async function saveUserSession(sessionId, username, password) {
  try {
    await UserSession.create({
      sessionId,
      username,
      password
    });
  } catch (error) {
    console.error('خطأ في حفظ جلسة المستخدم:', error);
  }
}

async function removeUserSession(sessionId) {
  try {
    await UserSession.destroy({ where: { sessionId } });
  } catch (error) {
    console.error('خطأ في إزالة جلسة المستخدم:', error);
  }
}

async function savePrivateMessage(conversationId, fromUser, toUser, content, time, timestamp) {
  try {
    await PrivateMessage.create({
      conversationId,
      fromUser,
      toUser,
      content,
      time,
      timestamp
    });
  } catch (error) {
    console.error('خطأ في حفظ الرسالة الخاصة:', error);
  }
}

async function saveFriendRequest(fromUser, toUser) {
  try {
    await FriendRequest.create({
      fromUser,
      toUser
    });
  } catch (error) {
    console.error('خطأ في حفظ طلب الصداقة:', error);
  }
}

async function removeFriendRequest(fromUser, toUser) {
  try {
    await FriendRequest.destroy({
      where: {
        fromUser,
        toUser
      }
    });
  } catch (error) {
    console.error('خطأ في إزالة طلب الصداقة:', error);
  }
}

async function saveUserFriend(username, friendUsername) {
  try {
    await UserFriend.create({
      username,
      friendUsername
    });
  } catch (error) {
    console.error('خطأ في حفظ الصداقة:', error);
  }
}

async function removeUserFriend(username, friendUsername) {
  try {
    await UserFriend.destroy({
      where: {
        username,
        friendUsername
      }
    });
  } catch (error) {
    console.error('خطأ في إزالة الصداقة:', error);
  }
}

async function saveMuteUser(username, mutedBy, expiresAt) {
  try {
    await UserManagement.create({
      username,
      type: 'mute',
      mutedBy,
      expiresAt
    });
  } catch (error) {
    console.error('خطأ في حفظ كتم المستخدم:', error);
  }
}

async function removeMuteUser(username) {
  try {
    await UserManagement.destroy({
      where: {
        username,
        type: 'mute'
      }
    });
  } catch (error) {
    console.error('خطأ في إزالة كتم المستخدم:', error);
  }
}

async function saveRoomBan(username, roomName, bannedBy, reason) {
  try {
    await UserManagement.create({
      username,
      type: 'room_ban',
      roomName,
      bannedBy,
      reason,
      bannedAt: new Date()
    });
  } catch (error) {
    console.error('خطأ في حفظ حظر الغرفة:', error);
  }
}

async function removeRoomBan(username, roomName) {
  try {
    await UserManagement.destroy({
      where: {
        username,
        type: 'room_ban',
        roomName
      }
    });
  } catch (error) {
    console.error('خطأ في إزالة حظر الغرفة:', error);
  }
}

async function saveSiteBan(username, bannedBy, reason) {
  try {
    await UserManagement.create({
      username,
      type: 'site_ban',
      bannedBy,
      reason,
      bannedAt: new Date()
    });
  } catch (error) {
    console.error('خطأ في حفظ حظر الموقع:', error);
  }
}

async function removeSiteBan(username) {
  try {
    await UserManagement.destroy({
      where: {
        username,
        type: 'site_ban'
      }
    });
  } catch (error) {
    console.error('خطأ في إزالة حظر الموقع:', error);
  }
}

async function removeUser(username) {
  try {
    await User.destroy({ where: { username } });
    await UserRank.destroy({ where: { username } });
    await UserAvatar.destroy({ where: { username } });
    await UserSession.destroy({ where: { username } });
    await UserManagement.destroy({ where: { username } });
    await UserFriend.destroy({ where: { username } });
    await UserFriend.destroy({ where: { friendUsername: username } });
    await FriendRequest.destroy({ where: { fromUser: username } });
    await FriendRequest.destroy({ where: { toUser: username } });
  } catch (error) {
    console.error('خطأ في حذف المستخدم:', error);
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
  
  if (userManagement.mutedUsers[username]) {
    const muteInfo = userManagement.mutedUsers[username];
    if (new Date() < new Date(muteInfo.expiresAt)) return false;
    delete userManagement.mutedUsers[username];
    removeMuteUser(username);
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
  socket.on('check session', async (sessionId) => {
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
  socket.on('user login', async (userData) => {
  // التحقق من صاحب الموقع أولاً
  if (userData.username === SITE_OWNER.username) {
    try {
      // البحث عن مستخدم صاحب الموقع في قاعدة البيانات
      const ownerUser = await User.findOne({ where: { username: SITE_OWNER.username } });
      
      if (ownerUser) {
        const isPasswordValid = await bcrypt.compare(userData.password, ownerUser.password);
        
        if (isPasswordValid) {
          const sessionId = 'session_' + Date.now() + Math.random().toString(36).substr(2, 9);
          userSessions[sessionId] = { 
            username: userData.username, 
            password: ownerUser.password 
          };
          
          await saveUserSession(sessionId, userData.username, ownerUser.password);
          
          socket.emit('login success', {
            name: userData.username,
            rank: SITE_OWNER.rank,
            isSiteOwner: true,
            socketId: socket.id,
            sessionId: sessionId
          });
          return;
        }
      }
    } catch (error) {
      console.error('خطأ في التحقق من صاحب الموقع:', error);
    }
  }
  // ثم التحقق من المستخدمين العاديين
  else if (users[userData.username]) {
    const isPasswordValid = await bcrypt.compare(userData.password, users[userData.username].password);
    if (isPasswordValid) {
      const sessionId = 'session_' + Date.now() + Math.random().toString(36).substr(2, 9);
      userSessions[sessionId] = { username: userData.username, password: users[userData.username].password };
      await saveUserSession(sessionId, userData.username, users[userData.username].password);
      
      socket.emit('login success', {
        name: userData.username,
        rank: userRanks[userData.username] || null,
        isSiteOwner: false,
        gender: users[userData.username].gender,
        socketId: socket.id,
        sessionId: sessionId
      });
      return;
    }
  }
  
  socket.emit('login error', 'اسم المستخدم أو كلمة السر غير صحيحة!');
});

  // حدث إنشاء حساب
  socket.on('user register', async (userData) => {
  if (users[userData.username]) {
    socket.emit('register error', 'اسم المستخدم موجود مسبقاً!');
    return;
  }
  
  // تشفير كلمة السر
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  
  users[userData.username] = {
    password: hashedPassword, // حفظ كلمة السر المشفرة
    gender: userData.gender
  };
  
  await saveUser(userData.username, users[userData.username]);
  
  const sessionId = 'session_' + Date.now() + Math.random().toString(36).substr(2, 9);
  userSessions[sessionId] = { username: userData.username, password: hashedPassword };
  await saveUserSession(sessionId, userData.username, hashedPassword);
  
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
    
    // إضافة الرسالة للسجل (الرسائل الجديدة فقط)
    if (!messages[roomId]) messages[roomId] = [];
    if (messages[roomId].length > 50) {
      messages[roomId] = messages[roomId].slice(-50);
    }
    messages[roomId].push(welcomeMessage);
    
    // إرسال الرسالة للغرفة
    io.to(roomId).emit('new message', welcomeMessage);
    
    // إرسال تاريخ المحادثة للمستخدم الجديد (الرسائل الحديثة فقط)
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
    if (messages[roomId].length > 50) {
      messages[roomId] = messages[roomId].slice(-50);
    }
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
  socket.on('assign rank', async (data) => {
    const { username, rank, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageRanks(currentUser, room.name)) {
      socket.emit('rank error', 'ليس لديك صلاحية لإدارة الرتب');
      return;
    }
    
    userRanks[username] = rank;
    await saveUserRank(username, rank);
    
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

  socket.on('remove rank', async (data) => {
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
      await removeUserRank(username);
      
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
  socket.on('mute user', async (data) => {
    const { username, duration, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageUsers(currentUser, room.name)) {
      socket.emit('management error', 'ليس لديك صلاحية لإدارة المستخدمين');
      return;
    }
    
    // منع كتم صاحب الموقع
    if (username === SITE_OWNER.username) {
      socket.emit('management error', 'لا يمكن كتم صاحب الموقع');
      return;
    }
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + parseInt(duration));
    
    userManagement.mutedUsers[username] = {
      mutedBy: currentUser.name,
      expiresAt: expiresAt.toISOString()
    };
    
    await saveMuteUser(username, currentUser.name, expiresAt);
    
    const notificationMessage = {
      type: 'system',
      content: `🔇 تم كتم المستخدم ${username} لمدة ${duration} دقيقة من قبل ${currentUser.name} (في جميع الغرف)`,
      time: new Date().toLocaleTimeString('ar-SA')
    };
    
    io.emit('new message', notificationMessage);
    Object.keys(messages).forEach(roomId => {
      messages[roomId].push(notificationMessage);
    });
    
    socket.emit('management success', `تم كتم المستخدم ${username} في جميع الغرف بنجاح`);
  });

  socket.on('unmute user', async (data) => {
    const { username, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageUsers(currentUser, room.name)) {
      socket.emit('management error', 'ليس لديك صلاحية لإدارة المستخدمين');
      return;
    }
    
    if (userManagement.mutedUsers[username]) {
      delete userManagement.mutedUsers[username];
      await removeMuteUser(username);
      
      const notificationMessage = {
        type: 'system',
        content: `🔊 تم إلغاء كتم المستخدم ${username} من قبل ${currentUser.name} (في جميع الغرف)`,
        time: new Date().toLocaleTimeString('ar-SA')
      };
      
      io.emit('new message', notificationMessage);
      Object.keys(messages).forEach(roomId => {
        messages[roomId].push(notificationMessage);
      });
      
      socket.emit('management success', `تم إلغاء كتم المستخدم ${username} في جميع الغرف بنجاح`);
    } else {
      socket.emit('management error', 'المستخدم غير مكتوم');
    }
  });

  socket.on('ban from room', async (data) => {
    const { username, reason, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageUsers(currentUser, room.name)) {
      socket.emit('management error', 'ليس لديك صلاحية لإدارة المستخدمين');
      return;
    }
    
    // منع حظر صاحب الموقع
    if (username === SITE_OWNER.username) {
      socket.emit('management error', 'لا يمكن حظر صاحب الموقع');
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
    
    await saveRoomBan(username, room.name, currentUser.name, reason || 'غير محدد');
    
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

  socket.on('unban from room', async (data) => {
    const { username, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageUsers(currentUser, room.name)) {
      socket.emit('management error', 'ليس لديك صلاحية لإدارة المستخدمين');
      return;
    }
    
    if (userManagement.bannedFromRoom[room.name] && userManagement.bannedFromRoom[room.name][username]) {
      delete userManagement.bannedFromRoom[room.name][username];
      await removeRoomBan(username, room.name);
      
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

  socket.on('ban from site', async (data) => {
    const { username, reason, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageUsers(currentUser, room.name)) {
      socket.emit('management error', 'ليس لديك صلاحية لإدارة المستخدمين');
      return;
    }
    
    // منع حظر صاحب الموقع
    if (username === SITE_OWNER.username) {
      socket.emit('management error', 'لا يمكن حظر صاحب الموقع');
      return;
    }
    
    userManagement.bannedFromSite[username] = {
      bannedBy: currentUser.name,
      reason: reason || 'غير محدد',
      bannedAt: new Date().toISOString()
    };
    
    await saveSiteBan(username, currentUser.name, reason || 'غير محدد');
    
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

  socket.on('unban from site', async (data) => {
    const { username, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageUsers(currentUser, room.name)) {
      socket.emit('management error', 'ليس لديك صلاحية لإدارة المستخدمين');
      return;
    }
    
    if (userManagement.bannedFromSite[username]) {
      delete userManagement.bannedFromSite[username];
      await removeSiteBan(username);
      
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

  socket.on('delete user', async (data) => {
    const { username, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!room || !canManageUsers(currentUser, room.name)) {
      socket.emit('management error', 'ليس لديك صلاحية لإدارة المستخدمين');
      return;
    }
    
    // منع حذف صاحب الموقع
    if (username === SITE_OWNER.username) {
      socket.emit('management error', 'لا يمكن حذف صاحب الموقع');
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
      
      await removeUser(username);
      
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
    
    // حالة الكتم (الآن عام على جميع الغرف)
    if (userManagement.mutedUsers[username]) {
      const muteInfo = userManagement.mutedUsers[username];
      const expiresAt = new Date(muteInfo.expiresAt);
      const timeLeft = Math.max(0, expiresAt - new Date());
      const minutesLeft = Math.ceil(timeLeft / (1000 * 60));
      status += `🔇 مكتوم في جميع الغرف (لمدة ${minutesLeft} دقيقة متبقية, بواسطة: ${muteInfo.mutedBy})\n\n`;
    } else {
      status += `🔊 غير مكتوم في أي غرفة\n\n`;
    }
    
    // الرتبة
    if (userRanks[username]) {
      status += `👑 الرتبة: ${userRanks[username]}\n`;
    } else {
      status += `👤 بدون رتبة\n`;
    }
    
    // حالة الاتصال
    const isOnline = Object.values(onlineUsers).some(user => user.name === username);
    status += `📱 حالة الاتصال: ${isOnline ? '🟢 متصل' : '🔴 غير متصل'}\n`;
    
    const systemMessage = {
      type: 'system',
      content: status,
      time: new Date().toLocaleTimeString('ar-SA')
    };
    
    socket.emit('user status', systemMessage);
  });

  // حدث إدارة الصور
  socket.on('update avatar', async (data) => {
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
    await saveUserAvatar(username, avatarUrl);
    
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

  // أحداث الرسائل الخاصة
  socket.on('get user profile', (data) => {
    const { username } = data;
    const isOnline = Object.values(onlineUsers).some(user => user.name === username);
    const userRank = userRanks[username] || null;
    const avatar = userAvatars[username] || null;
    const userData = users[username];
    
    socket.emit('user profile data', {
      username,
      isOnline,
      rank: userRank,
      avatar,
      gender: userData ? userData.gender : null
    });
  });

  socket.on('send private message', async (data) => {
    const { toUser, message, fromUser } = data;
    
    // حفظ الرسالة الخاصة
    const conversationId = [fromUser, toUser].sort().join('_');
    if (!privateMessages[conversationId]) {
      privateMessages[conversationId] = [];
    }
    
    const privateMessage = {
      from: fromUser,
      to: toUser,
      content: message,
      time: new Date().toLocaleTimeString('ar-SA'),
      timestamp: new Date().getTime()
    };
    
    privateMessages[conversationId].push(privateMessage);
    await savePrivateMessage(conversationId, fromUser, toUser, message, privateMessage.time, privateMessage.timestamp);
    
    // إرسال الرسالة للمرسل
    socket.emit('private message sent', privateMessage);
    
    // إرسال الرسالة للمستلم إذا كان متصلاً
    const recipientSocketId = Object.keys(onlineUsers).find(
      socketId => onlineUsers[socketId].name === toUser
    );
    
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('new private message', privateMessage);
    }
  });

  socket.on('get private messages', (data) => {
    const { otherUser, currentUser } = data;
    const conversationId = [currentUser, otherUser].sort().join('_');
    const messages = privateMessages[conversationId] || [];
    
    socket.emit('private messages history', messages);
  });

  // أحداث نظام الصداقات
  socket.on('send friend request', async (data) => {
    const { fromUser, toUser } = data;
    
    if (!friendRequests[toUser]) {
      friendRequests[toUser] = [];
    }
    
    // تجنب إرسال طلب صداقة مكرر
    if (!friendRequests[toUser].includes(fromUser)) {
      friendRequests[toUser].push(fromUser);
      await saveFriendRequest(fromUser, toUser);
      
      // إرسال إشعار للمستلم إذا كان متصلاً
      const recipientSocketId = Object.keys(onlineUsers).find(
        socketId => onlineUsers[socketId].name === toUser
      );
      
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('new friend request', { fromUser });
      }
      
      socket.emit('friend request sent', `تم إرسال طلب صداقة إلى ${toUser}`);
    } else {
      socket.emit('friend request error', 'لقد أرسلت طلب صداقة مسبقاً لهذا المستخدم');
    }
  });

  socket.on('accept friend request', async (data) => {
    const { fromUser, toUser } = data;
    
    if (friendRequests[toUser] && friendRequests[toUser].includes(fromUser)) {
      // إضافة الصديق إلى قائمة الأصدقاء
      if (!userFriends[fromUser]) {
        userFriends[fromUser] = [];
      }
      if (!userFriends[toUser]) {
        userFriends[toUser] = [];
      }
      
      if (!userFriends[fromUser].includes(toUser)) {
        userFriends[fromUser].push(toUser);
        await saveUserFriend(fromUser, toUser);
      }
      if (!userFriends[toUser].includes(fromUser)) {
        userFriends[toUser].push(fromUser);
        await saveUserFriend(toUser, fromUser);
      }
      
      // إزالة طلب الصداقة
      friendRequests[toUser] = friendRequests[toUser].filter(user => user !== fromUser);
      await removeFriendRequest(fromUser, toUser);
      
      // إرسال إشعار للمرسل
      const senderSocketId = Object.keys(onlineUsers).find(
        socketId => onlineUsers[socketId].name === fromUser
      );
      
      if (senderSocketId) {
        io.to(senderSocketId).emit('friend request accepted', { byUser: toUser });
      }
      
      socket.emit('friend request processed', `أنت الآن صديق مع ${fromUser}`);
    } else {
      socket.emit('friend request error', 'طلب الصداقة غير موجود');
    }
  });

  socket.on('reject friend request', async (data) => {
    const { fromUser, toUser } = data;
    
    if (friendRequests[toUser] && friendRequests[toUser].includes(fromUser)) {
      // إزالة طلب الصداقة
      friendRequests[toUser] = friendRequests[toUser].filter(user => user !== fromUser);
      await removeFriendRequest(fromUser, toUser);
      
      socket.emit('friend request processed', 'تم رفض طلب الصداقة');
    } else {
      socket.emit('friend request error', 'طلب الصداقة غير موجود');
    }
  });

  socket.on('remove friend', async (data) => {
    const { username, friendToRemove } = data;
    
    if (userFriends[username] && userFriends[username].includes(friendToRemove)) {
      userFriends[username] = userFriends[username].filter(friend => friend !== friendToRemove);
      await removeUserFriend(username, friendToRemove);
      
      if (userFriends[friendToRemove] && userFriends[friendToRemove].includes(username)) {
        userFriends[friendToRemove] = userFriends[friendToRemove].filter(friend => friend !== username);
        await removeUserFriend(friendToRemove, username);
      }
      
      // إرسال إشعار للطرف الآخر إذا كان متصلاً
      const friendSocketId = Object.keys(onlineUsers).find(
        socketId => onlineUsers[socketId].name === friendToRemove
      );
      
      if (friendSocketId) {
        io.to(friendSocketId).emit('friend removed you', { byUser: username });
      }
      
      socket.emit('friend removed', `تم إزالة ${friendToRemove} من قائمة أصدقائك`);
    } else {
      socket.emit('friend error', 'هذا المستخدم ليس في قائمة أصدقائك');
    }
  });

  socket.on('get friend requests', (username) => {
    const requests = friendRequests[username] || [];
    socket.emit('friend requests list', requests);
  });

  socket.on('get friends list', (username) => {
    const friends = userFriends[username] || [];
    socket.emit('friends list', friends);
  });

  socket.on('search users', (data) => {
    const { query, currentUser } = data;
    const results = Object.keys(users)
      .filter(username => 
        username.toLowerCase().includes(query.toLowerCase()) && 
        username !== currentUser
      )
      .slice(0, 10); // الحد الأقصى للنتائج
    
    socket.emit('search results', results);
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