# MINK — JavaScript single-player port

Original game, artwork, and level by **Attila Incze**. This folder contains a
dependency-free browser port of the Pascal game. No multiplayer or IPX code is used.

## Play

Double-click **index.html**. No installation, build, network connection, or server
is required. On desktop, choose 1–19 bots and click **START GAME**.

On phones and tablets with a primary touch pointer, the game starts immediately
with **10 bots**, without a start or pause menu. The arena fills the available
viewport in portrait or landscape. Sprites retain their proportions; the mobile
camera's visible area adapts to the screen, while desktop retains its original
320 × 200 view and controls.

- **Left stick:** drag to move in screen directions, independently of aiming.
- **Right stick:** hold to fire; drag to choose the firing direction. Releasing
  stops firing. Both sticks work at the same time.
- **Weapon display (top right):** tap to cycle through owned weapons with ammo.
- Switching apps pauses the simulation and clears touches; returning resumes it
  automatically. Rotating the phone also clears held touches.

Browser fullscreen is requested on the first completed touch gesture where the
Fullscreen API is supported. Browsers require a user gesture, so it cannot be
forced on page load. Unsupported browsers still use the full available viewport.
On iPhone, launching from an Add to Home Screen shortcut can hide browser chrome.
For desktop testing or touch devices that report a primary mouse, append
`?controls=touch` to the game URL to select touch mode explicitly.

If you prefer a local server and have Node.js installed:

```sh
node server.cjs
```

Then open http://127.0.0.1:8080. An alternative port can be supplied as an argument.

## Controls

| Control | Action |
| --- | --- |
| Mouse | Aim |
| Left mouse button (hold) | Fire |
| W / S | Move forward / backward **relative to aim**, as in the original |
| A / D | Strafe left / right relative to aim |
| 1–6, or weapon bar | Select a collected weapon with ammunition |
| Escape | Pause / resume |
| Tab (hold) | Scoreboard |
| F, or FULLSCREEN | Toggle fullscreen |

On desktop, leaving the window or switching tabs pauses the game. Release and press movement
or fire again after resuming. The original pixel-number HUD shows **frags** at
the upper left, **ammunition** at the top center, and **health** at the upper right.
Pick up the original weapon and health items on the map. Players drop inventory
on death and automatically respawn.

## Preserved

- The game loads the 68 original sprites it needs and the original `LEVEL1.DAT`
  from the self-contained `assets.js` bundle. The tests verify the bundle's hash.
  If the optional `original-data/` archive is present, its 76 original `.DAT` files
  are also verified against their SHA-256 manifest; the checkout does not require it.
- Sprite bytes are decoded in the Pascal files' column-first order. The three
  level layers are decoded in row order. Palette index 255 stays transparent.
- Standard BIOS VGA palette; player-color replacement; original four walking
  frames and eight discrete orientations generated using the source rotation.
- 32 × 20 tile layout (640 × 400 pixels), collision tiles, and pickup positions.
- Fixed 320 × 200 desktop viewport. Both axes scroll in four-pixel steps with the original
  dead zone and overshoot thresholds, clamped to the map. A larger window scales
  pixels by whole-number factors; it does not show more of the level.
- Aim-relative movement, weapon spread/damage/ammo, hitscan bullets, moving
  rockets, blast damage, health, scoring, dropped bags, and original effect sprites.
- Simple bots: move forward, fire, periodically turn toward the nearest opponent.
- Initial sidearm with 30 rounds.
- The original has no sound calls in the main game; this port is also silent.

## Deliberate fixes and implementation differences

This is a source-based port, not a DOS emulator or a claim of cycle-exact behavior.
The original executable has not been run as a visual/timing reference yet.

- A fixed **70 Hz** simulation approximates the VGA retrace loop independently
  of monitor refresh rate. Original assembly drawing is replaced with a Canvas
  indexed framebuffer, using nearest-neighbor scaling and no smoothing.
- Modern keyboard events allow simultaneous keys. Mouse coordinates map directly
  into the viewport instead of using the DOS driver's recentering routine.
- The initial camera centers on the spawn; subsequent scrolling uses the original
  camera rules. This avoids starting with the player offscreen.
- Spawn bounds use the correct level height, reject occupied/walled tiles, and
  have bounded retries. The Pascal routine used the level width for both axes.
- Respawns give the same sidearm and 30 rounds as the initial spawn, for humans
  and bots. The Pascal code's slot 6 / 10,000-round respawn loadout caused the
  arena to escalate into instant-kill rapid fire after deaths; it is corrected here.
- Array limits, ray bounds, negative scores, last-round weapon selection, and
  uninitialized variables are handled safely rather than reproducing memory bugs.
- Pickup respawns take 1,000 simulation ticks (about 14 seconds). This corresponds
  to the old 20-slot scan advancing its 20,000 counter; the new timer is explicit.
- Weapon labels are descriptive names inferred from behavior; the Pascal source
  identifies them by number. Original bullets remain invisible hitscan rays.
- Menu, bot selector, pause/focus handling, fullscreen, weapon bar and scoreboard
  are new browser conveniences. The simulation pauses while the pause menu is open.

## Source layout

- `core.js` — independent simulation, camera, collision, combat, bots, timers.
- `renderer.js` — VGA palette, sprite orientations, indexed-pixel Canvas renderer.
- `app.js` — browser input, fixed-step loop, menus and inventory UI.
- `touch.js` — mobile stick geometry and independent movement/aim input.
- `index.html`, `style.css` — local game page.
- `assets.js` — generated self-contained original asset bundle; no fetch needed.
- `tools/import-assets.cjs` — regenerate from the neighboring Pascal folder.
- `tools/standalone.cjs` — optional single-file HTML edition (`node tools/standalone.cjs`).
- `tests/game.test.cjs` — asset, camera, collision, combat and long-run checks.

From this directory, with Node.js:

```sh
node tools/import-assets.cjs "../Part Pascal"
node --test tests/game.test.cjs
node --test tests/mobile.test.cjs
```

The Pascal folder is read only by the optional importer. Running the game never
reads or writes that folder. No external libraries, fonts, telemetry or accounts.
