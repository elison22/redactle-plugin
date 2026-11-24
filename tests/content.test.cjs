const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const core = require("../core.js");

const source = fs.readFileSync(require.resolve("../content.js"), "utf8");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function createPage(onClick) {
  let listener;
  const submissions = [];
  class HTMLFormElement {}
  class HTMLInputElement {
    constructor() {
      this.value = "";
      this.disabled = false;
      this.readOnly = false;
      this.isConnected = true;
    }
    getClientRects() { return [{}]; }
    dispatchEvent() { return true; }
  }
  class HTMLButtonElement {
    constructor() {
      this.disabled = false;
      this.isConnected = true;
    }
    click() {
      submissions.push(input.value);
      if (onClick) {
        onClick(input);
      } else {
        input.value = "";
      }
    }
  }
  const form = new HTMLFormElement();
  const input = new HTMLInputElement();
  const button = new HTMLButtonElement();
  input.form = form;
  button.form = form;
  const location = { href: "https://redactle.net/en/100" };
  vm.runInNewContext(source, {
    RedactleCore: core,
    HTMLInputElement, HTMLButtonElement, HTMLFormElement,
    Event, setTimeout, Date, location,
    document: {
      querySelector: selector => ({
        "#input-guess": input, "#guess-form": form, "#submit": button
      })[selector]
    },
    window: { addEventListener() {} },
    chrome: { runtime: { onMessage: { addListener(fn) { listener = fn; } } } }
  });
  const message = value => {
    let response;
    listener(value, {}, result => { response = result; });
    return response;
  };
  const status = () => message({ type: "redactle:status" }).state;
  const start = (words = ["cell", "energy", "atom"], delay = 100) =>
    message({ type: "redactle:start", words, delay, groupName: "Science" });
  async function finished() {
    const deadline = Date.now() + 2000;
    while (status().phase === "running") {
      if (Date.now() > deadline) {
        throw new Error("Test runner did not finish.");
      }
      await sleep(10);
    }
    return status();
  }
  return { input, button, location, submissions, message, status, start, finished };
}

test("runner submits in order and completes", async () => {
  const page = createPage();
  assert.equal(page.start().ok, true);
  const state = await page.finished();
  assert.deepEqual(page.submissions, ["cell", "energy", "atom"]);
  assert.equal(state.completed, 3);
  assert.equal(state.phase, "done");
});

test("runner refuses to overwrite a manual draft", () => {
  const page = createPage();
  page.input.value = "manual";
  assert.equal(page.start().ok, false);
  assert.equal(page.input.value, "manual");
  assert.equal(page.submissions.length, 0);
});

test("runner rejects overlapping batches and stops pending submission", async () => {
  const page = createPage();
  assert.equal(page.start().ok, true);
  assert.equal(page.start().ok, false);
  page.message({ type: "redactle:stop" });
  assert.equal((await page.finished()).phase, "stopped");
  assert.equal(page.submissions.length, 0);
  assert.equal(page.input.value, "");
});

test("runner stops when the puzzle URL changes", async () => {
  const page = createPage();
  page.start();
  page.location.href = "https://redactle.net/en/101";
  assert.equal((await page.finished()).phase, "error");
  assert.equal(page.submissions.length, 0);
});

test("runner does not submit text changed by the user", async () => {
  const page = createPage();
  page.start();
  page.input.value = "manual";
  assert.equal((await page.finished()).phase, "error");
  assert.equal(page.submissions.length, 0);
  assert.equal(page.input.value, "manual");
});

test("runner waits for asynchronous input clearing", async () => {
  const page = createPage(input => {
    setTimeout(() => { input.value = ""; }, 75);
  });
  page.start(["cell", "energy"]);
  const state = await page.finished();
  assert.equal(state.phase, "done");
  assert.equal(state.completed, 2);
});

test("runner stops on solved/disabled controls before the next guess", async () => {
  const page = createPage(input => {
    input.value = "";
    input.disabled = true;
  });
  page.start();
  assert.equal((await page.finished()).phase, "error");
  assert.deepEqual(page.submissions, ["cell"]);
});

test("runner passes previously guessed words through without filtering", async () => {
  const page = createPage();
  page.start(["cell", "cell"]);
  assert.equal((await page.finished()).phase, "done");
  assert.deepEqual(page.submissions, ["cell", "cell"]);
});

test("runner rejects whitespace inside a guess", () => {
  const page = createPage();
  assert.equal(page.start(["natural selection"]).ok, false);
  assert.equal(page.submissions.length, 0);
});

test("runner preserves commas when submitting", async () => {
  const page = createPage();
  assert.equal(page.start(["1,000"]).ok, true);
  assert.equal((await page.finished()).phase, "done");
  assert.deepEqual(page.submissions, ["1,000"]);
});
