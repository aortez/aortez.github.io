import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const { tag } = JSON.parse( readFileSync( 'frame-app.json', 'utf8' ) );

test('the built site serves the pinned Frame app release', async ({ page }) => {
  await page.goto('/frame/');
  await expect(page).toHaveTitle('Sparkle Duck · Your frame');
  await page.locator('#settings-tab').click();
  await expect(page.locator('#app-version')).toHaveText(`Sparkle Duck ${tag.replace( /^app-v/, '' )} (web)`);
  expect(( await page.request.get('/frame/sw.js') ).ok()).toBe(true);
});

test('setup and the old /wifi/ QR link come from the same release', async ({ page }) => {
  await page.goto('/wifi/');
  await expect(page).toHaveURL(/\/setup\/$/);
  await expect(page).toHaveTitle('Connect your frame · Sparkle Duck');
});
