import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true });

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3440, height: 1440 },
] as const;

async function gotoHero(page: Page, viewport: { width: number; height: number } = VIEWPORTS[0]) {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Noah Rijkaard" })).toBeVisible();
}

test("the profile-first hero keeps its complete composition inside every reference viewport", async ({
  page,
}) => {
  for (const viewport of VIEWPORTS) {
    await gotoHero(page, viewport);

    const layout = await page.evaluate(() => {
      const portrait = document.querySelector<HTMLElement>("[data-testid='hero-portrait']")!;
      const spotify = document.querySelector<HTMLElement>("[data-testid='compact-spotify']")!;
      const portraitBox = portrait.getBoundingClientRect();
      const spotifyBox = spotify.getBoundingClientRect();
      const heroBox = document.querySelector<HTMLElement>(".profile-hero-grid")!.getBoundingClientRect();
      const blocks = Array.from(document.querySelectorAll<HTMLElement>(".profile-hero-grid > *"));
      const support = Array.from(document.querySelectorAll<HTMLElement>(".profile-support"));
      const overlapsPortrait = support.some((element) => {
        const box = element.getBoundingClientRect();
        return !(
          box.right <= portraitBox.left ||
          box.left >= portraitBox.right ||
          box.bottom <= portraitBox.top ||
          box.top >= portraitBox.bottom
        );
      });

      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        portraitWidth: portraitBox.width,
        portraitHeight: portraitBox.height,
        spotifyLeft: spotifyBox.left,
        spotifyRight: spotifyBox.right,
        allBlocksContained: blocks.every((element) => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && box.left >= 0 && box.right <= window.innerWidth &&
            box.top >= heroBox.top && box.bottom <= heroBox.bottom;
        }),
        overlapsPortrait,
        portraitDominates: support.every((element) => {
          const box = element.getBoundingClientRect();
          return portraitBox.width * portraitBox.height > box.width * box.height;
        }),
      };
    });

    expect(layout.documentWidth, `${viewport.width} document width`).toBeLessThanOrEqual(
      layout.viewportWidth,
    );
    expect(layout.portraitWidth, `${viewport.width} portrait width`).toBeGreaterThanOrEqual(280);
    expect(layout.portraitHeight, `${viewport.width} portrait height`).toBeGreaterThanOrEqual(280);
    expect(layout.spotifyLeft, `${viewport.width} Spotify left edge`).toBeGreaterThanOrEqual(0);
    expect(layout.spotifyRight, `${viewport.width} Spotify right edge`).toBeLessThanOrEqual(
      layout.viewportWidth,
    );
    expect(layout.allBlocksContained, `${viewport.width} hero block containment`).toBe(true);
    expect(layout.overlapsPortrait, `${viewport.width} portrait obstruction`).toBe(false);
    expect(layout.portraitDominates, `${viewport.width} portrait dominance`).toBe(true);
  }
});

test("actions are unique, labelled, touch-sized, and follow semantic keyboard order", async ({ page }) => {
  await gotoHero(page, { width: 1280, height: 900 });
  const hero = page.getByRole("region", { name: "Noah Rijkaard" });

  const actions = [
    hero.getByRole("link", { name: "Read Noah's story" }),
    hero.getByRole("link", { name: "Read Noah's blog" }),
    hero.getByRole("link", { name: "Email Noah" }),
    hero.getByRole("link", { name: "Visit Noah on GitHub" }),
    hero.getByRole("link", { name: "Visit Noah on LinkedIn" }),
    hero.getByRole("button", { name: "Toggle color theme" }),
    hero.getByRole("button", { name: "Show Noah's listening context" }),
    hero.getByRole("button", { name: "Open Ask-Me" }),
  ];

  for (const action of actions) {
    await expect(action).toHaveCount(1);
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  for (const action of actions) {
    await page.keyboard.press("Tab");
    await expect(action).toBeFocused();
    const outline = await action.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outline).not.toBe("none");
  }
});

test("Ask-Me expands from a compact entry point and restores keyboard focus", async ({ page }) => {
  await gotoHero(page);
  const hero = page.getByRole("region", { name: "Noah Rijkaard" });
  const launcher = hero.getByRole("button", { name: "Open Ask-Me" });

  await expect(hero.getByRole("textbox", { name: "Ask a question about Noah" })).toHaveCount(0);
  await launcher.focus();
  await page.keyboard.press("Enter");
  await expect(hero.getByRole("textbox", { name: "Ask a question about Noah" })).toBeFocused();
  await hero.getByRole("button", { name: "Close Ask-Me" }).click();
  await expect(launcher).toBeFocused();

  await launcher.tap();
  const panel = hero.getByRole("region", { name: "Ask-Me" });
  await expect(panel.getByRole("textbox", { name: "Ask a question about Noah" })).toBeVisible();
  const panelBounds = await panel.boundingBox();
  expect(panelBounds).not.toBeNull();
  expect(panelBounds!.x).toBeGreaterThanOrEqual(0);
  expect(panelBounds!.x + panelBounds!.width).toBeLessThanOrEqual(390);
});

test("theme and compact Spotify controls expose predictable pressed states", async ({ page }) => {
  await gotoHero(page);
  const hero = page.getByRole("region", { name: "Noah Rijkaard" });

  const theme = hero.getByRole("button", { name: "Toggle color theme" });
  await expect(theme).toHaveAttribute("aria-pressed", "true");
  const surface = hero.locator(".hero-panel").first();
  await expect(surface).toHaveCSS("background-color", "rgb(43, 40, 48)");
  const darkSurface = await hero.locator(".hero-panel").first().evaluate((element) =>
    getComputedStyle(element).backgroundColor,
  );
  await theme.click();
  await expect(theme).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(surface).toHaveCSS("background-color", "rgb(255, 253, 248)");
  const lightSurface = await hero.locator(".hero-panel").first().evaluate((element) =>
    getComputedStyle(element).backgroundColor,
  );
  expect(darkSurface).toBe("rgb(43, 40, 48)");
  expect(lightSurface).toBe("rgb(255, 253, 248)");
  const contrast = async () => hero.locator(".hero-panel").first().evaluate((element) => {
    const parse = (value: string) => value.match(/\d+/g)!.slice(0, 3).map(Number);
    const luminance = (value: string) => {
      const channels = parse(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const styles = getComputedStyle(element);
    const foreground = luminance(styles.color);
    const background = luminance(styles.backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(await contrast()).toBeGreaterThanOrEqual(4.5);

  await theme.click();
  await expect(theme).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await contrast()).toBeGreaterThanOrEqual(4.5);

  const spotify = hero.getByRole("button", { name: "Show Noah's listening context" });
  await expect(spotify).toHaveAttribute("aria-expanded", "false");
  await spotify.tap();
  await expect(hero.getByRole("button", { name: "Hide Noah's listening context" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});

test("expanded Spotify pills remain visible inside the compact panel at laptop width", async ({
  page,
}) => {
  await page.route("**/api/spotify/recently-played?**", (route) =>
    route.fulfill({ json: { tracks: [] } }),
  );
  await page.route("**/api/spotify/palette-picker", (route) =>
    route.fulfill({ json: { palette: [[255, 255, 255], [0, 0, 0]] } }),
  );
  await gotoHero(page, { width: 1280, height: 900 });
  const panel = page.getByTestId("compact-spotify");

  await panel.getByRole("button", { name: "Show Noah's listening context" }).click();
  const pills = panel.getByTestId("spotify-pill");
  await expect(pills.first()).toBeVisible();

  const bounds = await panel.evaluate((element) => {
    const panelBox = element.getBoundingClientRect();
    const pillBoxes = Array.from(element.querySelectorAll<HTMLElement>("[data-testid='spotify-pill']"))
      .map((pill) => pill.getBoundingClientRect());

    return {
      panel: { left: panelBox.left, right: panelBox.right },
      pills: pillBoxes.map((pill) => ({ left: pill.left, right: pill.right, width: pill.width })),
    };
  });

  expect(bounds.pills.length).toBeGreaterThan(0);
  for (const pill of bounds.pills) {
    expect(pill.left).toBeGreaterThanOrEqual(bounds.panel.left);
    expect(pill.right).toBeLessThanOrEqual(bounds.panel.right);
    expect(pill.width).toBeGreaterThan(0);
  }
});
