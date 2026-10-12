// Natural flow is exercised through real controls, not a second copy of its solver.
import {
  assert, describe, it, engineName, profiles, openChart, settled, showDisplay, withPage,
} from './chart-helpers.mjs';

for (const profile of profiles) {
  describe(`${engineName} / ${profile.name} / natural flow`, { concurrency: false }, () => {
    const check = (name, run) => it(name, { timeout: 90000 }, () => withPage(profile, run));

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

    check('changing language updates the same birth without replaying pillar entrances', async (page) => {
      await openChart(page);
      await page.locator('#chart-language [data-lang="fi"]').click();
      await page.waitForFunction(() => document.querySelector('#chart-language [data-lang="fi"]').getAttribute('aria-pressed') === 'true');
      await settled(page);
      assert.equal(await page.locator('.pillar[data-flow-enter]').count(), 0);
      assert.equal(await page.locator('.pillar').evaluateAll((nodes) => nodes.every((node) => getComputedStyle(node).animationName === 'none')), true);
    });
  });
}
