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

async function updateUserPassword() {
  try {
    await sequelize.authenticate();
    console.log('تم الاتصال بقاعدة البيانات بنجاح!');

    // استيراد مكتبة readline للتفاعل مع المستخدم
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // دالة لطلب المدخلات من المستخدم
    const askQuestion = (query) => new Promise(resolve => readline.question(query, resolve));

    // طلب اسم المستخدم من المستخدم
    const username = await askQuestion('أدخل اسم المستخدم الذي تريد تحديث كلمة المرور له: ');
    
    // التحقق من وجود المستخدم
    const user = await User.findOne({ where: { username } });
    
    if (!user) {
      console.log('المستخدم غير موجود!');
      readline.close();
      return;
    }

    // طلب كلمة المرور الجديدة
    const newPassword = await askQuestion('أدخل كلمة المرور الجديدة: ');
    
    // تأكيد كلمة المرور
    const confirmPassword = await askQuestion('أكد كلمة المرور الجديدة: ');
    
    if (newPassword !== confirmPassword) {
      console.log('كلمتا المرور غير متطابقتين!');
      readline.close();
      return;
    }

    // تشفير كلمة السر
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // تحديث كلمة السر في قاعدة البيانات
    await User.update(
      { password: hashedPassword },
      { where: { username } }
    );

    console.log(`تم تحديث كلمة المرور بنجاح للمستخدم: ${username}`);
  } catch (error) {
    console.error('خطأ في تحديث كلمة المرور:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

updateUserPassword();