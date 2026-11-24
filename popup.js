"use strict";

const core = globalThis.RedactleCore;
const groupSelect = document.querySelector("#group");
const startButton = document.querySelector("#start");
const stopButton = document.querySelector("#stop");
const statusText = document.querySelector("#status");
const progress = document.querySelector("#progress");
let settings;
let tabId;
let running = false;
let connected = false;
let polling = false;
let actionPending = false;
let timer;

function showError(error) {
  statusText.textContent = error.message;
  statusText.classList.add("error");
}

function updateButtons() {
  groupSelect.disabled = running || !settings?.groups.length || actionPending;
  startButton.disabled = !connected || running || !settings?.groups.length || actionPending;
  stopButton.disabled = !connected || !running || actionPending;
}

function summary() {
  const group = settings.groups.find(item => item.id === groupSelect.value);
  document.querySelector("#summary").textContent = group
    ? `${group.words.length} guesses · ${settings.delay} ms minimum per guess`
    : "Create a word group to get started.";
}

async function send(message) {
  const response = await chrome.tabs.sendMessage(tabId, message);
  if (!response?.ok) {
    throw new Error(response?.error || "No response from the puzzle tab.");
  }
  return response.state;
}

function render(state) {
  connected = true;
  running = state.phase === "running";
  progress.hidden = !state.total;
  progress.max = state.total || 1;
  progress.value = state.completed;
  statusText.classList.toggle("error", state.phase === "error");
  if (running) {
    statusText.textContent = `${state.groupName}: ${state.completed}/${state.total} submitted` +
      (state.current ? `\nCurrent: ${state.current}` : "") +
      (state.message ? `\n${state.message}` : "");
  } else {
    statusText.textContent = state.phase === "idle"
      ? "Ready."
      : `${state.message}\n${state.completed}/${state.total} submitted.`;
  }
  updateButtons();
}

async function refresh() {
  if (polling || actionPending) {
    return;
  }
  polling = true;
  try {
    render(await send({ type: "redactle:status" }));
  } catch {
    connected = false;
    updateButtons();
    showError(new Error("Open a Redactle puzzle. If it was already open when you installed or reloaded the extension, refresh that tab."));
    clearInterval(timer);
  } finally {
    polling = false;
  }
}

groupSelect.addEventListener("change", () => {
  summary();
  chrome.storage.local.set({ selectedGroupId: groupSelect.value }).catch(showError);
});

startButton.addEventListener("click", async () => {
  const group = settings.groups.find(item => item.id === groupSelect.value);
  if (!group) {
    return;
  }
  actionPending = true;
  updateButtons();
  try {
    render(await send({
      type: "redactle:start", groupName: group.name,
      words: group.words, delay: settings.delay
    }));
  } catch (error) {
    showError(error);
  } finally {
    actionPending = false;
    updateButtons();
  }
});

stopButton.addEventListener("click", async () => {
  actionPending = true;
  updateButtons();
  try {
    render(await send({ type: "redactle:stop" }));
  } catch (error) {
    showError(error);
  } finally {
    actionPending = false;
    updateButtons();
  }
});

document.querySelector("#settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

(async () => {
  try {
    const saved = await chrome.storage.local.get(["groups", "delay", "selectedGroupId"]);
    settings = core.readSettings(saved);
    for (const group of settings.groups) {
      groupSelect.add(new Option(group.name, group.id));
    }
    if (settings.groups.some(group => group.id === saved.selectedGroupId)) {
      groupSelect.value = saved.selectedGroupId;
    }
    summary();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
    await refresh();
    if (connected) {
      timer = setInterval(refresh, 300);
    }
  } catch (error) {
    showError(error);
  }
})();
