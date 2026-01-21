require('dotenv').config();
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

// تعريف النماذج (كما هي في السيرفر)
const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, primaryKey: true },
}, { tableName: 'Users', timestamps: true });

const UserRank = sequelize.define('UserRank', {
  username: { type: DataTypes.STRING, primaryKey: true },
  rank: { type: DataTypes.STRING, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: true }
}, { tableName: 'UserRanks' });

const RankDefinition = sequelize.define('RankDefinition', {
  name: { type: DataTypes.STRING, primaryKey: true },
  color: { type: DataTypes.STRING, allowNull: false },
  icon: { type: DataTypes.TEXT, allowNull: false },
  level: { type: DataTypes.INTEGER, allowNull: false },
  wingId: { type: DataTypes.STRING, allowNull: true }
}, { tableName: 'RankDefinitions' });

async function fixOwnerRank() {
  const targetUsername = 'Walid dz 31';
  const targetRank = 'صاحب الموقع';

  try {
    await sequelize.authenticate();
    console.log('✅ تم الاتصال بقاعدة البيانات.');

    // 1. التأكد من وجود المستخدم
    const user = await User.findOne({ where: { username: targetUsername } });
    if (!user) {
      console.error(`❌ المستخدم ${targetUsername} غير موجود! يرجى تشغيل سكربت إنشاء الحساب أولاً.`);
      return;
    }
    console.log(`✅ المستخدم ${targetUsername} موجود.`);

    // 2. إنشاء أو تحديث الرتبة في جدول UserRanks
    const [userRank, created] = await UserRank.findOrCreate({
      where: { username: targetUsername },
      defaults: { rank: targetRank }
    });

    if (created) {
      console.log(`✅ تم إنشاء سجل الرتبة للمستخدم ${targetUsername} في جدول UserRanks.`);
    } else {
      if (userRank.rank !== targetRank) {
        await userRank.update({ rank: targetRank });
        console.log(`✅ تم تصحيح رتبة المستخدم إلى ${targetRank}.`);
      } else {
        console.log(`ℹ️ المستخدم لديه الرتبة الصحيحة بالفعل في جدول UserRanks.`);
      }
    }

    // 3. التأكد من تعريف الرتبة في RankDefinitions (الأيقونة واللون)
    const ownerRankDef = { 
        color: 'from-red-600 to-orange-400', 
        icon: '🏆', 
        level: 100, 
        wingId: 'owners' 
    };
    
    const [rankDef, defCreated] = await RankDefinition.findOrCreate({
        where: { name: targetRank },
        defaults: ownerRankDef
    });

    if (defCreated) {
        console.log(`✅ تم إنشاء تعريف الرتبة "${targetRank}" (الأيقونة واللون).`);
    } else {
        await rankDef.update(ownerRankDef);
        console.log(`✅ تم تحديث تعريف الرتبة لضمان ظهور الأيقونة.`);
    }

    console.log('\n🎉 تم إصلاح الرتبة بنجاح! أعد تشغيل السيرفر الآن.');

  } catch (error) {
    console.error('❌ حدث خطأ:', error);
  } finally {
    await sequelize.close();
  }
}

fixOwnerRank();
