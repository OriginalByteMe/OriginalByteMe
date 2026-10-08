import { expect, test } from '@playwright/test';

test('character loads, responds to keys, pauses, resets and yields to the original portrait', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const hero = page.getByTestId('character-hero');
  await expect(hero).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Click to enter' }).click();
  const playground = page.getByTestId('character-playground');
  await expect(playground).toHaveAttribute('data-area', 'bedroom');
  const initial = await playground.getAttribute('data-position');
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await playground.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => playground.getAttribute('data-position')).not.toBe(initial);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(playground).toHaveAttribute('data-paused', 'true');
  const paused = await playground.getAttribute('data-position');
  await page.waitForTimeout(350);
  await expect(playground).toHaveAttribute('data-position', paused!);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Say hi' }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Portrait', exact: true }).click();
  await expect(hero).toHaveAttribute('data-status', 'fallback');
  await expect(page.getByRole('img', { name: 'Portrait of Noah Rijkaard' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to playground' }).click();
  await expect(hero).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Click to enter' }).click();
  await expect(page.getByRole('link', { name: 'Email Noah' })).toBeVisible();
});

test('reduced-motion visitors keep the portrait, never request the model, and can still read the lab and about rooms', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let requested = false;
  page.on('request', (request) => { if (request.url().includes('good-vibes-hero.glb')) requested = true; });
  await page.goto('/');
  await expect(page.getByTestId('character-hero')).toHaveAttribute('data-status', 'fallback');
  await expect(page.getByRole('img', { name: 'Portrait of Noah Rijkaard' })).toBeVisible();
  await expect(page.getByTestId('character-playground').locator('canvas')).toHaveCount(0);
  const lab = page.getByRole('region', { name: 'Things I’ve built' });
  await lab.scrollIntoViewIfNeeded();
  await expect(lab.getByRole('heading', { level: 3, name: 'Moodify' })).toBeVisible();
  await expect(lab.getByRole('link', { name: 'Visit Moodify' })).toHaveAttribute('href', 'https://github.com/OriginalByteMe/Moodify');
  await expect(lab.getByRole('button', { name: /Show me/ })).toHaveCount(0);
  const about = page.getByRole('region', { name: 'About me' });
  await about.scrollIntoViewIfNeeded();
  await expect(about.getByText('Senior AI Engineer')).toBeVisible();
  await expect(about.getByRole('img', { name: 'Framed hero portrait of Noah Rijkaard' })).toBeVisible();
  expect(requested).toBe(false);
});

test('touch stage preserves page scrolling and fits a narrow viewport', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('/');
  const playground = page.getByTestId('character-playground');
  await playground.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('character-hero')).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Click to enter' }).click();
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await expect(playground).toHaveCSS('touch-action', 'pan-y');
  await expect(page.getByTestId('character-world')).toHaveCSS('touch-action', 'pan-y');
  const box = (await playground.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width * .75, box.y + box.height * .6);
  await expect.poll(() => playground.getAttribute('data-motion')).toMatch(/walk|run|bump/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});

test('voice, effects and music are on by default and start with the enter click, then mute from their toggles', async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) { super(options); Object.assign(window, { characterAudio: this }); }
    };
  });
  await page.goto('/');
  await expect(page.getByTestId('character-hero')).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  await expect(page.getByTestId('character-hero')).toHaveAttribute('data-phase', 'opening');
  await page.getByRole('button', { name: 'Click to enter' }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { characterAudio?: AudioContext }).characterAudio?.state)).toBe('running');
  const sound = page.getByRole('button', { name: 'Mute character sound' });
  const music = page.getByRole('button', { name: 'Stop music' });
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await expect(music).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await expect(page.getByRole('status')).toContainText('Hey, my name is Noah. Ask me a question down here.', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Say hi' }).click();
  await expect(page.getByRole('status')).toContainText('Hi, you see me? Do you see me? Oh, hello.');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.locator('.character-stage__speech')).toHaveCount(0);
  await sound.click();
  await music.click();
  await expect(page.getByRole('button', { name: 'Enable character sound' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Play music' })).toHaveAttribute('aria-pressed', 'false');
});

test('timed startup runs without scrolling and hover never issues movement commands', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('character-hero')).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Click to enter' }).click();
  const world = page.getByTestId('character-playground');
  await expect(world).toHaveAttribute('data-phase', 'approach', { timeout: 8_000 });
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const time = await world.getAttribute('data-intro-time');
  await page.waitForTimeout(400);
  await expect(world).toHaveAttribute('data-intro-time', time!);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(world).toHaveAttribute('data-phase', 'recoil', { timeout: 6_000 });
  await expect(world).toHaveAttribute('data-phase', 'roam', { timeout: 8_000 });
  const position = await world.getAttribute('data-position');
  await page.mouse.move(1100, 600);
  await page.waitForTimeout(450);
  await expect(world).toHaveAttribute('data-position', position!);
  // The bedroom floor fills the right of a wide viewport; the front edge is open.
  await page.mouse.click(1180, 600);
  await expect.poll(() => world.getAttribute('data-position')).not.toBe(position);
  await page.mouse.click(900, 620);
  await expect(world).toHaveAttribute('data-activity', 'idle');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.setViewportSize({ width: 809, height: 1024 });
  await expect(world).toHaveAttribute('data-paused', 'true');
  await expect(page.getByRole('textbox', { name: 'Ask a question about Noah' })).toBeVisible();
});

test('uncommanded character visits his bedroom stations, then a key interrupts', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await expect(page.getByTestId('character-hero')).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Click to enter' }).click();
  await page.getByRole('button', { name: 'Skip intro' }).click();
  const world = page.getByTestId('character-playground');
  await expect.poll(() => world.getAttribute('data-station'), { timeout: 30_000 }).toMatch(/desk|printer|rack|ball|bed/);
  await expect.poll(() => world.getAttribute('data-activity'), { timeout: 30_000 }).toMatch(/perform|sit|pickup|toss|read/);
  await world.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(world).toHaveAttribute('data-activity', 'idle');
});

test('scrolling down makes him follow into the lab and about rooms, Show me sends him to an exhibit, and scrolling up brings him back', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('character-hero')).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Click to enter' }).click();
  await page.getByRole('button', { name: 'Skip intro' }).click();
  const world = page.getByTestId('character-playground');
  const lab = page.getByRole('region', { name: 'Things I’ve built' });
  await lab.evaluate((section) => section.scrollIntoView());
  await expect.poll(() => world.getAttribute('data-tour'), { timeout: 5_000 }).toMatch(/chase|trip|fall/);
  await expect(world).toHaveAttribute('data-area', 'lab', { timeout: 10_000 });
  await expect(world).toHaveAttribute('data-tour', 'settled', { timeout: 10_000 });
  await lab.getByRole('button', { name: 'Show me Moodify' }).click();
  await expect(world).toHaveAttribute('data-station', 'project:moodify');
  await expect(world).toHaveAttribute('data-activity', 'perform', { timeout: 20_000 });
  await page.getByRole('region', { name: 'About me' }).evaluate((section) => section.scrollIntoView());
  await expect(world).toHaveAttribute('data-area', 'about', { timeout: 15_000 });
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(() => world.getAttribute('data-tour'), { timeout: 5_000 }).toBe('jump');
  await expect(world).toHaveAttribute('data-area', 'bedroom', { timeout: 20_000 });
});

test('loading mid-page skips the intro and starts in the viewed room', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#about');
  const world = page.getByTestId('character-playground');
  await expect(page.getByTestId('character-hero')).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  await expect(world).toHaveAttribute('data-phase', 'roam');
  await expect(world).toHaveAttribute('data-area', 'about');
  await expect(page.getByRole('button', { name: 'Skip intro' })).toHaveCount(0);
});
