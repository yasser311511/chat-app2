require('dotenv').config();
const bcrypt = require('bcryptjs');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');
const { Sequelize, DataTypes } = require('sequelize');
const multer = require('multer');
const fs = require('fs');


// إنشاء اتصال بقاعدة البيانات
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  protocol: 'postgres',
  pool: {
    max: 30,
    min: 10,
    acquire: 60000,
    idle: 10000,
    evict: 10000
  },
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    },
    keepAlive: true,
    connectTimeout: 60000
  },
  retry: {
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/,
      /TimeoutError/
    ],
    max: 5
  },
  logging: false
});

// تعريف نماذج قاعدة البيانات
const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, primaryKey: true },
  password: { type: DataTypes.STRING, allowNull: false },
  gender: { type: DataTypes.STRING, allowNull: false },
  bio: { type: DataTypes.TEXT, allowNull: true },
  nameColor: { type: DataTypes.STRING, allowNull: true },
  nameBackground: { type: DataTypes.STRING, allowNull: true },
  avatarFrame: { type: DataTypes.STRING, allowNull: true },
  userCardBackground: { type: DataTypes.STRING, allowNull: true },
  profileBackground: { type: DataTypes.STRING, allowNull: true },
  profileCover: { type: DataTypes.TEXT, allowNull: true }
});

const UserRank = sequelize.define('UserRank', {
  username: { type: DataTypes.STRING, primaryKey: true },
  rank: { type: DataTypes.STRING, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: true } // تاريخ انتهاء الرتبة
});

const RankDefinition = sequelize.define('RankDefinition', {
  name: { type: DataTypes.STRING, primaryKey: true },
  color: { type: DataTypes.STRING, allowNull: false },
  icon: { type: DataTypes.TEXT, allowNull: false }, // تغيير إلى TEXT لدعم الصور الكبيرة
  level: { type: DataTypes.INTEGER, allowNull: false },
  wingId: { type: DataTypes.STRING, allowNull: true }
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
}, {
  indexes: [{ fields: ['username'] }, { fields: ['type'] }]
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
  read: { type: DataTypes.BOOLEAN, defaultValue: false },
  time: { type: DataTypes.STRING, allowNull: false }, // يمكن إزالته لاحقاً والاعتماد على timestamp
  timestamp: { type: DataTypes.BIGINT, allowNull: false }
}, {
  indexes: [{ fields: ['conversationId'] }, { fields: ['toUser'] }, { fields: ['fromUser'] }]
});

const UserFriend = sequelize.define('UserFriend', {
  username: { type: DataTypes.STRING, allowNull: false },
  friendUsername: { type: DataTypes.STRING, allowNull: false }
}, {
  indexes: [{ fields: ['username'] }]
});

const FriendRequest = sequelize.define('FriendRequest', {
  fromUser: { type: DataTypes.STRING, allowNull: false },
  toUser: { type: DataTypes.STRING, allowNull: false }
}, {
  indexes: [{ fields: ['toUser'] }]
});

const ShopItem = sequelize.define('ShopItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: { type: DataTypes.TEXT, allowNull: false },
  price: { type: DataTypes.INTEGER, allowNull: false },
  itemType: { type: DataTypes.STRING, allowNull: false }, // e.g., 'rank', 'name_change_card', 'name_color'
  itemValue: { type: DataTypes.STRING, allowNull: true } // e.g., 'بريميوم'
});

const UserInventory = sequelize.define('UserInventory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING, allowNull: false },
  itemId: { type: DataTypes.INTEGER, allowNull: false }
}, {
  indexes: [{ fields: ['username'] }]
});
const UserPoints = sequelize.define('UserPoints', {
  username: { type: DataTypes.STRING, primaryKey: true },
  points: { type: DataTypes.INTEGER, defaultValue: 0 },
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  isInfinite: { type: DataTypes.BOOLEAN, defaultValue: false },
  showInTop: { type: DataTypes.BOOLEAN, defaultValue: true }
});
const UserLastSeen = sequelize.define('UserLastSeen', {
  username: { type: DataTypes.STRING, primaryKey: true },
  lastSeen: { type: DataTypes.BIGINT, allowNull: false }
});

// إضافة بعد نماذج قاعدة البيانات الأخرى
const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  recipientUsername: { type: DataTypes.STRING, allowNull: false },
  senderUsername: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false }, // 'like', 'comment'
  postId: { type: DataTypes.INTEGER, allowNull: true },
  read: { type: DataTypes.BOOLEAN, defaultValue: false },
  timestamp: { type: DataTypes.BIGINT, allowNull: false }
}, {
  indexes: [{ fields: ['recipientUsername'] }]
});

const ChatImage = sequelize.define('ChatImage', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  messageId: { type: DataTypes.STRING, allowNull: false },
  roomId: { type: DataTypes.INTEGER, allowNull: true },
  conversationId: { type: DataTypes.STRING, allowNull: true },
  fromUser: { type: DataTypes.STRING, allowNull: false },
  toUser: { type: DataTypes.STRING, allowNull: true }, // أضف هذا الحقل
  imageData: { type: DataTypes.TEXT, allowNull: false },
  timestamp: { type: DataTypes.BIGINT, allowNull: false }
});

const RoomManager = sequelize.define('RoomManager', {
  roomId: { type: DataTypes.INTEGER, primaryKey: true },
  managerUsername: { type: DataTypes.STRING, primaryKey: true },
  assignedBy: { type: DataTypes.STRING, allowNull: false },
  assignedAt: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
});

const RoomBackground = sequelize.define('RoomBackground', {
  roomId: { type: DataTypes.INTEGER, primaryKey: true },
  backgroundType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'gradient' },
  backgroundValue: { type: DataTypes.TEXT, allowNull: false },
  setBy: { type: DataTypes.STRING, allowNull: false }
});

const RoomSettings = sequelize.define('RoomSettings', {
  roomId: { type: DataTypes.INTEGER, primaryKey: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  textColor: { type: DataTypes.STRING, allowNull: true, defaultValue: 'text-white' },
  messageBackground: { type: DataTypes.STRING, allowNull: true, defaultValue: 'bg-gray-800' },
  updatedBy: { type: DataTypes.STRING, allowNull: false }
});

const Room = sequelize.define('Room', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  icon: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  protected: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  createdBy: { type: DataTypes.STRING, allowNull: false },
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
});

// استدعاء التهيئة بعد الاتصال
// loadData(); // تم نقله إلى startServer() لمنع التكرار



const compression = require('compression');
const app = express();
app.use(compression());
const server = http.createServer(app);
const io = socketIo(server, {
  pingTimeout: 30000,
  pingInterval: 10000,
  connectTimeout: 45000,
  maxHttpBufferSize: 1e7
});

// نظام الرتب
let ranks = {
  'صاحب الموقع': { color: 'from-red-600 to-orange-400', icon: '🏆', level: 100 }, // مستوى 100 ليكون الأعلى دائماً
  'رئيس': { color: 'from-yellow-400 to-yellow-500', icon: '🎩', level: 5 },
  'رئيسة': { color: 'from-yellow-400 to-yellow-500', icon: '🎩', level: 5 },
  'منشئ': { color: 'from-yellow-400 to-orange-500', icon: '👑', level: 4 },
  'سوبر ادمن': { color: 'from-red-500 to-pink-600', icon: '⭐', level: 3 },
  'ادمن': { color: 'from-purple-500 to-indigo-600', icon: '🛡️', level: 2 },
  'بريميوم': { color: 'from-green-500 to-emerald-600', icon: '💎', level: 2 },
  'جيد': { color: 'from-blue-500 to-cyan-600', icon: '❇️', level: 1 }
};

// قائمة المستخدمين الخاصين (نقاط ومستوى ثابت)
const SPECIAL_USERS_CONFIG = {
  "Walid dz 31": { points: 999999, level: 999999 },
  "سيد احمد": { points: 999999, level: 999999 },
  "ميارا": { points: 999999, level: 999999 }
};

// المستخدم الخاص
const SITE_OWNER = {
  username: "Walid dz 31",
  rank: "صاحب الموقع",
  password: "change_this_password" // <-- كلمة مرور افتراضية، يجب تغييرها
};
const Post = sequelize.define('Post', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    timestamp: { type: DataTypes.BIGINT, allowNull: false }
});

const PostLike = sequelize.define('PostLike', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    postId: { type: DataTypes.INTEGER, allowNull: false },
    username: { type: DataTypes.STRING, allowNull: false },
    timestamp: { type: DataTypes.BIGINT, allowNull: false }
});

const PostComment = sequelize.define('PostComment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    postId: { type: DataTypes.INTEGER, allowNull: false },
    username: { type: DataTypes.STRING, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    timestamp: { type: DataTypes.BIGINT, allowNull: false }
});

// تخزين البيانات في الذاكرة
let users = {};
let userRanks = {};
let userRankExpiry = {}; // لتخزين تواريخ انتهاء الرتب في الذاكرة
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
let userPoints = {};
let shopItems = [];
let userInventories = {};
let userLastSeen = {}; // لتخزين آخر ظهور للمستخدم
let roomManagers = {}; // لتخزين مديري الغرف { roomId: [usernames] }
let roomBackgrounds = {}; // لتخزين خلفيات الغرف { roomId: { type, value } }
let roomSettings = {}; // لتخزين إعدادات الغرف { roomId: { description, textColor, messageBackground } }
let posts = {};
let postLikes = {};
let postComments = {};
let chatImages = {};
let drawingHistory = []; // تخزين تاريخ الرسم

// --- متغير للتحقق من جاهزية السيرفر ---
let isServerReady = false;

// --- دالة للتحقق من وجود عمود في جدول ---
async function columnExists(tableName, columnName) {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tableDescription = await queryInterface.describeTable(tableName);
    return tableDescription.hasOwnProperty(columnName);
  } catch (error) {
    console.error(`خطأ في التحقق من العمود ${columnName} في جدول ${tableName}:`, error);
    return false;
  }
}

// --- إعدادات بوت مكافحة الإزعاج ---
const userMessageHistory = {};
const SPAM_MESSAGE_COUNT = 10;
const SPAM_TIME_WINDOW_MS = 15000; // 15 ثانية
const SPAM_MUTE_DURATION_MIN = 10;
const BOT_AVATAR_URL = 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=system-bot';

// --- متغير لتتبع آخر نشاط للمستخدم لمنع التكرار (Debounce) ---
const userLastAction = {};


// تحميل البيانات من قاعدة البيانات
async function loadData() {
  try {
    await sequelize.authenticate();
    console.log('تم الاتصال بقاعدة البيانات بنجاح!');
    
    // مزامنة جميع النماذج مرة واحدة بدلاً من المزامنة المتكررة
    await sequelize.sync();
    console.log('تم مزامنة قاعدة البيانات بنجاح');

    // تحميل جميع البيانات بالتوازي لتقليل وقت بدء التشغيل
    const [
      usersData, ranksData, storedRankDefinitions,
      mutedUsers, roomBans, siteBans,
      avatarsData, sessionsData, friendsData,
      pointsData, lastSeenData, roomManagersData,
      roomBgData, roomSettingsData, dbRooms,
      inventoriesData, requestsData, privateMessagesData,
      chatImagesData, privateImagesData, postsData,
      likesData, commentsData
    ] = await Promise.all([
      User.findAll(), UserRank.findAll(), RankDefinition.findAll(),
      UserManagement.findAll({ where: { type: 'mute' } }), UserManagement.findAll({ where: { type: 'room_ban' } }), UserManagement.findAll({ where: { type: 'site_ban' } }),
      UserAvatar.findAll(), UserSession.findAll(), UserFriend.findAll(),
      UserPoints.findAll(), UserLastSeen.findAll(), RoomManager.findAll(),
      RoomBackground.findAll(), RoomSettings.findAll(), Room.findAll({ order: [['order', 'ASC'], ['id', 'ASC']] }),
      UserInventory.findAll(), FriendRequest.findAll(), PrivateMessage.findAll({ order: [['timestamp', 'DESC']], limit: 500 }),
      ChatImage.findAll({ where: { roomId: { [Sequelize.Op.ne]: null } }, order: [['timestamp', 'DESC']], limit: 300 }), 
      ChatImage.findAll({ where: { conversationId: { [Sequelize.Op.ne]: null } }, order: [['timestamp', 'DESC']], limit: 300 }),
      Post.findAll({ order: [['timestamp', 'DESC']], limit: 100 }), PostLike.findAll(), PostComment.findAll({ order: [['timestamp', 'ASC']] })
    ]);

    // معالجة البيانات المحملة
    usersData.forEach(user => {
      users[user.username] = {
        password: user.password, gender: user.gender, bio: user.bio,
        nameColor: user.nameColor, nameBackground: user.nameBackground,
        avatarFrame: user.avatarFrame, userCardBackground: user.userCardBackground,
        profileBackground: user.profileBackground, profileCover: user.profileCover
      };
    });
    
    ranksData.forEach(rank => {
      userRanks[rank.username] = rank.rank;
      if (rank.expiresAt) userRankExpiry[rank.username] = rank.expiresAt;
    });

    if (storedRankDefinitions.length > 0) {
        ranks = {};
        storedRankDefinitions.forEach(r => {
            ranks[r.name] = { color: r.color, icon: r.icon, level: r.level, wingId: r.wingId };
        });
    } else {
        for (const [name, data] of Object.entries(ranks)) {
             const wingId = data.level >= 5 ? 'owners' : (data.level >= 3 ? 'kings' : 'distinguished');
             await RankDefinition.findOrCreate({ where: { name }, defaults: { color: data.color, icon: data.icon, level: data.level, wingId } });
             ranks[name].wingId = wingId;
        }
    }
    if (ranks['صاحب الموقع']) ranks['صاحب الموقع'].level = 100;
    
    mutedUsers.forEach(mute => { userManagement.mutedUsers[mute.username] = { mutedBy: mute.mutedBy, expiresAt: mute.expiresAt }; });
    roomBans.forEach(ban => {
      if (!userManagement.bannedFromRoom[ban.roomName]) userManagement.bannedFromRoom[ban.roomName] = {};
      userManagement.bannedFromRoom[ban.roomName][ban.username] = { bannedBy: ban.bannedBy, reason: ban.reason, bannedAt: ban.bannedAt };
    });
    siteBans.forEach(ban => { userManagement.bannedFromSite[ban.username] = { bannedBy: ban.bannedBy, reason: ban.reason, bannedAt: ban.bannedAt }; });
    
    avatarsData.forEach(avatar => userAvatars[avatar.username] = avatar.avatarUrl);
    sessionsData.forEach(session => userSessions[session.sessionId] = { username: session.username, password: session.password });
    friendsData.forEach(friend => {
      if (!userFriends[friend.username]) userFriends[friend.username] = [];
      userFriends[friend.username].push(friend.friendUsername);
    });

    pointsData.forEach(point => { userPoints[point.username] = { points: point.points, level: point.level, isInfinite: point.isInfinite || false, showInTop: point.showInTop !== false }; });
    lastSeenData.forEach(seen => userLastSeen[seen.username] = parseInt(seen.lastSeen, 10));

    roomManagersData.forEach(manager => {
      if (!roomManagers[manager.roomId]) roomManagers[manager.roomId] = [];
      roomManagers[manager.roomId].push(manager.managerUsername);
    });
    roomBgData.forEach(bg => roomBackgrounds[bg.roomId] = { type: bg.backgroundType, value: bg.backgroundValue });
    roomSettingsData.forEach(setting => {
      roomSettings[setting.roomId] = { description: setting.description, textColor: setting.textColor, messageBackground: setting.messageBackground };
    });

    if (dbRooms.length > 0) {
      rooms = dbRooms.map(room => ({ 
        id: room.id, 
        name: room.name, 
        icon: room.icon, 
        description: room.description, 
        protected: room.protected, 
        order: room.order, 
        users: [], 
        managers: roomManagers[room.id] || [],
        background: roomBackgrounds[room.id],
        settings: roomSettings[room.id]
      }));
    } else {
      const defaultRooms = [
        { name: 'غرفة العامة', icon: '💬', description: 'محادثات عامة ومتنوعة', protected: false, order: 1 },
        { name: 'غرفة التقنية', icon: '💻', description: 'مناقشات تقنية وبرمجة', protected: false, order: 2 },
        { name: 'غرفة الرياضة', icon: '⚽', description: 'أخبار ومناقشات رياضية', protected: false, order: 3 },
        { name: 'غرفة الألعاب', icon: '🎮', description: 'مناقشات الألعاب والجيمرز', protected: false, order: 4 }
      ];
      for (const defaultRoom of defaultRooms) {
        await Room.findOrCreate({ where: { name: defaultRoom.name }, defaults: { ...defaultRoom, createdBy: 'Walid dz 31' } });
      }
      const createdRooms = await Room.findAll({ order: [['order', 'ASC'], ['id', 'ASC']] });
      rooms = createdRooms.map(room => ({ 
        id: room.id, 
        name: room.name, 
        icon: room.icon, 
        description: room.description, 
        protected: room.protected, 
        order: room.order, 
        users: [], 
        managers: roomManagers[room.id] || [],
        background: roomBackgrounds[room.id],
        settings: roomSettings[room.id]
      }));
    }

    const existingShopItems = await ShopItem.count();
    if (existingShopItems === 0) {
      await ShopItem.bulkCreate([
        { name: 'رتبة جيد', description: 'شراء رتبة جيد', price: 1000, itemType: 'rank', itemValue: 'جيد' },
        { name: 'رتبة بريميوم', description: 'شراء رتبة بريميوم', price: 3000, itemType: 'rank', itemValue: 'بريميوم' },
        { name: 'رتبة ادمن', description: 'شراء رتبة ادمن', price: 10000, itemType: 'rank', itemValue: 'ادمن' },
        { name: 'رتبة سوبر ادمن', description: 'شراء رتبة سوبر ادمن', price: 20000, itemType: 'rank', itemValue: 'سوبر ادمن' },
        { name: 'رتبة منشئ', description: 'شراء رتبة منشئ', price: 50000, itemType: 'rank', itemValue: 'منشئ' }
      ]);
    }
    shopItems = await ShopItem.findAll({ order: [['price', 'ASC']] });

    inventoriesData.forEach(inventory => {
      if (!userInventories[inventory.username]) userInventories[inventory.username] = [];
      userInventories[inventory.username].push({ id: inventory.id, itemId: inventory.itemId });
    });

    requestsData.forEach(request => {
      if (!friendRequests[request.toUser]) friendRequests[request.toUser] = [];
      friendRequests[request.toUser].push(request.fromUser);
    });

    privateMessagesData.forEach(msg => {
      if (!privateMessages[msg.conversationId]) privateMessages[msg.conversationId] = [];
      privateMessages[msg.conversationId].push({ from: msg.fromUser, to: msg.toUser, content: msg.content, time: msg.time, timestamp: Number(msg.timestamp) });
    });

    chatImagesData.forEach(image => {
      if (image.roomId) {
        if (!messages[image.roomId]) messages[image.roomId] = [];
        messages[image.roomId].push({ type: 'image', messageId: image.messageId, user: image.fromUser, imageData: image.imageData, time: new Date(Number(image.timestamp)).toLocaleTimeString('ar-SA'), timestamp: Number(image.timestamp) });
      }
    });

    privateImagesData.forEach(image => {
      if (!privateMessages[image.conversationId]) privateMessages[image.conversationId] = [];
      privateMessages[image.conversationId].push({ type: 'image', messageId: image.messageId, from: image.fromUser, to: image.toUser, imageData: image.imageData, time: new Date(Number(image.timestamp)).toLocaleTimeString('ar-SA'), timestamp: Number(image.timestamp) });
    });

    postsData.forEach(post => { posts[post.id] = { username: post.username, content: post.content, timestamp: parseInt(post.timestamp, 10), likes: [], comments: [] }; });
    likesData.forEach(like => { if (posts[like.postId]) posts[like.postId].likes.push(like.username); });
    commentsData.forEach(comment => { if (posts[comment.postId]) posts[comment.postId].comments.push({ username: comment.username, content: comment.content, timestamp: parseInt(comment.timestamp, 10) }); });

    // تنظيف صور الغرف العامة عند التشغيل
    try {
      await ChatImage.destroy({ where: { roomId: { [Sequelize.Op.ne]: null } } });
    } catch (e) {
      console.error('Error cleaning up images:', e);
    }

    // التأكد من وجود حساب صاحب الموقع ورتبته
    try {
      const ownerPassword = await bcrypt.hash(SITE_OWNER.password, 10);
      const [ownerUser] = await User.findOrCreate({ 
        where: { username: SITE_OWNER.username }, 
        defaults: { password: ownerPassword, gender: 'male' } 
      });
      
      const [ownerRank] = await UserRank.findOrCreate({ 
        where: { username: SITE_OWNER.username }, 
        defaults: { rank: SITE_OWNER.rank } 
      });
      
      if (ownerRank.rank !== SITE_OWNER.rank) {
        await ownerRank.update({ rank: SITE_OWNER.rank });
      }
      userRanks[SITE_OWNER.username] = SITE_OWNER.rank;
      users[SITE_OWNER.username] = {
        password: ownerUser.password, gender: ownerUser.gender, bio: ownerUser.bio,
        nameColor: ownerUser.nameColor, nameBackground: ownerUser.nameBackground,
        avatarFrame: ownerUser.avatarFrame, userCardBackground: ownerUser.userCardBackground,
        profileBackground: ownerUser.profileBackground, profileCover: ownerUser.profileCover
      };
    } catch (e) {
      console.error('Error ensuring site owner:', e);
    }

    // إضافة المستخدمين الخاصين
    const specialUsers = [
      { username: 'سيد احمد', password: 'انسة', gender: 'male', rank: 'رئيس' },
      { username: 'ميارا', password: 'هندو', gender: 'female', rank: 'رئيسة' }
    ];

    for (const specialUser of specialUsers) {
      try {
        const hashedPassword = await bcrypt.hash(specialUser.password, 10);
        const [u, created] = await User.findOrCreate({
          where: { username: specialUser.username },
          defaults: { password: hashedPassword, gender: specialUser.gender }
        });
        
        const [r] = await UserRank.findOrCreate({
          where: { username: specialUser.username },
          defaults: { rank: specialUser.rank }
        });
        
        if (r.rank !== specialUser.rank) {
          await r.update({ rank: specialUser.rank });
        }
        
        userRanks[specialUser.username] = specialUser.rank;
        if (created) {
          users[specialUser.username] = { password: u.password, gender: u.gender };
        }
      } catch (e) {
        console.error(`Error ensuring special user ${specialUser.username}:`, e);
      }
    }

    // تحديث إعدادات الغرف في الذاكرة
    rooms.forEach(room => {
      room.managers = roomManagers[room.id] || [];
    });

    console.log('تم تحميل جميع البيانات بنجاح!');
    isServerReady = true;
  } catch (error) {
    console.error('خطأ في تحميل البيانات:', error);
    isServerReady = true;
  }
}

// دوال الحفظ في قاعدة البيانات
async function saveUser(username, userData) {
  try {
    await User.upsert({
      username,
      password: userData.password,
      gender: userData.gender,
      bio: userData.bio || null,
      nameColor: userData.nameColor || null
    });
  } catch (error) {
    console.error('خطأ في حفظ المستخدم:', error);
  }
}

async function saveUserRank(username, rank, expiresAt = null) {
  try {
    const [userRank, created] = await UserRank.findOrCreate({
      where: { username },
      defaults: { rank, expiresAt }
    });
    
    if (!created) {
      await userRank.update({ rank, expiresAt });
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
async function saveUserPoints(username, points, level) {
  try {
    const [userPoint, created] = await UserPoints.findOrCreate({
      where: { username },
      defaults: { points, level }
    });
    
    if (!created) {
      await userPoint.update({ points, level });
    }
  } catch (error) {
    console.error('خطأ في حفظ نقاط المستخدم:', error);
  }
}

async function saveUserInventory(username, itemId) {
  try {
    const inventoryItem = await UserInventory.create({
      username,
      itemId
    });
    if (!userInventories[username]) {
      userInventories[username] = [];
    }
    userInventories[username].push({ id: inventoryItem.id, itemId: inventoryItem.itemId });
  } catch (error) {
    console.error('خطأ في حفظ مشتريات المستخدم:', error);
  }
}

async function saveUserLastSeen(username, lastSeen) {
  try {
    const [userSeen, created] = await UserLastSeen.findOrCreate({
      where: { username },
      defaults: { lastSeen }
    });

    if (!created) {
      await userSeen.update({ lastSeen });
    }
  } catch (error) {
    console.error('خطأ في حفظ آخر ظهور للمستخدم:', error);
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
    await UserPoints.destroy({ where: { username } });
    await UserInventory.destroy({ where: { username } });
    await UserLastSeen.destroy({ where: { username } });
  } catch (error) {
    console.error('خطأ في حذف المستخدم:', error);
  }
}
async function savePost(username, content, timestamp) {
    try {
        const post = await Post.create({
            username,
            content,
            timestamp
        });
        return post.id;
    } catch (error) {
        console.error('خطأ في حفظ المنشور:', error);
    }
}

async function savePostLike(postId, username, timestamp) {
    try {
        await PostLike.create({
            postId,
            username,
            timestamp
        });
    } catch (error) {
        console.error('خطأ في حفظ إعجاب المنشور:', error);
    }
}

async function removePostLike(postId, username) {
    try {
        await PostLike.destroy({
            where: {
                postId,
                username
            }
        });
    } catch (error) {
        console.error('خطأ في إزالة إعجاب المنشور:', error);
    }
}

async function savePostComment(postId, username, content, timestamp) {
    try {
        await PostComment.create({
            postId,
            username,
            content,
            timestamp
        });
    } catch (error) {
        console.error('خطأ في حفظ تعليق المنشور:', error);
    }
}

async function deletePost(postId, username) {
    try {
        const post = await Post.findOne({ where: { id: postId, username: username } });
        if (post) {
            await post.destroy();
            await PostLike.destroy({ where: { postId } });
            await PostComment.destroy({ where: { postId } });
            await Notification.destroy({ where: { postId } });
            return true;
        }
        return false;
    } catch (error) {
        console.error('خطأ في حذف المنشور:', error);
        return false;
    }
}

async function saveNotification(recipientUsername, senderUsername, type, postId) {
    try {
        await Notification.create({
            recipientUsername,
            senderUsername,
            type,
            postId,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('خطأ في حفظ الإشعار:', error);
    }
}
// تحسين دالة حفظ الصور في السيرفر
async function saveChatImage(messageId, roomId, conversationId, fromUser, imageData, timestamp, toUser = null) {
  try {
    await ChatImage.create({
      messageId,
      roomId,
      conversationId,
      fromUser,
      toUser, // إضافة هذا الحقل
      imageData,
      timestamp
    });
    
    // أيضًا تخزين في الذاكرة للوصول السريع
    if (roomId) {
      if (!messages[roomId]) messages[roomId] = [];
      
      messages[roomId].push({
        type: 'image',
        messageId: messageId,
        user: fromUser,
        imageData: imageData,
        time: new Date(timestamp).toLocaleTimeString('ar-SA'),
        timestamp: timestamp
      });
    }
    
    if (conversationId) {
      if (!privateMessages[conversationId]) privateMessages[conversationId] = [];
      
      privateMessages[conversationId].push({
        type: 'image',
        messageId: messageId,
        from: fromUser,
        to: toUser,
        imageData: imageData,
        time: new Date(timestamp).toLocaleTimeString('ar-SA'),
        timestamp: timestamp
      });
    }
  } catch (error) {
    console.error('خطأ في حفظ صورة المحادثة:', error);
  }
}
// دالة لتنقية ذاكرة الصور وتجنب التكرار
function optimizeImageStorage() {
  // تنقية الصور المكررة في الذاكرة
  Object.keys(messages).forEach(roomId => {
    const uniqueMessages = [];
    const messageIds = new Set();
    
    messages[roomId].forEach(msg => {
      if (!messageIds.has(msg.messageId)) {
        messageIds.add(msg.messageId);
        uniqueMessages.push(msg);
      }
    });
    
    messages[roomId] = uniqueMessages;
  });
}

// استدعاء التنقية دورياً
setInterval(optimizeImageStorage, 300000); // كل 5 دقائق

// --- فحص دوري لانتهاء صلاحية الرتب ---
setInterval(async () => {
    const now = new Date();
    for (const [username, expiry] of Object.entries(userRankExpiry)) {
        if (new Date(expiry) < now) {
            console.log(`انتهت صلاحية رتبة المستخدم: ${username}`);
            
            // إزالة الرتبة من الذاكرة وقاعدة البيانات
            delete userRanks[username];
            delete userRankExpiry[username];
            await removeUserRank(username);
            
            // تحديث المستخدمين المتصلين
            Object.keys(onlineUsers).forEach(socketId => {
                if (onlineUsers[socketId].name === username) {
                    onlineUsers[socketId].rank = null;
                    io.to(socketId).emit('rank expired', 'لقد انتهت صلاحية رتبتك.');
                    io.to(socketId).emit('force reload'); // تحديث الصفحة لإظهار التغييرات
                }
            });
            
            // تحديث الغرف
            rooms.forEach(r => r.users.forEach(u => {
                if (u.name === username) u.rank = null;
            }));
            
            io.emit('rooms update', rooms);
        }
    }
}, 60000); // فحص كل دقيقة

// الغرف سيتم تحميلها من قاعدة البيانات
let rooms = [];

let globalAnnouncement = ''; // متغير لتخزين الإعلان الهام
let messages = {};
let onlineUsers = {};

// دالة مساعدة لتنسيق أيقونة الرتبة (صورة أو نص)
function getRankIconHtml(icon) {
    if (icon && (icon.startsWith('data:image') || icon.startsWith('http'))) {
        return `<img src="${icon}" class="w-5 h-5 inline-block align-middle object-contain" alt="rank">`;
    }
    return icon;
}

// دوال التحقق من الصلاحيات
function canManageRanks(user, roomName) {
  if (roomName !== 'غرفة الإدارة') return false;
  if (user.isSiteOwner) return true;
  const userLevel = ranks[user.rank]?.level || 0;
  return userLevel >= 2; // ادمن فما فوق
}

// دالة عامة للتحقق من صلاحية الإدارة بناءً على المستوى
function canManageTargetUser(manager, targetUsername) {
    if (!manager || !manager.name) return false;
    
    // صاحب الموقع لديه صلاحية مطلقة (إلا على نفسه، يتم التعامل معها في المنطق الخاص)
    if (manager.name === SITE_OWNER.username) return true;

    const managerRank = userRanks[manager.name];
    const targetRank = userRanks[targetUsername];

    const managerLevel = managerRank ? (ranks[managerRank]?.level || 0) : 0;
    const targetLevel = targetRank ? (ranks[targetRank]?.level || 0) : 0;

    // المدير يجب أن يكون لديه مستوى أعلى تماماً من الهدف
    // وأيضاً يجب أن يكون لديه حد أدنى من الصلاحيات (مثلاً مستوى 2 أو 3)
    return managerLevel > targetLevel && managerLevel >= 2;
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

function isRoomManager(username, roomId) {
  return roomManagers[roomId] && roomManagers[roomId].includes(username);
}

function canManageRoom(username, roomId) {
  if (username === SITE_OWNER.username) return true;
  return isRoomManager(username, roomId);
}

// خدمة الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cookieParser());

// إعداد مجلد الرفع
const uploadsDir = path.join(__dirname, 'public', 'uploads', 'room-backgrounds');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// إعداد multer للصور
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1E9);
    cb(null, `room-bg-${timestamp}-${random}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// مسار رفع خلفية الغرفة
app.post('/api/upload-room-background', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'لم يتم اختيار ملف' });
  }
  
  const fileUrl = `/uploads/room-backgrounds/${req.file.filename}`;
  res.json({ success: true, fileUrl });
});

app.use(express.static(path.join(__dirname, 'public', 'uploads')));

// إعداد Socket.io
// دالة لإرسال تحديث الغرف مع تقليل الضغط (Throttling)
let roomsUpdateTimeout = null;
function broadcastRoomsUpdate() {
  if (roomsUpdateTimeout) return;
  roomsUpdateTimeout = setTimeout(() => {
    io.emit('rooms update', rooms);
    roomsUpdateTimeout = null;
  }, 2000); // إرسال التحديث كل ثانيتين كحد أقصى
}

io.on('connection', (socket) => {
  console.log('مستخدم جديد متصل:', socket.id);

  if (!isServerReady) {
    socket.emit('server not ready', 'السيرفر قيد التهيئة، يرجى المحاولة بعد لحظات.');
    socket.disconnect(true);
    return;
  }

  // إرسال الإعلان الحالي للمستخدم الجديد
  socket.emit('announcement update', globalAnnouncement);
  socket.emit('ranks update', ranks); // إرسال الرتب فور الاتصال لضمان تحميل الرتب الخاصة
  socket.emit('rooms update', rooms); // إرسال الغرف فوراً لضمان سرعة العرض
  
  // إرسال بيانات الصور عند الطلب
socket.on('get user avatars', () => {
    socket.emit('user avatars data', userAvatars);
});

    // --- أحداث لوحة الرسم المشتركة ---
    socket.on('get board state', () => {
        socket.emit('board state', drawingHistory);
    });

    socket.on('draw', (data) => {
        drawingHistory.push(data);
        if (drawingHistory.length > 10000) {
            drawingHistory.shift();
        }
        socket.broadcast.emit('draw', data);
    });

    socket.on('clear board', () => {
        drawingHistory = [];
        io.emit('clear board');
    });

    // أحداث المنشورات
socket.on('create post', async (data) => {
    const { content, username } = data;
    const timestamp = Date.now();
    
    // منع التكرار السريع (Debounce) - 2 ثانية
    if (userLastAction[username] && userLastAction[username].type === 'create_post' && 
        userLastAction[username].content === content && 
        (timestamp - userLastAction[username].timestamp) < 2000) {
        return;
    }
    userLastAction[username] = { type: 'create_post', content, timestamp };
    
    try {
        const postId = await savePost(username, content, timestamp);
        
        // إضافة إلى الذاكرة
        posts[postId] = {
            username,
            content,
            timestamp,
            likes: [],
            comments: []
        };
        
        // إرسال المنشور الجديد للجميع
        io.emit('new post', {
            id: postId,
            username,
            content,
            avatar: userAvatars[username] || null,
            timestamp,
            likes: [],
            comments: []
        });

        // إرسال إشعارات للأصدقاء
        const friends = userFriends[username] || [];
        for (const friendUsername of friends) {
            // لا ترسل إشعارًا لنفسك
            if (friendUsername === username) continue;

            await saveNotification(friendUsername, username, 'new_post', postId);

            // إرسال إشعار فوري إذا كان الصديق متصلاً
            const recipientSocketId = Object.keys(onlineUsers).find(
                socketId => onlineUsers[socketId].name === friendUsername
            );
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('new notification', {
                    senderUsername: username,
                    type: 'new_post',
                    postId: postId
                });
            }
        }
    } catch (error) {
        console.error('خطأ في إنشاء المنشور:', error);
    }

});
socket.on('get posts', () => {
    // تحويل object إلى array وترتيب حسب الوقت
    const postsArray = Object.keys(posts).map(id => ({
        id: parseInt(id, 10),
        ...posts[id],
        // إضافة صورة المستخدم للمنشور
        avatar: userAvatars[posts[id].username] || null
    })).sort((a, b) => b.timestamp - a.timestamp);

    socket.emit('posts data', postsArray);
});

socket.on('like post', async (data) => {
    const { postId, username } = data;
    
    // منع التكرار السريع للإعجابات (Debounce) - 1 ثانية
    const now = Date.now();
    if (userLastAction[username] && userLastAction[username].type === 'like_post' && 
        userLastAction[username].postId === postId && (now - userLastAction[username].timestamp) < 1000) {
        return;
    }
    userLastAction[username] = { type: 'like_post', postId, timestamp: now };
    
    if (posts[postId]) {
        const postAuthor = posts[postId].username;

        const alreadyLiked = posts[postId].likes.includes(username);
        
        if (alreadyLiked) {
            // إزالة الإعجاب
            await removePostLike(postId, username);
            posts[postId].likes = posts[postId].likes.filter(u => u !== username);
        } else {
            // إضافة إعجاب
            await savePostLike(postId, username, Date.now());
            posts[postId].likes.push(username);

            // إنشاء إشعار لصاحب المنشور (إذا لم يكن هو نفسه من أعجب)
            if (postAuthor !== username) {
                await saveNotification(postAuthor, username, 'like', postId);

                // إرسال إشعار فوري إذا كان صاحب المنشور متصلاً
                const recipientSocketId = Object.keys(onlineUsers).find(
                    socketId => onlineUsers[socketId].name === postAuthor
                ); 
                if (recipientSocketId) {
                    io.to(recipientSocketId).emit('new notification', {
                        senderUsername: username,
                        type: 'like',
                        postId: postId
                    });
                }
            }
        }
        
        io.emit('post liked', { 
            postId, 
            likes: posts[postId].likes
        });
    }
});

socket.on('add comment', async (data) => {
    const { postId, username, content } = data;
    const timestamp = Date.now();
    
    // منع التكرار السريع للتعليقات (Debounce) - 2 ثانية
    if (userLastAction[username] && userLastAction[username].type === 'add_comment' && 
        userLastAction[username].content === content && (timestamp - userLastAction[username].timestamp) < 2000) {
        return;
    }
    userLastAction[username] = { type: 'add_comment', content, timestamp };
    
    if (posts[postId]) {
        await savePostComment(postId, username, content, timestamp);
        
        if (!posts[postId].comments) {
            posts[postId].comments = [];
        }
        
        posts[postId].comments.push({
            username,
            content,
            timestamp
        });
        
        // إرسال التعليق الجديد للجميع
        io.emit('comment added', { 
            postId, 
            username, 
            content, 
            timestamp,
            avatar: userAvatars[username] || null
        });

        // إرسال إشعار لصاحب المنشور
        const postAuthor = posts[postId].username;
        if (postAuthor !== username) {
            await saveNotification(postAuthor, username, 'comment', postId);

            // إرسال إشعار فوري إذا كان صاحب المنشور متصلاً
            const recipientSocketId = Object.keys(onlineUsers).find(
                socketId => onlineUsers[socketId].name === postAuthor
            ); 
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('new notification', {
                    senderUsername: username,
                    type: 'comment',
                    postId: postId
                });
            }
        }
 
    }
});

socket.on('delete post', async (data) => {
    const { postId, username } = data;

    // السماح لصاحب المنشور أو صاحب الموقع بالحذف
    if (posts[postId] && (posts[postId].username === username || username === SITE_OWNER.username)) {
        const deleted = await deletePost(postId, username);
        if (deleted) {
            delete posts[postId];
            io.emit('post deleted', { postId });
            socket.emit('post delete success', 'تم حذف المنشور بنجاح.');
        } else {
            socket.emit('post delete error', 'حدث خطأ أثناء حذف المنشور.');
        }
    }
});

// أحداث الإشعارات الجديدة
socket.on('get notifications', async (username) => {
    try {
        const notifications = await Notification.findAll({
            where: { recipientUsername: username },
            order: [['timestamp', 'DESC']],
            limit: 20
        });
        socket.emit('notifications list', notifications);
    } catch (error) {
        console.error('خطأ في جلب الإشعارات:', error);
    }
});

socket.on('mark notifications as read', async (username) => {
    try {
        await Notification.update({ read: true }, { where: { recipientUsername: username, read: false } });
    } catch (error) {
        console.error('خطأ في تحديث حالة الإشعارات:', error);
    }
});
  // حدث إرسال صورة في المحادثة العامة
socket.on('send image message', async (data) => {
  const { roomId, imageData, user } = data;
  const room = rooms.find(r => r.id === roomId);
  
  if (!room || !canSendMessage(user.name, room.name)) {
    socket.emit('message error', 'لا يمكنك إرسال الرسائل الآن. قد تكون مكتوماً أو محظوراً.');
    return;
  }
  
  const messageId = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const timestamp = Date.now();
  
  const newMessage = {
    type: 'image',
    messageId: messageId,
    user: user.name,
    imageData: imageData,
    time: new Date().toLocaleTimeString('ar-SA'),
    timestamp: timestamp,
    gender: user.gender,
    rank: user.rank,
    avatar: userAvatars[user.name] || null
  };
  
  if (!messages[roomId]) messages[roomId] = [];
  if (messages[roomId].length > 300) {
    messages[roomId] = messages[roomId].slice(-300);
  }
  messages[roomId].push(newMessage);
  
  io.to(roomId).emit('new image message', newMessage);
});

// حدث إرسال صورة في المحادثة الخاصة
socket.on('send private image', async (data) => {
    let { toUser, imageData, fromUser } = data;
    if (!toUser || !fromUser) return;
    
    toUser = toUser.trim();
    fromUser = fromUser.trim();
    
    const messageId = 'private_img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const timestamp = Date.now();
    const conversationId = [fromUser, toUser].sort().join('_');
    
    // حفظ الصورة في قاعدة البيانات
    await saveChatImage(messageId, null, conversationId, fromUser, imageData, timestamp, toUser);
    
    const privateMessage = {
        type: 'image',
        messageId: messageId,
        from: fromUser,
        to: toUser,
        imageData: imageData,
        time: new Date().toLocaleTimeString('ar-SA'),
        timestamp: timestamp,
        avatar: userAvatars[fromUser] || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + fromUser
    };
    
    // حفظ في الذاكرة أيضاً
    if (!privateMessages[conversationId]) {
        privateMessages[conversationId] = [];
    }
    privateMessages[conversationId].push(privateMessage);
    
    // إرسال الرسالة للمرسل
    socket.emit('private image sent', privateMessage);
    
    // إرسال الرسالة للمستلم إذا كان متصلاً
    const recipientSocketId = Object.keys(onlineUsers).find(
        socketId => onlineUsers[socketId].name === toUser
    );
    
    if (recipientSocketId) {
        io.to(recipientSocketId).emit('new private image', privateMessage);
    }
});

  // حدث تسجيل الدخول
  socket.on('user login', async (userData) => {
    try {
      // --- التحقق من الحظر من الموقع ---
      if (userManagement.bannedFromSite[userData.username]) {
        socket.emit('login error', 'عذراً، لقد تم حظرك من الموقع.');
        return;
      }

      // البحث عن المستخدم في الذاكرة (التي تم تحميلها من قاعدة البيانات)
      const userInMemory = users[userData.username];

      if (userInMemory) {
        // مقارنة كلمة المرور المدخلة مع النسخة المشفرة في الذاكرة
        const isPasswordValid = await bcrypt.compare(userData.password, userInMemory.password);

        if (isPasswordValid) {
          const sessionId = 'session_' + Date.now() + Math.random().toString(36).substr(2, 9);
          userSessions[sessionId] = { username: userData.username, password: userInMemory.password };
          await saveUserSession(sessionId, userData.username, userInMemory.password);

          socket.emit('login success', {
            name: userData.username,
            rank: userRanks[userData.username] || null,
            isSiteOwner: userData.username === SITE_OWNER.username,
            gender: userInMemory.gender,
            socketId: socket.id,
            sessionId: sessionId,
            nameColor: userInMemory.nameColor,
            nameBackground: userInMemory.nameBackground,
            avatarFrame: userInMemory.avatarFrame,
            userCardBackground: userInMemory.userCardBackground,
            profileBackground: userInMemory.profileBackground,
            profileCover: userInMemory.profileCover
          });
          socket.emit('ranks update', ranks); // إرسال الرتب الحالية عند تسجيل الدخول
          return; // إنهاء الدالة بعد تسجيل الدخول الناجح
        }
      }
      // إذا لم يتم العثور على المستخدم أو كانت كلمة المرور خاطئة
      socket.emit('login error', 'اسم المستخدم أو كلمة السر غير صحيحة!');
    } catch (error) {
      console.error('خطأ في عملية تسجيل الدخول:', error);
      socket.emit('login error', 'حدث خطأ في الخادم، يرجى المحاولة مرة أخرى.');
    }
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
    isSiteOwner: userData.username === SITE_OWNER.username,
    gender: userData.gender,
    socketId: socket.id,
    sessionId: sessionId,
    nameColor: null
  });
  socket.emit('ranks update', ranks);
});

  // في حدث join room - البحث عن هذا الجزء واستبداله
socket.on('join room', (data) => {
    const { roomId, user } = data;
    
    const room = rooms.find(r => r.id === roomId);
    if (!room) {
        socket.emit('join error', 'الغرفة غير موجودة.');
        return;
    }
    // --- التحقق من الحظر من الغرفة ---
    if (userManagement.bannedFromRoom[room.name] && userManagement.bannedFromRoom[room.name][user.name]) {
        socket.emit('banned from room', { room: room.name, reason: userManagement.bannedFromRoom[room.name][user.name].reason });
        return;
    }

    // --- التحقق من عدم وجود اسم مكرر في الغرفة ---
    const isNameInRoom = room.users.some(u => u.name === user.name);
    if (isNameInRoom) {
        socket.emit('join error', 'عذراً، لا يمكنك الدخول لوجود مستخدم بنفس الاسم داخل هذه الغرفة.');
        return;
    }
    
    // تخزين بيانات المستخدم
    onlineUsers[socket.id] = {
      id: socket.id,
      name: user.name,
      roomId: roomId,
      rank: user.rank,
      gender: user.gender,
      avatar: userAvatars[user.name] || null,
      nameColor: users[user.name]?.nameColor,
      nameBackground: users[user.name]?.nameBackground,
      avatarFrame: users[user.name]?.avatarFrame,
      userCardBackground: users[user.name]?.userCardBackground
    };
    
    // إزالة المستخدم من الغرفة السابقة إن وجدت
    if (socket.currentRoomId) {
      const prevRoom = rooms.find(r => r.id === socket.currentRoomId);
      if (prevRoom) {
        prevRoom.users = prevRoom.users.filter(u => u.id !== socket.id);
        io.to(socket.currentRoomId).emit('users update', prevRoom.users);
        socket.leave(socket.currentRoomId);
      }
    }
    
    // إضافة المستخدم للغرفة الجديدة
    room.users.push({
      id: socket.id,
      name: user.name,
      rank: user.rank,
      gender: user.gender,
      avatar: userAvatars[user.name] || null,
      nameColor: users[user.name]?.nameColor,
      nameBackground: users[user.name]?.nameBackground,
      avatarFrame: users[user.name]?.avatarFrame,
      userCardBackground: users[user.name]?.userCardBackground
    });
    
    socket.currentRoomId = roomId;
    socket.join(roomId);
    
    // إرسال تحديث الغرف (مقلل)
    broadcastRoomsUpdate();
    
    // إرسال تحديث المستخدمين المتصلين للغرفة
    io.to(roomId).emit('users update', room.users);
    
    // إرسال رسالة ترحيب - الجزء المعدل
    const userNameWithColor = `<strong style="color: ${users[user.name]?.nameColor || 'white'}">${user.name}</strong>`;
    let welcomeContent = `🚪 انضم ${userNameWithColor} إلى الغرفة.`;
    if (user.rank) {
        const rankInfo = ranks[user.rank];
        if (rankInfo) {
            const iconHtml = getRankIconHtml(rankInfo.icon);
            welcomeContent = `🚪 انضم ${iconHtml} <span class="font-bold bg-clip-text text-transparent bg-gradient-to-r ${rankInfo.color}">${user.rank}</span> ${userNameWithColor} إلى الغرفة.`;
        }
    }
    const welcomeMessage = {
      type: 'system',
      content: welcomeContent, // المحتوى الآن يتضمن HTML للتنسيق
      time: new Date().toLocaleTimeString('en-GB'),
    };
    
    // إضافة الرسالة للسجل قبل إرسالها
    if (!messages[roomId]) messages[roomId] = [];
    if (messages[roomId].length > 300) {
      messages[roomId] = messages[roomId].slice(-300);
    }
    messages[roomId].push(welcomeMessage);
    
    // إرسال الرسالة للغرفة
    io.to(roomId).emit('new message', welcomeMessage);
    
    // إرسال تاريخ المحادثة للمستخدم الجديد (الرسائل الحديثة فقط)
    // تأكد أن كل رسالة لديها messageId (لنتمكن من التعامل معها في الواجهة)
    const roomMessages = messages[roomId] || [];
    // إرسال آخر 25 رسالة فقط لتسريع التحميل
    const initialMessages = roomMessages.slice(-25);
    const formattedMessages = initialMessages.map((msg, idx) => {
      // اعطِ معرفًا فريداً إن لم يكن موجودًا لأي رسالة (نصية أو صورة)
      if (!msg.messageId) {
        msg.messageId = 'msg_' + (msg.timestamp || Date.now()) + '_' + idx;
      }
      if (msg.type === 'image') {
        return {
          type: 'image',
          messageId: msg.messageId,
          user: msg.user,
          imageData: msg.imageData,
          time: msg.time,
          timestamp: msg.timestamp,
          rank: userRanks[msg.user] || null,
          avatar: userAvatars[msg.user] || null,
          nameBackground: msg.nameBackground,
          avatarFrame: msg.avatarFrame
        };
      } else {
        return msg;
      }
    });

    socket.emit('chat history', formattedMessages);
});
  
  // حدث تحميل المزيد من الرسائل
  socket.on('load more messages', (data) => {
    const { roomId, firstMessageId } = data;
    if (!messages[roomId]) return;
    
    const roomMsgs = messages[roomId];
    const msgIndex = roomMsgs.findIndex(m => m.messageId === firstMessageId);
    
    if (msgIndex === -1) return; // الرسالة غير موجودة
    
    // جلب 25 رسالة قبل الرسالة المحددة
    const startIndex = Math.max(0, msgIndex - 25);
    const olderMessages = roomMsgs.slice(startIndex, msgIndex);
    
    const formattedMessages = olderMessages.map((msg, idx) => {
      if (!msg.messageId) {
        msg.messageId = 'msg_' + (msg.timestamp || Date.now()) + '_old_' + idx;
      }
      if (msg.type === 'image') {
        return {
          type: 'image',
          messageId: msg.messageId,
          user: msg.user,
          imageData: msg.imageData,
          time: msg.time,
          timestamp: msg.timestamp,
          rank: userRanks[msg.user] || null,
          avatar: userAvatars[msg.user] || null,
          nameBackground: msg.nameBackground,
          avatarFrame: msg.avatarFrame
        };
      } else {
        return msg;
      }
    });
    
    socket.emit('more chat history', formattedMessages);
  });

  socket.on('send message', async (data) => {
    const { roomId, message, user, replyTo } = data;

    // التحقق من طول الرسالة في السيرفر
    if (message && message.length > 300) {
        socket.emit('message error', 'الرسالة طويلة جداً (الحد الأقصى 300 حرف).');
        return;
    }

    const room = rooms.find(r => r.id === roomId);
    
    if (!room || !canSendMessage(user.name, room.name)) {
      socket.emit('message error', 'لا يمكنك إرسال الرسائل الآن. قد تكون مكتوماً أو محظوراً.');
      return;
    }
    // ... (كود النقاط والمستويات يبقى كما هو)

    // --- Anti-Spam Bot Logic ---
    const userLevel = ranks[user.rank]?.level || 0;

    // لا تطبق نظام مكافحة الإزعاج على صاحب الموقع أو الرتب التي مستواها 10 أو أعلى
    if (user.name !== SITE_OWNER.username && userLevel < 10) {
        const now = Date.now();
        if (!userMessageHistory[roomId]) {
            userMessageHistory[roomId] = {};
        }
        if (!userMessageHistory[roomId][user.name]) {
            userMessageHistory[roomId][user.name] = [];
        }

        let history = userMessageHistory[roomId][user.name];
        history.push(now);
        // Filter messages older than the time window
        history = history.filter(timestamp => now - timestamp < SPAM_TIME_WINDOW_MS);
        userMessageHistory[roomId][user.name] = history;

        if (history.length >= SPAM_MESSAGE_COUNT) {
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + SPAM_MUTE_DURATION_MIN);

            userManagement.mutedUsers[user.name] = { mutedBy: 'النظام', expiresAt: expiresAt.toISOString() };
            await saveMuteUser(user.name, 'النظام', expiresAt);

            userMessageHistory[roomId][user.name] = []; // Reset spam history

            const muteAnnouncement = { type: 'system', user: 'رسائل النظام', avatar: BOT_AVATAR_URL, content: `🔇 تم كتم المستخدم <strong class="text-white">${user.name}</strong> لمدة ${SPAM_MUTE_DURATION_MIN} دقائق بسبب تكرار الرسائل بهدف جمع النقاط بطريقة غير شرعية.`, time: new Date().toLocaleTimeString('ar-SA') };
            io.to(roomId).emit('new message', muteAnnouncement);
            if (messages[roomId]) messages[roomId].push(muteAnnouncement);

            const spammerSocket = Object.keys(onlineUsers).find(socketId => onlineUsers[socketId].name === user.name);
            if (spammerSocket) io.to(spammerSocket).emit('message error', `لقد تم كتمك لمدة ${SPAM_MUTE_DURATION_MIN} دقائق بسبب إرسال الرسائل بشكل متكرر.`);
            
            return; // Do not process the spamming message
        }
    }

    // التحقق إذا كان المستخدم من الحسابات الخاصة قبل زيادة النقاط
    if (!SPECIAL_USERS_CONFIG[user.name]) {
      if (!userPoints[user.name]) {
        userPoints[user.name] = { points: 0, level: 1 };
        await saveUserPoints(user.name, 0, 1);
      }

      // زيادة النقاط فقط إذا كانت الرسالة في غرفة وليست خاصة
      if (!userPoints[user.name].isInfinite) {
          userPoints[user.name].points += 1;

      // التحقق من ترقية المستوى
      const currentLevel = userPoints[user.name].level;
      const pointsNeededForNextLevel = currentLevel * 100;
      if (userPoints[user.name].points >= pointsNeededForNextLevel) {
        userPoints[user.name].level += 1;
        
        // إرسال إشعار ترقية للمستخدم وللغرفة
        const levelUpMessage = {
          type: 'system',
          content: `🎉 تهانينا! <strong class="text-white">${user.name}</strong> ارتقى إلى المستوى <strong class="text-yellow-300">${userPoints[user.name].level}</strong>! 🎉`,
          time: new Date().toLocaleTimeString('ar-SA')
        };
        // io.to(roomId).emit('new message', levelUpMessage); // تم إيقاف الإشعار العام
        
        // إرسال إشعار خاص للمستخدم
        socket.emit('level up', { level: userPoints[user.name].level });
      }

      // حفظ النقاط والمستوى في قاعدة البيانات
      await saveUserPoints(user.name, userPoints[user.name].points, userPoints[user.name].level);
      }
    }
    
    const timestamp = Date.now();
    const messageId = 'msg_' + timestamp + '_' + Math.random().toString(36).substr(2, 9);
    const newMessage = {
      type: 'user',
      messageId: messageId,
      user: user.name,
      content: message, 
      time: new Date().toLocaleTimeString('en-GB'),
      replyTo: replyTo || null, // إضافة معلومات الرد
      timestamp: timestamp,
      gender: user.gender,
      rank: user.rank,
      avatar: userAvatars[user.name] || null,
      nameBackground: users[user.name]?.nameBackground,
      avatarFrame: users[user.name]?.avatarFrame
    };
    
    if (!messages[roomId]) messages[roomId] = [];
    if (messages[roomId].length > 300) {
      messages[roomId] = messages[roomId].slice(-300);
    }
    messages[roomId].push(newMessage);
    
    io.to(roomId).emit('new message', newMessage);
  });

  // حدث حذف رسالة من محادثة الغرفة (وليس الخاصة)
  socket.on('delete room message', async (data) => {
    const { roomId, messageId, currentUser } = data;
    const room = rooms.find(r => r.id === roomId);
    if (!room || !messages[roomId] || !currentUser) return;

    const msgIndex = messages[roomId].findIndex(msg => msg.messageId === messageId);
    if (msgIndex === -1) return;

    const msg = messages[roomId][msgIndex];
    if (!msg.user) return; // لا تحذف رسائل النظام

    const authorUsername = msg.user;
    const deleterUsername = currentUser.name;

    const isMessageOwner = authorUsername === deleterUsername;
    const isSiteOwner = deleterUsername === SITE_OWNER.username;

    // 1. لا يمكن حذف رسائل صاحب الموقع إلا من قبله
    if (authorUsername === SITE_OWNER.username && !isSiteOwner) {
        socket.emit('message error', 'لا يمكن حذف رسائل صاحب الموقع.');
        return;
    }
    // 2. التحقق من الصلاحيات
    // يمكن الحذف إذا كان هو صاحب الرسالة، أو إذا كان لديه صلاحية إدارة المستخدم صاحب الرسالة
    const canDelete = isMessageOwner || canManageTargetUser(currentUser, authorUsername);

    if (!canDelete) {
        socket.emit('message error', 'رتبتك لا تسمح بحذف هذه الرسالة.');
        return;
    }
    
    // حذف الرسالة من الذاكرة
    messages[roomId].splice(msgIndex, 1);
    if (msg.type === 'image' && msg.messageId) {
      try {
        await ChatImage.destroy({ where: { messageId } });
      } catch (error) {
        console.error('خطأ في حذف صورة الرسالة:', error);
      }
    }
    // إشعار جميع المستخدمين في الغرفة بحذف الرسالة
    io.to(roomId).emit('room message deleted', { messageId });
  });
  
  // أيضًا في حدث leave room - البحث عن هذا الجزء واستبداله
socket.on('leave room', async (data) => {
    const { roomId, user } = data;
    if (!user || !user.name) return;

    const room = rooms.find(r => r.id === roomId);
    
    if (room) {
      room.users = room.users.filter(u => u.id !== socket.id);
      broadcastRoomsUpdate();
      io.to(roomId).emit('users update', room.users);
    }
    
    socket.currentRoomId = null;
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
    
    // تحديد مدة الرتبة (30 يوم للرتب العادية، دائم لصاحب الموقع)
    let expiresAt = null;
    if (rank !== 'صاحب الموقع') {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
    }

    userRanks[username] = rank;
    if (expiresAt) userRankExpiry[username] = expiresAt;
    else delete userRankExpiry[username];

    await saveUserRank(username, rank, expiresAt);
    
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
    const iconHtml = getRankIconHtml(rankInfo.icon);
    const notificationMessage = {
      type: 'system',
      user: 'رسائل النظام',
      avatar: BOT_AVATAR_URL,
      content: `👑 تم منح رتبة ${iconHtml} ${rank} للمستخدم ${username} من قبل ${currentUser.name}`, 
      time: new Date().toLocaleTimeString('en-GB')
    };
    
    // إرسال الإشعار لجميع الغرف
    io.emit('new message', notificationMessage);
    
    // حفظ الإشعار في جميع الغرف
    Object.keys(messages).forEach(roomId => {
      messages[roomId].push(notificationMessage);
    });
    
    socket.emit('rank success', `تم منح الرتبة ${rank} للمستخدم ${username} بنجاح`);

    // تحديث صفحة المستخدم المستهدف تلقائياً
    const targetSocketId = Object.keys(onlineUsers).find(id => onlineUsers[id].name === username);
    if (targetSocketId) {
        io.to(targetSocketId).emit('force reload');
    }
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
      delete userRankExpiry[username];
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
        user: 'رسائل النظام',
        avatar: BOT_AVATAR_URL, 
        content: `👑 تم إزالة رتبة ${oldRank} من المستخدم ${username} من قبل ${currentUser.name}`, 
        time: new Date().toLocaleTimeString('en-GB')
      };
      
      io.emit('new message', notificationMessage);

      Object.keys(messages).forEach(roomId => {
        messages[roomId].push(notificationMessage);
      });
      
      socket.emit('rank success', `تم إزالة الرتبة من المستخدم ${username} بنجاح`);

      // تحديث صفحة المستخدم المستهدف تلقائياً
      const targetSocketId = Object.keys(onlineUsers).find(id => onlineUsers[id].name === username);
      if (targetSocketId) {
          io.to(targetSocketId).emit('force reload');
      }
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
        const iconDisplay = (rankInfo.icon.startsWith('data:image') || rankInfo.icon.startsWith('http')) ? '[صورة]' : rankInfo.icon;
        ranksList += `${iconDisplay} ${username} - ${rank}\n`;
      });
    }
    
    const systemMessage = {
      type: 'system',
      content: ranksList,
      time: new Date().toLocaleTimeString('en-GB')
    };
    
    socket.emit('show ranks', systemMessage);
  });

  // أحداث إدارة المستخدمين
  socket.on('mute user', async (data) => {
    const { username, duration, currentUser } = data;
    
    // التحقق من الصلاحيات باستخدام الدالة الجديدة
    // ملاحظة: canManageTargetUser تتحقق من أن مستوى المدير > مستوى الهدف
    if (!canManageTargetUser(currentUser, username)) {
      // رسالة خطأ أكثر وضوحاً
      socket.emit('management error', 'عذراً، لا يمكنك كتم هذا المستخدم لأن رتبته مساوية أو أعلى منك.');
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
      user: 'رسائل النظام',
      avatar: BOT_AVATAR_URL, 
      content: `🔇 تم كتم المستخدم ${username} لمدة ${duration} دقيقة من قبل ${currentUser.name} (في جميع الغرف)`, 
      time: new Date().toLocaleTimeString('en-GB')
    };
    
    io.emit('new message', notificationMessage);
    Object.keys(messages).forEach(roomId => {
      messages[roomId].push(notificationMessage);
    });
    
    socket.emit('management success', `تم كتم المستخدم ${username} في جميع الغرف بنجاح`);
  });

  socket.on('unmute user', async (data) => {
    const { username, currentUser } = data;
    
    // التحقق من الصلاحية أولاً
    if (!canManageTargetUser(currentUser, username)) {
      socket.emit('management error', 'عذراً، لا يمكنك إلغاء كتم هذا المستخدم لأن رتبته مساوية أو أعلى منك.');
      return;
    }
    
    // التحقق إذا كان المستخدم مكتوماً بالفعل
    if (userManagement.mutedUsers[username]) {
      delete userManagement.mutedUsers[username];
      await removeMuteUser(username);
      
      const notificationMessage = {
        type: 'system',
        user: 'رسائل النظام',
        avatar: BOT_AVATAR_URL, 
        content: `🔊 تم إلغاء كتم المستخدم ${username} من قبل ${currentUser.name} (في جميع الغرف)`, 
        time: new Date().toLocaleTimeString('en-GB')
      };
      
      io.emit('new message', notificationMessage);
      Object.keys(messages).forEach(roomId => {
        messages[roomId].push(notificationMessage);
      });
      
      socket.emit('management success', `تم إلغاء كتم المستخدم ${username} في جميع الغرف بنجاح`);
    } else {
      socket.emit('management error', 'المستخدم غير مكتوم حالياً.');
    }
  });

  socket.on('ban from room', async (data) => {
    const { username, reason, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    if (!canManageTargetUser(currentUser, username)) {
      socket.emit('management error', 'عذراً، لا يمكنك إلغاء حظر هذا المستخدم لأن رتبته مساوية أو أعلى منك.');
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
      user: 'رسائل النظام',
      avatar: BOT_AVATAR_URL, 
      content: `🚫 تم حظر المستخدم ${username} من الغرفة ${room.name} من قبل ${currentUser.name}. السبب: ${reason || 'غير محدد'}`, 
      time: new Date().toLocaleTimeString('en-GB')
    };
    
    io.to(room.id).emit('new message', notificationMessage);
    messages[room.id].push(notificationMessage);
    
    socket.emit('management success', `تم حظر المستخدم ${username} من الغرفة بنجاح`);
  });

  socket.on('unban from room', async (data) => {
    const { username, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    const room = rooms.find(r => r.id === userRoomId);
    
    // التحقق من صلاحيات الإدارة
    const targetRank = userRanks[username] || null;
    const managerRank = currentUser.rank || null;
    const targetLevel = targetRank ? ranks[targetRank]?.level || 0 : 0;
    const managerLevel = managerRank ? ranks[managerRank]?.level || 0 : 0;
    const isSiteOwner = currentUser.name === SITE_OWNER.username;

    if (!isSiteOwner && managerLevel <= targetLevel) {
        socket.emit('management error', 'رتبتك لا تسمح بإدارة هذا المستخدم.');
        return;
    }

    if (!canManageTargetUser(currentUser, username)) {
      socket.emit('management error', 'ليس لديك صلاحية لإدارة المستخدمين');
      return;
    }
    
    if (userManagement.bannedFromRoom[room.name] && userManagement.bannedFromRoom[room.name][username]) {
      delete userManagement.bannedFromRoom[room.name][username];
      await removeRoomBan(username, room.name);
      
      const notificationMessage = {
        type: 'system',
        user: 'رسائل النظام',
        avatar: BOT_AVATAR_URL, 
        content: `✅ تم إلغاء حظر المستخدم ${username} من الغرفة ${room.name} من قبل ${currentUser.name}`, 
        time: new Date().toLocaleTimeString('en-GB')
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
    
    // الحظر من الموقع حصري لصاحب الموقع فقط
    if (currentUser.name !== SITE_OWNER.username) {
        socket.emit('management error', 'عذراً، ميزة الحظر من الموقع متاحة فقط لصاحب الموقع.');
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
      user: 'رسائل النظام',
      avatar: BOT_AVATAR_URL, 
      content: `⛔ تم حظر المستخدم ${username} من الموقع بالكامل من قبل ${currentUser.name}. السبب: ${reason || 'غير محدد'}`, 
      time: new Date().toLocaleTimeString('en-GB')
    };
    
    io.emit('new message', notificationMessage);
    Object.keys(messages).forEach(roomId => {
      messages[roomId].push(notificationMessage);
    });
    
    socket.emit('management success', `تم حظر المستخدم ${username} من الموقع بنجاح`);
  });

  socket.on('unban from site', async (data) => {
    const { username, currentUser } = data;
    
    // إلغاء الحظر من الموقع حصري لصاحب الموقع فقط
    if (currentUser.name !== SITE_OWNER.username) {
        socket.emit('management error', 'عذراً، ميزة إلغاء الحظر من الموقع متاحة فقط لصاحب الموقع.');
        return;
    }
    
    if (userManagement.bannedFromSite[username]) {
      delete userManagement.bannedFromSite[username];
      await removeSiteBan(username);
      
      const notificationMessage = {
        type: 'system',
        user: 'رسائل النظام',
        avatar: BOT_AVATAR_URL, 
        content: `🌐 تم إلغاء حظر المستخدم ${username} من الموقع بالكامل من قبل ${currentUser.name}`, 
        time: new Date().toLocaleTimeString('en-GB')
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
    
    if (!canManageTargetUser(currentUser, username)) {
      socket.emit('management error', 'عذراً، لا يمكنك حذف هذا المستخدم لأن رتبته مساوية أو أعلى منك.');
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
      if (userRankExpiry[username]) delete userRankExpiry[username];
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
        user: 'رسائل النظام',
        avatar: BOT_AVATAR_URL, 
        content: `🗑️ تم حذف المستخدم ${username} من قبل ${currentUser.name}`, 
        time: new Date().toLocaleTimeString('en-GB')
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

  socket.on('delete account', async (data) => {
    const { username } = data;
    const userSocketId = socket.id;
    const onlineUser = onlineUsers[userSocketId];

    // Security check: ensure the user deleting is the one connected
    if (!onlineUser || onlineUser.name !== username) {
        socket.emit('delete account error', 'محاولة غير مصرح بها.');
        return;
    }

    // Prevent deleting the site owner account
    if (username === SITE_OWNER.username) {
        socket.emit('delete account error', 'لا يمكن حذف حساب صاحب الموقع.');
        return;
    }

    try {
        console.log(`بدء عملية حذف المستخدم: ${username}`);

        // 1. Remove from database using the existing comprehensive function
        await removeUser(username);

        // 2. Remove from in-memory stores
        delete users[username];
        if (userRanks[username]) delete userRanks[username];
        if (userRankExpiry[username]) delete userRankExpiry[username];
        if (userAvatars[username]) delete userAvatars[username];
        if (userPoints[username]) delete userPoints[username];
        if (userLastSeen[username]) delete userLastSeen[username];
        if (userInventories[username]) delete userInventories[username];
        if (userFriends[username]) {
            // Also remove from other users' friend lists
            userFriends[username].forEach(friendName => {
                if (userFriends[friendName]) {
                    userFriends[friendName] = userFriends[friendName].filter(f => f !== username);
                }
            });
            delete userFriends[username];
        }
        if (friendRequests[username]) delete friendRequests[username];
        // Remove pending requests sent by this user to others
        Object.keys(friendRequests).forEach(key => {
            friendRequests[key] = friendRequests[key].filter(req => req !== username);
        });

        // Remove from management lists
        if (userManagement.mutedUsers[username]) delete userManagement.mutedUsers[username];
        if (userManagement.bannedFromSite[username]) delete userManagement.bannedFromSite[username];
        Object.keys(userManagement.bannedFromRoom).forEach(roomName => {
            if (userManagement.bannedFromRoom[roomName]?.[username]) {
                delete userManagement.bannedFromRoom[roomName][username];
            }
        });

        // 3. Notify client and disconnect
        socket.emit('account deleted');
        socket.disconnect(true);

        console.log(`تم حذف المستخدم ${username} بنجاح.`);

    } catch (error) {
        console.error(`خطأ في حذف المستخدم ${username}:`, error);
        socket.emit('delete account error', 'حدث خطأ في الخادم أثناء حذف الحساب.');
    }
  });

  socket.on('get user status', (data) => {
    const { username, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    
    // أي شخص لديه صلاحية إدارة (مستوى 2 فما فوق) يمكنه رؤية الحالة، 
    // لكن لا يشترط أن يكون أعلى من الهدف لرؤية الحالة فقط
    if ((ranks[currentUser.rank]?.level || 0) < 2) {
      socket.emit('management error', 'ليس لديك صلاحية لعرض حالة المستخدمين.');
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
      time: new Date().toLocaleTimeString('en-GB')
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
                   (room && room.name === 'غرفة الإدارة' && canManageTargetUser(currentUser, username));
    
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
    const lastSeen = isOnline ? null : userLastSeen[username] || null;
    const userRank = userRanks[username] || null;
    const avatar = userAvatars[username] || null;
    const userData = users[username];
    
    const pointsData = userPoints[username] || { points: 0, level: 1 };

    // جلب قائمة الأصدقاء مع تفاصيلهم
    const friendsList = userFriends[username] || [];
    const friendsDetails = friendsList.map(fName => ({
        username: fName,
        avatar: userAvatars[fName] || null,
        isOnline: Object.values(onlineUsers).some(u => u.name === fName)
    }));

    socket.emit('user profile data', {
        username,
        isOnline,
        lastSeen,
        rank: userRank,
        avatar,
        gender: userData ? userData.gender : null,
        bio: userData ? userData.bio : null,
        points: pointsData.points,
        level: pointsData.level,
        nameColor: userData ? userData.nameColor : null,
        nameBackground: userData ? userData.nameBackground : null,
        avatarFrame: userData ? userData.avatarFrame : null,
        userCardBackground: userData ? userData.userCardBackground : null,
        profileBackground: userData ? userData.profileBackground : null,
        profileCover: userData ? userData.profileCover : null,
        rankExpiry: userRankExpiry[username] || null, // إرسال تاريخ انتهاء الرتبة
        friends: friendsDetails
    });
    
  });

  // حدث تفعيل لون الاسم من المخزن
  socket.on('equip color', async (data) => {
    const { inventoryId, currentUser } = data;
    const username = currentUser.name;
    
    const userInv = userInventories[username] || [];
    const invItem = userInv.find(i => i.id === inventoryId);
    
    if (!invItem) {
        socket.emit('equip error', 'العنصر غير موجود في مخزونك.');
        return;
    }
    
    const shopItem = shopItems.find(i => i.id === invItem.itemId);
    if (!shopItem || shopItem.itemType !== 'name_color') {
        socket.emit('equip error', 'هذا العنصر ليس لوناً.');
        return;
    }
    
    try {
        await User.update({ nameColor: shopItem.itemValue }, { where: { username } });
        users[username].nameColor = shopItem.itemValue;
        
        // تحديث المستخدمين المتصلين
        Object.keys(onlineUsers).forEach(socketId => {
          if (onlineUsers[socketId].name === username) {
            onlineUsers[socketId].nameColor = shopItem.itemValue;
          }
        });
        
        // تحديث الغرف
        rooms.forEach(r => r.users.forEach(u => {
          if (u.name === username) u.nameColor = shopItem.itemValue;
        }));
        
        io.emit('rooms update', rooms);
        
        // تحديث قائمة المستخدمين في الغرفة الحالية
        const userRoom = rooms.find(r => r.users.some(u => u.name === username));
        if (userRoom) io.to(userRoom.id).emit('users update', userRoom.users);
        
        socket.emit('equip success', { message: 'تم تفعيل اللون بنجاح', newColor: shopItem.itemValue });
        
    } catch (error) {
        console.error('Error equipping color:', error);
        socket.emit('equip error', 'حدث خطأ أثناء تفعيل اللون.');
    }
  });

  // حدث تحديث الميزات الخاصة (للرتب العالية)
  socket.on('update user feature', async (data) => {
    const { feature, value, currentUser } = data;
    const username = currentUser.name;

    // التحقق من الرتبة (مستوى 4 أو أعلى) أو صاحب الموقع
    const userRank = userRanks[username];
    const level = ranks[userRank]?.level || 0;
    
    if (level < 4 && username !== SITE_OWNER.username) {
        socket.emit('feature error', 'هذه الميزة متاحة فقط للرتب العالية.');
        return;
    }

    try {
        if (feature === 'nameColor') {
            await User.update({ nameColor: value }, { where: { username } });
            users[username].nameColor = value;
        } else if (feature === 'nameBackground') {
            await User.update({ nameBackground: value }, { where: { username } });
            users[username].nameBackground = value;
        } else if (feature === 'avatarFrame') {
            await User.update({ avatarFrame: value }, { where: { username } });
            users[username].avatarFrame = value;
        } else if (feature === 'userCardBackground') {
            await User.update({ userCardBackground: value }, { where: { username } });
            users[username].userCardBackground = value;
        } else if (feature === 'profileBackground') {
            await User.update({ profileBackground: value }, { where: { username } });
            users[username].profileBackground = value;
        }

        // تحديث المستخدمين المتصلين والغرف ليعكس التغيير فوراً
        Object.keys(onlineUsers).forEach(id => {
            if (onlineUsers[id].name === username) onlineUsers[id][feature] = value;
        });
        
        socket.emit('feature success', 'تم تحديث الميزة بنجاح');
        // نرسل تحديث الغرف لتحديث القوائم
        io.emit('rooms update', rooms);
    } catch (error) {
        console.error('Error updating feature:', error);
        socket.emit('feature error', 'حدث خطأ أثناء تحديث الميزة.');
    }
  });

  // حدث تحديث غلاف الملف الشخصي
  socket.on('update profile cover', async (data) => {
    const { username, coverUrl, currentUser } = data;

    if (username !== currentUser.name) {
        socket.emit('cover error', 'لا يمكنك تغيير غلاف مستخدم آخر.');
        return;
    }

    try {
        await User.update({ profileCover: coverUrl }, { where: { username } });
        if (users[username]) {
            users[username].profileCover = coverUrl;
        }
        socket.emit('cover success', 'تم تحديث غلاف الملف الشخصي بنجاح.');
    } catch (error) {
        console.error('Error updating profile cover:', error);
        socket.emit('cover error', 'حدث خطأ أثناء تحديث الغلاف.');
    }
  });

  socket.on('change username', async (data) => {
    const { newUsername, currentUser } = data;
    const oldUsername = currentUser.name;

    // 1. Security Check
    const userRank = userRanks[oldUsername];
    const level = ranks[userRank]?.level || 0;
    if (level < 4 && oldUsername !== SITE_OWNER.username) {
        return socket.emit('username change error', 'هذه الميزة متاحة فقط للرتب العالية.');
    }

    // 2. Validation
    if (!newUsername || newUsername.length < 3 || newUsername.length > 15) {
        return socket.emit('username change error', 'الاسم الجديد يجب أن يتكون من 3 إلى 15 حرفًا.');
    }
    if (!/^[a-zA-Z0-9\s_]+$/.test(newUsername)) {
        return socket.emit('username change error', 'الاسم الجديد يحتوي على رموز غير مسموح بها.');
    }
    if (newUsername.toLowerCase() === oldUsername.toLowerCase()) {
        return socket.emit('username change error', 'الاسم الجديد مطابق للاسم القديم.');
    }
    const existingUser = await User.findOne({ where: { username: newUsername } });
    if (existingUser) {
        return socket.emit('username change error', 'هذا الاسم مستخدم بالفعل.');
    }

    const t = await sequelize.transaction();
    try {
        // This is a very sensitive operation. Updating a Primary Key is not directly supported
        // and requires cascading updates. We will update all tables manually within a transaction.
        // This assumes no `ON UPDATE CASCADE` is set on the DB level.

        // The order of updates can be tricky. We'll disable foreign key checks during the transaction.
        await sequelize.query('SET CONSTRAINTS ALL DEFERRED;', { transaction: t });

        // Update all tables referencing the username
        await User.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
        await UserRank.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
        await UserAvatar.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
        await UserPoints.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
        await UserLastSeen.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
        await UserInventory.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
        await UserFriend.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
        await UserFriend.update({ friendUsername: newUsername }, { where: { friendUsername: oldUsername }, transaction: t });
        await FriendRequest.update({ fromUser: newUsername }, { where: { fromUser: oldUsername }, transaction: t });
        await FriendRequest.update({ toUser: newUsername }, { where: { toUser: oldUsername }, transaction: t });
        await PrivateMessage.update({ fromUser: newUsername }, { where: { fromUser: oldUsername }, transaction: t });
        await PrivateMessage.update({ toUser: newUsername }, { where: { toUser: oldUsername }, transaction: t });
        await Post.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
        await PostLike.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
        await PostComment.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
        await Notification.update({ recipientUsername: newUsername }, { where: { recipientUsername: oldUsername }, transaction: t });
        await Notification.update({ senderUsername: newUsername }, { where: { senderUsername: oldUsername }, transaction: t });
        await UserManagement.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
        await UserManagement.update({ mutedBy: newUsername }, { where: { mutedBy: oldUsername }, transaction: t });
        await UserManagement.update({ bannedBy: newUsername }, { where: { bannedBy: oldUsername }, transaction: t });
        await UserSession.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
        await ChatImage.update({ fromUser: newUsername }, { where: { fromUser: oldUsername }, transaction: t });
        await ChatImage.update({ toUser: newUsername }, { where: { toUser: oldUsername }, transaction: t });

        await t.commit();

        // --- Update in-memory data ---
        const updateMemoryKey = (obj, oldKey, newKey) => {
            if (obj.hasOwnProperty(oldKey)) {
                obj[newKey] = obj[oldKey];
                delete obj[oldKey];
            }
        };

        updateMemoryKey(users, oldUsername, newUsername);
        updateMemoryKey(userRanks, oldUsername, newUsername);
        updateMemoryKey(userAvatars, oldUsername, newUsername);
        updateMemoryKey(userRankExpiry, oldUsername, newUsername);
        updateMemoryKey(userPoints, oldUsername, newUsername);
        updateMemoryKey(userLastSeen, oldUsername, newUsername);
        updateMemoryKey(userInventories, oldUsername, newUsername);
        updateMemoryKey(userFriends, oldUsername, newUsername);
        updateMemoryKey(friendRequests, oldUsername, newUsername);

        Object.keys(userFriends).forEach(key => {
            userFriends[key] = userFriends[key].map(friend => friend === oldUsername ? newUsername : friend);
        });
        Object.keys(friendRequests).forEach(key => {
            friendRequests[key] = friendRequests[key].map(req => req === oldUsername ? newUsername : req);
        });
        Object.keys(privateMessages).forEach(convId => {
            if (convId.includes(oldUsername)) {
                const newConvId = convId.replace(oldUsername, newUsername).split('_').sort().join('_');
                privateMessages[newConvId] = privateMessages[convId].map(msg => {
                    if (msg.from === oldUsername) msg.from = newUsername;
                    if (msg.to === oldUsername) msg.to = newUsername;
                    return msg;
                });
                if (convId !== newConvId) delete privateMessages[convId];
            }
        });
        Object.keys(posts).forEach(postId => {
            if (posts[postId].username === oldUsername) posts[postId].username = newUsername;
            posts[postId].likes = posts[postId].likes.map(like => like === oldUsername ? newUsername : like);
            posts[postId].comments.forEach(comment => {
                if (comment.username === oldUsername) comment.username = newUsername;
            });
        });

        // Notify all clients of the change
        io.emit('user name changed', { oldUsername, newUsername });

        // Send success and disconnect the user
        socket.emit('username change success', 'تم تغيير اسمك بنجاح. سيتم تسجيل خروجك الآن.');
        
        // Disconnect the user's socket after a short delay
        setTimeout(() => {
            const userSocket = Object.values(onlineUsers).find(u => u.name === newUsername);
            if (userSocket && io.sockets.sockets.get(userSocket.id)) {
                io.sockets.sockets.get(userSocket.id).disconnect(true);
            } else {
                socket.disconnect(true);
            }
        }, 500);

    } catch (error) {
        await t.rollback();
        console.error('Error changing username:', error);
        socket.emit('username change error', 'حدث خطأ فادح أثناء تغيير الاسم. قد تكون هناك مشكلة في قاعدة البيانات.');
    }
  });

  socket.on('update user bio', async (data) => {
    const { username, bio, currentUser } = data;

    if (currentUser.name !== username) {
        socket.emit('bio error', 'لا يمكنك تحديث معلومات مستخدم آخر.');
        return;
    }

    // التحقق من طول النص
    if (bio && bio.length > 500) {
        socket.emit('bio error', 'المعلومات الشخصية يجب أن لا تتجاوز 500 حرف.');
        return;
    }
 
    if (users[username]) {
        try {
            users[username].bio = bio; // تحديث الذاكرة
            await User.update({ bio }, { where: { username } });
            socket.emit('bio success', 'تم تحديث معلوماتك بنجاح.');
        } catch (error) {
            console.error('خطأ في تحديث معلومات المستخدم:', error);
            socket.emit('bio error', 'حدث خطأ أثناء تحديث المعلومات.');
        }
    }
  });

  // حدث تغيير كلمة المرور
  socket.on('change password', async (data) => {
    const { username, oldPassword, newPassword, inventoryId } = data;

    if (!users[username]) {
      socket.emit('password change error', 'المستخدم غير موجود.');
      return;
    }

    // If an inventoryId is provided, it means a card is being used.
    if (inventoryId) {
        const userInventory = userInventories[username] || [];
        const cardIndex = userInventory.findIndex(inv => inv.id === inventoryId);
        if (cardIndex === -1) {
            socket.emit('password change error', 'أنت لا تمتلك بطاقة تغيير كلمة المرور هذه.');
            return;
        }
    } else {
        // For now, we require a card.
        socket.emit('password change error', 'بطاقة تغيير كلمة المرور غير متوفرة.');
        return;
    }

    const t = await sequelize.transaction();

    try {
      // التحقق من كلمة المرور القديمة
      const isPasswordValid = await bcrypt.compare(oldPassword, users[username].password);
      if (!isPasswordValid) {
        await t.rollback();
        socket.emit('password change error', 'كلمة المرور القديمة غير صحيحة.');
        return;
      }

      // تشفير وتحديث كلمة المرور الجديدة
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await User.update({ password: hashedNewPassword }, { where: { username }, transaction: t });

      // حذف بطاقة تغيير كلمة المرور المستخدمة
      if (inventoryId) {
          await UserInventory.destroy({ where: { id: inventoryId }, transaction: t });
          // Also remove from in-memory inventory
          userInventories[username] = userInventories[username].filter(inv => inv.id !== inventoryId);
      }

      await t.commit();

      // تحديث كلمة المرور في الذاكرة
      users[username].password = hashedNewPassword;

      // حذف جميع جلسات المستخدم لإجباره على تسجيل الدخول مرة أخرى
      await UserSession.destroy({ where: { username } });

      socket.emit('password change success', 'تم تغيير كلمة المرور بنجاح. سيتم تسجيل خروجك الآن.');
      
      // Disconnect the user to force re-login
      socket.disconnect(true);

    } catch (error) {
      await t.rollback();
      console.error('خطأ في تغيير كلمة المرور:', error);
      socket.emit('password change error', 'حدث خطأ في الخادم أثناء تغيير كلمة المرور.');
    }
  });

  socket.on('send private message', async (data) => {
    let { toUser, message, fromUser } = data;
    if (!toUser || !fromUser) return;
    
    toUser = toUser.trim();
    fromUser = fromUser.trim();
    
    // حفظ الرسالة الخاصة
    const conversationId = [fromUser, toUser].sort().join('_');
    if (!privateMessages[conversationId]) {
      privateMessages[conversationId] = [];
    }
    
    const privateMessage = {
      from: fromUser,
      to: toUser,
      content: message, 
      read: false,
      time: new Date().toLocaleTimeString('en-GB'),
      timestamp: new Date().getTime(),
      avatar: userAvatars[fromUser] || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + fromUser
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
      // إرسال حدث لتحديث قائمة المحادثات للمستلم
      io.to(recipientSocketId).emit('get unread counts', toUser);
      io.to(recipientSocketId).emit('private conversations updated');
    }
    // إرسال حدث لتحديث قائمة المحادثات للمرسل أيضاً
    socket.emit('private conversations updated');
  });

  // في حدث join room، أضف تحميل الصور للمحادثات الخاصة
socket.on('get private messages', async (data) => {
  let { otherUser, currentUser } = data;
  if (!otherUser || !currentUser) return;
  
  // تنظيف الأسماء من الفراغات الزائدة
  otherUser = otherUser.trim();
  currentUser = currentUser.trim();
  
  const conversationId = [currentUser, otherUser].sort().join('_');
  const normalizedConvId = [currentUser.toLowerCase(), otherUser.toLowerCase()].sort().join('_');
  
  try {
    // جلب الرسائل النصية من قاعدة البيانات
    // استخدام عدة طرق للبحث لضمان استرجاع الرسائل حتى لو اختلف تنسيق المعرف
    const dbTextMessages = await PrivateMessage.findAll({
      where: {
        [Sequelize.Op.or]: [
          { conversationId: conversationId },
          { conversationId: normalizedConvId },
          {
            [Sequelize.Op.or]: [
              { fromUser: currentUser, toUser: otherUser },
              { fromUser: otherUser, toUser: currentUser }
            ]
          }
        ]
      },
      order: [['timestamp', 'DESC']],
      limit: 100
    });

    const textMessages = dbTextMessages.map(msg => ({
      from: msg.fromUser,
      to: msg.toUser,
      content: msg.content,
      time: msg.time,
      timestamp: Number(msg.timestamp),
      avatar: userAvatars[msg.fromUser] || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + msg.fromUser
    })).reverse();
    
    // جلب الصور من قاعدة البيانات للمحادثة الخاصة
    const imagesData = await ChatImage.findAll({
      where: {
        [Sequelize.Op.or]: [
          { conversationId: conversationId },
          { conversationId: normalizedConvId },
          {
            [Sequelize.Op.or]: [
              { fromUser: currentUser, toUser: otherUser },
              { fromUser: otherUser, toUser: currentUser }
            ]
          }
        ]
      },
      order: [['timestamp', 'DESC']],
      limit: 50
    });
    
    // تحويل الصور إلى شكل مشابه للرسائل النصية
    const imageMessages = imagesData.map(image => ({
      type: 'image',
      messageId: image.messageId,
      from: image.fromUser,
      to: image.toUser || (image.fromUser === currentUser ? otherUser : currentUser),
      imageData: image.imageData,
      time: new Date(Number(image.timestamp)).toLocaleTimeString('ar-SA'),
      timestamp: Number(image.timestamp),
      avatar: userAvatars[image.fromUser] || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + image.fromUser
    })).reverse();
    
    // دمج الرسائل النصية والصورية وترتيبها حسب الوقت
    const allMessages = [...textMessages, ...imageMessages].sort((a, b) => a.timestamp - b.timestamp);
    
    socket.emit('private messages history', allMessages);
  } catch (error) {
    console.error('خطأ في تحميل تاريخ المحادثة الخاصة:', error);
    socket.emit('private messages history', []);
  }

  // عند فتح محادثة خاصة، حدد الرسائل كمقروءة
  await PrivateMessage.update({ read: true }, {
    where: { fromUser: otherUser, toUser: currentUser, read: false }
  });
  socket.emit('private conversations updated'); // تحديث القائمة للمرسل
});

  // حدث جديد لجلب قائمة المحادثات الخاصة
  socket.on('get private conversations', async (username) => {
    if (!username) return;
    username = username.trim();
    try {
      // جلب آخر 2000 رسالة لضمان العثور على أغلب المحادثات النشطة وتحسين الأداء
      const conversations = await PrivateMessage.findAll({
        where: {
          [Sequelize.Op.or]: [{ fromUser: username }, { toUser: username }]
        },
        order: [['timestamp', 'DESC']],
        limit: 2000
      });

      const conversationsMap = new Map();

      for (const msg of conversations) {
        const otherUser = msg.fromUser === username ? msg.toUser : msg.fromUser;

        if (!conversationsMap.has(otherUser)) {
          // جلب عدد الرسائل غير المقروءة
          const unreadCount = await PrivateMessage.count({
            where: {
              fromUser: otherUser,
              toUser: username,
              read: false
            }
          });

          conversationsMap.set(otherUser, {
            otherUser: otherUser,
            lastMessage: {
              content: msg.content,
              timestamp: Number(msg.timestamp)
            },
            unreadCount: unreadCount,
            isOnline: Object.values(onlineUsers).some(u => u.name === otherUser)
          });
        }
      }

      const result = Array.from(conversationsMap.values())
        .sort((a, b) => {
          // المحادثات غير المقروءة أولاً، ثم الأحدث
          if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
          if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
          return b.lastMessage.timestamp - a.lastMessage.timestamp;
        });

      socket.emit('private conversations list', result);

    } catch (error) {
      console.error('خطأ في جلب المحادثات الخاصة:', error);
    }
  });

  // حدث لتحديد الرسائل الخاصة كمقروءة
  socket.on('mark private messages as read', async (data) => {
    const { reader, fromUser } = data;
    try {
      // تحديث الرسائل من مستخدم معين فقط
      await PrivateMessage.update({ read: true }, { where: { toUser: reader, fromUser: fromUser, read: false } });
      // إرسال تحديث للمستخدم للتأكد من إزالة مؤشرات "غير مقروء"
      socket.emit('private conversations updated');
    } catch (error) {
      console.error('خطأ في تحديث حالة الرسائل الخاصة:', error);
    }
  });
  
  // حدث جديد لجلب عدد الإشعارات والرسائل غير المقروءة
  socket.on('get unread counts', async (username) => {
    try {
      const unreadMessagesCount = await PrivateMessage.count({
        where: {
          toUser: username,
          read: false
        }
      });
      const unreadNotificationsCount = await Notification.count({
        where: {
          recipientUsername: username,
          read: false
        }
      });
      socket.emit('unread counts data', { privateMessages: unreadMessagesCount, notifications: unreadNotificationsCount });
    } catch (error) {
      console.error('خطأ في جلب عدد غير المقروء:', error);
      // في حالة حدوث خطأ، أرسل أصفارًا لتجنب مشاكل في الواجهة
      socket.emit('unread counts data', { privateMessages: 0, notifications: 0 });
    }
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

  socket.on('get initial data', async (username) => {
    try {
      const [unreadMessagesCount, unreadNotificationsCount] = await Promise.all([
        PrivateMessage.count({ where: { toUser: username, read: false } }),
        Notification.count({ where: { recipientUsername: username, read: false } })
      ]);
      
      socket.emit('initial data', {
        friendRequests: friendRequests[username] || [],
        friendsList: userFriends[username] || [],
        unreadCounts: { privateMessages: unreadMessagesCount, notifications: unreadNotificationsCount },
        userAvatars: userAvatars
      });
    } catch (error) {
      console.error('خطأ في جلب البيانات الأولية:', error);
      socket.emit('initial data', {
        friendRequests: friendRequests[username] || [],
        friendsList: userFriends[username] || [],
        unreadCounts: { privateMessages: 0, notifications: 0 },
        userAvatars: userAvatars
      });
    }
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

  socket.on('set room manager', async (data) => {
    const { roomId, managerUsername, currentUser } = data;
    
    if (currentUser.name !== SITE_OWNER.username) {
      socket.emit('management error', 'عذراً، تعيين مديري الغرف متاح فقط لصاحب الموقع.');
      return;
    }

    if (!users[managerUsername]) {
      socket.emit('management error', 'المستخدم غير موجود');
      return;
    }

    const room = rooms.find(r => r.id === roomId);
    if (!room) {
      socket.emit('management error', 'الغرفة غير موجودة');
      return;
    }

    if (!roomManagers[roomId]) {
      roomManagers[roomId] = [];
    }

    if (!roomManagers[roomId].includes(managerUsername)) {
      roomManagers[roomId].push(managerUsername);
      room.managers = roomManagers[roomId];

      try {
        await RoomManager.create({
          roomId,
          managerUsername,
          assignedBy: currentUser.name
        });

        const notificationMessage = {
          type: 'system',
          user: 'رسائل النظام',
          avatar: BOT_AVATAR_URL,
          content: `👮 تم تعيين ${managerUsername} كمدير لغرفة ${room.name} من قبل ${currentUser.name}`,
          time: new Date().toLocaleTimeString('ar-SA')
        };

        io.to(roomId).emit('new message', notificationMessage);
        messages[roomId] = messages[roomId] || [];
        messages[roomId].push(notificationMessage);
        io.emit('rooms update', rooms);

        socket.emit('management success', `تم تعيين ${managerUsername} كمدير للغرفة بنجاح`);
      } catch (error) {
        socket.emit('management error', 'حدث خطأ عند تعيين المدير');
        console.error('Error setting room manager:', error);
      }
    } else {
      socket.emit('management error', 'المستخدم مدير بالفعل في هذه الغرفة');
    }
  });

  socket.on('remove room manager', async (data) => {
    const { roomId, managerUsername, currentUser } = data;
    
    if (currentUser.name !== SITE_OWNER.username) {
      socket.emit('management error', 'عذراً، إزالة مديري الغرف متاحة فقط لصاحب الموقع.');
      return;
    }

    const room = rooms.find(r => r.id === roomId);
    if (!room) {
      socket.emit('management error', 'الغرفة غير موجودة');
      return;
    }

    if (roomManagers[roomId] && roomManagers[roomId].includes(managerUsername)) {
      roomManagers[roomId] = roomManagers[roomId].filter(m => m !== managerUsername);
      room.managers = roomManagers[roomId];

      try {
        await RoomManager.destroy({
          where: {
            roomId,
            managerUsername
          }
        });

        const notificationMessage = {
          type: 'system',
          user: 'رسائل النظام',
          avatar: BOT_AVATAR_URL,
          content: `👮 تم إزالة ${managerUsername} من منصب مدير غرفة ${room.name} من قبل ${currentUser.name}`,
          time: new Date().toLocaleTimeString('ar-SA')
        };

        io.to(roomId).emit('new message', notificationMessage);
        messages[roomId] = messages[roomId] || [];
        messages[roomId].push(notificationMessage);
        io.emit('rooms update', rooms);

        socket.emit('management success', `تم إزالة ${managerUsername} من منصب مدير الغرفة بنجاح`);
      } catch (error) {
        socket.emit('management error', 'حدث خطأ عند إزالة المدير');
        console.error('Error removing room manager:', error);
      }
    } else {
      socket.emit('management error', 'المستخدم ليس مديراً في هذه الغرفة');
    }
  });
  
  socket.on('get room managers', (roomId) => {
    const managers = roomManagers[roomId] || [];
    socket.emit('room managers list', { roomId, managers });
  });

  socket.on('get room info', async (roomId) => {
    const roomIdInt = parseInt(roomId);
    const room = rooms.find(r => r.id === roomIdInt);
    if (room) {
      const background = roomBackgrounds[roomIdInt] || { type: 'color', value: '#000000' };
      const settings = roomSettings[roomIdInt] || { description: room.description, textColor: 'text-white', messageBackground: 'bg-gray-800' };
      socket.emit('room info', {
        id: room.id,
        name: room.name,
        icon: room.icon,
        description: settings.description || room.description,
        managers: roomManagers[roomIdInt] || [],
        background,
        settings
      });
    }
  });

  socket.on('update room settings', async (data) => {
    const { roomId, description, textColor, messageBackground, currentUser } = data;
    const roomIdInt = parseInt(roomId);
    
    if (!canManageRoom(currentUser.name, roomIdInt)) {
      socket.emit('management error', 'ليس لديك صلاحية لتعديل إعدادات هذه الغرفة');
      return;
    }

    try {
      const room = rooms.find(r => r.id === roomIdInt);
      if (!room) {
        socket.emit('management error', 'الغرفة غير موجودة');
        return;
      }

      await RoomSettings.upsert({
        roomId: roomIdInt,
        description: description || room.description,
        textColor: textColor || 'text-white',
        messageBackground: messageBackground || 'bg-gray-800',
        updatedBy: currentUser.name
      });

      roomSettings[roomIdInt] = {
        description: description || room.description,
        textColor: textColor || 'text-white',
        messageBackground: messageBackground || 'bg-gray-800'
      };

      room.settings = roomSettings[roomIdInt];
      io.emit('rooms update', rooms);
      io.emit('management success', 'تم تحديث إعدادات الغرفة بنجاح');
    } catch (error) {
      socket.emit('management error', 'حدث خطأ في تحديث الإعدادات');
      console.error('Error updating room settings:', error);
    }
  });

  socket.on('update room background', async (data) => {
    const { roomId, backgroundType, backgroundValue, currentUser } = data;
    const roomIdInt = parseInt(roomId);
    
    if (!canManageRoom(currentUser.name, roomIdInt)) {
      socket.emit('management error', 'ليس لديك صلاحية لتعديل خلفية هذه الغرفة');
      return;
    }

    try {
      const room = rooms.find(r => r.id === roomIdInt);
      if (!room) {
        socket.emit('management error', 'الغرفة غير موجودة');
        return;
      }

      await RoomBackground.upsert({
        roomId: roomIdInt,
        backgroundType,
        backgroundValue,
        setBy: currentUser.name
      });

      roomBackgrounds[roomIdInt] = {
        type: backgroundType,
        value: backgroundValue
      };

      room.background = roomBackgrounds[roomIdInt];
      io.emit('rooms update', rooms);
      io.emit('management success', 'تم تحديث خلفية الغرفة بنجاح');
    } catch (error) {
      socket.emit('management error', 'حدث خطأ في تحديث الخلفية');
      console.error('Error updating room background:', error);
    }
  });

  socket.on('delete message', async (data) => {
    const { messageId, roomId, currentUser } = data;
    const user = onlineUsers[socket.id];

    if (!user) {
      socket.emit('management error', 'يجب أن تكون في غرفة لحذف الرسائل');
      return;
    }

    if (!canManageRoom(currentUser.name, roomId)) {
      socket.emit('management error', 'ليس لديك صلاحية لحذف الرسائل في هذه الغرفة');
      return;
    }

    if (messages[roomId]) {
      const index = messages[roomId].findIndex(msg => msg.messageId === messageId);
      if (index !== -1) {
        messages[roomId].splice(index, 1);
        io.to(`room-${roomId}`).emit('message deleted', { messageId, roomId });
        socket.emit('management success', 'تم حذف الرسالة بنجاح');
      }
    }
  });

  socket.on('add room', async (data) => {
    const { name, icon, description, order, currentUser } = data;

    if (currentUser.name !== SITE_OWNER.username) {
      socket.emit('management error', 'عذراً، إضافة الغرف متاحة فقط لصاحب الموقع.');
      return;
    }

    if (!name || !icon) {
      socket.emit('management error', 'يجب إدخال اسم الغرفة والأيقونة');
      return;
    }

    try {
      const existingRoom = rooms.find(r => r.name === name);
      if (existingRoom) {
        socket.emit('management error', 'اسم الغرفة موجود بالفعل');
        return;
      }

      const newRoom = await Room.create({
        name,
        icon,
        description: description || '',
        protected: false,
        order: parseInt(order) || 0,
        createdBy: currentUser.name
      });

      const roomData = {
        id: newRoom.id,
        name: newRoom.name,
        icon: newRoom.icon,
        description: newRoom.description,
        protected: newRoom.protected,
        order: newRoom.order,
        users: [],
        managers: []
      };

      rooms.push(roomData);
      // إعادة ترتيب الغرف في الذاكرة
      rooms.sort((a, b) => (a.order - b.order) || (a.id - b.id));
      
      io.emit('rooms update', rooms);
      socket.emit('management success', `تم إنشاء الغرفة "${name}" بنجاح`);
    } catch (error) {
      socket.emit('management error', 'حدث خطأ في إنشاء الغرفة');
      console.error('Error adding room:', error);
    }
  });

  socket.on('update room order', async (data) => {
    const { roomId, newOrder, currentUser } = data;

    if (currentUser.name !== SITE_OWNER.username) {
      socket.emit('management error', 'عذراً، تعديل الترتيب متاح فقط لصاحب الموقع.');
      return;
    }

    // تحديث في الذاكرة أولاً لضمان استجابة سريعة للواجهة
    const roomInMemory = rooms.find(r => r.id === parseInt(roomId));
    const oldOrder = roomInMemory ? roomInMemory.order : 0;
    
    if (roomInMemory) {
      roomInMemory.order = parseInt(newOrder);
      rooms.sort((a, b) => (a.order - b.order) || (a.id - b.id));
      io.emit('rooms update', rooms);
    }

    try {
      const room = await Room.findByPk(roomId);
      if (!room) {
        socket.emit('management error', 'الغرفة غير موجودة في قاعدة البيانات');
        return;
      }

      await room.update({ order: parseInt(newOrder) });
      socket.emit('management success', 'تم تحديث ترتيب الغرفة بنجاح');
    } catch (error) {
      // في حال فشل التحديث في قاعدة البيانات، نعيد القيمة القديمة في الذاكرة ونرسل خطأ
      if (roomInMemory) {
        roomInMemory.order = oldOrder;
        rooms.sort((a, b) => (a.order - b.order) || (a.id - b.id));
        io.emit('rooms update', rooms);
      }
      
      let errorMsg = 'حدث خطأ في تحديث الترتيب بقاعدة البيانات';
      if (error.name === 'SequelizeConnectionError' || error.name === 'SequelizeConnectionTimedOutError') {
        errorMsg = 'فشل الاتصال بقاعدة البيانات، يرجى المحاولة مرة أخرى لاحقاً.';
      }
      
      socket.emit('management error', errorMsg);
      console.error('Error updating room order:', error);
    }
  });

  socket.on('delete room', async (data) => {
    const { roomId, currentUser } = data;
    const roomIdInt = parseInt(roomId);

    if (currentUser.name !== SITE_OWNER.username) {
      socket.emit('management error', 'عذراً، حذف الغرف متاح فقط لصاحب الموقع.');
      return;
    }

    try {
      const room = rooms.find(r => r.id === roomIdInt);
      if (!room) {
        socket.emit('management error', 'الغرفة غير موجودة');
        return;
      }

      if (room.protected) {
        socket.emit('management error', 'لا يمكن حذف الغرف المحمية');
        return;
      }

      // حذف من قاعدة البيانات
      await Room.destroy({ where: { id: roomIdInt } });
      
      // حذف الإعدادات والخلفيات المرتبطة
      await RoomSettings.destroy({ where: { roomId: roomIdInt } });
      await RoomBackground.destroy({ where: { roomId: roomIdInt } });
      await RoomManager.destroy({ where: { roomId: roomIdInt } });

      // حذف من الذاكرة
      const index = rooms.findIndex(r => r.id === roomIdInt);
      if (index !== -1) {
        rooms.splice(index, 1);
      }

      delete roomSettings[roomIdInt];
      delete roomBackgrounds[roomIdInt];
      delete roomManagers[roomIdInt];
      delete messages[roomIdInt];

      io.emit('rooms update', rooms);
      socket.emit('management success', `تم حذف الغرفة "${room.name}" بنجاح`);
    } catch (error) {
      socket.emit('management error', 'حدث خطأ في حذف الغرفة');
      console.error('Error deleting room:', error);
    }
  });

  socket.on('get all rooms for management', async (currentUser) => {
    if (currentUser.name !== SITE_OWNER.username) {
      socket.emit('management error', 'ليس لديك صلاحية للوصول إلى هذه البيانات');
      return;
    }

    try {
      const allRooms = await Room.findAll({ order: [['id', 'ASC']] });
      const roomsList = allRooms.map(room => ({
        id: room.id,
        name: room.name,
        icon: room.icon,
        description: room.description,
        protected: room.protected,
        createdBy: room.createdBy,
        createdAt: room.createdAt,
        usersCount: rooms.find(r => r.id === room.id)?.users.length || 0
      }));

      socket.emit('all rooms for management', roomsList);
    } catch (error) {
      socket.emit('management error', 'حدث خطأ في جلب الغرف');
      console.error('Error fetching rooms:', error);
    }
  });
  
  // في حدث disconnect - البحث عن هذا الجزء واستبداله
socket.on('disconnect', async (reason) => {
    const user = onlineUsers[socket.id];
    if (user) {
      const roomId = user.roomId;
      const room = rooms.find(r => r.id === roomId);
      
      if (room) {
        room.users = room.users.filter(u => u.id !== socket.id);
        broadcastRoomsUpdate();
        io.to(roomId).emit('users update', room.users);
      }
      
      // تحديث آخر ظهور للمستخدم
      const lastSeenTime = Date.now();
      userLastSeen[user.name] = lastSeenTime;
      await saveUserLastSeen(user.name, lastSeenTime);
      delete onlineUsers[socket.id];
    }
    
    console.log('مستخدم انقطع:', socket.id);
});

  // حدث جلب قائمة المتفاعلين
  socket.on('get top users', async () => {
    try {
      // استثناء المستخدمين الخاصين من القائمة
      const specialUsernames = Object.keys(SPECIAL_USERS_CONFIG);
      const topUsersData = await UserPoints.findAll({
        where: {
          username: {
            [Sequelize.Op.notIn]: specialUsernames
          },
          showInTop: true
        },
        order: [['points', 'DESC']],
        limit: 10
      });

      const topUsersList = topUsersData.map(user => ({
        username: user.username,
        points: user.points,
        level: user.level,
        avatar: userAvatars[user.username] || null
      }));

      socket.emit('top users list', topUsersList);

    } catch (error) {
      console.error('خطأ في جلب قائمة المتفاعلين:', error);
      socket.emit('error', 'حدث خطأ أثناء جلب قائمة المتفاعلين.');
    }
  });

  // حدث إرسال النقاط
  socket.on('send points', async (data) => {
    const { fromUser, toUser, amount } = data;

    // التحقق من المدخلات
    if (!fromUser || !toUser || !amount || amount <= 0) {
      socket.emit('points sent error', 'بيانات غير صالحة.');
      return;
    }

    if (fromUser === toUser) {
      socket.emit('points sent error', 'لا يمكنك إرسال نقاط لنفسك.');
      return;
    }

    // التحقق من وجود المستخدمين والنقاط
    if (!users[fromUser] || !users[toUser]) {
      socket.emit('points sent error', 'المستخدم غير موجود.');
      return;
    }

    // التحقق من النقاط فقط إذا لم يكن المرسل مستخدمًا خاصًا
    if (!SPECIAL_USERS_CONFIG[fromUser]) {
        const senderPoints = userPoints[fromUser] || { points: 0, level: 1, isInfinite: false };
        if (!senderPoints.isInfinite && senderPoints.points < amount) {
            socket.emit('points sent error', 'ليس لديك نقاط كافية لإتمام هذه العملية.');
            return;
        }
    }

    try {
      // خصم النقاط من المرسل فقط إذا لم يكن مستخدمًا خاصًا
      if (!SPECIAL_USERS_CONFIG[fromUser]) {
        if (!userPoints[fromUser].isInfinite) {
            userPoints[fromUser].points -= amount;
            await saveUserPoints(fromUser, userPoints[fromUser].points, userPoints[fromUser].level);
        }
      }

      // إضافة النقاط للمستلم فقط إذا لم يكن لديه نقاط لانهائية
      if (!userPoints[toUser]) {
        userPoints[toUser] = { points: 0, level: 1, isInfinite: false };
      }
      
      if (!userPoints[toUser].isInfinite) {
        userPoints[toUser].points += amount;

        // التحقق من ترقية مستوى المستلم
        const recipientLevel = userPoints[toUser].level;
        const pointsNeeded = recipientLevel * 100;
        if (userPoints[toUser].points >= pointsNeeded) {
            userPoints[toUser].level += 1;
        }
        await saveUserPoints(toUser, userPoints[toUser].points, userPoints[toUser].level);
      }

      // إرسال إشعار عام لجميع الغرف
      const notificationMessage = {
        type: 'system',
        user: 'رسائل النظام',
        avatar: BOT_AVATAR_URL,
        content: `🎁 أرسل <strong class="text-white">${fromUser}</strong> عدد <strong class="text-yellow-300">${amount}</strong> نقطة إلى <strong class="text-white">${toUser}</strong>.`,
        time: new Date().toLocaleTimeString('en-GB')
      };
      io.emit('new message', notificationMessage);
      Object.keys(messages).forEach(roomId => {
        if (messages[roomId]) {
            messages[roomId].push(notificationMessage);
        }
      });

      // إرسال إشعار نجاح للمرسل مع نقاطه المحدثة
      socket.emit('points sent success', {
        message: `تم إرسال ${amount} نقطة إلى ${toUser} بنجاح.`,
        newPoints: SPECIAL_USERS_CONFIG[fromUser] ? SPECIAL_USERS_CONFIG[fromUser].points : userPoints[fromUser].points
      });

    } catch (error) {
      console.error('خطأ في إرسال النقاط:', error);
      socket.emit('points sent error', 'حدث خطأ في الخادم أثناء إرسال النقاط.');
    }
  });

  socket.on('buy item', async (data) => {
    const { itemId, currentUser } = data;
    const username = currentUser.name;

    const item = shopItems.find(i => i.id === itemId);
    if (!item) {
      socket.emit('buy item error', 'هذا العنصر غير متوفر.');
      return;
    }

    // التحقق من النقاط فقط إذا لم يكن المستخدم خاصًا
    if (!SPECIAL_USERS_CONFIG[username]) {
        const userPointsData = userPoints[username] || { points: 0, isInfinite: false };
        if (!userPointsData.isInfinite && userPointsData.points < item.price) {
            socket.emit('buy item error', 'ليس لديك نقاط كافية لشراء هذه الرتبة.');
            return;
        }
    }

    try {
      // 1. خصم النقاط
      let newPoints = userPoints[username]?.points || 0;
      if (!SPECIAL_USERS_CONFIG[username] && !userPoints[username]?.isInfinite) {
          newPoints -= item.price;
          await saveUserPoints(username, newPoints, userPoints[username].level);
          userPoints[username].points = newPoints;
      }

      // 2. منح الرتبة مباشرة
      if (item.itemType === 'rank') {
          const newRank = item.itemValue;
          
          let expiresAt = null;
          if (newRank !== 'صاحب الموقع') {
               expiresAt = new Date();
               expiresAt.setDate(expiresAt.getDate() + 30);
          }

          userRanks[username] = newRank;
          if (expiresAt) userRankExpiry[username] = expiresAt;
          else delete userRankExpiry[username];
          await saveUserRank(username, newRank, expiresAt);
          
          // تحديث المستخدمين المتصلين والغرف
          Object.keys(onlineUsers).forEach(socketId => {
              if (onlineUsers[socketId].name === username) onlineUsers[socketId].rank = newRank;
          });
          rooms.forEach(r => r.users.forEach(u => {
              if (u.name === username) u.rank = newRank;
          }));
          io.emit('rooms update', rooms);
      }

      // 3. إرسال إشعار نجاح وطلب تحديث الصفحة
      socket.emit('buy item success', {
        message: `🎉 تهانينا! لقد اشتريت "${item.name}" بنجاح. سيتم تحديث الصفحة.`,
        reload: true
      });

    } catch (error) {
      console.error('خطأ في عملية الشراء:', error);
      socket.emit('buy item error', 'حدث خطأ في الخادم أثناء محاولة الشراء.');
    }
  });

  // --- حدث تغيير الاسم ---
  socket.on('use name change card', async (data) => {
    const { oldUsername, newUsername, inventoryId, currentUser } = data;

    // التحقق من أن المستخدم هو نفسه
    if (currentUser.name !== oldUsername) {
      socket.emit('name change error', 'محاولة غير مصرح بها.');
      return;
    }

    // التحقق من صحة الاسم الجديد
    if (!newUsername || newUsername.length < 3 || newUsername.length > 15 || !/^[a-zA-Z0-9\s_]+$/.test(newUsername)) {
      socket.emit('name change error', 'الاسم الجديد غير صالح. يجب أن يتكون من 3-15 حرفًا (أحرف إنجليزية، أرقام، مسافات، _).');
      return;
    }

    // التحقق من أن الاسم الجديد غير مستخدم
    if (users[newUsername]) {
      socket.emit('name change error', 'هذا الاسم مستخدم بالفعل.');
      return;
    }

    // التحقق من أن المستخدم يمتلك البطاقة
    const userInventory = userInventories[oldUsername] || [];
    const cardIndex = userInventory.findIndex(inv => inv.id === inventoryId);
    if (cardIndex === -1) {
      socket.emit('name change error', 'أنت لا تمتلك بطاقة تغيير الاسم هذه.');
      return;
    }

    const t = await sequelize.transaction();

    try {
      // 1. تحديث الاسم في جميع الجداول
      const tablesToUpdate = [
        'User', 'UserRank', 'UserAvatar', 'UserPoints', 'UserLastSeen',
        'UserInventory', 'UserFriend', 'FriendRequest', 'PrivateMessage',
        'Post', 'PostLike', 'PostComment', 'Notification', 'UserManagement'
      ];

      for (const table of tablesToUpdate) {
        const model = sequelize.model(table);
        if (model.rawAttributes.username) {
          await model.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
        }
        if (model.rawAttributes.friendUsername) {
          await model.update({ friendUsername: newUsername }, { where: { friendUsername: oldUsername }, transaction: t });
        }
        if (model.rawAttributes.fromUser) {
          await model.update({ fromUser: newUsername }, { where: { fromUser: oldUsername }, transaction: t });
        }
        if (model.rawAttributes.toUser) {
          await model.update({ toUser: newUsername }, { where: { toUser: oldUsername }, transaction: t });
        }
        if (model.rawAttributes.senderUsername) {
          await model.update({ senderUsername: newUsername }, { where: { senderUsername: oldUsername }, transaction: t });
        }
        if (model.rawAttributes.recipientUsername) {
          await model.update({ recipientUsername: newUsername }, { where: { recipientUsername: oldUsername }, transaction: t });
        }
      }

      // 2. حذف بطاقة تغيير الاسم المستخدمة
      await UserInventory.destroy({ where: { id: inventoryId }, transaction: t });

      // 3. تحديث البيانات في الذاكرة
      // (سيتم إعادة تحميل البيانات بالكامل بعد التغيير لضمان التناسق)

      // 4. إتمام العملية
      await t.commit();

      // 5. تحديث البيانات في الذاكرة يدوياً
      // نسخ البيانات إلى الاسم الجديد
      users[newUsername] = users[oldUsername];
      if (userRanks[oldUsername]) userRanks[newUsername] = userRanks[oldUsername];
      if (userRankExpiry[oldUsername]) userRankExpiry[newUsername] = userRankExpiry[oldUsername];
      if (userAvatars[oldUsername]) userAvatars[newUsername] = userAvatars[oldUsername];
      if (userPoints[oldUsername]) userPoints[newUsername] = userPoints[oldUsername];
      if (userLastSeen[oldUsername]) userLastSeen[newUsername] = userLastSeen[oldUsername];
      if (userInventories[oldUsername]) userInventories[newUsername] = userInventories[oldUsername];
      if (userFriends[oldUsername]) userFriends[newUsername] = userFriends[oldUsername];
      if (friendRequests[oldUsername]) friendRequests[newUsername] = friendRequests[oldUsername];

      // حذف البيانات القديمة
      delete users[oldUsername];
      delete userRanks[oldUsername];
      delete userRankExpiry[oldUsername];
      delete userAvatars[oldUsername];
      delete userPoints[oldUsername];
      delete userLastSeen[oldUsername];
      delete userInventories[oldUsername];
      delete userFriends[oldUsername];
      delete friendRequests[oldUsername];

      // تحديث الاسم في قوائم الأصدقاء والطلبات
      Object.keys(userFriends).forEach(username => {
          const friendList = userFriends[username];
          const index = friendList.indexOf(oldUsername);
          if (index > -1) {
              friendList[index] = newUsername;
          }
      });
      Object.keys(friendRequests).forEach(username => {
          const requestList = friendRequests[username];
          const index = requestList.indexOf(oldUsername);
          if (index > -1) {
              requestList[index] = newUsername;
          }
      });

      // تحديث الاسم في الرسائل الخاصة
      Object.keys(privateMessages).forEach(conversationId => {
          if (conversationId.includes(oldUsername)) {
              const newConversationId = conversationId.replace(oldUsername, newUsername).split('_').sort().join('_');
              if (privateMessages[conversationId]) {
                  privateMessages[newConversationId] = privateMessages[conversationId].map(msg => {
                      if (msg.from === oldUsername) msg.from = newUsername;
                      if (msg.to === oldUsername) msg.to = newUsername;
                      return msg;
                  });
                  if (conversationId !== newConversationId) {
                      delete privateMessages[conversationId];
                  }
              }
          }
      });

      // تحديث الاسم في بيانات المستخدمين المتصلين
      Object.keys(onlineUsers).forEach(socketId => {
          if (onlineUsers[socketId].name === oldUsername) {
              onlineUsers[socketId].name = newUsername;
          }
      });

      // تحديث الاسم في الغرف
      rooms.forEach(room => {
          room.users.forEach(user => {
              if (user.name === oldUsername) {
                  user.name = newUsername;
              }
          });
      });

      // تحديث الاسم في المنشورات والتعليقات والإعجابات
      Object.keys(posts).forEach(postId => {
          if (posts[postId].username === oldUsername) {
              posts[postId].username = newUsername;
          }
          posts[postId].likes = posts[postId].likes.map(like => like === oldUsername ? newUsername : like);
          posts[postId].comments.forEach(comment => {
              if (comment.username === oldUsername) {
                  comment.username = newUsername;
              }
          });
      });

      console.log(`تم تحديث الاسم من ${oldUsername} إلى ${newUsername} في الذاكرة.`);

      // 6. تحديث جلسة المستخدم الحالية
      const newSessionId = 'session_' + Date.now() + Math.random().toString(36).substr(2, 9);
      userSessions[newSessionId] = { username: newUsername, password: users[newUsername].password };
      await saveUserSession(newSessionId, newUsername, users[newUsername].password);

      // 7. إرسال إشعار عام
      const notificationMessage = {
        type: 'system',
        user: 'رسائل النظام',
        avatar: BOT_AVATAR_URL,
        content: `📝 المستخدم <strong class="text-white">${oldUsername}</strong> أصبح معروفاً الآن باسم <strong class="text-white">${newUsername}</strong>.`,
        time: new Date().toLocaleTimeString('en-GB')
      };
      io.emit('new message', notificationMessage);

      // 8. إرسال إشعار نجاح للمستخدم مع الجلسة الجديدة
      socket.emit('name change success', {
        message: 'تم تغيير اسمك بنجاح!',
        newUsername: newUsername,
        newSessionId: newSessionId,
        nameColor: users[newUsername].nameColor // إرسال لون الاسم الجديد
      });

      // 9. تحديث جميع العملاء بالاسم الجديد
      io.emit('user name changed', { oldUsername, newUsername });

    } catch (error) {
      await t.rollback();
      console.error('خطأ في تغيير الاسم:', error);
      socket.emit('name change error', 'حدث خطأ فادح أثناء تغيير الاسم. يرجى المحاولة مرة أخرى.');
    }
  });
  // --- أحداث المتجر ---
  socket.on('get shop items', () => {
    socket.emit('shop items data', shopItems);
  });

  // --- أحداث غرفة التحكم (Control Room) ---
  
  // 1. جلب الإحصائيات
  socket.on('get control stats', async (data) => {
    if (data.currentUser.name !== SITE_OWNER.username) return;

    try {
      const totalUsers = await User.count();
      const males = await User.count({ where: { gender: 'male' } });
      const females = await User.count({ where: { gender: 'female' } });
      const onlineCount = Object.keys(onlineUsers).length;

      socket.emit('control stats data', {
        totalUsers,
        males,
        females,
        onlineCount,
        roomsCount: rooms.length
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  });

  // 2. إدارة الغرف (إضافة/حذف)
  socket.on('add room', (data) => {
    if (data.currentUser.name !== SITE_OWNER.username) return;
    
    const newId = rooms.length > 0 ? Math.max(...rooms.map(r => r.id)) + 1 : 1;
    const newRoom = {
      id: newId,
      name: data.name,
      icon: data.icon,
      description: data.description || 'غرفة جديدة',
      users: []
    };
    
    rooms.push(newRoom);
    io.emit('rooms update', rooms);
    socket.emit('control success', 'تم إنشاء الغرفة بنجاح');
  });

  socket.on('delete room', (data) => {
    if (data.currentUser.name !== SITE_OWNER.username) return;
    
    const roomIndex = rooms.findIndex(r => r.id === data.roomId);
    if (roomIndex !== -1) {
      // لا يمكن حذف غرفة الإدارة
      if (rooms[roomIndex].name === 'غرفة الإدارة') {
        socket.emit('control error', 'لا يمكن حذف غرفة الإدارة');
        return;
      }
      rooms.splice(roomIndex, 1);
      io.emit('rooms update', rooms);
      socket.emit('control success', 'تم حذف الغرفة بنجاح');
    }
  });

  // 3. إدارة الرتب (إضافة رتبة خاصة)
  socket.on('add custom rank', (data) => {
    if (data.currentUser.name !== SITE_OWNER.username) return;
    
    const { rankName, rankIcon, rankColor, rankLevel, wingId } = data;
    
    ranks[rankName] = {
      color: rankColor,
      icon: rankIcon,
      level: parseInt(rankLevel) || 1,
      wingId: wingId // لتحديد الجناح في الواجهة
    };
    
    io.emit('ranks update', ranks); // تحديث الرتب للجميع
    socket.emit('control success', `تم إضافة الرتبة "${rankName}" بنجاح`);
  });

  // 4. إدارة الإعلان الهام
  socket.on('set announcement', (data) => {
    const { message, currentUser } = data;
    if (currentUser.name !== SITE_OWNER.username) return;

    globalAnnouncement = message;
    io.emit('announcement update', globalAnnouncement);
    socket.emit('control success', message ? 'تم نشر الإعلان بنجاح' : 'تم إزالة الإعلان');
  });

  // 5. جلب قائمة المستخدمين الشاملة للوحة التحكم
  socket.on('get all users stats', (data) => {
    if (data.currentUser.name !== SITE_OWNER.username) return;

    const usersList = Object.keys(users).map(username => {
      const pointsData = userPoints[username] || { points: 0, level: 1, isInfinite: false };
      return {
        username: username,
        gender: users[username].gender,
        rank: userRanks[username] || 'عضو',
        points: pointsData.points,
        level: pointsData.level,
        isInfinite: pointsData.isInfinite || false,
        showInTop: pointsData.showInTop !== false,
        isOnline: Object.values(onlineUsers).some(u => u.name === username)
      };
    });
    
    // ترتيب القائمة: المتصلين أولاً، ثم حسب النقاط
    usersList.sort((a, b) => {
        if (a.isOnline !== b.isOnline) return b.isOnline - a.isOnline;
        return b.points - a.points;
    });

    socket.emit('all users stats data', usersList);
  });

  // 6. أحداث إدارة المستخدمين المتقدمة (تعديل مباشر)
  socket.on('admin update points', async (data) => {
      const { targetUsername, newPoints, currentUser } = data;
      if (currentUser.name !== SITE_OWNER.username) return;
      
      const pointsVal = parseInt(newPoints);
      if (isNaN(pointsVal)) return;

      if (!userPoints[targetUsername]) {
          userPoints[targetUsername] = { points: 0, level: 1, isInfinite: false, showInTop: true };
      }

      userPoints[targetUsername].points = pointsVal;
      
      // تحديث قاعدة البيانات
      await UserPoints.upsert({
          username: targetUsername,
          points: pointsVal,
          level: userPoints[targetUsername].level,
          isInfinite: userPoints[targetUsername].isInfinite || false,
          showInTop: userPoints[targetUsername].showInTop !== false
      });
      
      socket.emit('control success', `تم تحديث نقاط ${targetUsername} إلى ${pointsVal}`);
  });

  socket.on('admin update level', async (data) => {
      const { targetUsername, newLevel, currentUser } = data;
      if (currentUser.name !== SITE_OWNER.username) return;
      
      const levelVal = parseInt(newLevel);
      if (isNaN(levelVal)) return;

      if (!userPoints[targetUsername]) {
          userPoints[targetUsername] = { points: 0, level: 1, isInfinite: false, showInTop: true };
      }

      userPoints[targetUsername].level = levelVal;
      
      // تحديث قاعدة البيانات
      await UserPoints.upsert({
          username: targetUsername,
          points: userPoints[targetUsername].points,
          level: levelVal,
          isInfinite: userPoints[targetUsername].isInfinite || false,
          showInTop: userPoints[targetUsername].showInTop !== false
      });
      
      socket.emit('control success', `تم تحديث مستوى ${targetUsername} إلى ${levelVal}`);
  });

  socket.on('admin toggle infinite', async (data) => {
      const { targetUsername, isInfinite, currentUser } = data;
      if (currentUser.name !== SITE_OWNER.username) return;

      if (!userPoints[targetUsername]) {
          userPoints[targetUsername] = { points: 0, level: 1, isInfinite: false, showInTop: true };
      }
      
      userPoints[targetUsername].isInfinite = isInfinite;
      
      try {
      await UserPoints.upsert({
          username: targetUsername,
          points: userPoints[targetUsername].points,
          level: userPoints[targetUsername].level,
          isInfinite: isInfinite,
          showInTop: userPoints[targetUsername].showInTop !== false
      });
      
      socket.emit('control success', `تم ${isInfinite ? 'تفعيل' : 'تعطيل'} النقاط اللانهائية لـ ${targetUsername}`);
      } catch (error) {
          console.error('Error toggling infinite:', error);
          socket.emit('control error', 'حدث خطأ في حفظ الإعدادات');
      }
  });

  socket.on('admin toggle show in top', async (data) => {
      const { targetUsername, showInTop, currentUser } = data;
      if (currentUser.name !== SITE_OWNER.username) return;

      if (!userPoints[targetUsername]) {
          userPoints[targetUsername] = { points: 0, level: 1, isInfinite: false, showInTop: true };
      }
      
      userPoints[targetUsername].showInTop = showInTop;
      
      try {
      await UserPoints.upsert({
          username: targetUsername,
          points: userPoints[targetUsername].points,
          level: userPoints[targetUsername].level,
          isInfinite: userPoints[targetUsername].isInfinite || false,
          showInTop: showInTop
      });
      
      socket.emit('control success', `تم ${showInTop ? 'إظهار' : 'إخفاء'} ${targetUsername} في قائمة المتفاعلين`);
      } catch (error) {
          console.error('Error toggling showInTop:', error);
          socket.emit('control error', 'حدث خطأ في حفظ الإعدادات');
      }
  });

  socket.on('admin change username', async (data) => {
      const { oldUsername, newUsername, currentUser } = data;
      if (currentUser.name !== SITE_OWNER.username) return;

      if (!newUsername || newUsername.length < 3 || newUsername.length > 15) {
          socket.emit('control error', 'الاسم الجديد يجب أن يتكون من 3 إلى 15 حرفًا.');
          return;
      }
      if (users[newUsername]) {
          socket.emit('control error', 'هذا الاسم مستخدم بالفعل.');
          return;
      }

      const t = await sequelize.transaction();
      try {
          await sequelize.query('SET CONSTRAINTS ALL DEFERRED;', { transaction: t });

          // تنظيف شامل للسجلات اليتيمة للاسم الجديد قبل التحديث لتجنب تعارض المفاتيح
          await UserPoints.destroy({ where: { username: newUsername }, transaction: t });
          await UserInventory.destroy({ where: { username: newUsername }, transaction: t });
          await UserLastSeen.destroy({ where: { username: newUsername }, transaction: t });
          await UserRank.destroy({ where: { username: newUsername }, transaction: t });
          await UserAvatar.destroy({ where: { username: newUsername }, transaction: t });

          // تحديث جميع الجداول
          const tables = ['User', 'UserRank', 'UserAvatar', 'UserPoints', 'UserLastSeen', 'UserInventory', 'UserFriend', 'FriendRequest', 'PrivateMessage', 'Post', 'PostLike', 'PostComment', 'Notification', 'UserManagement', 'UserSession', 'ChatImage'];
          
          // تنفيذ التحديثات يدوياً كما في دالة تغيير الاسم العادية
          await User.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
          await UserRank.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
          await UserAvatar.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
          await UserPoints.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
          await UserLastSeen.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
          await UserInventory.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
          await UserFriend.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
          await UserFriend.update({ friendUsername: newUsername }, { where: { friendUsername: oldUsername }, transaction: t });
          await FriendRequest.update({ fromUser: newUsername }, { where: { fromUser: oldUsername }, transaction: t });
          await FriendRequest.update({ toUser: newUsername }, { where: { toUser: oldUsername }, transaction: t });
          await PrivateMessage.update({ fromUser: newUsername }, { where: { fromUser: oldUsername }, transaction: t });
          await PrivateMessage.update({ toUser: newUsername }, { where: { toUser: oldUsername }, transaction: t });
          await Post.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
          await PostLike.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
          await PostComment.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
          await Notification.update({ recipientUsername: newUsername }, { where: { recipientUsername: oldUsername }, transaction: t });
          await Notification.update({ senderUsername: newUsername }, { where: { senderUsername: oldUsername }, transaction: t });
          await UserManagement.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
          await UserManagement.update({ mutedBy: newUsername }, { where: { mutedBy: oldUsername }, transaction: t });
          await UserManagement.update({ bannedBy: newUsername }, { where: { bannedBy: oldUsername }, transaction: t });
          await UserSession.update({ username: newUsername }, { where: { username: oldUsername }, transaction: t });
          await ChatImage.update({ fromUser: newUsername }, { where: { fromUser: oldUsername }, transaction: t });
          await ChatImage.update({ toUser: newUsername }, { where: { toUser: oldUsername }, transaction: t });

          await t.commit();

          // --- تحديث الذاكرة (مهم جداً لمنع عودة الاسم القديم) ---
          
          // 1. تحديث الجلسات (Sessions) - هذا هو سبب المشكلة الرئيسية
          Object.keys(userSessions).forEach(sessionId => {
              if (userSessions[sessionId].username === oldUsername) {
                  userSessions[sessionId].username = newUsername;
              }
          });

          // 2. تحديث كائن المستخدمين
          if (users[oldUsername]) {
              users[newUsername] = users[oldUsername];
              delete users[oldUsername];
          }

          // 3. تحديث باقي البيانات في الذاكرة
          const updateMemoryKey = (obj, oldKey, newKey) => {
              if (obj.hasOwnProperty(oldKey)) {
                  obj[newKey] = obj[oldKey];
                  delete obj[oldKey];
              }
          };

          updateMemoryKey(userRanks, oldUsername, newUsername);
          updateMemoryKey(userAvatars, oldUsername, newUsername);
          updateMemoryKey(userRankExpiry, oldUsername, newUsername);
          updateMemoryKey(userPoints, oldUsername, newUsername);
          updateMemoryKey(userLastSeen, oldUsername, newUsername);
          updateMemoryKey(userInventories, oldUsername, newUsername);
          updateMemoryKey(userFriends, oldUsername, newUsername);
          updateMemoryKey(friendRequests, oldUsername, newUsername);

          // تحديث القوائم
          Object.keys(userFriends).forEach(key => {
              userFriends[key] = userFriends[key].map(friend => friend === oldUsername ? newUsername : friend);
          });
          Object.keys(friendRequests).forEach(key => {
              friendRequests[key] = friendRequests[key].map(req => req === oldUsername ? newUsername : req);
          });

          // تحديث المتصلين
          Object.keys(onlineUsers).forEach(socketId => {
              if (onlineUsers[socketId].name === oldUsername) {
                  onlineUsers[socketId].name = newUsername;
              }
          });

          io.emit('user name changed', { oldUsername, newUsername });
          socket.emit('control success', `تم تغيير اسم المستخدم من ${oldUsername} إلى ${newUsername}`);
          
          // إجبار المستخدم المستهدف على إعادة التحميل لتحديث واجهته
          const targetSocketId = Object.keys(onlineUsers).find(id => onlineUsers[id].name === newUsername);
          if (targetSocketId) io.to(targetSocketId).emit('force reload');

      } catch (error) {
          await t.rollback();
          console.error('Admin rename error:', error);
          socket.emit('control error', 'حدث خطأ أثناء تغيير الاسم: ' + error.message);
      }
  });

  // 7. حفظ تعريف الرتبة (إنشاء أو تعديل)
  socket.on('save rank', async (data) => {
    const { originalName, name, icon, level, color, targetUsername, currentUser } = data;
    
    if (!currentUser || currentUser.name !== SITE_OWNER.username) return;

    // منع تعديل اسم رتبة صاحب الموقع أو إنشاء رتبة بهذا الاسم
    if (originalName === 'صاحب الموقع' && name !== 'صاحب الموقع') {
        socket.emit('control error', 'لا يمكن تغيير اسم رتبة صاحب الموقع');
        return;
    }
    if (name === 'صاحب الموقع' && originalName !== 'صاحب الموقع') {
        socket.emit('control error', 'لا يمكن إنشاء رتبة أخرى باسم صاحب الموقع');
        return;
    }

    // منع إنشاء أو تعديل رتبة بمستوى أعلى من 99
    if (parseInt(level) > 99) {
        socket.emit('control error', 'لا يمكن تعيين مستوى قوة أعلى من 99.');
        return;
    }

    // إذا كان تعديل لاسم الرتبة، نحذف القديمة (مع الحفاظ على البيانات إذا أمكن)
    if (originalName && originalName !== name) {
        delete ranks[originalName];
        // ملاحظة: تحديث المستخدمين الذين يملكون الاسم القديم يتطلب منطقاً إضافياً معقداً
        // للتبسيط هنا سنقوم بتحديث الرتبة الجديدة فقط، المستخدمون بالرتبة القديمة قد يحتاجون إعادة تعيين
    }
    const wingId = parseInt(level) >= 100 ? 'owners' : (parseInt(level) >= 5 ? 'owners' : (parseInt(level) >= 3 ? 'kings' : 'distinguished'));

    ranks[name] = {
        color: color,
        icon: icon,
        level: parseInt(level),
        wingId: parseInt(level) >= 5 ? 'owners' : (parseInt(level) >= 3 ? 'kings' : 'distinguished')
    };
    try {
        // إذا كان تعديل لاسم الرتبة، نحذف القديمة من قاعدة البيانات
        if (originalName && originalName !== name) {
            await RankDefinition.destroy({ where: { name: originalName } });
            delete ranks[originalName];
        }

        // حفظ أو تحديث الرتبة في قاعدة البيانات
        await RankDefinition.upsert({
            name,
            color,
            icon,
            level: parseInt(level),
            wingId
        });

        ranks[name] = {
            color: color,
            icon: icon,
            level: parseInt(level),
            wingId: wingId
        };
    } catch (error) {
        console.error('Error saving rank:', error);
        socket.emit('control error', 'حدث خطأ أثناء حفظ الرتبة في قاعدة البيانات');
        return;
    }
    
    io.emit('ranks update', ranks);

    // إذا تم توفير اسم مستخدم، قم بتعيين الرتبة له
    if (targetUsername) {
        if (!users[targetUsername]) {
            socket.emit('control error', 'المستخدم المستهدف غير موجود');
            return;
        }

        userRanks[targetUsername] = name;
        // عند إنشاء رتبة جديدة وتعيينها، نجعلها دائمة افتراضياً أو يمكن تعديل ذلك لاحقاً
        await saveUserRank(targetUsername, name, null);

        // تحديث بيانات المستخدمين المتصلين
        Object.keys(onlineUsers).forEach(socketId => {
            if (onlineUsers[socketId].name === targetUsername) {
                onlineUsers[socketId].rank = name;
            }
        });
        rooms.forEach(r => {
            r.users.forEach(u => {
                if (u.name === targetUsername) u.rank = name;
            });
        });

        io.emit('rooms update', rooms);

        const notificationMessage = {
            type: 'system',
            user: 'رسائل النظام',
            avatar: BOT_AVATAR_URL,
            content: `🌟 تم منح رتبة "${name}" للمستخدم ${targetUsername} بواسطة ${currentUser.name}`,
            time: new Date().toLocaleTimeString('en-GB')
        };
        io.emit('new message', notificationMessage);

        socket.emit('control success', `تم حفظ الرتبة ومنحها لـ ${targetUsername} بنجاح`);
    } else {
        socket.emit('control success', `تم حفظ الرتبة "${name}" بنجاح`);
    }
  });

  // 8. حذف تعريف الرتبة
  socket.on('delete rank definition', async (data) => {
    const { rankName, currentUser } = data;
    
    if (!currentUser || currentUser.name !== SITE_OWNER.username) return;
    
    if (rankName === 'صاحب الموقع') {
        socket.emit('control error', 'لا يمكن حذف رتبة صاحب الموقع');
        return;
    }

    if (ranks[rankName]) {
        delete ranks[rankName];
        // ملاحظة: لا نقوم بحذف userRankExpiry هنا لأننا لا نعرف من يملك الرتبة بسهولة دون البحث
        try {
            await RankDefinition.destroy({ where: { name: rankName } });
            delete ranks[rankName];
        } catch (error) {
            console.error('Error deleting rank:', error);
            socket.emit('control error', 'حدث خطأ أثناء حذف الرتبة من قاعدة البيانات');
            return;
        }
        
        // إزالة الرتبة من المستخدمين المتصلين الذين يحملونها
        Object.values(onlineUsers).forEach(u => {
            if (u.rank === rankName) u.rank = null;
        });

        io.emit('ranks update', ranks);
        io.emit('rooms update', rooms); // لتحديث القوائم
        socket.emit('control success', `تم حذف الرتبة "${rankName}"`);
    }
  });
});

app.get('/api/rooms', (req, res) => {
  res.json(rooms);
});

// نقطة وصول جديدة للتحقق من المصادقة عبر الكوكيز
app.get('/check-auth', async (req, res) => {
    const sessionId = req.cookies.sessionId;

    if (sessionId && userSessions[sessionId]) {
        const sessionData = userSessions[sessionId];
        const user = users[sessionData.username];

        // --- التحقق من الحظر من الموقع عند التحقق من الجلسة ---
        if (userManagement.bannedFromSite[sessionData.username]) {
            res.clearCookie('sessionId');
            await removeUserSession(sessionId);
            return res.json({ authenticated: false, banned: true, reason: userManagement.bannedFromSite[sessionData.username].reason });
        }

        if (user && user.password === sessionData.password) {
            // الجلسة صالحة
            return res.json({
                authenticated: true,
                user: {
                    name: sessionData.username,
                    rank: userRanks[sessionData.username] || null,
                    isSiteOwner: sessionData.username === SITE_OWNER.username,
                    gender: user.gender,
                    sessionId: sessionId,
                    nameColor: user.nameColor,
                    nameBackground: user.nameBackground,
                    avatarFrame: user.avatarFrame,
                    userCardBackground: user.userCardBackground,
                    profileBackground: user.profileBackground,
                    profileCover: user.profileCover
                }
            });
        }
    }

    // الجلسة غير صالحة
    res.clearCookie('sessionId');
    return res.json({ authenticated: false });
});

const PORT = process.env.PORT || 3000;

// يجب أن يكون هذا المسار في النهاية للتعامل مع أي طلبات أخرى غير معرفة
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- تعديل: بدء تشغيل السيرفر بعد تحميل البيانات ---
async function startServer() {
  await loadData(); // انتظر حتى تكتمل عملية تحميل ومزامنة البيانات
  isServerReady = true; // تعيين السيرفر كجاهز
  server.listen(PORT, () => {
    console.log(`السيرفر يعمل على المنفذ ${PORT}`);
  });
}

startServer();