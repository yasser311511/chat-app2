require('dotenv').config();
const bcrypt = require('bcryptjs');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');
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
  gender: { type: DataTypes.STRING, allowNull: false },
  bio: { type: DataTypes.TEXT, allowNull: true }
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
const UserPoints = sequelize.define('UserPoints', {
  username: { type: DataTypes.STRING, primaryKey: true },
  points: { type: DataTypes.INTEGER, defaultValue: 0 },
  level: { type: DataTypes.INTEGER, defaultValue: 1 }
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
});

// تعريف نموذج خلفية الموقع
const SiteBackground = sequelize.define('SiteBackground', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  backgroundType: { type: DataTypes.STRING, allowNull: false },
  backgroundValue: { type: DataTypes.TEXT, allowNull: false },
  setBy: { type: DataTypes.STRING, allowNull: false },
  createdAt: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
  updatedAt: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
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
// مزامنة النماذج مع قاعدة البيانات
async function syncDatabase() {
  try {
    await sequelize.sync({ alter: true });
    console.log('تم مزامنة قاعدة البيانات بنجاح');
  } catch (error) {
    console.error('خطأ في مزامنة قاعدة البيانات:', error);
  }
}

// استدعاء التهيئة بعد الاتصال
syncDatabase();



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
let userLastSeen = {}; // لتخزين آخر ظهور للمستخدم
let posts = {};
let postLikes = {};
let postComments = {};
let globalSiteBackground = {

  type: 'gradient',
  value: 'from-purple-900 via-blue-900 to-indigo-900'
};
let chatImages = {};

// --- إعدادات بوت مكافحة الإزعاج ---
const userMessageHistory = {};
const SPAM_MESSAGE_COUNT = 10;
const SPAM_TIME_WINDOW_MS = 15000; // 15 ثانية
const SPAM_MUTE_DURATION_MIN = 10;
const BOT_AVATAR_URL = 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=system-bot';


// تحميل البيانات من قاعدة البيانات
async function loadData() {
  try {
    await sequelize.authenticate();
    console.log('تم الاتصال بقاعدة البيانات بنجاح!');
    
     // مزامنة آمنة للنماذج
    try {
      // مزامنة جميع النماذد ما عدا ChatImage
      await User.sync({ alter: true });
      await UserRank.sync({ alter: false });
      await UserManagement.sync({ alter: false });
      await UserAvatar.sync({ alter: false });
      await UserSession.sync({ alter: false });
      await PrivateMessage.sync({ alter: false });
      await UserFriend.sync({ alter: false });
      await FriendRequest.sync({ alter: false });
      await UserPoints.sync({ alter: false });
      await UserLastSeen.sync({ alter: true });
      await Post.sync({ alter: false });
      await PostLike.sync({ alter: false });
      await PostComment.sync({ alter: false });
      await Notification.sync({ alter: true }); // Use alter to add the new model
      await SiteBackground.sync({ alter: false });
      
      // مزامنة ChatImage بشكل منفصل مع معالجة الأخطاء
      try {
        await ChatImage.sync({ alter: false });
      } catch (chatImageError) {
        console.log('تحذير في مزامنة ChatImage:', chatImageError.message);
        // حاول إنشاء الجدول إذا لم يكن موجوداً
        try {
          await ChatImage.sync({ force: false });
        } catch (createError) {
          console.log('لا يمكن إنشاء جدول ChatImages:', createError.message);
        }
      }
      
      console.log('تم مزامنة جميع النماذج بنجاح');
    } catch (syncError) {
      console.log('تحذير: هناك أخطاء في المزامنة:', syncError.message);
    }
    
    // تحميل المستخدمين
    const usersData = await User.findAll();
    usersData.forEach(user => {
      users[user.username] = {
        password: user.password,
        gender: user.gender,
        bio: user.bio
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

    const pointsData = await UserPoints.findAll();
    pointsData.forEach(point => {
    userPoints[point.username] = {
    points: point.points,
    level: point.level
    };
    });

    // تحميل آخر ظهور للمستخدمين
    const lastSeenData = await UserLastSeen.findAll();
    lastSeenData.forEach(seen => {
      userLastSeen[seen.username] = parseInt(seen.lastSeen, 10);
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
    // ... الكود الحالي ...

    // تحميل الصور من المحادثات
    const chatImagesData = await ChatImage.findAll({
      order: [['timestamp', 'ASC']]
    });
    
    chatImagesData.forEach(image => {
      if (image.roomId) {
        if (!messages[image.roomId]) messages[image.roomId] = [];
        
        // البحث إذا كانت الرسالة موجودة مسبقاً
        const existingMessageIndex = messages[image.roomId].findIndex(msg => 
          msg.messageId === image.messageId
        );
        
        if (existingMessageIndex === -1) {
          messages[image.roomId].push({
            type: 'image',
            messageId: image.messageId,
            user: image.fromUser,
            imageData: image.imageData,
            time: new Date(image.timestamp).toLocaleTimeString('ar-SA'),
            timestamp: image.timestamp
          });
        }
      }
    });
    // تحميل الصور من المحادثات الخاصة
    const privateImagesData = await ChatImage.findAll({
      where: { conversationId: { [Sequelize.Op.ne]: null } },
      order: [['timestamp', 'ASC']]
    });
    
    privateImagesData.forEach(image => {
      const conversationId = image.conversationId;
      if (!privateMessages[conversationId]) {
        privateMessages[conversationId] = [];
      }
      
      // البحث إذا كانت الرسالة موجودة مسبقاً
      const existingMessageIndex = privateMessages[conversationId].findIndex(msg => 
        msg.messageId === image.messageId
      );
      
      if (existingMessageIndex === -1) {
        privateMessages[conversationId].push({
          type: 'image',
          messageId: image.messageId,
          from: image.fromUser,
          to: image.toUser || conversationId.replace(image.fromUser + '_', '').replace('_' + image.fromUser, ''),
          imageData: image.imageData,
          time: new Date(image.timestamp).toLocaleTimeString('ar-SA'),
          timestamp: image.timestamp
        });
      }
    });

    console.log('تم تحميل صور المحادثات الخاصة بنجاح');

    // تحميل المنشورات
const postsData = await Post.findAll({ order: [['timestamp', 'DESC']] });
postsData.forEach(post => {
    posts[post.id] = {
        username: post.username,
        content: post.content,
        timestamp: parseInt(post.timestamp, 10),
        likes: [],
        comments: []
    };
});

// تحميل الإعجابات
const likesData = await PostLike.findAll();
likesData.forEach(like => {
    if (posts[like.postId]) {
        posts[like.postId].likes.push(like.username);
    }
});

// تحميل التعليقات
const commentsData = await PostComment.findAll({ order: [['timestamp', 'ASC']] });
commentsData.forEach(comment => {
    if (posts[comment.postId]) {
        posts[comment.postId].comments.push({
            username: comment.username,
            content: comment.content,
            timestamp: parseInt(comment.timestamp, 10)
        });
    }
});
 // تحميل خلفية الموقع مع معالجة الأخطاء
    try {
      const backgroundData = await SiteBackground.findOne({
        order: [['createdAt', 'DESC']]
      });

      if (backgroundData) {
        globalSiteBackground = {
          type: backgroundData.backgroundType,
          value: backgroundData.backgroundValue
        };
        console.log('تم تحميل خلفية الموقع من قاعدة البيانات');
      } else {
        // إذا لم توجد خلفية، ننشئ الخلفية الافتراضية
        await SiteBackground.create({
          backgroundType: 'gradient',
          backgroundValue: 'from-purple-900 via-blue-900 to-indigo-900',
          setBy: 'System'
        });
        globalSiteBackground = {
          type: 'gradient',
          value: 'from-purple-900 via-blue-900 to-indigo-900'
        };
        console.log('تم إنشاء الخلفية الافتراضية في قاعدة البيانات');
      }
    } catch (backgroundError) {
      console.log('خطأ في تحميل خلفية الموقع، سيتم استخدام الإعدادات الافتراضية:', backgroundError.message);
      
      // محاولة إنشاء الجدول يدوياً إذا فشل
      try {
        await sequelize.query(`
          CREATE TABLE IF NOT EXISTS "SiteBackgrounds" (
            id SERIAL PRIMARY KEY,
            "backgroundType" VARCHAR(255) NOT NULL,
            "backgroundValue" TEXT NOT NULL,
            "setBy" VARCHAR(255) NOT NULL,
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `);
        
        // إدخال الخلفية الافتراضية
        await sequelize.query(`
          INSERT INTO "SiteBackgrounds" ("backgroundType", "backgroundValue", "setBy") 
          VALUES ('gradient', 'from-purple-900 via-blue-900 to-indigo-900', 'System')
        `);
        
        globalSiteBackground = {
          type: 'gradient',
          value: 'from-purple-900 via-blue-900 to-indigo-900'
        };
        console.log('تم إنشاء جدول خلفية الموقع يدوياً');
      } catch (createError) {
        console.log('فشل في إنشاء جدول الخلفية:', createError.message);
      }
    }

    // تنظيف الصور القديمة من الغرف العامة عند بدء التشغيل
    await ChatImage.destroy({
      where: { roomId: { [Sequelize.Op.ne]: null } }
    });
    console.log('تم تنظيف صور الغرف العامة القديمة من قاعدة البيانات.');
    
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
        gender: userData.gender,
        bio: userData.bio || null
      },
    });
    
    if (!created) {
      await user.update({
        password: userData.password,
        gender: userData.gender,
        bio: userData.bio || null
      },);
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
  // صاحب الموقع يمكنه إدارة المستخدمين من أي غرفة
  if (user && user.name === SITE_OWNER.username) return true;
  if (roomName !== 'غرفة الإدارة') return false;
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
app.use(cookieParser());

// تحميل البيانات عند بدء التشغيل
loadData();

// إعداد Socket.io
io.on('connection', (socket) => {
  console.log('مستخدم جديد متصل:', socket.id);
  
  // إرسال بيانات الصور عند الطلب
socket.on('get user avatars', () => {
    socket.emit('user avatars data', userAvatars);
    // أحداث المنشورات
socket.on('create post', async (data) => {
    const { content, username } = data;
    const timestamp = Date.now();
    
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
        
        io.emit('post liked', { postId, likes: posts[postId].likes });
    }
});

socket.on('add comment', async (data) => {
    const { postId, username, content } = data;
    const timestamp = Date.now();
    
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
        io.emit('comment added', { postId, username, content, timestamp });

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

    if (posts[postId] && posts[postId].username === username) {
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
});
    // حدث الحصول على خلفية الموقع
socket.on('get site background', () => {
  socket.emit('site background data', globalSiteBackground);
});

// حدث تحديث خلفية الموقع (لصاحب الموقع فقط)
socket.on('update site background', async (data) => {
  const { backgroundType, backgroundValue, currentUser } = data;

  // التحقق من أن المستخدم هو صاحب الموقع
  if (currentUser.name !== SITE_OWNER.username) {
    socket.emit('background error', 'ليس لديك صلاحية لتغيير خلفية الموقع');
    return;
  }
  
  try {
    // البحث عن السجل الحالي في قاعدة البيانات
    const existingBackground = await SiteBackground.findOne({
      order: [['createdAt', 'DESC']]
    });
    
    if (existingBackground) {
      // تحديث السجل الحالي
      await existingBackground.update({
        backgroundType: backgroundType,
        backgroundValue: backgroundValue,
        setBy: currentUser.name,
        updatedAt: new Date()
      });
      console.log('تم تحديث خلفية الموقع في قاعدة البيانات');
    } else {
      // إنشاء سجل جديد إذا لم يوجد
      await SiteBackground.create({
        backgroundType: backgroundType,
        backgroundValue: backgroundValue,
        setBy: currentUser.name
      });
      console.log('تم إنشاء خلفية جديدة في قاعدة البيانات');
    }
    
    // تحديث الخلفية في الذاكرة
    globalSiteBackground = {
      type: backgroundType,
      value: backgroundValue
    };
    
    // إرسال الخلفية الجديدة لجميع المستخدمين
    io.emit('site background updated', globalSiteBackground);
    
    socket.emit('background success', 'تم تحديث خلفية الموقع بنجاح');
    console.log(`تم تحديث خلفية الموقع بواسطة ${currentUser.name}: ${backgroundType} - ${backgroundValue}`);
 
  } catch (error) {
    console.error('خطأ في تحديث خلفية الموقع:', error);
    socket.emit('background error', 'حدث خطأ أثناء تحديث الخلفية');
  }
  // إرسال الخلفية الحالية للمستخدم الجديد فور الاتصال
socket.emit('site background data', globalSiteBackground);
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
  if (messages[roomId].length > 150) {
    messages[roomId] = messages[roomId].slice(-150);
  }
  messages[roomId].push(newMessage);
  
  io.to(roomId).emit('new image message', newMessage);
});

// حدث إرسال صورة في المحادثة الخاصة
socket.on('send private image', async (data) => {
    const { toUser, imageData, fromUser } = data;
    
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
        timestamp: timestamp
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

  // في حدث join room - البحث عن هذا الجزء واستبداله
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
    
    // إرسال رسالة ترحيب - الجزء المعدل
    let welcomeContent = `🚪 انضم <strong class="text-white">${user.name}</strong> إلى الغرفة.`;
    if (user.rank) {
        welcomeContent = `🚪 انضم ${ranks[user.rank].icon} <strong class="text-white">${user.rank} ${user.name}</strong> إلى الغرفة.`;
    }
    const welcomeMessage = {
      type: 'system',
      content: welcomeContent,
      time: new Date().toLocaleTimeString('en-GB'),
    };
    
    // إضافة الرسالة للسجل قبل إرسالها
    if (!messages[roomId]) messages[roomId] = [];
    if (messages[roomId].length > 150) {
      messages[roomId] = messages[roomId].slice(-150);
    }
    messages[roomId].push(welcomeMessage);
    
    // إرسال الرسالة للغرفة
    io.to(roomId).emit('new message', welcomeMessage);
    
    // إرسال تاريخ المحادثة للمستخدم الجديد (الرسائل الحديثة فقط)
    // تأكد أن كل رسالة لديها messageId (لنتمكن من التعامل معها في الواجهة)
    const roomMessages = messages[roomId] || [];
    const formattedMessages = roomMessages.map((msg, idx) => {
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
          avatar: userAvatars[msg.user] || null
        };
      } else {
        return msg;
      }
    });

    socket.emit('chat history', formattedMessages);
});
  
  socket.on('send message', async (data) => {
    const { roomId, message, user, replyTo } = data;
    const room = rooms.find(r => r.id === roomId);
    
    if (!room || !canSendMessage(user.name, room.name)) {
      socket.emit('message error', 'لا يمكنك إرسال الرسائل الآن. قد تكون مكتوماً أو محظوراً.');
      return;
    }
    // ... (كود النقاط والمستويات يبقى كما هو)

    // --- Anti-Spam Bot Logic ---
    if (user.name !== SITE_OWNER.username) {
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

    if (!userPoints[user.name]) {
  userPoints[user.name] = { points: 0, level: 1 };
  await saveUserPoints(user.name, 0, 1);
}

// زيادة النقاط فقط إذا كانت الرسالة في غرفة وليست خاصة
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
  io.to(roomId).emit('new message', levelUpMessage);
  
  // إرسال إشعار خاص للمستخدم
  socket.emit('level up', { level: userPoints[user.name].level });
}

// حفظ النقاط والمستوى في قاعدة البيانات
await saveUserPoints(user.name, userPoints[user.name].points, userPoints[user.name].level);
    
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
      avatar: userAvatars[user.name] || null
    };
    
    if (!messages[roomId]) messages[roomId] = [];
    if (messages[roomId].length > 150) {
      messages[roomId] = messages[roomId].slice(-150);
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

    // التحقق من صلاحيات الحذف
    const authorRank = userRanks[authorUsername] || null;
    const deleterRank = currentUser.rank || null;

    const authorLevel = authorRank ? ranks[authorRank]?.level || 0 : 0;
    const deleterLevel = deleterRank ? ranks[deleterRank]?.level || 0 : 0;

    const isMessageOwner = authorUsername === deleterUsername;
    const isSiteOwner = deleterUsername === SITE_OWNER.username;

    // 1. لا يمكن حذف رسائل صاحب الموقع
    if (authorUsername === SITE_OWNER.username && !isSiteOwner) {
        socket.emit('message error', 'لا يمكن حذف رسائل صاحب الموقع.');
        return;
    }

    // 2. التحقق من الصلاحيات
    const canDelete = 
        isSiteOwner || // صاحب الموقع يحذف أي رسالة
        (isMessageOwner && deleterRank) || // المستخدم يحذف رسالته الخاصة (إذا كان لديه رتبة)
        (!isMessageOwner && deleterLevel > authorLevel); // رتبة الحاذف أعلى من رتبة صاحب الرسالة

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
    const room = rooms.find(r => r.id === roomId);
    
    if (room) {
      room.users = room.users.filter(u => u.id !== socket.id);
      io.emit('rooms update', rooms);
      io.to(roomId).emit('users update', room.users);
    }
    
    // رسالة المغادرة - الجزء المعدل
    let leaveContent = `🚪 غادر <strong class="text-white">${user.name}</strong> الغرفة.`;
    if (user.rank) {
        leaveContent = `🚪 غادر ${ranks[user.rank].icon} <strong class="text-white">${user.rank} ${user.name}</strong> الغرفة.`;
    }
    const leaveMessage = {
      type: 'system',
      content: leaveContent,
      time: new Date().toLocaleTimeString('en-GB'),
    };
    
    if (messages[roomId]) {
      messages[roomId].push(leaveMessage);
      io.to(roomId).emit('new message', leaveMessage);
    }
    
    // تحديث آخر ظهور للمستخدم وحفظه
    const lastSeenTime = Date.now();
    userLastSeen[user.name] = lastSeenTime;
    await saveUserLastSeen(user.name, lastSeenTime);

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
      user: 'رسائل النظام',
      avatar: BOT_AVATAR_URL,
      content: `👑 تم منح رتبة ${rankInfo.icon} ${rank} للمستخدم ${username} من قبل ${currentUser.name}`, 
      time: new Date().toLocaleTimeString('en-GB')
    };
    
    // إرسال الإشعار لجميع الغرف
    io.emit('new message', notificationMessage);
    
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
      time: new Date().toLocaleTimeString('en-GB')
    };
    
    socket.emit('show ranks', systemMessage);
  });

  // أحداث إدارة المستخدمين
  socket.on('mute user', async (data) => {
    const { username, duration, currentUser } = data;
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

    if (!canManageUsers(currentUser, room.name)) {
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

    if (!canManageUsers(currentUser, room.name)) {
      socket.emit('management error', 'ليس لديك صلاحية لإدارة المستخدمين');
      return;
    }
    
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
      socket.emit('management error', 'المستخدم غير مكتوم');
    }
  });

  socket.on('ban from room', async (data) => {
    const { username, reason, currentUser } = data;
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

    if (!canManageUsers(currentUser, room.name)) {
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

    if (!canManageUsers(currentUser, room.name)) {
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

    if (!canManageUsers(currentUser, room.name)) {
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

    if (!canManageUsers(currentUser, room.name)) {
      socket.emit('management error', 'ليس لديك صلاحية لإدارة المستخدمين');
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
    const lastSeen = isOnline ? null : userLastSeen[username] || null;
    const userRank = userRanks[username] || null;
    const avatar = userAvatars[username] || null;
    const userData = users[username];
    
    // في حدث get user profile
const pointsData = userPoints[username] || { points: 0, level: 1 };

  socket.emit('user profile data', {
        username,
        isOnline,
        lastSeen,
        rank: userRank,
        avatar,
        gender: userData ? userData.gender : null,
        bio: userData ? userData.bio : null,
        points: pointsData.points,
        level: pointsData.level
    });
    
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
            users[username].bio = bio;
            await User.update({ bio }, { where: { username } });
            socket.emit('bio success', 'تم تحديث معلوماتك بنجاح.');
        } catch (error) {
            console.error('خطأ في تحديث معلومات المستخدم:', error);
            socket.emit('bio error', 'حدث خطأ أثناء تحديث المعلومات.');
        }
    }
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
      time: new Date().toLocaleTimeString('en-GB'),
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

  // في حدث join room، أضف تحميل الصور للمحادثات الخاصة
socket.on('get private messages', async (data) => {
  const { otherUser, currentUser } = data;
  const conversationId = [currentUser, otherUser].sort().join('_');
  
  try {
    // جلب الرسائل النصية من الذاكرة
    const textMessages = privateMessages[conversationId] ? 
      privateMessages[conversationId].filter(msg => msg.type !== 'image') : [];
    
    // جلب الصور من قاعدة البيانات للمحادثة الخاصة
    const imagesData = await ChatImage.findAll({
      where: { conversationId },
      order: [['timestamp', 'ASC']]
    });
    
    // تحويل الصور إلى شكل مشابه للرسائل النصية
    const imageMessages = imagesData.map(image => ({
      type: 'image',
      messageId: image.messageId,
      from: image.fromUser,
      to: image.toUser || (image.fromUser === currentUser ? otherUser : currentUser),
      imageData: image.imageData,
      time: new Date(image.timestamp).toLocaleTimeString('ar-SA'),
      timestamp: image.timestamp
    }));
    
    // دمج الرسائل النصية والصورية وترتيبها حسب الوقت
    const allMessages = [...textMessages, ...imageMessages].sort((a, b) => a.timestamp - b.timestamp);
    
    socket.emit('private messages history', allMessages);
  } catch (error) {
    console.error('خطأ في تحميل صور المحادثة الخاصة:', error);
    // إرسال الرسائل النصية فقط في حالة الخطأ
    socket.emit('private messages history', privateMessages[conversationId] || []);
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
  
  // في حدث disconnect - البحث عن هذا الجزء واستبداله
socket.on('disconnect', async (reason) => {
    const user = onlineUsers[socket.id];
    if (user) {
      const roomId = user.roomId;
      const room = rooms.find(r => r.id === roomId);
      
      if (room) {
        const userIndex = room.users.findIndex(u => u.id === socket.id);
        if (userIndex !== -1) {
            room.users.splice(userIndex, 1);
        }
        io.emit('rooms update', rooms);
        io.to(roomId).emit('users update', room.users);
      }
      
      // رسالة المغادرة - تم تعديلها لتوضيح سبب الخروج
      let leaveContent = `🔌 فقد <strong class="text-white">${user.name}</strong> الاتصال بالغرفة.`;
      if (reason === 'ping timeout') {
          leaveContent = `🔌 فقد <strong class="text-white">${user.name}</strong> الاتصال بسبب الخمول.`;
      }
      if (user.rank) {
          leaveContent = `🚪 غادر ${ranks[user.rank].icon} <strong class="text-white">${user.rank} ${user.name}</strong> الغرفة.`;
      }
      const leaveMessage = {
        type: 'system',
        content: leaveContent, 
        time: new Date().toLocaleTimeString('en-GB'),
      };
      
      if (messages[roomId]) {
        messages[roomId].push(leaveMessage);
        io.to(roomId).emit('new message', leaveMessage);
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
      const topUsersData = await UserPoints.findAll({
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
});


// API للحصول على الغرف
app.get('/api/rooms', (req, res) => {
  res.json(rooms);
});

// نقطة وصول جديدة للتحقق من المصادقة عبر الكوكيز
app.get('/check-auth', async (req, res) => {
    const sessionId = req.cookies.sessionId;

    if (sessionId && userSessions[sessionId]) {
        const sessionData = userSessions[sessionId];
        const user = users[sessionData.username];

        if (user && user.password === sessionData.password) {
            // الجلسة صالحة
            return res.json({
                authenticated: true,
                user: {
                    name: sessionData.username,
                    rank: userRanks[sessionData.username] || null,
                    isSiteOwner: sessionData.username === SITE_OWNER.username,
                    gender: user.gender,
                    sessionId: sessionId
                }
            });
        }
    }

    // الجلسة غير صالحة
    res.clearCookie('sessionId');
    return res.json({ authenticated: false });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`السيرفر يعمل على المنفذ ${PORT}`);
});