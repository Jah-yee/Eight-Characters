// Run with Node's built-in test runner and an explicitly selected Playwright install.
// Settings: what the account keeps for a chart's day (docs/Standard-Settings.md). Every
// change is the API's, made with the account's key and the settings it was made from;
// one made from settings another tab has changed since is refused, and the page shows
// the settings as they are.
import {
  assert, describe, it, engineName, profiles, openLink, settled, withPage, playwright, HELSINKI, TROMSO,
} from './chart-helpers.mjs';
import { newAccount, asAccount, signInPage, stubTurnstile } from './account-helpers.mjs';
import { dialogOpens, signInThroughDialog } from './account-page.mjs';

const PLACE = {
  name: HELSINKI.display, city: HELSINKI.city, timezone: HELSINKI.timezone,
  latitude: HELSINKI.latitude, longitude: HELSINKI.longitude,
};
// A made-up birth, of nobody, and its chart's link.
const BIRTH = { date: '1988-11-02', time: '21:05:30', gender: 'male' };
const chartLink = (parts = {}) => `/#chart?${new URLSearchParams({
  date: BIRTH.date, time: BIRTH.time, place: HELSINKI.display, city: HELSINKI.city,
  latitude: String(HELSINKI.latitude), longitude: String(HELSINKI.longitude), timezone: HELSINKI.timezone,
  lang: 'en', gender: BIRTH.gender, ...parts,
})}`;

const read = (page) => page.evaluate(async () => (await fetch('/api/account/settings')).json());
// A change made elsewhere, as another tab makes it, from the settings as they are now.
async function changeElsewhere(page, method, path, body) {
  const status = await page.evaluate(async ({ method, path, body }) => {
    const now = await (await fetch('/api/account/settings')).json();
    const response = await fetch(path, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, key: now.key, updated_at: now.updated_at }),
    });
    return response.status;
  }, { method, path, body });
  assert.equal(status, 200);
}
// The account starts from nothing kept: no partner, no place, the default schools.
async function reset(page) {
  await page.goto(new URL('/', process.env.EC_BASE_URL).href);
  await changeElsewhere(page, 'DELETE', '/api/account/partner', {});
  await changeElsewhere(page, 'DELETE', '/api/account/place', {});
  await changeElsewhere(page, 'PATCH', '/api/account/schools', { favourable: null, season: null, transits: null });
}
// Another address in the same page, as the page's own links go there.
const goTo = (page, hash) => page.evaluate((hash) => {
  history.pushState(null, '', hash);
  dispatchEvent(new PopStateEvent('popstate'));
}, hash);
const partnerNamed = (name) => ({ name, date: '1975-08-14', time: '07:45', place: PLACE, gender: 'female', zi: 'split_midnight' });
async function openSettings(page) {
  await page.goto(new URL('/#settings', process.env.EC_BASE_URL).href);
  await page.locator('#settings-view').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.getElementById('settings-view').hasAttribute('aria-busy'));
  await settled(page);
}

for (const profile of profiles) {
  describe(`${engineName} / ${profile.name} / settings`, { concurrency: false }, () => {
    const check = (name, run) => it(name, { timeout: 120000 }, () => withPage(profile, run));

    check('Settings opens from the account menu with the schools the API lists, the default marked in words', async (page) => {
      await reset(page);
      await page.locator('#account-btn').click();
      await page.locator('#account-settings').click();
      await page.locator('#settings-view').waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.getElementById('settings-view').hasAttribute('aria-busy'));
      assert.equal(await page.evaluate(() => location.hash), '#settings');
      const catalog = await page.evaluate(async () => (await fetch('/api/schools')).json());
      for (const setting of catalog.settings) {
        const group = page.locator(`fieldset[data-setting="${setting.id}"]`);
        assert.equal(await group.locator('legend').textContent(), setting.name.en);
        assert.deepEqual(await group.locator('input[type="radio"]').evaluateAll((radios) => radios.map((radio) => radio.value)),
          setting.presets.map((preset) => preset.id));
        const preset = setting.presets.find((p) => p.default);
        assert.equal(await group.locator('input:checked').getAttribute('value'), preset.id);
        assert.match(await group.locator(`label[for="settings-${setting.id}-${preset.id}"]`).textContent(), /\(default\)/);
      }
      assert.equal(await page.locator('fieldset[data-setting="favourable"] input[value="structure"]').count(), 0);
      assert.match(await page.locator('#settings-place-now').textContent(), /No place is set/);
      assert.match(await page.locator('#settings-partner-body').textContent(), /No partner’s chart is saved/);
      // Close goes back to the page it was opened from.
      await page.locator('#settings-close').click();
      await page.locator('#input-view').waitFor({ state: 'visible' });
    });

    check('where you are is searched, saved and removed', async (page) => {
      await reset(page);
      await page.route('**/api/location_suggest', (route) => route.fulfill({ json: { suggestions: [HELSINKI] } }));
      await openSettings(page);
      assert.equal(await page.locator('#settings-place-save').isDisabled(), true);
      await page.locator('#settings-location').fill('Helsinki');
      await page.locator('#settings-location-suggestions .location-suggestion').click();
      assert.equal(await page.locator('#settings-place-save').isDisabled(), false);
      // Saved and removed from the keyboard: each button, then unavailable, hands its
      // focus to the search.
      await page.locator('#settings-place-save').focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.getElementById('settings-place-now').textContent.startsWith('Now:'));
      assert.deepEqual((await read(page)).place, {
        name: HELSINKI.display, city: HELSINKI.city, timezone: HELSINKI.timezone,
        latitude: HELSINKI.latitude, longitude: HELSINKI.longitude,
      });
      await page.waitForFunction(() => document.activeElement?.id === 'settings-location');
      await page.locator('#settings-place-remove').focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.getElementById('settings-place-now').textContent.startsWith('No place'));
      assert.equal((await read(page)).place, null);
      assert.equal(await page.locator('#settings-place-remove').isHidden(), true);
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'settings-location');
    });

    check('a showing that ends late changes nothing of a later one, its failure included', async (page) => {
      await reset(page);
      // The first showing's list of schools is held on its way.
      let release;
      const held = new Promise((resolve) => { release = resolve; });
      let holding = true;
      const lists = [];
      page.on('response', (response) => {
        if (new URL(response.url()).pathname === '/api/schools') lists.push(response.status());
      });
      await page.route('**/api/schools', async (route) => {
        if (holding) {
          holding = false;
          await held;
        }
        await route.fallback();
      });
      await page.goto(new URL('/#settings', process.env.EC_BASE_URL).href);
      await page.locator('#settings-view').waitFor({ state: 'visible' });
      // Closed, and opened again from the account menu, now unable to read the settings.
      await page.locator('#settings-close').click();
      await page.route('**/api/account/settings', (route) => route.fulfill({ status: 500, json: { detail: 'Stopped by the test.' } }));
      await page.locator('#account-btn').click();
      await page.locator('#account-settings').click();
      await page.locator('#settings-status').waitFor({ state: 'visible' });
      release();
      for (let tries = 0; lists.length < 2 && tries < 100; tries += 1) await page.waitForTimeout(50);
      assert.equal(lists.length, 2, 'the first showing has its answer');
      await page.evaluate(() => new Promise((resolve) => { setTimeout(resolve, 0); }));
      assert.equal(await page.locator('#settings-status').textContent(), 'Stopped by the test.');
      assert.equal(await page.locator('#settings-schools-body input').count(), 0);
      assert.equal(await page.locator('#settings-view').getAttribute('aria-busy'), null);
    });

    check('a partner read elsewhere since Settings were drawn is not removed from their old controls', async (page) => {
      await reset(page);
      const partner = (name) => ({ name, date: '1975-08-14', time: '07:45', place: PLACE, gender: 'female', zi: 'split_midnight' });
      await changeElsewhere(page, 'PUT', '/api/account/partner', partner('First'));
      await openLink(page, chartLink(), { place: HELSINKI });
      const to = (hash) => page.evaluate((hash) => {
        history.pushState(null, '', hash);
        dispatchEvent(new PopStateEvent('popstate'));
      }, hash);
      await to('#settings');
      await page.locator('#settings-view').waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.getElementById('settings-view').hasAttribute('aria-busy'));
      assert.equal(await page.locator('.settings-partner-name').textContent(), 'First');
      // Back on the chart, whose bar reads the settings: another partner was saved elsewhere.
      await page.goBack();
      await page.locator('#chart-view').waitFor({ state: 'visible' });
      await changeElsewhere(page, 'PUT', '/api/account/partner', partner('Replacement'));
      await page.locator('#save-partner-btn').click();
      await page.locator('#partner-dialog').waitFor({ state: 'visible' });
      assert.match(await page.locator('#partner-dialog-replaces').textContent(), /Replacement/);
      await page.locator('#partner-cancel').click();
      // Settings opened again cannot read the settings: the old controls are still there.
      const refuse = (route) => route.fulfill({ status: 500, json: { detail: 'Stopped by the test.' } });
      await page.route('**/api/account/settings', refuse);
      await to('#settings');
      await page.locator('#settings-status').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.settings-partner-name').textContent(), 'First');
      await page.locator('[data-settings-action="remove"]').click();
      await page.waitForFunction(() => document.getElementById('settings-status').textContent.includes('changed elsewhere'));
      await page.unroute('**/api/account/settings', refuse);
      assert.equal((await read(page)).partner.name, 'Replacement', 'the partner not shown was not removed');
      assert.equal(await page.locator('.settings-partner-name').textContent(), 'Replacement');
    });

    check('Open, on Settings drawn before a removal read elsewhere, opens the chart they show', async (page) => {
      await reset(page);
      await changeElsewhere(page, 'PUT', '/api/account/partner', partnerNamed('First'));
      await openLink(page, chartLink(), { place: HELSINKI });
      await goTo(page, '#settings');
      await page.locator('#settings-view').waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.getElementById('settings-view').hasAttribute('aria-busy'));
      await page.goBack();
      await page.locator('#chart-view').waitFor({ state: 'visible' });
      // Removed elsewhere, and read so by the chart's Save as partner.
      await changeElsewhere(page, 'DELETE', '/api/account/partner', {});
      await page.locator('#save-partner-btn').click();
      await page.locator('#partner-dialog').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#partner-dialog-replaces').isHidden(), true);
      await page.locator('#partner-cancel').click();
      const refuse = (route) => route.fulfill({ status: 500, json: { detail: 'Stopped by the test.' } });
      await page.route('**/api/account/settings', refuse);
      await goTo(page, '#settings');
      await page.locator('#settings-status').waitFor({ state: 'visible' });
      await page.locator('[data-settings-action="open"]').click();
      await page.locator('#chart-view').waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => new URLSearchParams(location.hash.split('?')[1]).get('date')), '1975-08-14');
      await page.unroute('**/api/account/settings', refuse);
    });

    check('Save as partner is made from the settings its dialog read, and names a partner read since', async (page) => {
      await reset(page);
      await changeElsewhere(page, 'PUT', '/api/account/partner', partnerNamed('First'));
      await openLink(page, chartLink(), { place: HELSINKI });
      await page.locator('#save-partner-btn').click();
      await page.locator('#partner-dialog').waitFor({ state: 'visible' });
      assert.match(await page.locator('#partner-dialog-replaces').textContent(), /First/);
      // Another partner saved elsewhere, and the settings read again behind the dialog.
      await changeElsewhere(page, 'PUT', '/api/account/partner', partnerNamed('Replacement'));
      const readAgain = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/account/settings'
        && response.request().method() === 'GET');
      await page.evaluate(() => document.getElementById('save-partner-btn').click());
      await readAgain;
      await page.waitForTimeout(200);
      await page.locator('#partner-save').click();
      await page.waitForFunction(() => document.getElementById('partner-name-status').textContent !== '');
      assert.match(await page.locator('#partner-name-status').textContent(), /changed elsewhere/);
      assert.match(await page.locator('#partner-dialog-replaces').textContent(), /Replacement/);
      assert.equal((await read(page)).partner.name, 'Replacement', 'nothing was replaced unseen');
      await page.locator('#partner-save').click();
      await page.locator('#partner-dialog').waitFor({ state: 'hidden' });
      const kept = (await read(page)).partner;
      assert.equal(kept.date, BIRTH.date);
      assert.equal(kept.name, null);
    });

    check('a place picked while the one before is saved stays picked', async (page) => {
      await reset(page);
      await page.route('**/api/location_suggest', (route) => route.fulfill({ json: { suggestions: [HELSINKI, TROMSO] } }));
      // The save is held on its way until the next place is picked.
      let release;
      const held = new Promise((resolve) => { release = resolve; });
      await page.route('**/api/account/place', async (route) => {
        if (route.request().method() === 'PUT') await held;
        await route.fallback();
      });
      await openSettings(page);
      await page.locator('#settings-location').fill('Hel');
      await page.locator('#settings-location-suggestions .location-suggestion').first().click();
      await page.locator('#settings-place-save').click();
      await page.locator('#settings-location').fill('Tro');
      await page.locator('#settings-location-suggestions .location-suggestion').nth(1).click();
      release();
      await page.waitForFunction(() => document.getElementById('settings-place-now').textContent.startsWith('Now:'));
      assert.equal((await read(page)).place.city, HELSINKI.city);
      assert.equal(await page.locator('#settings-location').inputValue(), TROMSO.display);
      assert.equal(await page.locator('#settings-place-save').isDisabled(), false);
    });

    check('a school is chosen, and choosing the default follows it again', async (page) => {
      await reset(page);
      await openSettings(page);
      await page.locator('#settings-favourable-climate').check();
      await page.waitForFunction(async () => (await (await fetch('/api/account/settings')).json()).chosen.favourable === 'climate');
      await page.locator('#settings-favourable-support').check();
      await page.waitForFunction(async () => (await (await fetch('/api/account/settings')).json()).chosen.favourable === null);
      assert.equal((await read(page)).schools.favourable, 'support');
    });

    check('changes made before the last is answered follow one another, and focus stays on the preset', async (page) => {
      await reset(page);
      await openSettings(page);
      // Each change is slow to reach the server, so the next is made before it is answered.
      const answered = [];
      let bothAnswered;
      const both = new Promise((resolve) => { bothAnswered = resolve; });
      page.on('response', (response) => {
        if (new URL(response.url()).pathname !== '/api/account/schools') return;
        answered.push(response.status());
        if (answered.length === 2) bothAnswered();
      });
      await page.route('**/api/account/schools', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 400));
        await route.fallback();
      });
      // Arrowing through a school's presets: each one passed is a change.
      await page.evaluate(() => { window.__drawn = document.getElementById('settings-favourable-support'); });
      await page.locator('#settings-favourable-support').focus();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowUp');
      await both;
      assert.deepEqual(answered, [200, 200], 'neither change was refused');
      // Drawn again once both are answered, with focus on the preset it was on.
      await page.waitForFunction(() => document.getElementById('settings-favourable-support') !== window.__drawn);
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'settings-favourable-support');
      assert.equal(await page.locator('#settings-status').isHidden(), true);
      assert.equal((await read(page)).chosen.favourable, null, 'the last change decides');
      assert.equal(await page.locator('input[name="settings-favourable"]:checked').getAttribute('value'), 'support');
    });

    check('a change made from settings another tab has changed since is refused, and the page shows them as they are', async (page) => {
      await reset(page);
      await openSettings(page);
      await changeElsewhere(page, 'PATCH', '/api/account/schools', { transits: 'whole' });
      await page.locator('#settings-season-months').check();
      await page.locator('#settings-status').waitFor({ state: 'visible' });
      assert.match(await page.locator('#settings-status').textContent(), /changed elsewhere/);
      const now = await read(page);
      assert.equal(now.chosen.season, null, 'the change was not made');
      assert.equal(now.chosen.transits, 'whole');
      assert.equal(await page.locator('input[name="settings-transits"]:checked').getAttribute('value'), 'whole');
      assert.equal(await page.locator('input[name="settings-season"]:checked').getAttribute('value'), 'eighteen');
      // Chosen again, the change is made from the settings now shown, and keeps the other's.
      await page.locator('#settings-season-months').click();
      await page.waitForFunction(async () => (await (await fetch('/api/account/settings')).json()).chosen.season === 'months');
      assert.equal((await read(page)).chosen.transits, 'whole');
      await page.waitForFunction(() => document.getElementById('settings-status').classList.contains('hidden'));
    });

    check('Save as partner keeps the chart on screen, named as text, and Settings opens and removes it', async (page) => {
      await reset(page);
      await openLink(page, chartLink(), { place: HELSINKI });
      await page.locator('#save-partner-btn').click();
      await page.locator('#partner-dialog').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#partner-dialog-replaces').isHidden(), true);
      const name = 'Partner <img src=x onerror=window.__named=1>';
      await page.locator('#partner-name').fill(name);
      await page.locator('#partner-save').click();
      await page.locator('#partner-dialog').waitFor({ state: 'hidden' });
      const kept = (await read(page)).partner;
      assert.equal(kept.name, name);
      assert.equal(kept.date, BIRTH.date);
      assert.equal(kept.time, BIRTH.time);
      assert.equal(kept.gender, BIRTH.gender);
      assert.equal(kept.zi, 'split_midnight');
      assert.equal(kept.place.city, HELSINKI.city);
      // Saving again says what it replaces.
      await page.locator('#save-partner-btn').click();
      await page.locator('#partner-dialog').waitFor({ state: 'visible' });
      assert.match(await page.locator('#partner-dialog-replaces').textContent(), /replaces/);
      await page.locator('#partner-cancel').click();
      await openSettings(page);
      assert.equal(await page.locator('.settings-partner-name').textContent(), name);
      assert.equal(await page.evaluate(() => window.__named), undefined, 'a name is text');
      const pillars = await page.locator('.settings-pillar').evaluateAll((items) => items.map((item) => ({
        chars: item.querySelector('.settings-pillar-chars').textContent,
        pinyin: item.querySelector('.settings-pillar-pinyin').textContent,
      })));
      assert.deepEqual(pillars, ['hour', 'day', 'month', 'year'].map((p) => ({
        chars: kept.pillars[p].stem.chinese + kept.pillars[p].branch.chinese,
        pinyin: `${kept.pillars[p].stem.pinyin} ${kept.pillars[p].branch.pinyin}`,
      })));
      await page.locator('[data-settings-action="open"]').click();
      await page.locator('#chart-view').waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => new URLSearchParams(location.hash.split('?')[1]).get('date')), BIRTH.date);
      await openSettings(page);
      await page.locator('[data-settings-action="remove"]').focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.getElementById('settings-partner-body').textContent.includes('No partner’s chart'));
      assert.equal((await read(page)).partner, null);
      // The button that had focus is gone: its part's first control has it now.
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.settingsAction), 'new');
    });

    check('a save refused for a partner saved meanwhile names that partner, and saved again replaces it', async (page) => {
      await reset(page);
      await openLink(page, chartLink(), { place: HELSINKI });
      await page.locator('#save-partner-btn').click();
      await page.locator('#partner-dialog').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#partner-dialog-replaces').isHidden(), true);
      await changeElsewhere(page, 'PUT', '/api/account/partner', {
        name: 'Saved elsewhere', date: '1975-08-14', time: '07:45', place: PLACE, gender: 'female', zi: 'split_midnight',
      });
      await page.locator('#partner-save').click();
      await page.waitForFunction(() => document.getElementById('partner-name-status').textContent !== '');
      assert.match(await page.locator('#partner-name-status').textContent(), /changed elsewhere/);
      assert.equal(await page.locator('#partner-dialog-replaces').isVisible(), true);
      assert.match(await page.locator('#partner-dialog-replaces').textContent(), /Saved elsewhere/);
      assert.equal((await read(page)).partner.name, 'Saved elsewhere', 'nothing was replaced');
      await page.locator('#partner-save').click();
      await page.locator('#partner-dialog').waitFor({ state: 'hidden' });
      const kept = (await read(page)).partner;
      assert.equal(kept.date, BIRTH.date);
      assert.equal(kept.name, null);
    });

    check('a partner born in an hour the clocks repeat opens as its chart, at its pass, and keeps it', async (page) => {
      await reset(page);
      // 25 October 2020 in Helsinki: the clocks went back at 04:00, so 03:30 came twice.
      const REPEATED = { date: '2020-10-25', time: '03:30', place: PLACE, fold: 1, gender: 'female', zi: 'split_midnight' };
      await changeElsewhere(page, 'PUT', '/api/account/partner', REPEATED);
      await openSettings(page);
      const asked = [];
      page.on('request', (request) => {
        if (new URL(request.url()).pathname === '/api/four_pillars') asked.push(request.postDataJSON());
      });
      await page.locator('[data-settings-action="open"]').click();
      await page.locator('#chart-view').waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.getElementById('chart-view').hasAttribute('aria-busy'));
      assert.equal(await page.evaluate(() => new URLSearchParams(location.hash.split('?')[1]).get('fold')), '1');
      assert.equal(asked.at(-1).location.fold, 1);
      assert.equal(await page.locator('#form-error').isHidden(), true);
      // Saved as the partner's chart again, it keeps its pass.
      await page.locator('#save-partner-btn').click();
      await page.locator('#partner-dialog').waitFor({ state: 'visible' });
      await page.locator('#partner-save').click();
      await page.locator('#partner-dialog').waitFor({ state: 'hidden' });
      assert.equal((await read(page)).partner.fold, 1);
      // And the explorer is asked for the same pass.
      const explored = page.waitForRequest('**/api/evolution_explorer');
      await page.locator('#view-switch button[data-view="evolution"]').click();
      assert.equal((await explored).postDataJSON().location.fold, 1);
    });

    check('a chart without a gender is not saved as a partner, and says why', async (page) => {
      await reset(page);
      await openLink(page, chartLink({ gender: '' }).replace('&gender=', ''), { place: HELSINKI });
      await page.locator('#save-partner-btn').click();
      await page.waitForFunction(() => document.querySelector('.toast').classList.contains('is-shown'));
      assert.match(await page.locator('.toast').textContent(), /gender/);
      assert.equal(await page.locator('#partner-dialog').isHidden(), true);
      assert.equal((await read(page)).partner, null);
    });
  });
}

describe(`${engineName} / settings signed out`, { concurrency: false }, () => {
  it('Settings asks for a sign-in first', { timeout: 60000 }, () => withPage(profiles[0], async (page) => {
    await stubTurnstile(page);
    await page.goto(new URL('/#settings', process.env.EC_BASE_URL).href);
    await page.locator('#account-dialog').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#settings-view').isHidden(), true);
  }, { signedIn: false }));

  it('after a sign-out, Settings show nothing of the account before, even when the next read fails', { timeout: 120000 }, () => withPage(profiles[0], async (page) => {
    const first = await newAccount(playwright, { language: 'en', label: 'settings-first' });
    const second = await newAccount(playwright, { language: 'en', label: 'settings-second' });
    await asAccount(playwright, first, async (request) => {
      const kept = await request.put('/api/account/place', { data: { place: PLACE, key: first.key, updated_at: null } });
      assert.equal(kept.status(), 200, await kept.text());
    });
    await signInPage(page, first);
    await stubTurnstile(page);
    await openSettings(page);
    assert.match(await page.locator('#settings-place-now').textContent(), /^Now:/);
    // A change the server makes, whose answer reaches the page only after the sign-out.
    let deliver;
    const delivered = new Promise((resolve) => { deliver = resolve; });
    let answered;
    const fetched = new Promise((resolve) => { answered = resolve; });
    await page.route('**/api/account/schools', async (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      const response = await route.fetch();
      answered();
      await delivered;
      return route.fulfill({ response });
    });
    await page.locator('#settings-favourable-climate').click();
    await fetched;
    // Back on the start page, whose account menu signs out; the page stays as it is.
    await page.locator('#settings-close').click();
    await page.locator('#account-btn').click();
    await page.locator('#account-sign-out').click();
    deliver();
    await page.waitForFunction(() => document.getElementById('settings-status').textContent === 'Your session ended. Sign in again.');
    // Signed in to another account in the same page, whose settings cannot be read now.
    await signInThroughDialog(page, second.email);
    await page.route('**/api/account/settings', (route) => route.fulfill({ status: 500, json: { detail: 'Stopped by the test.' } }));
    await page.locator('#account-btn').click();
    await page.locator('#account-settings').click();
    await page.locator('#settings-status').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#settings-status').textContent(), 'Stopped by the test.');
    assert.equal(await page.locator('#settings-view [data-settings-action]').count(), 0);
    assert.equal(await page.locator('#settings-place-now').textContent(), '');
    assert.equal(await page.locator('#settings-place-remove').isHidden(), true);
    assert.equal(await page.locator('#settings-schools-body input').count(), 0);
  }, { signedIn: false }));

  it('a change after the session ended elsewhere asks for a sign-in, and is not repeated', { timeout: 90000 }, () => withPage(profiles[0], async (page) => {
    const own = await newAccount(playwright, { language: 'en', label: 'settings-ended' });
    await signInPage(page, own);
    await stubTurnstile(page);
    await openSettings(page);
    // Signed out on every device, from another one: the page still holds the account.
    await asAccount(playwright, own, async (request) => {
      assert.equal((await request.delete('/api/account/sessions', { data: { key: own.key } })).status(), 204);
    });
    await page.locator('#settings-favourable-climate').click();
    await dialogOpens(page);
    await signInThroughDialog(page, own.email);
    await page.locator('#settings-status').waitFor({ state: 'visible' });
    assert.match(await page.locator('#settings-status').textContent(), /signed in again/);
    assert.equal((await read(page)).chosen.favourable, null, 'the change was not made');
    assert.equal(await page.locator('input[name="settings-favourable"]:checked').getAttribute('value'), 'support');
  }, { signedIn: false }));
});
