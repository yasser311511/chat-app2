require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Sequelize, DataTypes } = require('sequelize');

// --- إعدادات الاتصال ---
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  protocol: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false // تعطيل تسجيل العمليات لناتج أنظف
});

// --- تعريف نموذج المستخدم لمطابقة server.js ---
const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, primaryKey: true },
  password: { type: DataTypes.STRING, allowNull: false },
  gender: { type: DataTypes.STRING, allowNull: false }
}, {
  tableName: 'Users' // التأكد من أن اسم الجدول صحيح
});

async function forceCreateOrUpdateOwner() {
  const targetUsername = 'Walid dz 31';
  const newPassword = 'change_this_password';

  try {
    await sequelize.authenticate();
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح.');

    console.log(`⏳ جاري البحث عن أو إنشاء حساب صاحب الموقع: ${targetUsername}`);

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const [user, created] = await User.findOrCreate({
      where: { username: targetUsername },
      defaults: { password: hashedPassword, gender: 'male' }
    });

    if (created) {
      console.log(`✅ نجاح! تم إنشاء حساب صاحب الموقع "${targetUsername}" بكلمة المرور الجديدة.`);
    } else {
      console.log(`ℹ️ الحساب موجود بالفعل. جاري تحديث كلمة المرور للتأكيد...`);
      await user.update({ password: hashedPassword });
      console.log(`✅ نجاح! تم تحديث كلمة المرور للمستخدم "${targetUsername}".`);
    }

    console.log('\nالآن يمكنك تشغيل السيرفر الرئيسي (node server.js) ومحاولة تسجيل الدخول.');

  } catch (error) {
    console.error('❌ خطأ فادح:', error.message);
    console.error('تأكد من صحة رابط الاتصال في ملف .env وأنك تستخدم رابط "Session Pooler" من Supabase.');
  } finally {
    await sequelize.close();
  }
}

forceCreateOrUpdateOwner();
