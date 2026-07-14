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
  await expect(page.getByRole("heading", { level: 1, name: "Noah Rijkaard" })).toBeVisible();
  await expect(page.getByTestId("listening-easter-egg")).toBeVisible();
}

test("the redesigned hero stays collision-free at every reference viewport", async ({ page }) => {
  for (const viewport of VIEWPORTS) {
    await gotoHero(page, viewport);

    await expect(page.getByRole("complementary", { name: "Contact and destinations" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Listening context" })).toHaveCount(0);
    await expect(page.getByTestId("compact-spotify")).toHaveCount(0);
    await expect(page.locator("#ask-me")).toHaveAttribute("data-state", "collapsed");
    await expect(page.getByRole("button", { name: "Ask this portfolio a question" })).toHaveCount(0);
    await expect(page.locator(".site-top-chrome")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(1);
    await expect(page.locator("#hero .profile-nav")).toHaveCount(0);

    const layout = await page.evaluate(() => {
      const portrait = document.querySelector<HTMLElement>("[data-testid='hero-portrait']")!;
      const portraitBox = portrait.getBoundingClientRect();
      const contacts = Array.from(document.querySelectorAll<HTMLElement>(".profile-contact-action"));
      const topChrome = document.querySelector<HTMLElement>(".site-top-chrome")!;
      const topChromeBox = topChrome.getBoundingClientRect();
      const primaryNavigation = document.querySelector<HTMLElement>(".site-primary-nav")!;
      const theme = document.querySelector<HTMLElement>(".site-theme-toggle button")!;
      const themeBox = theme.getBoundingClientRect();
      const navActions = Array.from(primaryNavigation.querySelectorAll<HTMLElement>("a"));
      const listening = document.querySelector<HTMLElement>("[data-testid='listening-easter-egg']")!;
      const listeningBox = listening.getBoundingClientRect();
      const overlaps = (first: DOMRect, second: DOMRect) => !(
        first.right <= second.left ||
        first.left >= second.right ||
        first.bottom <= second.top ||
        first.top >= second.bottom
      );

      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        portraitWidth: portraitBox.width,
        portraitHeight: portraitBox.height,
        contacts: contacts.map((contact) => {
          const box = contact.getBoundingClientRect();
          return {
            anchor: contact.dataset.contactAnchor,
            withinViewport: box.left >= 0 && box.right <= window.innerWidth,
            outsidePortrait: box.right <= portraitBox.left || box.left >= portraitBox.right,
          };
        }),
        topChromeWithinViewport: topChromeBox.left >= 0
          && topChromeBox.right <= window.innerWidth
          && topChromeBox.top >= 0
          && topChromeBox.bottom <= window.innerHeight,
        navigationInChrome: primaryNavigation.parentElement === topChrome,
        themeInChrome: theme.closest(".site-top-chrome") === topChrome,
        themeWithinViewport: themeBox.left >= 0 && themeBox.right <= window.innerWidth && themeBox.top >= 0,
        themeAvoidsNavigation: navActions.every((action) => !overlaps(themeBox, action.getBoundingClientRect())),
        listeningWithinViewport: listeningBox.left >= 0 && listeningBox.right <= window.innerWidth,
        listeningSlot: listening.dataset.slot,
        topChromePosition: getComputedStyle(topChrome).position,
      };
    });

    expect(layout.documentWidth, `${viewport.width} document width`).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.portraitWidth, `${viewport.width} portrait width`).toBeGreaterThanOrEqual(220);
    expect(layout.portraitHeight, `${viewport.width} portrait height`).toBeGreaterThanOrEqual(280);
    expect(layout.contacts.map(({ anchor }) => anchor)).toEqual(["upper-left", "middle-right", "lower-left"]);
    expect(layout.contacts.every(({ withinViewport }) => withinViewport), `${viewport.width} contact containment`).toBe(true);
    expect(layout.contacts.every(({ outsidePortrait }) => outsidePortrait), `${viewport.width} portrait interaction clearance`).toBe(true);
    expect(layout.topChromeWithinViewport, `${viewport.width} chrome containment`).toBe(true);
    expect(layout.navigationInChrome, `${viewport.width} navigation placement`).toBe(true);
    expect(layout.themeInChrome, `${viewport.width} theme placement`).toBe(true);
    expect(layout.themeWithinViewport, `${viewport.width} theme containment`).toBe(true);
    expect(layout.themeAvoidsNavigation, `${viewport.width} theme/nav collision`).toBe(true);
    expect(layout.topChromePosition, `${viewport.width} chrome positioning`).toBe("fixed");
    expect(layout.listeningWithinViewport, `${viewport.width} listening containment`).toBe(true);
    expect([
      "hero-edge-left",
      "hero-edge-right",
      "chapter-1-left",
      "chapter-2-right",
      "chapter-4-left",
      "chapter-5-right",
    ]).toContain(layout.listeningSlot);
  }
});

test("site and hero actions are labelled, touch-sized, focus-visible, and follow semantic keyboard order", async ({ page }) => {
  await gotoHero(page, { width: 1440, height: 900 });

  const story = page.getByRole("link", { name: "Read Noah's story" });
  const blog = page.getByRole("link", { name: "Read Noah's blog" });
  const email = page.getByRole("link", { name: "Email Noah" });
  const github = page.getByRole("link", { name: "Visit Noah on GitHub" });
  const linkedin = page.getByRole("link", { name: "Visit Noah on LinkedIn" });
  const actions = [
    story,
    blog,
    page.getByRole("button", { name: "Toggle color theme" }),
    email,
    github,
    linkedin,
    page.getByRole("button", { name: "Open Ask-Me composer" }),
    page.getByRole("button", { name: "Show Noah's listening context" }),
  ];

  for (const action of actions) {
    await expect(action).toHaveCount(1);
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await action.focus();
    await expect(action).toBeFocused();
    const outline = await action.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outline).not.toBe("none");
  }

  await expect(story).toHaveAttribute("href", "#story");
  await expect(blog).toHaveAttribute("href", "https://blog.noahrijkaard.com");
  await expect(email).toHaveAttribute("href", "mailto:noahrijkaard@gmail.com");
  await expect(github).toHaveAttribute("href", "https://github.com/OriginalByteMe");
  await expect(linkedin).toHaveAttribute("href", "https://www.linkedin.com/in/noah-rijkaard/");

  for (const [destination, tooltipId, callout] of [
    [email, "contact-tooltip-email", "Email me"],
    [github, "contact-tooltip-github", "See my GitHub"],
    [linkedin, "contact-tooltip-linkedin", "Connect on LinkedIn"],
  ] as const) {
    await expect(destination).toHaveAttribute("aria-describedby", tooltipId);
    await destination.focus();
    await expect(page.locator(`#${tooltipId}`)).toHaveText(callout);
    await expect(page.locator(`#${tooltipId}`)).toBeVisible();
  }

  const semanticOrder = await page.locator("button, a[href]").evaluateAll((elements) =>
    elements
      .map((element) => element.getAttribute("aria-label"))
      .filter((label): label is string => Boolean(label)),
  );
  expect(semanticOrder.slice(0, actions.length - 1)).toEqual([
    "Read Noah's story",
    "Read Noah's blog",
    "Toggle color theme",
    "Email Noah",
    "Visit Noah on GitHub",
    "Visit Noah on LinkedIn",
    "Open Ask-Me composer",
  ]);
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
