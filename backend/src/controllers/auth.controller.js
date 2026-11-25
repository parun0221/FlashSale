/**
 * Controller autentikasi.
 *
 * Lapisan HTTP: baca req, panggil service, tulis res. TIDAK boleh berisi logika bisnis atau SQL.
 *
 * TODO:
 *  - register (201), login, refresh, logout
 *  - Bungkus handler dengan asyncHandler
 */

const authService = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');

exports.register = asyncHandler(async (req, res) => {
  res.status(201).json({ data: await authService.register(req.body) });
});

exports.login = asyncHandler(async (req, res) => {
  res.json({ data: await authService.login(req.body) });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ data: await authService.getProfile(req.user.id) });
});

exports.logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.id);
  res.json({ message: 'Logged out successfully' });
});