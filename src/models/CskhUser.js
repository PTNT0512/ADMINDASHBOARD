const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const cskhUserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  role: { type: String, enum: ['staff', 'supervisor', 'manager'], default: 'staff' },
  department: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: null },
  notes: { type: String, default: '' }
});

// Middleware: Tự động mã hóa mật khẩu trước khi lưu vào DB
cskhUserSchema.pre('save', async function(next) {
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
cskhUserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('CskhUser', cskhUserSchema);
