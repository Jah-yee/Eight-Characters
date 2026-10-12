// Natural flow is exercised through real controls, not a second copy of its solver.
import {
  assert, describe, it, engineName, profiles, openChart, settled, showDisplay, withPage,
} from './chart-helpers.mjs';
import { stubTurnstile } from './account-helpers.mjs';

for (const profile of profiles) {
  describe(`${engineName} / ${profile.name} / natural flow`, { concurrency: false }, () => {
    const check = (name, run, options) => it(name, { timeout: 90000 }, () => withPage(profile, run, options));

    check('a reversed card keeps its current angle and height', async (page) => {
      await openChart(page);
      await page.locator('[data-display="ten-gods"]').click();
      await page.waitForTimeout(120);
      const motion = await page.evaluate(() => {
        const inner = document.querySelector('.card.stem .card-inner');
        const before = { transform: inner.style.transform, height: Number.parseFloat(inner.style.height) };
        document.querySelector('[data-display="characters"]').click();
        return { before, after: { transform: inner.style.transform, height: Number.parseFloat(inner.style.height) } };
      });
      assert.equal(motion.after.transform, motion.before.transform);
      assert.ok(Math.abs(motion.after.height - motion.before.height) < .1);
      await settled(page);
      assert.equal(await page.locator('.card.is-flipped').count(), 0);
      assert.equal(await page.locator('[data-motion-running]').count(), 0);
    });

    check('a disclosure starts a resize from its current responsive height', async (page) => {
      await openChart(page);
      await showDisplay(page, 'hidden-stems');
      await page.setViewportSize({ width: profile.name === 'desktop' ? 800 : 320, height: 900 });
      const height = await page.locator('#hidden-stems-hour').evaluate((panel) => {
        const before = panel.getBoundingClientRect().height;
        document.querySelector('[data-display="characters"]').click();
        return { before, after: panel.getBoundingClientRect().height };
      });
      assert.ok(Math.abs(height.before - height.after) < .1);
      await settled(page);
      assert.equal(await page.locator('#hidden-stems-hour').evaluate((panel) => panel.getBoundingClientRect().height), 0);
    });

    check('a panel makes room without jumping the chart and can reverse immediately', async (page) => {
      await openChart(page);
      const shift = await page.evaluate(async () => {
        const column = document.querySelector('#chart-view > .chart-column');
        const before = column.getBoundingClientRect();
        document.querySelector('[data-context="season"]').click();
        await new Promise(queueMicrotask);
        const after = column.getBoundingClientRect();
        return { before: { x: before.x, width: before.width }, after: { x: after.x, width: after.width } };
      });
      assert.ok(Math.abs(shift.before.x - shift.after.x) < .5);
      assert.ok(Math.abs(shift.before.width - shift.after.width) < .5);
      await page.locator('[data-close-panel]').click();
      assert.deepEqual(await page.locator('#chart-panel').evaluate((panel) => ({
        closed: panel.classList.contains('hidden'), inert: panel.inert,
      })), { closed: true, inert: true });
      await settled(page);
      assert.equal(await page.locator('#chart-panel').isVisible(), false);
      assert.equal(await page.locator('#context-detail').innerText(), '');
    });

    check('reduced motion finishes every spatial channel immediately', async (page) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openChart(page);
      await showDisplay(page, 'hidden-stems');
      await page.locator('[data-context="season"]').click();
      const state = await page.evaluate(() => ({
        active: window.EC_MOTION.active(),
        transitions: [...document.querySelectorAll('.card, .hidden-stems-panel, .branch-expand-hint, .pillar, .relationship-arcs')]
          .map((node) => ({ transition: getComputedStyle(node).transitionDuration, animation: getComputedStyle(node).animationName })),
      }));
      assert.equal(state.active, false);
      assert.ok(state.transitions.every((entry) => entry.transition === '0s' && entry.animation === 'none'));
    });

    check('closing a settled drawer preserves its displayed position', async (page) => {
      await openChart(page);
      await page.locator('[data-context="season"]').click();
      await settled(page);
      const position = await page.locator('#chart-panel').evaluate(async (panel) => {
        const before = panel.getBoundingClientRect();
        panel.querySelector('[data-close-panel]').click();
        await new Promise(queueMicrotask);
        const after = panel.getBoundingClientRect();
        return { before: { x: before.x, y: before.y }, after: { x: after.x, y: after.y } };
      });
      assert.ok(Math.abs(position.before.x - position.after.x) < .5);
      assert.ok(Math.abs(position.before.y - position.after.y) < .5);
      await settled(page);
    });

    check('wheel input takes control of a reading scroll immediately', async (page) => {
      await openChart(page);
      await page.locator('[data-context="season"]').click();
      await settled(page);
      const state = await page.locator('#chart-panel').evaluate((panel) => {
        window.EC_MOTION.scroll(panel, 0, 250);
        const moving = window.EC_MOTION.value(panel, 'scroll') !== null;
        panel.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 40 }));
        return { moving, stopped: window.EC_MOTION.value(panel, 'scroll') === null };
      });
      assert.equal(state.moving, true);
      assert.equal(state.stopped, true);
    });

    check('reopening a resizing drawer preserves its displayed height', async (page) => {
      await openChart(page);
      await page.locator('[data-context="season"]').click();
      await settled(page);
      // A taller viewport leaves both actual reading lengths uncapped.
      await page.setViewportSize({ width: profile.viewport.width, height: 2000 });
      await page.locator('[data-context="roots"]').click();
      await page.waitForFunction(() => window.EC_MOTION.value(document.querySelector('#chart-panel'), 'panel-size') !== null);
      const size = await page.locator('#chart-panel').evaluate(async (panel) => {
        const before = panel.getBoundingClientRect().height;
        panel.querySelector('[data-close-panel]').click();
        await new Promise(queueMicrotask);
        const closed = panel.getBoundingClientRect().height;
        document.querySelector('[data-context="season"]').click();
        await new Promise(queueMicrotask);
        return { before, closed, reopened: panel.getBoundingClientRect().height };
      });
      assert.ok(Math.abs(size.before - size.closed) < .5);
      assert.ok(Math.abs(size.closed - size.reopened) < .5);
      await settled(page);
      assert.equal(await page.locator('#chart-panel').evaluate((panel) => panel.style.height), '');
    });

    check('changing language updates the same birth without replaying pillar entrances', async (page) => {
      await openChart(page);
      await page.locator('#chart-language [data-chart-lang="fi"]').click();
      await page.waitForFunction(() => document.querySelector('#chart-language [data-chart-lang="fi"]').getAttribute('aria-pressed') === 'true');
      await settled(page);
      assert.equal(await page.locator('.pillar[data-flow-enter]').count(), 0);
      assert.equal(await page.locator('.pillar').evaluateAll((nodes) => nodes.every((node) => getComputedStyle(node).animationName === 'none')), true);
    });

    check('scroll targets stay within native bounds and reverse from the viewport', async (page) => {
      await openChart(page);
      await page.locator('[data-context="season"]').click();
      await settled(page);
      await page.locator('#chart-panel').evaluate((panel) => window.EC_MOTION.scroll(panel, 0, panel.scrollHeight + 300));
      await page.waitForTimeout(170);
      const position = await page.locator('#chart-panel').evaluate((panel) => {
        const maximum = panel.scrollHeight - panel.clientHeight;
        const held = window.EC_MOTION.value(panel, 'scroll')?.top ?? panel.scrollTop;
        const before = panel.scrollTop;
        window.EC_MOTION.scroll(panel, 0, 0);
        return { maximum, held, before, after: panel.scrollTop };
      });
      assert.ok(position.held <= position.maximum);
      assert.ok(position.held >= 0);
      assert.equal(position.before, position.after);
      await settled(page);
      assert.equal(await page.locator('#chart-panel').evaluate((panel) => panel.scrollTop), 0);
    });

    check('horizontal arrow input takes control of ribbon centering', async (page) => {
      await openChart(page, { gender: 'female' });
      await page.locator('[data-luck-show="on"]').click();
      await settled(page);
      for (const key of ['ArrowLeft', 'ArrowRight']) {
        const stopped = await page.locator('.luck-track').evaluate((track, key) => {
          window.EC_MOTION.scroll(track, 50, 0);
          track.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
          return window.EC_MOTION.value(track, 'scroll') === null;
        }, key);
        assert.equal(stopped, true);
      }
    });

    check('viewport resizing settles old coordinates before responsive layout takes over', async (page) => {
      await openChart(page);
      await page.locator('[data-context="season"]').click();
      await page.setViewportSize({ width: 320, height: 900 });
      await settled(page);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('[data-flow-layout]').count(), 0);
    });

    check('changing account mode during dialog entry preserves the displayed rectangle', async (page) => {
      await stubTurnstile(page);
      await page.goto(process.env.EC_BASE_URL);
      await page.locator('#account-btn').click();
      await page.waitForTimeout(60);
      const rectangle = await page.locator('#account-mode').evaluate((button) => {
        const dialog = document.querySelector('#account-dialog');
        const before = dialog.getBoundingClientRect();
        const native = new DOMMatrix(getComputedStyle(dialog).transform);
        button.click();
        const after = dialog.getBoundingClientRect();
        return { nativeY: native.f, before: { x: before.x, y: before.y, height: before.height },
          after: { x: after.x, y: after.y, height: after.height } };
      });
      assert.ok(Math.abs(rectangle.nativeY) > .1, 'the account mode changes during its native entrance');
      for (const key of ['x', 'y', 'height']) assert.ok(Math.abs(rectangle.before[key] - rectangle.after[key]) < .5, key);
      await settled(page);
    }, { signedIn: false });

    check('the first reading disclosure starts with no height or padding jump', async (page) => {
      await openChart(page);
      await page.locator('.pillar-identity[data-pillar="hour"]').click();
      await settled(page);
      const toggle = page.locator('#pillar-detail .canon-line-toggle[aria-expanded="false"]').first();
      const height = await toggle.evaluate((button) => {
        const passage = document.getElementById(button.getAttribute('aria-controls'));
        const before = passage.getBoundingClientRect().height;
        button.click();
        return { before, after: passage.getBoundingClientRect().height };
      });
      assert.equal(height.before, 0);
      assert.ok(height.after < .1);
      await settled(page);
    });
  });
}
