import { test, expect } from '@playwright/test';

async function renderAndReadPixel( page, position = {} ) {
  return page.evaluate(({ x, y }) => {
    const { canvas, renderer, world } = globalThis.__pizzaRuntime;
    renderer.render(world);
    renderer.synchronize();
    const sampleX = Math.floor(x ?? canvas.width / 2);
    const sampleY = Math.floor(y ?? canvas.height / 2);
    const pixel = new Uint8Array(4);
    if (renderer.backend === 'webgl2') {
      renderer.context.readPixels(
        sampleX,
        canvas.height - sampleY - 1,
        1,
        1,
        renderer.context.RGBA,
        renderer.context.UNSIGNED_BYTE,
        pixel,
      );
    } else {
      pixel.set(renderer.context.getImageData(
        sampleX,
        sampleY,
        1,
        1,
      ).data);
    }
    return Array.from(pixel);
  }, position);
}

test.describe('Physics App', () => {
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

    const numBalls = page.locator('#num_balls_slider');
    const spawnRate = page.locator('#ball_spawn_rate_slider');
    await expect(page.locator('#exploder_size_slider')).toHaveValue('1.4');
    await expect(page.locator('#exploder_size_slider_value')).toHaveText('1.4');
    await expect(numBalls).toHaveAttribute('min', '0');
    await expect(numBalls).toHaveAttribute('max', '500');
    await expect(spawnRate).toHaveAttribute('min', '0.01');
    await expect(spawnRate).toHaveAttribute('max', '0.99');
  });

  test('should spawn toward the requested ball count', async ({ page }) => {
    await page.goto('/');
    await page.locator('#pause_button').click();
    await page.evaluate(() => {
      globalThis.__pizzaRuntime.world.g = 0;
    });

    const numBalls = page.locator('#num_balls_slider');
    const numBallsValue = page.locator('#num_balls_slider_value');
    const spawnRate = page.locator('#ball_spawn_rate_slider');
    const spawnRateValue = page.locator('#ball_spawn_rate_slider_value');

    await spawnRate.fill('0.99');
    await expect(spawnRateValue).toHaveText('0.99');
    await numBalls.fill('8');
    await expect(numBallsValue).toHaveText('8');
    await expect.poll(async () => page.evaluate(() => (
      globalThis.__pizzaRuntime.world.balls.length
    ))).toBe(8);

    await numBalls.fill('3');
    await expect.poll(async () => page.evaluate(() => (
      globalThis.__pizzaRuntime.world.balls.length
    ))).toBe(3);
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
      '#renderer_button',
      '#quadtree_overlay_button',
      '#purple_button',
      '#debug_button'
    ];

    for (const buttonId of buttons) {
      await expect(page.locator(buttonId)).toBeVisible();
      await expect(page.locator(buttonId)).toBeEnabled();
    }
  });

  test('should default to WebGL2 and retain an explicit Canvas2D fallback', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#renderer_button')).toHaveText(
      'Renderer: WebGL2',
    );
    await expect(page.locator('#renderer_button')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.locator('#renderer_button').click();
    await page.waitForURL(url => (
      new URL(url).searchParams.get('renderer') === 'canvas2d'
    ));
    await expect(page.locator('#renderer_button')).toHaveText(
      'Renderer: Canvas2D',
    );
    await expect(page.locator('#renderer_button')).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await page.locator('#renderer_button').click();
    await page.waitForURL(url => (
      new URL(url).searchParams.get('renderer') === 'webgl2'
    ));
    await expect(page.locator('#renderer_button')).toHaveText(
      'Renderer: WebGL2',
    );
  });

  test('should automatically fall back when WebGL2 is unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...options) {
        if (type === 'webgl2') {
          return null;
        }
        return getContext.call(this, type, ...options);
      };
    });
    await page.goto('/');
    await expect(page.locator('#renderer_button')).toHaveText(
      'Renderer: Canvas2D (fallback)',
    );
    await expect(page.locator('#renderer_button')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await page.locator('#renderer_button').click();
    await page.waitForURL(url => (
      new URL(url).searchParams.get('renderer') === 'canvas2d'
    ));
    await expect(page.locator('#renderer_button')).toHaveText(
      'Renderer: Canvas2D',
    );
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

  test('should render ordered circles with the WebGL2 backend', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    await page.goto('/?renderer=webgl2');
    await expect(page.locator('#renderer_button')).toHaveText(
      'Renderer: WebGL2',
    );
    await expect(page.locator('#renderer_button')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('#background_button')).toBeEnabled();
    await expect(page.locator('#pizza_button')).toBeEnabled();
    await expect(page.locator('#quadtree_overlay_button')).toBeEnabled();

    const result = await page.evaluate(async () => {
      const { Ball } = await import('/src/scripts/ball.js');
      const { vec3 } = await import('/src/scripts/vec3.js');
      const { renderer, rendererFallbackReason, world } = (
        globalThis.__pizzaRuntime
      );

      world.init();
      world.advance = () => {};
      const scale = world.getDrawScale(renderer.canvas);
      const centerX = renderer.canvas.width / scale / 2;
      const centerY = renderer.canvas.height / scale / 2;
      world.particles = [
        new Ball(centerX, centerY, 0.1, new vec3(0, 0, 255)),
      ];
      world.balls = [
        new Ball(centerX, centerY, 0.05, new vec3(255, 0, 0)),
      ];
      const stats = renderer.render(world);
      renderer.synchronize();

      const pixel = new Uint8Array(4);
      renderer.context.readPixels(
        Math.floor(renderer.canvas.width / 2),
        Math.floor(renderer.canvas.height / 2),
        1,
        1,
        renderer.context.RGBA,
        renderer.context.UNSIGNED_BYTE,
        pixel,
      );
      return {
        backend: renderer.backend,
        drawnBodies: stats.drawnBodies,
        fallbackReason: rendererFallbackReason,
        pixel: Array.from(pixel),
      };
    });

    expect(result.backend).toBe('webgl2');
    expect(result.fallbackReason).toBeNull();
    expect(result.drawnBodies).toBe(2);
    expect(result.pixel[0]).toBeGreaterThan(240);
    expect(result.pixel[1]).toBeLessThan(15);
    expect(result.pixel[2]).toBeLessThan(15);
    expect(errors, `Found browser errors: ${errors.join('; ')}`).toEqual([]);
  });

  for (const backend of ['canvas2d', 'webgl2']) {
    test(`should support rendering features with ${backend}`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error') {
          errors.push(message.text());
        }
      });

      await page.goto(`/?renderer=${backend}`);
      await page.waitForFunction(() => (
        globalThis.__pizzaRuntime?.canvas.width > 100 &&
        globalThis.__pizzaRuntime?.canvas.height > 100
      ));
      for (const buttonId of [
        '#background_button',
        '#pizza_button',
        '#quadtree_overlay_button',
        '#purple_button',
        '#debug_button',
      ]) {
        await expect(page.locator(buttonId)).toBeEnabled();
      }

      await page.evaluate(async () => {
        const { Ball } = await import('/src/scripts/ball.js');
        const { vec3 } = await import('/src/scripts/vec3.js');
        const { canvas, world } = globalThis.__pizzaRuntime;
        world.init();
        world.advance = () => {};
        world.shouldDrawBackground = false;
        world.renderOutlines = false;
        const scale = world.getDrawScale(canvas);
        const centerX = canvas.width / scale / 2;
        const centerY = canvas.height / scale / 2;
        world.balls = [
          new Ball(centerX, centerY, 0.12, new vec3(255, 0, 0)),
        ];
      });
      const basePixel = await renderAndReadPixel(page);
      expect(basePixel[0]).toBeGreaterThan(240);
      expect(basePixel[1]).toBeLessThan(15);
      expect(basePixel[2]).toBeLessThan(15);

      await page.locator('#pizza_button').click();
      await expect.poll(async () => {
        const pixel = await renderAndReadPixel(page);
        return (
          Math.abs(pixel[0] - 255) +
          pixel[1] +
          pixel[2]
        ) > 40;
      }, {
        timeout: 10000,
      }).toBe(true);

      const backgroundRgb = await page.evaluate(() => {
        const { world } = globalThis.__pizzaRuntime;
        world.balls = [];
        world.pizza_time = false;
        world.shouldDrawBackground = true;
        world.background.counter = 0;
        world.background.updateRgb();
        return [
          world.background.rgb.x,
          world.background.rgb.y,
          world.background.rgb.z,
        ];
      });
      const backgroundPixel = await renderAndReadPixel(
        page,
        { x: 5, y: 5 },
      );
      expect(backgroundPixel[1]).toBeGreaterThan(0);
      expect(backgroundRgb).toEqual([0, 0, 128]);

      await page.locator('#background_button').click();
      const blackPixel = await renderAndReadPixel(
        page,
        { x: 5, y: 5 },
      );
      expect(blackPixel.slice(0, 3)).toEqual([0, 0, 0]);

      const purpleResult = await page.evaluate(async () => {
        const { Ball } = await import('/src/scripts/ball.js');
        const { vec3 } = await import('/src/scripts/vec3.js');
        const { canvas, world } = globalThis.__pizzaRuntime;
        const scale = world.getDrawScale(canvas);
        world.background.counter = 40;
        world.background.updateRgb();
        world.balls = [
          new Ball(
            canvas.width / scale / 2,
            canvas.height / scale / 2,
            0.05,
            new vec3(255, 0, 0),
          ),
        ];
        return true;
      });
      expect(purpleResult).toBe(true);
      await page.locator('#purple_button').click();
      expect(await page.evaluate(() => {
        const { world } = globalThis.__pizzaRuntime;
        const color = world.balls[0].color;
        return {
          color: [color.x, color.y, color.z],
          purple: world.purple,
        };
      })).toEqual({
        color: [0, 40, 128],
        purple: true,
      });

      const overlayState = await page.evaluate(async () => {
        const { Ball } = await import('/src/scripts/ball.js');
        const { vec3 } = await import('/src/scripts/vec3.js');
        const { canvas, world } = globalThis.__pizzaRuntime;
        const scale = world.getDrawScale(canvas);
        const maxX = canvas.width / scale;
        const maxY = canvas.height / scale;
        world.balls = [];
        for (let index = 0; index < 400; index++) {
          world.balls.push(new Ball(
            maxX * ((index % 20) + 0.5) / 20,
            maxY * (Math.floor(index / 20) + 0.5) / 20,
            0.0001,
            new vec3(128, 128, 128),
          ));
        }
        world.lastQuadtree = world.buildQuadtree(canvas);
        return Boolean(world.lastQuadtree);
      });
      expect(overlayState).toBe(true);
      await page.locator('#quadtree_overlay_button').click();
      const overlayStats = await page.evaluate(() => {
        const { renderer, world } = globalThis.__pizzaRuntime;
        const stats = renderer.render(world);
        if (renderer.backend !== 'webgl2') {
          return stats;
        }
        const root = world.lastQuadtree;
        return {
          ...stats,
          expectedRootVertices: [
            root.min_x, root.min_y, root.max_x, root.min_y,
            root.max_x, root.min_y, root.max_x, root.max_y,
            root.max_x, root.max_y, root.min_x, root.max_y,
            root.min_x, root.max_y, root.min_x, root.min_y,
          ].map(Math.fround),
          rootVertices: Array.from(
            renderer.overlayPositions.subarray(0, 16),
          ),
        };
      });
      if (backend === 'webgl2') {
        expect(overlayStats.overlayNodeCount).toBeGreaterThan(0);
        expect(overlayStats.overlayVertexCount).toBeGreaterThan(1024);
        expect(overlayStats.overlayVertexCount).toBe(
          overlayStats.overlayNodeCount * 8,
        );
        expect(overlayStats.rootVertices).toEqual(
          overlayStats.expectedRootVertices,
        );
      }

      await page.locator('#debug_button').click();
      expect(await page.evaluate(async () => {
        const { debug_on } = await import('/src/scripts/quadtree.js');
        return debug_on;
      })).toBe(false);
      expect(errors, `Found browser errors: ${errors.join('; ')}`).toEqual([]);
    });
  }

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
