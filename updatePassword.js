require('dotenv').config();
const bcrypt = require('bcryptjs');
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
  logging: console.log
});

// تعريف نموذج المستخدم
const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, primaryKey: true },
  password: { type: DataTypes.STRING, allowNull: false },
  gender: { type: DataTypes.STRING, allowNull: false }
});

async function updateOwnerPassword() {
  try {
    await sequelize.authenticate();
    console.log('تم الاتصال بقاعدة البيانات بنجاح!');

    // كلمة السر القديمة لصاحب الموقع
    const oldPassword = 'walidwalid321';
    
    // تشفير كلمة السر
    const hashedPassword = await bcrypt.hash(oldPassword, 10);
    
    // تحديث كلمة السر في قاعدة البيانات
    await User.update(
      { password: hashedPassword },
      { where: { username: 'Walid dz 31' } }
    );

    console.log('تم تحديث كلمة السر بنجاح لصاحب الموقع');
  } catch (error) {
    console.error('خطأ في تحديث كلمة السر:', error);
  } finally {
    await sequelize.close();
  }
}

updateOwnerPassword();