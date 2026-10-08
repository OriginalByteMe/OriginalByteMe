import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true });

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1159, height: 652 },
  { width: 809, height: 1024 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;

async function gotoHero(page: Page, viewport: { width: number; height: number } = VIEWPORTS[0]) {
  await page.setViewportSize(viewport);
  await page.goto("/");
  // The black title card holds the intro and hides the hero copy until the visitor clicks to enter.
  await page.getByRole("button", { name: "Click to enter" }).click({ timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1, name: /Hi, I’m Noah Rijkaard/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("listening-easter-egg")).toBeVisible();
}

test("the character world surrounds readable, independent content at each viewport", async ({ page }) => {
  for (const viewport of [...VIEWPORTS, { width: 390, height: 667 }]) {
    await gotoHero(page, viewport);
    await expect(page.getByTestId("character-hero")).toHaveAttribute("data-status", "ready", { timeout: 60_000 });
    const layout = await page.evaluate(() => {
      const sticky = document.querySelector<HTMLElement>(".character-world__viewport")!.getBoundingClientRect();
      const world = document.querySelector<HTMLElement>(".character-stage")!.getBoundingClientRect();
      const ask = document.querySelector<HTMLElement>(".immersive-hero__ask")!.getBoundingClientRect();
      const controls = document.querySelector<HTMLElement>(".character-hero__controls")!.getBoundingClientRect();
      const overlap = !(ask.right <= controls.left || ask.left >= controls.right || ask.bottom <= controls.top || ask.top >= controls.bottom);
      return { documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, worldWidth: world.width, stickyWidth: sticky.width, worldHeight: world.height, stickyHeight: sticky.height, overlap, pointerEvents: getComputedStyle(document.querySelector(".character-stage__canvas")!).pointerEvents };
    });
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.worldWidth).toBeCloseTo(layout.stickyWidth, 0);
    expect(layout.worldHeight).toBeCloseTo(layout.stickyHeight, 0);
    expect(layout.overlap).toBe(false);
    expect(layout.pointerEvents).toBe("none");
    await expect(page.getByRole("link", { name: "Email Noah" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Ask-Me composer" })).toBeVisible();
  }
});

test("hero destinations and controls remain touch-sized and keyboard-accessible", async ({ page }) => {
  await gotoHero(page, { width: 1440, height: 900 });
  await expect(page.getByTestId("character-hero")).toHaveAttribute("data-status", "ready", { timeout: 60_000 });
  for (const action of [
    page.getByRole("link", { name: "Read Noah's story" }),
    page.getByRole("link", { name: "Read Noah's blog" }),
    page.getByRole("button", { name: "Toggle color theme" }),
    page.getByRole("link", { name: "Email Noah" }),
    page.getByRole("link", { name: "Visit Noah on GitHub" }),
    page.getByRole("link", { name: "Visit Noah on LinkedIn" }),
    page.getByRole("button", { name: "Skip intro" }),
    page.getByRole("button", { name: "Open Ask-Me composer" }),
  ]) {
    expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await action.focus(); await expect(action).toBeFocused();
    expect(await action.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
  }
  await expect(page.getByRole("link", { name: "Email Noah" })).toHaveAttribute("href", "mailto:noahrijkaard@gmail.com");
});

test("Ask-Me expands in place at 809px and restores keyboard focus", async ({ page }) => {
  await gotoHero(page, { width: 809, height: 1024 });
  const ask = page.getByRole("region", { name: "Ask-Me" });
  const launcher = ask.getByRole("button", { name: "Open Ask-Me composer" });

  await expect(ask).toHaveAttribute("data-state", "collapsed");
  await expect(ask.getByRole("textbox", { name: "Ask a question about Noah" })).toHaveCount(0);
  await expect(ask.getByRole("button", { name: "What does Noah do for a living?" })).toHaveCount(0);
  await launcher.focus();
  await page.keyboard.press("Enter");

  await expect(ask).toHaveAttribute("data-state", "expanded");
  await expect(ask.getByRole("textbox", { name: "Ask a question about Noah" })).toBeFocused();
  await expect(ask.getByRole("button", { name: "What does Noah do for a living?" })).toBeVisible();
  await expect(ask.getByRole("button", { name: "How does the AI cutout tool work?" })).toBeVisible();
  await expect(ask.getByRole("button", { name: "What is Noah good at?" })).toBeVisible();

  const panelBounds = await ask.boundingBox();
  expect(panelBounds).not.toBeNull();
  expect(panelBounds!.x).toBeGreaterThanOrEqual(0);
  expect(panelBounds!.x + panelBounds!.width).toBeLessThanOrEqual(809);

  await ask.getByRole("button", { name: "Collapse Ask-Me" }).click();
  await expect(launcher).toBeFocused();
  await expect(ask).toHaveAttribute("data-state", "collapsed");
});

test("theme and site-wide listening controls expose predictable state without blocking story content", async ({ page }) => {
  await page.route("**/api/spotify/recently-played?**", (route) =>
    route.fulfill({ json: { tracks: [] } }),
  );
  await page.route("**/api/spotify/palette-picker", (route) =>
    route.fulfill({ json: { palette: [[255, 255, 255], [0, 0, 0]] } }),
  );
  await page.addInitScript(() => {
    window.sessionStorage.setItem("listeningEasterEggSlot", "chapter-2-right");
  });
  await gotoHero(page, { width: 809, height: 1024 });

  const theme = page.getByRole("button", { name: "Toggle color theme" });
  const pressedBefore = await theme.getAttribute("aria-pressed");
  expect(["true", "false"]).toContain(pressedBefore);
  await theme.click();
  await expect(theme).toHaveAttribute("aria-pressed", pressedBefore === "true" ? "false" : "true");

  const listening = page.getByTestId("listening-easter-egg");
  const trigger = listening.getByRole("button", { name: "Show Noah's listening context" });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(listening.getByText("Want to know what I’m listening to?")).toBeAttached();
  await trigger.focus();
  await expect(listening.locator(".listening-easter-egg__cta")).toHaveCSS("opacity", "1");
  await trigger.click();
  await expect(listening.getByRole("button", { name: "Hide Noah's listening context" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#listening-easter-egg-archive")).toBeVisible();

  const expandedLayout = await page.evaluate(() => {
    const layer = document.querySelector<HTMLElement>(".listening-easter-egg-layer")!.getBoundingClientRect();
    const archive = document.querySelector<HTMLElement>(".listening-easter-egg__archive")!.getBoundingClientRect();
    const story = document.querySelector<HTMLElement>("#story")!.getBoundingClientRect();
    const section = document.querySelector<HTMLElement>(".listening-easter-egg-layer")?.closest("section")?.getBoundingClientRect();
    const anchor = document.querySelector<HTMLElement>(".site-listening-section-anchor");
    const dock = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.getAttribute("aria-label") === "Ask this portfolio a question")
      ?.getBoundingClientRect();
    const overlapsDock = dock ? !(
      archive.right <= dock.left || archive.left >= dock.right || archive.bottom <= dock.top || archive.top >= dock.bottom
    ) : false;
    return {
      normalFlowReserved: section
        ? layer.bottom <= section.bottom + 1 && getComputedStyle(anchor!).position === "static"
        : layer.bottom <= story.top + 1,
      archiveWithinViewport: archive.left >= 0 && archive.right <= window.innerWidth,
      overlapsDock,
    };
  });

  expect(expandedLayout.normalFlowReserved).toBe(true);
  expect(expandedLayout.archiveWithinViewport).toBe(true);
  expect(expandedLayout.overlapsDock).toBe(false);
});

test("Spotify palette selection remains keyboard-accessible in the site-wide archive", async ({ page }) => {
  await page.route("**/api/spotify/recently-played?**", (route) =>
    route.fulfill({ json: { tracks: [] } }),
  );
  await page.route("**/api/spotify/palette-picker", (route) =>
    route.fulfill({ json: { palette: [[255, 255, 255], [0, 0, 0]] } }),
  );
  await gotoHero(page, { width: 1280, height: 900 });

  await page.getByRole("button", { name: "Show Noah's listening context" }).click();
  const pills = page.getByTestId("spotify-pill");
  await expect(pills.first()).toBeVisible();

  const paletteAction = page.getByRole("button", { name: "Use Blinding Lights for the portrait palette" });
  await paletteAction.focus();
  await expect(paletteAction).toBeFocused();
  await expect(paletteAction).toHaveCSS("opacity", "1");
  await paletteAction.click();
  await expect(page.getByRole("button", { name: "Remove Blinding Lights from the portrait palette" })).toHaveAttribute("aria-pressed", "true");

  const archiveBounds = await page.locator(".listening-easter-egg__archive").evaluate((archive) => {
    const archiveBox = archive.getBoundingClientRect();
    return Array.from(archive.querySelectorAll<HTMLElement>("[data-testid='spotify-pill']")).map((pill) => {
      const box = pill.getBoundingClientRect();
      return {
        inside: box.left >= archiveBox.left && box.right <= archiveBox.right,
        width: box.width,
      };
    });
  });
  expect(archiveBounds.length).toBeGreaterThan(0);
  expect(archiveBounds.every(({ inside, width }) => inside && width > 0)).toBe(true);
});
