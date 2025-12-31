import { test, expect } from '@playwright/test';

test.describe('Canvas Physics App', () => {
  test('should load the main page without errors', async ({ page }) => {
    const errors = [];
    const warnings = [];

    // Capture console errors and warnings
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      } else if (msg.type() === 'warning') {
        warnings.push(msg.text());
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      errors.push(error.message);
    });

    // Navigate to the page
    await page.goto('/');

    // Wait for the canvas to be present
    await expect(page.locator('#pizza')).toBeVisible();

    // Verify controls are present
    await expect(page.locator('#reset_button')).toBeVisible();
    await expect(page.locator('#slider')).toBeVisible();

    // Wait a bit for initialization
    await page.waitForTimeout(1000);

    // Report errors if any
    if (errors.length > 0) {
      console.error('Console errors found:');
      errors.forEach(err => console.error('  -', err));
      expect(errors, `Found ${errors.length} console errors`).toHaveLength(0);
    }

    if (warnings.length > 0) {
      console.warn('Console warnings found:');
      warnings.forEach(warn => console.warn('  -', warn));
    }
  });

  test('should have working sliders', async ({ page }) => {
    await page.goto('/');

    // Test that sliders update their value displays
    const slider = page.locator('#slider');
    const sliderValue = page.locator('#slider_value');

    await expect(slider).toBeVisible();
    await expect(sliderValue).toHaveText('2');

    // Change slider value
    await slider.fill('5');
    await expect(sliderValue).toHaveText('5');
  });

  test('should have working buttons', async ({ page }) => {
    await page.goto('/');

    // Verify all control buttons are present and clickable
    const buttons = [
      '#reset_button',
      '#planet_button',
      '#ball_button',
      '#pizza_button',
      '#background_button',
      '#pause_button',
      '#quadtree_button',
      '#purple_button',
      '#debug_button'
    ];

    for (const buttonId of buttons) {
      await expect(page.locator(buttonId)).toBeVisible();
      await expect(page.locator(buttonId)).toBeEnabled();
    }
  });
});
