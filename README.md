# usage-band

A Claude Code mod that shows your plan usage at the right end of the hint line under the prompt:

```
⏵⏵ bypass permissions on (shift+tab to cycle) · esc to interrupt        5h 34% (4h0m) · 7d 93% (3d4h) · ctx 41% · $1.23
```

- **5h / 7d**: how much of the 5-hour and weekly rate limits is used, and when each resets (other windows, such as a spend limit, show too).
- **ctx**: how full the context window of the conversation is.
- **$**: what the session has cost so far.

The engine's hint line stays as it is; the usage is added to its end, in the line's dim color. The figures update after each model response. The rate limits appear only on a Claude subscription (Pro/Max), and nothing shows before the first response. Where the line is short, the reset times go first, then the whole usage.

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
