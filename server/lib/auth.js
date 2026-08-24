// ============================================================
// AUTH — Sessions, senha e regras de acesso por proprietário.
// ============================================================
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("./db");

const SESSION_COOKIE = "cg_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}
async function verifyPassword(plain, hash) {
  try {
    return await bcrypt.compare(plain, hash);
  } catch (e) {
    return false;
  }
}

function newSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createSession(userId) {
  const token = newSessionToken();
  db.insert("sessions", {
    user_id: userId,
    token,
    expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });
  return token;
}

function touchSession(session) {
  db.update("sessions", session.id, { expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
}

function destroySession(token) {
  const s = db.all("sessions").find((x) => x.token === token);
  if (s) db.remove("sessions", s.id);
}

function getUserBySessionToken(token) {
  const s = db.all("sessions").find((x) => x.token === token);
  if (!s) return null;
  if (new Date(s.expires_at).getTime() < Date.now()) {
    db.remove("sessions", s.id);
    return null;
  }
  touchSession(s);
  return db.getById("users", s.user_id);
}

function getRestaurantOfUser(userId) {
  return db.all("restaurants").find((r) => r.user_id === userId) || null;
}

function getUserSubscription(userId) {
  return db.all("subscriptions").find((s) => s.user_id === userId) || null;
}

// Middleware: exige usuário autenticado e injeta req.user
function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  const user = token ? getUserBySessionToken(token) : null;
  if (!user) return res.status(401).json({ error: "Não autenticado." });
  req.user = user;
  req.userToken = token;
  next();
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

module.exports = {
  SESSION_COOKIE,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  getUserBySessionToken,
  getRestaurantOfUser,
  getUserSubscription,
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
};