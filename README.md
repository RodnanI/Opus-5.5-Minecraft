# VoxelCraft: Opus 5 edition

Open `minecraft.html` in Chrome, Edge or Firefox. It is a single standalone file with no external requests.

## Update 3: the End, three new vehicles, fixes

**The End**
- **Getting there.**
  - Craft eyes of ender (ember powder + ender pearl) and throw them. Each flies about 12 blocks toward the nearest stronghold and usually drops back so you can reuse it.
  - Strongholds are underground: stone-brick corridors, a library, a storeroom, and a portal room with twelve end portal frames over a lava pit.
  - Put an eye in every frame to open the portal.
  - `/locate stronghold` also finds one.
- **The main island.** End stone under a violet starfield sky.
  - Ten obsidian pillars ring the island, each topped by an end crystal. Two of the crystals are caged in iron bars.
  - The exit portal and its bedrock fountain sit in the middle.
- **The Ender Dragon.**
  - It circles the pillars and heals from nearby crystals (you can see the beams).
  - It strafes you with fireballs that leave clouds of dragon's breath, and it charges.
  - It lands on the fountain to breathe on anyone nearby.
  - It smashes through any blocks you build except obsidian, end stone and bedrock.
  - Hits to the head do full damage; the body, wings and tail take much less. Arrows, melee and every vehicle weapon hit the individual parts, and jet missiles can lock onto it.
  - Blowing up the crystal that is currently healing it also hurts it.
  - A boss bar and its own music play during the fight.
- **When it dies.** A ten-second death sequence with beams of light and a lot of XP.
  - The exit portal lights up and the dragon egg appears. The egg teleports away when you touch it; drop it onto a torch to collect it.
  - An end gateway opens, and you can put four end crystals on the portal rim to summon the dragon again.
- **Going home.** The exit portal takes you back to your spawn point. The first time, it plays an original credits roll.
- **The outer islands**, about 1000 blocks out, reached through the gateway (walk in, or throw an ender pearl into it).
  - Chorus forests: chorus fruit teleports you when eaten, and pops into purpur in a furnace.
  - End cities: purpur towers with end rods and loot chests.
  - End ships: each one guarantees an **elytra** and fireworks.
  - Gateways link back and forth.
- **Elytra.**
  - Wear it in the chest slot, jump, and press jump again in mid-air to glide. It uses the original's glide physics: diving builds speed and pulling up trades speed for height.
  - Use firework rockets to boost. Crashing into a wall at speed hurts.
- **Endermen.**
  - They roam the End, and also the overworld at night and warped forests.
  - Look one in the eye and it screams and attacks. A carved pumpkin worn as a helmet protects you.
  - They teleport when hurt, dodge arrows and hate water. They drop ender pearls.
- **Other additions.** New blocks: end stone bricks, purpur blocks and pillars, their slabs, stairs and walls, end rods and chorus plants. The End has its own ambience, music and fog, the void kills anything that falls off an island, and beds explode outside the overworld.

**New vehicles**

| Vehicle | What it does |
|---|---|
| Titan assault mech | A two-legged walker with animated legs. WASD walks toward where you aim and the torso twists to follow the mouse. Arm autocannons, an eight-rocket shoulder salvo, and jump jets whose landing pounds the ground. It climbs one-block steps and stomps small mobs. |
| Nautilus submarine | Steers and dives in 3D under water, floats on the surface, and is beached on land. Headlight beams light up dark water, and it leaves a propeller bubble trail. Pulse laser, torpedoes, and a sonar display with a depth gauge. |
| Mole tunnel borer | A tracked drill. Hold the trigger to bore a 3×3 tunnel in any direction you look, including diagonally up or down. Ores go straight into your inventory and rubble is crushed. Overdrive, and seismic charges for blasting caverns. |

`/vehicle mech|sub|drill`, the Vehicles tab, or craft them (see the recipe book).

**Fixes**
- You can walk from a dirt path onto a house's doorstep or into a raised doorway. Village doors also got proper steps where the ground falls away.
- Vehicle views:
  - the jet, gunship and bomber cockpit views no longer show the ground through the floor or loose pieces of the hull;
  - the bomber's cockpit banks with the aircraft;
  - the tank and bike cockpit cameras sit where the crew would;
  - the underwater effect follows the camera rather than the seat.
- Flat worlds no longer show dark grass rectangles after reloading.
- Ember imps actually spawn in the Nether again.
- Projectiles fly through grass and kelp instead of bursting on them.

## Update 2: sharper, smoother, more content

**Sharper image**
- Textures stay pixel-sharp. On Windows, the browser draws WebGL through Direct3D, and there anisotropic filtering forces blocky textures to be magnified smoothly. That is why grass and held items looked washed out. Block textures now snap to texel centres in the shader and keep anisotropic filtering at a distance. Items, particles and the block-crack overlay use a nearest-neighbour sampler.
- Anti-aliasing only runs on geometry edges, where depth jumps, so texture detail is no longer smeared. A light contrast-adaptive sharpening pass follows it (**Sharpening** in Video settings). The canvas renders at the display's full resolution. That is capped at 2× on high-DPI screens, and lower on the Low and Potato presets. If Auto Quality lowers the internal resolution, the image is upscaled with sharpening.
- Inventory icons are rendered on the GPU at the exact pixel size of each slot, into atlases with gutters. Neighbouring icons can no longer bleed into a slot, and icons stay crisp at any GUI scale or zoom.

**Runs smoothly on more hardware**
- **Auto Quality** (on by default) measures real GPU time with timer queries and adjusts before you notice. It first lowers the internal resolution, then god rays, clouds, water, shadows and bloom, and restores them when there is headroom. Your settings are not changed; it only caps them while needed.
- If the browser is rendering WebGL in software (hardware acceleration off, or a blocklisted driver), the game detects it, starts at the potato preset and shows a warning on the title screen. F3 shows the GPU renderer, render and output resolution, the Auto Quality state and the worker count.
- Chunk streaming is event-driven. A worker gets its next job the moment it finishes one instead of waiting for the next frame, so chunks load much faster.
- At the same quality, GPU time at 1080p dropped from about 3.2 ms to about 2.2 ms:
  - fully enclosed leaf faces are culled (about 40% fewer foliage quads in forests);
  - post-processing was merged into one pass;
  - clouds use early depth rejection when you are below them;
  - the water pass is skipped when no water is visible.

**New content: 258 blocks and 37 items**
- Building: tuff, calcite, more deepslate, blackstone, quartz and prismarine variants, mud bricks, moss, amethyst, and copper blocks that weather over time (scrape them with an axe). Also 16 concrete and concrete-powder colours (powder hardens in water), 16 stained glass panes, and raw metal and netherite blocks.
- A cherry wood set, with doors, trapdoors and fence gates for every wood type, stripped logs (use an axe on a log), and 30 new slabs, 29 new stairs and 20 new walls.
- Functional blocks:
  - campfires and soul campfires (with smoke);
  - blast furnace and smoker (twice the speed, ores only or food only);
  - lamps you can toggle and note blocks (the block underneath sets the instrument);
  - sponges that soak up water;
  - slime blocks you can bounce on;
  - soul lanterns, froglights and chains.
- Items:
  - netherite tools and netherite and chainmail armour;
  - a spyglass (right-click to zoom), compass and clock;
  - ender pearls you can throw to teleport;
  - a fishing rod (cast, wait for the splash, reel in);
  - beetroot, sweet berries, golden carrots and fish.
- World:
  - a cherry grove biome;
  - amethyst geodes, dripstone and lush cave decoration, and glow lichen;
  - coral reefs with sea pickles in warm oceans, and ocean ruins;
  - copper ore;
  - ancient debris, weeping and twisting vines, nether sprouts and gilded blackstone in the Nether;
  - flowers, petals, berry bushes, and fireflies at night.
- Changed behaviour:
  - iron and gold ore now drop raw metal, which you smelt;
  - kelp and seagrass generate again (a water-depth bug prevented them);
  - wooden doors, trapdoors and gates are crafted from the matching planks.

**If it runs slowly on one PC but fast on another**
RAM makes almost no difference; the GPU path does. Press F3 and check the renderer line:
- If it mentions SwiftShader or "Basic Render", the browser is not using the GPU. Turn on hardware acceleration in the browser settings, and check `chrome://gpu`.
- On laptops with two GPUs, Windows often gives the browser the weak integrated one. To fix it, go to Windows Settings → System → Display → Graphics, add the browser, and choose "High performance". Updating the GPU driver also helps.

## Testing locally

`node serve.js` serves `minecraft.html` at http://localhost:8123. Opening the file directly works too.

## What changed from the original build

**Performance**
- Chunk geometry now lives in large per-region vertex buffers (16x16 chunks each). A region draws each layer with one `WEBGL_multi_draw` call instead of one draw call per 16³ section. In testing, a loaded world dropped from hundreds or thousands of draw calls per frame to about 10. If the extension is missing, a plain draw loop without per-section state changes is used instead.
- The shadow map is cached. It only redraws when the sun has moved noticeably, when the camera has moved more than a few blocks, or when nearby chunks change.
- The cave-culling visibility search uses typed arrays and is throttled while chunks stream in.
- Cloud meshes are cached per tile, so moving no longer rebuilds them.
- Shadow maps are no longer recreated on every resize, and several per-frame allocations were removed.

**Visuals**
- Water: layered wave normals, screen-space reflections with binary refinement, refraction with depth-based absorption, caustics on the ground under the water, shoreline foam, and a GGX sun glint.
- Volumetric-style clouds, drawn as a depth-tested sky pass, so you can fly above and through them.
- A round sun with a corona, star tints, and fog that takes its colour from the sky in each direction.
- Light passing through leaves when you look toward the sun, and colour grading.
- Up to 8 dynamic point lights, used by munitions, explosions, engines and a held torch.

**Vehicles** (Vehicles tab in the creative inventory, `/vehicle <type>`, or crafted)

| Vehicle | Weapons |
|---|---|
| Stormcrow interceptor jet | Plasma cannons; Hydra homing missiles with lock-on |
| Wraith flying-wing bomber | Plasma cannon; plasma bombs aimed with a CCIP bomb sight |
| Mantis VTOL gunship | Turret cutting laser that burns through blocks; rocket salvos |
| Viper hover bike | Twin blasters; charged fusion shot |
| Bastion hover tank | Coax blaster; arcing plasma cannon with a predicted-impact ring |

Press F to board or exit a vehicle and F5 to switch cameras. Each vehicle has its own HUD, and the key hints show for a few seconds after you board. The full control list is under Controls & Help.

## Editing

The sources are in `src/` (`shared/` runs in the workers and the main thread, `main/` runs on the main thread only). Rebuild the single file with:

```
node build.js
```
