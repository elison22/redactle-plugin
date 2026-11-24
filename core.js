(function (root) {
  "use strict";

  const DEFAULT_DELAY = 500;
  const MIN_DELAY = 100;
  const MAX_DELAY = 5000;

  function parseWords(text) {
    const seen = new Set();
    return text.split(/\s+/u)
      .map(word => word.trim())
      .filter(word => {
        const key = word.toLocaleLowerCase();
        if (!key || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }

  function validateWords(words) {
    if (!Array.isArray(words) || words.length === 0 || words.length > 10000) {
      throw new Error("Provide between 1 and 10,000 guesses.");
    }
    if (words.some(word => typeof word !== "string" || !word.trim() ||
      word.length > 200 || /\s/u.test(word.trim()))) {
      throw new Error("Each guess must be nonempty, at most 200 characters, and contain no whitespace.");
    }
    return words.map(word => word.trim());
  }

  function validateDelay(value) {
    const delay = Number(value);
    if (!Number.isInteger(delay) || delay < MIN_DELAY || delay > MAX_DELAY) {
      throw new Error(`Delay must be a whole number from ${MIN_DELAY} to ${MAX_DELAY} ms.`);
    }
    return delay;
  }

  function validateGroups(groups) {
    if (!Array.isArray(groups) || groups.length > 1000) {
      throw new Error("Expected a list of up to 1,000 groups.");
    }
    const ids = new Set();
    return groups.map(group => {
      if (!group || typeof group.id !== "string" || !group.id ||
        typeof group.name !== "string" || !group.name.trim() ||
        group.name.length > 100 || ids.has(group.id)) {
        throw new Error("Each group needs a unique ID and a name of 1–100 characters.");
      }
      ids.add(group.id);
      if (!Array.isArray(group.words) || group.words.length > 10000 ||
        group.words.some(word => typeof word !== "string")) {
        throw new Error("Each group needs a list of up to 10,000 text guesses.");
      }
      return {
        id: group.id,
        name: group.name.trim(),
        // Older saved groups may contain multiword entries from the original editor.
        words: validateWords(parseWords(group.words.join("\n")))
      };
    });
  }

  function readSettings(value) {
    return {
      groups: validateGroups(value.groups ?? []),
      delay: validateDelay(value.delay ?? DEFAULT_DELAY)
    };
  }

  const api = { DEFAULT_DELAY, parseWords, validateWords, validateDelay, validateGroups, readSettings };
  root.RedactleCore = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);
