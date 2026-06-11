# Shadow Runner

An HTML5 endless runner where you control **two versions of the same character at once** - one in a light world, one in a dark world. Both are always running. Keep both alive as long as possible.

## Core mechanics

- Two stacked worlds (light on top, dark on bottom), each with its own runner and obstacles
- Two actions per character: jump (crates, spikes) and slide (hanging gates)
- Coins spawn in rows and arcs; consecutive pickups build a combo multiplier
- Speed ramps up over time (capped)
- **Sync events**: both worlds occasionally face the same obstacle - one input jumps both runners
- **Freeze power-up**: collecting it freezes the *other* world for a few seconds (a frozen world scores nothing)
- You lose when either runner hits an obstacle. Score = distance survived.

## Controls

| Platform | Light runner (top) | Dark runner (bottom) |
|---|---|---|
| Desktop | `W` jump / `S` slide | `↑` jump / `↓` slide |
| Mobile | Tap = jump, swipe down = slide (top half) | Tap = jump, swipe down = slide (bottom half) |

## Tech stack

- [Phaser 3](https://phaser.io/) - game engine (HTML5)
- JavaScript (ES modules) + [Vite](https://vitejs.dev/)
- [Howler.js](https://howlerjs.com/) - audio (starts muted, portal requirement)
- Hosting target: Cloudflare Pages

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build -> dist/
npm run preview  # preview the production build
```

## Deployment (Cloudflare Pages)

- Build command: `npm run build`
- Output directory: `dist`

## Roadmap

- [ ] Portal SDK integrations (Poki, CrazyGames) via `src/platform/PortalAdapter.js`
- [ ] Supabase leaderboard with **server-side score validation** (Edge Function, plausibility checks) - see `src/services/Leaderboard.js`
- [ ] Real art + audio assets
- [ ] Retention hooks: daily best, skins
- [ ] YouTube Playables packaging
