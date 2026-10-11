// Simple local accounts: user name + password, at most MAX_USERS per device.
// Accounts and progress stay in this browser's localStorage; there is no server.
// Passwords are stored only as salted PBKDF2 hashes, but anyone with access to
// the device's browser tools can still read or delete the stored data.

export const MAX_USERS = 10;
export const MIN_PASSWORD = 8;
const KEY = "statlearner:users";
const SESSION_KEY = "statlearner:session"; // the login for this tab only
const ITERATIONS = 600_000; // OWASP 2023 minimum for PBKDF2-HMAC-SHA256
const LEGACY_ITERATIONS = 100_000; // accounts created before the iteration count was stored
const FREE_ATTEMPTS = 5; // failed logins allowed before a lockout
const LOCK_MS = 30_000; // first lockout; doubles with each further failure, up to MAX_LOCK_MS
const MAX_LOCK_MS = 60 * 60_000;

function readDb() {
  try {
    const db = JSON.parse(localStorage.getItem(KEY));
    if (db && Array.isArray(db.users)) return db;
  } catch {
    /* storage unavailable or corrupt */
  }
  return { users: [], current: null };
}

function writeDb(db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* storage unavailable: accounts last for this page only */
  }
}

function setSession(name) {
  try {
    if (name) sessionStorage.setItem(SESSION_KEY, name);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}

function getSession() {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

const toHex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hashPassword(password, salt, iterations) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations }, key, 256);
  return toHex(bits);
}

async function setPassword(user, password) {
  user.salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  user.iterations = ITERATIONS;
  user.hash = await hashPassword(password, user.salt, ITERATIONS);
}

const find = (db, name) => db.users.find((u) => u.name.toLowerCase() === String(name ?? "").trim().toLowerCase());

// Log a user in for this tab, and also across restarts when `remember` is set.
function startSession(db, name, remember) {
  db.current = remember ? name : null;
  writeDb(db);
  setSession(name);
}

export const userCount = () => readDb().users.length;
export const canRegister = () => userCount() < MAX_USERS;

// The logged-in user, if that user still exists.
export function currentUser() {
  const db = readDb();
  return find(db, getSession() ?? db.current)?.name ?? null;
}

export async function register(name, password, { remember = false } = {}) {
  name = String(name ?? "").trim();
  password = String(password ?? "");
  if (!/^[A-Za-z0-9_.-]{2,30}$/.test(name)) throw new Error("User name: 2-30 letters, digits, dots, dashes or underscores.");
  if (password.length < MIN_PASSWORD) throw new Error(`Password: at least ${MIN_PASSWORD} characters.`);
  if (password.toLowerCase().includes(name.toLowerCase())) throw new Error("Password must not contain the user name.");
  const db = readDb();
  if (db.users.length >= MAX_USERS) throw new Error(`This device already has the maximum of ${MAX_USERS} users.`);
  if (find(db, name)) throw new Error("That user name is taken.");
  const user = { name, createdAt: new Date().toISOString() };
  await setPassword(user, password);
  db.users.push(user);
  startSession(db, name, remember);
  return { name, first: db.users.length === 1 };
}

export async function login(name, password, { remember = false, now = Date.now() } = {}) {
  const db = readDb();
  const user = find(db, name);
  if (!user) throw new Error("Wrong user name or password.");
  if (user.lockedUntil > now) throw new Error(`Too many failed attempts. Try again in ${Math.ceil((user.lockedUntil - now) / 1000)} s.`);
  password = String(password ?? "");
  if ((await hashPassword(password, user.salt, user.iterations ?? LEGACY_ITERATIONS)) !== user.hash) {
    user.failed = (user.failed ?? 0) + 1;
    if (user.failed >= FREE_ATTEMPTS) user.lockedUntil = now + Math.min(LOCK_MS * 2 ** (user.failed - FREE_ATTEMPTS), MAX_LOCK_MS);
    writeDb(db);
    throw new Error("Wrong user name or password.");
  }
  delete user.failed;
  delete user.lockedUntil;
  if ((user.iterations ?? LEGACY_ITERATIONS) < ITERATIONS) await setPassword(user, password); // upgrade old hashes
  startSession(db, user.name, remember);
  return user.name;
}

export function logout() {
  const db = readDb();
  db.current = null;
  writeDb(db);
  setSession(null);
}
