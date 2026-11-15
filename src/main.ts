import { generateXpm2 } from "@busy-app/busy-lib";
import { device } from "@shared/device";
import manifest from "./appmeta/manifest.json";
import { createScreen, type Element } from "./screen";

/** The name the app draws under; the device clears elements by this id. */
const APP = manifest.id;

/** Ukraine: every region with "alertnow", keyed by its Ukrainian name; about 4 KB. */
const UKRAINE = "https://ubilling.net.ua/aerialalerts/";
/** Israel: the alerts going on now, an empty list when there are none. */
const ISRAEL = "https://api.tzevaadom.co.il/notifications";
const POLL_MS = 20 * 1000;
/** How long "ALL CLEAR" stays after the last alert ends. */
const CLEAR_MS = 60 * 1000;

const WHITE = "#FFFFFFFF";
const GREEN = "#00FF00FF";
const RED = "#E00000FF";

/** The siren at the left of the red screen, 9x12: y the rays, o its lit dome, w the glare on it, k the base. */
const SIREN_LIT = [
  "y...y...y",
  ".y..y..y.",
  ".........",
  "...ooo...",
  "..owooo..",
  "y.owooo.y",
  "..ooooo..",
  "..ooooo..",
  "..ooooo..",
  ".kkkkkkk.",
  "kkkkkkkkk",
  "kkkkkkkkk",
];
/** The same siren between flashes: no rays, d the dark dome. */
const SIREN_DARK = SIREN_LIT.map((row) => row.replace(/y/g, ".").replace(/[ow]/g, "d"));
const SIREN_PALETTE = { ".": "none", y: "#FFE040", o: "#FFB000", w: "#FFFFFF", d: "#600000", k: "#404040" };
/** Both siren pictures, built once; they take turns SIREN_MS apart. */
const SIREN = [SIREN_LIT, SIREN_DARK].map((grid) => generateXpm2({ palette: SIREN_PALETTE, grid }));
const SIREN_MS = 250;
/** The text of the alert takes the 60 px right of the siren, x 12..71. */
const TEXT_X = 42;
const TEXT_W = 60;
/**
 * The names wider than that in the small font, 65 px each. A list, not textWidth(): that one brings the font maps
 * into the app, about 17 KB of heap on the emulator.
 */
const WIDE_NAMES = ["IVANO-FRANKIVSK", "DNIPROPETROVSK"];

/**
 * The regions of the settings: the key in ubilling's answer and the name on the screen. Sevastopol and Luhansk oblast
 * are left out: their records have said "alert" since 2022-12-11 and 2022-04-04.
 */
const REGIONS: Record<string, { key: string; name: string }> = {
  kyiv_city: { key: "м. Київ", name: "KYIV CITY" },
  kyiv_oblast: { key: "Київська область", name: "KYIV OBLAST" },
  cherkasy: { key: "Черкаська область", name: "CHERKASY" },
  chernihiv: { key: "Чернігівська область", name: "CHERNIHIV" },
  chernivtsi: { key: "Чернівецька область", name: "CHERNIVTSI" },
  dnipropetrovsk: { key: "Дніпропетровська область", name: "DNIPROPETROVSK" },
  donetsk: { key: "Донецька область", name: "DONETSK" },
  ivano_frankivsk: { key: "Івано-Франківська область", name: "IVANO-FRANKIVSK" },
  kharkiv: { key: "Харківська область", name: "KHARKIV" },
  kherson: { key: "Херсонська область", name: "KHERSON" },
  khmelnytskyi: { key: "Хмельницька область", name: "KHMELNYTSKYI" },
  kirovohrad: { key: "Кіровоградська область", name: "KIROVOHRAD" },
  lviv: { key: "Львівська область", name: "LVIV" },
  mykolaiv: { key: "Миколаївська область", name: "MYKOLAIV" },
  odesa: { key: "Одеська область", name: "ODESA" },
  poltava: { key: "Полтавська область", name: "POLTAVA" },
  rivne: { key: "Рівненська область", name: "RIVNE" },
  sumy: { key: "Сумська область", name: "SUMY" },
  ternopil: { key: "Тернопільська область", name: "TERNOPIL" },
  vinnytsia: { key: "Вінницька область", name: "VINNYTSIA" },
  volyn: { key: "Волинська область", name: "VOLYN" },
  zakarpattia: { key: "Закарпатська область", name: "ZAKARPATTIA" },
  zaporizhzhia: { key: "Запорізька область", name: "ZAPORIZHZHIA" },
  zhytomyr: { key: "Житомирська область", name: "ZHYTOMYR" },
};
const ISRAEL_REGION = "israel";

/** The regions picked on the app's settings page, "none" and repeats left out. */
async function loadRegions(): Promise<string[]> {
  const { values } = await device.AppsSettingsGet({ app_id: APP });
  return [values.region1, values.region2, values.region3]
    .filter((r): r is string => typeof r === "string" && (r === ISRAEL_REGION || r in REGIONS))
    .filter((r, i, all) => all.indexOf(r) === i);
}

async function json(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

interface Poll {
  /** Screen names of the picked regions under alert now. */
  alerting: string[];
  /** Whether a source did not answer. */
  failed: boolean;
}

/** Asks each source the picked regions need, once. */
async function check(regions: string[], report: (err: unknown) => void): Promise<Poll> {
  const result: Poll = { alerting: [], failed: false };
  const ukraine = regions.filter((r) => r !== ISRAEL_REGION);
  if (ukraine.length > 0) {
    try {
      const body = (await json(UKRAINE)) as { states: Record<string, { alertnow: boolean } | undefined> };
      for (const r of ukraine) if (body.states[REGIONS[r].key]?.alertnow) result.alerting.push(REGIONS[r].name);
    } catch (err) {
      result.failed = true;
      report(err);
    }
  }
  if (regions.indexOf(ISRAEL_REGION) >= 0) {
    try {
      const body = await json(ISRAEL);
      if (Array.isArray(body) && body.length > 0) result.alerting.push("ISRAEL");
    } catch (err) {
      result.failed = true;
      report(err);
    }
  }
  return result;
}

function centered(id: string, text: string, color: string): Element {
  return { type: "text", id, text, font: "bold", color, x: 36, y: 8, align: "center" };
}

type State =
  | { kind: "wait" }
  | { kind: "unset" }
  | { kind: "alert"; names: string[] }
  | { kind: "clear" }
  | { kind: "quiet" };

/**
 * Red with the siren and the regions under alert, green "ALL CLEAR" or "NO ALERTS", "--" before an answer and on
 * errors, white "SET REGION" when every region is None. `flash`: which of the SIREN pictures is shown.
 */
function frame(state: State, flash: number): Element[] {
  switch (state.kind) {
    case "wait":
      return [{ type: "text", id: "dash", text: "--", font: "large", color: WHITE, x: 36, y: 8, align: "center" }];
    case "unset":
      return [centered("unset", "SET REGION", WHITE)];
    case "alert":
      return [
        {
          type: "rectangle",
          id: "red",
          x: 0,
          y: 0,
          width: 72,
          height: 16,
          fill: "solid",
          fill_colors: [RED],
          border_width: 0,
          align: "top_left",
        },
        { type: "xpmbitmap", id: "siren", data: SIREN[flash], x: 1, y: 2, align: "top_left", z_index: 1 },
        { type: "text", id: "title", text: "AIR ALERT", font: "small", color: WHITE, x: TEXT_X, y: -1, align: "top_mid", z_index: 1 },
        // One region stands still in the middle of the space right of the siren; several scroll, and so does a wide one.
        state.names.length === 1 && WIDE_NAMES.indexOf(state.names[0]) < 0
          ? { type: "text", id: "regions", text: state.names[0], font: "small", color: WHITE, x: TEXT_X, y: 7, align: "top_mid", z_index: 1 }
          : {
              type: "text",
              id: "regions",
              text: state.names.join(", "),
              font: "small",
              color: WHITE,
              width: TEXT_W,
              scroll_rate: 1200,
              scroll_start_delay: 1500,
              scroll_repeat_delay: 1500,
              x: TEXT_X,
              y: 7,
              align: "top_mid",
              z_index: 1,
            },
      ];
    case "clear":
      return [centered("clear", "ALL CLEAR", GREEN)];
    case "quiet":
      return [centered("quiet", "NO ALERTS", GREEN)];
  }
}

/**
 * Entry point, called at the end of the file: the device runs this script from top to bottom and starts nothing by itself.
 */
function main(): void {
  // Kyiv city when the settings do not answer.
  let regions = ["kyiv_city"];
  let state: State = { kind: "wait" };
  /** Whether the last answer that told anything had an alert in it: its end brings "ALL CLEAR". */
  let wasAlert = false;
  let loading = false;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let clearTimer: ReturnType<typeof setTimeout> | undefined;
  /** The siren picture shown, an index into SIREN, and the timer that flips it. */
  let flash = 0;
  let sirenTimer: ReturnType<typeof setInterval> | undefined;

  const report = (err: unknown) =>
    console.error(`${APP}: ${err instanceof Error ? err.message : String(err)}`);
  const screen = createScreen(APP, report);
  const redraw = () => screen.show(frame(state, flash));

  function endClear(): void {
    if (clearTimer !== undefined) clearTimeout(clearTimer);
    clearTimer = undefined;
  }

  // The siren flashes only while an alert is on the screen.
  function animate(): void {
    const alert = state.kind === "alert";
    if (alert && sirenTimer === undefined) {
      sirenTimer = setInterval(() => {
        flash = (flash + 1) % SIREN.length;
        redraw();
      }, SIREN_MS);
    } else if (!alert && sirenTimer !== undefined) {
      clearInterval(sirenTimer);
      sirenTimer = undefined;
      flash = 0;
    }
  }

  // One poll at a time. An alert from a source that answered shows even when the other one failed.
  async function poll(): Promise<void> {
    if (loading) return;
    loading = true;
    const result = await check(regions, report);
    loading = false;
    if (stopped) return;

    if (result.alerting.length > 0) {
      endClear();
      wasAlert = true;
      state = { kind: "alert", names: result.alerting };
    } else if (result.failed) {
      state = { kind: "wait" };
    } else if (wasAlert) {
      wasAlert = false;
      state = { kind: "clear" };
      clearTimer = setTimeout(() => {
        clearTimer = undefined;
        if (state.kind !== "clear") return;
        state = { kind: "quiet" };
        redraw();
      }, CLEAR_MS);
    } else if (state.kind !== "clear") {
      state = { kind: "quiet" };
    }
    animate();
    redraw();
  }

  void (async () => {
    try {
      regions = await loadRegions();
    } catch (err) {
      report(err);
    }
    if (stopped) return;
    if (regions.length === 0) {
      // Every region is "None": nothing to watch, so no false "NO ALERTS" and no polling.
      state = { kind: "unset" };
      redraw();
      return;
    }
    redraw();
    await poll();
    if (!stopped) timer = setInterval(() => void poll(), POLL_MS);
  })().catch(report);

  // Back leaves the app. Once the timers are cleared and the handler detached, nothing keeps it alive and the device takes the screen back.
  const unbind = listen("input", (event) => {
    if (stopped || event.key !== "back" || event.action !== "short") return;

    stopped = true;
    screen.close();
    if (timer !== undefined) clearInterval(timer);
    if (sirenTimer !== undefined) clearInterval(sirenTimer);
    endClear();

    // Not detached from inside the handler itself: with nothing else left the unbind stops the app on the spot, while this handler is still running.
    setTimeout(unbind, 0);
  });
}

main();
