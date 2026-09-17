import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const lessons = JSON.parse(readFileSync(new URL("./accounting-lessons.json", import.meta.url)));
const bank = JSON.parse(readFileSync(new URL("./accounting-bank.json", import.meta.url)));

test("every lesson has a valid shape", () => {
  for (const l of lessons) {
    assert.ok(typeof l.topic === "string" && l.topic.length > 0);
    assert.ok(typeof l.title === "string" && l.title.length > 0);
    assert.ok(typeof l.lesson === "string" && l.lesson.length > 0);
    assert.ok(typeof l.source === "string" && l.source.length > 0);
  }
});

test("topics are unique", () => {
  const topics = lessons.map((l) => l.topic);
  assert.strictEqual(new Set(topics).size, topics.length);
});

test("every topic in the accounting bank has a matching lesson", () => {
  const lessonTopics = new Set(lessons.map((l) => l.topic));
  const bankTopics = new Set(bank.map((q) => q.topic));
  for (const topic of bankTopics) {
    assert.ok(lessonTopics.has(topic), `no lesson found for bank topic "${topic}"`);
  }
});
