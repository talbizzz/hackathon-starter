// Re-records the landing page's phone demo (public/landing/hero.mp4 and hero-poster.jpg).
//
// It drives the real app in a phone-sized browser: map, start a plan, pick three spots, share, then three friends vote.
// Run the app first (pnpm dev), wait for it to be ready, then:
//
//   pnpm record:hero                      # records against http://localhost:3000
//   BASE_URL=https://nebenmir.app pnpm record:hero
//
// First time only: pnpm exec playwright install chromium. Also needs ffmpeg.
//
// Side effects: it creates ONE real plan with three votes in the database the app points at. The plan is tagged
// source = "demo-recording" (see utm_source below), so you can find it in /stats or delete it. Analytics (PostHog) is blocked.
// The clock starts on a Saturday afternoon in Berlin, so most spots show as open whatever day you record.
// To change what the demo shows, edit the SPOTS and VOTERS constants below.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT_DIR = resolve(import.meta.dirname, "../public/landing");

// Spots to add to the plan (names exactly as in the app) and how the friends vote.
const SPOTS = ["AERA Fasanenhof bakery", "Boulderklub Kreuzberg", "Computerspielemuseum"];
const VOTERS = [
  { name: "Lena", spot: SPOTS[1], onCamera: true },
  { name: "Max", spot: SPOTS[0] },
  { name: "Sofia", spot: SPOTS[0] },
];

const VIEWPORT = { width: 390, height: 844 };
const FIXED_TIME = new Date("2026-11-21T14:00:00+01:00"); // a Saturday, 14:00 in Berlin
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const tmp = mkdtempSync(join(tmpdir(), "hero-"));

// A phone-like browser with the page prepared so nothing in the picture looks like a dev tool.
async function phone() {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "en-GB",
    timezoneId: "Europe/Berlin",
  });
  // No analytics from the recording.
  await context.route(/posthog\.com/, (route) => route.abort());
  await context.addInitScript(() => {
    // A share sheet that just closes, so no "link copied" or "share failed" message ends up in the video.
    navigator.share = () => new Promise((resolve) => setTimeout(resolve, 300));
    // Hide the Next.js dev badge when recording against `pnpm dev`.
    const hide = document.createElement("style");
    hide.textContent = "nextjs-portal { display: none !important; }";
    document.addEventListener("DOMContentLoaded", () => document.head.append(hide));
  });
  const page = await context.newPage();
  // Start the clock at that time but let it run: a frozen clock stops the map's tile fade-in and leaves the map grey.
  await page.clock.install({ time: FIXED_TIME });
  return { context, page };
}

// Every picture on the page (pins, card stills, map tiles) has finished loading, so nothing shows as an empty box.
async function picturesLoaded(page) {
  await page.waitForFunction(() => {
    const imgs = [...document.images];
    return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0);
  }, undefined, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

// Neither Playwright's recordVideo nor Chrome's screencast gives frames at the phone's real pixel size (780 x 1688),
// so take 2x screenshots back to back (about 15 a second) and join them into a video afterwards.
async function startCapture(context, page) {
  const cdp = await context.newCDPSession(page);
  const frames = []; // { file, t }: a picture and the second it was taken
  let running = true;
  const loop = (async () => {
    while (running) {
      // A screenshot can hang while the page is changing over; skip that frame instead of waiting for it.
      const shot = await Promise.race([
        cdp.send("Page.captureScreenshot", {
          format: "jpeg",
          quality: 90,
          clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height, scale: 2 },
        }).catch(() => null),
        pause(2000).then(() => null),
      ]);
      if (!shot) continue;
      const file = join(tmp, `frame-${String(frames.length).padStart(6, "0")}.jpg`);
      writeFileSync(file, Buffer.from(shot.data, "base64"));
      frames.push({ file, t: Date.now() / 1000 });
    }
  })();
  return { frames, stop: async () => ((running = false), loop) };
}

const card = (page, name) => page.locator('[data-testid="spot-card"]', { hasText: name }).first();

async function bring(page, locator) {
  await locator.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
  await pause(700);
}

// Cast one vote on the plan page, as someone who just opened the link.
async function vote(page, { name, spot }, { typed = false } = {}) {
  await page.getByTestId("vote-screen").waitFor();
  await picturesLoaded(page);
  if (typed) {
    await page.getByTestId("vote-name").click();
    await page.getByTestId("vote-name").pressSequentially(name, { delay: 110 });
  } else {
    await page.getByTestId("vote-name").fill(name);
  }
  await pause(typed ? 500 : 0);
  const choose = card(page, spot).getByTestId("choose-spot");
  if (typed) await bring(page, choose);
  await choose.click();
  if (typed) await pause(700);
  await page.getByTestId("submit-vote").click();
  await page.getByTestId("status-screen").waitFor();
}

let planUrl;
try {
  const { context, page } = await phone();

  // 1. The map, with every picture loaded.
  await page.goto(`${BASE_URL}/map?utm_source=demo-recording`, { waitUntil: "networkidle" });
  await page.getByTestId("spot-card").first().waitFor();
  await picturesLoaded(page);
  await pause(1500); // pins finish their entrance animation
  const capture = await startCapture(context, page); // the video starts here, after the page has loaded
  await pause(1800);

  // 2. Start a plan.
  await page.getByTestId("start-plan").click();
  await page.getByTestId("plan-setup").waitFor();
  await pause(1500);
  await page.getByTestId("setup-start").click();
  await pause(600);

  // 3. Pick three spots.
  for (const name of SPOTS) {
    const spot = card(page, name);
    await bring(page, spot);
    await spot.getByTestId("add-to-plan").click();
    await pause(600);
  }
  await pause(300);

  // 4. Share it. The app saves the plan and opens the plan page.
  await page.getByTestId("share-plan").click();
  await page.waitForURL(/\/p\/[0-9a-f-]{36}/);
  planUrl = page.url().split("?")[0];

  // 5. The first friend votes on camera.
  const [first, ...others] = VOTERS;
  await vote(page, first, { typed: true });
  await pause(1500);

  // 6. The others vote on their own phones (off camera); the recorded page picks it up by itself.
  for (const voter of others) {
    const friend = await phone();
    await friend.page.goto(planUrl);
    await vote(friend.page, voter);
    await friend.context.close();
    await pause(3400); // the recorded page polls every 3 s
  }
  await page.getByText(/it is decided/i).waitFor({ timeout: 15_000 });
  await pause(1800);
  await bring(page, page.getByTestId("results"));
  await pause(1800);

  await capture.stop();
  await context.close();

  // Show each frame until the next one was taken.
  const { frames } = capture;
  const list = ["ffconcat version 1.0"];
  frames.forEach((f, i) => list.push(`file '${f.file}'`, `duration ${((frames[i + 1]?.t ?? f.t + 0.5) - f.t).toFixed(4)}`));
  list.push(`file '${frames.at(-1).file}'`); // ffmpeg ignores the last duration unless the file is repeated
  const listFile = join(tmp, "frames.txt");
  writeFileSync(listFile, list.join("\n"));

  // Make a small MP4 that plays everywhere (H.264, 4:2:0, faststart, no sound).
  mkdirSync(OUT_DIR, { recursive: true });
  const mp4 = join(OUT_DIR, "hero.mp4");
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listFile,
    "-vf", "fps=30,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-movflags", "+faststart", "-an", mp4,
  ]);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", mp4, "-frames:v", "1", "-q:v", "3", join(OUT_DIR, "hero-poster.jpg")]);
  console.log(`Done: ${mp4} and hero-poster.jpg\nPlan recorded: ${planUrl}`);
} finally {
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
}
