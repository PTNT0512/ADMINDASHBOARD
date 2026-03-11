const CskhUser = require('../models/CskhUser.js');

const allowedRoles = new Set(['staff', 'supervisor', 'manager']);
const allowedStatus = new Set(['active', 'inactive']);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePayload(payload = {}) {
  const normalized = {
    username: normalizeString(payload.username),
    password: typeof payload.password === 'string' ? payload.password : '',
    fullName: normalizeString(payload.fullName),
    email: normalizeString(payload.email).toLowerCase(),
    phone: normalizeString(payload.phone),
    department: normalizeString(payload.department),
    notes: normalizeString(payload.notes),
    role: allowedRoles.has(payload.role) ? payload.role : 'staff',
    status: allowedStatus.has(payload.status) ? payload.status : 'active',
  };

  return normalized;
}

async function listCskhUsers() {
  return CskhUser.find({}).select('-password').sort({ createdAt: -1 }).lean();
}

async function createCskhUser(payload = {}) {
  const data = normalizePayload(payload);

  if (!data.username) {
    throw new Error('Vui lòng nhập tên đăng nhập');
  }
  if (!data.password || data.password.length < 6) {
    throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
  }

  const existing = await CskhUser.findOne({ username: data.username });
  if (existing) {
    throw new Error('Tên đăng nhập đã tồn tại');
  }

  const created = await CskhUser.create(data);
  const plain = created.toObject();
  delete plain.password;
  return plain;
}

async function updateCskhUser(id, payload = {}) {
  if (!id) {
    throw new Error('Thiếu ID nhân viên');
  }

  const data = normalizePayload(payload);
  const user = await CskhUser.findById(id);
  if (!user) {
    throw new Error('Không tìm thấy nhân viên');
  }

  user.fullName = data.fullName;
  user.email = data.email;
  user.phone = data.phone;
  user.department = data.department;
  user.notes = data.notes;
  user.role = data.role;
  user.status = data.status;
  user.updatedAt = new Date();

  if (data.password) {
    if (data.password.length < 6) {
      throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
    }
    user.password = data.password;
  }

  await user.save();
  const plain = user.toObject();
  delete plain.password;
  return plain;
}

async function deleteCskhUser(id) {
  if (!id) {
    throw new Error('Thiếu ID nhân viên');
  }
  const deleted = await CskhUser.findByIdAndDelete(id);
  if (!deleted) {
    throw new Error('Không tìm thấy nhân viên');
  }
  return true;
}

module.exports = {
  listCskhUsers,
  createCskhUser,
  updateCskhUser,
  deleteCskhUser,
};
