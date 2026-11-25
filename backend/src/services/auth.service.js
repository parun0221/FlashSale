/**
 * Logika autentikasi.
 *
 * Lapisan logika bisnis. TIDAK boleh tahu tentang req/res Express. Boleh memanggil repositories, cache, queue.
 *
 * TODO:
 *  - register: hash password (bcrypt), tangani email duplikat (kode error Postgres 23505 -> 409)
 *  - login: pesan error sama untuk email salah/password salah
 *  - Terbitkan access token + refresh token; simpan jti refresh di Redis (allowlist, TTL)
 *  - refresh: rotasi token, token lama harus tidak bisa dipakai lagi (pikirkan atomisitasnya)
 *  - logout: cabut refresh token
 */

const bcrypt = require('bcryptjs');
const userRepo = require('../repositories/user.repository');
const ApiError = require('../utils/ApiError');
const { toUserDTO } = require('../models/user.model');
const { signAccessToken } = require('../utils/tokens');

exports.register = async ({ name, email, password }) => {
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await userRepo.create({ name, email, passwordHash });
    return { user: toUserDTO(user), accessToken: signAccessToken(user) };
  } catch (err) {
    // 23505 = kode error Postgres untuk pelanggaran UNIQUE
    if (err.code === '23505') throw new ApiError(409, 'Email already registered');
    throw err;
  }
};

exports.login = async ({ email, password }) => {
  const user = await userRepo.findByEmail(email);
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  // pesan sama untuk "email tidak ada" dan "password salah", agar akun tidak bisa ditebak
  if (!ok) throw new ApiError(401, 'Invalid email or password');
  return { user: toUserDTO(user), accessToken: signAccessToken(user) };
};

exports.getProfile = async (userId) => {
  const user = await userRepo.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  return toUserDTO(user);
};

exports.logout = async (userId) => {
  // Implement logout logic here
};
