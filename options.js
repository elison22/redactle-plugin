"use strict";

const core = globalThis.RedactleCore;
const nameInput = document.querySelector("#name");
const wordsInput = document.querySelector("#words");
const delayInput = document.querySelector("#delay");
const statusText = document.querySelector("#status");
const deleteButton = document.querySelector("#delete-group");
let settings = { groups: [], delay: core.DEFAULT_DELAY };
let selectedId = null;
let dirty = false;

function status(message, error = false) {
  statusText.textContent = message;
  statusText.classList.toggle("error", error);
}

function count() {
  document.querySelector("#word-count").textContent =
    `${core.parseWords(wordsInput.value).length} unique guesses`;
}

function renderList() {
  const list = document.querySelector("#group-list");
  list.replaceChildren();
  for (const group of settings.groups) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${group.name} (${group.words.length})`;
    button.setAttribute("aria-current", String(group.id === selectedId));
    button.addEventListener("click", () => select(group.id));
    li.append(button);
    list.append(li);
  }
}

function select(id, force = false) {
  if (!force && dirty && !confirm("Discard unsaved group edits?")) {
    return;
  }
  selectedId = id;
  const group = settings.groups.find(item => item.id === id);
  nameInput.value = group?.name ?? "";
  wordsInput.value = group?.words.join("\n") ?? "";
  deleteButton.disabled = !group;
  dirty = false;
  count();
  renderList();
}

async function persist(next) {
  const validated = core.readSettings(next);
  await chrome.storage.local.set(validated);
  settings = validated;
}

document.querySelector("#new-group").addEventListener("click", () => select(null));
nameInput.addEventListener("input", () => { dirty = true; });
wordsInput.addEventListener("input", () => { dirty = true; count(); });
window.addEventListener("beforeunload", event => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});

document.querySelector("#editor").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const id = selectedId ?? crypto.randomUUID();
    const group = { id, name: nameInput.value.trim(), words: core.parseWords(wordsInput.value) };
    const groups = settings.groups.filter(item => item.id !== id);
    const index = settings.groups.findIndex(item => item.id === id);
    groups.splice(index < 0 ? groups.length : index, 0, group);
    await persist({ ...settings, groups });
    select(id, true);
    status("Group saved.");
  } catch (error) {
    status(error.message, true);
  }
});

deleteButton.addEventListener("click", async () => {
  if (!selectedId || !confirm("Delete this group?")) {
    return;
  }
  try {
    await persist({ ...settings, groups: settings.groups.filter(group => group.id !== selectedId) });
    select(null, true);
    status("Group deleted.");
  } catch (error) {
    status(error.message, true);
  }
});

document.querySelector("#pacing").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    await persist({ ...settings, delay: core.validateDelay(delayInput.value) });
    status("Pacing saved. This applies to the next batch.");
  } catch (error) {
    status(error.message, true);
  }
});

document.querySelector("#export").addEventListener("click", () => {
  const blob = new Blob(
    [JSON.stringify({ version: 1, ...settings }, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "redactle-word-groups.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status("Exported saved groups and pacing. Unsaved edits are not included.");
});

const fileInput = document.querySelector("#import-file");
document.querySelector("#import").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
  try {
    const file = fileInput.files[0];
    if (!file) {
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Backup files must be smaller than 5 MiB.");
    }
    const value = JSON.parse(await file.text());
    if (value.version !== 1 || !Array.isArray(value.groups) || value.delay === undefined) {
      throw new Error("Unsupported backup format. Expected a version 1 export.");
    }
    const imported = core.readSettings(value);
    if (!confirm(`Replace all saved groups with ${imported.groups.length} imported groups? Unsaved edits will also be discarded.`)) {
      return;
    }
    await persist(imported);
    delayInput.value = settings.delay;
    select(settings.groups[0]?.id ?? null, true);
    status("Backup imported.");
  } catch (error) {
    status(error.message, true);
  } finally {
    fileInput.value = "";
  }
});

(async () => {
  try {
    settings = core.readSettings(await chrome.storage.local.get(["groups", "delay"]));
    delayInput.value = settings.delay;
    select(settings.groups[0]?.id ?? null, true);
  } catch (error) {
    status(error.message, true);
  }
})();
