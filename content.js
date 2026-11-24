(() => {
  "use strict";

  const core = globalThis.RedactleCore;
  let active = false;
  let cancelled = false;
  let state = {
    phase: "idle", completed: 0, total: 0, current: "", groupName: "", message: ""
  };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function controls() {
    const input = document.querySelector("#input-guess");
    const form = document.querySelector("#guess-form");
    const button = document.querySelector("#submit");
    if (!(input instanceof HTMLInputElement) ||
      !(button instanceof HTMLButtonElement) ||
      !(form instanceof HTMLFormElement) ||
      input.form !== form || button.form !== form ||
      !input.isConnected || input.getClientRects().length === 0) {
      throw new Error("Guess controls are unavailable. Open an unfinished Redactle puzzle.");
    }
    if (input.disabled || input.readOnly) {
      throw new Error("The game is not accepting guesses. The puzzle may be finished.");
    }
    return { input, button };
  }

  function checkContext(url) {
    if (cancelled) {
      throw new Error("Batch stopped.");
    }
    if (location.href !== url) {
      throw new Error("Stopped because the puzzle URL changed.");
    }
  }

  async function until(predicate, url, message) {
    const deadline = Date.now() + 5000;
    while (true) {
      checkContext(url);
      if (predicate()) {
        return;
      }
      if (Date.now() >= deadline) {
        throw new Error(message);
      }
      await wait(25);
    }
  }

  async function run(words, delay, url) {
    let draft = null;
    try {
      for (const word of words) {
        checkContext(url);
        const { input, button } = controls();
        if (input.value !== "") {
          throw new Error("Stopped to avoid overwriting text in the guess box.");
        }
        state.current = word;
        const started = Date.now();
        draft = { input, word };
        input.value = word;
        input.dispatchEvent(new Event("input", { bubbles: true }));

        // Give reactive input bindings a turn before invoking the submit handler.
        await wait(50);
        await until(() => {
          if (!input.isConnected || !button.isConnected) {
            throw new Error("Stopped because the guess controls changed.");
          }
          if (input.value !== word) {
            throw new Error("Stopped because the guess text changed.");
          }
          return !button.disabled;
        }, url, "The Guess button did not become ready.");
        checkContext(url);
        button.click();
        draft = null;

        // Clearing is the signal verified against the live site, not proof of a history update.
        await until(() => {
          if (!input.isConnected) {
            throw new Error("The guess controls changed after submission. Check the game before restarting.");
          }
          if (input.value !== "" && input.value !== word) {
            throw new Error("Stopped because the guess text changed.");
          }
          return input.value === "";
        }, url, "The guess box did not clear. Check the game before restarting.");
        state.completed += 1;

        if (state.completed < words.length) {
          await until(() => Date.now() - started >= delay, url, "Pacing timed out.");
        }
      }
      state.phase = "done";
      state.message = "Batch finished.";
    } catch (error) {
      state.phase = cancelled ? "stopped" : "error";
      state.message = error.message;
    } finally {
      if (cancelled && draft && draft.input.isConnected &&
        location.href === url && draft.input.value === draft.word) {
        draft.input.value = "";
        draft.input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      active = false;
      state.current = "";
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === "redactle:status") {
      respond({ ok: true, state: { ...state } });
    } else if (message?.type === "redactle:stop") {
      if (active) {
        cancelled = true;
        state.message = "Stopping after the current interaction…";
      }
      respond({ ok: true, state: { ...state } });
    } else if (message?.type === "redactle:start") {
      try {
        if (active) {
          throw new Error("A batch is already running in this tab.");
        }
        const words = core.validateWords(message.words);
        const delay = core.validateDelay(message.delay);
        const { input } = controls();
        if (input.value !== "") {
          throw new Error("Clear the guess box before starting a batch.");
        }
        cancelled = false;
        active = true;
        state = {
          phase: "running", completed: 0, total: words.length,
          current: "", groupName: String(message.groupName || ""), message: ""
        };
        respond({ ok: true, state: { ...state } });
        void run(words, delay, location.href);
      } catch (error) {
        respond({ ok: false, error: error.message });
      }
    }
  });

  window.addEventListener("pagehide", () => { cancelled = true; });
})();
