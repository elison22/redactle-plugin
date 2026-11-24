# Redactle Word Groups

A personal Brave/Chromium extension for saving named guess lists and submitting
them through [Redactle](https://redactle.net/)'s normal controls. No server,
dependencies, build step, or access to hidden answers.

## Install in Brave

1. Open `brave://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this repository's root folder (the folder
   containing `manifest.json`).
4. Pin **Redactle Word Groups** using the toolbar's extensions menu.
5. Open or **refresh** your Redactle tab.

The toolbar action is enabled on `https://redactle.net/` only. It may be enabled
on non-game pages of that site, but guessing requires the normal game controls.
No store publication is needed. Keep this folder in place: Brave loads it directly.
After pulling code changes, click **Reload** on the extension card and refresh
Redactle again.

## Use

1. Click the toolbar icon, then **Manage groups & settings**.
2. Create a named group and paste whitespace-separated guesses (spaces, tabs, or newlines). Click
   **Save group**. Repeat for your starter, biology, physics, or other lists.
3. On a Redactle puzzle, open the popup, choose a group, and click **Guess all**.
4. Close the popup if desired; the batch continues in that tab. Reopen it to see
   progress or click **Stop**.

Each group preserves guess order and removes case-insensitive duplicates when
saved. Already-guessed words in the game are not filtered. Any whitespace separates
guesses; commas are preserved as part of a guess, not treated as delimiters.
For example, `cell organism` is two guesses, while `1,000` is one.
Existing saved groups and imported backups also have multiword entries split on
whitespace when loaded.

**These are real guesses. Test on an archive puzzle first.** Keep the tab open
and do not manually type or submit guesses during a batch. Only one batch can
run per tab. Each tab has its own runner.

### Pacing and stopping

The default minimum interval is **500 ms per guess**, including a 50 ms input
settling delay. The runner also waits for the game to clear the input after each
click, with a five-second timeout. Clearing is a practical signal verified in
manual testing, not confirmation that the guess history has finished rendering.
The submitted counter means the runner clicked Guess and observed the input clear;
it is not a count of new history entries or hits.

You can configure 100–5,000 ms in settings. Lower values are not guaranteed to
work. Background-tab throttling or slow game processing can make batches slower.
The last guess does not require a trailing pacing delay.

Stop interrupts pending waits and clears an unchanged, not-yet-submitted draft
inserted by the runner, but cannot undo a guess already clicked. Reloading
or closing the page ends the batch; changing the URL stops it at the next check.
Finishing a puzzle or losing the guess controls stops further submissions.
Progress is in memory only and is not resumed after a page reload.

The extension refuses to start with text already in the guess box, and stops if
it detects changed text, missing controls, or a submission that does not clear.
It cannot detect every game transition that happens without a URL or control
change. Stop a batch before switching puzzles.

### Backup and privacy

**Export JSON** downloads saved groups and pacing. **Import JSON** validates a
backup and asks before replacing existing settings. Unsaved edits are not exported.
Groups are stored in `chrome.storage.local`, not synced to another device.
Uninstalling the extension removes its local storage, so export first.

The extension makes no network requests of its own, reads no hidden puzzle data,
and sends no telemetry. Guesses go through the game's existing behavior.
Permissions are limited to local extension storage, enabling the toolbar action
on Redactle, and a content script restricted to `https://redactle.net/*`.

## Development

Requires Node.js 18+ for tests; Node is **not** needed to install or use the extension.

```sh
npm test
```

- `background.js`: site-specific toolbar availability.
- `content.js`: page-side guess runner and popup messaging.
- `popup.*`: group selection, status, start/stop.
- `options.*`: group editor, pacing, JSON import/export.
- `core.js`: shared validation and parsing.

The integration depends on `#guess-form`, `#input-guess`, and `#submit`.
These selectors may need updating if Redactle changes its markup. It does not
depend on minified internal function names.

### Manual acceptance checks

On an unfinished archive puzzle:

- Create and edit two groups; verify persistence after closing settings.
- Submit a three-word group; verify guesses reach history in order.
- Close/reopen the popup during a longer batch; verify progress continues.
- Stop mid-batch; confirm further guesses cease.
- Verify a second start is rejected while a batch is running.
- Try starting with a manual guess in the input; verify it is not overwritten.
- Run a group containing a previously guessed word.
- Finish or navigate away from the puzzle during a batch.
- Export, modify settings, import, and confirm restoration.
- Cancel an import and try malformed JSON; confirm saved data remains unchanged.
- Verify the toolbar action is disabled on other websites.
