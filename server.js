require('dotenv').config({ override: true });
const bcrypt = require('bcryptjs');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');
const { Sequelize, DataTypes } = require('sequelize');
const multer = require('multer');
const fs = require('fs');
const https = require('https');

// متغيرات عامة
let BOT_AVATAR_URL = '/icon.png';

// إنشاء اتصال بقاعدة البيانات
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  protocol: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    },
    keepAlive: true
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
  profileCover: { type: DataTypes.TEXT, allowNull: true },
  nameCardBorder: { type: DataTypes.STRING, allowNull: true },
  joinMessageBackground: { type: DataTypes.STRING, allowNull: true },
  referredBy: { type: DataTypes.STRING, allowNull: true }, // المستخدم الذي قام بدعوته
  nameFont: { type: DataTypes.STRING, allowNull: true }, // نوع الخط
  status: { type: DataTypes.STRING(200), allowNull: true }, // الحالة
  country: { type: DataTypes.STRING, allowNull: true }, // الدولة
  age: { type: DataTypes.INTEGER, allowNull: true } // العمر
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
  showInTop: { type: DataTypes.BOOLEAN, defaultValue: true },
  interactionScore: { type: DataTypes.INTEGER, defaultValue: 0 }, // درجة التفاعل (عدد الدعوات)
  lastDailyClaim: { type: DataTypes.STRING, allowNull: true }, // تاريخ آخر مكافأة يومية
  dailyStreak: { type: DataTypes.INTEGER, defaultValue: 0 }, // سلسلة الأيام المتتالية
  xp: { type: DataTypes.INTEGER, defaultValue: 0 }, // نقاط الخبرة
});
const UserLastSeen = sequelize.define('UserLastSeen', {
  username: { type: DataTypes.STRING, primaryKey: true },
  lastSeen: { type: DataTypes.BIGINT, allowNull: false }
});

const SystemSettings = sequelize.define('SystemSettings', {
  key: { type: DataTypes.STRING, primaryKey: true },
  value: { type: DataTypes.TEXT, allowNull: false }
});

const QuizQuestion = sequelize.define('QuizQuestion', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    category: { type: DataTypes.STRING, allowNull: false, defaultValue: 'عام' },
    question: { type: DataTypes.TEXT, allowNull: false },
    answer: { type: DataTypes.STRING, allowNull: false }
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

const Achievement = sequelize.define('Achievement', {
  id: { type: DataTypes.STRING, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  icon: { type: DataTypes.STRING, allowNull: false },
  targetValue: { type: DataTypes.INTEGER, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false }, // 'messages', 'days', 'interactions', 'gifts'
  cardColor: { type: DataTypes.STRING, allowNull: true }
});

const UserAchievement = sequelize.define('UserAchievement', {
  username: { type: DataTypes.STRING, allowNull: false },
  achievementId: { type: DataTypes.STRING, allowNull: false },
  currentValue: { type: DataTypes.INTEGER, defaultValue: 0 },
  completed: { type: DataTypes.BOOLEAN, defaultValue: false },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  lastUpdateDate: { type: DataTypes.STRING, allowNull: true } // YYYY-MM-DD
}, {
  indexes: [{ fields: ['username'] }, { fields: ['achievementId'] }]
});

// استدعاء التهيئة بعد الاتصال
// loadData(); // تم نقله إلى startServer() لمنع التكرار



const compression = require('compression');
const app = express();
app.use(compression());

// إعداد التخزين المؤقت للملفات الثابتة لتحسين السرعة
const cacheTime = 86400000 * 30; // 30 يوم
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: cacheTime,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.match(/[/\\]f[/\\]/)) {
            res.setHeader('Cache-Control', 'public, max-age=0'); // لا تخزن HTML لضمان التحديثات
        } else {
            res.setHeader('Cache-Control', `public, max-age=${cacheTime}`);
        }
    }
}));

const server = http.createServer(app);
const io = socketIo(server, {
  pingTimeout: 30000,
  pingInterval: 10000,
  connectTimeout: 45000,
  maxHttpBufferSize: 1e7,
  perMessageDeflate: {
    threshold: 1024, // ضغط الرسائل التي تزيد عن 1 كيلوبايت
    zlibDeflateOptions: { level: 6 } // مستوى ضغط متوسط للتوازن بين السرعة والحجم
  }
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
  'جيد': { color: 'from-blue-500 to-cyan-600', icon: '❇️', level: 1 },
  'زائر': { color: 'from-gray-500 to-gray-600', icon: '👤', level: 0 }
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
    image: { type: DataTypes.TEXT, allowNull: true }, // إضافة حقل الصورة
    timestamp: { type: DataTypes.BIGINT, allowNull: false }
});

const PostLike = sequelize.define('PostLike', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    postId: { type: DataTypes.INTEGER, allowNull: false },
    username: { type: DataTypes.STRING, allowNull: false },
    timestamp: { type: DataTypes.BIGINT, allowNull: false }
});

const PostLaugh = sequelize.define('PostLaugh', {
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
let achievements = {}; // لتخزين تعريفات الإنجازات
let userAchievements = {}; // لتخزين إنجازات المستخدمين في الذاكرة
let userInteractions = {}; // لتخزين المستخدمين الذين تفاعل معهم كل مستخدم { username: Set([other_users]) }
let roomManagers = {}; // لتخزين مديري الغرف { roomId: [usernames] }
let roomBackgrounds = {}; // لتخزين خلفيات الغرف { roomId: { type, value } }
let roomSettings = {}; // لتخزين إعدادات الغرف { roomId: { description, textColor, messageBackground } }
let posts = {};
let postLikes = {};
let postLaughs = {};
let postComments = {};
let chatImages = {};
let pendingGiftOffers = {}; // تخزين عروض الهدايا المعلقة { recipient: { sender, itemId, rank, price } }
let drawingHistory = []; // تخزين تاريخ الرسم
let dotsAndBoxesGames = {}; // تخزين ألعاب توصيل المربعات النشطة

// --- إعدادات لعبة الاختباء ---

// --- رسائل النظام التلقائية ---
const automatedMessages = [
    "اللهم صّلِ وسَلّمْ عَلۓِ نَبِيْنَامُحَمد ﷺ",
    "اهـلا وسهــلا بكم في موقع وال✨شـــــــات",
    "كن إيجابيًا للحفاظ علي جهودك انت والجميع وبلغ الإدارة عن الأعضاء المخالفة التي تقوم بعمل فلود وتكرار لكسب نقاط بطرق غير شرعية",
    "للعب لعبة الاختباء اكتب @رسائل النظام لعبة الاختباء",
    "للعب لعبة تخمين الرقم اكتب @رسائل النظام لعبة تخمين الرقم",
    "لاستدعاء الذكاء الاصطناعي اكتب @الذكاء الاصطناعي"
];
let automatedMessageIndex = 0;

let hideAndSeekState = {
    active: false,
    phase: 'idle', // 'idle', 'registration', 'hiding'
    roomId: null,
    participants: [], // { username, chosenSpot, alive }
    round: 0,
    maxRounds: 5,
    initialCount: 0
};

// --- دوال لعبة الاختباء ---
function sendSystemGameMessage(roomId, content) {
    const msg = {
        type: 'system',
        user: 'رسائل النظام',
        avatar: BOT_AVATAR_URL,
        content: content,
        time: new Date().toLocaleTimeString('ar-SA')
    };
    io.to(roomId).emit('new message', msg);
    if (messages[roomId]) messages[roomId].push(msg);
}

function startHideAndSeek(roomId) {
    hideAndSeekState = {
        active: true,
        phase: 'registration',
        roomId: roomId,
        participants: [],
        round: 0,
        maxRounds: 5,
        initialCount: 0,
        criticalRound: Math.floor(Math.random() * 5) + 1, // تحديد جولة حاسمة عشوائية من 1 إلى 5
        pendingRPS: [] // قائمة اللاعبين الذين يجب عليهم لعب المقص
    };

    // تم تغيير الرسالة وإزالة المؤقت بناءً على طلب المستخدم
    // ستبدأ اللعبة الآن عندما يكتب أحد "تم"
    sendSystemGameMessage(roomId, '🕵️‍♂️ <strong>لقد بدأت لعبة الاختباء!</strong><br>من يريد المشاركة يمنشنني ويقول "<strong>انا</strong>" ولما تنتهو منشنوني وقولو تم');
}

function nextHideAndSeekRound() {
    if (!hideAndSeekState.active) return;
    
    hideAndSeekState.round++;
    hideAndSeekState.phase = 'hiding';
    
    // تصفير اختيارات اللاعبين الأحياء
    hideAndSeekState.participants.forEach(p => p.chosenSpot = null);

    const isCritical = hideAndSeekState.round === hideAndSeekState.criticalRound;
    const roundTitle = isCritical 
        ? `🔥 <strong>الجولة الحاسمة (${hideAndSeekState.round} من ${hideAndSeekState.maxRounds})</strong> 🔥` 
        : `🔔 <strong>الجولة ${hideAndSeekState.round} من ${hideAndSeekState.maxRounds}</strong>`;

    const killerDesc = isCritical
        ? `🔪 <strong>القاتل غاضب جداً!</strong> سيبحث في <strong class="text-red-500 text-xl">5</strong> أماكن عشوائية!`
        : `🔪 سيدخل القاتل ليفتش عن مكانين ويقتل من كان فيهما!`;

    sendSystemGameMessage(hideAndSeekState.roomId, `
        ${roundTitle}
        <br>🏠 لديكم 10 أماكن في المنزل مرقمة من <strong>1</strong> إلى <strong>10</strong>.
        <br>${killerDesc}
        <br>🏃‍♂️ <strong>هيا اختاروا مكاناً (رقماً) بسرعة!</strong>
    `);
}

function resolveHideAndSeekRound() {
    const isCritical = hideAndSeekState.round === hideAndSeekState.criticalRound;
    const spotsToCheck = isCritical ? 5 : 2; // 5 أماكن في الجولة الحاسمة، 2 في العادية

    const killerSpots = [];
    while(killerSpots.length < spotsToCheck) {
        const r = Math.floor(Math.random() * 10) + 1;
        if(killerSpots.indexOf(r) === -1) killerSpots.push(r);
    }

    const victims = [];
    hideAndSeekState.participants.forEach(p => {
        if (p.alive && killerSpots.includes(p.chosenSpot)) {
            // في الجولة الحاسمة لا يموتون فوراً، بل ينتقلون للمقص
            if (!isCritical) {
                p.alive = false;
            }
            victims.push(p.username);
        }
    });

    let msg = `👀 لقد زار القاتل المكانين: <strong class="text-red-500 text-xl">[ ${killerSpots.join(' و ')} ]</strong>`;
    if (isCritical) {
        msg = `🔥 <strong>الجولة الحاسمة!</strong> زار القاتل الأماكن: <strong class="text-red-500 text-xl">[ ${killerSpots.join(' و ')} ]</strong>`;
    }
    
    if (victims.length > 0) {
        if (isCritical) {
            // منطق الجولة الحاسمة (لعبة المقص)
            hideAndSeekState.phase = 'rps'; // تغيير المرحلة إلى Rock-Paper-Scissors
            hideAndSeekState.pendingRPS = [...victims]; // نسخ قائمة الضحايا
            
            msg += `<br>😱 <strong>لقد وجد القاتل:</strong> ${victims.map(v => `<strong class="text-yellow-400">${v}</strong>`).join(' و ')}`;
            msg += `<br>😈 <strong>لكن لحسن حظكم!</strong> أشفق القاتل عليكم وقرر اللعب معكم لعبة <strong>المقص</strong>.`;
            msg += `<br>✊✋✌️ <strong>يا ${victims.join(' و ')}، اختاروا بسرعة: (حجرة) أو (ورقة) أو (مقص) للنجاة!</strong>`;
            
            sendSystemGameMessage(hideAndSeekState.roomId, msg);
            
            // مؤقت لإنهاء الجولة في حال عدم الرد
            setTimeout(() => {
                if (hideAndSeekState.phase === 'rps') {
                    // إقصاء من لم يختر
                    hideAndSeekState.pendingRPS.forEach(username => {
                        const p = hideAndSeekState.participants.find(u => u.username === username);
                        if (p && p.alive) p.alive = false;
                    });
                    if (hideAndSeekState.pendingRPS.length > 0) {
                        sendSystemGameMessage(hideAndSeekState.roomId, `💀 <strong>انتهى الوقت!</strong> تم القضاء على من لم يختر: ${hideAndSeekState.pendingRPS.join('، ')}`);
                    }
                    finalizeHideAndSeekRound();
                }
            }, 40000); // 40 ثانية للاختيار
            return; // توقف هنا وانتظر ردود اللاعبين
        } else {
            // الإقصاء العادي
            msg += `<br>💀 <strong>تم إقصاء:</strong> ${victims.map(v => `<span class="text-red-400 line-through">${v}</span>`).join(' و ')}`;
        }
    } else {
        msg += `<br>✨ لم يعثر القاتل على أحد في هذه الأماكن!`;
    }

    sendSystemGameMessage(hideAndSeekState.roomId, msg);
    finalizeHideAndSeekRound();
}

// دالة جديدة لإنهاء الجولة والانتقال للتالية (تستخدم في الوضع العادي وبعد لعبة المقص)
function finalizeHideAndSeekRound() {
    const survivors = hideAndSeekState.participants.filter(p => p.alive);

    // شروط الفوز والخسارة
    if (survivors.length === 0) {
        setTimeout(() => {
            sendSystemGameMessage(hideAndSeekState.roomId, '💀 <strong>انتهت اللعبة!</strong> لقد قضى القاتل على الجميع.');
            hideAndSeekState.active = false;
        }, 3000);
        return;
    }

    // حالة لاعب واحد متبقي (إذا كانت اللعبة بدأت بأكثر من لاعب)
    if (hideAndSeekState.initialCount > 1 && survivors.length === 1) {
        const winnerName = survivors[0].username;
        setTimeout(async () => {
            if (!userPoints[winnerName]) userPoints[winnerName] = { points: 0, level: 1 };
            userPoints[winnerName].points += 1000;
            await saveUserPoints(winnerName, userPoints[winnerName].points, userPoints[winnerName].level);

            sendSystemGameMessage(hideAndSeekState.roomId, `🏆 <strong>مبروك!</strong> الفائز هو <strong class="text-yellow-400">${winnerName}</strong> لأنه الناجي الوحيد! (حصل على 1000 نقطة)`);
            hideAndSeekState.active = false;
        }, 3000);
        return;
    }

    // انتهاء الجولات
    if (hideAndSeekState.round >= hideAndSeekState.maxRounds) {
        setTimeout(async () => {
            for (const survivor of survivors) {
                const winnerName = survivor.username;
                if (!userPoints[winnerName]) userPoints[winnerName] = { points: 0, level: 1 };
                userPoints[winnerName].points += 1000;
                await saveUserPoints(winnerName, userPoints[winnerName].points, userPoints[winnerName].level);
            }
            const winners = survivors.map(p => p.username).join('، ');
            sendSystemGameMessage(hideAndSeekState.roomId, `🎉 <strong>انتهت الجولات الـ 5!</strong><br>الناجون الفائزون هم: <strong class="text-green-400">${winners}</strong> (حصل كل منهم على 1000 نقطة)`);
            hideAndSeekState.active = false;
        }, 3000);
        return;
    }

    // الانتقال للجولة التالية
    setTimeout(() => {
        const qualified = survivors.map(p => p.username).join('، ');
        sendSystemGameMessage(hideAndSeekState.roomId, `✅ <strong>المتأهلون للجولة القادمة:</strong> ${qualified}`);
        setTimeout(() => {
            nextHideAndSeekRound();
        }, 2000);
    }, 5000);
}

function startAutomatedMessages() {
    setInterval(() => {
        // لا ترسل رسائل إذا لم يكن هناك أي مستخدمين على الإطلاق
        const totalOnlineUsers = Object.keys(onlineUsers).length;
        if (totalOnlineUsers === 0) {
            return;
        }

        const messageContent = automatedMessages[automatedMessageIndex];

        rooms.forEach(room => {
            if (room.users && room.users.length > 0) {
                sendSystemGameMessage(room.id, messageContent);
            }
        });

        automatedMessageIndex = (automatedMessageIndex + 1) % automatedMessages.length;
    }, 15 * 60 * 1000); // 15 minutes
}

// --- إعدادات QuizBot ---
let quizState = {
    active: false,
    currentQuestion: null,
    currentAnswer: null,
    roomId: null,
    timer: null,
    answerTimer: null,
    lastQuestionTime: 0,
    lastQuestionId: null,
    isWaitingForAnswer: false,
    questionsQueue: [],
    currentQuestionIndex: 0
};

// --- إعدادات لعبة تخمين الرقم ---
let guessGameState = {
    active: false,
    phase: 'idle', // 'idle', 'registration', 'playing'
    target: 0,
    roomId: null,
    participants: {}, // { username: { attempts: 0, eliminated: false } }
    maxAttempts: 20,
    totalAttempts: 0
};

// --- ذاكرة الذكاء الاصطناعي ---
const aiConversationHistory = {}; // { username: [ { role, content } ] }

// --- إعدادات بوت الذكاء الاصطناعي ---
const AI_BOT_CONFIG = {
    name: "الذكاء الاصطناعي",
    avatar: "/images.png", // يمكنك تغيير هذا
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
    model: "qwen/qwen3-4b:free", // نموذج Qwen المجاني
    apiKey: process.env.OPENROUTER_API_KEY || "" 
};

async function askAIBot(username, question) {
    if (!AI_BOT_CONFIG.apiKey || AI_BOT_CONFIG.apiKey.startsWith("sk-or-v1-abc")) {
        return "⚠️ عذراً، لم يتم إعداد مفتاح API للذكاء الاصطناعي. يرجى الحصول على مفتاح من OpenRouter.ai ووضعه في ملف .env.";
    }

    // إدارة الذاكرة للمستخدم
    if (!aiConversationHistory[username]) {
        aiConversationHistory[username] = [];
    }

    // إضافة رسالة المستخدم الجديدة
    aiConversationHistory[username].push({ role: "user", content: question });

    // الاحتفاظ بآخر 20 رسالة فقط (10 محادثات) لضمان ذاكرة قصيرة المدى فعالة
    if (aiConversationHistory[username].length > 20) {
        aiConversationHistory[username] = aiConversationHistory[username].slice(-20);
    }

    const payload = JSON.stringify({
        model: AI_BOT_CONFIG.model,
        messages: [
            { role: "system", content: "أنت مساعد ذكي في تطبيق دردشة عربي. تحدث باللغة العربية الفصحى بأسلوب واضح ومختصر. تجنب الرموز التعبيرية والتنسيقات غير الضرورية." },
            ...aiConversationHistory[username]
        ],
        max_tokens: 400,
        temperature: 0.6 // زيادة طفيفة في الإبداع
    });

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_BOT_CONFIG.apiKey.trim()}`,
            // OpenRouter يتطلب هذه الترويسات
            'HTTP-Referer': 'https://walidchating.onrender.com', 
            'X-Title': 'WalChat'
        }
    };

    return new Promise((resolve) => {
        const req = https.request(AI_BOT_CONFIG.apiUrl, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        console.error(`AI Bot Error: Status ${res.statusCode}`, data);
                        let errorDetail = "";
                        try {
                            const errorJson = JSON.parse(data);
                            errorDetail = errorJson.error?.message || errorJson.error || "";
                        } catch (e) {}

                        if (res.statusCode === 404) {
                            resolve("عذراً، الرابط المستخدم غير صحيح أو النموذج غير متوفر حالياً. يرجى المحاولة لاحقاً.");
                        } else if (res.statusCode === 401) {
                            resolve("⚠️ خطأ في المصادقة: مفتاح API غير صحيح. تأكد من نسخه بشكل صحيح من إعدادات Hugging Face.");
                        } else if (errorDetail) {
                            resolve(`عذراً، حدث خطأ: ${errorDetail}`);
                        } else {
                            resolve(`عذراً، حدث خطأ في الخادم (Status ${res.statusCode}).`);
                        }
                        return;
                    }

                    const response = JSON.parse(data);
                    if (response.choices && response.choices[0] && response.choices[0].message) {
                        let aiReply = response.choices[0].message.content.trim();
                        
                        // تنظيف الرد من أي حروف صينية قد تتسرب (احتياط أمني)
                        aiReply = aiReply.replace(/[\u4e00-\u9fa5]/g, '');
                        
                        // تنظيف الرموز الغريبة وتنسيقات الماركداون التي قد تظهر كنص مشوه
                        aiReply = aiReply.replace(/[*_#`~]/g, '');
                        
                        // حفظ رد البوت في الذاكرة
                        aiConversationHistory[username].push({ role: "assistant", content: aiReply });
                        resolve(aiReply);
                    } else if (response.error) {
                        const errorMsg = response.error.message || response.error;
                        if (errorMsg.includes("currently loading")) {
                            resolve("جاري تشغيل محرك الذكاء الاصطناعي، يرجى المحاولة بعد لحظات...");
                        } else {
                            resolve(`عذراً، حدث خطأ: ${errorMsg}`);
                        }
                    } else {
                        resolve("عذراً، حدث خطأ في معالجة الرد.");
                    }
                } catch (e) {
                    console.error('AI Bot Parse Error:', e, 'Raw Data:', data);
                    resolve("عذراً، حدث خطأ في التواصل مع الذكاء الاصطناعي.");
                }
            });
        });

        req.on('error', (e) => {
            console.error('AI Bot Request Error:', e);
            resolve("عذراً، حدث خطأ في الاتصال.");
        });

        req.write(payload);
        req.end();
    });
}

// --- متغير للتحقق من جاهزية السيرفر ---
let isServerReady = false;

// دالة مساعدة لجلب البيانات من API خارجي بدون مكتبات إضافية
function getJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// دالة لخلط المصفوفة
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- وظائف QuizBot ---
async function askQuizQuestion() {
    const entertainmentRoom = rooms.find(r => r.name === 'غرفة التسلية');
    if (!entertainmentRoom || entertainmentRoom.users.length === 0) {
        quizState.active = false;
        if (quizState.timer) clearTimeout(quizState.timer);
        quizState.timer = null;
        return;
    }

    quizState.active = true;
    quizState.roomId = entertainmentRoom.id;

    // إذا كانت القائمة فارغة أو انتهينا من جميع الأسئلة، نقوم بتحميلها وخلطها
    if (quizState.questionsQueue.length === 0 || quizState.currentQuestionIndex >= quizState.questionsQueue.length) {
        try {
            const manualQuestions = await QuizQuestion.findAll();
            const defaultQuestions = [
                { category: "إسلاميات", question: "ما هو أطول سورة في القرآن الكريم؟", answer: "البقرة" },
                { category: "تاريخ", question: "من هو القائد العربي الذي فتح الأندلس؟", answer: "طارق بن زياد" },
                { category: "جغرافيا", question: "ما هو أطول نهر في العالم؟", answer: "النيل" },
                { category: "علوم", question: "ما هو العضو المسؤول عن ضخ الدم في جسم الإنسان؟", answer: "القلب" },
                { category: "ثقافة", question: "ما هي عاصمة اليابان؟", answer: "طوكيو" },
                { category: "رياضة", question: "كم عدد لاعبين فريق كرة القدم في الملعب؟", answer: "11" },
                { category: "أدب", question: "من هو الشاعر الملقب بأمير الشعراء؟", answer: "أحمد شوقي" },
                { category: "جغرافيا", question: "ما هي أكبر دولة في العالم من حيث المساحة؟", answer: "روسيا" },
                { category: "إسلاميات", question: "كم عدد الخلفاء الراشدين؟", answer: "4" },
                { category: "علوم", question: "ما هو الكوكب الملقب بالكوكب الأحمر؟", answer: "المريخ" }
            ];
            
            // دمج الأسئلة اليدوية مع الافتراضية
            const allQuestions = [...manualQuestions.map(q => q.get ? q.get({ plain: true }) : q), ...defaultQuestions];
            
            // خلط جميع الأسئلة
            quizState.questionsQueue = shuffleArray(allQuestions);
            quizState.currentQuestionIndex = 0;
        } catch (err) {
            console.error('Error loading quiz questions:', err);
            // في حالة الخطأ، نستخدم الأسئلة الافتراضية
            const defaultQuestions = [
                { category: "إسلاميات", question: "ما هو أطول سورة في القرآن الكريم؟", answer: "البقرة" },
                { category: "تاريخ", question: "من هو القائد العربي الذي فتح الأندلس؟", answer: "طارق بن زياد" }
            ];
            quizState.questionsQueue = shuffleArray(defaultQuestions);
            quizState.currentQuestionIndex = 0;
        }
    }

    const questionData = quizState.questionsQueue[quizState.currentQuestionIndex];
    quizState.currentQuestionIndex++;
    
    quizState.currentQuestion = questionData.question;
    quizState.currentAnswer = questionData.answer.trim().toLowerCase();
    quizState.lastQuestionTime = Date.now();
    quizState.isWaitingForAnswer = true;

    const categoryPrefix = questionData.category ? `${questionData.category}: ` : '';
    const quizMessage = {
        type: 'system',
        systemStatus: 'neutral', // سؤال المسابقة باللون الأبيض
        user: 'بوت المسابقات',
        avatar: BOT_AVATAR_URL,
        content: `❓ **سؤال جديد:** ${categoryPrefix}${quizState.currentQuestion}\n\n⏱️ لديك 30 ثانية للإجابة!`,
        time: new Date().toLocaleTimeString('ar-SA'),
        isQuiz: true
    };

    io.to(quizState.roomId).emit('new message', quizMessage);
    if (messages[quizState.roomId]) messages[quizState.roomId].push(quizMessage);

    // مؤقت 30 ثانية للإجابة
    if (quizState.answerTimer) clearTimeout(quizState.answerTimer);
    quizState.answerTimer = setTimeout(() => {
        if (quizState.isWaitingForAnswer) {
            quizState.isWaitingForAnswer = false;
            const noAnswerMessage = {
                type: 'system',
                systemStatus: 'negative', // انتهى الوقت باللون الأحمر
                user: 'بوت المسابقات',
                avatar: BOT_AVATAR_URL,
                content: `⌛ انتهى الوقت! لم يجب أحد على السؤال الإجابة كانت: **${quizState.currentAnswer}**\n\n🔄 السؤال القادم بعد 30 ثانية...`,
                time: new Date().toLocaleTimeString('ar-SA')
            };
            io.to(quizState.roomId).emit('new message', noAnswerMessage);
            if (messages[quizState.roomId]) messages[quizState.roomId].push(noAnswerMessage);
            
            // مهلة 30 ثانية قبل السؤال التالي
            quizState.timer = setTimeout(askQuizQuestion, 30000);
        }
    }, 30000);
}

function startQuizMonitor() {
    setInterval(async () => {
        const entertainmentRoom = rooms.find(r => r.name === 'غرفة التسلية');
        if (entertainmentRoom && entertainmentRoom.users.length > 0 && !quizState.active) {
            // إذا كان هناك مستخدمون والمسابقة متوقفة، ابدأ بعد 5 ثواني
            if (!quizState.timer) {
                quizState.timer = setTimeout(askQuizQuestion, 5000);
            }
        }
    }, 10000);
}

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
const DEFAULT_AVATAR_URL = '/my-avatar.png';

// --- متغير لتتبع آخر نشاط للمستخدم لمنع التكرار (Debounce) ---
const userLastAction = {};


// دالة مساعدة لجلب العناصر المملوكة للمستخدم (قيم العناصر)
function getOwnedItems(username) {
    const userInv = userInventories[username] || [];
    return userInv.map(inv => {
        const item = shopItems.find(i => i.id === inv.itemId);
        return item ? item.itemValue : null;
    }).filter(v => v);
}

function getUserBadges(username) {
  const userAchs = userAchievements[username] || {};
  return Object.values(achievements)
    .filter(ach => userAchs[ach.id] && userAchs[ach.id].completed)
    .map(ach => ({
      id: ach.id,
      name: ach.name,
      icon: ach.icon,
      cardColor: ach.cardColor
    }));
}

// تحميل البيانات من قاعدة البيانات
async function updateAchievementProgress(username, type, value = 1, targetUsername = null) {
  try {
    const typeAchievements = Object.values(achievements).filter(a => a.type === type);
    if (typeAchievements.length === 0) return;

    if (!userAchievements[username]) userAchievements[username] = {};

    // معالجة التفاعلات الاجتماعية بشكل خاص
    if (type === 'interactions' && targetUsername && targetUsername !== username) {
      if (!userInteractions[username]) userInteractions[username] = new Set();
      if (!userInteractions[username].has(targetUsername)) {
        userInteractions[username].add(targetUsername);
        value = userInteractions[username].size;
      } else {
        return; // تفاعل مكرر مع نفس الشخص
      }
    }

    for (const ach of typeAchievements) {
      let ua = userAchievements[username][ach.id];
      if (ua && ua.completed && type !== 'days' && type !== 'hours') continue; // للسماح بتحديث تاريخ الأيام والساعات حتى لو اكتمل

      let newValue = value;
      if (type !== 'interactions' && type !== 'days') {
        newValue = (ua ? ua.currentValue : 0) + value;
      }

      const today = new Date().toISOString().split('T')[0];

      if (!ua) {
        ua = {
          username,
          achievementId: ach.id,
          currentValue: newValue,
          completed: newValue >= ach.targetValue,
          completedAt: newValue >= ach.targetValue ? new Date() : null,
          lastUpdateDate: today
        };
        const createdUa = await UserAchievement.create(ua);
        userAchievements[username][ach.id] = createdUa.get({ plain: true });
      } else {
        ua.currentValue = newValue;
        ua.lastUpdateDate = today;
        if (newValue >= ach.targetValue && !ua.completed) {
          ua.completed = true;
          ua.completedAt = new Date();
        }
        
        // تحديث الكائن في الذاكرة لضمان الاتساق
        userAchievements[username][ach.id] = ua;
        
        await UserAchievement.update({
          currentValue: ua.currentValue,
          completed: ua.completed,
          completedAt: ua.completedAt,
          lastUpdateDate: ua.lastUpdateDate
        }, {
          where: { username, achievementId: ach.id }
        });
      }
      userAchievements[username][ach.id] = ua;

      if (ua.completed) {
        // تحديث البيانات المتصلة للمستخدم
        let userSocketId = null;
        Object.keys(onlineUsers).forEach(socketId => {
          if (onlineUsers[socketId].name === username) {
            onlineUsers[socketId].badges = getUserBadges(username);
            userSocketId = socketId;
          }
        });

        // إرسال تحديث للمستخدمين في نفس الغرفة لتحديث الأوسمة لديهم
        const userSocket = io.sockets.sockets.get(userSocketId);
        if (userSocket && userSocket.currentRoomId) {
            const room = rooms.find(r => r.id === userSocket.currentRoomId);
            if (room) {
                // تحديث قائمة المستخدمين في الغرفة لإظهار الوسام الجديد
                io.to(room.id).emit('users update', room.users.map(u => {
                    const socketId = Object.keys(onlineUsers).find(id => onlineUsers[id].name === u.name);
                    return socketId ? onlineUsers[socketId] : u;
                }));
            }
        }

        // إشعار المستخدم بالحصول على الوسام
        if (userSocketId) {
          io.to(userSocketId).emit('achievement_unlocked', {
            achievement: ach,
            allBadges: getUserBadges(username)
          });
        }
      }
    }
  } catch (err) {
    console.error('Error updating achievement progress:', err);
  }
}


async function loadData() {
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms)); // دالة تأخير
  try {
    // محاولة الاتصال مع إعادة المحاولة 5 مرات
    for (let i = 1; i <= 5; i++) {
      try {
        await sequelize.authenticate();
        console.log('تم الاتصال بقاعدة البيانات بنجاح!');
        break;
      } catch (err) {
        console.error(`فشل الاتصال بقاعدة البيانات (محاولة ${i}/5): ${err.message}`);
        if (i === 5) throw err; // رمي الخطأ في المحاولة الأخيرة
        await delay(5000); // انتظار 5 ثواني قبل المحاولة التالية
      }
    }
    
    await sequelize.sync({ alter: true });
    console.log('تم مزامنة قاعدة البيانات بنجاح');
    await delay(100);

    /*
    // التحقق من وجود عمود الفئة في جدول الأسئلة
    const hasCategoryColumn = await columnExists('QuizQuestions', 'category');
    if (!hasCategoryColumn) {
      try {
        await sequelize.getQueryInterface().addColumn('QuizQuestions', 'category', {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'عام'
        });
        console.log('تم إضافة عمود category إلى جدول QuizQuestions بنجاح');
      } catch (err) {
        console.error('فشل إضافة عمود category:', err);
      }
    }
    await delay(100);
    */

    // التحقق من أعمدة المكافآت اليومية في جدول النقاط
    const hasLastDailyClaim = await columnExists('UserPoints', 'lastDailyClaim');
    if (!hasLastDailyClaim) {
      try {
        await sequelize.getQueryInterface().addColumn('UserPoints', 'lastDailyClaim', {
          type: DataTypes.STRING,
          allowNull: true
        });
        await sequelize.getQueryInterface().addColumn('UserPoints', 'dailyStreak', {
          type: DataTypes.INTEGER,
          defaultValue: 0
        });
        console.log('تم إضافة أعمدة المكافآت اليومية بنجاح');
      } catch (err) {
        console.error('فشل إضافة أعمدة المكافآت:', err);
      }
    }

    // التحقق من عمود XP
    const hasXPColumn = await columnExists('UserPoints', 'xp');
    if (!hasXPColumn) {
      try {
        await sequelize.getQueryInterface().addColumn('UserPoints', 'xp', { type: DataTypes.INTEGER, defaultValue: 0 });
        console.log('تم إضافة عمود xp بنجاح');
      } catch (err) {
        console.error('فشل إضافة عمود xp:', err);
      }
    }

    // التحقق من عمود nameFont
    const hasNameFont = await columnExists('Users', 'nameFont');
    if (!hasNameFont) {
      try {
        await sequelize.getQueryInterface().addColumn('Users', 'nameFont', { type: DataTypes.STRING, allowNull: true });
        console.log('تم إضافة عمود nameFont بنجاح');
      } catch (err) {
        console.error('فشل إضافة عمود nameFont:', err);
      }
    }

    // التحقق من عمود status
    const hasStatus = await columnExists('Users', 'status');
    if (!hasStatus) {
      try {
        await sequelize.getQueryInterface().addColumn('Users', 'status', { type: DataTypes.STRING(200), allowNull: true });
        console.log('تم إضافة عمود status بنجاح');
      } catch (err) { console.error('فشل إضافة عمود status:', err); }
    }

    // التحقق من عمود country
    const hasCountry = await columnExists('Users', 'country');
    if (!hasCountry) {
      try {
        await sequelize.getQueryInterface().addColumn('Users', 'country', { type: DataTypes.STRING, allowNull: true });
        console.log('تم إضافة عمود country بنجاح');
      } catch (err) { console.error('فشل إضافة عمود country:', err); }
    }

    // التحقق من عمود age
    const hasAge = await columnExists('Users', 'age');
    if (!hasAge) {
      try {
        await sequelize.getQueryInterface().addColumn('Users', 'age', { type: DataTypes.INTEGER, allowNull: true });
        console.log('تم إضافة عمود age بنجاح');
      } catch (err) { console.error('فشل إضافة عمود age:', err); }
    }

    // التحقق من عمود joinMessageBackground
    const hasJoinBg = await columnExists('Users', 'joinMessageBackground');
    if (!hasJoinBg) {
      try {
        await sequelize.getQueryInterface().addColumn('Users', 'joinMessageBackground', { type: DataTypes.STRING, allowNull: true });
        console.log('تم إضافة عمود joinMessageBackground بنجاح');
      } catch (err) { console.error('فشل إضافة عمود joinMessageBackground:', err); }
    }

    await delay(10); // تقليل وقت الانتظار لتسريع البدء
    
    // تحميل البيانات بشكل تسلسلي لتجنب مشاكل SSL مع البيانات الكبيرة
    // ملاحظة: تم استبعاد الحقول الكبيرة (بيو وصورة الغلاف) من التحميل الأولي لتجنب أخطاء SSL
    const usersData = await User.findAll({ 
      attributes: ['username', 'password', 'gender', 'nameColor', 'nameBackground', 'avatarFrame', 'userCardBackground', 'profileBackground', 'nameCardBorder', 'nameFont', 'joinMessageBackground', 'referredBy', 'createdAt', 'status', 'country', 'age'] 
    });
    await delay(10);
    
    const ranksData = await UserRank.findAll();
    await delay(10);
    const storedRankDefinitions = await RankDefinition.findAll();
    await delay(10);
    
    const mutedUsers = await UserManagement.findAll({ where: { type: 'mute' } });
    await delay(10);
    const roomBans = await UserManagement.findAll({ where: { type: 'room_ban' } });
    await delay(10);
    const siteBans = await UserManagement.findAll({ where: { type: 'site_ban' } });
    await delay(10);

    // تحميل الصور الرمزية - تحميل الصور ذات الحجم المعقول فقط لتجنب أخطاء SSL
    let avatarsData = [];
    try {
        avatarsData = await UserAvatar.findAll({
            where: sequelize.where(sequelize.fn('length', sequelize.col('avatarUrl')), '<', 50000),
            limit: 100 // تحميل عدد محدود لتجنب أخطاء SSL
        });
    } catch (err) { console.error('Warning: Failed to load avatars batch (will load on demand):', err.message); }
    
    await delay(10);

    // تحميل الجلسات
    const sessionsData = await UserSession.findAll();
    await delay(10);

    const friendsData = await UserFriend.findAll();
    await delay(10);

    const pointsData = await UserPoints.findAll();
    await delay(10);
    const lastSeenData = await UserLastSeen.findAll();
    await delay(10);
    const roomManagersData = await RoomManager.findAll();
    await delay(10);

    const roomBgData = await RoomBackground.findAll();
    await delay(10);
    const roomSettingsData = await RoomSettings.findAll();
    await delay(10);
    const dbRooms = await Room.findAll({ order: [['order', 'ASC'], ['id', 'ASC']] });
    await delay(10);

    const inventoriesData = await UserInventory.findAll();
    await delay(10);
    const requestsData = await FriendRequest.findAll();
    await delay(10);
    
    // ملاحظة: تم إزالة التحميل الجماعي للرسائل الخاصة وصور الدردشة لتجنب أخطاء SSL
    // سيتم تحميل الرسائل عند الطلب من قاعدة البيانات مباشرة
    console.log('تخطي تحميل الرسائل والصور الجماعية لتسريع البدء ومنع أخطاء SSL');
    // تقليل عدد المنشورات المحملة في الذاكرة لتوفير الرام
    const postsData = await Post.findAll({ order: [['timestamp', 'DESC']], limit: 20 });
    await delay(10);
    const likesData = await PostLike.findAll();
    await delay(10);
    const laughsData = await PostLaugh.findAll();
    await delay(10);
    const commentsData = await PostComment.findAll({ order: [['timestamp', 'ASC']] });
    await delay(10);

    const systemSettingsData = await SystemSettings.findAll();
    await delay(10);
    const achievementsData = await Achievement.findAll();
    await delay(10);
    const userAchievementsData = await UserAchievement.findAll();
    await delay(10);

    systemSettingsData.forEach(setting => {
      if (setting.key === 'botAvatar') BOT_AVATAR_URL = setting.value;
    });

    // معالجة البيانات المحملة
    let usersWithBorders = 0;
    usersData.forEach(userInstance => {
      const user = userInstance.get ? userInstance.get({ plain: true }) : userInstance;
      users[user.username] = {
        password: user.password,
        gender: user.gender,
        nameColor: user.nameColor || null,
        nameBackground: user.nameBackground || null,
        avatarFrame: user.avatarFrame || null,
        userCardBackground: user.userCardBackground || null,
        profileBackground: user.profileBackground || null,
        nameCardBorder: user.nameCardBorder || null,
        nameFont: user.nameFont || null,
        joinMessageBackground: user.joinMessageBackground || null,
        referredBy: user.referredBy || null,
        createdAt: user.createdAt,
        status: user.status || null,
        country: user.country || null,
        age: user.age || null
      };
      // bio and profileCover are purposefully omitted here to be loaded on-demand
      // as they can be large and cause SSL issues during mass loading.
      if (user.bio !== undefined) users[user.username].bio = user.bio;
      if (user.profileCover !== undefined) users[user.username].profileCover = user.profileCover;

      if (user.nameCardBorder) usersWithBorders++;
    });
    console.log(`تم تحميل ${usersData.length} مستخدمين، منهم ${usersWithBorders} لديهم أطر ملونة.`);
    
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

    // ضمان وجود تعريف رتبة صاحب الموقع
    if (!ranks['صاحب الموقع']) {
        const ownerRankDef = { color: 'from-red-600 to-orange-400', icon: '🏆', level: 100, wingId: 'owners' };
        ranks['صاحب الموقع'] = ownerRankDef;
        await RankDefinition.findOrCreate({ where: { name: 'صاحب الموقع' }, defaults: ownerRankDef });
    } else {
        ranks['صاحب الموقع'].level = 100;
    }
    
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

    pointsData.forEach(point => { 
        userPoints[point.username] = { 
            points: point.points, 
            level: point.level, 
            isInfinite: point.isInfinite || false, 
            showInTop: point.showInTop !== false, 
            interactionScore: point.interactionScore || 0, 
            xp: point.xp || 0,
        }; 
    });
    lastSeenData.forEach(seen => userLastSeen[seen.username] = parseInt(seen.lastSeen, 10));

    roomManagersData.forEach(manager => {
      if (!roomManagers[manager.roomId]) roomManagers[manager.roomId] = [];
      roomManagers[manager.roomId].push(manager.managerUsername);
    });
    roomBgData.forEach(bg => {
      const data = bg.get ? bg.get({ plain: true }) : bg;
      const roomId = parseInt(data.roomId);
      if (roomId) {
        roomBackgrounds[roomId] = { type: data.backgroundType, value: data.backgroundValue };
      }
    });
    console.log(`تم تحميل ${roomBgData.length} خلفيات غرف:`, Object.keys(roomBackgrounds));
    
    roomSettingsData.forEach(setting => {
      const data = setting.get ? setting.get({ plain: true }) : setting;
      const roomId = parseInt(data.roomId);
      if (roomId) {
        roomSettings[roomId] = { description: data.description, textColor: data.textColor, messageBackground: data.messageBackground };
      }
    });
    console.log(`تم تحميل ${roomSettingsData.length} إعدادات غرف:`, Object.keys(roomSettings));

    // معالجة الإنجازات
    const defaultAchievements = [
      { id: 'active_100', name: 'نشيط', description: 'إرسال 100 رسالة', icon: '🟢', targetValue: 100, type: 'messages', cardColor: '#3b82f6' },
      { id: 'room_legend', name: 'أسطورة الغرفة', description: 'نشاط متواصل لمدة 30 يوم', icon: '🔥', targetValue: 30, type: 'days', cardColor: '#ef4444' },
      { id: 'social_20', name: 'اجتماعي', description: 'التفاعل مع 20 شخص مختلف', icon: '💬', targetValue: 20, type: 'interactions', cardColor: '#10b981' },
      { id: 'generous', name: 'كريم', description: 'إرسال 50,000 نقطة للآخرين', icon: '🎁', targetValue: 50000, type: 'gifts', cardColor: '#f59e0b' },
      { id: 'online_50h', name: 'متواجد', description: 'التواجد لمدة 50 ساعة في الغرف', icon: '⏰', targetValue: 50, type: 'hours', cardColor: '#8b5cf6' }
    ];

    // تحديث الإنجازات الافتراضية والتأكد من تصفير إنجاز كريم لمرة واحدة إذا كان الهدف قديماً
    for (const def of defaultAchievements) {
      const [achievement, created] = await Achievement.findOrCreate({
        where: { id: def.id },
        defaults: def
      });
      
      // تحديث الهدف واللون إذا اختلفا
      if (!created && (achievement.targetValue !== def.targetValue || achievement.cardColor !== def.cardColor)) {
        await achievement.update({ targetValue: def.targetValue, cardColor: def.cardColor });
        
        // إذا كان إنجاز كريم، قم بتصفير التقدم للجميع لضمان البدء بالنظام الجديد
        if (def.id === 'generous') {
          console.log('جاري إعادة تعيين إنجاز كريم للجميع وفق النظام الجديد (50,000 نقطة)...');
          // تصفير قاعدة البيانات
          await UserAchievement.destroy({ where: { achievementId: 'generous' } });
          // تصفير الذاكرة بالكامل لهذا الإنجاز
          Object.keys(userAchievements).forEach(uname => {
            if (userAchievements[uname]) {
              delete userAchievements[uname]['generous'];
            }
          });
        }
      }
      
      achievements[achievement.id] = achievement.get({ plain: true });
    }

    achievementsData.forEach(ach => {
      achievements[ach.id] = ach.get({ plain: true });
    });

    userAchievementsData.forEach(ua => {
      if (!userAchievements[ua.username]) userAchievements[ua.username] = {};
      userAchievements[ua.username][ua.achievementId] = ua.get({ plain: true });
    });

    if (dbRooms.length > 0) {
      rooms = dbRooms
        .filter(roomInstance => {
          const room = roomInstance.get({ plain: true });
          return room.name !== 'غرفة تخصيص المظهر';
        })
        .map(roomInstance => {
          const room = roomInstance.get({ plain: true });
          return { 
            id: room.id, 
            name: room.name, 
            icon: room.icon, 
            description: room.description, 
            protected: room.protected, 
            order: room.order, 
            users: [], 
            managers: roomManagers[room.id] || [],
            background: roomBackgrounds[room.id] || { type: 'color', value: '#000000' },
            settings: roomSettings[room.id] || { description: room.description, textColor: 'text-white', messageBackground: 'bg-gray-800' }
          };
        });
    } else {
      const defaultRooms = [
        { name: 'غرفة العامة', icon: '💬', description: 'محادثات عامة ومتنوعة', protected: false, order: 1 },
        { name: 'غرفة التقنية', icon: '💻', description: 'مناقشات تقنية وبرمجة', protected: false, order: 2 },
        { name: 'غرفة الرياضة', icon: '⚽', description: 'أخبار ومناقشات رياضية', protected: false, order: 3 },
        { name: 'غرفة الألعاب', icon: '🎮', description: 'مناقشات الألعاب والجيمرز', protected: false, order: 4 },
        { name: 'غرفة التسلية', icon: '🎡', description: 'مسابقات وألعاب وبوت الأسئلة', protected: false, order: 5 }
      ];
      for (const defaultRoom of defaultRooms) {
        await Room.findOrCreate({ where: { name: defaultRoom.name }, defaults: { ...defaultRoom, createdBy: 'Walid dz 31' } });
      }
      const createdRooms = await Room.findAll({ order: [['order', 'ASC'], ['id', 'ASC']] });
      rooms = createdRooms.map(roomInstance => {
        const room = roomInstance.get({ plain: true });
        return { 
          id: room.id, 
          name: room.name, 
          icon: room.icon, 
          description: room.description, 
          protected: room.protected, 
          order: room.order, 
          users: [], 
          managers: roomManagers[room.id] || [],
          background: roomBackgrounds[room.id] || { type: 'color', value: '#000000' },
          settings: roomSettings[room.id] || { description: room.description, textColor: 'text-white', messageBackground: 'bg-gray-800' }
        };
      });
    }

    const existingShopItems = await ShopItem.count();
    if (existingShopItems === 0) {
      await ShopItem.bulkCreate([
        { name: 'رتبة جيد', description: 'شراء رتبة جيد', price: 1000, itemType: 'rank', itemValue: 'جيد' },
        { name: 'رتبة بريميوم', description: 'شراء رتبة بريميوم', price: 3000, itemType: 'rank', itemValue: 'بريميوم' },
        { name: 'رتبة ادمن', description: 'شراء رتبة ادمن', price: 10000, itemType: 'rank', itemValue: 'ادمن' },
        { name: 'رتبة سوبر ادمن', description: 'شراء رتبة سوبر ادمن', price: 20000, itemType: 'rank', itemValue: 'سوبر ادمن' },
        { name: 'رتبة منشئ', description: 'شراء رتبة منشئ', price: 50000, itemType: 'rank', itemValue: 'منشئ' },
        { name: 'خلفية انضمام نارية', description: 'رسالة انضمام بخلفية نارية متحركة وجذابة', price: 50000, itemType: 'join_message_bg', itemValue: 'fire-join-bg' }
      ]);
    }

    // التأكد من وجود خلفية الانضمام النارية (للمستخدمين الحاليين)
    const fireBgItem = await ShopItem.findOne({ where: { itemValue: 'fire-join-bg' } });
    if (!fireBgItem) {
        await ShopItem.create({ name: 'خلفية انضمام نارية', description: 'رسالة انضمام بخلفية نارية متحركة وجذابة', price: 50000, itemType: 'join_message_bg', itemValue: 'fire-join-bg' });
    }
    
    // إضافة إطارات التاج الخاصة
    const crownGoldItem = await ShopItem.findOne({ where: { itemValue: 'frame-crown-gold' } });
    if (!crownGoldItem) {
        await ShopItem.create({ name: 'إطار التاج الذهبي', description: 'إطار دائري ذهبي مضيء مع تاج', price: 20000, itemType: 'avatar_frame', itemValue: 'frame-crown-gold' });
    } else {
        await crownGoldItem.update({ price: 20000 });
    }
    const crownRainbowItem = await ShopItem.findOne({ where: { itemValue: 'frame-crown-rainbow' } });
    if (!crownRainbowItem) {
        await ShopItem.create({ name: 'إطار التاج الملون', description: 'إطار دائري بألوان متحركة مع تاج', price: 20000, itemType: 'avatar_frame', itemValue: 'frame-crown-rainbow' });
    } else {
        await crownRainbowItem.update({ price: 20000 });
    }
    
    const blueFireItem = await ShopItem.findOne({ where: { itemValue: 'frame-blue-fire' } });
    if (!blueFireItem) {
        await ShopItem.create({ name: 'إطار النار الأزرق', description: 'إطار ناري أزرق مع تاج يدور', price: 20000, itemType: 'avatar_frame', itemValue: 'frame-blue-fire' });
    } else {
        await blueFireItem.update({ price: 20000 });
    }
    
    const orangeFireItem = await ShopItem.findOne({ where: { itemValue: 'frame-orange-fire' } });
    if (!orangeFireItem) {
        await ShopItem.create({ name: 'إطار النار البرتقالي', description: 'إطار ناري برتقالي مشع (1000 XP)', price: 1000, itemType: 'avatar_frame', itemValue: 'frame-orange-fire' });
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

    postsData.forEach(post => { posts[post.id] = { username: post.username, content: post.content, image: post.image, timestamp: parseInt(post.timestamp, 10), likes: [], laughs: [], comments: [] }; });
    likesData.forEach(like => { if (posts[like.postId]) posts[like.postId].likes.push(like.username); });
    laughsData.forEach(laugh => { if (posts[laugh.postId]) posts[laugh.postId].laughs.push(laugh.username); });
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
        profileBackground: ownerUser.profileBackground, profileCover: ownerUser.profileCover,
        nameCardBorder: ownerUser.nameCardBorder,
        joinMessageBackground: ownerUser.joinMessageBackground,
        status: ownerUser.status,
        country: ownerUser.country,
        age: ownerUser.age,
        nameFont: ownerUser.nameFont,
        createdAt: ownerUser.createdAt,
        referredBy: ownerUser.referredBy
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
    if (!userData) {
        console.error(`محاولة حفظ مستخدم ${username} ببيانات فارغة!`);
        return;
    }
    await User.upsert({
      username,
      password: userData.password,
      gender: userData.gender,
      bio: userData.bio || null,
      nameColor: userData.nameColor || null,
      nameBackground: userData.nameBackground || null,
      avatarFrame: userData.avatarFrame || null,
      userCardBackground: userData.userCardBackground || null,
      profileBackground: userData.profileBackground || null,
      profileCover: userData.profileCover || null,
      nameCardBorder: userData.nameCardBorder || null,
      nameFont: userData.nameFont || null,
      joinMessageBackground: userData.joinMessageBackground || null,
      referredBy: userData.referredBy || null,
      status: userData.status || null,
      country: userData.country || null,
      age: userData.age || null
    });
    console.log(`تم حفظ بيانات المستخدم ${username} بنجاح (الإطار: ${userData.nameCardBorder || 'لا يوجد'})`);
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
async function savePost(username, content, image, timestamp) {
    try {
        const post = await Post.create({
            username,
            content,
            image,
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

async function savePostLaugh(postId, username, timestamp) {
    try {
        await PostLaugh.create({
            postId,
            username,
            timestamp
        });
    } catch (error) {
        console.error('خطأ في حفظ ضحكة المنشور:', error);
    }
}

async function removePostLaugh(postId, username) {
    try {
        await PostLaugh.destroy({ where: { postId, username } });
    } catch (error) {
        console.error('خطأ في إزالة ضحكة المنشور:', error);
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
            await PostLaugh.destroy({ where: { postId } });
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
    
    // تقليل حد الذاكرة للرسائل بشكل كبير
    messages[roomId] = uniqueMessages.slice(-30);
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
            
            broadcastRoomsUpdate();
        }
    }
}, 60000);

// --- فحص دوري لتحديث ساعات التواجد للإنجازات ---
setInterval(async () => {
    const now = Date.now();
}, 60000); // فحص كل دقيقة عن المستخدمين الذين أكملوا ساعة

// --- نظام نقاط الخبرة (XP) ---
setInterval(async () => {
    const usersInRooms = Object.values(onlineUsers).filter(u => u.roomId);
    for (const u of usersInRooms) {
        if (!userPoints[u.name]) {
             userPoints[u.name] = { points: 0, level: 1, xp: 0 };
             await UserPoints.create({ username: u.name });
        }
        userPoints[u.name].xp = (userPoints[u.name].xp || 0) + 1;
        
        // تحديث قاعدة البيانات (بدون انتظار لعدم تعطيل الحلقة)
        UserPoints.update({ xp: userPoints[u.name].xp }, { where: { username: u.name } }).catch(console.error);
    }
}, 60000); // زيادة 1 XP كل دقيقة

// الغرف سيتم تحميلها من قاعدة البيانات
let rooms = [];

let globalAnnouncement = { title: '', message: '' }; // متغير لتخزين الإعلان الهام مع العنوان
let messages = {};
let onlineUsers = {};
const userConnectionTimes = {}; // لتتبع وقت دخول المستخدمين لإنجاز الساعات

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

// إعداد multer للصور
const storage = multer.memoryStorage();

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
  
  // تحويل الصورة إلى Base64 وتخزينها في قاعدة البيانات مباشرة
  const b64 = req.file.buffer.toString('base64');
  const fileUrl = `data:${req.file.mimetype};base64,${b64}`;
  res.json({ success: true, fileUrl });
});

app.use(express.static(path.join(__dirname, 'public', 'uploads')));

// إعداد Socket.io
// دالة للحصول على نسخة خفيفة من الغرف لتقليل حجم البيانات
function getLightRooms() {
  return rooms.map(r => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    description: r.description,
    protected: r.protected,
    order: r.order,
    userCount: r.users ? r.users.length : 0,
    managers: r.managers || [],
    background: r.background,
    settings: r.settings
  }));
}

// دالة لإرسال تحديث الغرف مع تقليل الضغط (Throttling)
let roomsUpdateTimeout = null;
function broadcastRoomsUpdate() {
  if (roomsUpdateTimeout) return;
  roomsUpdateTimeout = setTimeout(() => {
    io.emit('rooms update', getLightRooms());
    roomsUpdateTimeout = null;
  }, 5000); // زيادة وقت التحديث لتقليل الضغط عند دخول مستخدمين جدد
}

io.on('connection', (socket) => {
  // بدء تحميل التاريخ الثقيل فقط عند أول اتصال مستخدم (لتجنب أخطاء SSL عند بدء التشغيل)
  loadGlobalHistory();
  console.log('مستخدم جديد متصل:', socket.id);

  if (!isServerReady) {
    socket.emit('server not ready', 'السيرفر قيد التهيئة، يرجى المحاولة بعد لحظات.');
    socket.disconnect(true);
    return;
  }

  // إرسال الإعلان الحالي للمستخدم الجديد
  socket.emit('announcement update', globalAnnouncement);
  socket.emit('ranks update', ranks); // إرسال الرتب فور الاتصال لضمان تحميل الرتب الخاصة
  socket.emit('rooms update', getLightRooms()); // إرسال الغرف فوراً لضمان سرعة العرض
  
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
        // إضافة اسم المستخدم للبيانات المرسلة
        if (onlineUsers[socket.id]) {
            data.username = onlineUsers[socket.id].name;
        }
        socket.broadcast.emit('draw', data);
        socket.broadcast.emit('new drawing activity'); // إشعار بوجود نشاط رسم جديد
    });

    socket.on('clear board', () => {
        drawingHistory = [];
        io.emit('clear board');
    });

    // أحداث المنشورات
socket.on('create post', async (data) => {
    const { content, image, username } = data;
    const timestamp = Date.now();
    
    // منع التكرار السريع (Debounce) - 2 ثانية
    if (userLastAction[username] && userLastAction[username].type === 'create_post' && 
        userLastAction[username].content === content && 
        (timestamp - userLastAction[username].timestamp) < 2000) {
        return;
    }
    userLastAction[username] = { type: 'create_post', content, timestamp };
    
    try {
        const postId = await savePost(username, content, image, timestamp);
        
        // إضافة إلى الذاكرة
        posts[postId] = {
            username,
            content,
            image,
            timestamp,
            likes: [],
            laughs: [],
            comments: []
        };
        
        // إرسال المنشور الجديد للجميع
        io.emit('new post', {
            id: postId,
            username,
            content,
            image,
            avatar: userAvatars[username] || DEFAULT_AVATAR_URL,
            timestamp,
            likes: [],
            laughs: [],
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
        avatar: userAvatars[posts[id].username] || DEFAULT_AVATAR_URL
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

socket.on('laugh post', async (data) => {
    const { postId, username } = data;
    
    // منع التكرار السريع (Debounce)
    const now = Date.now();
    if (userLastAction[username] && userLastAction[username].type === 'laugh_post' && 
        userLastAction[username].postId === postId && (now - userLastAction[username].timestamp) < 1000) {
        return;
    }
    userLastAction[username] = { type: 'laugh_post', postId, timestamp: now };
    
    if (posts[postId]) {
        if (!posts[postId].laughs) posts[postId].laughs = [];

        const alreadyLaughed = posts[postId].laughs.includes(username);
        if (alreadyLaughed) {
            await removePostLaugh(postId, username);
            posts[postId].laughs = posts[postId].laughs.filter(u => u !== username);
        } else {
            await savePostLaugh(postId, username, Date.now());
            posts[postId].laughs.push(username);

            // إرسال إشعار لصاحب المنشور
            const postAuthor = posts[postId].username;
            if (postAuthor !== username) {
                await saveNotification(postAuthor, username, 'laugh', postId);

                // إرسال إشعار فوري إذا كان صاحب المنشور متصلاً
                const recipientSocketId = Object.keys(onlineUsers).find(
                    socketId => onlineUsers[socketId].name === postAuthor
                ); 
                if (recipientSocketId) {
                    io.to(recipientSocketId).emit('new notification', {
                        senderUsername: username,
                        type: 'laugh',
                        postId: postId
                    });
                }
            }
        }
        io.emit('post laughed', { 
            postId, 
            laughs: posts[postId].laughs
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
            avatar: userAvatars[username] || DEFAULT_AVATAR_URL
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
    avatar: userAvatars[user.name] || DEFAULT_AVATAR_URL,
    nameBackground: users[user.name]?.nameBackground,
    avatarFrame: users[user.name]?.avatarFrame,
    nameCardBorder: users[user.name]?.nameCardBorder,
    nameFont: users[user.name]?.nameFont,
    badges: getUserBadges(user.name)
  };
  
  if (!messages[roomId]) messages[roomId] = [];
  if (messages[roomId].length > 30) { // تقليل الحد الأقصى للرسائل في الذاكرة
    messages[roomId] = messages[roomId].slice(-30);
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
        avatar: userAvatars[fromUser] || DEFAULT_AVATAR_URL
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
        // تحميل صورة الغلاف إذا لم تكن محملة في الذاكرة
        if (userInMemory.profileCover === undefined) {
            try {
                const dbUser = await User.findByPk(userData.username, { attributes: ['profileCover'] });
                if (dbUser) {
                    userInMemory.profileCover = dbUser.profileCover || null;
                }
            } catch (err) {
                console.error(`Error fetching profileCover for login:`, err);
            }
        }

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
            profileCover: userInMemory.profileCover,
            nameCardBorder: userInMemory.nameCardBorder,
            nameFont: userInMemory.nameFont,
            status: userInMemory.status,
            country: userInMemory.country,
            age: userInMemory.age,
            ownedItems: getOwnedItems(userData.username)
          });
          socket.join(userData.username); // الانضمام لغرفة المستخدم لتلقي الرسائل الخاصة
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
    gender: userData.gender,
    referredBy: userData.referredBy || null, // تخزين من قام بدعوته
    createdAt: new Date() // تعيين تاريخ الإنشاء في الذاكرة
  };
  
  await saveUser(userData.username, users[userData.username]);

  // إذا تم التسجيل عبر رابط دعوة، نزيد درجة تفاعل الداعي
  if (userData.referredBy && users[userData.referredBy]) {
    if (!userPoints[userData.referredBy]) {
      userPoints[userData.referredBy] = { points: 0, level: 1, isInfinite: false, interactionScore: 0 };
    }
    userPoints[userData.referredBy].interactionScore = (userPoints[userData.referredBy].interactionScore || 0) + 1;
    
    // حفظ النقاط المحدثة في قاعدة البيانات
    try {
      await UserPoints.upsert({
        username: userData.referredBy,
        ...userPoints[userData.referredBy]
      });
      
      // إرسال تحديث للداعي إذا كان متصلاً
      io.to(userData.referredBy).emit('interaction update', {
        score: userPoints[userData.referredBy].interactionScore
      });
    } catch (e) {
      console.error('Error updating interactionScore:', e);
    }
  }
  
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
    nameColor: null,
    nameBackground: null,
    avatarFrame: null,
    userCardBackground: null,
    profileBackground: null,
    profileCover: null,
    nameCardBorder: null,
    nameFont: null,
    ownedItems: []
  });
  socket.join(userData.username);
  socket.emit('ranks update', ranks);
});

  // حدث دخول زائر
  socket.on('user guest login', async (userData) => {
    try {
      const username = userData.username.trim();
      
      // تحقق من وجود ايموجي
      const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      if (emojiRegex.test(username)) {
        socket.emit('guest error', 'عذراً، لا يمكن استخدام الرموز التعبيرية (Emojis) في اسم الزائر!');
        return;
      }

      if (users[username]) {
        socket.emit('guest error', 'اسم المستخدم هذا مسجل بالفعل كعضو، يرجى تسجيل الدخول أو اختيار اسم آخر.');
        return;
      }

      // التحقق من أن الاسم غير مستخدم حالياً من قبل زائر آخر متصل
      const isNameTaken = Object.values(onlineUsers).some(u => u.name === username);
      if (isNameTaken) {
        socket.emit('guest error', 'هذا الاسم مستخدم حالياً في المحادثة، يرجى اختيار اسم آخر.');
        return;
      }

      const sessionId = 'guest_' + Date.now() + Math.random().toString(36).substr(2, 9);
      
      socket.emit('guest success', {
        name: username,
        rank: 'زائر',
        isSiteOwner: false,
        isGuest: true, // إضافة علامة أنه زائر
        gender: userData.gender,
        socketId: socket.id,
        sessionId: sessionId,
        nameColor: null
      });
      
      socket.join(username);
      socket.emit('ranks update', ranks);
    } catch (error) {
      console.error('خطأ في عملية دخول الزائر:', error);
      socket.emit('guest error', 'حدث خطأ في الخادم، يرجى المحاولة مرة أخرى.');
    }
  });

  // في حدث join room - البحث عن هذا الجزء واستبداله
socket.on('join room', async (data) => {
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

    
    // التأكد من تحميل الصورة الرمزية للمستخدم إذا لم تكن في الذاكرة
    if (!userAvatars[user.name]) {
        try {
            const avatar = await UserAvatar.findOne({ where: { username: user.name } });
            if (avatar) {
                userAvatars[user.name] = avatar.avatarUrl;
            }
        } catch (e) {
            console.error('Error loading avatar for user:', user.name, e);
        }
    }

    // تخزين بيانات المستخدم (تحديث البيانات من الذاكرة لضمان الدقة)
    const userFromDB = users[user.name] || {};
    onlineUsers[socket.id] = {
      id: socket.id,
      name: user.name,
      roomId: roomId,
      rank: userRanks[user.name] || user.rank,
      gender: userFromDB.gender || user.gender,
      avatar: userAvatars[user.name] || DEFAULT_AVATAR_URL,
      nameColor: userFromDB.nameColor,
      nameBackground: userFromDB.nameBackground,
      avatarFrame: userFromDB.avatarFrame,
      userCardBackground: userFromDB.userCardBackground,
      nameCardBorder: userFromDB.nameCardBorder,
      nameFont: userFromDB.nameFont,
      joinMessageBackground: userFromDB.joinMessageBackground,
      badges: getUserBadges(user.name),
      status: userFromDB.status,
      country: userFromDB.country,
      age: userFromDB.age
    };

    // تسجيل وقت الدخول لتتبع الساعات
    if (!userConnectionTimes[user.name]) {
        userConnectionTimes[user.name] = Date.now();
    }
    
    // الانضمام لغرفة باسم المستخدم لاستقبال الرسائل الخاصة بكفاءة
    socket.join(user.name);
    
    // إزالة المستخدم من أي غرفة أخرى كان فيها (سواء كان متصلاً أو غير متصل)
    rooms.forEach(r => {
        const index = r.users.findIndex(u => u.name === user.name);
        if (index !== -1 && r.id !== roomId) {
            r.users.splice(index, 1);
            io.to(r.id).emit('users update', r.users);
        }
    });
    
    // التحقق مما إذا كان المستخدم موجوداً مسبقاً في هذه الغرفة (كغير متصل)
    const existingUserIndex = room.users.findIndex(u => u.name === user.name);
    
    if (existingUserIndex !== -1) {
        // تحديث بيانات المستخدم الحالي
        room.users[existingUserIndex] = {
            ...room.users[existingUserIndex],
            id: socket.id,
            isOnline: true,
            rank: onlineUsers[socket.id].rank,
            avatar: onlineUsers[socket.id].avatar
        };
    } else {
        // إضافة المستخدم للغرفة الجديدة
        room.users.push({
            id: socket.id,
            name: user.name,
            rank: onlineUsers[socket.id].rank,
            gender: onlineUsers[socket.id].gender,
            avatar: onlineUsers[socket.id].avatar,
            nameColor: onlineUsers[socket.id].nameColor,
            nameBackground: onlineUsers[socket.id].nameBackground,
            avatarFrame: onlineUsers[socket.id].avatarFrame,
            userCardBackground: onlineUsers[socket.id].userCardBackground,
            nameCardBorder: onlineUsers[socket.id].nameCardBorder,
            nameFont: onlineUsers[socket.id].nameFont,
            joinMessageBackground: onlineUsers[socket.id].joinMessageBackground,
            status: onlineUsers[socket.id].status,
            country: onlineUsers[socket.id].country,
            age: onlineUsers[socket.id].age,
            isOnline: true
        });
    }
    
    socket.currentRoomId = roomId;
    socket.join(roomId);
    
    // إرسال تحديث الغرف (مقلل)
    broadcastRoomsUpdate();
    
    // إرسال تحديث المستخدمين المتصلين للغرفة
    io.to(roomId).emit('users update', room.users);
    
    // إرسال رسالة ترحيب - الجزء المعدل
    const rankInfo = user.rank ? ranks[user.rank] : null;
    const welcomeMessage = {
      type: 'system',
      subType: 'join',
      messageId: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9), // إضافة معرف للرسالة لتمكين حذفها
      user: user.name,
      avatar: userAvatars[user.name] || DEFAULT_AVATAR_URL,
      rank: user.rank,
      rankLevel: rankInfo ? rankInfo.level : 0,
      // استخدم نسخة المستخدم المتصلة إن كانت موجودة (تضمن التغييرات الفورية للمخزون)
      joinBg: (onlineUsers[socket.id] && onlineUsers[socket.id].joinMessageBackground) || users[user.name]?.joinMessageBackground,
      time: new Date().toLocaleTimeString('en-GB'),
      timestamp: Date.now()
    };
    
    // إضافة الرسالة للسجل قبل إرسالها
    if (!messages[roomId]) messages[roomId] = [];
    if (messages[roomId].length > 30) { // تقليل الحد الأقصى للرسائل في الذاكرة
      messages[roomId] = messages[roomId].slice(-30);
    }
    messages[roomId].push(welcomeMessage);
    
    // إرسال الرسالة للغرفة
    io.to(roomId).emit('new message', welcomeMessage);
    
    // إرسال تاريخ المحادثة للمستخدم الجديد (الرسائل الحديثة فقط)
    // تأكد أن كل رسالة لديها messageId (لنتمكن من التعامل معها في الواجهة)
    const roomMessages = messages[roomId] || [];
    // إرسال آخر 15 رسالة فقط لتسريع التحميل الأولي (يمكن للمستخدم تحميل المزيد)
    const initialMessages = roomMessages.slice(-15);
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
          avatar: userAvatars[msg.user] || DEFAULT_AVATAR_URL,
          nameBackground: msg.nameBackground,
          avatarFrame: msg.avatarFrame,
          nameCardBorder: msg.nameCardBorder,
          nameFont: msg.nameFont,
          badges: msg.badges
        };
      } else {
        return msg;
      }
    });

    socket.emit('chat history', formattedMessages);
});
  
  // حدث تحميل المزيد من الرسائل
  socket.on('load more messages', async (data) => {
    const { roomId, firstMessageId } = data;
    
    let targetTimestamp = 0;
    
    // محاولة العثور على الرسالة في الذاكرة للحصول على توقيتها
    if (messages[roomId]) {
        const refMsg = messages[roomId].find(m => m.messageId === firstMessageId);
        if (refMsg) {
            targetTimestamp = refMsg.timestamp;
        }
    }
    
    // إذا لم نجدها في الذاكرة، نحاول استخراج الوقت من المعرف
    if (!targetTimestamp && firstMessageId) {
        const parts = firstMessageId.split('_');
        if (parts.length >= 2) {
            const ts = parseInt(parts[1]);
            if (!isNaN(ts)) {
                targetTimestamp = ts;
            }
        }
    }
    
    if (!targetTimestamp) return;
    
    try {
        const limit = 25;
        
        // جلب الرسائل من قاعدة البيانات مباشرة
        const [textMessages, imageMessages] = await Promise.all([
            PrivateMessage.findAll({
                where: {
                    conversationId: roomId.toString(),
                    timestamp: { [Sequelize.Op.lt]: targetTimestamp }
                },
                order: [['timestamp', 'DESC']],
                limit: limit
            }),
            ChatImage.findAll({
                where: {
                    roomId: roomId,
                    timestamp: { [Sequelize.Op.lt]: targetTimestamp }
                },
                order: [['timestamp', 'DESC']],
                limit: limit
            })
        ]);

        const formatMsg = (msg, type) => ({
            type: type,
            messageId: type === 'image' ? msg.messageId : ('msg_' + msg.timestamp + '_' + msg.id),
            user: type === 'image' ? msg.fromUser : msg.fromUser,
            content: type === 'user' ? msg.content : undefined,
            imageData: type === 'image' ? msg.imageData : undefined,
            time: type === 'image' ? new Date(Number(msg.timestamp)).toLocaleTimeString('en-GB') : msg.time,
            timestamp: Number(msg.timestamp),
            rank: userRanks[msg.fromUser] || null,
            avatar: userAvatars[msg.fromUser] || DEFAULT_AVATAR_URL,
            badges: getUserBadges(msg.fromUser),
            nameBackground: users[msg.fromUser]?.nameBackground,
            avatarFrame: users[msg.fromUser]?.avatarFrame,
            nameCardBorder: users[msg.fromUser]?.nameCardBorder,
            nameFont: users[msg.fromUser]?.nameFont
        });

        const formattedTextMsgs = textMessages.map(m => formatMsg(m, 'user'));
        const formattedImageMsgs = imageMessages.map(m => formatMsg(m, 'image'));
        
        let allOlderMessages = [...formattedTextMsgs, ...formattedImageMsgs];
        
        // ترتيب تنازلي لأخذ أحدث 25 رسالة من القديمة
        allOlderMessages.sort((a, b) => b.timestamp - a.timestamp);
        allOlderMessages = allOlderMessages.slice(0, limit);
        
        // إعادة الترتيب تصاعدياً للعرض
        allOlderMessages.sort((a, b) => a.timestamp - b.timestamp);

        socket.emit('more chat history', allOlderMessages);
    } catch (error) {
        console.error('Error loading more messages:', error);
    }
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

    // --- منطق لعبة الاختباء (داخل send message) ---
    
    // 1. إيقاف اللعبة (جديد)
    if (message.includes('@رسائل النظام') && message.includes('ايقاف لعبة الاختباء')) {
        if (hideAndSeekState.active) {
            hideAndSeekState.active = false;
            hideAndSeekState.phase = 'idle';
            sendSystemGameMessage(roomId, '🛑 <strong>تم إيقاف لعبة الاختباء بنجاح.</strong>');
        }
    }
    // 2. بدء اللعبة
    else if (message.includes('@رسائل النظام') && message.includes('لعبة الاختباء')) {
        if (!hideAndSeekState.active) {
            if (guessGameState.active) {
                sendSystemGameMessage(roomId, '⚠️ <strong>عذراً!</strong> لا يمكن بدء لعبة الاختباء لأن "لعبة تخمين الرقم" قيد التشغيل حالياً.');
            } else {
                hideAndSeekState.active = true;
                setTimeout(() => {
                    // التحقق مرة أخرى في حال تم الإيقاف أثناء الانتظار
                    if (hideAndSeekState.active) {
                        startHideAndSeek(roomId);
                    }
                }, 5000);
            }
        } else {
            // يمكن إرسال رسالة أن اللعبة قائمة بالفعل
        }
    }

    // 2. التسجيل في اللعبة وإنهاء التسجيل
    if (hideAndSeekState.active && hideAndSeekState.phase === 'registration' && hideAndSeekState.roomId === roomId) {
        // التسجيل
        if (message.includes('@رسائل النظام') && message.includes('انا')) {
            const alreadyJoined = hideAndSeekState.participants.some(p => p.username === user.name);
            if (!alreadyJoined) {
                hideAndSeekState.participants.push({ username: user.name, chosenSpot: null, alive: true });
                // يمكن إضافة رد فعل بسيط أو تركه صامتاً حتى إعلان الأسماء
            }
        }

        // إنهاء التسجيل وبدء اللعبة عند قول "تم"
        if (message.includes('@رسائل النظام') && message.includes('تم')) {
            if (hideAndSeekState.participants.length === 0) {
                sendSystemGameMessage(roomId, '❌ لم يشارك أحد، تم إلغاء اللعبة.');
                hideAndSeekState.active = false;
                hideAndSeekState.phase = 'idle';
            } else {
                hideAndSeekState.phase = 'starting'; // منع انضمام المزيد من اللاعبين
                
                setTimeout(() => {
                    hideAndSeekState.initialCount = hideAndSeekState.participants.length;
                    const names = hideAndSeekState.participants.map(p => `<span class="text-blue-400">${p.username}</span>`).join('، ');
                    sendSystemGameMessage(roomId, `👥 المشاركون هم: ${names}`);
                    
                    setTimeout(() => {
                        nextHideAndSeekRound();
                    }, 5000);
                }, 5000);
            }
        }
    }

    // 4. منطق لعبة المقص (الجولة الحاسمة)
    if (hideAndSeekState.active && hideAndSeekState.phase === 'rps' && hideAndSeekState.roomId === roomId) {
        if (hideAndSeekState.pendingRPS.includes(user.name)) {
            const choice = message.trim();
            if (['حجرة', 'ورقة', 'مقص'].includes(choice)) {
                // اختيار القاتل
                const killerChoices = ['حجرة', 'ورقة', 'مقص'];
                const killerChoice = killerChoices[Math.floor(Math.random() * killerChoices.length)];
                
                let result = '';
                let survived = false;

                if (choice === killerChoice) {
                    result = 'تعادل (نجوت بأعجوبة!)';
                    survived = true;
                } else if (
                    (choice === 'حجرة' && killerChoice === 'مقص') ||
                    (choice === 'ورقة' && killerChoice === 'حجرة') ||
                    (choice === 'مقص' && killerChoice === 'ورقة')
                ) {
                    result = 'ربحت! (تركك تهرب)';
                    survived = true;
                } else {
                    result = 'خسرت! (تم القضاء عليك)';
                    survived = false;
                }

                // تحديث حالة اللاعب
                const playerIndex = hideAndSeekState.participants.findIndex(p => p.username === user.name);
                if (playerIndex !== -1 && !survived) {
                    hideAndSeekState.participants[playerIndex].alive = false;
                }

                // إزالة اللاعب من قائمة الانتظار
                hideAndSeekState.pendingRPS = hideAndSeekState.pendingRPS.filter(u => u !== user.name);

                // إرسال النتيجة
                const statusColor = survived ? 'text-green-400' : 'text-red-500';
                sendSystemGameMessage(roomId, `🎲 <strong>@${user.name}</strong> اختار: ${choice} | القاتل اختار: ${killerChoice}<br><span class="${statusColor} font-bold">${result}</span>`);

                // إذا انتهى الجميع من الاختيار
                if (hideAndSeekState.pendingRPS.length === 0) {
                    setTimeout(finalizeHideAndSeekRound, 2000);
                }
            }
        }
    }

    // 3. اختيار المكان (أثناء اللعب)
    if (hideAndSeekState.active && hideAndSeekState.phase === 'hiding' && hideAndSeekState.roomId === roomId) {
        const player = hideAndSeekState.participants.find(p => p.username === user.name && p.alive);
        if (player) {
            const choice = parseInt(message.trim());
            if (!isNaN(choice) && choice >= 1 && choice <= 10) {
                if (player.chosenSpot === null) {
                    player.chosenSpot = choice;
                    
                    // التحقق مما إذا اختار الجميع
                    const alivePlayers = hideAndSeekState.participants.filter(p => p.alive);
                    const allChosen = alivePlayers.every(p => p.chosenSpot !== null);
                    
                    if (allChosen) {
                        hideAndSeekState.phase = 'resolving'; // منع تغيير الاختيار
                        // انتظار 10 ثواني قبل إعلان إغلاق الاختيارات
                        setTimeout(() => {
                            sendSystemGameMessage(hideAndSeekState.roomId, '🔒 <strong>تم إغلاق الاختيارات!</strong> القاتل في طريقه...');
                            // انتظار 10 ثواني أخرى قبل كشف أماكن القاتل
                            setTimeout(() => {
                                resolveHideAndSeekRound();
                            }, 10000);
                        }, 10000);
                    }
                }
            }
        }
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

            const muteAnnouncement = { 
                type: 'system', 
                systemStatus: 'negative', 
                user: 'رسائل النظام', 
                avatar: BOT_AVATAR_URL, 
                content: `🔇 تم كتم المستخدم <strong class="text-white">${user.name}</strong> لمدة ${SPAM_MUTE_DURATION_MIN} دقائق بسبب تكرار الرسائل بهدف جمع النقاط بطريقة غير شرعية.`, 
                time: new Date().toLocaleTimeString('ar-SA') 
            };
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
    
    // تحديث الإنجازات
    await updateAchievementProgress(user.name, 'messages');
    
    // تحديث إنجاز "أسطورة الغرفة" (الأيام المتواصلة)
    const today = new Date().toISOString().split('T')[0];
    const userDaysAch = userAchievements[user.name]?.['room_legend'];
    if (!userDaysAch || (userDaysAch.lastUpdateDate !== today)) {
        let currentDays = userDaysAch ? userDaysAch.currentValue : 0;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (userDaysAch && userDaysAch.lastUpdateDate === yesterdayStr) {
            currentDays += 1;
        } else if (!userDaysAch || userDaysAch.lastUpdateDate !== today) {
            currentDays = 1;
        }
        
        await updateAchievementProgress(user.name, 'days', currentDays);
        // تخزين تاريخ آخر تحديث في الإنجاز نفسه ليس سهلاً بدون تعديل الجدول، 
        // لذا سنستخدم currentValue لتتبع الأيام ونتحقق من الوقت.
        // للتسهيل، سنفترض أن updateAchievementProgress يتعامل مع القيمة المرسلة كقيمة نهائية لـ 'days'
    }

    // تحديث إنجاز "اجتماعي" (التفاعل مع مستخدم آخر)
    // سنجلب مستخدماً عشوائياً من الغرفة للتفاعل معه (لتبسيط الأمر بدلاً من الجميع)
    const roomUsers = rooms.find(r => r.id === roomId)?.users || [];
    if (roomUsers.length > 1) {
        const otherUsers = roomUsers.filter(u => u !== user.name);
        if (otherUsers.length > 0) {
            const randomUser = otherUsers[Math.floor(Math.random() * otherUsers.length)];
            await updateAchievementProgress(user.name, 'interactions', 1, randomUser);
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
      avatar: userAvatars[user.name] || DEFAULT_AVATAR_URL,
      nameBackground: users[user.name]?.nameBackground,
      avatarFrame: users[user.name]?.avatarFrame,
      nameCardBorder: users[user.name]?.nameCardBorder,
      nameFont: users[user.name]?.nameFont,
      badges: getUserBadges(user.name)
    };
    
    if (!messages[roomId]) messages[roomId] = [];
    if (messages[roomId].length > 30) { // تقليل الحد الأقصى للرسائل في الذاكرة
      messages[roomId] = messages[roomId].slice(-30);
    }
    messages[roomId].push(newMessage);
    
    io.to(roomId).emit('new message', newMessage);

    // --- AI Bot Integration ---
    const aiMention = "@الذكاء الاصطناعي";
    if (message && message.includes(aiMention)) {
        const question = message.replace(aiMention, "").trim();
        if (question) {
            askAIBot(user.name, question).then(aiResponse => {
                const aiMessage = {
                    type: 'user',
                    roomId: roomId,
                    messageId: 'ai_' + Date.now(),
                    user: AI_BOT_CONFIG.name,
                    content: aiResponse,
                    time: new Date().toLocaleTimeString('en-GB'),
                    replyTo: {
                        messageId: messageId,
                        user: user.name,
                        content: message
                    },
                    timestamp: Date.now(),
                    gender: 'male',
                    rank: 'بوت الذكاء الاصطناعي',
                    avatar: AI_BOT_CONFIG.avatar,
                    nameBackground: '',
                    avatarFrame: ''
                };
                
                if (messages[roomId]) {
                    messages[roomId].push(aiMessage);
                    if (messages[roomId].length > 30) messages[roomId].shift();
                }
                io.to(roomId).emit('new message', aiMessage);
            });
        }
    }

    // --- System Welcome Mention ---
    const systemMention = "@رسائل النظام";
    if (message && message.includes(systemMention) && message.includes("ترحيب")) {
        setTimeout(() => {
            const welcomeMsg = {
                type: 'system',
                messageId: 'sys_welcome_' + Date.now(),
                user: 'رسائل النظام',
                content: 'منورين مرحبا بالزوار الجدد في موقع WalChat نتمنى لكم قضاء وقت سعيد',
                time: new Date().toLocaleTimeString('en-GB'),
                timestamp: Date.now(),
                rank: 'نظام',
                avatar: '/icon.png'
            };
            if (messages[roomId]) {
                messages[roomId].push(welcomeMsg);
                if (messages[roomId].length > 30) messages[roomId].shift();
            }
            io.to(roomId).emit('new message', welcomeMsg);
        }, 5000); // مهلة 5 ثواني
    }
    
    // --- لعبة تخمين الرقم ---
    if (message && message.includes(systemMention) && message.includes("ايقاف لعبة تخمين الرقم")) {
        if (guessGameState.active) {
            guessGameState.active = false;
            guessGameState.phase = 'idle';
            guessGameState.participants = {};
            sendSystemGameMessage(roomId, '🛑 <strong>تم إيقاف لعبة تخمين الرقم بنجاح.</strong>');
        }
    } else if (message && message.includes(systemMention) && message.includes("لعبة تخمين الرقم")) {
        if (!guessGameState.active) {
            if (hideAndSeekState.active) {
                sendSystemGameMessage(roomId, '⚠️ <strong>عذراً!</strong> لا يمكن بدء لعبة تخمين الرقم لأن "لعبة الاختباء" قيد التشغيل حالياً.');
            } else {
                guessGameState.active = true;
                guessGameState.phase = 'registration';
                guessGameState.roomId = roomId;
                guessGameState.participants = {};
                
                const startMsg = {
                    type: 'system',
                    user: 'رسائل النظام',
                    avatar: BOT_AVATAR_URL,
                    content: `🎮 <strong>بدأ التسجيل في لعبة تخمين الرقم!</strong><br>من يريد المشاركة يمنشنني ويقول "<strong>انا</strong>".<br>عند اكتمال العدد، قولوا "<strong>تم</strong>" لتبدأ اللعبة.`,
                    time: new Date().toLocaleTimeString('ar-SA')
                };
                io.to(roomId).emit('new message', startMsg);
                if (messages[roomId]) messages[roomId].push(startMsg);
            }
        }
    } 
    
    // مرحلة التسجيل وبدء اللعبة
    if (guessGameState.active && guessGameState.phase === 'registration' && guessGameState.roomId === roomId) {
        if (message.includes(systemMention) && message.includes('انا')) {
            if (!guessGameState.participants[user.name]) {
                guessGameState.participants[user.name] = { attempts: 0, eliminated: false };
                // يمكن إضافة رد فعل أو رسالة تأكيد هنا إذا رغبت
            }
        }
        
        if (message.includes('تم')) {
            const playerCount = Object.keys(guessGameState.participants).length;
            if (playerCount > 0) {
                guessGameState.phase = 'playing';
                guessGameState.target = Math.floor(Math.random() * 101); // 0 to 100
                guessGameState.totalAttempts = 0;
                
                const playersList = Object.keys(guessGameState.participants).join('، ');
                const startMsg = {
                    type: 'system',
                    user: 'رسائل النظام',
                    avatar: BOT_AVATAR_URL,
                    content: `🚀 <strong>انطلقت اللعبة!</strong><br>المشاركون: [ ${playersList} ]<br>لقد اخترت رقماً بين 0 و 100.<br>⚠️ <strong>تنبيه:</strong> لكل لاعب 20 محاولة فقط!`,
                    time: new Date().toLocaleTimeString('ar-SA')
                };
                io.to(roomId).emit('new message', startMsg);
                if (messages[roomId]) messages[roomId].push(startMsg);
            } else {
                sendSystemGameMessage(roomId, '❌ لم يسجل أحد، تم إلغاء اللعبة.');
                guessGameState.active = false;
            }
        }
    }

    // مرحلة اللعب (التخمين)
    else if (guessGameState.active && guessGameState.phase === 'playing' && guessGameState.roomId === roomId) {
        // التحقق من أن المستخدم مشارك ولم يتم إقصاؤه
        const participant = guessGameState.participants[user.name];
        if (!participant || participant.eliminated) return;

        // التحقق من التخمين (إذا كانت الرسالة رقماً فقط)
        const guess = parseInt(message.trim());
        if (!isNaN(guess) && String(guess) === message.trim()) {
            
            // زيادة عدد المحاولات
            participant.attempts++;
            
            let replyContent = '';
            let isWin = false;
            let isEliminated = false;
            
            if (guess === guessGameState.target) {
                isWin = true;
                replyContent = `🎉 <strong>إجابة صحيحة!</strong> الرقم هو ${guessGameState.target}.<br>مبروك <strong class="text-yellow-300">@${user.name}</strong> لقد فزت بـ 300 نقطة! (من المحاولة ${participant.attempts})`;
                
                // منح النقاط للفائز
                if (!userPoints[user.name]) userPoints[user.name] = { points: 0, level: 1 };
                userPoints[user.name].points += 300;
                await saveUserPoints(user.name, userPoints[user.name].points, userPoints[user.name].level);
                
                guessGameState.active = false; // إيقاف اللعبة
            } else {
                guessGameState.totalAttempts++;

                if (participant.attempts >= guessGameState.maxAttempts) {
                    participant.eliminated = true;
                    isEliminated = true;
                    replyContent = `💀 <strong>@${user.name}</strong> لقد استنفذت جميع محاولاتك الـ 20! تم إقصاؤك من اللعبة.`;
                } else if (guess < guessGameState.target) {
                    replyContent = `📉 الرقم <strong>أكبر</strong> من ${guess} يا <strong class="text-white">@${user.name}</strong> (محاولة ${participant.attempts}/20)`;
                } else {
                    replyContent = `📈 الرقم <strong>أصغر</strong> من ${guess} يا <strong class="text-white">@${user.name}</strong> (محاولة ${participant.attempts}/20)`;
                }

                if (guessGameState.totalAttempts % 10 === 0) {
                    const isEven = guessGameState.target % 2 === 0;
                    const hintType = isEven ? 'زوجي' : 'فردي';
                    setTimeout(() => {
                        const hintMsg = {
                            type: 'system',
                            user: 'رسائل النظام',
                            avatar: BOT_AVATAR_URL,
                            content: `💡 <strong>تلميح:</strong> بعد ${guessGameState.totalAttempts} محاولة خاطئة، الرقم المطلوب هو عدد <strong>${hintType}</strong>!`,
                            time: new Date().toLocaleTimeString('ar-SA'),
                            systemStatus: 'neutral'
                        };
                        io.to(roomId).emit('new message', hintMsg);
                        if (messages[roomId]) messages[roomId].push(hintMsg);
                    }, 1000);
                }
            }
            
            const gameMsg = {
                type: 'system',
                user: 'رسائل النظام',
                avatar: BOT_AVATAR_URL,
                content: replyContent,
                time: new Date().toLocaleTimeString('ar-SA'),
                systemStatus: isWin ? 'positive' : (isEliminated ? 'negative' : 'neutral')
            };
            
            // إرسال الرد بعد تأخير بسيط
            setTimeout(() => {
                 io.to(roomId).emit('new message', gameMsg);
                 if (messages[roomId]) messages[roomId].push(gameMsg);
            }, 500);
        }
    }

    // التحقق من إجابة المسابقة
    if (quizState.active && quizState.isWaitingForAnswer && roomId === quizState.roomId && message) {
        const cleanMessage = message.trim().toLowerCase();
        const botMention = "@رسائل النظام";
        
        // التحقق مما إذا كانت الإجابة موجودة في الرسالة
        let isCorrect = false;
        const answer = quizState.currentAnswer.toLowerCase().trim();
        
        if (cleanMessage.includes(answer)) {
            // التأكد من أن الإجابة ليست مجرد جزء من كلمة أخرى (اختياري ولكن أفضل للدقة)
            // في حالتنا سنكتفي بـ includes كما طلبت ليكون البوت مرناً
            isCorrect = true;
        } else if (cleanMessage.includes(botMention.toLowerCase())) {
            const textWithoutMention = cleanMessage.replace(botMention.toLowerCase(), "").trim();
            if (textWithoutMention.includes(answer)) {
                isCorrect = true;
            }
        }

        if (isCorrect) {
            quizState.isWaitingForAnswer = false;
            // إلغاء مؤقت "لم يجب أحد"
            if (quizState.answerTimer) {
                clearTimeout(quizState.answerTimer);
                quizState.answerTimer = null;
            }
            
            // منح النقاط
            if (!userPoints[user.name]) {
                userPoints[user.name] = { points: 0, level: 1 };
            }
            userPoints[user.name].points += 200;
            await saveUserPoints(user.name, userPoints[user.name].points, userPoints[user.name].level);

            // الانتظار 5 ثواني قبل إعلان الفائز
            setTimeout(() => {
                const winMessage = {
                    type: 'system',
                    systemStatus: 'positive', // إجابة صحيحة باللون الأخضر
                    user: 'بوت المسابقات',
                    avatar: BOT_AVATAR_URL,
                    content: `🎉 إجابة صحيحة! <strong class="text-white">${user.name}</strong> حصل على 200 نقطة. الإجابة هي: <strong class="text-yellow-300">${quizState.currentAnswer}</strong>\n\n🔄 السؤال القادم بعد 30 ثانية...`,
                    time: new Date().toLocaleTimeString('ar-SA')
                };
                io.to(roomId).emit('new message', winMessage);
                if (messages[roomId]) messages[roomId].push(winMessage);

                // جدولة السؤال التالي بعد 30 ثانية من إعلان الفوز
                if (quizState.timer) clearTimeout(quizState.timer);
                quizState.timer = setTimeout(askQuizQuestion, 30000);
            }, 5000);
        }
    }
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
      // الحذف تماماً عند الضغط على زر خروج
      room.users = room.users.filter(u => u.name !== user.name);
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
    broadcastRoomsUpdate();
    io.to(room.id).emit('users update', room.users);
    
    // إرسال إشعار للجميع
    const rankInfo = ranks[rank];
    const iconHtml = getRankIconHtml(rankInfo.icon);
    const notificationMessage = {
      type: 'system',
      systemStatus: 'positive', // منح رتبة باللون الأخضر
      user: 'رسائل النظام',
      avatar: BOT_AVATAR_URL,
      content: `👑 تم منح رتبة ${iconHtml} ${rank} للمستخدم ${username} من قبل ${currentUser.name}`, 
      time: new Date().toLocaleTimeString('en-GB')
    };
    
    // إرسال الإشعار للغرفة الحالية فقط
    io.to(room.id).emit('new message', notificationMessage);
    if (messages[room.id]) messages[room.id].push(notificationMessage);
    
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
      broadcastRoomsUpdate();
      io.to(room.id).emit('users update', room.users);
      
      const notificationMessage = {
        type: 'system',
        systemStatus: 'negative', // إزالة رتبة باللون الأحمر
        user: 'رسائل النظام',
        avatar: BOT_AVATAR_URL, 
        content: `👑 تم إزالة رتبة ${oldRank} من المستخدم ${username} من قبل ${currentUser.name}`, 
        time: new Date().toLocaleTimeString('en-GB')
      };
      
      // إرسال الإشعار للغرفة الحالية فقط
      io.to(room.id).emit('new message', notificationMessage);
      if (messages[room.id]) messages[room.id].push(notificationMessage);
      
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
    const userRoomId = onlineUsers[socket.id]?.roomId;
    
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
      systemStatus: 'negative',
      user: 'رسائل النظام',
      avatar: BOT_AVATAR_URL, 
      content: `🔇 تم كتم المستخدم ${username} لمدة ${duration} دقيقة من قبل ${currentUser.name} (في جميع الغرف)`, 
      time: new Date().toLocaleTimeString('en-GB')
    };
    
    if (userRoomId) {
        io.to(userRoomId).emit('new message', notificationMessage);
        if (messages[userRoomId]) messages[userRoomId].push(notificationMessage);
    }
    
    socket.emit('management success', `تم كتم المستخدم ${username} في جميع الغرف بنجاح`);
  });

  socket.on('unmute user', async (data) => {
    const { username, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    
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
        systemStatus: 'positive',
        user: 'رسائل النظام',
        avatar: BOT_AVATAR_URL, 
        content: `🔊 تم إلغاء كتم المستخدم ${username} من قبل ${currentUser.name} (في جميع الغرف)`, 
        time: new Date().toLocaleTimeString('en-GB')
      };
      
      if (userRoomId) {
          io.to(userRoomId).emit('new message', notificationMessage);
          if (messages[userRoomId]) messages[userRoomId].push(notificationMessage);
      }
      
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
      systemStatus: 'negative',
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
        systemStatus: 'positive',
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
      systemStatus: 'negative',
      user: 'رسائل النظام',
      avatar: BOT_AVATAR_URL, 
      content: `⛔ تم حظر المستخدم ${username} من الموقع بالكامل من قبل ${currentUser.name}. السبب: ${reason || 'غير محدد'}`, 
      time: new Date().toLocaleTimeString('en-GB')
    };
    
    if (userRoomId) {
        io.to(userRoomId).emit('new message', notificationMessage);
        if (messages[userRoomId]) messages[userRoomId].push(notificationMessage);
    }
    
    socket.emit('management success', `تم حظر المستخدم ${username} من الموقع بنجاح`);
  });

  socket.on('unban from site', async (data) => {
    const { username, currentUser } = data;
    const userRoomId = onlineUsers[socket.id]?.roomId;
    
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
        systemStatus: 'positive',
        user: 'رسائل النظام',
        avatar: BOT_AVATAR_URL, 
        content: `🌐 تم إلغاء حظر المستخدم ${username} من الموقع بالكامل من قبل ${currentUser.name}`, 
        time: new Date().toLocaleTimeString('en-GB')
      };
      
      if (userRoomId) {
          io.to(userRoomId).emit('new message', notificationMessage);
          if (messages[userRoomId]) messages[userRoomId].push(notificationMessage);
      }
      
      socket.emit('management success', `تم إلغاء حظر المستخدم ${username} من الموقع بنجاح`);
    } else {
      socket.emit('management error', 'المستخدم غير محظور من الموقع');
    }
  });

  socket.on('warn user', async (data) => {
    const { username, reason, currentUser } = data;
    
    if (!canManageTargetUser(currentUser, username)) {
      socket.emit('management error', 'عذراً، لا يمكنك تحذير هذا المستخدم لأن رتبته مساوية أو أعلى منك.');
      return;
    }

    if (username === SITE_OWNER.username) {
      socket.emit('management error', 'لا يمكن تحذير صاحب الموقع');
      return;
    }

    const warningData = {
      from: currentUser.name,
      reason: reason || 'غير محدد',
      timestamp: Date.now()
    };

    // إرسال التحذير للمستخدم المستهدف إذا كان متصلاً
    const targetSocketId = Object.keys(onlineUsers).find(
      socketId => onlineUsers[socketId].name === username
    );

    if (targetSocketId) {
      io.to(targetSocketId).emit('user warned', warningData);
    }

    // إرسال رسالة في الشات العام (أو الغرفة الحالية) لإعلام الجميع بالتحذير
    const userRoomId = onlineUsers[socket.id]?.roomId;
    if (userRoomId) {
      const notificationMessage = {
        type: 'system',
        systemStatus: 'negative',
        user: 'رسائل النظام',
        avatar: BOT_AVATAR_URL,
        content: `⚠️ تم توجيه تحذير للمستخدم <strong class="text-white">${username}</strong> من قبل ${currentUser.name}. السبب: ${warningData.reason}`,
        time: new Date().toLocaleTimeString('en-GB')
      };
      io.to(userRoomId).emit('new message', notificationMessage);
      if (messages[userRoomId]) messages[userRoomId].push(notificationMessage);
    }

    socket.emit('management success', `تم إرسال تحذير للمستخدم ${username} بنجاح`);
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
        systemStatus: 'negative', // حذف المستخدم باللون الأحمر
        user: 'رسائل النظام',
        avatar: BOT_AVATAR_URL, 
        content: `🗑️ تم حذف المستخدم ${username} من قبل ${currentUser.name}`, 
        time: new Date().toLocaleTimeString('en-GB')
      };
      
      if (userRoomId) {
          io.to(userRoomId).emit('new message', notificationMessage);
          if (messages[userRoomId]) messages[userRoomId].push(notificationMessage);
      }
      
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
    
    // السماح بتعديل الصورة إذا كان المستخدم يعدل صورته الخاصة أو كان في غرفة الإدارة ولديه صلاحية
    const canEdit = (username === currentUser.name) || 
                   (room && room.name === 'غرفة الإدارة' && canManageTargetUser(currentUser, username));
    
    if (!canEdit) {
      socket.emit('avatar error', 'ليس لديك صلاحية لتعديل هذه الصورة');
      return;
    }
    
    if (avatarUrl === null) {
      delete userAvatars[username];
      await UserAvatar.destroy({ where: { username } });
    } else {
      userAvatars[username] = avatarUrl;
      await saveUserAvatar(username, avatarUrl);
    }
    
    const finalAvatarUrl = avatarUrl || DEFAULT_AVATAR_URL;
    
    // تحديث الصورة للمستخدمين المتصلين
    Object.keys(onlineUsers).forEach(socketId => {
      if (onlineUsers[socketId].name === username) {
        onlineUsers[socketId].avatar = finalAvatarUrl;
      }
    });
    
    // تحديث الصورة في الغرف
    rooms.forEach(r => {
      r.users.forEach(u => {
        if (u.name === username) {
          u.avatar = finalAvatarUrl;
        }
      });
    });
    
    // إرسال تحديث الغرف والمستخدمين
    broadcastRoomsUpdate();
    if (room) {
      io.to(room.id).emit('users update', room.users);
    }
    
    socket.emit('avatar updated', { username, avatarUrl: finalAvatarUrl });
    io.emit('user avatar updated', { username, avatarUrl: finalAvatarUrl });
  });

  socket.on('get avatar', (username) => {
    socket.emit('avatar data', { username, avatarUrl: userAvatars[username] || DEFAULT_AVATAR_URL });
  });

  // أحداث الرسائل الخاصة
  socket.on('get user profile', async (data) => {
    const username = typeof data === 'string' ? data : data.username;
    const isInventoryRequest = typeof data === 'object' ? data.isInventoryRequest : false;

    if (!username) return;

    // تحميل البيانات الكبيرة عند الطلب إذا لم تكن موجودة في الذاكرة
    if (users[username] && (users[username].bio === undefined || users[username].profileCover === undefined)) {
        try {
            const dbUser = await User.findByPk(username, { attributes: ['bio', 'profileCover'] });
            if (dbUser) {
                if (users[username].bio === undefined) users[username].bio = dbUser.bio || null;
                if (users[username].profileCover === undefined) users[username].profileCover = dbUser.profileCover || null;
            }
        } catch (err) {
            console.error(`Error fetching extra profile data for ${username}:`, err);
        }
    }

    // تحميل الصورة الرمزية عند الطلب إذا لم تكن موجودة في الذاكرة (بسبب حجمها مثلاً)
    if (!userAvatars[username]) {
        try {
            const dbAvatar = await UserAvatar.findByPk(username);
            if (dbAvatar) {
                userAvatars[username] = dbAvatar.avatarUrl;
            }
        } catch (err) {
            console.error(`Error fetching avatar for ${username}:`, err);
        }
    }

    const isOnline = Object.values(onlineUsers).some(user => user.name === username);
    const onlineUser = Object.values(onlineUsers).find(user => user.name === username);
    const lastSeen = isOnline ? null : userLastSeen[username] || null;
    const userRank = userRanks[username] || (onlineUser ? onlineUser.rank : null);
    let avatar = userAvatars[username] || DEFAULT_AVATAR_URL;
    // تعديل رئيسي: جلب المستخدم دائمًا من قاعدة البيانات لضمان الحصول على أحدث البيانات
    const userData = await User.findByPk(username);
    if (!userData) return; // إيقاف التنفيذ إذا لم يتم العثور على المستخدم

    // مزامنة الكاش المحلي مع قاعدة البيانات لضمان أن إعدادات مثل خلفية الانضمام تتحدث فورياً
    if (users[username]) {
        users[username].joinMessageBackground = userData.joinMessageBackground || null;
    }

    const pointsData = userPoints[username] || { points: 0, level: 1 };

    // حساب ترتيب XP إذا كان من العشرة الأوائل
    let xpRank = null;
    try {
      const topXPUsers = await UserPoints.findAll({
        order: [['xp', 'DESC']],
        limit: 10,
        attributes: ['username']
      });
      const rankIndex = topXPUsers.findIndex(u => u.username === username);
      if (rankIndex !== -1) xpRank = rankIndex + 1;
    } catch (err) {
      console.error('Error calculating XP rank:', err);
    }

    // حساب ترتيب الأقدمية (Oldest Rank)
    let oldestRank = null;
    try {
        const userCreatedAt = users[username]?.createdAt;
        if (userCreatedAt) {
            const count = await User.count({
                where: {
                    createdAt: { [Sequelize.Op.lt]: userCreatedAt }
                }
            });
            oldestRank = count + 1;
        }
    } catch (err) {
        console.error('Error calculating Oldest rank:', err);
    }

    // حساب ترتيب التفاعل (Interaction Rank)
    let interactionRank = null;
    try {
        const score = pointsData.interactionScore || 0;
        const count = await UserPoints.count({
            where: { interactionScore: { [Sequelize.Op.gt]: score } }
        });
        interactionRank = count + 1;
    } catch (err) {
        console.error('Error calculating Interaction rank:', err);
    }

    // جلب قائمة الأصدقاء مع تفاصيلهم
    const friendsList = userFriends[username] || [];
    const friendsDetails = friendsList.map(fName => ({
        username: fName,
        avatar: userAvatars[fName] || DEFAULT_AVATAR_URL,
        isOnline: Object.values(onlineUsers).some(u => u.name === fName)
    }));

    // جلب الإنجازات
    const userAchs = userAchievements[username] || {};
    const achievementsList = Object.values(achievements).map(ach => ({
        id: ach.id,
        name: ach.name,
        description: ach.description,
        icon: ach.icon,
        targetValue: ach.targetValue,
        type: ach.type,
        cardColor: ach.cardColor,
        currentValue: userAchs[ach.id] ? userAchs[ach.id].currentValue : 0,
        completed: userAchs[ach.id] ? userAchs[ach.id].completed : false,
        completedAt: userAchs[ach.id] ? userAchs[ach.id].completedAt : null
    }));

    // جلب المخزون مع تفاصيل العناصر
    const userInv = userInventories[username] || [];
    const inventoryWithDetails = userInv.map(inv => {
        const item = shopItems.find(si => si.id === inv.itemId);
        let itemType = item ? item.itemType : 'unknown';
        
        // تحويل الأنواع إلى camelCase للاتساق مع الواجهة الأمامية
        if (itemType === 'avatar_frame') itemType = 'avatarFrame';
        if (itemType === 'join_message_bg') itemType = 'joinMessageBackground';
        if (itemType === 'name_color') itemType = 'nameColor';
        if (itemType === 'name_font') itemType = 'nameFont';
        if (itemType === 'name_background') itemType = 'nameBackground';
        if (itemType === 'user_card_background') itemType = 'userCardBackground';
        if (itemType === 'profile_background') itemType = 'profileBackground';
        if (itemType === 'name_card_border') itemType = 'nameCardBorder';

        return {
            id: inv.id,
            itemId: inv.itemId,
            name: item ? item.name : 'عنصر غير معروف',
            type: itemType,
            value: item ? item.itemValue : null,
            description: item ? item.description : ''
        };
    });

    socket.emit('user profile data', {
        username,
        isOnline,
        lastSeen,
        rank: userRank,
        avatar,
        gender: userData ? userData.gender : (onlineUser ? onlineUser.gender : null),
        bio: userData ? userData.bio : null,
        points: pointsData.points,
        level: pointsData.level,
        nameColor: userData ? userData.nameColor : null,
        nameBackground: userData ? userData.nameBackground : null,
        avatarFrame: userData ? userData.avatarFrame : null,
        userCardBackground: userData ? userData.userCardBackground : null,
        profileBackground: userData ? userData.profileBackground : null,
        profileCover: userData ? userData.profileCover : null,
        nameCardBorder: userData ? userData.nameCardBorder : null,
        nameFont: userData ? userData.nameFont : null,
        joinMessageBackground: userData ? userData.joinMessageBackground : null,
        status: userData ? userData.status : null,
        country: userData ? userData.country : null,
        age: userData ? userData.age : null,
        rankExpiry: userRankExpiry[username] || null, // إرسال تاريخ انتهاء الرتبة
        interactionScore: pointsData.interactionScore || 0, // درجة التفاعل
        xp: pointsData.xp || 0, // نقاط الخبرة
        xpRank: xpRank, // ترتيب XP
        oldestRank: oldestRank, // ترتيب الأقدمية
        interactionRank: interactionRank, // ترتيب التفاعل
        createdAt: userData ? userData.createdAt : null, // تاريخ الانضمام
        friends: friendsDetails,
        achievements: achievementsList,
        inventory: inventoryWithDetails,
        isInventoryRequest
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
        
        broadcastRoomsUpdate();
        
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
            const premiumFrames = ['frame-crown-gold', 'frame-crown-rainbow'];
            if (premiumFrames.includes(value)) {
                const owned = getOwnedItems(username);
                if (!owned.includes(value)) {
                    socket.emit('feature error', 'يجب شراء هذا الإطار من المتجر أولاً.');
                    return;
                }
            }
            await User.update({ avatarFrame: value }, { where: { username } });
            users[username].avatarFrame = value;
        } else if (feature === 'userCardBackground') {
            await User.update({ userCardBackground: value }, { where: { username } });
            users[username].userCardBackground = value;
        } else if (feature === 'profileBackground') {
            await User.update({ profileBackground: value }, { where: { username } });
            users[username].profileBackground = value;
        } else if (feature === 'nameFont') {
            await User.update({ nameFont: value }, { where: { username } });
            users[username].nameFont = value;
        } else if (feature === 'nameCardBorder') {
            // التحقق من أن المستخدم يملك الإنجاز الذي يعطي هذا اللون
            // تحميل الإنجازات مباشرة من قاعدة البيانات إذا لم تكن في الذاكرة
            let userAchs = userAchievements[username];
            if (!userAchs || Object.keys(userAchs).length === 0) {
                const dbUserAchs = await UserAchievement.findAll({ where: { username } });
                userAchs = {};
                dbUserAchs.forEach(ua => {
                    userAchs[ua.achievementId] = ua.get({ plain: true });
                });
                userAchievements[username] = userAchs;
            }

            const unlockedColors = Object.values(achievements)
                .filter(ach => {
                    const userAch = userAchs[ach.id];
                    return userAch && (userAch.completed === true || userAch.completed === 1 || userAch.completed === '1');
                })
                .map(ach => ach.cardColor ? ach.cardColor.toLowerCase() : null)
                .filter(c => c !== null);

            // استخراج اللون من الصيغة border-color:#xxxxxx
            let colorToCheck = value;
            if (value && value.startsWith('border-color:')) {
                colorToCheck = value.split(':')[1];
            }
            
            if (colorToCheck) colorToCheck = colorToCheck.toLowerCase();

            if (colorToCheck && colorToCheck !== null && colorToCheck !== '' && !unlockedColors.includes(colorToCheck)) {
                socket.emit('feature error', 'عذراً، يجب عليك تحقيق الإنجاز الخاص بهذا اللون أولاً.');
                return;
            }

            console.log(`جاري تحديث nameCardBorder للمستخدم ${username} إلى: ${value}`);
            await User.update({ nameCardBorder: value }, { where: { username } });
            users[username].nameCardBorder = value;
        }

        // تحديث المستخدمين المتصلين والغرف ليعكس التغيير فوراً
        Object.keys(onlineUsers).forEach(id => {
            if (onlineUsers[id].name === username) onlineUsers[id][feature] = value;
        });

        // تحديث بيانات المستخدم في جميع الغرف المتواجد فيها
        rooms.forEach(r => {
            if (r.users) {
                let userFoundInRoom = false;
                r.users.forEach(u => {
                    if (u.name === username) {
                        u[feature] = value;
                        userFoundInRoom = true;
                    }
                });
                if (userFoundInRoom) {
                    io.to(r.id).emit('users update', r.users);
                }
            }
        });
        
        socket.emit('feature success', 'تم تحديث الميزة بنجاح');
        // نرسل تحديث الغرف لتحديث القوائم
        broadcastRoomsUpdate();
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
        socket.emit('cover success', { message: 'تم تحديث غلاف الملف الشخصي بنجاح.', coverUrl });
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

  socket.on('update user details', async (data) => {
    const { username, bio, status, country, age, currentUser } = data;

    if (currentUser.name !== username) {
        socket.emit('update details error', 'لا يمكنك تحديث معلومات مستخدم آخر.');
        return;
    }

    // التحقق من طول النص
    if (bio && bio.length > 500) {
        socket.emit('update details error', 'المعلومات الشخصية يجب أن لا تتجاوز 500 حرف.');
        return;
    }
    if (status && status.length > 200) {
        socket.emit('update details error', 'الحالة يجب أن لا تتجاوز 200 حرف.');
        return;
    }
 
    if (users[username]) {
        try {
            const updateData = { bio };
            if (status !== undefined) updateData.status = status;
            if (country !== undefined) updateData.country = country;
            if (age !== undefined) updateData.age = age ? parseInt(age) : null;

            await User.update(updateData, { where: { username } });
            
            // تحديث الذاكرة
            users[username].bio = bio;
            if (status !== undefined) users[username].status = status;
            if (country !== undefined) users[username].country = country;
            if (age !== undefined) users[username].age = updateData.age;

            // تحديث المستخدمين المتصلين والغرف
            Object.keys(onlineUsers).forEach(id => {
                if (onlineUsers[id].name === username) {
                    if (status !== undefined) onlineUsers[id].status = status;
                    if (country !== undefined) onlineUsers[id].country = country;
                    if (age !== undefined) onlineUsers[id].age = updateData.age;
                }
            });
            
            // تحديث بيانات المستخدم في الغرف (للقوائم الجانبية)
            rooms.forEach(r => {
                if (r.users) {
                    r.users.forEach(u => {
                        if (u.name === username) {
                            if (status !== undefined) u.status = status;
                            if (country !== undefined) u.country = country;
                            if (age !== undefined) u.age = updateData.age;
                        }
                    });
                }
            });

            broadcastRoomsUpdate();
            socket.emit('update details success', { 
                message: 'تم تحديث معلوماتك بنجاح.',
                status: status,
                country: country,
                age: updateData.age
            });
        } catch (error) {
            console.error('خطأ في تحديث معلومات المستخدم:', error);
            socket.emit('update details error', 'حدث خطأ أثناء تحديث المعلومات.');
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
      avatar: userAvatars[fromUser] || DEFAULT_AVATAR_URL
    };
    
    privateMessages[conversationId].push(privateMessage);
    await savePrivateMessage(conversationId, fromUser, toUser, message, privateMessage.time, privateMessage.timestamp);
    
    // إرسال الرسالة للمرسل
    socket.emit('private message sent', privateMessage);
    
    // إرسال الرسالة للمستلم
    io.to(toUser).emit('new private message', privateMessage);
    // إرسال حدث لتحديث قائمة المحادثات للمستلم
    io.to(toUser).emit('get unread counts', toUser);
    io.to(toUser).emit('private conversations updated');
    
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
  
  try {
    // جلب الرسائل النصية من قاعدة البيانات باستخدام المعرف الموحد للأداء العالي
    const dbTextMessages = await PrivateMessage.findAll({
      where: {
        [Sequelize.Op.or]: [
          { conversationId: conversationId },
          { fromUser: currentUser, toUser: otherUser },
          { fromUser: otherUser, toUser: currentUser }
        ]
      },
      order: [['timestamp', 'DESC']],
      limit: 50 // تقليل الحد لزيادة السرعة
    });

    const textMessages = dbTextMessages.map(msg => ({
      from: msg.fromUser,
      to: msg.toUser,
      content: msg.content,
      time: msg.time,
      timestamp: Number(msg.timestamp),
      avatar: userAvatars[msg.fromUser] || DEFAULT_AVATAR_URL
    })).reverse();
    
    // جلب الصور من قاعدة البيانات للمحادثة الخاصة
    const imagesData = await ChatImage.findAll({
      where: {
        [Sequelize.Op.or]: [
          { conversationId: conversationId },
          { fromUser: currentUser, toUser: otherUser },
          { fromUser: otherUser, toUser: currentUser }
        ]
      },
      order: [['timestamp', 'DESC']],
      limit: 20 // تقليل الحد للصور لزيادة السرعة
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
      avatar: userAvatars[image.fromUser] || DEFAULT_AVATAR_URL
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
      // جلب آخر 500 رسالة لتحسين الأداء بشكل كبير
      const conversations = await PrivateMessage.findAll({
        where: {
          [Sequelize.Op.or]: [{ fromUser: username }, { toUser: username }]
        },
        order: [['timestamp', 'DESC']],
        limit: 500
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
        },
        distinct: true,
        col: 'fromUser'
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
    const friendsData = friends.map(friendName => ({
        username: friendName,
        avatar: userAvatars[friendName] || null,
        isOnline: Object.values(onlineUsers).some(u => u.name === friendName),
        lastSeen: userLastSeen[friendName] || null
    }));
    socket.emit('friends list', friendsData);
  });

  socket.on('get initial data', async (username) => {
    try {
      const [unreadMessagesCount, unreadNotificationsCount] = await Promise.all([
        PrivateMessage.count({ 
            where: { toUser: username, read: false },
            distinct: true,
            col: 'fromUser'
        }),
        Notification.count({ where: { recipientUsername: username, read: false } })
      ]);
      
      socket.emit('initial data', {
        friendRequests: friendRequests[username] || [],
        friendsList: (userFriends[username] || []).map(friendName => ({
            username: friendName,
            avatar: userAvatars[friendName] || null,
            isOnline: Object.values(onlineUsers).some(u => u.name === friendName),
            lastSeen: userLastSeen[friendName] || null
        })),
        unreadCounts: { privateMessages: unreadMessagesCount, notifications: unreadNotificationsCount },
        userAvatars: userAvatars
      });
    } catch (error) {
      console.error('خطأ في جلب البيانات الأولية:', error);
      socket.emit('initial data', {
        friendRequests: friendRequests[username] || [],
        friendsList: (userFriends[username] || []).map(friendName => ({
            username: friendName,
            avatar: userAvatars[friendName] || null,
            isOnline: Object.values(onlineUsers).some(u => u.name === friendName),
            lastSeen: userLastSeen[friendName] || null
        })),
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
          systemStatus: 'positive', // تعيين مدير باللون الأخضر
          user: 'رسائل النظام',
          avatar: BOT_AVATAR_URL,
          content: `👮 تم تعيين ${managerUsername} كمدير لغرفة ${room.name} من قبل ${currentUser.name}`,
          time: new Date().toLocaleTimeString('ar-SA')
        };

        io.to(roomId).emit('new message', notificationMessage);
        messages[roomId] = messages[roomId] || [];
        messages[roomId].push(notificationMessage);
        broadcastRoomsUpdate();

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
          systemStatus: 'negative', // إزالة مدير باللون الأحمر
          user: 'رسائل النظام',
          avatar: BOT_AVATAR_URL,
          content: `👮 تم إزالة ${managerUsername} من منصب مدير غرفة ${room.name} من قبل ${currentUser.name}`,
          time: new Date().toLocaleTimeString('ar-SA')
        };

        io.to(roomId).emit('new message', notificationMessage);
        messages[roomId] = messages[roomId] || [];
        messages[roomId].push(notificationMessage);
        broadcastRoomsUpdate();

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

      // تحديث وصف الغرفة في جدول الغرف أيضاً ليظهر في الخارج
      if (description) {
        await Room.update({ description }, { where: { id: roomIdInt } });
        room.description = description;
      }

      roomSettings[roomIdInt] = {
        description: description || room.description,
        textColor: textColor || 'text-white',
        messageBackground: messageBackground || 'bg-gray-800'
      };

      room.settings = roomSettings[roomIdInt];
      broadcastRoomsUpdate();
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
      broadcastRoomsUpdate();
      io.emit('management success', 'تم تحديث خلفية الغرفة بنجاح');
    } catch (error) {
      socket.emit('management error', 'حدث خطأ في تحديث الخلفية');
      console.error('Error updating room background:', error);
    }
  });
// حدث جديد: تزويد عنصر من المخزون
  socket.on('equip item', async (data) => {
    const { inventoryId, currentUser } = data;
    const username = currentUser.name || currentUser.username;

    if (!username) return;

    const userInv = userInventories[username] || [];
    const invItem = userInv.find(i => i.id === inventoryId);

    if (!invItem) {
        return socket.emit('equip error', 'العنصر غير موجود في مخزونك.');
    }

    const shopItem = shopItems.find(i => i.id === invItem.itemId);
    if (!shopItem) {
        return socket.emit('equip error', 'العنصر لم يعد متوفراً في المتجر.');
    }

    // لا يمكن تزويد الرتب من هنا
    if (shopItem.itemType === 'rank') {
        return socket.emit('equip error', 'يتم تفعيل الرتب تلقائياً عند الشراء.');
    }

    // تطبيق الميزة مع تحويل نوع العنصر لاسم الحقل في قاعدة البيانات إذا لزم الأمر
    let fieldName = shopItem.itemType;
    if (fieldName === 'avatar_frame') fieldName = 'avatarFrame';
    if (fieldName === 'join_message_bg') fieldName = 'joinMessageBackground';
    if (fieldName === 'name_color') fieldName = 'nameColor';
    if (fieldName === 'name_font') fieldName = 'nameFont';
    if (fieldName === 'name_background') fieldName = 'nameBackground';
    if (fieldName === 'user_card_background') fieldName = 'userCardBackground';
    if (fieldName === 'profile_background') fieldName = 'profileBackground';
    if (fieldName === 'name_card_border') fieldName = 'nameCardBorder';

    try {
        await User.update({ [fieldName]: shopItem.itemValue }, { where: { username } });
        if (!users[username]) users[username] = {};
        users[username][fieldName] = shopItem.itemValue;

        // تحديث المستخدمين المتصلين في الذاكرة (onlineUsers و rooms)
        Object.keys(onlineUsers).forEach(socketId => {
          if (onlineUsers[socketId].name === username) {
            onlineUsers[socketId][fieldName] = shopItem.itemValue;
          }
        });

        rooms.forEach(r => {
          r.users.forEach(u => {
            if (u.name === username) u[fieldName] = shopItem.itemValue;
          });
        });

        broadcastRoomsUpdate();
        
        // تحديث الغرفة الحالية
        const userRoom = rooms.find(r => r.users.some(u => u.name === username));
        if (userRoom) io.to(userRoom.id).emit('users update', userRoom.users);

        socket.emit('equip success', { 
            message: `تم تزويد "${shopItem.name}" بنجاح!`, 
            feature: fieldName, 
            value: shopItem.itemValue 
        });
    } catch (error) {
        console.error('Error equipping item:', error);
        socket.emit('equip error', 'حدث خطأ أثناء تزويد العنصر.');
    }
  });

  // حدث جديد: إزالة تزويد عنصر
  socket.on('unequip item', async (data) => {
    const { inventoryId, currentUser } = data;
    const username = currentUser.name || currentUser.username;

    if (!username) return;

    const userInv = userInventories[username] || [];
    const invItem = userInv.find(i => i.id === inventoryId);

    if (!invItem) {
        return socket.emit('equip error', 'العنصر غير موجود في مخزونك.');
    }

    const shopItem = shopItems.find(i => i.id === invItem.itemId);
    if (!shopItem) {
        return socket.emit('equip error', 'العنصر غير معروف.');
    }

    let fieldName = shopItem.itemType;
    if (fieldName === 'avatar_frame') fieldName = 'avatarFrame';
    if (fieldName === 'join_message_bg') fieldName = 'joinMessageBackground';
    if (fieldName === 'name_color') fieldName = 'nameColor';
    if (fieldName === 'name_font') fieldName = 'nameFont';
    if (fieldName === 'name_background') fieldName = 'nameBackground';
    if (fieldName === 'user_card_background') fieldName = 'userCardBackground';
    if (fieldName === 'profile_background') fieldName = 'profileBackground';
    if (fieldName === 'name_card_border') fieldName = 'nameCardBorder';

    try {
        await User.update({ [fieldName]: null }, { where: { username } });
        if (!users[username]) users[username] = {};
        users[username][fieldName] = null;

        // تحديث في الذاكرة
        Object.keys(onlineUsers).forEach(socketId => {
          if (onlineUsers[socketId].name === username) {
            onlineUsers[socketId][fieldName] = null;
          }
        });

        rooms.forEach(r => {
          r.users.forEach(u => {
            if (u.name === username) u[fieldName] = null;
          });
        });

        broadcastRoomsUpdate();
        
        const userRoom = rooms.find(r => r.users.some(u => u.name === username));
        if (userRoom) io.to(userRoom.id).emit('users update', userRoom.users);

        socket.emit('equip success', { 
            message: `تمت إزالة "${shopItem.name}" بنجاح!`, 
            feature: fieldName, 
            value: null 
        });
    } catch (error) {
        console.error('Error unequipping item:', error);
        socket.emit('equip error', 'حدث خطأ أثناء إزالة تزويد العنصر.');
    }
  });

  // حدث حذف عنصر من المخزون
  socket.on('delete inventory item', async (data) => {
    const { inventoryId, currentUser } = data;
    const username = currentUser.name;

    const userInv = userInventories[username] || [];
    const invItemIndex = userInv.findIndex(i => i.id === inventoryId);

    if (invItemIndex === -1) {
        socket.emit('delete inventory error', 'العنصر غير موجود في مخزونك.');
        return;
    }

    const invItem = userInv[invItemIndex];
    const shopItem = shopItems.find(i => i.id === invItem.itemId);
    if (!shopItem) {
        socket.emit('delete inventory error', 'العنصر غير معروف.');
        return;
    }

    try {
        // حذف من قاعدة البيانات
        await UserInventory.destroy({ where: { id: inventoryId } });

        // حذف من الكاش
        userInv.splice(invItemIndex, 1);

        // إعادة حساب ownedItems
        const ownedItems = getOwnedItems(username);

        socket.emit('delete inventory success', {
            message: `تم حذف "${shopItem.name}" من مخزونك بنجاح.`,
            ownedItems: ownedItems
        });

        // تحديث بيانات المستخدم الحالي
        if (currentUser) currentUser.ownedItems = ownedItems;

    } catch (error) {
        console.error('Error deleting inventory item:', error);
        socket.emit('delete inventory error', 'حدث خطأ أثناء حذف العنصر.');
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

  // حدث مسح سجل الغرفة (للغرف العامة)
  socket.on('clear room history', async (data) => {
    const { roomId, currentUser } = data;
    const roomIdInt = parseInt(roomId);

    if (currentUser.name !== SITE_OWNER.username) {
      socket.emit('management error', 'عذراً، مسح السجل متاح فقط لصاحب الموقع.');
      return;
    }

    try {
      // 1. مسح الرسائل النصية من قاعدة البيانات (المخزنة في PrivateMessage بمعرف الغرفة)
      await PrivateMessage.destroy({ where: { conversationId: roomIdInt.toString() } });
      
      // 2. مسح الصور من قاعدة البيانات
      await ChatImage.destroy({ where: { roomId: roomIdInt } });

      // 3. مسح من الذاكرة
      if (messages[roomIdInt]) {
        messages[roomIdInt] = [];
      }

      // 4. إشعار العملاء
      io.to(roomIdInt).emit('room history cleared', { roomId: roomIdInt });
      socket.emit('management success', 'تم مسح سجل الغرفة بنجاح');

    } catch (error) {
      console.error('Error clearing room history:', error);
      socket.emit('management error', 'حدث خطأ أثناء مسح السجل');
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
      
      broadcastRoomsUpdate();
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
      broadcastRoomsUpdate();
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
        broadcastRoomsUpdate();
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

      broadcastRoomsUpdate();
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
  
  socket.on('logout', () => {
    const user = onlineUsers[socket.id];
    if (user) {
      const roomId = user.roomId;
      const room = rooms.find(r => r.id === roomId);
      if (room) {
        room.users = room.users.filter(u => u.id !== socket.id);
        broadcastRoomsUpdate();
        io.to(roomId).emit('users update', room.users);
      }
      delete onlineUsers[socket.id];
    }
  });

  // في حدث disconnect - البحث عن هذا الجزء واستبداله
socket.on('disconnect', async (reason) => {
    const user = onlineUsers[socket.id];
    if (user) {
      const roomId = user.roomId;
      const room = rooms.find(r => r.id === roomId);
      
      if (room) {
        // بدلاً من الحذف، نقوم بتغيير الحالة إلى غير متصل
        const roomUser = room.users.find(u => u.id === socket.id);
        if (roomUser) {
          roomUser.isOnline = false;
        }
        broadcastRoomsUpdate();
        io.to(roomId).emit('users update', room.users);
      }
      
      // تحديث آخر ظهور للمستخدم
      const lastSeenTime = Date.now();
      userLastSeen[user.name] = lastSeenTime;
      await saveUserLastSeen(user.name, lastSeenTime);

      // التحقق من ألعاب التوصيل (Dots and Boxes) والمغادرة منها
      for (const gameId in dotsAndBoxesGames) {
          const game = dotsAndBoxesGames[gameId];
          const isInGame = game.players.some(p => p.username === user.name);
          if (isInGame) {
              // استدعاء منطق المغادرة يدوياً بدلاً من الانبعاث لتجنب المشاكل
              const playerIndex = game.players.findIndex(p => p.username === user.name);
              const leavingPlayer = game.players[playerIndex];
              
              if (game.status === 'playing') {
                  if (game.players.length === 2) {
                      game.status = 'over';
                      const winner = game.players.find(p => p.username !== user.name);
                      game.winner = winner ? winner.username : 'لا أحد';
                      game.message = `انسحب الخصم ${user.name}، أنت الفائز!`;
                      io.to(gameId).emit('dots and boxes game update', game);
                      setTimeout(() => delete dotsAndBoxesGames[gameId], 10000);
                  } else {
                      leavingPlayer.isRemoved = true;
                      if (game.currentPlayerIndex === playerIndex) {
                          game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
                          let checkCount = 0;
                          while (game.players[game.currentPlayerIndex].isRemoved && checkCount < game.players.length) {
                              game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
                              checkCount++;
                          }
                      }
                      io.to(gameId).emit('dots and boxes game update', game);
                  }
              } else {
                  game.players = game.players.filter(p => p.username !== user.name);
                  if (game.players.length === 0) {
                      delete dotsAndBoxesGames[gameId];
                  } else {
                      if (game.host === user.name) game.host = game.players[0].username;
                      io.to(gameId).emit('dots and boxes game update', game);
                  }
              }
          }
      }

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
        avatar: userAvatars[user.username] || DEFAULT_AVATAR_URL
      }));

      socket.emit('top users list', topUsersList);

    } catch (error) {
      console.error('خطأ في جلب قائمة المتفاعلين:', error);
      socket.emit('error', 'حدث خطأ أثناء جلب قائمة المتفاعلين.');
    }
  });

  // حدث إرسال النقاط
  socket.on('send points', async (data) => {
    let { fromUser, toUser, amount } = data;
    amount = parseInt(amount);

    // التحقق من المدخلات
    if (!fromUser || !toUser || isNaN(amount) || amount <= 0) {
      socket.emit('points sent error', 'بيانات غير صالحة.');
      return;
    }

    if (amount > 10000) {
      socket.emit('points sent error', 'الحد الأقصى لإرسال النقاط في المرة الواحدة هو 10,000 نقطة.');
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

       // إرسال إشعار للغرفة الحالية فقط
      const userRoomId = onlineUsers[socket.id]?.roomId;
      if (userRoomId) {
          const notificationMessage = {
            type: 'system',
            user: 'رسائل النظام',
            avatar: BOT_AVATAR_URL,
            content: `🎁 أرسل <strong class="text-white">${fromUser}</strong> عدد <strong class="text-yellow-300">${amount}</strong> نقطة إلى <strong class="text-white">${toUser}</strong>.`,
            time: new Date().toLocaleTimeString('en-GB')
          };
          io.to(userRoomId).emit('new message', notificationMessage);
          if (messages[userRoomId]) {
              messages[userRoomId].push(notificationMessage);
          }
      }
      // تحديث إنجاز "كريم"
      await updateAchievementProgress(fromUser, 'gifts', amount);

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

    // التحقق مما إذا كان المستخدم يمتلك العنصر بالفعل (باستثناء الرتب)
    if (item.itemType !== 'rank') {
        const userInventory = userInventories[username] || [];
        const alreadyOwned = userInventory.some(inv => inv.itemId === itemId);
        if (alreadyOwned) {
            socket.emit('buy item error', 'أنت تمتلك هذا العنصر بالفعل.');
            return;
        }
    }

    // التحقق من النقاط فقط إذا لم يكن المستخدم خاصًا
    if (!SPECIAL_USERS_CONFIG[username]) {
        const userPointsData = userPoints[username] || { points: 0, xp: 0, isInfinite: false };
        
        // التحقق الخاص لإطار النار البرتقالي (يستخدم XP)
        if (item.itemValue === 'frame-orange-fire') {
            if (userPointsData.xp < item.price) {
                socket.emit('buy item error', 'ليس لديك نقاط خبرة (XP) كافية لشراء هذا الإطار.');
                return;
            }
        } else {
            if (!userPointsData.isInfinite && userPointsData.points < item.price) {
                socket.emit('buy item error', 'ليس لديك نقاط كافية لشراء هذا العنصر.');
                return;
            }
        }
    }

    try {
      // 1. خصم النقاط
      let newPoints = userPoints[username]?.points || 0;
      let newXP = userPoints[username]?.xp || 0;

      if (!SPECIAL_USERS_CONFIG[username] && !userPoints[username]?.isInfinite) {
          if (item.itemValue === 'frame-orange-fire') {
              newXP -= item.price;
              await UserPoints.update({ xp: newXP }, { where: { username } });
              userPoints[username].xp = newXP;
          } else {
              newPoints -= item.price;
              await saveUserPoints(username, newPoints, userPoints[username].level);
              userPoints[username].points = newPoints;
          }
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
          broadcastRoomsUpdate();
      } else {
          // معالجة شراء العناصر الأخرى التي تضاف للمخزون (إطارات، ألوان، خطوط، بطاقات، إلخ)
          await saveUserInventory(username, item.id);
          
          socket.emit('buy item success', {
              message: `🎉 تهانينا! لقد اشتريت "${item.name}" بنجاح. ستجد العنصر في مخزونك.`,
              reload: false,
              newPoints: newPoints,
              newXP: newXP,
              ownedItems: getOwnedItems(username),
              showInventoryDot: true // علم لإظهار النقطة الحمراء
          });
          return;
      }
      // 3. إرسال إشعار نجاح

      socket.emit('buy item success', {
        message: `🎉 تهانينا! لقد اشتريت "${item.name}" بنجاح.`,
        reload: true, // اطلب من العميل تحديث الصفحة لإظهار الرتبة الجديدة
        showInventoryDot: true // إظهار نقطة حمراء على مشترياتي
      });

    } catch (error) {
      console.error('خطأ في عملية الشراء:', error);
      socket.emit('buy item error', 'حدث خطأ في الخادم أثناء محاولة الشراء.');
    }
  });

  // حدث إهداء عنصر (رتبة)
  socket.on('gift item', async (data) => {
      const { itemId, targetUsername, currentUser } = data;
      const senderName = currentUser.name;

      if (pendingGiftOffers[targetUsername]) {
          socket.emit('gift item error', 'المستخدم لديه طلب إهداء معلق بالفعل. يرجى الانتظار حتى يقوم بالرد.');
          return;
      }

      const item = shopItems.find(i => i.id === itemId);
      if (!item) {
          socket.emit('gift item error', 'هذا العنصر غير متوفر.');
          return;
      }

      const targetUser = users[targetUsername];
      if (!targetUser) {
          socket.emit('gift item error', 'المستخدم المستهدف غير موجود.');
          return;
      }

      // التحقق من أن المستخدم متصل
      const targetSocketId = Object.keys(onlineUsers).find(id => onlineUsers[id].name === targetUsername);
      if (!targetSocketId) {
          socket.emit('gift item error', 'المستخدم غير متصل حالياً. يجب أن يكون المستخدم متصلاً لاستلام الهدية.');
          return;
      }

      // التحقق من النقاط
      if (!SPECIAL_USERS_CONFIG[senderName]) {
          const userPointsData = userPoints[senderName] || { points: 0, isInfinite: false };
          if (!userPointsData.isInfinite && userPointsData.points < item.price) {
              socket.emit('gift item error', 'ليس لديك نقاط كافية لإهداء هذه الرتبة.');
              return;
          }
      }

      // تخزين العرض المعلق
      pendingGiftOffers[targetUsername] = {
          sender: senderName,
          itemId: item.id,
          rank: item.itemValue,
          price: item.price, // حفظ السعر للتحقق لاحقاً
          itemType: item.itemType,
          itemName: item.name
      };

      // إرسال العرض للمستلم
      // استخدام اسم المستخدم كغرفة لضمان الوصول
      io.to(targetUsername).emit('gift rank offer', {
          sender: senderName,
          rankName: item.name,
          rank: item.itemValue,
          itemType: item.itemType
      });

      socket.emit('gift item success', {
          message: `تم إرسال عرض الهدية للمستخدم ${targetUsername}. في انتظار القبول...`,
          // لا نرسل نقاط جديدة هنا لأننا لم نخصمها بعد
      });
  });

  // حدث الرد على الهدية
  socket.on('respond to gift', async (data) => {
      const { accepted, currentUser } = data;
      const recipientName = currentUser.name;
      const offer = pendingGiftOffers[recipientName];

      if (!offer) return; // لا يوجد عرض

      delete pendingGiftOffers[recipientName]; // حذف العرض

      const senderName = offer.sender;
      const senderSocketId = Object.keys(onlineUsers).find(id => onlineUsers[id].name === senderName);

      if (!accepted) {
          if (senderSocketId) {
              io.to(senderSocketId).emit('gift item error', `قام ${recipientName} برفض الهدية.`);
          }
          return;
      }

      try {
          // 1. خصم النقاط من المرسل (التحقق مرة أخرى)
          if (!SPECIAL_USERS_CONFIG[senderName] && !userPoints[senderName]?.isInfinite) {
              // إعادة تحميل نقاط المرسل للتأكد
              const senderPointsData = await UserPoints.findOne({ where: { username: senderName } });
              if (!senderPointsData || senderPointsData.points < offer.price) {
                  socket.emit('gift item error', 'فشل قبول الهدية: المرسل لم يعد يملك نقاط كافية.');
                  if (senderSocketId) io.to(senderSocketId).emit('gift item error', 'فشل إرسال الهدية: رصيدك غير كافٍ.');
                  return;
              }

              const newPoints = senderPointsData.points - offer.price;
              await saveUserPoints(senderName, newPoints, senderPointsData.level);
              if (userPoints[senderName]) userPoints[senderName].points = newPoints;
              
              // تحديث واجهة المرسل
              if (senderSocketId) {
                  io.to(senderSocketId).emit('points update', { points: newPoints });
              }
          }

          // 2. منح العنصر للمستلم
          if (offer.itemType === 'rank') {
              const newRank = offer.rank;
              let expiresAt = null;
              if (newRank !== 'صاحب الموقع') {
                   expiresAt = new Date();
                   expiresAt.setDate(expiresAt.getDate() + 30); // 30 يوم
              }

              userRanks[recipientName] = newRank;
              if (expiresAt) userRankExpiry[recipientName] = expiresAt;
              else delete userRankExpiry[recipientName];
              await saveUserRank(recipientName, newRank, expiresAt);

              // تحديث المستخدمين المتصلين والغرف
              Object.keys(onlineUsers).forEach(socketId => {
                  if (onlineUsers[socketId].name === recipientName) onlineUsers[socketId].rank = newRank;
              });
              rooms.forEach(r => r.users.forEach(u => {
                  if (u.name === recipientName) u.rank = newRank;
              }));
              broadcastRoomsUpdate();
              
              // تحديث الصفحة للمستلم
              socket.emit('force reload');

          } else {
              // إضافة العنصر إلى مخزون المستلم
              await saveUserInventory(recipientName, offer.itemId);
          }

          // 3. إشعارات النجاح
          if (senderSocketId) {
              io.to(senderSocketId).emit('gift item success', {
                  message: `🎉 قام ${recipientName} بقبول الهدية! تم منح رتبة "${offer.itemName}".`
              });
          }

          socket.emit('gift item success', {
              message: `🎉 مبروك! لقد حصلت على رتبة "${offer.itemName}" من ${senderName}.`
          });


          // إشعار للمستلم في القائمة
          await saveNotification(recipientName, senderName, 'gift_rank', null);
          
          // إرسال إشعار فوري للمستلم
          io.to(socket.id).emit('new notification', {
              senderUsername: senderName,
              type: 'gift_rank',
              postId: null
          });

          // إشعار عام
          const notificationMessage = {
            type: 'system',
            systemStatus: 'positive',
            user: 'نظام الهدايا',
            avatar: BOT_AVATAR_URL,
            content: `🎁 قام <strong class="text-white">${senderName}</strong> بإهداء <strong class="text-yellow-300">${offer.itemName}</strong> للمستخدم <strong class="text-white">${recipientName}</strong>!`,
            time: new Date().toLocaleTimeString('ar-SA')
          };
          
          const recipientSocket = onlineUsers[socket.id];
          if (recipientSocket && recipientSocket.roomId) {
              io.to(recipientSocket.roomId).emit('new message', notificationMessage);
              if (messages[recipientSocket.roomId]) messages[recipientSocket.roomId].push(notificationMessage);
          }

      } catch (error) {
          console.error('Error processing gift response:', error);
          socket.emit('gift item error', 'حدث خطأ أثناء معالجة الهدية.');
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
    // تصفية الرتب الجامدة (frozen_rank) من القائمة المرسلة للمتجر
    const filteredItems = shopItems.filter(item => item.itemType !== 'frozen_rank');
    socket.emit('shop items data', filteredItems);
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
    broadcastRoomsUpdate();
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
      broadcastRoomsUpdate();
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
    const { title, message, currentUser } = data;
    if (currentUser.name !== SITE_OWNER.username) return;

    globalAnnouncement = { title, message };
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

          // تحديث الاسم في الغرف (لحل مشكلة بقاء الاسم القديم في قائمة غير المتصلين)
          rooms.forEach(room => {
              room.users.forEach(user => {
                  if (user.name === oldUsername) {
                      user.name = newUsername;
                  }
              });
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

        broadcastRoomsUpdate();

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
        broadcastRoomsUpdate(); // لتحديث القوائم
        socket.emit('control success', `تم حذف الرتبة "${rankName}"`);
    }
  });

  // --- Dots and Boxes Game Events ---

    const DNB_PLAYER_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#eab308']; // Blue, Red, Green, Yellow

    socket.on('create dots and boxes game', (data) => {
        const { currentUser, options } = data;
        const gameId = 'dnb_' + Date.now();

        const rows = parseInt(options.rows) || 5;
        const cols = parseInt(options.cols) || 5;
        const maxPlayers = parseInt(options.maxPlayers) || 4;

        dotsAndBoxesGames[gameId] = {
            id: gameId,
            host: currentUser.name,
            rows: Math.min(10, Math.max(3, rows)),
            cols: Math.min(10, Math.max(3, cols)),
            maxPlayers: Math.min(4, Math.max(2, maxPlayers)),
            players: [{
                id: socket.id,
                username: currentUser.name,
                color: DNB_PLAYER_COLORS[0],
                score: 0,
                avatar: userAvatars[currentUser.name] || DEFAULT_AVATAR_URL
            }],
            status: 'waiting',
            grid: null,
            currentPlayerIndex: 0,
            winner: null,
        };

        socket.join(gameId);
        socket.emit('dots and boxes game created', { gameId });
        io.to(gameId).emit('dots and boxes game update', dotsAndBoxesGames[gameId]);

        // Announce game to public rooms
        const notificationMessage = {
            type: 'system',
            user: 'نظام الألعاب',
            avatar: BOT_AVATAR_URL,
            content: `🎲 بدأ ${currentUser.name} لعبة توصيل المربعات! <button onclick="joinDotsAndBoxesGame('${gameId}')" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-bold transition-colors mx-1">انضم الآن</button>`,
            time: new Date().toLocaleTimeString('ar-SA')
        };
        rooms.forEach(r => {
            if (!r.protected) {
                io.to(r.id).emit('new message', notificationMessage);
                if (messages[r.id]) messages[r.id].push(notificationMessage);
            }
        });
    });

    socket.on('join dots and boxes game', (data) => {
        const { gameId, currentUser } = data;
        const game = dotsAndBoxesGames[gameId];

        if (!game) return socket.emit('dots and boxes error', 'اللعبة غير موجودة.');
        if (game.status !== 'waiting') return socket.emit('dots and boxes error', 'اللعبة بدأت بالفعل.');
        if (game.players.length >= game.maxPlayers) return socket.emit('dots and boxes error', `الغرفة ممتلئة (${game.maxPlayers} لاعبين كحد أقصى).`);
        if (game.players.some(p => p.username === currentUser.name)) {
            socket.join(gameId);
            io.to(gameId).emit('dots and boxes game update', game);
            return;
        }

        game.players.push({
            id: socket.id,
            username: currentUser.name,
            color: DNB_PLAYER_COLORS[game.players.length],
            score: 0,
            avatar: userAvatars[currentUser.name] || DEFAULT_AVATAR_URL
        });

        socket.join(gameId);
        io.to(gameId).emit('dots and boxes game update', game);
    });

    socket.on('start dots and boxes game', (gameId) => {
        const game = dotsAndBoxesGames[gameId];
        if (!game || game.host !== onlineUsers[socket.id]?.name || game.status !== 'waiting') return;
        if (game.players.length < 2) return socket.emit('dots and boxes error', 'تحتاج لاعبين اثنين على الأقل لبدء اللعبة.');

        game.status = 'playing';
        game.grid = {
            rows: game.rows,
            cols: game.cols,
            hLines: Array(game.rows + 1).fill(0).map(() => Array(game.cols).fill(0)),
            vLines: Array(game.rows).fill(0).map(() => Array(game.cols + 1).fill(0)),
            boxes: Array(game.rows).fill(0).map(() => Array(game.cols).fill(0)),
        };
        game.currentPlayerIndex = 0;

        io.to(gameId).emit('dots and boxes game update', game);
    });

    socket.on('draw dots and boxes line', (data) => {
        const { gameId, line } = data;
        const game = dotsAndBoxesGames[gameId];
        const player = onlineUsers[socket.id];

        if (!game || game.status !== 'playing' || !player) return;
        if (game.players[game.currentPlayerIndex].username !== player.name) return;

        const { type, r, c } = line;
        let boxesCompleted = 0;

        if (type === 'h' && game.grid.hLines[r][c] === 0) {
            game.grid.hLines[r][c] = game.currentPlayerIndex + 1;
            if (r > 0 && game.grid.hLines[r-1][c] && game.grid.vLines[r-1][c] && game.grid.vLines[r-1][c+1]) {
                game.grid.boxes[r-1][c] = game.currentPlayerIndex + 1;
                boxesCompleted++;
            }
            if (r < game.rows && game.grid.hLines[r+1][c] && game.grid.vLines[r][c] && game.grid.vLines[r][c+1]) {
                game.grid.boxes[r][c] = game.currentPlayerIndex + 1;
                boxesCompleted++;
            }
        } else if (type === 'v' && game.grid.vLines[r][c] === 0) {
            game.grid.vLines[r][c] = game.currentPlayerIndex + 1;
            if (c > 0 && game.grid.vLines[r][c-1] && game.grid.hLines[r][c-1] && game.grid.hLines[r+1][c-1]) {
                game.grid.boxes[r][c-1] = game.currentPlayerIndex + 1;
                boxesCompleted++;
            }
            if (c < game.cols && game.grid.vLines[r][c+1] && game.grid.hLines[r][c] && game.grid.hLines[r+1][c]) {
                game.grid.boxes[r][c] = game.currentPlayerIndex + 1;
                boxesCompleted++;
            }
        } else {
            return; // Invalid move
        }

        if (boxesCompleted > 0) {
            game.players[game.currentPlayerIndex].score += boxesCompleted;
        } else {
            game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        }

        const totalBoxes = game.rows * game.cols;
        const filledBoxes = game.grid.boxes.flat().filter(b => b > 0).length;
        if (filledBoxes === totalBoxes) {
            game.status = 'over';
            // Find winner(s)
            const maxScore = Math.max(...game.players.map(p => p.score));
            const winners = game.players.filter(p => p.score === maxScore);

            if (winners.length === 1) {
                game.winner = winners[0].username;
            } else if (winners.length > 1) {
                game.winner = winners.map(p => p.username).join(' و ');
            } else { // Should not happen if there are players
                game.winner = 'تعادل';
            }
        }

        io.to(gameId).emit('dots and boxes game update', game);
    });

    socket.on('leave dots and boxes game', (gameId) => {
        const game = dotsAndBoxesGames[gameId];
        if (!game) return;
        const player = onlineUsers[socket.id];
        if (!player) return;

        const playerIndex = game.players.findIndex(p => p.username === player.name);
        if (playerIndex === -1) return;

        const leavingPlayer = game.players[playerIndex];

        // إذا كانت اللعبة قد بدأت
        if (game.status === 'playing') {
            if (game.players.length === 2) {
                // لاعبين فقط -> الفوز للآخر
                game.status = 'over';
                const winner = game.players.find(p => p.username !== player.name);
                game.winner = winner ? winner.username : 'لا أحد';
                game.message = `انسحب الخصم ${player.name}، أنت الفائز!`;
                io.to(gameId).emit('dots and boxes game update', game);
                setTimeout(() => delete dotsAndBoxesGames[gameId], 10000);
            } else {
                // أكثر من لاعبين -> حذف اللاعب وجعل مربعاته رمادية
                leavingPlayer.isRemoved = true;
                // نحتفظ به في القائمة لتمييز مربعاته بالرمادي ولكن لا نعده في الأدوار
                
                // إذا كان الدور عليه، ننتقل للدور التالي
                if (game.currentPlayerIndex === playerIndex) {
                    game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
                    // تأكد أننا لا ننتقل للاعب محذوف آخر (حلقة حتى نجد لاعباً موجوداً)
                    let checkCount = 0;
                    while (game.players[game.currentPlayerIndex].isRemoved && checkCount < game.players.length) {
                        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
                        checkCount++;
                    }
                }
                
                io.to(gameId).emit('dots and boxes game update', game);
            }
        } else {
            // اللعبة لم تبدأ بعد -> مجرد حذف
            game.players = game.players.filter(p => p.username !== player.name);
            if (game.players.length === 0) {
                delete dotsAndBoxesGames[gameId];
            } else {
                if (game.host === player.name) game.host = game.players[0].username;
                io.to(gameId).emit('dots and boxes game update', game);
            }
        }
        socket.leave(gameId);
    });

  // --- أحداث إدارة المسابقات ---
  socket.on('get quiz questions', async (data) => {
    const { currentUser } = data;
    if (!currentUser || currentUser.name !== SITE_OWNER.username) return;
    try {
        const questions = await QuizQuestion.findAll();
        socket.emit('quiz questions list', questions);
    } catch (error) {
        socket.emit('control error', 'حدث خطأ أثناء جلب الأسئلة');
    }
  });

  socket.on('add quiz question', async (data) => {
    const { category, question, answer, currentUser } = data;
    if (!currentUser || currentUser.name !== SITE_OWNER.username) return;
    if (!question || !answer || !category) {
        socket.emit('control error', 'يجب إدخال الفئة والسؤال والإجابة');
        return;
    }
    try {
        await QuizQuestion.create({ category, question, answer });
        quizState.questionsQueue = []; // إعادة تعيين القائمة لتشمل السؤال الجديد
        const questions = await QuizQuestion.findAll();
        socket.emit('quiz questions list', questions);
        socket.emit('control success', 'تم إضافة السؤال بنجاح');
    } catch (error) {
        socket.emit('control error', 'حدث خطأ أثناء إضافة السؤال');
    }
  });

  socket.on('update bot avatar', async (data) => {
    const { avatarUrl, currentUser } = data;
    if (!currentUser || currentUser.name !== SITE_OWNER.username) return;
    if (!avatarUrl) return;
    try {
        await SystemSettings.upsert({ key: 'botAvatar', value: avatarUrl });
        BOT_AVATAR_URL = avatarUrl;
        socket.emit('control success', 'تم تحديث صورة البوت بنجاح');
        // تحديث صورة البوت في جميع الرسائل النظامية المستقبلية
    } catch (error) {
        socket.emit('control error', 'حدث خطأ أثناء تحديث صورة البوت');
    }
  });

  socket.on('delete quiz question', async (data) => {
    const { id, currentUser } = data;
    if (!currentUser || currentUser.name !== SITE_OWNER.username) return;
    try {
        await QuizQuestion.destroy({ where: { id } });
        quizState.questionsQueue = []; // إعادة تعيين القائمة
        const questions = await QuizQuestion.findAll();
        socket.emit('quiz questions list', questions);
        socket.emit('control success', 'تم حذف السؤال بنجاح');
    } catch (error) {
        socket.emit('control error', 'حدث خطأ أثناء حذف السؤال');
    }
  });

  // --- أحداث المركز اليومي (المكافآت وعجلة الحظ) ---
  socket.on('claim daily reward', async (data) => {
      const { currentUser } = data;
      const username = currentUser.name;
      const today = new Date().toISOString().split('T')[0];
      
      let userPoint = await UserPoints.findOne({ where: { username } });
      if (!userPoint) {
          userPoint = await UserPoints.create({ username, points: 0, level: 1 });
      }

      if (userPoint.lastDailyClaim === today) {
          socket.emit('daily reward error', 'لقد حصلت على المكافأة اليومية بالفعل. عد غداً!');
          return;
      }

      // حساب السلسلة (Streak)
      let streak = userPoint.dailyStreak || 0;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (userPoint.lastDailyClaim === yesterdayStr) {
          streak++;
      } else {
          streak = 1; // إعادة تعيين السلسلة إذا فات يوم
      }

      const reward = 100 + (Math.min(streak, 7) * 50); // أساس 100 + بونص يصل إلى 350 (المجموع 450)

      userPoint.points += reward;
      userPoint.lastDailyClaim = today;
      userPoint.dailyStreak = streak;
      await userPoint.save();
      userPoints[username].points = userPoint.points; // تحديث الذاكرة

      socket.emit('daily reward success', { points: reward, streak, totalPoints: userPoint.points });
      
      // إشعار عام
      const notificationMessage = {
        type: 'system',
        systemStatus: 'positive',
        user: 'نظام المكافآت',
        avatar: BOT_AVATAR_URL,
        content: `📅 قام <strong class="text-white">${username}</strong> بتسجيل الدخول اليومي وحصل على <strong class="text-yellow-300">${reward}</strong> نقطة! (سلسلة: ${streak} أيام)`,
        time: new Date().toLocaleTimeString('ar-SA')
      };
      io.emit('new message', notificationMessage);
  });

  socket.on('spin wheel', async (data) => {
      const { currentUser } = data;
      const username = currentUser.name;
      const spinCost = 500;

      let userPoint = await UserPoints.findOne({ where: { username } });
      if (!userPoint || userPoint.points < spinCost) {
          socket.emit('spin wheel error', 'لا تملك نقاط كافية (التكلفة 500 نقطة).');
          return;
      }

      // خصم التكلفة
      userPoint.points -= spinCost;
      userPoints[username].points = userPoint.points; // تحديث الذاكرة
      await userPoint.save();

      // سيتم تحديد الجائزة في العميل (Frontend) وإرسال النتيجة للتحقق، 
      // أو الأفضل: تحديد النتيجة هنا وإرسالها للعميل لمنع الغش.
      // سنقوم بتحديد النتيجة هنا:
      const prizes = [
          { index: 0, value: 100, probability: 30 },   // 100 نقطة
          { index: 1, value: 300, probability: 25 },   // 300 نقطة
          { index: 2, value: 500, probability: 20 },   // 500 نقطة (استرجاع)
          { index: 3, value: 1000, probability: 10 },  // 1000 نقطة
          { index: 4, value: 2000, probability: 5 },   // 2000 نقطة
          { index: 5, value: 5000, probability: 2 },   // 5000 نقطة
          { index: 6, value: 0, probability: 8 }       // حظ أوفر
      ];

      let random = Math.random() * 100;
      let selectedPrize = prizes[prizes.length - 1];
      let currentProb = 0;
      
      for (const prize of prizes) {
          currentProb += prize.probability;
          if (random <= currentProb) {
              selectedPrize = prize;
              break;
          }
      }

      // منح الجائزة
      if (selectedPrize.value > 0) {
          userPoint.points += selectedPrize.value;
          userPoints[username].points = userPoint.points;
          await userPoint.save();
      }

      socket.emit('spin wheel result', { 
          prizeIndex: selectedPrize.index, 
          prizeValue: selectedPrize.value,
          remainingPoints: userPoint.points 
      });
  });

  // --- لوحة ملوك الثعبان ---
  socket.on('get snake leaderboard', async () => {
      try {
          // جلب أفضل 10 في الفردي (النقاط) - للجميع بدون استثناء
          const topSingle = await UserPoints.findAll({
              where: { snakeHighScore: { [Sequelize.Op.gt]: 0 } },
              order: [['snakeHighScore', 'DESC']],
              limit: 10,
              attributes: ['username', 'snakeHighScore']
          });

          // جلب أفضل 10 في الجماعي (الكؤوس) - للجميع بدون استثناء
          const topMulti = await UserPoints.findAll({
              where: { snakeWins: { [Sequelize.Op.gt]: 0 } },
              order: [['snakeWins', 'DESC']],
              limit: 10,
              attributes: ['username', 'snakeWins']
          });

          const formatList = (list, type) => list.map(u => ({
              username: u.username,
              value: type === 'single' ? u.snakeHighScore : u.snakeWins,
              avatar: userAvatars[u.username] || DEFAULT_AVATAR_URL
          }));

          socket.emit('snake leaderboard data', {
              single: formatList(topSingle, 'single'),
              multi: formatList(topMulti, 'multi')
          });
      } catch (error) {
          console.error('Error fetching snake leaderboard:', error);
      }
  });

  // --- لوحة الشرف (XP Leaderboard) ---
  socket.on('get xp leaderboard', async () => {
    try {
      const topXPUsers = await UserPoints.findAll({
        order: [['xp', 'DESC']],
        limit: 10,
        attributes: ['username', 'xp', 'level']
      });
      
      const leaderboard = topXPUsers.map(u => ({
        username: u.username,
        xp: u.xp,
        level: u.level,
        avatar: userAvatars[u.username] || DEFAULT_AVATAR_URL
      }));
      
      socket.emit('xp leaderboard list', leaderboard);
    } catch (error) {
      console.error('Error fetching XP leaderboard:', error);
    }
  });

  // --- لوحة المستخدمين القدامى ---
  socket.on('get oldest users leaderboard', async () => {
      try {
          const oldestUsers = await User.findAll({
              order: [['createdAt', 'ASC']],
              limit: 10,
              attributes: ['username', 'createdAt']
          });

          const leaderboard = oldestUsers.map(u => ({
              username: u.username,
              createdAt: u.createdAt,
              avatar: userAvatars[u.username] || DEFAULT_AVATAR_URL
          }));

          socket.emit('oldest users list', leaderboard);
      } catch (error) {
          console.error('Error fetching oldest users leaderboard:', error);
      }
  });

  // --- لوحة المشاركين (التفاعل) ---
  socket.on('get interaction leaderboard', async () => {
      try {
          const topInteractionUsers = await UserPoints.findAll({
              order: [['interactionScore', 'DESC']],
              limit: 10,
              attributes: ['username', 'interactionScore']
          });

          const leaderboard = topInteractionUsers.map(u => ({
              username: u.username,
              interactionScore: u.interactionScore || 0,
              avatar: userAvatars[u.username] || DEFAULT_AVATAR_URL
          }));

          socket.emit('interaction leaderboard list', leaderboard);
      } catch (error) {
          console.error('Error fetching interaction leaderboard:', error);
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
                    profileCover: user.profileCover,
                    nameCardBorder: user.nameCardBorder,
                    nameFont: user.nameFont,
                    ownedItems: getOwnedItems(sessionData.username)
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
let isDataFullyLoaded = false;
async function loadGlobalHistory() {
    if (isDataFullyLoaded) return;
    isDataFullyLoaded = true; // نمنع الاستدعاء المتكرر فوراً
    console.log('--- جاري تحميل تاريخ المحادثات العامة من قاعدة البيانات (عند الطلب) ---');
    try {
        for (const room of rooms) {
            // جلب الرسائل النصية
            const roomMessages = await PrivateMessage.findAll({
                where: { conversationId: room.id.toString() },
                order: [['timestamp', 'DESC']],
                limit: 50
            });
            
            if (!messages[room.id]) messages[room.id] = [];
            
            roomMessages.reverse().forEach(msg => {
                messages[room.id].push({
                    type: 'user',
                    messageId: 'msg_' + msg.timestamp + '_' + msg.id,
                    user: msg.fromUser,
                    content: msg.content,
                    time: msg.time,
                    timestamp: Number(msg.timestamp),
                    rank: userRanks[msg.fromUser] || null,
                    avatar: userAvatars[msg.fromUser] || DEFAULT_AVATAR_URL,
                    badges: getUserBadges(msg.fromUser),
                    nameFont: users[msg.fromUser]?.nameFont
                });
            });

            // جلب الصور
            const roomImages = await ChatImage.findAll({
                where: { roomId: room.id },
                order: [['timestamp', 'DESC']],
                limit: 10
            });

            roomImages.reverse().forEach(img => {
                messages[room.id].push({
                    type: 'image',
                    messageId: img.messageId,
                    user: img.fromUser,
                    imageData: img.imageData,
                    time: new Date(Number(img.timestamp)).toLocaleTimeString('en-GB'),
                    timestamp: Number(img.timestamp),
                    rank: userRanks[img.fromUser] || null,
                    avatar: userAvatars[img.fromUser] || DEFAULT_AVATAR_URL,
                    badges: getUserBadges(img.fromUser),
                    nameFont: users[img.fromUser]?.nameFont
                });
            });

            messages[room.id].sort((a, b) => a.timestamp - b.timestamp);
        }
        console.log('--- تم تحميل التاريخ بنجاح ---');
    } catch (error) {
        console.error('خطأ أثناء تحميل التاريخ:', error);
    }
}

async function startServer() {
  await loadData(); // انتظر حتى تكتمل عملية تحميل ومزامنة البيانات
  isServerReady = true; // تعيين السيرفر كجاهز
  startQuizMonitor(); // بدء مراقبة غرفة التسلية
  startAutomatedMessages(); // بدء إرسال الرسائل التلقائية
  server.listen(PORT, () => {
    console.log(`السيرفر يعمل على المنفذ ${PORT}`);
  });
}

startServer();