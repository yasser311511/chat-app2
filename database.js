require('dotenv').config(); // تحميل متغيرات البيئة من ملف .env

const { Sequelize } = require('sequelize');

// إنشاء اتصال بقاعدة البيانات
console.log('Connecting to database with URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'UNDEFINED');
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      rejectUnauthorized: false
    },
    keepAlive: true
  },
  pool: {
    max: 1,
    min: 0,
    acquire: 60000,
    idle: 10000
  },
  logging: false
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