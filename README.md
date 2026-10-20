# usage-band

A Claude Code mod that shows your plan usage beside the prompt, by default at the right end of the hint line under it:

```
⏵⏵ bypass permissions on (shift+tab to cycle) · esc to interrupt        5h 34% (4h0m) · 7d 93%! (3d4h) · ctx 41% · $1.23
```

- **5h / 7d**: how much of the 5-hour and weekly rate limits is used, and when each resets (other windows, such as a spend limit, show too).
- **ctx**: how full the context window of the conversation is.
- **$**: what the session has cost so far.

The figures update after each model response, and the line redraws each minute, so reset times count down and a window whose reset has passed shows 0%. The rate limits appear only on a Claude subscription (Pro/Max); until a session's first response it shows the last ones it saw, from an earlier session. Where the line is short, the reset times go first, then the last figures one by one.

## Settings

Set on install, and later in the config menu (a change reloads the mod at once):

| Setting | Default | What it does |
| --- | --- | --- |
| Position | `hint-line` | `hint-line`: at the right end of the line under the prompt, in its dim color. `above-prompt`: a right-aligned line above the prompt, percentages colored. |
| Show reset times | on | When each rate-limit window resets, e.g. `(4h0m)`. |
| Show context fill | on | `ctx` |
| Show session cost | on | `$` |
| Warning threshold, % | 90 | From this percentage a value is marked with `!` on the hint line, red above the prompt (yellow from 20 below it). `0` turns it off. |

The hint line takes no colors, hence the two positions.

## Install

In a Claude Code terminal session:

```
/plugin install usage-band --marketplace smitt14ua/claude-usage-band
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

## Develop

```
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```
