const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../database');

// نموذج المستخدم
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  gender: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// نموذج الرتب
const UserRank = sequelize.define('UserRank', {
  username: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  rank: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// نموذج إدارة المستخدمين
const UserManagement = sequelize.define('UserManagement', {
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING, // mute, room_ban, site_ban
    allowNull: false
  },
  roomName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  mutedBy: {
    type: DataTypes.STRING,
    allowNull: true
  },
  bannedBy: {
    type: DataTypes.STRING,
    allowNull: true
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  bannedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
});

// نموذج الصور
const UserAvatar = sequelize.define('UserAvatar', {
  username: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  avatarUrl: {
    type: DataTypes.TEXT,
    allowNull: false
  }
});

// نموذج الجلسات
const UserSession = sequelize.define('UserSession', {
  sessionId: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// نموذج الرسائل الخاصة
const PrivateMessage = sequelize.define('PrivateMessage', {
  conversationId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fromUser: {
    type: DataTypes.STRING,
    allowNull: false
  },
  toUser: {
    type: DataTypes.STRING,
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  time: {
    type: DataTypes.STRING,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.BIGINT,
    allowNull: false
  }
});

// نموذج الأصدقاء
const UserFriend = sequelize.define('UserFriend', {
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  friendUsername: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// نموذج طلبات الصداقة
const FriendRequest = sequelize.define('FriendRequest', {
  fromUser: {
    type: DataTypes.STRING,
    allowNull: false
  },
  toUser: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// إنشاء العلاقات بين الجداول
User.hasOne(UserRank, { foreignKey: 'username' });
UserRank.belongsTo(User, { foreignKey: 'username' });

User.hasOne(UserAvatar, { foreignKey: 'username' });
UserAvatar.belongsTo(User, { foreignKey: 'username' });

User.hasMany(UserSession, { foreignKey: 'username' });
UserSession.belongsTo(User, { foreignKey: 'username' });

User.hasMany(PrivateMessage, { foreignKey: 'fromUser' });
PrivateMessage.belongsTo(User, { foreignKey: 'fromUser' });

module.exports = {
  User,
  UserRank,
  UserManagement,
  UserAvatar,
  UserSession,
  PrivateMessage,
  UserFriend,
  FriendRequest
};