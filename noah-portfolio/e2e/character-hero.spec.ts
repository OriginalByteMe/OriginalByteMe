import { expect, test } from '@playwright/test';

test('character loads, chases, pauses, resets and yields to the original portrait', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const hero = page.getByTestId('character-hero');
  await expect(hero).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  const playground = page.getByTestId('character-playground');
  const initial = await playground.getAttribute('data-position');
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
  await expect(playground).toHaveCSS('touch-action', 'pan-y');
  const box = (await playground.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width * .75, box.y + box.height * .6);
  await expect.poll(() => playground.getAttribute('data-motion')).toMatch(/walk|run|bump/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});
