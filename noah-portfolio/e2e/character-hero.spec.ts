import { expect, test } from '@playwright/test';

test('character loads, responds to clicks, pauses, resets and yields to the original portrait', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const hero = page.getByTestId('character-hero');
  await expect(hero).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  const playground = page.getByTestId('character-playground');
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
  await expect(page.getByRole('link', { name: 'Email Noah' })).toBeVisible();
});

test('reduced-motion visitors keep the portrait and never request the model', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let requested = false;
  page.on('request', (request) => { if (request.url().includes('good-vibes-hero.glb')) requested = true; });
  await page.goto('/');
  await expect(page.getByTestId('character-hero')).toHaveAttribute('data-status', 'fallback');
  await expect(page.getByRole('img', { name: 'Portrait of Noah Rijkaard' })).toBeVisible();
  await expect(page.getByTestId('character-playground').locator('canvas')).toHaveCount(0);
  expect(requested).toBe(false);
});

test('touch stage preserves page scrolling and fits a narrow viewport', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('/');
  const playground = page.getByTestId('character-playground');
  await playground.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('character-hero')).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await expect(playground).toHaveCSS('touch-action', 'pan-y');
  const box = (await playground.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width * .75, box.y + box.height * .6);
  await expect.poll(() => playground.getAttribute('data-motion')).toMatch(/walk|run|bump/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});

test('idle greetings stay quiet until sound is explicitly enabled', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('character-hero')).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  const sound = page.getByRole('button', { name: 'Enable character sound' });
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await expect(page.getByRole('status')).toContainText('Hey, my name is Noah. Ask me a question down here.', { timeout: 15_000 });
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await sound.click();
  await expect(page.getByRole('button', { name: 'Mute character sound' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Say hi' }).click();
  await expect(page.getByRole('status')).toContainText('Hi, you see me? Do you see me? Oh, hello.');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.locator('.character-stage__speech')).toHaveCount(0);
  await page.getByRole('button', { name: 'Mute character sound' }).click();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
});

test('timed startup runs without scrolling and hover never issues movement commands', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('character-hero')).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
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
  await page.mouse.click(1180, 530);
  await expect.poll(() => world.getAttribute('data-position')).not.toBe(position);
  await page.mouse.click(720, 530);
  await expect(world).toHaveAttribute('data-activity', 'idle');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.setViewportSize({ width: 809, height: 1024 });
  await expect(world).toHaveAttribute('data-paused', 'true');
  await expect(page.getByRole('button', { name: 'Open Ask-Me composer' })).toBeVisible();
});

test('uncommanded character plays with the ball and reads, then a click interrupts', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await expect(page.getByTestId('character-hero')).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Skip intro' }).click();
  const world = page.getByTestId('character-playground');
  await expect.poll(() => world.getAttribute('data-activity'), { timeout: 30_000 }).toMatch(/toss/);
  await expect.poll(() => world.getAttribute('data-activity'), { timeout: 30_000 }).toMatch(/read/);
  await world.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(world).toHaveAttribute('data-activity', 'idle');
});
