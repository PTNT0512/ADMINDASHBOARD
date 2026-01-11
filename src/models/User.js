// Model User
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isFirstLogin: { type: Boolean, default: true },
  role: { type: String, default: 'admin' },
  telegramId: { type: String, default: null }
});

// Middleware: Tự động mã hóa mật khẩu trước khi lưu vào DB
userSchema.pre('save', async function(next) {
  // Chỉ mã hóa nếu mật khẩu có sự thay đổi (tạo mới hoặc đổi mật khẩu)
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Phương thức kiểm tra mật khẩu
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);