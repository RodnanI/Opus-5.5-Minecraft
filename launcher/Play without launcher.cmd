@echo off
rem Starts VoxelCraft in a private Chrome, Edge or Brave window with the main switches of the launcher (no frame-rate
rem limit, no throttling, 4 GB heap), for a PC where VoxelCraft.exe cannot run. VoxelCraft.exe has every other option.
setlocal
set "GAME=%~dp0game\minecraft.html"
set "PROFILE=%LOCALAPPDATA%\VoxelCraft\Profile"
set "B="
for %%P in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
  "%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"
) do if not defined B if exist %%P set "B=%%~P"
if not defined B (
  echo No Chrome, Edge or Brave found. Install one of them, or use VoxelCraft.exe with a custom browser path.
  pause
  exit /b 1
)
set "URL=file:///%GAME:\=/%?launcher=1&uncapped=1"
start "" "%B%" "--user-data-dir=%PROFILE%" --no-first-run --no-default-browser-check --disable-frame-rate-limit --disable-gpu-vsync --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion --autoplay-policy=no-user-gesture-required --ignore-gpu-blocklist "--js-flags=--max-old-space-size=4096" --start-fullscreen "--app=%URL%"
