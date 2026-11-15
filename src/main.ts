import { generateXpm2 } from "@busy-app/busy-lib";
import { device } from "@shared/device";
import manifest from "./appmeta/manifest.json";
import { createScreen, type Element } from "./screen";

/** The name the app draws under; the device clears elements by this id. */
const APP = manifest.id;

/** Ukraine: every region with "alertnow", keyed by its Ukrainian name; about 4 KB. */
const UKRAINE = "https://ubilling.net.ua/aerialalerts/";
/**
 * Israel: the alerts going on now, an empty list when there are none. Each is
 * { notificationId, time, threat, isDrill, cities }, cities the places under it by their Hebrew names in tzevaadom's
 * list of cities (their site's own client reads it so, www.tzevaadom.co.il/tzofar-site/static/js/app.js).
 */
const ISRAEL = "https://api.tzevaadom.co.il/notifications";
const POLL_MS = 20 * 1000;
/** How long "ALL CLEAR" stays after the last alert ends. */
const CLEAR_MS = 60 * 1000;

const WHITE = "#FFFFFFFF";
const GREEN = "#00FF00FF";
const RED = "#E00000FF";
/** The status LED blinks this, and the siren sounds, when an alert begins and when a region joins one. */
const LED_RED = "#FF0000FF";
const SIREN_SOUND = "sounds/siren.snd";

/** The answer kept from an earlier poll, shown while no source answers, is drawn at this brightness. */
const DIM = 0.4;
/** The no-connection picture, the same in every app; in the top right corner, clear of the siren and the text. */
const OFFLINE = ["! XPM2", "5 5 2 1", ". c none", "r c #FF3030", "r...r", ".r.r.", "..r..", ".r.r.", "r...r"].join("\n");
const OFFLINE_ICON: Element = { type: "xpmbitmap", id: "offline", data: OFFLINE, x: 67, y: 0, align: "top_left", z_index: 3 };
/** A black square under it, a pixel wider: on the red of an alert the red cross would not stand out. */
const OFFLINE_BACK: Element = {
  type: "rectangle",
  id: "offline_back",
  x: 66,
  y: 0,
  width: 6,
  height: 6,
  fill: "solid",
  fill_colors: ["#000000FF"],
  border_width: 0,
  align: "top_left",
  z_index: 2,
};
/** localStorage key of the last answer: the regions picked and those of them under alert, as JSON. */
const KEPT_KEY = "last";

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
 * The names wider than that in the small font, 65 px each; the widest city of Israel, KIRYAT SHMONA, takes 58. A list,
 * not textWidth(): that one brings the font maps into the app, about 17 KB of heap on the emulator.
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
/** Any alert in Israel. */
const ISRAEL_REGION = "israel";
/**
 * The cities of Israel in the settings: their names in tzevaadom's alerts and the name on the screen. An alert names a
 * part of a big city "<city> - <part>" (once "אשדוד -יא,…", without the space) and a city with its neighbour
 * "<city>, <neighbour>", so a place is the city's when it is the name, or starts with it and " -" or ",". Modiin has
 * two names: the city's own and the one its shopping centres go under.
 */
const CITIES: Record<string, { he: string[]; name: string }> = {
  il_ashdod: { he: ["אשדוד"], name: "ASHDOD" },
  il_ashkelon: { he: ["אשקלון"], name: "ASHKELON" },
  il_bat_yam: { he: ["בת ים"], name: "BAT YAM" },
  il_beer_sheva: { he: ["באר שבע"], name: "BEER SHEVA" },
  il_beit_shemesh: { he: ["בית שמש"], name: "BEIT SHEMESH" },
  il_bnei_brak: { he: ["בני ברק"], name: "BNEI BRAK" },
  il_eilat: { he: ["אילת"], name: "EILAT" },
  il_hadera: { he: ["חדרה"], name: "HADERA" },
  il_haifa: { he: ["חיפה"], name: "HAIFA" },
  il_herzliya: { he: ["הרצליה"], name: "HERZLIYA" },
  il_hod_hasharon: { he: ["הוד השרון"], name: "HOD HASHARON" },
  il_holon: { he: ["חולון"], name: "HOLON" },
  il_jerusalem: { he: ["ירושלים"], name: "JERUSALEM" },
  il_kfar_saba: { he: ["כפר סבא"], name: "KFAR SABA" },
  il_kiryat_gat: { he: ["קריית גת"], name: "KIRYAT GAT" },
  il_kiryat_shmona: { he: ["קריית שמונה"], name: "KIRYAT SHMONA" },
  il_lod: { he: ["לוד"], name: "LOD" },
  il_modiin: { he: ["מודיעין מכבים רעות", "מודיעין"], name: "MODIIN" },
  il_nahariya: { he: ["נהריה"], name: "NAHARIYA" },
  il_nazareth: { he: ["נצרת"], name: "NAZARETH" },
  il_netanya: { he: ["נתניה"], name: "NETANYA" },
  il_petah_tikva: { he: ["פתח תקווה"], name: "PETAH TIKVA" },
  il_raanana: { he: ["רעננה"], name: "RAANANA" },
  il_rahat: { he: ["רהט"], name: "RAHAT" },
  il_ramat_gan: { he: ["רמת גן"], name: "RAMAT GAN" },
  il_ramla: { he: ["רמלה"], name: "RAMLA" },
  il_rehovot: { he: ["רחובות"], name: "REHOVOT" },
  il_rishon_lezion: { he: ["ראשון לציון"], name: "RISHON LEZION" },
  il_rosh_haayin: { he: ["ראש העין"], name: "ROSH HAAYIN" },
  il_sderot: { he: ["שדרות"], name: "SDEROT" },
  il_tel_aviv: { he: ["תל אביב"], name: "TEL AVIV" },
};

/**
 * The regions picked on the app's settings page, "none" and repeats left out: three of Ukraine or all of Israel, and
 * three cities of Israel, fields of their own since an enum takes at most 32 options.
 */
async function loadRegions(): Promise<string[]> {
  const { values } = await device.AppsSettingsGet({ app_id: APP });
  return [values.region1, values.region2, values.region3, values.city1, values.city2, values.city3]
    .filter((r): r is string => typeof r === "string" && (r === ISRAEL_REGION || r in REGIONS || r in CITIES))
    .filter((r, i, all) => all.indexOf(r) === i);
}

/** A picked region's name on the screen. */
function nameOf(region: string): string {
  if (region in REGIONS) return REGIONS[region].name;
  return region in CITIES ? CITIES[region].name : "ISRAEL";
}

async function get(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res;
}

/** A string's UTF-8 bytes, each as a character: what a piece of an answer read as bytes looks like. */
function bytes(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) out += String.fromCharCode(c);
    else if (c < 0x800) out += String.fromCharCode(0xc0 | (c >> 6), 0x80 | (c & 63));
    else out += String.fromCharCode(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

/**
 * Reads a JSON list piece by piece and tells, for each list of patterns (made by bytes()), whether any of them is in
 * it; `cut`, the error that ended the answer before its end, when it was cut short. Not taken whole: all of
 * tzevaadom's 1449 places in one answer come to about 30 KB, and as one string, let alone parsed, they run the app
 * out of heap.
 */
async function scan(url: string, patterns: string[][]): Promise<{ found: boolean[]; cut?: string }> {
  const res = await get(url);
  if (!res.body) throw new Error(`No body from ${url}`);
  const reader = res.body.getReader();
  const found = patterns.map(() => false);
  /** The end of what was read, a byte shorter than the longest pattern: a pattern may span two pieces. */
  let tail = "";
  let keep = 0;
  for (const group of patterns) for (const p of group) keep = Math.max(keep, p.length - 1);
  /** Whether the answer begins as a list; undefined until its first character. */
  let isList: boolean | undefined;
  let cut: string | undefined;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      // A stream cut short does not throw: its last read is done, with the error's text for a value.
      if (value !== undefined) cut = `${String(value)} from ${url}`;
      break;
    }
    let text = tail;
    // 256 bytes to a call: fromCharCode takes them as its arguments.
    for (let i = 0; i < value.length; i += 256) text += String.fromCharCode.apply(null, value.subarray(i, i + 256) as unknown as number[]);
    if (isList === undefined && text.trim() !== "") isList = text.trim()[0] === "[";
    patterns.forEach((group, i) => {
      if (!found[i]) found[i] = group.some((p) => text.indexOf(p) >= 0);
    });
    tail = text.slice(Math.max(0, text.length - keep));
  }
  if (!isList) throw new Error(cut ?? `Not a list from ${url}`);
  return { found, cut };
}

interface Poll {
  /** The picked regions under alert now. */
  alerting: string[];
  /** The picked regions their source told nothing of: it did not answer, or its answer was cut short before them. */
  unknown: string[];
}

/** Asks each source the picked regions need, once. */
async function check(regions: string[], report: (err: unknown) => void): Promise<Poll> {
  const result: Poll = { alerting: [], unknown: [] };
  const ukraine = regions.filter((r) => r in REGIONS);
  if (ukraine.length > 0) {
    try {
      const body = (await (await get(UKRAINE)).json()) as { states: Record<string, { alertnow: boolean } | undefined> };
      for (const r of ukraine) if (body.states[REGIONS[r].key]?.alertnow) result.alerting.push(r);
    } catch (err) {
      result.unknown.push(...ukraine);
      report(err);
    }
  }
  const israel = regions.filter((r) => !(r in REGIONS));
  if (israel.length > 0) {
    try {
      // What tells a region is under alert: "{" opens any alert in the list, "[]" when there is none; a place of a city
      // comes in quotes, in Hebrew as it is (UTF-8, not \u escapes): the name, or the name and " -" or "," after it.
      const patterns = israel.map((r) => {
        if (r === ISRAEL_REGION) return ["{"];
        const out: string[] = [];
        for (const n of CITIES[r].he) out.push(bytes(`"${n}"`), bytes(`"${n} -`), bytes(`"${n},`));
        return out;
      });
      // What an answer cut short has is so; the regions not found in it are not known.
      const { found, cut } = await scan(ISRAEL, patterns);
      israel.forEach((r, i) => {
        if (found[i]) result.alerting.push(r);
        else if (cut) result.unknown.push(r);
      });
      if (cut) report(cut);
    } catch (err) {
      result.unknown.push(...israel);
      report(err);
    }
  }
  return result;
}

/** A colour, "#RRGGBBAA", at DIM of its brightness. */
function dimmed(color: string): string {
  let out = "#";
  for (let i = 1; i < 7; i += 2) out += Math.round(parseInt(color.slice(i, i + 2), 16) * DIM).toString(16).padStart(2, "0");
  return out + color.slice(7);
}

/** An element drawn at DIM of its brightness. */
function dim(e: Element): Element {
  if (e.type === "text") return { ...e, color: dimmed(e.color ?? WHITE) };
  if (e.type === "rectangle") return { ...e, fill_colors: (e.fill_colors ?? []).map(dimmed) };
  if (e.type === "xpmbitmap") return { ...e, opacity: Math.round(DIM * 100) };
  return e;
}

function centered(id: string, text: string, color: string): Element {
  return { type: "text", id, text, font: "bold", color, x: 36, y: 8, align: "center" };
}

type State =
  | { kind: "wait" }
  | { kind: "unset" }
  | { kind: "alert"; names: string[] }
  /** The answer kept from an earlier poll, the regions under alert in it; none for quiet. */
  | { kind: "kept"; names: string[] }
  | { kind: "clear" }
  | { kind: "quiet" };

/**
 * Red with the siren and the regions under alert, green "ALL CLEAR" or "NO ALERTS", "--" before an answer and when no
 * source answers with nothing kept, white "SET REGION" when every region is None; the answer kept is that alert or
 * "NO ALERTS" dimmed, the siren still. `flash`: which of the SIREN pictures is shown.
 */
function frame(state: State, flash: number): Element[] {
  switch (state.kind) {
    case "kept":
      return frame(state.names.length > 0 ? { kind: "alert", names: state.names } : { kind: "quiet" }, 0).map(dim);
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
  /** Whether a source did not answer the last poll: the no-connection picture is on the screen. */
  let offline = false;
  /** The picked regions under alert at their source's last answer: one that joins them sounds the siren. */
  let alerted: string[] = [];
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
  /** Draws the state; with led the status LED blinks that colour. */
  const redraw = (led?: string) => {
    const elements = frame(state, flash);
    if (offline) elements.push(OFFLINE_BACK, OFFLINE_ICON);
    screen.show(elements, led);
  };

  /** The last answer kept in localStorage, as its JSON; null before the first. */
  let kept: string | null = null;
  try {
    kept = localStorage.getItem(KEPT_KEY);
  } catch (err) {
    report(err);
  }

  /** Keeps an answer, the picked regions under alert in it; written only when it differs from the one kept. */
  function keep(alerting: string[]): void {
    const next = JSON.stringify({ of: regions, alerting });
    if (next === kept) return;
    kept = next;
    try {
      localStorage.setItem(KEPT_KEY, next);
    } catch (err) {
      report(err);
    }
  }

  /** The regions under alert in the answer kept; null without one, or with one for other regions than those picked now. */
  function lastKept(): string[] | null {
    if (kept === null) return null;
    try {
      const last = JSON.parse(kept) as { of: string[]; alerting: string[] };
      return last.of.join() === regions.join() ? last.alerting : null;
    } catch {
      return null;
    }
  }

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

  // One poll at a time. An alert from a source that answered shows even when the other one failed; with no alert and a
  // source silent, the answer kept from an earlier poll is shown dimmed. A region that joins the alert, the first one
  // included, sounds the siren and blinks the LED.
  async function poll(): Promise<void> {
    if (loading) return;
    loading = true;
    const result = await check(regions, report);
    loading = false;
    if (stopped) return;

    offline = result.unknown.length > 0;
    const rising = result.alerting.some((r) => alerted.indexOf(r) < 0);
    // A region not known this time stays as its source said last.
    alerted = alerted.filter((r) => result.unknown.indexOf(r) >= 0).concat(result.alerting);
    // The answer kept is what each source said last: for the regions not known this time, the alerts the answer kept has.
    const last = lastKept();
    const keptAlerting = last ? last.filter((r) => result.unknown.indexOf(r) >= 0) : [];
    if (result.alerting.length > 0) {
      endClear();
      wasAlert = true;
      state = { kind: "alert", names: result.alerting.map(nameOf) };
      // With a source silent and nothing kept for it, there is no whole answer to keep.
      if (!offline || last) keep(result.alerting.concat(keptAlerting));
    } else if (offline) {
      state = last ? { kind: "kept", names: keptAlerting.map(nameOf) } : { kind: "wait" };
      if (last) keep(keptAlerting);
    } else {
      keep([]);
      if (wasAlert) {
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
    }
    animate();
    if (rising) void device.AudioPlay({ application_name: APP, path: SIREN_SOUND }).catch(report);
    redraw(rising ? LED_RED : undefined);
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
