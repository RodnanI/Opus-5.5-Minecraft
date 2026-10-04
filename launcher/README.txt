VoxelCraft - desktop edition for Windows 10 and 11
===================================================

Double-click VoxelCraft.exe, check the settings, press PLAY.

What it does
------------
The game is the same single HTML file as minecraft.html (it is in the game folder). A browser tab runs it
with the brakes on: the frame rate is tied to your monitor, background tabs get throttled, and the GPU,
graphics backend and memory limits are whatever the browser picked. VoxelCraft.exe starts the game in a
private, separate instance of a Chromium browser you already have (Chrome, Edge, Brave, Chromium, Vivaldi,
Opera) with all of that under your control:

  - No frame-rate limit or VSync: every frame is presented, hundreds or thousands of FPS on any monitor.
  - Frame rate limit, menu limit, Auto Quality and its target, and the GPU queue (frames in flight: without
    a limit frames pile up on the GPU and the game stutters while new terrain loads).
  - Graphics backend: Direct3D 11, OpenGL, Direct3D 11 on 12 or Vulkan. Which is best depends on your GPU
    and driver. "Run benchmark" on the Play page times each one on your PC, standing still and flying over
    new terrain, and Auto then uses the one with the best steady FPS (the frame rate you see 90% of the
    time, so a backend with a high average but stalls loses).
  - GPU: the high-performance or power-saving adapter, or any specific one.
  - Memory: the JavaScript heap (up to Chromium's 4 GB per page), the garbage collector's young generation,
    a world memory cache that keeps explored terrain in RAM so coming back is instant, the render
    distance limit (up to 64 chunks instead of 24) and the number of terrain worker threads.
  - Process priority, never-throttle, keep-awake, fullscreen / window / monitor, extra Chromium switches and
    extra game parameters (any in-game setting can be forced from here).

Every option is explained in the launcher and in VoxelCraft.ini, which you can also edit by hand.

The private browser instance does not touch your normal browser (its tabs, history or extensions) and can
run while your normal browser is open. Its profile, with your worlds and game settings, is in
%LOCALAPPDATA%\VoxelCraft\Profile ("Data folder" in the launcher).

Your existing worlds
--------------------
Worlds live in the browser that made them. To bring one over: open minecraft.html in that browser,
Singleplayer > select the world > Export, then in the desktop edition Singleplayer > Import.

In the game
-----------
F3 shows the frame rate, CPU and GPU frame time, the frame pacing, the graphics backend and the launcher's
settings. Settings > Video has Max FPS (Unlimited, VSync, or a cap from 30 to 1000), Limit FPS in Menus,
Auto Quality Target and World Memory Cache. F11 switches between fullscreen and a window.

Shortcuts
---------
  VoxelCraft.exe --play        start the game straight away with the saved settings
  VoxelCraft.exe --benchmark   time every graphics backend and keep the fastest
  VoxelCraft.exe --print       show the browser command line it would run
  VoxelCraft.exe --gpus        list graphics adapters, displays and browsers

If VoxelCraft.exe will not run
------------------------------
"Play without launcher.cmd" starts the game in Chrome, Edge or Brave with the main switches (no frame-rate
limit, no throttling, 4 GB heap) and none of the other options.

If Windows SmartScreen or an antivirus warns about VoxelCraft.exe on another PC: it is an unsigned program
built from launcher\VoxelCraftLauncher.cs in the source; "More info > Run anyway" starts it.

Troubleshooting
---------------
  - "No Chromium-based browser found": install Chrome or Edge, or set Advanced > Browser engine > Custom.
  - "The graphics driver stopped responding" or the benchmark marks a backend as failed: that backend is
    unstable with your driver. Pick another one (Direct3D 11 works everywhere). Your world is saved first.
  - It stutters while you explore: check Performance > GPU queue is Auto (or 2-3), not Browser default.
  - Laptop on battery: Windows and the browser may still save power. Plug in for full speed.
