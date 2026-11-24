const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../core.js");

test("parse all whitespace, preserving order and removing duplicates", () => {
  assert.deepEqual(
    core.parseWords(" science biology\r\nphysics\tScience  chemistry\u00a0\n"),
    ["science", "biology", "physics", "chemistry"]
  );
});

test("split spaces inside guesses and preserve commas", () => {
  assert.deepEqual(
    core.parseWords("natural selection,cell 1,000"),
    ["natural", "selection,cell", "1,000"]
  );
  assert.deepEqual(core.validateWords(["1,000", "selection,cell"]), ["1,000", "selection,cell"]);
});

test("empty settings default to no groups and tested pacing", () => {
  assert.deepEqual(core.readSettings({}), { groups: [], delay: 500 });
});

test("validate delay boundaries", () => {
  assert.equal(core.validateDelay("100"), 100);
  assert.equal(core.validateDelay(5000), 5000);
  for (const value of [0, 99, 5001, 100.5, "invalid", null]) {
    assert.throws(() => core.validateDelay(value));
  }
});

test("reject malformed guesses", () => {
  for (const words of [[], null, [""], [42], ["a b"], ["a\tb"], ["a\nb"], ["a\u00a0b"], ["a".repeat(201)]]) {
    assert.throws(() => core.validateWords(words));
  }
});

test("validate groups and reject duplicate IDs", () => {
  const group = { id: "one", name: " Biology ", words: [" cell "] };
  assert.deepEqual(core.validateGroups([group]), [
    { id: "one", name: "Biology", words: ["cell"] }
  ]);
  assert.throws(() => core.validateGroups([group, group]));
  assert.throws(() => core.validateGroups([{ ...group, name: " " }]));
  assert.throws(() => core.validateGroups([{ ...group, words: [42] }]));
  assert.throws(() => core.validateGroups([{ ...group, words: "cell" }]));
});

test("normalize older saved and imported multiword entries without changing pacing", () => {
  const settings = core.readSettings({
    groups: [{ id: "one", name: "Science", words: ["natural selection", "cell\tenergy", "1,000", "Cell"] }],
    delay: 250
  });
  assert.deepEqual(settings.groups[0].words, ["natural", "selection", "cell", "energy", "1,000"]);
  assert.equal(settings.delay, 250);
});

test("reject groups that expand beyond the guess limit", () => {
  assert.throws(() => core.validateGroups([
    { id: "one", name: "Too many", words: [Array.from({ length: 10001 }, (_, i) => `word${i}`).join(" ")] }
  ]));
});

test("backup settings round trip", () => {
  const value = {
    groups: [{ id: "science", name: "Science", words: ["biology", "physics"] }],
    delay: 250
  };
  assert.deepEqual(core.readSettings(JSON.parse(JSON.stringify(value))), value);
});
