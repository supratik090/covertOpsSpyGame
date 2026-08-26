# Shadow Protocol — Home Screen Screenshot Placeholders

Place your actual game screenshots in this directory to populate the home page gallery.

## Required Image Files

| Filename | Path | Size Recommendation | Description |
|---|---|---|---|
| `tactical_hud.png` | `/public/assets/screenshots/tactical_hud.png` | 800×500 px | The main tactical map HUD showing city node graph, agent/team positions, scan overlays (CCTV, satellite, phone tap icons), and the side panel. Best captured mid-game with several active agents deployed. |
| `intel_dossier.png` | `/public/assets/screenshots/intel_dossier.png` | 800×500 px | The suspect dossier / clue timeline view — showing at least one tracked operative with several sightings in the timeline, the dossier card, and assessment tags (ACCEPT/REJECT). |
| `raid_ops.png` | `/public/assets/screenshots/raid_ops.png` | 800×500 px | A raid confirmation dialog or the post-raid result modal showing safehouse casualty/escape breakdown. Alternatively, the combat action panel in the city drawer during a raid action. |
| `scenario_select.png` | `/public/assets/screenshots/scenario_select.png` | 800×500 px | The scenario selection screen listing available operations (e.g., Operation Silent Edge, Operation Coastal Thunder). Ideally shows the list with flag icons and session status. |

## Notes
- All images are `16:10` aspect ratio in the gallery cards (`object-fit: cover`).
- If an image file is missing, the gallery card automatically shows a styled placeholder with the description text above.
- Recommended format: **PNG** or **WEBP** for quality. Keep file size under **1MB** each for fast load.
- You can use any resolution as long as it's at least 800px wide — the CSS `object-fit: cover` handles cropping.
