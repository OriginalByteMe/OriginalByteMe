import { expect, test, type Page } from "@playwright/test";

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

      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        portraitWidth: portraitBox.width,
        portraitHeight: portraitBox.height,
        spotifyLeft: spotifyBox.left,
        spotifyRight: spotifyBox.right,
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
  }
});

test("actions are unique, labelled, touch-sized, and follow semantic keyboard order", async ({ page }) => {
  await gotoHero(page);
  const hero = page.getByRole("region", { name: "Noah Rijkaard" });

  const actions = [
    hero.getByRole("link", { name: "Read Noah's story" }),
    hero.getByRole("link", { name: "Read Noah's blog" }),
    hero.getByRole("link", { name: "Email Noah" }),
    hero.getByRole("link", { name: "Visit Noah on GitHub" }),
    hero.getByRole("link", { name: "Visit Noah on LinkedIn" }),
    hero.getByRole("button", { name: "Toggle color theme" }),
    hero.getByRole("button", { name: "Show Noah's listening context" }),
    hero.getByRole("textbox", { name: "Ask a question about Noah" }),
    hero.getByRole("button", { name: "Send question" }),
  ];

  for (const action of actions) {
    await expect(action).toHaveCount(1);
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  await page.keyboard.press("Tab");
  await expect(actions[0]).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(actions[1]).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(actions[2]).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(actions[3]).toBeFocused();
});

test("theme and compact Spotify controls expose predictable pressed states", async ({ page }) => {
  await gotoHero(page);
  const hero = page.getByRole("region", { name: "Noah Rijkaard" });

  const theme = hero.getByRole("button", { name: "Toggle color theme" });
  await expect(theme).toHaveAttribute("aria-pressed", "true");
  await theme.click();
  await expect(theme).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("html")).toHaveClass(/light/);

  const spotify = hero.getByRole("button", { name: "Show Noah's listening context" });
  await expect(spotify).toHaveAttribute("aria-expanded", "false");
  await spotify.click();
  await expect(hero.getByRole("button", { name: "Hide Noah's listening context" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});
