// ============================================================================
//  VoxelCraft desktop launcher (Windows 10 / 11)
//
//  Runs the game in a private Chromium instance (Chrome, Edge, Brave, ... whichever is installed), started with
//  switches a normal browser tab never gets: no frame-rate limit or VSync, a chosen GPU and graphics backend, a
//  bigger JavaScript heap, no background throttling, raised process priority. Every option is in VoxelCraft.ini
//  next to the exe (written with explanations) and in the launcher window; the game receives its share through
//  the URL query (LAUNCH in src/main/00_util.js).
//
//  build.js compiles this with the C# 5 compiler of the .NET Framework that ships with every Windows 10 / 11, so
//  nothing has to be installed. Command line:
//    VoxelCraft.exe              launcher window
//    VoxelCraft.exe --play       start the game with the saved settings (for shortcuts)
//    VoxelCraft.exe --benchmark  time every graphics backend and keep the fastest
//    VoxelCraft.exe --print      print the browser command line it would run
//    VoxelCraft.exe --gpus       list graphics adapters, displays and browsers
//    --config <file>             use another settings file
// ============================================================================
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Management;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("VoxelCraft Launcher")]
[assembly: AssemblyProduct("VoxelCraft")]
[assembly: AssemblyDescription("Runs VoxelCraft in a tuned, private Chromium instance")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace VoxelCraftLauncher
{
    static class Program
    {
        public static readonly string Dir = AppDomain.CurrentDomain.BaseDirectory;

        [STAThread]
        static int Main(string[] args)
        {
            string cfgPath = Path.Combine(Dir, "VoxelCraft.ini");
            bool play = false, bench = false, print = false, list = false;
            for (int i = 0; i < args.Length; i++)
            {
                string a = args[i].ToLowerInvariant();
                if (a == "--play") play = true;
                else if (a == "--benchmark") bench = true;
                else if (a == "--print") print = true;
                else if (a == "--gpus") list = true;
                else if (a == "--config" && i + 1 < args.Length) cfgPath = Path.GetFullPath(args[++i]);
            }
            if (print || bench || list) Native.UseParentConsole();
            Config cfg = Config.Load(cfgPath);
            if (!cfg.Existed) { try { cfg.Save(); } catch (Exception) { } }
            Env env = Env.Detect();
            if (list) { Console.WriteLine(env.Report()); return 0; }
            if (print)
            {
                Plan p = Plan.Build(cfg, env, null, null);
                if (p.Error != null) { Console.WriteLine("Error: " + p.Error); return 1; }
                Console.WriteLine(p.Describe());
                Console.WriteLine();
                Console.WriteLine(Native.Quote(p.Exe) + " " + p.ArgString());
                return 0;
            }
            if (bench)
            {
                List<BenchResult> r = Benchmark.Run(cfg, env, delegate(string m) { Console.WriteLine(m); }, delegate { return false; });
                try { cfg.Save(); } catch (Exception e) { Console.WriteLine("Could not save the settings: " + e.Message); }
                return r.Count > 0 ? 0 : 1;
            }
            if (play)
            {
                Plan p = Plan.Build(cfg, env, null, null);
                if (p.Error != null) { MessageBox.Show(p.Error, "VoxelCraft", MessageBoxButtons.OK, MessageBoxIcon.Error); return 1; }
                if (Session.ProfileInUse(p.Profile)) { Session.FocusRunning(p); return 0; }
                Session s = Session.Start(p, cfg);
                s.Wait();
                return 0;
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new LauncherForm(cfg, env));
            return 0;
        }
    }

    // ------------------------------------------------------------------------ options
    enum Kind { Bool, Choice, Number, Text }

    class Opt
    {
        public string Key, Page, Title, Help, Default;
        public Kind Kind;
        public int Min, Max, Step = 1;
        public bool Hidden;
        public List<string> Values = new List<string>(), Labels = new List<string>();
        public Opt Choice(params string[] pairs)
        {
            for (int i = 0; i + 1 < pairs.Length; i += 2) { Values.Add(pairs[i]); Labels.Add(pairs[i + 1]); }
            return this;
        }
        public Opt Range(int min, int max, int step) { Min = min; Max = max; Step = step; return this; }
        public string LabelFor(string v) { int i = Values.IndexOf(v); return i >= 0 ? Labels[i] : v; }
    }

    // Every option: the INI file, the launcher pages and the command line all come from this one list.
    static class Options
    {
        public static readonly List<Opt> All = new List<Opt>();
        public static readonly string[] Pages = { "Performance", "Graphics", "Memory", "Window", "Advanced" };

        static Opt Add(string page, string key, Kind kind, string def, string title, string help)
        {
            Opt o = new Opt { Page = page, Key = key, Kind = kind, Default = def, Title = title, Help = help };
            All.Add(o);
            return o;
        }
        public static Opt Get(string key) { foreach (Opt o in All) if (o.Key == key) return o; return null; }

        static Options()
        {
            // ---------------------------------------------------------------- Performance
            Add("Performance", "uncap_frame_rate", Kind.Bool, "true", "Remove the browser's frame-rate limit",
                "Starts Chromium with --disable-frame-rate-limit and --disable-gpu-vsync, so every frame the game renders is presented: hundreds or thousands of FPS even on a 60 Hz monitor, and the lowest input lag. Turn it off for real VSync (smoother on a fixed-refresh monitor, less heat); while it is on, the game's VSync setting becomes a cap at your refresh rate.");
            Add("Performance", "fps_limit", Kind.Choice, "unlimited", "Frame rate limit",
                "The game's Max FPS, set every time it starts. Game setting leaves whatever you chose in the game's own Settings.")
                .Choice("game", "Game setting", "unlimited", "Unlimited", "vsync", "VSync (refresh rate)", "30", "30", "60", "60", "75", "75", "90", "90", "120", "120", "144", "144", "165", "165", "240", "240", "360", "360", "500", "500", "1000", "1000");
            Add("Performance", "menu_vsync", Kind.Choice, "game", "Limit FPS in menus",
                "The title, pause and loading screens run at the refresh rate instead of flat out, which keeps the GPU quiet while you are not playing.")
                .Choice("game", "Game setting", "on", "On", "off", "Off");
            Add("Performance", "auto_quality", Kind.Choice, "game", "Auto Quality",
                "The game lowers resolution and effects for a moment when the GPU cannot hold the target below, and restores them when it can.")
                .Choice("game", "Game setting", "on", "On", "off", "Off");
            Add("Performance", "auto_quality_target", Kind.Choice, "game", "Auto Quality target",
                "The frame rate Auto Quality holds. A higher target lowers quality sooner on a slower GPU.")
                .Choice("game", "Game setting", "30", "30 FPS", "60", "60 FPS", "90", "90 FPS", "120", "120 FPS", "144", "144 FPS", "165", "165 FPS", "240", "240 FPS", "360", "360 FPS");
            Add("Performance", "gpu_queue", Kind.Choice, "game", "GPU queue (frames in flight)",
                "How many frames may wait on the GPU before the next one starts. Without a limit frames pile up and every terrain upload waits for the backlog: here OpenGL averaged 2000 FPS on a still scene that looked like 20, and Direct3D 11 stalled 87 times a minute while flying. Auto keeps three in flight (two in a normal browser tab). 1 has the lowest input lag; Browser default gives the highest peak FPS on a still scene.")
                .Choice("game", "Game setting (Auto)", "auto", "Auto", "browser", "Browser default (no limit)", "1", "1 (lowest latency)", "2", "2", "3", "3", "4", "4");
            Add("Performance", "process_priority", Kind.Choice, "above_normal", "Process priority",
                "Windows scheduling priority of the game's browser processes (browser, GPU, renderer). Higher keeps background programs from stealing time and causing stutter; High can make other programs sluggish while you play.")
                .Choice("normal", "Normal", "above_normal", "Above normal", "high", "High");
            Add("Performance", "no_background_throttling", Kind.Bool, "true", "Never throttle the game",
                "Stops Chromium from slowing the page down when it decides the window is hidden or in the background (timer throttling, renderer backgrounding, occlusion detection).");
            Add("Performance", "prevent_sleep", Kind.Bool, "true", "Keep the PC awake while playing",
                "Stops Windows from turning the display off or going to sleep during long gamepad sessions.");
            Add("Performance", "hud_refresh", Kind.Choice, "240", "HUD refresh limit",
                "How often the HUD, vehicle displays and cockpit screens redraw. They keep their last picture in between, so redrawing them on every one of a thousand frames a second only costs time.")
                .Choice("60", "60 per second", "120", "120 per second", "144", "144 per second", "240", "240 per second", "360", "360 per second", "0", "Every frame");

            // ---------------------------------------------------------------- Graphics
            Add("Graphics", "angle_backend", Kind.Choice, "auto", "Graphics backend",
                "Chromium's ANGLE layer translates the game's WebGL into one of these. Which is fastest depends on the GPU and driver, sometimes by 5x: run the benchmark on the Play page to find out. Auto uses the benchmark's winner by steady FPS (what you see, stalls included), or Direct3D 11 (every browser's default) until you have run it. Some backends are unstable with some drivers; the benchmark marks those as failed.")
                .Choice("auto", "Auto", "d3d11", "Direct3D 11", "gl", "OpenGL", "d3d11on12", "Direct3D 11 on 12", "vulkan", "Vulkan");
            Add("Graphics", "gpu", Kind.Choice, "high_performance", "GPU",
                "Which graphics adapter renders the game with the Direct3D backends (OpenGL and Vulkan use the GPU Windows gives the browser). High performance picks the discrete GPU on laptops and on PCs that also have integrated graphics.")
                .Choice("high_performance", "High performance", "power_saving", "Power saving", "default", "Browser default");
            Add("Graphics", "preset", Kind.Choice, "game", "Graphics preset",
                "Applies one of the game's presets every time it starts.")
                .Choice("game", "Game setting", "potato", "Potato", "low", "Low", "medium", "Medium", "high", "High", "ultra", "Ultra");
            Add("Graphics", "render_distance", Kind.Choice, "game", "Render distance",
                "Chunks loaded in every direction. Beyond 24 also needs the render distance limit on the Memory page.")
                .Choice("game", "Game setting", "4", "4 chunks", "6", "6 chunks", "8", "8 chunks", "12", "12 chunks", "16", "16 chunks", "20", "20 chunks", "24", "24 chunks", "32", "32 chunks", "40", "40 chunks", "48", "48 chunks", "64", "64 chunks");
            Add("Graphics", "resolution_scale", Kind.Choice, "game", "Resolution scale",
                "Internal 3D resolution, upscaled with sharpening. Below 100% trades sharpness for frame rate.")
                .Choice("game", "Game setting", "1", "100%", "0.9", "90%", "0.8", "80%", "0.7", "70%", "0.6", "60%", "0.5", "50%");
            Add("Graphics", "show_fps", Kind.Choice, "on", "FPS counter",
                "The small FPS counter in the corner. F3 shows the full statistics (frame time, CPU and GPU time, pacing, backend) either way.")
                .Choice("game", "Game setting", "on", "On", "off", "Off");
            Add("Graphics", "ignore_gpu_blocklist", Kind.Bool, "true", "Ignore the GPU blocklist",
                "Uses the graphics card even with drivers Chromium has blocklisted, instead of falling back to slow software rendering.");
            Add("Graphics", "low_latency_canvas", Kind.Bool, "false", "Low-latency canvas",
                "Asks for a desynchronized canvas that can reach the screen without waiting for the page compositor. Presents faster on some systems, may tear or flicker on others.");

            // ---------------------------------------------------------------- Memory
            Add("Memory", "js_heap_mb", Kind.Choice, "auto", "JavaScript heap",
                "Memory the game's JavaScript may use before the browser stops it (--max-old-space-size). Chromium caps a page at about 4 GB however high this is set, and already allows that much on PCs with 16 GB of RAM; on smaller PCs it picks less by itself and this raises it. Terrain data does not count against it (see the world memory cache). Auto: 4 GB with 16 GB of RAM, 3 GB with 8 GB.")
                .Choice("auto", "Auto", "1024", "1 GB", "2048", "2 GB", "3072", "3 GB", "4096", "4 GB");
            Add("Memory", "young_gen_mb", Kind.Choice, "64", "Young generation",
                "Room for short-lived objects (--max-semi-space-size). Larger means fewer garbage collections, so fewer tiny hitches at very high frame rates, for a little more memory.")
                .Choice("auto", "Browser default", "16", "16 MB", "32", "32 MB", "64", "64 MB", "128", "128 MB", "256", "256 MB");
            Add("Memory", "world_cache_mb", Kind.Choice, "auto", "World memory cache",
                "RAM for explored terrain: chunks you leave stay in memory, so coming back skips terrain generation (they are only relit and meshed again). Saves the most on CPUs with few cores. Terrain data is not limited by the JavaScript heap, so this can use several GB. Auto: an eighth of your RAM, up to 4 GB.")
                .Choice("auto", "Auto", "0", "Off", "256", "256 MB", "512", "512 MB", "1024", "1 GB", "2048", "2 GB", "4096", "4 GB", "8192", "8 GB", "16384", "16 GB");
            Add("Memory", "max_render_distance", Kind.Choice, "48", "Render distance limit",
                "The highest render distance the game's slider allows (a browser tab stops at 24). Far distances need a lot of RAM, VRAM and GPU time: 48 chunks keeps about 7,700 chunks loaded, about 1.2 GB of RAM and 1.5 GB of VRAM.")
                .Choice("24", "24 chunks", "32", "32 chunks", "48", "48 chunks", "64", "64 chunks");
            Add("Memory", "worker_threads", Kind.Choice, "auto", "Chunk worker threads",
                "Background threads that generate, light and mesh terrain. More load the world faster on CPUs with many cores. Auto: your CPU threads minus two, up to 12.")
                .Choice("auto", "Auto", "1", "1", "2", "2", "3", "3", "4", "4", "6", "6", "8", "8", "10", "10", "12", "12", "16", "16");

            // ---------------------------------------------------------------- Window
            Add("Window", "window_mode", Kind.Choice, "fullscreen", "Window mode",
                "Fullscreen covers the monitor (F11 switches to a window and back). Window uses the size below.")
                .Choice("fullscreen", "Fullscreen", "maximized", "Maximized window", "windowed", "Window");
            Add("Window", "monitor", Kind.Choice, "primary", "Monitor",
                "The display the game opens on. Its refresh rate is what the game's VSync cap uses.")
                .Choice("primary", "Primary display");
            Add("Window", "window_width", Kind.Number, "1600", "Window width", "Width of the game window in Window mode, in Windows' scaled pixels.").Range(640, 7680, 10);
            Add("Window", "window_height", Kind.Number, "900", "Window height", "Height of the game window in Window mode.").Range(360, 4320, 10);

            // ---------------------------------------------------------------- Advanced
            Add("Advanced", "browser", Kind.Choice, "auto", "Browser engine",
                "The Chromium-based browser that runs the game. It starts as a separate, private instance with its own profile: your normal browsing, tabs and extensions are not touched, and it runs fine while your normal browser is open.")
                .Choice("auto", "Auto (first one found)", "custom", "Custom path (below)");
            Add("Advanced", "browser_path", Kind.Text, "", "Custom browser path",
                "Full path to a Chromium-based browser's .exe, used when Browser engine is Custom.");
            Add("Advanced", "profile_dir", Kind.Text, "", "Profile folder",
                "Where the private browser profile is kept, including your worlds and game settings. Empty means %LOCALAPPDATA%\\VoxelCraft\\Profile.");
            Add("Advanced", "extra_browser_args", Kind.Text, "", "Extra Chromium switches",
                "Added to the browser's command line, for example --force-device-scale-factor=1. --enable-features and --disable-features are merged with the launcher's own.");
            Add("Advanced", "extra_game_params", Kind.Text, "", "Extra game parameters",
                "Added to the game's URL. Any in-game setting can be forced here, for example set.fov=90&set.brightness=0.7 (setting names are in src/main/00_util.js).");
            Add("Advanced", "quiet_browser", Kind.Bool, "true", "Quiet browser",
                "No background networking, component updates or sync in the game's browser instance, so it never competes with the game for CPU or bandwidth.");
            Add("Advanced", "hide_launcher", Kind.Bool, "true", "Hide the launcher while playing",
                "The launcher keeps running in the background to hold the process priority and keep the PC awake.");
            Add("Advanced", "return_to_launcher", Kind.Bool, "true", "Show the launcher when the game closes",
                "Otherwise the launcher exits together with the game.");
            Add("Advanced", "benchmark_seconds", Kind.Number, "8", "Benchmark length",
                "Seconds each of the two phases (looking around, then flying over new terrain) is timed for, per graphics backend.").Range(3, 60, 1);
            Add("Advanced", "remote_debugging_port", Kind.Number, "0", "Remote debugging port",
                "Opens the Chrome DevTools protocol on this port; 0 is off. For development only.").Range(0, 65535, 1);

            // results of the last benchmark (written by the launcher)
            Add("State", "benchmark", Kind.Text, "", "Last benchmark", "Frames per second per backend from the last benchmark, the GPU it ran on and when. Auto backend uses the fastest.").Hidden = true;
        }
    }

    // ------------------------------------------------------------------------ settings file
    class Config
    {
        public readonly string FilePath;
        public bool Existed;
        readonly Dictionary<string, string> v = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        Config(string path) { FilePath = path; }

        public string this[string key]
        {
            get { string s; if (v.TryGetValue(key, out s)) return s; Opt o = Options.Get(key); return o != null ? o.Default : ""; }
            set { v[key] = value ?? ""; }
        }
        public bool Bool(string key) { string s = this[key].Trim().ToLowerInvariant(); return s == "true" || s == "1" || s == "on" || s == "yes"; }
        public int Int(string key, int def)
        {
            int n;
            return int.TryParse(this[key].Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out n) ? n : def;
        }

        public static Config Load(string path)
        {
            Config c = new Config(path);
            if (!File.Exists(path)) return c;
            c.Existed = true;
            foreach (string raw in File.ReadAllLines(path))
            {
                string line = raw.Trim();
                if (line.Length == 0 || line[0] == ';' || line[0] == '#' || line[0] == '[') continue;
                int eq = line.IndexOf('=');
                if (eq <= 0) continue;
                c.v[line.Substring(0, eq).Trim()] = line.Substring(eq + 1).Trim();
            }
            return c;
        }

        public void Save()
        {
            StringBuilder sb = new StringBuilder();
            sb.AppendLine("; VoxelCraft launcher settings. Edit them here or in VoxelCraft.exe (which rewrites this file when it saves).");
            sb.AppendLine("; Lines starting with ; are comments. Unknown or missing keys fall back to the defaults.");
            List<string> pages = new List<string>(Options.Pages); pages.Add("State");
            foreach (string page in pages)
            {
                sb.AppendLine();
                sb.AppendLine("[" + page + "]");
                foreach (Opt o in Options.All)
                {
                    if (o.Page != page) continue;
                    sb.AppendLine();
                    foreach (string l in Wrap(o.Title + ". " + o.Help, 110)) sb.AppendLine("; " + l);
                    if (o.Kind == Kind.Choice) sb.AppendLine("; values: " + string.Join(" | ", o.Values.ToArray()));
                    else if (o.Kind == Kind.Bool) sb.AppendLine("; values: true | false");
                    else if (o.Kind == Kind.Number) sb.AppendLine("; values: " + o.Min + " to " + o.Max);
                    sb.AppendLine(o.Key + " = " + this[o.Key]);
                }
            }
            Directory.CreateDirectory(Path.GetDirectoryName(FilePath));
            File.WriteAllText(FilePath, sb.ToString(), new UTF8Encoding(false));
            Existed = true;
        }

        static IEnumerable<string> Wrap(string s, int width)
        {
            List<string> lines = new List<string>();
            StringBuilder cur = new StringBuilder();
            foreach (string w in s.Split(' '))
            {
                if (cur.Length > 0 && cur.Length + 1 + w.Length > width) { lines.Add(cur.ToString()); cur.Length = 0; }
                if (cur.Length > 0) cur.Append(' ');
                cur.Append(w);
            }
            if (cur.Length > 0) lines.Add(cur.ToString());
            return lines;
        }
    }

    // ------------------------------------------------------------------------ Win32
    static class Native
    {
        [DllImport("kernel32.dll")] static extern bool AttachConsole(int pid);
        [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int n);
        // a GUI exe has no console: print to the one it was started from, unless output is redirected
        public static void UseParentConsole()
        {
            if (GetStdHandle(-11) == IntPtr.Zero && AttachConsole(-1))
            {
                StreamWriter w = new StreamWriter(Console.OpenStandardOutput()); w.AutoFlush = true; Console.SetOut(w);
            }
        }

        [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);
        public const uint ES_CONTINUOUS = 0x80000000, ES_SYSTEM_REQUIRED = 1, ES_DISPLAY_REQUIRED = 2;

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct PROCESSENTRY32
        {
            public uint dwSize, cntUsage, th32ProcessID;
            public IntPtr th32DefaultHeapID;
            public uint th32ModuleID, cntThreads, th32ParentProcessID;
            public int pcPriClassBase;
            public uint dwFlags;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szExeFile;
        }
        [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint pid);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32FirstW(IntPtr snap, ref PROCESSENTRY32 pe);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32NextW(IntPtr snap, ref PROCESSENTRY32 pe);
        [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);

        // a process and everything it started (the browser's GPU, renderer and utility processes)
        public static List<int> ProcessTree(int root)
        {
            Dictionary<int, List<int>> kids = new Dictionary<int, List<int>>();
            IntPtr snap = CreateToolhelp32Snapshot(2, 0);
            List<int> outp = new List<int>();
            if (snap == IntPtr.Zero || snap == new IntPtr(-1)) { outp.Add(root); return outp; }
            try
            {
                PROCESSENTRY32 pe = new PROCESSENTRY32();
                pe.dwSize = (uint)Marshal.SizeOf(typeof(PROCESSENTRY32));
                for (bool ok = Process32FirstW(snap, ref pe); ok; ok = Process32NextW(snap, ref pe))
                {
                    int pp = (int)pe.th32ParentProcessID, id = (int)pe.th32ProcessID;
                    if (pp == id) continue;
                    List<int> l;
                    if (!kids.TryGetValue(pp, out l)) kids[pp] = l = new List<int>();
                    l.Add(id);
                }
            }
            finally { CloseHandle(snap); }
            Queue<int> q = new Queue<int>(); q.Enqueue(root);
            HashSet<int> seen = new HashSet<int>();
            while (q.Count > 0)
            {
                int p = q.Dequeue();
                if (!seen.Add(p)) continue;
                outp.Add(p);
                List<int> l;
                if (kids.TryGetValue(p, out l)) foreach (int k in l) q.Enqueue(k);
            }
            return outp;
        }

        public delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);
        [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
        [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd, StringBuilder sb, int max);
        [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
        [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int cmd);
        [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
        [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd, uint msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder sb, int max);
        public static string ClassName(IntPtr hwnd) { StringBuilder sb = new StringBuilder(256); GetClassName(hwnd, sb, sb.Capacity); return sb.ToString(); }

        // visible top-level windows of a set of processes, with their titles
        public static List<KeyValuePair<IntPtr, string>> Windows(ICollection<int> pids)
        {
            HashSet<int> set = new HashSet<int>(pids);
            List<KeyValuePair<IntPtr, string>> outp = new List<KeyValuePair<IntPtr, string>>();
            EnumWindows(delegate(IntPtr h, IntPtr l)
            {
                uint pid;
                GetWindowThreadProcessId(h, out pid);
                if (set.Contains((int)pid) && IsWindowVisible(h))
                {
                    StringBuilder sb = new StringBuilder(1024);
                    GetWindowText(h, sb, sb.Capacity);
                    if (sb.Length > 0) outp.Add(new KeyValuePair<IntPtr, string>(h, sb.ToString()));
                }
                return true;
            }, IntPtr.Zero);
            return outp;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct DEVMODE
        {
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
            public short dmSpecVersion, dmDriverVersion, dmSize, dmDriverExtra;
            public int dmFields, dmPositionX, dmPositionY, dmDisplayOrientation, dmDisplayFixedOutput;
            public short dmColor, dmDuplex, dmYResolution, dmTTOption, dmCollate;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
            public short dmLogPixels;
            public int dmBitsPerPel, dmPelsWidth, dmPelsHeight, dmDisplayFlags, dmDisplayFrequency;
            public int dmICMMethod, dmICMIntent, dmMediaType, dmDitherType, dmReserved1, dmReserved2, dmPanningWidth, dmPanningHeight;
        }
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern bool EnumDisplaySettings(string device, int mode, ref DEVMODE dm);
        public static int RefreshRate(string device)
        {
            DEVMODE dm = new DEVMODE();
            dm.dmSize = (short)Marshal.SizeOf(typeof(DEVMODE));
            if (!EnumDisplaySettings(device, -1, ref dm)) return 60;
            return dm.dmDisplayFrequency > 1 ? dm.dmDisplayFrequency : 60;
        }

        [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
        [DllImport("user32.dll")] static extern IntPtr MonitorFromPoint(POINT pt, uint flags);
        [DllImport("shcore.dll")] static extern int GetDpiForMonitor(IntPtr mon, int type, out uint dpiX, out uint dpiY);
        // Windows display scaling of the monitor containing a point (1 = 100 %)
        public static double ScaleAt(int x, int y)
        {
            try
            {
                POINT p; p.X = x; p.Y = y;
                IntPtr m = MonitorFromPoint(p, 2);
                uint dx, dy;
                if (GetDpiForMonitor(m, 0, out dx, out dy) == 0 && dx > 0) return dx / 96.0;
            }
            catch (Exception) { }
            return 1;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct MEMORYSTATUSEX { public uint dwLength, dwMemoryLoad; public ulong ullTotalPhys, ullAvailPhys, ullTotalPageFile, ullAvailPageFile, ullTotalVirtual, ullAvailVirtual, ullAvailExtendedVirtual; }
        [DllImport("kernel32.dll")] static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX m);
        public static long RamMB()
        {
            MEMORYSTATUSEX m = new MEMORYSTATUSEX(); m.dwLength = (uint)Marshal.SizeOf(typeof(MEMORYSTATUSEX));
            return GlobalMemoryStatusEx(ref m) ? (long)(m.ullTotalPhys / 1048576) : 8192;
        }

        // one command-line argument, quoted the way CommandLineToArgvW reads it back
        public static string Quote(string a)
        {
            if (a.Length > 0 && a.IndexOfAny(new char[] { ' ', '\t', '"' }) < 0) return a;
            StringBuilder sb = new StringBuilder("\"");
            int bs = 0;
            foreach (char ch in a)
            {
                if (ch == '\\') { bs++; continue; }
                if (ch == '"') { sb.Append('\\', bs * 2 + 1); sb.Append('"'); bs = 0; continue; }
                sb.Append('\\', bs); bs = 0; sb.Append(ch);
            }
            sb.Append('\\', bs * 2); sb.Append('"');
            return sb.ToString();
        }
        // split a command-line fragment typed by the user ("--a=1 "--b=x y"")
        public static List<string> SplitArgs(string s)
        {
            List<string> outp = new List<string>();
            StringBuilder cur = new StringBuilder();
            bool q = false, any = false;
            foreach (char ch in s ?? "")
            {
                if (ch == '"') { q = !q; any = true; continue; }
                if (!q && char.IsWhiteSpace(ch)) { if (cur.Length > 0 || any) { outp.Add(cur.ToString()); cur.Length = 0; any = false; } continue; }
                cur.Append(ch);
            }
            if (cur.Length > 0 || any) outp.Add(cur.ToString());
            return outp;
        }
    }

    // ------------------------------------------------------------------------ graphics adapters (DXGI)
    class Gpu
    {
        public string Name;
        public uint Vendor, Device, LuidLow;
        public int LuidHigh;
        public long VramMB;
        public string Id { get { return string.Format("dev:{0:x4}:{1:x4}", Vendor, Device); } }
        // Chromium's --use-adapter-luid takes the LUID's high and low parts in decimal
        public string LuidArg { get { return ((uint)LuidHigh).ToString(CultureInfo.InvariantCulture) + "," + LuidLow.ToString(CultureInfo.InvariantCulture); } }
        public override string ToString() { return Name + (VramMB > 0 ? " (" + (VramMB >= 1024 ? (VramMB / 1024.0).ToString("0.#", CultureInfo.InvariantCulture) + " GB" : VramMB + " MB") + ")" : ""); }
    }

    static class Gpus
    {
        [DllImport("dxgi.dll")] static extern int CreateDXGIFactory1(ref Guid riid, out IntPtr factory);
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        struct DESC1
        {
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string Description;
            public uint VendorId, DeviceId, SubSysId, Revision;
            public UIntPtr DedicatedVideoMemory, DedicatedSystemMemory, SharedSystemMemory;
            public uint LuidLow;
            public int LuidHigh;
            public uint Flags;
        }
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int EnumAdapters1Fn(IntPtr self, uint i, out IntPtr adapter);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int GetDesc1Fn(IntPtr self, out DESC1 d);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int QueryInterfaceFn(IntPtr self, ref Guid iid, out IntPtr o);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate uint ReleaseFn(IntPtr self);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int EnumByPrefFn(IntPtr self, uint i, int pref, ref Guid iid, out IntPtr adapter);

        // a COM method by vtable slot (IUnknown 0-2, IDXGIObject 3-6, IDXGIFactory 7-11, IDXGIFactory1 12-13,
        // IDXGIFactory6::EnumAdapterByGpuPreference 29; IDXGIAdapter1::GetDesc1 10)
        static T Slot<T>(IntPtr obj, int n) where T : class
        {
            IntPtr vt = Marshal.ReadIntPtr(obj);
            return Marshal.GetDelegateForFunctionPointer(Marshal.ReadIntPtr(vt, n * IntPtr.Size), typeof(T)) as T;
        }
        static void Release(IntPtr o) { if (o != IntPtr.Zero) Slot<ReleaseFn>(o, 2)(o); }
        static Gpu Describe(IntPtr adapter)
        {
            DESC1 d;
            if (Slot<GetDesc1Fn>(adapter, 10)(adapter, out d) < 0 || (d.Flags & 2) != 0) return null;  // skip software adapters
            return new Gpu { Name = (d.Description ?? "GPU").Trim(), Vendor = d.VendorId, Device = d.DeviceId, LuidLow = d.LuidLow, LuidHigh = d.LuidHigh, VramMB = (long)(d.DedicatedVideoMemory.ToUInt64() / 1048576) };
        }

        public static List<Gpu> List(out Gpu highPerf, out Gpu lowPower)
        {
            List<Gpu> outp = new List<Gpu>();
            highPerf = lowPower = null;
            IntPtr f = IntPtr.Zero;
            try
            {
                Guid iid = new Guid("770aae78-f26f-4dba-a829-253c83d1b387");
                if (CreateDXGIFactory1(ref iid, out f) < 0) return outp;
                EnumAdapters1Fn enumA = Slot<EnumAdapters1Fn>(f, 12);
                for (uint i = 0; i < 16; i++)
                {
                    IntPtr a;
                    if (enumA(f, i, out a) < 0) break;
                    try { Gpu g = Describe(a); if (g != null) outp.Add(g); } finally { Release(a); }
                }
                // Windows' own notion of the high-performance and power-saving GPU (Windows 10 1803+)
                Guid iid6 = new Guid("c1b6694f-ff09-44a9-b03c-77900a0a1d17"), iidA = new Guid("29038f61-3839-4626-91fd-086879011a05");
                IntPtr f6;
                if (Slot<QueryInterfaceFn>(f, 0)(f, ref iid6, out f6) >= 0 && f6 != IntPtr.Zero)
                {
                    try
                    {
                        EnumByPrefFn byPref = Slot<EnumByPrefFn>(f6, 29);
                        for (int pref = 1; pref <= 2; pref++)
                        {
                            IntPtr a;
                            if (byPref(f6, 0, pref, ref iidA, out a) < 0) continue;
                            try
                            {
                                Gpu g = Describe(a);
                                if (g == null) continue;
                                Gpu m = outp.Find(delegate(Gpu x) { return x.LuidLow == g.LuidLow && x.LuidHigh == g.LuidHigh; }) ?? g;
                                if (pref == 2) highPerf = m; else lowPower = m;
                            }
                            finally { Release(a); }
                        }
                    }
                    finally { Release(f6); }
                }
            }
            catch (Exception) { }
            finally { Release(f); }
            if (highPerf == null && outp.Count > 0)
            {
                highPerf = outp[0];
                foreach (Gpu g in outp) if (g.VramMB > highPerf.VramMB) highPerf = g;
            }
            if (lowPower == null && outp.Count > 0) lowPower = outp[0];
            return outp;
        }
    }

    // ------------------------------------------------------------------------ what is installed
    class Browser
    {
        public string Id, Name, Path, Version;
        public override string ToString() { return Name + (string.IsNullOrEmpty(Version) ? "" : " " + Version); }
    }

    class Display
    {
        public Screen Screen;
        public int Hz;
        public string Id { get { return Screen.DeviceName; } }
        public string Label(int i)
        {
            Rectangle b = Screen.Bounds;
            return "Display " + (i + 1) + ": " + b.Width + "x" + b.Height + " @ " + Hz + " Hz" + (Screen.Primary ? " (primary)" : "");
        }
    }

    class Env
    {
        public List<Browser> Browsers = new List<Browser>();
        public List<Gpu> Gpus = new List<Gpu>();
        public Gpu HighPerf, LowPower;
        public List<Display> Displays = new List<Display>();
        public long RamMB;
        public int Threads;

        // Chromium-based browsers, best first: where their installers put them
        static readonly string[][] Known = {
            new[] { "chrome", "Google Chrome", @"Google\Chrome\Application\chrome.exe" },
            new[] { "edge", "Microsoft Edge", @"Microsoft\Edge\Application\msedge.exe" },
            new[] { "brave", "Brave", @"BraveSoftware\Brave-Browser\Application\brave.exe" },
            new[] { "chromium", "Chromium", @"Chromium\Application\chrome.exe" },
            new[] { "thorium", "Thorium", @"Thorium\Application\thorium.exe" },
            new[] { "vivaldi", "Vivaldi", @"Vivaldi\Application\vivaldi.exe" },
            new[] { "opera", "Opera", @"Programs\Opera\opera.exe" },
            new[] { "operagx", "Opera GX", @"Programs\Opera GX\opera.exe" },
            new[] { "yandex", "Yandex Browser", @"Yandex\YandexBrowser\Application\browser.exe" },
            new[] { "chrome-beta", "Google Chrome Beta", @"Google\Chrome Beta\Application\chrome.exe" },
            new[] { "chrome-dev", "Google Chrome Dev", @"Google\Chrome Dev\Application\chrome.exe" },
            new[] { "chrome-canary", "Google Chrome Canary", @"Google\Chrome SxS\Application\chrome.exe" },
            new[] { "edge-beta", "Microsoft Edge Beta", @"Microsoft\Edge Beta\Application\msedge.exe" },
            new[] { "edge-dev", "Microsoft Edge Dev", @"Microsoft\Edge Dev\Application\msedge.exe" },
        };

        public static Env Detect()
        {
            Env e = new Env();
            e.RamMB = Native.RamMB();
            e.Threads = Environment.ProcessorCount;
            List<string> roots = new List<string>();
            foreach (Environment.SpecialFolder sf in new[] { Environment.SpecialFolder.ProgramFiles, Environment.SpecialFolder.ProgramFilesX86, Environment.SpecialFolder.LocalApplicationData })
            {
                string r = Environment.GetFolderPath(sf);
                if (!string.IsNullOrEmpty(r) && !roots.Contains(r)) roots.Add(r);
            }
            string pf64 = Environment.GetEnvironmentVariable("ProgramW6432");
            if (!string.IsNullOrEmpty(pf64) && !roots.Contains(pf64)) roots.Insert(0, pf64);
            foreach (string[] k in Known)
            {
                string found = null;
                foreach (string r in roots) { string p = Path.Combine(r, k[2]); if (File.Exists(p)) { found = p; break; } }
                if (found == null && (k[0] == "chrome" || k[0] == "edge" || k[0] == "brave"))
                    found = AppPath(k[0] == "chrome" ? "chrome.exe" : k[0] == "edge" ? "msedge.exe" : "brave.exe");
                if (found == null) continue;
                string ver = "";
                try { ver = FileVersionInfo.GetVersionInfo(found).ProductVersion ?? ""; } catch (Exception) { }
                e.Browsers.Add(new Browser { Id = k[0], Name = k[1], Path = found, Version = ver });
            }
            e.Gpus = VoxelCraftLauncher.Gpus.List(out e.HighPerf, out e.LowPower);
            foreach (Screen s in Screen.AllScreens) e.Displays.Add(new Display { Screen = s, Hz = Native.RefreshRate(s.DeviceName) });
            return e;
        }

        static string AppPath(string exe)
        {
            foreach (RegistryKey hive in new[] { Registry.LocalMachine, Registry.CurrentUser })
            {
                try
                {
                    using (RegistryKey k = hive.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\" + exe))
                    {
                        string p = k == null ? null : k.GetValue("") as string;
                        if (!string.IsNullOrEmpty(p)) { p = p.Trim('"'); if (File.Exists(p)) return p; }
                    }
                }
                catch (Exception) { }
            }
            return null;
        }

        public Browser PickBrowser(string id, string custom)
        {
            if (id == "custom")
            {
                string p = Environment.ExpandEnvironmentVariables((custom ?? "").Trim().Trim('"'));
                if (p.Length == 0 || !File.Exists(p)) return null;
                string ver = "";
                try { ver = FileVersionInfo.GetVersionInfo(p).ProductVersion ?? ""; } catch (Exception) { }
                return new Browser { Id = "custom", Name = Path.GetFileNameWithoutExtension(p), Path = p, Version = ver };
            }
            foreach (Browser b in Browsers) if (b.Id == id) return b;
            return Browsers.Count > 0 ? Browsers[0] : null;
        }

        public Gpu PickGpu(string id)
        {
            if (id == "default") return null;
            if (id == "power_saving") return LowPower;
            if (id.StartsWith("dev:")) foreach (Gpu g in Gpus) if (g.Id == id) return g;
            return HighPerf;
        }

        public Display PickDisplay(string id)
        {
            foreach (Display d in Displays) if (d.Id == id) return d;
            foreach (Display d in Displays) if (d.Screen.Primary) return d;
            return Displays.Count > 0 ? Displays[0] : null;
        }

        public int AutoWorkers() { return Math.Max(2, Math.Min(12, Threads - 2)); }
        public int AutoHeapMB() { return RamMB >= 15000 ? 4096 : RamMB >= 7500 ? 3072 : 2048; }
        public int AutoCacheMB() { return (int)Math.Max(256, Math.Min(4096, RamMB / 8 / 256 * 256)); }

        public string Report()
        {
            StringBuilder sb = new StringBuilder();
            sb.AppendLine("Graphics adapters:");
            foreach (Gpu g in Gpus) sb.AppendLine("  " + g + "  " + g.Id + "  luid " + g.LuidArg + (g == HighPerf ? "  [high performance]" : "") + (g == LowPower ? "  [power saving]" : ""));
            sb.AppendLine("Displays:");
            for (int i = 0; i < Displays.Count; i++) sb.AppendLine("  " + Displays[i].Label(i) + "  " + Displays[i].Id + "  scale " + Native.ScaleAt(Displays[i].Screen.Bounds.Left + 10, Displays[i].Screen.Bounds.Top + 10));
            sb.AppendLine("Browsers:");
            foreach (Browser b in Browsers) sb.AppendLine("  " + b + "  " + b.Path);
            sb.AppendLine("Memory: " + RamMB + " MB, CPU threads: " + Threads);
            return sb.ToString();
        }
    }

    // ------------------------------------------------------------------------ the browser command line
    class Plan
    {
        public string Error, Exe, Profile, Url, Backend, BackendWhy, GameFile;
        public Browser Browser;
        public Gpu Gpu;
        public Display Display;
        public int Heap, Cache, Workers, MaxRd, Hz;
        public bool Uncapped, FullscreenLater;
        public List<string> Args = new List<string>();

        public static string ProfileDir(Config c)
        {
            string p = Environment.ExpandEnvironmentVariables(c["profile_dir"].Trim().Trim('"'));
            if (p.Length == 0) p = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "VoxelCraft", "Profile");
            return Path.GetFullPath(p);
        }

        public static string BackendName(string b)
        {
            Opt o = Options.Get("angle_backend");
            return b == "auto" ? "Auto" : o.LabelFor(b);
        }

        // backendOverride: run with this backend (benchmark); extraQuery: added to the game URL
        public static Plan Build(Config c, Env env, string backendOverride, string extraQuery)
        {
            Plan p = new Plan();
            p.Browser = env.PickBrowser(c["browser"], c["browser_path"]);
            if (p.Browser == null)
            {
                p.Error = c["browser"] == "custom"
                    ? "The custom browser path does not point to an existing .exe: " + c["browser_path"]
                    : "No Chromium-based browser was found (Chrome, Edge, Brave, Chromium, Vivaldi, Opera). Install one, or choose Custom under Advanced > Browser engine and point it at the browser's .exe.";
                return p;
            }
            p.Exe = p.Browser.Path;
            p.GameFile = Path.Combine(Program.Dir, "game", "minecraft.html");
            if (!File.Exists(p.GameFile)) { p.Error = "The game file is missing: " + p.GameFile + "\nRebuild with node build.js."; return p; }
            p.Profile = ProfileDir(c);

            // graphics backend: Auto takes the benchmark winner for this GPU
            string be = backendOverride ?? c["angle_backend"];
            if (be == "auto")
            {
                string best = Benchmark.Best(c, env);
                if (best != null) { be = best; p.BackendWhy = "best steady FPS in your benchmark"; }
                else { be = "d3d11"; p.BackendWhy = "Chromium's default; run the benchmark to find the fastest"; }
            }
            p.Backend = be;
            p.Gpu = env.PickGpu(c["gpu"]);
            p.Display = env.PickDisplay(c["monitor"]);
            p.Hz = p.Display != null ? p.Display.Hz : 60;
            p.Uncapped = c.Bool("uncap_frame_rate");

            string hv = c["js_heap_mb"], yv = c["young_gen_mb"], cv = c["world_cache_mb"], wv = c["worker_threads"];
            p.Heap = hv == "auto" ? env.AutoHeapMB() : Math.Max(512, c.Int("js_heap_mb", 4096));
            p.Cache = cv == "auto" ? env.AutoCacheMB() : Math.Max(0, c.Int("world_cache_mb", 1024));
            p.Workers = wv == "auto" ? env.AutoWorkers() : Math.Max(1, Math.Min(32, c.Int("worker_threads", 6)));
            p.MaxRd = Math.Max(8, Math.Min(64, c.Int("max_render_distance", 48)));

            List<string> a = p.Args, disable = new List<string>(), enable = new List<string>();
            a.Add("--user-data-dir=" + p.Profile);
            a.Add("--no-first-run");
            a.Add("--no-default-browser-check");
            a.Add("--disable-session-crashed-bubble");
            a.Add("--hide-crash-restore-bubble");
            a.Add("--autoplay-policy=no-user-gesture-required");
            a.Add("--disable-pinch");
            a.Add("--overscroll-history-navigation=0");
            disable.Add("Translate");
            if (p.Uncapped) { a.Add("--disable-frame-rate-limit"); a.Add("--disable-gpu-vsync"); }
            if (c.Bool("no_background_throttling"))
            {
                a.Add("--disable-background-timer-throttling");
                a.Add("--disable-renderer-backgrounding");
                a.Add("--disable-backgrounding-occluded-windows");
                disable.Add("CalculateNativeWinOcclusion");
                disable.Add("IntensiveWakeUpThrottling");
            }
            if (c.Bool("quiet_browser"))
            {
                a.Add("--disable-background-networking");
                a.Add("--disable-component-update");
                a.Add("--disable-sync");
                a.Add("--no-pings");
            }
            if (be != "default") a.Add("--use-angle=" + be);
            // --use-adapter-luid only works with ANGLE's Direct3D backends
            if (p.Gpu != null && (be == "d3d11" || be == "d3d11on12")) a.Add("--use-adapter-luid=" + p.Gpu.LuidArg);
            if (c.Bool("ignore_gpu_blocklist")) a.Add("--ignore-gpu-blocklist");
            string js = "--max-old-space-size=" + p.Heap;
            if (yv != "auto") js += " --max-semi-space-size=" + Math.Max(1, c.Int("young_gen_mb", 64));
            a.Add("--js-flags=" + js);

            // window: Chromium takes positions and sizes in Windows' scaled pixels
            if (p.Display != null)
            {
                Rectangle b = p.Display.Screen.Bounds;
                double s = Native.ScaleAt(b.Left + b.Width / 2, b.Top + b.Height / 2);
                int bx = (int)Math.Round(b.Left / s), by = (int)Math.Round(b.Top / s), bw = (int)Math.Round(b.Width / s), bh = (int)Math.Round(b.Height / s);
                string mode = c["window_mode"];
                if (mode == "windowed")
                {
                    int w = Math.Min(bw, Math.Max(640, c.Int("window_width", 1600))), h = Math.Min(bh, Math.Max(360, c.Int("window_height", 900)));
                    a.Add("--window-size=" + w + "," + h);
                    a.Add("--window-position=" + (bx + (bw - w) / 2) + "," + (by + (bh - h) / 2));
                }
                else
                {
                    // Chromium's OpenGL and Vulkan backends fail in a window that opens fullscreen (WebGL becomes
                    // unavailable, or the browser hangs), but switch fine later: open maximized, press F11 once the game runs.
                    // (A window size would make Chromium ignore --start-maximized; the position picks the monitor.)
                    bool d3d = be == "d3d11" || be == "d3d11on12", full = mode == "fullscreen" && d3d;
                    a.Add("--window-position=" + (full ? bx : bx + 40) + "," + (full ? by : by + 40));
                    if (full) { a.Add("--window-size=" + bw + "," + bh); a.Add("--start-fullscreen"); }
                    else a.Add("--start-maximized");
                    p.FullscreenLater = mode == "fullscreen" && !d3d;
                }
            }
            int port = c.Int("remote_debugging_port", 0);
            if (port > 0) a.Add("--remote-debugging-port=" + port);
            foreach (string x in Native.SplitArgs(c["extra_browser_args"]))
            {
                if (x.StartsWith("--disable-features=")) disable.AddRange(x.Substring(19).Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries));
                else if (x.StartsWith("--enable-features=")) enable.AddRange(x.Substring(18).Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries));
                else a.Add(x);
            }
            // Chromium honours only one of each, so every feature goes into a single switch
            if (disable.Count > 0) a.Add("--disable-features=" + string.Join(",", disable.ToArray()));
            if (enable.Count > 0) a.Add("--enable-features=" + string.Join(",", enable.ToArray()));

            // the game's share: engine limits, and set.<setting> overrides for the in-game settings
            List<string> q = new List<string>();
            q.Add("launcher=1");
            q.Add("uncapped=" + (p.Uncapped ? "1" : "0"));
            q.Add("hz=" + p.Hz);
            q.Add("workers=" + p.Workers);
            q.Add("rdmax=" + p.MaxRd);
            q.Add("heap=" + p.Heap);
            q.Add("angle=" + Uri.EscapeDataString(BackendName(be)));
            if (p.Gpu != null) q.Add("gpu=" + Uri.EscapeDataString(p.Gpu.Name));
            q.Add("browser=" + Uri.EscapeDataString(p.Browser.ToString()));
            if (c.Bool("low_latency_canvas")) q.Add("lowlatency=1");
            Set(q, c, "fps_limit", "fpsCap", delegate(string v) { return v == "unlimited" ? "0" : v == "vsync" ? "-1" : v; });
            Set(q, c, "menu_vsync", "menuVsync", OnOff);
            Set(q, c, "auto_quality", "autoQuality", OnOff);
            Set(q, c, "auto_quality_target", "aqTarget", null);
            Set(q, c, "preset", "preset", null);
            Set(q, c, "render_distance", "renderDist", null);
            Set(q, c, "resolution_scale", "resScale", null);
            Set(q, c, "show_fps", "showFps", OnOff);
            Set(q, c, "gpu_queue", "gpuQueue", delegate(string v) { return v == "auto" ? "0" : v == "browser" ? "-1" : v; });
            // Chromium's Vulkan backend loses a WebGL context created while its GPU process is still starting
            // (about every second start here); a second's head start fixed every start that was tried
            if (be == "vulkan") q.Add("bootdelay=1000");
            q.Add("set.hudHz=" + Math.Max(0, c.Int("hud_refresh", 240)));
            q.Add("set.chunkCacheMB=" + p.Cache);
            string extra = c["extra_game_params"].Trim().TrimStart('?', '&');
            if (extra.Length > 0) q.Add(extra);
            if (!string.IsNullOrEmpty(extraQuery)) q.Add(extraQuery);
            p.Url = new Uri(p.GameFile).AbsoluteUri + "?" + string.Join("&", q.ToArray());
            a.Add("--app=" + p.Url);
            return p;
        }

        static string OnOff(string v) { return v == "on" ? "1" : "0"; }
        static void Set(List<string> q, Config c, string key, string setting, Converter<string, string> map)
        {
            string v = c[key];
            if (v == "game" || v.Length == 0) return;
            q.Add("set." + setting + "=" + Uri.EscapeDataString(map != null ? map(v) : v));
        }

        public string ArgString()
        {
            StringBuilder sb = new StringBuilder();
            foreach (string x in Args) { if (sb.Length > 0) sb.Append(' '); sb.Append(Native.Quote(x)); }
            return sb.ToString();
        }

        public string Describe()
        {
            StringBuilder sb = new StringBuilder();
            sb.AppendLine("Browser engine:  " + Browser);
            sb.AppendLine("Graphics:        " + BackendName(Backend) + (BackendWhy != null ? " (" + BackendWhy + ")" : ""));
            sb.AppendLine("GPU:             " + (Gpu != null ? Gpu.ToString() : "the browser's default") + (Gpu != null && Backend != "d3d11" && Backend != "d3d11on12" ? " (OpenGL and Vulkan use the GPU Windows assigns)" : ""));
            sb.AppendLine("Frame rate:      " + (Uncapped ? "frame limiter and VSync off, every frame presented" : "browser VSync (the frame limiter is on)"));
            if (Display != null) sb.AppendLine("Display:         " + Display.Screen.Bounds.Width + "x" + Display.Screen.Bounds.Height + " @ " + Hz + " Hz");
            sb.AppendLine("Memory:          " + Heap + " MB JavaScript heap, " + (Cache > 0 ? Cache + " MB world cache" : "no world cache") + ", render distance up to " + MaxRd + " chunks");
            sb.AppendLine("Chunk workers:   " + Workers + " threads");
            sb.Append("Profile:         " + Profile);
            return sb.ToString();
        }
    }

    // ------------------------------------------------------------------------ the running game
    class Session
    {
        public Process Proc;
        public int Root;
        public Plan Plan;
        public event EventHandler Ended;
        ProcessPriorityClass prio;
        bool keepAwake;
        volatile bool ended;
        readonly ManualResetEvent done = new ManualResetEvent(false);
        readonly HashSet<int> prioSet = new HashSet<int>();

        public bool HasEnded { get { return ended; } }

        // Chromium holds <profile>\lockfile open while an instance runs on that profile
        public static bool ProfileInUse(string profile)
        {
            string f = Path.Combine(profile, "lockfile");
            if (!File.Exists(f)) return false;
            try { using (File.Open(f, FileMode.Open, FileAccess.ReadWrite, FileShare.None)) { } return false; }
            catch (IOException) { return true; }
            catch (Exception) { return false; }
        }

        // browser processes started on a profile (WMI: their command lines carry --user-data-dir)
        public static List<int> FindBrowserPids(string exe, string profile)
        {
            List<int> outp = new List<int>();
            try
            {
                string name = Path.GetFileName(exe).Replace("'", "");
                using (ManagementObjectSearcher s = new ManagementObjectSearcher("SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name = '" + name + "'"))
                    foreach (ManagementObject o in s.Get())
                    {
                        string cl = (o["CommandLine"] as string) ?? "";
                        if (cl.IndexOf(profile, StringComparison.OrdinalIgnoreCase) >= 0 && cl.IndexOf("--type=", StringComparison.Ordinal) < 0)
                            outp.Add(Convert.ToInt32(o["ProcessId"]));
                    }
            }
            catch (Exception) { }
            return outp;
        }

        public static void FocusRunning(Plan p)
        {
            foreach (int pid in FindBrowserPids(p.Exe, p.Profile))
                foreach (KeyValuePair<IntPtr, string> w in Native.Windows(Native.ProcessTree(pid)))
                {
                    if (Native.IsIconic(w.Key)) Native.ShowWindow(w.Key, 9);
                    Native.SetForegroundWindow(w.Key);
                    return;
                }
        }

        public static bool KillRunning(Plan p)
        {
            foreach (int pid in FindBrowserPids(p.Exe, p.Profile)) KillTree(pid);
            for (int i = 0; i < 50 && ProfileInUse(p.Profile); i++) Thread.Sleep(200);
            return !ProfileInUse(p.Profile);
        }

        static void KillTree(int root)
        {
            foreach (int pid in Native.ProcessTree(root))
            {
                try { using (Process pr = Process.GetProcessById(pid)) pr.Kill(); } catch (Exception) { }
            }
        }

        public static Session Start(Plan p, Config c)
        {
            Directory.CreateDirectory(p.Profile);
            ProcessStartInfo psi = new ProcessStartInfo(p.Exe, p.ArgString());
            psi.UseShellExecute = false;
            psi.WorkingDirectory = Path.GetDirectoryName(p.Exe);
            psi.RedirectStandardOutput = true;
            psi.RedirectStandardError = true;
            Session s = new Session();
            s.Plan = p;
            s.prio = c["process_priority"] == "high" ? ProcessPriorityClass.High : c["process_priority"] == "above_normal" ? ProcessPriorityClass.AboveNormal : ProcessPriorityClass.Normal;
            s.keepAwake = c.Bool("prevent_sleep");
            s.Proc = Process.Start(psi);
            s.Proc.OutputDataReceived += delegate { };
            s.Proc.ErrorDataReceived += delegate { };
            s.Proc.BeginOutputReadLine();
            s.Proc.BeginErrorReadLine();
            s.Root = s.Proc.Id;
            Thread t = new Thread(s.Watch);
            t.IsBackground = true;
            t.Name = "VoxelCraft watcher";
            t.Start();
            return s;
        }

        void Watch()
        {
            try
            {
                if (keepAwake) Native.SetThreadExecutionState(Native.ES_CONTINUOUS | Native.ES_SYSTEM_REQUIRED | Native.ES_DISPLAY_REQUIRED);
                if (Plan.FullscreenLater) { Thread f = new Thread(GoFullscreen); f.IsBackground = true; f.Start(); }
                // a process that exits at once handed the window to an instance already running on this profile
                if (Proc.WaitForExit(1500))
                {
                    List<int> pids = FindBrowserPids(Plan.Exe, Plan.Profile);
                    if (pids.Count == 0) return;
                    Root = pids[0];
                }
                Process root = null;
                try { root = Process.GetProcessById(Root); } catch (Exception) { return; }
                using (root)
                {
                    while (!root.WaitForExit(1500))
                    {
                        if (prio != ProcessPriorityClass.Normal) ApplyPriority();
                    }
                }
            }
            catch (Exception) { }
            finally
            {
                if (keepAwake) Native.SetThreadExecutionState(Native.ES_CONTINUOUS);
                ended = true;
                done.Set();
                EventHandler h = Ended;
                if (h != null) h(this, EventArgs.Empty);
            }
        }

        // Windows does not pass a raised priority on to child processes, and Chromium starts new ones (renderers,
        // the GPU process after a reset) at any time, so the whole tree is checked every couple of seconds
        void ApplyPriority()
        {
            foreach (int pid in Native.ProcessTree(Root))
            {
                if (prioSet.Contains(pid)) continue;
                try { using (Process pr = Process.GetProcessById(pid)) pr.PriorityClass = prio; prioSet.Add(pid); } catch (Exception) { }
            }
        }

        // F11 for the game window once the game has started: the page is titled "VoxelCraft" by its HTML, then
        // "VoxelCraft (starting)" by the script until the game is up and running, then "VoxelCraft" again
        void GoFullscreen()
        {
            Stopwatch sw = Stopwatch.StartNew();
            bool starting = false;
            while (sw.Elapsed.TotalSeconds < 45 && !ended)
            {
                foreach (KeyValuePair<IntPtr, string> w in Native.Windows(Native.ProcessTree(Root)))
                {
                    if (!w.Value.StartsWith("VoxelCraft") || !Native.ClassName(w.Key).StartsWith("Chrome_WidgetWin")) continue;
                    if (w.Value.Contains("(starting)")) { starting = true; continue; }
                    if (!starting && sw.Elapsed.TotalSeconds < 15) continue;
                    Thread.Sleep(300);
                    Native.PostMessage(w.Key, 0x100, new IntPtr(0x7A), new IntPtr(0x00570001));
                    Native.PostMessage(w.Key, 0x101, new IntPtr(0x7A), new IntPtr(unchecked((int)0xC0570001)));
                    return;
                }
                Thread.Sleep(100);
            }
        }

        public void Wait() { done.WaitOne(); }
        public void Kill() { KillTree(Root); }

        public string Title()
        {
            foreach (KeyValuePair<IntPtr, string> w in Native.Windows(Native.ProcessTree(Root))) return w.Value;
            return null;
        }
    }

    // ------------------------------------------------------------------------ graphics backend benchmark
    class BenchResult
    {
        public string Backend, Renderer, Error;
        public bool Ok;
        public double Fps, Steady, GpuMs;
        public int Hitches;
    }

    // Starts the game once per backend with ?bench=<seconds>: it opens a fixed test world at your settings, waits
    // for the terrain, times it, deletes the world again and reports in its window title, which is read from here.
    static class Benchmark
    {
        public static readonly string[] Backends = { "d3d11", "gl", "d3d11on12", "vulkan" };

        public static List<BenchResult> Run(Config c, Env env, Action<string> log, Func<bool> cancelled)
        {
            List<BenchResult> results = new List<BenchResult>();
            int secs = Math.Max(3, Math.Min(60, c.Int("benchmark_seconds", 8)));
            Plan probe = Plan.Build(c, env, "d3d11", null);
            if (probe.Error != null) { log(probe.Error); return results; }
            if (Session.ProfileInUse(probe.Profile)) { log("Close the game first: the benchmark runs in the same browser profile."); return results; }
            foreach (string be in Backends)
            {
                if (cancelled()) break;
                BenchResult r = new BenchResult { Backend = be };
                log("Timing " + Plan.BackendName(be) + "...");
                Plan p = Plan.Build(c, env, be, "bench=" + secs);
                Session s = Session.Start(p, c);
                Stopwatch sw = Stopwatch.StartNew();
                string title = null;
                while (sw.Elapsed.TotalSeconds < 75 + 2 * secs && !cancelled())
                {
                    Thread.Sleep(300);
                    if (s.HasEnded) { r.Error = "the browser closed (backend not supported?)"; break; }
                    title = s.Title();
                    if (title != null && title.StartsWith("VCBENCH:")) break;
                }
                if (r.Error == null)
                {
                    if (title == null || !title.StartsWith("VCBENCH:")) r.Error = cancelled() ? "cancelled" : "no result in time";
                    else Parse(title.Substring(8), r);
                }
                s.Kill();
                for (int i = 0; i < 75 && Session.ProfileInUse(p.Profile); i++) Thread.Sleep(200);
                results.Add(r);
                log(r.Ok ? string.Format(CultureInfo.InvariantCulture, "  {0}: {1:0} FPS, steady {2:0} FPS, {3} stalls over 50 ms ({4:0.00} ms GPU)", Plan.BackendName(be), r.Fps, r.Steady, r.Hitches, r.GpuMs) : "  " + Plan.BackendName(be) + ": failed, " + r.Error);
            }
            List<string> parts = new List<string>();
            foreach (BenchResult r in results) if (r.Ok) parts.Add(r.Backend + "=" + r.Fps.ToString("0", CultureInfo.InvariantCulture) + "/" + r.Steady.ToString("0", CultureInfo.InvariantCulture) + "/" + r.Hitches);
            if (parts.Count > 0)
            {
                Gpu g = env.PickGpu(c["gpu"]) ?? env.HighPerf;
                c["benchmark"] = string.Join(",", parts.ToArray()) + "|" + (g != null ? g.Name : "") + "|" + DateTime.Now.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);
                string best = Best(c, env);
                if (best != null) log("Best steady FPS: " + Plan.BackendName(best) + ". Graphics backend Auto now uses it.");
            }
            return results;
        }

        static void Parse(string json, BenchResult r)
        {
            Match m;
            r.Ok = Regex.IsMatch(json, "\"ok\"\\s*:\\s*true");
            if ((m = Regex.Match(json, "\"fps\"\\s*:\\s*([0-9.]+)")).Success) r.Fps = double.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
            if ((m = Regex.Match(json, "\"gpuMs\"\\s*:\\s*([0-9.]+)")).Success) r.GpuMs = double.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
            if ((m = Regex.Match(json, "\"steadyFps\"\\s*:\\s*([0-9.]+)")).Success) r.Steady = double.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
            if ((m = Regex.Match(json, "\"hitches\"\\s*:\\s*([0-9]+)")).Success) r.Hitches = int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
            if ((m = Regex.Match(json, "\"renderer\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"")).Success) r.Renderer = Regex.Unescape(m.Groups[1].Value);
            if ((m = Regex.Match(json, "\"error\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"")).Success) r.Error = Regex.Unescape(m.Groups[1].Value);
            // a backend Chromium could not start falls back to software rendering: that is a failure, not a result
            if (r.Ok && Regex.IsMatch(json, "\"software\"\\s*:\\s*true")) { r.Ok = false; r.Error = "fell back to software rendering"; }
            if (!r.Ok && r.Error == null) r.Error = "the game reported a failure";
        }

        // the backend with the best steady FPS in the last benchmark, if it ran on the GPU the game would use now; ties
        // go to fewer stalls, then the higher average (entries are backend=averageFps/steadyFps/stalls; older ones
        // without a steady figure are not trusted)
        public static string Best(Config c, Env env)
        {
            string[] f = c["benchmark"].Split('|');
            if (f.Length < 2 || f[0].Length == 0) return null;
            Gpu g = env.PickGpu(c["gpu"]) ?? env.HighPerf;
            if (g != null && f[1].Length > 0 && f[1] != g.Name) return null;
            string best = null; double bs = 0, ba = 0, bh = 0;
            foreach (string kv in f[0].Split(','))
            {
                string[] p = kv.Split('=');
                if (p.Length != 2 || !p[1].Contains("/")) continue;
                string[] n = p[1].Split('/');
                double avg, steady, stalls = 0;
                if (!double.TryParse(n[0], NumberStyles.Float, CultureInfo.InvariantCulture, out avg) || !double.TryParse(n[1], NumberStyles.Float, CultureInfo.InvariantCulture, out steady)) continue;
                if (n.Length > 2) double.TryParse(n[2], NumberStyles.Float, CultureInfo.InvariantCulture, out stalls);
                if (best == null || steady > bs || (steady == bs && (stalls < bh || (stalls == bh && avg > ba)))) { best = p[0]; bs = steady; ba = avg; bh = stalls; }
            }
            return best;
        }

        public static string Summary(Config c)
        {
            string[] f = c["benchmark"].Split('|');
            if (f.Length < 3 || f[0].Length == 0) return null;
            List<string> parts = new List<string>();
            foreach (string kv in f[0].Split(','))
            {
                string[] p = kv.Split('=');
                if (p.Length == 2 && p[1].Contains("/")) { string[] n = p[1].Split('/'); parts.Add(Plan.BackendName(p[0]) + " " + n[1] + " steady (" + n[0] + " avg" + (n.Length > 2 && n[2] != "0" ? ", " + n[2] + " stalls" : "") + ")"); }
                else if (p.Length == 2) parts.Add(Plan.BackendName(p[0]) + " " + p[1].Split('.')[0] + " avg (run again)");
            }
            return string.Join(",  ", parts.ToArray()) + "   (" + f[2] + (f[1].Length > 0 ? ", " + f[1] : "") + ")";
        }
    }

    // ------------------------------------------------------------------------ window
    static class Theme
    {
        public static readonly Color Bg = Color.FromArgb(22, 23, 26), Side = Color.FromArgb(28, 29, 33), Card = Color.FromArgb(38, 40, 45),
            Input = Color.FromArgb(52, 55, 61), Text = Color.FromArgb(234, 234, 234), Dim = Color.FromArgb(158, 163, 170),
            Accent = Color.FromArgb(67, 160, 71), AccentHi = Color.FromArgb(86, 186, 90), NavOn = Color.FromArgb(48, 51, 57), Line = Color.FromArgb(60, 63, 70);
        public static Font F(float size, FontStyle st) { return new Font("Segoe UI", size, st); }
        public static Button Btn(string text, bool primary)
        {
            Button b = new Button();
            b.Text = text;
            b.FlatStyle = FlatStyle.Flat;
            b.FlatAppearance.BorderSize = primary ? 0 : 1;
            b.FlatAppearance.BorderColor = Line;
            b.BackColor = primary ? Accent : Card;
            b.FlatAppearance.MouseOverBackColor = primary ? AccentHi : NavOn;
            b.ForeColor = Color.White;
            b.Font = F(primary ? 13f : 9.5f, primary ? FontStyle.Bold : FontStyle.Regular);
            b.Cursor = Cursors.Hand;
            b.UseVisualStyleBackColor = false;
            return b;
        }
    }

    // one option: title, help text and its input, laid out by Arrange(width)
    class OptionCard : Panel
    {
        public readonly Opt Opt;
        public readonly Control Input;
        readonly Label title, help;

        public OptionCard(Opt o, Config c)
        {
            Opt = o;
            BackColor = Theme.Card;
            // UseMnemonic off: help texts contain "&" (URL parameters), which a Label would turn into an underline
            title = new Label { Text = o.Title, Font = Theme.F(10f, FontStyle.Bold), ForeColor = Theme.Text, AutoSize = true, BackColor = Color.Transparent, UseMnemonic = false };
            help = new Label { Text = o.Help, Font = Theme.F(8.75f, FontStyle.Regular), ForeColor = Theme.Dim, AutoSize = false, BackColor = Color.Transparent, UseMnemonic = false };
            string v = c[o.Key];
            switch (o.Kind)
            {
                case Kind.Bool:
                    CheckBox cb = new CheckBox { Checked = c.Bool(o.Key), Text = "On", AutoSize = true, ForeColor = Theme.Text, Font = Theme.F(9.5f, FontStyle.Regular), BackColor = Color.Transparent };
                    cb.CheckedChanged += delegate { cb.Text = cb.Checked ? "On" : "Off"; };
                    cb.Text = cb.Checked ? "On" : "Off";
                    Input = cb;
                    break;
                case Kind.Choice:
                    ComboBox dd = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList, FlatStyle = FlatStyle.Flat, BackColor = Theme.Input, ForeColor = Theme.Text, Width = 300, DropDownWidth = 440, Font = Theme.F(9.5f, FontStyle.Regular) };
                    if (!o.Values.Contains(v) && v.Length > 0) { o.Values.Add(v); o.Labels.Add(v); }
                    foreach (string l in o.Labels) dd.Items.Add(l);
                    dd.SelectedIndex = Math.Max(0, o.Values.IndexOf(v));
                    Input = dd;
                    break;
                case Kind.Number:
                    NumericUpDown nu = new NumericUpDown { Minimum = o.Min, Maximum = o.Max, Increment = o.Step, Width = 120, BackColor = Theme.Input, ForeColor = Theme.Text, BorderStyle = BorderStyle.FixedSingle, Font = Theme.F(9.5f, FontStyle.Regular) };
                    nu.Value = Math.Max(o.Min, Math.Min(o.Max, c.Int(o.Key, int.Parse(o.Default))));
                    Input = nu;
                    break;
                default:
                    Input = new TextBox { Text = v, BackColor = Theme.Input, ForeColor = Theme.Text, BorderStyle = BorderStyle.FixedSingle, Font = Theme.F(9.5f, FontStyle.Regular) };
                    break;
            }
            Controls.Add(title); Controls.Add(help); Controls.Add(Input);
        }

        public string Value
        {
            get
            {
                if (Input is CheckBox) return ((CheckBox)Input).Checked ? "true" : "false";
                if (Input is ComboBox) { int i = ((ComboBox)Input).SelectedIndex; return i >= 0 && i < Opt.Values.Count ? Opt.Values[i] : Opt.Default; }
                if (Input is NumericUpDown) return ((int)((NumericUpDown)Input).Value).ToString(CultureInfo.InvariantCulture);
                return Input.Text.Trim();
            }
        }

        public void Arrange(int width)
        {
            int pad = 14;
            Width = width;
            title.Location = new Point(pad, pad);
            if (Opt.Kind == Kind.Text)
            {
                int hw = width - 2 * pad;
                help.Size = new Size(hw, TextRenderer.MeasureText(help.Text, help.Font, new Size(hw, 4000), TextFormatFlags.WordBreak).Height);
                help.Location = new Point(pad, title.Bottom + 4);
                Input.Location = new Point(pad, help.Bottom + 8);
                Input.Width = hw;
                Height = Input.Bottom + pad;
            }
            else
            {
                Input.Location = new Point(width - pad - Input.Width, pad - 2);
                int hw = Math.Max(120, width - 3 * pad - Input.Width);
                help.Size = new Size(hw, TextRenderer.MeasureText(help.Text, help.Font, new Size(hw, 4000), TextFormatFlags.WordBreak).Height);
                help.Location = new Point(pad, title.Bottom + 4);
                Height = Math.Max(help.Bottom, Input.Bottom) + pad;
            }
        }
    }

    class LauncherForm : Form
    {
        readonly Config cfg;
        readonly Env env;
        readonly Panel content = new Panel();
        readonly Dictionary<string, Panel> pages = new Dictionary<string, Panel>();
        readonly Dictionary<string, Button> navs = new Dictionary<string, Button>();
        readonly List<OptionCard> cards = new List<OptionCard>();
        readonly Label status = new Label(), summary = new Label(), benchOut = new Label(), subtitle = new Label();
        Button play, benchBtn;
        Session session;
        Thread benchThread;
        volatile bool benchCancel;
        string current;

        public LauncherForm(Config c, Env e)
        {
            cfg = c; env = e;
            Text = "VoxelCraft Launcher";
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch (Exception) { }
            BackColor = Theme.Bg;
            ForeColor = Theme.Text;
            Font = Theme.F(9.5f, FontStyle.Regular);
            AutoScaleMode = AutoScaleMode.Dpi;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(980, 680);
            MinimumSize = new Size(820, 560);
            FillDynamicChoices();

            // header
            Panel header = new Panel { Dock = DockStyle.Top, Height = 78, BackColor = Theme.Side };
            Label logo = new Label { Text = "VOXELCRAFT", Font = Theme.F(22f, FontStyle.Bold), ForeColor = Color.White, AutoSize = true, Location = new Point(20, 10), BackColor = Color.Transparent };
            subtitle.Font = Theme.F(9f, FontStyle.Regular); subtitle.ForeColor = Theme.Dim; subtitle.AutoSize = true; subtitle.Location = new Point(23, 50); subtitle.BackColor = Color.Transparent;
            header.Controls.Add(logo); header.Controls.Add(subtitle);

            // bottom bar
            Panel bottom = new Panel { Dock = DockStyle.Bottom, Height = 70, BackColor = Theme.Side };
            play = Theme.Btn("PLAY", true);
            play.Size = new Size(200, 46);
            play.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            play.Location = new Point(bottom.Width - 220, 12);
            play.Click += delegate { Play(); };
            Button save = Theme.Btn("Save", false), openCfg = Theme.Btn("Settings file", false), openData = Theme.Btn("Data folder", false);
            save.SetBounds(20, 18, 90, 34); openCfg.SetBounds(118, 18, 120, 34); openData.SetBounds(246, 18, 120, 34);
            save.Click += delegate { if (Collect(true)) SetStatus("Saved to " + cfg.FilePath); };
            openCfg.Click += delegate { Collect(true); Shell("notepad.exe", Native.Quote(cfg.FilePath)); };
            openData.Click += delegate { string d = Plan.ProfileDir(cfg); Directory.CreateDirectory(d); Shell("explorer.exe", Native.Quote(d)); };
            status.SetBounds(380, 26, 300, 20); status.ForeColor = Theme.Dim; status.AutoEllipsis = true; status.Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top;
            bottom.Controls.AddRange(new Control[] { save, openCfg, openData, status, play });
            bottom.Resize += delegate { play.Left = bottom.ClientSize.Width - play.Width - 20; status.Width = Math.Max(50, play.Left - status.Left - 16); };

            // navigation
            Panel nav = new Panel { Dock = DockStyle.Left, Width = 178, BackColor = Theme.Side, Padding = new Padding(0, 10, 0, 0) };
            List<string> names = new List<string>(); names.Add("Play"); names.AddRange(Options.Pages);
            int y = 12;
            foreach (string n in names)
            {
                Button b = new Button { Text = "   " + n, TextAlign = ContentAlignment.MiddleLeft, FlatStyle = FlatStyle.Flat, ForeColor = Theme.Text, BackColor = Theme.Side, Font = Theme.F(10.5f, FontStyle.Regular), Cursor = Cursors.Hand };
                b.FlatAppearance.BorderSize = 0;
                b.FlatAppearance.MouseOverBackColor = Theme.NavOn;
                b.SetBounds(0, y, 178, 42);
                string page = n;
                b.Click += delegate { ShowPage(page); };
                nav.Controls.Add(b);
                navs[n] = b;
                y += 44;
            }

            content.Dock = DockStyle.Fill;
            content.BackColor = Theme.Bg;
            content.Padding = new Padding(18, 14, 4, 10);
            Controls.Add(content); Controls.Add(nav); Controls.Add(bottom); Controls.Add(header);

            pages["Play"] = BuildPlayPage();
            foreach (string pg in Options.Pages) pages[pg] = BuildOptionPage(pg);
            foreach (Panel p in pages.Values) { p.Dock = DockStyle.Fill; p.Visible = false; content.Controls.Add(p); }
            content.Resize += delegate { ArrangeCards(); };
            ShowPage("Play");
            UpdateSummary();
            if (env.Browsers.Count == 0) SetStatus("No Chromium-based browser found: see Advanced > Browser engine.");
            else if (!cfg.Existed) SetStatus("Settings created at " + cfg.FilePath);
        }

        void FillDynamicChoices()
        {
            Opt g = Options.Get("gpu");
            foreach (Gpu x in env.Gpus) if (!g.Values.Contains(x.Id)) { g.Values.Add(x.Id); g.Labels.Add(x.ToString()); }
            Opt m = Options.Get("monitor");
            for (int i = 0; i < env.Displays.Count; i++) if (!m.Values.Contains(env.Displays[i].Id)) { m.Values.Add(env.Displays[i].Id); m.Labels.Add(env.Displays[i].Label(i)); }
            Opt b = Options.Get("browser");
            int at = 1;
            foreach (Browser x in env.Browsers) if (!b.Values.Contains(x.Id)) { b.Values.Insert(at, x.Id); b.Labels.Insert(at, x.ToString()); at++; }
            // what Auto works out to on this PC
            Options.Get("js_heap_mb").Labels[0] = "Auto (" + env.AutoHeapMB() + " MB)";
            Options.Get("world_cache_mb").Labels[0] = "Auto (" + env.AutoCacheMB() + " MB)";
            Options.Get("worker_threads").Labels[0] = "Auto (" + env.AutoWorkers() + ")";
            if (env.HighPerf != null) g.Labels[0] = "High performance (" + env.HighPerf.Name + ")";
            if (env.LowPower != null) g.Labels[1] = "Power saving (" + env.LowPower.Name + ")";
        }

        Panel BuildOptionPage(string page)
        {
            FlowLayoutPanel p = new FlowLayoutPanel { FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true, BackColor = Theme.Bg };
            foreach (Opt o in Options.All)
            {
                if (o.Page != page || o.Hidden) continue;
                OptionCard card = new OptionCard(o, cfg) { Margin = new Padding(0, 0, 0, 10) };
                Control input = card.Input;
                if (input is ComboBox) ((ComboBox)input).SelectedIndexChanged += delegate { UpdateSummary(); };
                if (input is CheckBox) ((CheckBox)input).CheckedChanged += delegate { UpdateSummary(); };
                cards.Add(card);
                p.Controls.Add(card);
            }
            return p;
        }

        Panel BuildPlayPage()
        {
            Panel p = new Panel { AutoScroll = true, BackColor = Theme.Bg };
            Label ready = new Label { Text = "Ready to play", Font = Theme.F(16f, FontStyle.Bold), ForeColor = Color.White, AutoSize = true, Location = new Point(0, 0) };
            summary.Font = new Font("Consolas", 9.5f); summary.ForeColor = Theme.Text; summary.AutoSize = true; summary.Location = new Point(2, 40); summary.BackColor = Color.Transparent; summary.UseMnemonic = false;
            benchOut.UseMnemonic = false; status.UseMnemonic = false;
            Panel bench = new Panel { BackColor = Theme.Card, Location = new Point(0, 220), Size = new Size(720, 210) };
            Label bt = new Label { Text = "Find the fastest graphics backend", Font = Theme.F(11f, FontStyle.Bold), ForeColor = Theme.Text, AutoSize = true, Location = new Point(14, 12), BackColor = Color.Transparent };
            Label bd = new Label { Text = "Opens the game once per backend (Direct3D 11, OpenGL, Direct3D 11 on 12, Vulkan) with your current settings and times each on a test world. Graphics backend Auto then uses the one with the best steady FPS: the frame rate you actually see, so a backend with a high average but stalls loses. About a minute; the game window opens and closes by itself.", Font = Theme.F(8.75f, FontStyle.Regular), ForeColor = Theme.Dim, Location = new Point(14, 38), Size = new Size(690, 58), BackColor = Color.Transparent, Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right, UseMnemonic = false };
            benchBtn = Theme.Btn("Run benchmark", false);
            benchBtn.SetBounds(14, 102, 150, 34);
            benchBtn.Click += delegate { RunBenchmark(); };
            benchOut.Font = new Font("Consolas", 9f); benchOut.ForeColor = Theme.Text; benchOut.Location = new Point(14, 144); benchOut.Size = new Size(690, 80); benchOut.BackColor = Color.Transparent; benchOut.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            bench.Controls.AddRange(new Control[] { bt, bd, benchBtn, benchOut });
            Label tips = new Label
            {
                Text = "In the game: F3 shows the frame rate, CPU and GPU frame time, frame pacing and this launcher's settings.\n" +
                       "Worlds from your normal browser: open the game there, Singleplayer > Export, then Import here.\n" +
                       "Everything on these pages is also in VoxelCraft.ini (Settings file) for editing by hand.",
                Font = Theme.F(9f, FontStyle.Regular), ForeColor = Theme.Dim, AutoSize = true, Location = new Point(0, 446), BackColor = Color.Transparent
            };
            p.Controls.AddRange(new Control[] { ready, summary, bench, tips });
            // the cards follow the summary, whose height depends on the settings
            EventHandler arrange = delegate
            {
                bench.SetBounds(0, summary.Bottom + 18, Math.Max(400, p.ClientSize.Width - 24), 232);
                tips.Location = new Point(0, bench.Bottom + 16);
            };
            p.Resize += arrange; summary.SizeChanged += arrange;
            return p;
        }

        void ShowPage(string page)
        {
            current = page;
            foreach (KeyValuePair<string, Panel> kv in pages) kv.Value.Visible = kv.Key == page;
            foreach (KeyValuePair<string, Button> kv in navs) { kv.Value.BackColor = kv.Key == page ? Theme.NavOn : Theme.Side; kv.Value.Font = Theme.F(10.5f, kv.Key == page ? FontStyle.Bold : FontStyle.Regular); }
            ArrangeCards();
            if (page == "Play") UpdateSummary();
        }

        void ArrangeCards()
        {
            foreach (KeyValuePair<string, Panel> kv in pages)
            {
                FlowLayoutPanel f = kv.Value as FlowLayoutPanel;
                if (f == null || !f.Visible) continue;
                int w = Math.Max(400, f.ClientSize.Width - SystemInformation.VerticalScrollBarWidth - 8);
                f.SuspendLayout();
                foreach (Control ch in f.Controls) { OptionCard oc = ch as OptionCard; if (oc != null) oc.Arrange(w); }
                f.ResumeLayout();
            }
        }

        // copy the inputs into the settings (and the file)
        bool Collect(bool save)
        {
            foreach (OptionCard oc in cards) cfg[oc.Opt.Key] = oc.Value;
            if (!save) return true;
            try { cfg.Save(); return true; }
            catch (Exception e) { SetStatus("Could not save " + cfg.FilePath + ": " + e.Message); return false; }
        }

        void UpdateSummary()
        {
            Collect(false);
            Plan p = Plan.Build(cfg, env, null, null);
            Gpu g = env.PickGpu(cfg["gpu"]) ?? env.HighPerf;
            Display d = env.PickDisplay(cfg["monitor"]);
            subtitle.Text = "Desktop launcher  ·  " + (p.Browser != null ? p.Browser.ToString() : "no browser found") + "  ·  " + (g != null ? g.Name : "GPU unknown") + (d != null ? "  ·  " + d.Screen.Bounds.Width + "x" + d.Screen.Bounds.Height + " @ " + d.Hz + " Hz" : "");
            summary.Text = p.Error != null ? "Cannot start yet:\n" + p.Error : p.Describe();
            string bs = Benchmark.Summary(cfg);
            if (benchThread == null) benchOut.Text = bs != null ? "Last run: " + bs : "Not run yet: Auto uses Direct3D 11.";
            play.Enabled = p.Error == null && benchThread == null;
        }

        void SetStatus(string s) { status.Text = s; }

        static void Shell(string exe, string args)
        {
            try { Process.Start(new ProcessStartInfo(exe, args) { UseShellExecute = true }); } catch (Exception) { }
        }

        void Play()
        {
            if (!Collect(true)) return;
            Plan p = Plan.Build(cfg, env, null, null);
            if (p.Error != null) { MessageBox.Show(this, p.Error, "VoxelCraft", MessageBoxButtons.OK, MessageBoxIcon.Warning); return; }
            if (Session.ProfileInUse(p.Profile))
            {
                DialogResult r = MessageBox.Show(this, "VoxelCraft is already running.\n\nRestart it with these settings? (Unsaved progress since the game's last autosave is lost.)\n\nNo switches to the running game.", "VoxelCraft", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);
                if (r == DialogResult.No) { Session.FocusRunning(p); return; }
                if (r != DialogResult.Yes) return;
                if (!Session.KillRunning(p)) { SetStatus("The running game did not close."); return; }
            }
            try { session = Session.Start(p, cfg); }
            catch (Exception e) { MessageBox.Show(this, "Could not start " + p.Exe + ":\n" + e.Message, "VoxelCraft", MessageBoxButtons.OK, MessageBoxIcon.Error); return; }
            SetStatus("Running: " + p.Browser + ", " + Plan.BackendName(p.Backend));
            bool hide = cfg.Bool("hide_launcher"), back = cfg.Bool("return_to_launcher");
            session.Ended += delegate
            {
                try
                {
                    BeginInvoke((MethodInvoker)delegate
                    {
                        if (!back) { Close(); return; }
                        Visible = true; WindowState = FormWindowState.Normal; Activate();
                        SetStatus("The game closed.");
                    });
                }
                catch (Exception) { }
            };
            if (hide) Visible = false;
        }

        void RunBenchmark()
        {
            if (benchThread != null) { benchCancel = true; benchBtn.Text = "Stopping..."; return; }
            if (!Collect(true)) return;
            Plan p = Plan.Build(cfg, env, null, null);
            if (p.Error != null) { MessageBox.Show(this, p.Error, "VoxelCraft", MessageBoxButtons.OK, MessageBoxIcon.Warning); return; }
            if (Session.ProfileInUse(p.Profile)) { MessageBox.Show(this, "Close the game first: the benchmark runs in the same browser profile.", "VoxelCraft"); return; }
            benchCancel = false;
            benchBtn.Text = "Stop";
            play.Enabled = false;
            StringBuilder log = new StringBuilder();
            benchOut.Text = "";
            benchThread = new Thread(delegate()
            {
                Benchmark.Run(cfg, env, delegate(string m)
                {
                    lock (log) { log.AppendLine(m); }
                    try { BeginInvoke((MethodInvoker)delegate { lock (log) { benchOut.Text = Tail(log.ToString(), 5); } }); } catch (Exception) { }
                }, delegate { return benchCancel; });
                try { cfg.Save(); } catch (Exception) { }
                try
                {
                    BeginInvoke((MethodInvoker)delegate
                    {
                        benchThread = null;
                        benchBtn.Text = "Run benchmark";
                        UpdateSummary();
                        lock (log) { benchOut.Text = Tail(log.ToString(), 5); }
                        Activate();
                    });
                }
                catch (Exception) { }
            });
            benchThread.IsBackground = true;
            benchThread.Start();
        }

        static string Tail(string s, int n)
        {
            string[] l = s.TrimEnd().Split('\n');
            int a = Math.Max(0, l.Length - n);
            return string.Join("\n", l, a, l.Length - a).Replace("\r", "");
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (benchThread != null) { benchCancel = true; }
            Collect(true);
            base.OnFormClosing(e);
        }
    }
}
