# usage-band

A Claude Code mod that shows your plan usage in one compact, right-aligned line above the prompt:

```
5h 34% (4h0m) · 7d 93% (3d4h) · ctx 41% · $1.23
```

- **5h / 7d**: how much of the 5-hour and weekly rate limits is used, and when each resets (other windows, such as a spend limit, show too).
- **ctx**: how full the context window of the conversation is.
- **$**: what the session has cost so far.

Percentages turn yellow from 70% and red from 90%. The figures update after each model response; the rate limits appear only on a Claude subscription (Pro/Max), and the line stays hidden until there is something to show. Collapse it with `ctrl+x ctrl+a` or its `[-]`.

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
