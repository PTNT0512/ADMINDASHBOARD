const mongoose = require('mongoose');
require('./src/init-env.js');
const CskhUser = require('./src/models/CskhUser.js');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lasvegas';
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      bufferCommands: false,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const seedCskhUsers = async () => {
  try {
    await connectDB();

    // Check if users already exist
    const count = await CskhUser.countDocuments();
    if (count > 0) {
      console.log(`ℹ️  Database already has ${count} CSKH users. Skipping seed.`);
      await mongoose.connection.close();
      return;
    }

    // Default CSKH users
    const defaultUsers = [
      {
        username: 'cskh1',
        password: '123456',
        fullName: 'Nhân Viên CSKH 1',
        email: 'cskh1@lasvegas.local',
        phone: '0912345678',
        role: 'staff',
        department: 'Customer Support',
        status: 'active',
        notes: 'Nhân viên chăm sóc khách hàng mặc định'
      },
      {
        username: 'cskh_supervisor',
        password: '123456',
        fullName: 'Giám Sát CSKH',
        email: 'supervisor@lasvegas.local',
        phone: '0912345679',
        role: 'supervisor',
        department: 'Customer Support',
        status: 'active',
        notes: 'Giám sát chăm sóc khách hàng'
      },
      {
        username: 'cskh_manager',
        password: '123456',
        fullName: 'Quản Lý CSKH',
        email: 'manager@lasvegas.local',
        phone: '0912345680',
        role: 'manager',
        department: 'Customer Support',
        status: 'active',
        notes: 'Quản lý chăm sóc khách hàng'
      }
    ];

    // Insert default users
    const insertedUsers = await CskhUser.insertMany(defaultUsers);
    console.log('✅ Successfully seeded CSKH users:');
    insertedUsers.forEach(user => {
      console.log(`   - ${user.username} (${user.fullName}) - Role: ${user.role}`);
    });

    await mongoose.connection.close();
    console.log('✅ Database seeding complete!');
  } catch (error) {
    console.error('❌ Seeding error:', error.message);
    process.exit(1);
  }
};

// Run seed if this is the main module
if (require.main === module) {
  seedCskhUsers();
}

module.exports = seedCskhUsers;
