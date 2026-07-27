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
      '#gravity_mode_button',
      '#quadtree_overlay_button',
      '#purple_button',
      '#debug_button'
    ];

    for (const buttonId of buttons) {
      await expect(page.locator(buttonId)).toBeVisible();
      await expect(page.locator(buttonId)).toBeEnabled();
    }
  });

  test('should switch between fast and full gravity modes', async ({ page }) => {
    await page.goto('/');

    const gravityMode = page.locator('#gravity_mode_button');
    await expect(gravityMode).toHaveText('Gravity: Fast');
    await expect(gravityMode).toHaveAttribute('aria-pressed', 'false');
    await page.waitForFunction(async () => {
      const { getRuntime } = await import('/src/scripts/main.js');
      return Boolean(getRuntime().world);
    });

    const initialState = await page.evaluate(async () => {
      const { getRuntime } = await import('/src/scripts/main.js');
      const { world } = getRuntime();
      return {
        mode: world.gravityMode,
        particleGravity: world.useBallParticleGravity,
        theta: world.barnesHutTheta,
      };
    });
    expect(initialState).toEqual({
      mode: 'fast',
      particleGravity: false,
      theta: 0.7,
    });

    await gravityMode.click();
    await expect(gravityMode).toHaveText('Gravity: Full');
    await expect(gravityMode).toHaveAttribute('aria-pressed', 'true');

    const fullState = await page.evaluate(async () => {
      const { getRuntime } = await import('/src/scripts/main.js');
      const { world } = getRuntime();
      return {
        mode: world.gravityMode,
        particleGravity: world.useBallParticleGravity,
        theta: world.barnesHutTheta,
      };
    });
    expect(fullState).toEqual({
      mode: 'full',
      particleGravity: true,
      theta: 0.5,
    });

    await gravityMode.click();
    await expect(gravityMode).toHaveText('Gravity: Fast');
  });

  test('should create balls and run the quadtree overlay across viewport shapes', async ({ page }) => {
    const errors = [];
    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await page.setViewportSize({ width: 1200, height: 700 });
    await page.goto('/');

    const canvas = page.locator('#pizza');
    await expect(canvas).toBeVisible();
    await page.locator('#pause_button').click();
    await canvas.click({ position: { x: 240, y: 120 } });
    await expect(page.locator('#num_balls_label')).toContainText('num balls: 1 /');

    const spatialPhysics = page.locator('#quadtree_button');
    await expect(spatialPhysics).toHaveAttribute('aria-pressed', 'true');
    await spatialPhysics.click();
    await expect(spatialPhysics).toHaveAttribute('aria-pressed', 'false');
    await spatialPhysics.click();
    await expect(spatialPhysics).toHaveAttribute('aria-pressed', 'true');

    await page.locator('#quadtree_overlay_button').click();
    await expect(page.locator('#quadtree_overlay_button')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.waitForTimeout(100);
    await expect(page.locator('#num_balls_label')).toContainText('num balls: 1 /');

    await page.setViewportSize({ width: 800, height: 1100 });
    await expect(canvas).toBeVisible();
    await canvas.click({ position: { x: 400, y: 180 } });
    await expect(page.locator('#num_balls_label')).toContainText('num balls: 2 /');
    await page.waitForTimeout(100);

    expect(errors, `Found browser errors: ${errors.join('; ')}`).toEqual([]);
  });
});
