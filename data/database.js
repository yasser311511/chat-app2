require('dotenv').config(); // تحميل متغيرات البيئة من ملف .env

const { Sequelize } = require('sequelize');

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
  logging: false // إخفاء رسائل SQL في الكونسول
});

// اختبار الاتصال
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('تم الاتصال بقاعدة البيانات بنجاح!');
  } catch (error) {
    console.error('فشل الاتصال بقاعدة البيانات:', error);
  }
}

module.exports = { sequelize, testConnection };