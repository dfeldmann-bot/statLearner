import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const fakeStorage = (data) => ({
  getItem: (k) => (data.has(k) ? data.get(k) : null),
  setItem: (k, v) => data.set(k, String(v)),
  removeItem: (k) => data.delete(k),
});
const data = new Map();
const session = new Map();
globalThis.localStorage = fakeStorage(data);
globalThis.sessionStorage = fakeStorage(session);
const { MAX_USERS, register, login, logout, currentUser, userCount, canRegister } = await import("../app/src/users.js");
const { useUser, load, save } = await import("../app/src/store.js");

beforeEach(() => {
  data.clear();
  session.clear();
});
const PW = "correct horse";

test("register logs the new user in and stores no plain password", async () => {
  const { name, first } = await register("ada", PW);
  assert.equal(name, "ada");
  assert.ok(first);
  assert.equal(currentUser(), "ada");
  assert.ok(![...data.values()].some((v) => v.includes(PW)));
  assert.equal(JSON.parse(data.get("statlearner:users")).users[0].iterations, 600_000);
});

test("login checks the password; user names ignore case", async () => {
  await register("Ada", PW);
  logout();
  assert.equal(currentUser(), null);
  await assert.rejects(login("ada", "wrong"), /Wrong user name or password/);
  await assert.rejects(login("bob", PW), /Wrong user name or password/);
  assert.equal(await login("ada", PW), "Ada");
  await assert.rejects(register("ADA", PW), /taken/);
});

test("register rejects bad names and short passwords", async () => {
  await assert.rejects(register("a", PW), /User name/);
  await assert.rejects(register("has space", PW), /User name/);
  await assert.rejects(register("ada", "1234567"), /at least 8/);
  await assert.rejects(register("ada", "ada12345"), /must not contain the user name/);
});

test("registration stops at MAX_USERS", async () => {
  for (let i = 0; i < MAX_USERS; i++) await register(`user${i}`, PW);
  assert.equal(userCount(), 10);
  assert.ok(!canRegister());
  await assert.rejects(register("eleventh", PW), /maximum of 10/);
});

test("each user has separate progress; the first user adopts older progress", async () => {
  data.set("statlearner:v1", JSON.stringify({ ...load(), onboarded: true }));
  useUser("ada", { adoptLegacy: true });
  assert.equal(load().onboarded, true);
  assert.equal(data.has("statlearner:v1"), false);
  useUser("bob");
  assert.equal(load().onboarded, false);
  const bob = load();
  bob.settings.dailyGoal = 150;
  save(bob);
  useUser("ada");
  assert.equal(load().settings.dailyGoal, 50);
});

test("a login lasts for the tab unless the user asks to stay logged in", async () => {
  await register("ada", PW);
  session.clear(); // browser closed
  assert.equal(currentUser(), null);
  await login("ada", PW, { remember: true });
  session.clear();
  assert.equal(currentUser(), "ada");
  logout();
  assert.equal(currentUser(), null);
});

test("a stored login for a user who does not exist is ignored", () => {
  data.set("statlearner:users", JSON.stringify({ users: [], current: "ghost" }));
  session.set("statlearner:session", "ghost");
  assert.equal(currentUser(), null);
});

test("repeated wrong passwords lock the account for a growing time", async () => {
  await register("ada", PW);
  const t = 1_000_000;
  for (let i = 0; i < 5; i++) await assert.rejects(login("ada", "wrong pass", { now: t }), /Wrong/);
  await assert.rejects(login("ada", PW, { now: t + 29_000 }), /Too many failed attempts/);
  await assert.rejects(login("ada", "wrong pass", { now: t + 31_000 }), /Wrong/); // 6th failure: 60 s lock
  await assert.rejects(login("ada", PW, { now: t + 31_000 + 59_000 }), /Too many/);
  assert.equal(await login("ada", PW, { now: t + 31_000 + 61_000 }), "ada");
  const user = JSON.parse(data.get("statlearner:users")).users[0];
  assert.equal(user.failed, undefined);
});

test("old accounts with fewer hash iterations upgrade on login", async () => {
  await register("ada", PW);
  const db = JSON.parse(data.get("statlearner:users"));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(PW), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode("abcd"), iterations: 100_000 }, key, 256);
  db.users[0] = { name: "ada", salt: "abcd", hash: Buffer.from(bits).toString("hex") };
  data.set("statlearner:users", JSON.stringify(db));
  assert.equal(await login("ada", PW), "ada");
  const upgraded = JSON.parse(data.get("statlearner:users")).users[0];
  assert.equal(upgraded.iterations, 600_000);
  assert.notEqual(upgraded.salt, "abcd");
});
