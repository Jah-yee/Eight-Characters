// Run with Node's built-in test runner and an explicitly selected Playwright install.
// Today: the day of the chart on screen (docs/Standard-Today.md). Every number the page
// shows is the API's (POST /api/today), asked for with the place and the schools the
// account keeps and, when the chart on screen is saved in a couple, the other chart of
// the couple. The address names the chart, the day, whose day and the topic; a step
// replaces it and a topic adds to it; late answers are dropped.
import {
  assert, describe, it, engineName, profiles, openLink, settled, withPage, playwright, HELSINKI,
} from './chart-helpers.mjs';
import { newAccount, asAccount, signInPage, stubTurnstile } from './account-helpers.mjs';
import { dialogOpens, signInThroughDialog } from './account-page.mjs';

// A made-up birth, of nobody: the luck suites' sample, 14 August 1975, 07:45, Helsinki.
const CHART = { date: '1975-08-14', time: '07:45', gender: 'female' };
const chartParams = (parts = {}) => new URLSearchParams({
  date: CHART.date, time: CHART.time, place: HELSINKI.display, city: HELSINKI.city,
  latitude: String(HELSINKI.latitude), longitude: String(HELSINKI.longitude), timezone: HELSINKI.timezone,
  lang: 'en', gender: CHART.gender, ...parts,
});
const todayLink = (parts = {}, chart = {}) => `/#today?${chartParams(chart)}&${new URLSearchParams({ day: DAY, ...parts })}`;
// Noon in Helsinki on the day the suite reads.
const DAY = '2026-10-11';
const NOW = new Date('2026-10-11T09:00:00Z');
const PLACE = {
  name: HELSINKI.display, city: HELSINKI.city, timezone: HELSINKI.timezone,
  latitude: HELSINKI.latitude, longitude: HELSINKI.longitude,
};
// Another made-up birth, named as no one is, so that a name is shown as text.
const PARTNER = {
  name: 'Partner <img src=x onerror=window.__named=1>', date: '1988-11-02', time: '21:05:30',
  place: PLACE, gender: 'male', zi: 'split_midnight',
};
const BANDS = {
  strongly_supportive: 'Strongly supportive', supportive: 'Supportive', mixed: 'Mixed',
  draining: 'Draining', strongly_draining: 'Strongly draining',
};
const score = (value) => new Intl.NumberFormat('en', {
  minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero',
}).format(value);
const pull = (value) => `${BANDS[value.band]} (${score(value.score)})`;

// The chart on screen as the library keeps it.
const SELF = { date: CHART.date, time: CHART.time, place: PLACE, gender: CHART.gender, zi: 'split_midnight' };
// The account's settings, changed from the page as Settings changes them: where you are
// and, with a partner, the chart on screen and the partner saved as a couple. Every
// chart saved before is removed first.
async function setSettings(page, { place = PLACE, partner = null } = {}) {
  const statuses = await page.evaluate(async ({ place, partner, self }) => {
    const write = async (method, path, body) => {
      const read = await (await fetch('/api/account/settings')).json();
      const response = await fetch(path, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, key: read.key, updated_at: read.updated_at }),
      });
      return { status: response.status, value: await response.json() };
    };
    const results = [];
    for (const chart of (await (await fetch('/api/account/settings')).json()).charts) {
      results.push((await write('DELETE', `/api/account/charts/${chart.id}`, {})).status);
    }
    results.push((place === null ? await write('DELETE', '/api/account/place', {}) : await write('PUT', '/api/account/place', { place })).status);
    if (partner !== null) {
      const mine = await write('POST', '/api/account/charts', self);
      results.push(mine.status);
      results.push((await write('POST', '/api/account/charts', { ...partner, couple_with: mine.value.saved })).status);
    }
    return results;
  }, { place, partner, self: SELF });
  assert.ok(statuses.every((status) => status === 200 || status === 201), statuses.join());
}
// Every answer to POST /api/today, with what the page asked; `hold` keeps one back.
async function recordToday(page) {
  const answers = [];
  const held = [];
  await page.route('**/api/today', async (route) => {
    const response = await route.fetch();
    const entry = { request: route.request().postDataJSON(), payload: await response.json() };
    answers.push(entry);
    if (held.length && held[0].day === entry.request.date) {
      const wait = held.shift();
      await wait.released;
    }
    await route.fulfill({ response });
  });
  const hold = (day) => {
    let release;
    const released = new Promise((resolve) => { release = resolve; });
    held.push({ day, released });
    return release;
  };
  return { answers, hold };
}
async function shown(page) {
  await page.locator('#today-view').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.getElementById('today-view').hasAttribute('aria-busy'));
  await settled(page);
}
const part = (page, name) => page.evaluate((name) => new URLSearchParams(location.hash.split('?')[1] ?? '').get(name), name);

for (const profile of profiles) {
  describe(`${engineName} / ${profile.name} / today`, { concurrency: false }, () => {
    const check = (name, run) => it(name, { timeout: 120000 }, () => withPage(profile, run));

    check('Chart · Today opens the day of the chart on screen, every number the API’s', async (page) => {
      await page.clock.setFixedTime(NOW);
      const { answers } = await recordToday(page);
      await openLink(page, `/#chart?${chartParams()}`, { place: HELSINKI });
      await setSettings(page);
      await page.locator('#page-switch [data-page="today"]').click();
      await shown(page);
      assert.equal(await part(page, 'day'), DAY);
      assert.equal(await part(page, 'date'), CHART.date);
      const { request, payload } = answers.at(-1);
      assert.equal(request.date, DAY);
      assert.equal(request.lang, 'en');
      assert.deepEqual(request.place, PLACE);
      assert.equal(request.chart, 'self');
      assert.equal(request.charts.self.date, CHART.date);
      assert.equal(request.charts.self.gender, CHART.gender);
      assert.equal(request.charts.partner, undefined);
      assert.equal(await page.locator('#today-pull-line').textContent(), `The day: ${pull(payload.layers.day.pull)}`);
      // The run: each day's date, pillar, score and band, as the answer gives them.
      const chips = await page.locator('.today-run-day').evaluateAll((nodes) => nodes.map((node) => ({
        day: node.dataset.todayDay,
        chars: node.querySelector('.today-run-chars').textContent,
        score: node.querySelector('.today-run-score').textContent,
        label: node.getAttribute('aria-label'),
        selected: node.getAttribute('aria-current'),
      })));
      assert.deepEqual(chips.map((chip) => chip.day), payload.run.map((day) => day.date));
      payload.run.forEach((day, index) => {
        assert.equal(chips[index].chars, day.pillar.stem.chinese + day.pillar.branch.chinese);
        assert.equal(chips[index].score, score(day.score));
        assert.ok(chips[index].label.endsWith(`: ${pull(day)}`), chips[index].label);
        assert.equal(chips[index].selected, day.date === DAY ? 'date' : null);
      });
      // The four pillars of the day, each with its characters, pinyin and pull.
      for (const layer of ['day', 'month', 'year', 'luck']) {
        const card = page.locator(`.today-pillar[data-layer="${layer}"]`);
        const data = payload.layers[layer];
        assert.ok(data !== null, `the sample has a ${layer} pillar`);
        assert.equal(await card.locator('.today-chars').textContent(), data.pillar.stem.chinese + data.pillar.branch.chinese);
        assert.equal(await card.locator('.today-pinyin').textContent(), `${data.pillar.stem.pinyin} ${data.pillar.branch.pinyin}`);
        assert.equal((await card.locator('.today-pillar-pull').textContent()).trim(), pull(data.pull));
      }
      // The relationships with the chart, one item each.
      const all = ['day', 'month', 'year', 'luck'].flatMap((layer) => payload.layers[layer].relationships);
      assert.deepEqual(await page.locator('#today-in-chart .today-relationship').evaluateAll(
        (nodes) => nodes.map((node) => node.dataset.relationship)), all.map((r) => r.id));
      // The hours: twelve rows, each with its branch and call, the Zi hour with its two spans.
      const rows = await page.locator('.today-hours tbody tr').evaluateAll((nodes) => nodes.map((node) => ({
        branch: node.querySelector('th [lang]').textContent,
        times: node.querySelectorAll('td')[0].innerHTML.split('<br>').length,
        call: node.querySelectorAll('td')[2].textContent.trim(),
      })));
      assert.deepEqual(rows.map((row) => row.branch), payload.hours.map((hour) => hour.branch));
      payload.hours.forEach((hour, index) => {
        assert.equal(rows[index].times, hour.spans.length);
        assert.equal(rows[index].call, hour.call === null ? '—' : { protect: 'Protect', mixed: 'Mixed', avoid: 'Avoid' }[hour.call]);
      });
      // No marriage without a partner's chart, and no partner switch.
      assert.equal(await page.locator('[data-today-topic="marriage"]').count(), 0);
      assert.equal(await page.locator('#today-who').isHidden(), true);
      // Chart · Today back on the chart page.
      await page.locator('#today-page-switch [data-page="chart"]').click();
      await page.locator('#chart-view').waitFor({ state: 'visible' });
      assert.match(await page.evaluate(() => location.hash), /^#chart\?/);
    });

    check('a day step replaces the address, a topic adds to it, and Back and reload keep the place', async (page) => {
      await page.clock.setFixedTime(NOW);
      await recordToday(page);
      await page.goto(new URL('/', process.env.EC_BASE_URL).href);
      await setSettings(page);
      await page.goto(new URL(todayLink(), process.env.EC_BASE_URL).href);
      await shown(page);
      const entries = await page.evaluate(() => history.length);
      await page.locator('.today-step[data-today-step="1"]').click();
      await shown(page);
      assert.equal(await part(page, 'day'), '2026-10-12');
      assert.equal(await page.evaluate(() => history.length), entries, 'a step replaces the entry');
      assert.equal(await page.locator('[data-today-now]').isDisabled(), false);
      await page.locator('#today-topics [data-today-topic="work"]').click();
      await shown(page);
      assert.equal(await part(page, 'topic'), 'work');
      assert.equal(await page.evaluate(() => history.length), entries + 1, 'a topic adds an entry');
      assert.equal(await page.locator('#today-panel').isVisible(), true);
      await page.reload();
      await shown(page);
      assert.equal(await part(page, 'topic'), 'work');
      assert.equal(await page.locator('#today-detail-title').textContent(), 'Work');
      await page.goBack();
      await shown(page);
      assert.equal(await part(page, 'topic'), null);
      assert.equal(await page.locator('#today-panel').isHidden(), true);
      // Today goes back to the day on the clock where you are.
      await page.locator('[data-today-now]').click();
      await shown(page);
      assert.equal(await part(page, 'day'), DAY);
      assert.equal(await page.locator('[data-today-now]').isDisabled(), true);
    });

    check('only the answer to the latest step is drawn', async (page) => {
      await page.clock.setFixedTime(NOW);
      const { hold } = await recordToday(page);
      await page.goto(new URL('/', process.env.EC_BASE_URL).href);
      await setSettings(page);
      await page.goto(new URL(todayLink(), process.env.EC_BASE_URL).href);
      await shown(page);
      const release = hold('2026-10-12');
      await page.locator('.today-step[data-today-step="1"]').click();
      await page.locator('.today-step[data-today-step="1"]').click();
      await page.waitForFunction(() => new URLSearchParams(location.hash.split('?')[1]).get('day') === '2026-10-13');
      await page.waitForFunction(() => document.querySelector('.today-run-day.is-selected')?.dataset.todayDay === '2026-10-13');
      release();
      await page.waitForTimeout(500);
      assert.equal(await page.locator('.today-run-day.is-selected').getAttribute('data-today-day'), '2026-10-13');
      assert.match(await page.locator('#today-date').textContent(), /October 13, 2026/);
    });

    check('the keys step the day, go to today and close a topic, only while the page has focus', async (page) => {
      await page.clock.setFixedTime(NOW);
      await recordToday(page);
      await page.goto(new URL('/', process.env.EC_BASE_URL).href);
      await setSettings(page);
      await page.goto(new URL(todayLink(), process.env.EC_BASE_URL).href);
      await shown(page);
      await page.locator('.today-run-day.is-selected').focus();
      await page.keyboard.press(']');
      await shown(page);
      assert.equal(await part(page, 'day'), '2026-10-12');
      await page.locator('.today-run-day.is-selected').focus();
      // AltGr, as Finnish keyboards type brackets.
      await page.keyboard.press('Control+Alt+[');
      await shown(page);
      assert.equal(await part(page, 'day'), DAY);
      await page.locator('[data-today-topic="health"]').click();
      await shown(page);
      await page.locator('[data-today-topic="health"]').focus();
      await page.keyboard.press('Escape');
      await shown(page);
      assert.equal(await part(page, 'topic'), null);
      await page.locator('.today-run-day.is-selected').focus();
      await page.keyboard.press('?');
      assert.equal(await page.locator('#keys-dialog').isVisible(), true);
      // The day's keys, not the chart's.
      assert.deepEqual(await page.locator('#keys-dialog .key-row').filter({ visible: true }).locator('dd').allTextContents(),
        ['The day before or after', 'Today, where you are', 'Closes what is open', 'Commands', 'These keys']);
      assert.equal(await page.locator('#keys-dialog .key-note').textContent(),
        'Letter keys work while the page has focus and no field does.');
      await page.keyboard.press('Escape');
      // The commands, too, show over the day: neither dialog lives in the hidden chart.
      await page.keyboard.press('ControlOrMeta+k');
      assert.equal(await page.locator('#command-palette').isVisible(), true);
      assert.ok((await page.locator('#palette-list').textContent()).includes('The day after'));
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#command-palette').isVisible(), false);
      // A field's own keys are its own.
      await page.locator('#today-copy-link').focus();
      await page.evaluate(() => document.activeElement.blur());
      await page.keyboard.press(']');
      assert.equal(await part(page, 'day'), DAY, 'nothing on the page has focus');
    });

    check('a topic opened from the keyboard keeps focus on its button, and the keys go on working', async (page) => {
      await page.clock.setFixedTime(NOW);
      await recordToday(page);
      await page.goto(new URL('/', process.env.EC_BASE_URL).href);
      await setSettings(page);
      await page.goto(new URL(todayLink(), process.env.EC_BASE_URL).href);
      await shown(page);
      await page.locator('#today-topics [data-today-topic="work"]').focus();
      await page.keyboard.press('Enter');
      await shown(page);
      assert.equal(await part(page, 'topic'), 'work');
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.todayTopic), 'work');
      await page.keyboard.press('Escape');
      await shown(page);
      assert.equal(await part(page, 'topic'), null);
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.todayTopic), 'work');
      await page.keyboard.press(']');
      await shown(page);
      assert.equal(await part(page, 'day'), '2026-10-12');
      // A day of the run, chosen from the keyboard, keeps it too.
      await page.locator('.today-run-day[data-today-day="2026-10-14"]').focus();
      await page.keyboard.press('Enter');
      await shown(page);
      assert.equal(await part(page, 'day'), '2026-10-14');
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.todayDay), '2026-10-14');
      // Today, pressed from the keyboard, is then disabled: the day's heading takes focus.
      await page.locator('[data-today-now]').focus();
      await page.keyboard.press('Enter');
      await shown(page);
      assert.equal(await part(page, 'day'), DAY);
      assert.equal(await page.locator('[data-today-now]').isDisabled(), true);
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'today-date');
      await page.keyboard.press(']');
      await shown(page);
      assert.equal(await part(page, 'day'), '2026-10-12');
    });

    check('Chart · Today hands the focus across, so each page’s keys act at once', async (page) => {
      await page.clock.setFixedTime(NOW);
      await recordToday(page);
      await openLink(page, `/#chart?${chartParams()}`, { place: HELSINKI });
      await setSettings(page);
      await page.locator('#page-switch [data-page="today"]').focus();
      await page.keyboard.press('Enter');
      await shown(page);
      await page.waitForFunction(() => document.activeElement?.matches('#today-page-switch [data-page="today"]'));
      await page.keyboard.press(']');
      await shown(page);
      assert.equal(await part(page, 'day'), '2026-10-12');
      await page.locator('#today-page-switch [data-page="chart"]').focus();
      await page.keyboard.press('Enter');
      await page.locator('#chart-view').waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.activeElement?.matches('#page-switch [data-page="chart"]'));
      await page.keyboard.press('?');
      assert.equal(await page.locator('#keys-dialog').isVisible(), true);
      assert.equal(await page.locator('#keys-dialog .key-row-chart').first().isVisible(), true);
    });

    check('the day in another language opens the chart in it', async (page) => {
      await page.clock.setFixedTime(NOW);
      const { answers } = await recordToday(page);
      await page.goto(new URL('/', process.env.EC_BASE_URL).href);
      await setSettings(page);
      await page.goto(new URL(todayLink(), process.env.EC_BASE_URL).href);
      await shown(page);
      await page.locator('#today-language [data-today-lang="fi"]').click();
      await shown(page);
      assert.equal(await part(page, 'lang'), 'fi');
      assert.equal(answers.at(-1).request.lang, 'fi');
      await page.locator('#today-page-switch [data-page="chart"]').click();
      await page.locator('#chart-view').waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.getElementById('chart-view').hasAttribute('aria-busy'));
      assert.equal(await part(page, 'lang'), 'fi');
      assert.equal(await page.evaluate(() => document.documentElement.lang), 'fi');
    });

    check('until its answer is drawn, a day is neither copied as text nor printed, and then its own text is', async (page) => {
      await page.clock.setFixedTime(NOW);
      await page.addInitScript(() => {
        window.__copied = [];
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.__copied.push(text); } } });
      });
      const { answers, hold } = await recordToday(page);
      await page.goto(new URL('/', process.env.EC_BASE_URL).href);
      await setSettings(page);
      await page.goto(new URL(todayLink(), process.env.EC_BASE_URL).href);
      await shown(page);
      assert.equal(await page.locator('#today-copy-text').getAttribute('aria-disabled'), 'false');
      const release = hold('2026-10-12');
      await page.locator('.today-step[data-today-step="1"]').click();
      await page.waitForFunction(() => new URLSearchParams(location.hash.split('?')[1]).get('day') === '2026-10-12');
      assert.equal(await page.locator('#today-copy-text').getAttribute('aria-disabled'), 'true');
      assert.equal(await page.locator('#today-print').getAttribute('aria-disabled'), 'true');
      // Pressed anyway: the button says it is unavailable, and copies nothing.
      await page.locator('#today-copy-text').click({ force: true });
      assert.deepEqual(await page.evaluate(() => window.__copied), [], 'nothing is copied while the day is on its way');
      release();
      await shown(page);
      assert.equal(await page.locator('#today-copy-text').getAttribute('aria-disabled'), 'false');
      await page.locator('#today-copy-text').click();
      await page.waitForFunction(() => window.__copied.length === 1);
      const copied = await page.evaluate(() => window.__copied[0]);
      const { payload } = answers.at(-1);
      assert.equal(payload.date, '2026-10-12');
      assert.ok(copied.startsWith('Monday, October 12, 2026'), copied);
      const day = payload.layers.day;
      assert.ok(copied.includes(`${day.pillar.stem.chinese}${day.pillar.branch.chinese} ${day.pillar.stem.pinyin} ${day.pillar.branch.pinyin} · ${pull(day.pull)}`), copied);
    });

    check('a day that cannot be shown leaves nothing of the day before, its topic neither, and Retry asks again', async (page) => {
      await page.clock.setFixedTime(NOW);
      await recordToday(page);
      await page.goto(new URL('/', process.env.EC_BASE_URL).href);
      await setSettings(page);
      await page.goto(new URL(todayLink({ topic: 'work' }), process.env.EC_BASE_URL).href);
      await shown(page);
      assert.equal(await page.locator('#today-panel').isVisible(), true);
      const refuse = (route) => route.fulfill({ status: 500, json: { detail: 'Stopped by the test.' } });
      await page.route('**/api/today', refuse);
      await page.locator('.today-step[data-today-step="1"]').click();
      await shown(page);
      assert.equal(await page.locator('#today-notice').textContent(), 'Stopped by the test.Try again');
      assert.equal(await page.locator('#today-body').isHidden(), true);
      assert.equal(await page.locator('#today-panel').isHidden(), true);
      assert.equal(await page.locator('#today-detail').innerHTML(), '');
      await page.unroute('**/api/today', refuse);
      await page.locator('[data-today-action="retry"]').click();
      await shown(page);
      assert.equal(await part(page, 'day'), '2026-10-12');
      assert.equal(await page.locator('#today-body').isVisible(), true);
      assert.equal(await page.locator('#today-detail-title').textContent(), 'Work');
    });

    check('Marriage, open when the partner’s chart is removed elsewhere, closes and the day says why', async (page) => {
      await page.clock.setFixedTime(NOW);
      await recordToday(page);
      await page.goto(new URL('/', process.env.EC_BASE_URL).href);
      await setSettings(page, { partner: PARTNER });
      await page.goto(new URL(todayLink({ topic: 'marriage' }), process.env.EC_BASE_URL).href);
      await shown(page);
      assert.equal(await page.locator('#today-detail-title').textContent(), 'Marriage');
      await setSettings(page);
      await page.reload();
      await shown(page);
      assert.equal(await part(page, 'topic'), null);
      assert.equal(await page.locator('#today-body').isVisible(), true);
      assert.equal(await page.locator('#today-panel').isHidden(), true);
      assert.equal(await page.locator('[data-today-topic="marriage"]').count(), 0);
      assert.match(await page.locator('#today-notice').textContent(), /not in a couple/);
    });

    check('the partner’s day: the switch carries the name as text, and Marriage reads both charts', async (page) => {
      await page.clock.setFixedTime(NOW);
      const { answers } = await recordToday(page);
      await page.goto(new URL('/', process.env.EC_BASE_URL).href);
      await setSettings(page, { partner: PARTNER });
      await page.goto(new URL(todayLink(), process.env.EC_BASE_URL).href);
      await shown(page);
      assert.equal(await page.locator('#today-who').isVisible(), true);
      assert.equal(await page.locator('.today-who-name').textContent(), PARTNER.name);
      assert.equal(await page.evaluate(() => window.__named), undefined, 'a name is text');
      assert.equal(answers.at(-1).request.charts.partner.name, PARTNER.name);
      // The partner's birth alone: no library id, no drawn pillars.
      assert.equal(answers.at(-1).request.charts.partner.id, undefined);
      assert.equal(answers.at(-1).request.charts.partner.pillars, undefined);
      await page.locator('[data-today-topic="marriage"]').click();
      await shown(page);
      const marriage = answers.at(-1).payload.marriage;
      assert.match(await page.locator('#today-detail').textContent(), new RegExp(pull(marriage.partner.pull).replace(/[()+]/g, '\\$&')));
      await page.locator('#today-who [data-who="partner"]').click();
      await shown(page);
      assert.equal(await part(page, 'who'), 'partner');
      assert.equal(answers.at(-1).request.chart, 'partner');
      assert.match(await page.locator('#today-notice').textContent(), /your partner’s day/);
      // Removed elsewhere: the page says so, and offers the chart's own day.
      await setSettings(page);
      await page.reload();
      await page.locator('#today-notice').waitFor({ state: 'visible' });
      assert.match(await page.locator('#today-notice').textContent(), /not in a couple/);
      await page.locator('[data-today-action="self"]').click();
      await shown(page);
      assert.equal(await part(page, 'who'), null);
    });

    check('without a place the day says so and leads to Settings; without a gender, to the chart', async (page) => {
      await page.clock.setFixedTime(NOW);
      await page.goto(new URL('/', process.env.EC_BASE_URL).href);
      await setSettings(page, { place: null });
      await page.goto(new URL(todayLink(), process.env.EC_BASE_URL).href);
      await page.locator('#today-notice').waitFor({ state: 'visible' });
      assert.match(await page.locator('#today-notice').textContent(), /needs where you are/);
      assert.equal(await page.locator('#today-body').isHidden(), true);
      await page.locator('[data-today-action="settings"]').click();
      await page.locator('#settings-view').waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => location.hash), '#settings');
      await setSettings(page);
      const link = `/#today?${new URLSearchParams([...chartParams()].filter(([key]) => key !== 'gender'))}&day=${DAY}`;
      await page.goto(new URL(link, process.env.EC_BASE_URL).href);
      await page.locator('#today-notice').waitFor({ state: 'visible' });
      assert.match(await page.locator('#today-notice').textContent(), /gender/);
    });

    check('a link with an unknown, repeated or wrong part is refused, naming it', async (page) => {
      await page.goto(new URL('/', process.env.EC_BASE_URL).href);
      for (const [link, named] of [
        [todayLink({ day: '2026-02-30' }), 'day'],
        [`${todayLink()}&day=2026-10-12`, 'day'],
        [todayLink({ who: 'self' }), 'who'],
        [todayLink({ topic: 'stars' }), 'topic'],
        [todayLink({ luck: '5/stem' }), 'luck'],
        [`${todayLink()}&mood=1`, 'mood'],
      ]) {
        await page.goto(new URL(link, process.env.EC_BASE_URL).href);
        await page.locator('#form-error').waitFor({ state: 'visible' });
        assert.match(await page.locator('#form-error').textContent(), new RegExp(named), link);
        assert.equal(await page.locator('#today-view').isHidden(), true);
      }
    });

    check('in Finnish the day has no readings, and its numbers are written the Finnish way', async (page) => {
      await page.clock.setFixedTime(NOW);
      const { answers } = await recordToday(page);
      await page.goto(new URL('/', process.env.EC_BASE_URL).href);
      await setSettings(page);
      await page.goto(new URL(todayLink({ topic: 'day' }, { lang: 'fi' }), process.env.EC_BASE_URL).href);
      await shown(page);
      const { request, payload } = answers.at(-1);
      assert.equal(request.lang, 'fi');
      assert.equal(payload.readings, null);
      assert.equal(await page.locator('.today-reading').count(), 0);
      const finnish = new Intl.NumberFormat('fi', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' })
        .format(payload.layers.day.pull.score);
      assert.ok((await page.locator('#today-pull-line').textContent()).includes(finnish));
      assert.equal(await page.evaluate(() => document.documentElement.lang), 'fi');
    });

    check('printed, the day keeps its run with each band as a word, and loses its controls', async (page) => {
      await page.clock.setFixedTime(NOW);
      await recordToday(page);
      await page.goto(new URL('/', process.env.EC_BASE_URL).href);
      await setSettings(page);
      await page.goto(new URL(todayLink(), process.env.EC_BASE_URL).href);
      await shown(page);
      await page.emulateMedia({ media: 'print' });
      const printed = await page.evaluate(() => ({
        run: getComputedStyle(document.getElementById('today-run')).display,
        band: getComputedStyle(document.querySelector('.today-run-band')).display,
        tools: getComputedStyle(document.querySelector('#today-view .chart-tools')).display,
      }));
      assert.deepEqual(printed, { run: 'flex', band: 'block', tools: 'none' });
      await page.emulateMedia({ media: 'screen' });
    });

    check('every character the day renders stands with its pinyin', async (page) => {
      await page.clock.setFixedTime(NOW);
      await recordToday(page);
      await page.goto(new URL('/', process.env.EC_BASE_URL).href);
      await setSettings(page);
      await page.goto(new URL(todayLink({ topic: 'pillar/luck' }), process.env.EC_BASE_URL).href);
      await shown(page);
      // The canon's own passages are quoted as they are; everything else pairs each
      // character with its pinyin, beside it.
      const lonely = await page.evaluate(() => [...document.querySelectorAll('#today-view [lang="zh-Hant"]')]
        .filter((node) => !node.closest('.today-reading'))
        .filter((node) => {
          const around = (node.parentElement?.textContent ?? '').replace(node.textContent, '');
          return !/[A-Z][a-z]+/.test(around);
        })
        .map((node) => node.textContent));
      assert.deepEqual(lonely, []);
      assert.ok(await page.locator('.today-run-pinyin').count() > 0);
      // And no pinyin has a tone mark.
      const marked = await page.evaluate(() => [...document.querySelectorAll('#today-view :is(.today-pinyin, .today-run-pinyin)')]
        .map((node) => node.textContent).filter((text) => /[\u0300-\u036f]/.test(text.normalize('NFD'))));
      assert.deepEqual(marked, []);
    });
  });
}

describe(`${engineName} / today and the session`, { concurrency: false }, () => {
  // An account of its own, with where you are kept, and a page signed in to it.
  const ownAccount = async (page, language, label) => {
    const own = await newAccount(playwright, { language, label });
    await asAccount(playwright, own, async (request) => {
      const kept = await request.put('/api/account/place', { data: { place: PLACE, key: own.key, updated_at: null } });
      assert.equal(kept.status(), 200, await kept.text());
    });
    await stubTurnstile(page);
    return own;
  };

  it('a day asked for after the session ended asks for a sign-in, then is drawn', { timeout: 120000 }, () => withPage(profiles[0], async (page) => {
    await page.clock.setFixedTime(NOW);
    const own = await ownAccount(page, 'en', 'today-ended');
    await signInPage(page, own);
    await recordToday(page);
    await page.goto(new URL(todayLink(), process.env.EC_BASE_URL).href);
    await shown(page);
    // Signed out on every device, from another one: the page still holds the account.
    await asAccount(playwright, own, async (request) => {
      assert.equal((await request.delete('/api/account/sessions', { data: { key: own.key } })).status(), 204);
    });
    await page.locator('.today-step[data-today-step="1"]').click();
    await dialogOpens(page);
    await signInThroughDialog(page, own.email);
    await shown(page);
    assert.equal(await part(page, 'day'), '2026-10-12');
    assert.equal(await page.locator('#today-body').isVisible(), true);
    assert.equal(await page.locator('#today-notice').isHidden(), true);
  }, { signedIn: false }));

  it('after a sign-out, the day shows nothing of the account before, even when the next read fails', { timeout: 120000 }, () => withPage(profiles[0], async (page) => {
    await page.clock.setFixedTime(NOW);
    const first = await ownAccount(page, 'en', 'today-first');
    const second = await newAccount(playwright, { language: 'en', label: 'today-second' });
    await asAccount(playwright, first, async (request) => {
      // Made from the settings as they are: the account keeps a place already.
      const now = await (await request.get('/api/account/settings')).json();
      const mine = await request.post('/api/account/charts', { data: { ...SELF, key: first.key, updated_at: now.updated_at } });
      assert.equal(mine.status(), 201, await mine.text());
      const { saved, updated_at: read } = await mine.json();
      const kept = await request.post('/api/account/charts', {
        data: { ...PARTNER, name: 'First partner', couple_with: saved, key: first.key, updated_at: read },
      });
      assert.equal(kept.status(), 201, await kept.text());
    });
    await signInPage(page, first);
    await recordToday(page);
    await page.goto(new URL(todayLink(), process.env.EC_BASE_URL).href);
    await shown(page);
    assert.match(await page.locator('#today-chart').textContent(), /at Helsinki/);
    assert.equal(await page.locator('.today-who-name').textContent(), 'First partner');
    // To the start page, whose account menu signs out; the page stays as it is.
    await page.locator('#today-page-switch [data-page="chart"]').click();
    await page.locator('#chart-view').waitFor({ state: 'visible' });
    await page.locator('#new-chart-btn').click();
    await page.locator('#account-btn').click();
    await page.locator('#account-sign-out').click();
    // Signed in to another account in the same page, whose settings cannot be read now.
    await signInThroughDialog(page, second.email);
    await page.route('**/api/account/settings', (route) => route.fulfill({ status: 500, json: { detail: 'Stopped by the test.' } }));
    await page.evaluate((hash) => {
      history.pushState(null, '', hash);
      dispatchEvent(new PopStateEvent('popstate'));
    }, todayLink().slice(1));
    await page.locator('#today-notice').waitFor({ state: 'visible' });
    assert.match(await page.locator('#today-notice').textContent(), /Stopped by the test\./);
    // The chart's own heading names its birth city; where you are is not said.
    assert.doesNotMatch(await page.locator('#today-chart').textContent(), /at Helsinki/);
    assert.equal(await page.locator('#today-who').isHidden(), true);
    assert.equal(await page.locator('.today-who-name').textContent(), '');
    assert.equal(await page.locator('#today-body').isHidden(), true);
  }, { signedIn: false }));

  it('signed in on a day’s link, the day is in the account’s language, and so is its address', { timeout: 120000 }, () => withPage(profiles[0], async (page) => {
    await page.clock.setFixedTime(NOW);
    const own = await ownAccount(page, 'fi', 'today-language');
    const { answers } = await recordToday(page);
    await page.goto(new URL(todayLink(), process.env.EC_BASE_URL).href);
    await dialogOpens(page);
    await signInThroughDialog(page, own.email);
    await shown(page);
    assert.equal(await part(page, 'lang'), 'fi');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'fi');
    assert.equal(answers.at(-1).request.lang, 'fi');
    assert.equal(await page.locator('#today-language [data-today-lang="fi"]').getAttribute('aria-pressed'), 'true');
  }, { signedIn: false }));
});

describe(`${engineName} / today in a comparison`, { concurrency: false }, () => {
  it('a compared chart has no Chart · Today and no library', { timeout: 120000 }, () => withPage(profiles[0], async (page) => {
    await openLink(page, `/?embed=1#chart?${chartParams()}`, { place: HELSINKI });
    assert.equal(await page.locator('#page-switch').isHidden(), true);
    assert.equal(await page.locator('#library-btn').isHidden(), true);
  }));
});
