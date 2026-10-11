import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const data = new Map();
globalThis.localStorage = {
  getItem: (k) => (data.has(k) ? data.get(k) : null),
  setItem: (k, v) => data.set(k, String(v)),
  removeItem: (k) => data.delete(k),
};
const { MAX_USERS, register, login, logout, currentUser, userCount, canRegister } = await import("../app/src/users.js");
const { useUser, load, save } = await import("../app/src/store.js");

beforeEach(() => data.clear());

test("register logs the new user in and stores no plain password", async () => {
  const { name, first } = await register("ada", "secret1");
  assert.equal(name, "ada");
  assert.ok(first);
  assert.equal(currentUser(), "ada");
  assert.ok(![...data.values()].some((v) => v.includes("secret1")));
});

test("login checks the password; user names ignore case", async () => {
  await register("Ada", "secret1");
  logout();
  assert.equal(currentUser(), null);
  await assert.rejects(login("ada", "wrong"), /Wrong user name or password/);
  await assert.rejects(login("bob", "secret1"), /Wrong user name or password/);
  assert.equal(await login("ada", "secret1"), "Ada");
  await assert.rejects(register("ADA", "other1"), /taken/);
});

test("register rejects bad names and short passwords", async () => {
  await assert.rejects(register("a", "secret1"), /User name/);
  await assert.rejects(register("has space", "secret1"), /User name/);
  await assert.rejects(register("ada", "123"), /Password/);
});

test("registration stops at MAX_USERS", async () => {
  for (let i = 0; i < MAX_USERS; i++) await register(`user${i}`, "pass1234");
  assert.equal(userCount(), 10);
  assert.ok(!canRegister());
  await assert.rejects(register("eleventh", "pass1234"), /maximum of 10/);
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
