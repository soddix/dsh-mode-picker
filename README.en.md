[中文](README.md) | **English**

# dsh-mode-picker

Pick the agent preset when you start a session. When a new session opens, this plugin locks the composer and lays every agent preset in the deployment out as a grid of buttons next to it. Click one: the buttons collapse, the composer unlocks, and the still-empty session switches to the mode you chose.

## Why it exists

DSH's built-in mode chip is a dropdown, and it only stages a choice that the *next* blank session will claim. This plugin turns that into an explicit starting gate: nothing departs until you choose, and a wrong choice can be changed.

Ecosystem survey (2026-09): nothing under the GitHub `dsh-plugin` topic implemented this shape. The closest relative, [dsh-preset-switch](https://github.com/aorucshiea/dsh-preset-switch), does the opposite — it bypasses the official blank-session lock and switches presets from inside a session.

## It uses official seams only

No new mechanism is invented; everything goes through interfaces the harness already exposes:

| Purpose | Interface | Where it comes from |
| --- | --- | --- |
| Lock the composer | `ctx.conversation.blocks.set(sessionId, { reason })` | the composer block registry in `dsh-client-ui-conversation`; its own source comment calls it "the only way another plugin can hold a session's input" |
| Host the buttons | slot `conversation.hero.agentPreset` | the mode seat reserved for the new-session screen (`single` / `root`) |
| List the modes | `ctx.remote.agentPresets.list()` | the official Remote API, same payload the built-in chip receives |
| Switch the mode | `ctx.remote.agentPresets.select(sessionId, presetId)` | the same API; the host only recomposes **blank** sessions and rejects the call with `agent-preset/locked` once the first turn has been sent |

Reading the current session follows the built-in chip's own approach: `useSessions` for `state.current`, then `state.byId` for that session's `blank` and `projectionValues.agentPreset`. This seat is root-scoped and receives **no** `sessionId` prop, so this is the only way to find it.

## Behaviour

- Blank session and the grid open → the composer is locked, its placeholder becomes "选择一个模式开始这个会话", and the button grid is laid out.
- Pick a mode → it collapses into a pill (`模式 · <current mode> · 切换`) and the composer unlocks.
- Click the pill → reopen the grid at any time to change the choice; while open, the heading names the current mode and a "keep current mode, collapse" action is offered.
- A broken preset's button is disabled, with the host's reason on hover.

## Known tradeoffs

- **Position**: the seat sits **above** the composer, not inside it. The inside layer (`conversation.input.overlay`) does not render on the new-session screen, and reading its fields with an empty session snapshot throws — that was the first version's silent failure.
- **Takeover**: `conversation.hero.agentPreset` is a `single` seat, so while this plugin occupies it the built-in mode chip no longer renders on the new-session screen. That is overlap, not breakage; disabling this plugin restores it.
- The choice is remembered in client memory only; after a page refresh, an empty session asks again (still changeable, nothing is broken).

## Install

From GitHub:

```
dsh plugin --profile web add github:soddix/dsh-mode-picker
```

From a local directory (development):

```
dsh plugin --profile web add link:<absolute path to this directory>
```

Either way, also add `dsh-mode-picker` to `dsh.profile.bundles` in the profile's `package.json` — `dependencies` installs the package, `bundles` decides whether it joins the composition. A page refresh is enough for the client half (it is a static asset fetched when the page loads); changes to the host half (`lib/index.js`) need a restart of `dsh web`.

> Not published to npm; `private: true` stays as-is — it only blocks `npm publish`, not either way of installing above.

## The debug sink, for development

`lib/index.js` provides a write-only diagnostic sink: the client POSTs what it observes to `/dsh-mode-picker/diag` and the host appends it to `diag.log` beside the package. Browser-side plugins are hard to debug by watching a console, so dropping observations into a file **on the machine** keeps the debugging loop local. `diag.log` is in `.gitignore` and never enters the repository.

## License

MIT © 2026 soddix
