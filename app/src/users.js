// Simple local accounts: user name + password, at most MAX_USERS per device.
// Accounts and progress stay in this browser's localStorage; there is no server.
// Passwords are stored only as salted PBKDF2 hashes, but anyone with access to
// the device can still read or delete the stored data.

export const MAX_USERS = 10;
const KEY = "statlearner:users";
const ITERATIONS = 100_000;

const store = () => globalThis.localStorage;

function readDb() {
  try {
    const db = JSON.parse(store().getItem(KEY));
    if (db && Array.isArray(db.users)) return db;
  } catch {
    /* storage unavailable or corrupt */
  }
  return { users: [], current: null };
}

function writeDb(db) {
  try {
    store().setItem(KEY, JSON.stringify(db));
  } catch {
    /* storage unavailable: accounts last for this page only */
  }
}

const toHex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: ITERATIONS }, key, 256);
  return toHex(bits);
}

const find = (db, name) => db.users.find((u) => u.name.toLowerCase() === String(name).trim().toLowerCase());

export const userCount = () => readDb().users.length;
export const canRegister = () => userCount() < MAX_USERS;
export const currentUser = () => readDb().current;

export async function register(name, password) {
  name = String(name ?? "").trim();
  if (!/^[A-Za-z0-9_.-]{2,30}$/.test(name)) throw new Error("User name: 2-30 letters, digits, dots, dashes or underscores.");
  if (String(password ?? "").length < 4) throw new Error("Password: at least 4 characters.");
  const db = readDb();
  if (db.users.length >= MAX_USERS) throw new Error(`This device already has the maximum of ${MAX_USERS} users.`);
  if (find(db, name)) throw new Error("That user name is taken.");
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  db.users.push({ name, salt, hash: await hashPassword(password, salt), createdAt: new Date().toISOString() });
  db.current = name;
  writeDb(db);
  return { name, first: db.users.length === 1 };
}

export async function login(name, password) {
  const db = readDb();
  const user = find(db, name);
  if (!user || (await hashPassword(String(password ?? ""), user.salt)) !== user.hash) throw new Error("Wrong user name or password.");
  db.current = user.name;
  writeDb(db);
  return user.name;
}

export function logout() {
  const db = readDb();
  db.current = null;
  writeDb(db);
}
