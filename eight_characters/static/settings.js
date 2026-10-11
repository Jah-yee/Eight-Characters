// Settings: what the account keeps for a chart's day (docs/Standard-Settings.md): a
// partner's chart, where you are, and the schools the day follows. What they hold comes
// from the API (GET /api/account/settings, GET /api/schools). Every change names the
// account by its key and the settings it was made from by their `updated_at`, so a
// change made in another tab is refused (412) rather than silently undone.
(() => {
  const SETTINGS = ['favourable', 'season', 'transits'];
  const PILLARS = ['hour', 'day', 'month', 'year'];

  // A request the API refused, with its status and its own words.
  class Refused extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }

  const create = ({ view, translate: t, escape: esc, format, language, account, onOpenChart, onNewChart, onClose, onChanged, toast }) => {
    const statusLine = view.querySelector('#settings-status');
    const partnerBody = view.querySelector('#settings-partner-body');
    const placeNow = view.querySelector('#settings-place-now');
    const placeForm = view.querySelector('#settings-place-form');
    const placeInput = view.querySelector('#settings-location');
    const suggestionList = view.querySelector('#settings-location-suggestions');
    const placeStatus = view.querySelector('#settings-location-status');
    const placeSave = view.querySelector('#settings-place-save');
    const placeRemove = view.querySelector('#settings-place-remove');
    const schoolsBody = view.querySelector('#settings-schools-body');
    const closeButton = view.querySelector('#settings-close');
    if (!statusLine || !partnerBody || !placeNow || !placeForm || !placeInput || !suggestionList || !placeStatus
      || !placeSave || !placeRemove || !schoolsBody || !closeButton) throw new Error('Settings view is incomplete.');

    // The settings as the API last gave them, and the schools it lists.
    let settings = null;
    let catalog = null;
    // Reads and changes run one at a time, in the order they were made: a change waits
    // for the ones made before it and is made from the settings they left, so changes in
    // quick succession (arrowing through a school's presets) follow one another.
    let queue = Promise.resolve();
    const inTurn = (task) => {
      const turn = queue.then(task);
      queue = turn.catch(() => {});
      return turn;
    };
    // A change is made from the settings on screen. Once they are replaced by settings
    // this page did not make (changed elsewhere, another account's, a sign-in), the
    // changes still waiting were made from the old ones, and are not made: `basis`
    // counts the replacements, and `replaced` says why the last one happened. A sign-out
    // starts a new `generation`: a read answered after it is not taken.
    let basis = 0;
    let replaced = '';
    let generation = 0;
    // The basis of the settings last drawn here: a change from this page's controls is
    // made from them, so settings read meanwhile by Today or a chart's bar (another
    // partner saved elsewhere, say) replace them, and the change is not made.
    let drawnBasis = -1;
    // Changes still waiting: the page is drawn once the last of them has its answer.
    let waiting = 0;

    const call = async (method, path, body) => {
      const response = await fetch(path, {
        method,
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let value = null;
      try {
        value = await response.json();
      } catch (err) {
        throw new Error(t('settings_answer_error', { status: response.status }), { cause: err });
      }
      if (!response.ok) {
        const detail = value && typeof value.detail === 'string' ? value.detail : t('settings_answer_error', { status: response.status });
        throw new Refused(response.status, detail);
      }
      return value;
    };
    // The answer must be the settings: a malformed one is said, never drawn.
    const checked = (value) => {
      const ok = value && typeof value === 'object' && typeof value.key === 'string'
        && (value.updated_at === null || typeof value.updated_at === 'string')
        && SETTINGS.every((name) => typeof value.schools?.[name] === 'string' && Object.hasOwn(value.chosen ?? {}, name))
        && (value.partner === null || typeof value.partner === 'object')
        && (value.place === null || typeof value.place === 'object');
      if (!ok) throw new Error(t('settings_answer_error', { status: 200 }));
      return value;
    };

    // The settings, read from the API. Settings other than those on screen replace the
    // basis of the changes still waiting, for the reason given.
    const read = async (why = t('settings_changed_elsewhere')) => {
      const at = generation;
      const value = checked(await call('GET', '/api/account/settings'));
      if (at !== generation) throw new Error(t('account_session_ended'));
      if (settings === null || value.key !== settings.key || value.updated_at !== settings.updated_at) {
        basis += 1;
        replaced = why;
      }
      settings = value;
      return value;
    };
    // The settings, read anew in their turn. A session that ended meanwhile asks for a
    // sign-in first, while `wanted` holds: the page may still hold the account whose
    // session ended, so the server is asked before the sign-in is. The settings are
    // then those of the account signed in.
    const load = (wanted = () => true) => inTurn(async () => {
      try {
        return await read();
      } catch (err) {
        if (!(err instanceof Refused) || err.status !== 401 || !wanted()) throw err;
        if (!(await account.recheck(wanted))) {
          if (!wanted()) throw err;
          await account.signIn();
        }
        return read(t('settings_signed_in_again'));
      }
    });
    const loadCatalog = async () => {
      if (catalog === null) {
        const value = await call('GET', '/api/schools');
        if (!Array.isArray(value?.settings) || value.settings.map((s) => s.id).join() !== SETTINGS.join()) {
          throw new Error(t('settings_answer_error', { status: 200 }));
        }
        catalog = value;
      }
      return catalog;
    };

    const say = (text, isError = false) => {
      statusLine.textContent = text;
      statusLine.classList.toggle('is-error', isError);
      statusLine.classList.toggle('hidden', text === '');
    };

    // Refused for settings it was not made from: the settings are read again and shown,
    // and the changes still waiting, made from the old ones, are not made either.
    const reread = async (why) => {
      basis += 1;
      replaced = why;
      await read(why);
      onChanged(settings);
      return why;
    };
    // A change, made from the settings of basis `from`: null once the API has made it, or
    // why it was not made. Refused because the settings changed elsewhere, because the
    // session ended or because another account is signed in now, the settings are read
    // again and drawn, and the change is not repeated: the reader decides again.
    const write = (method, path, body, from) => {
      waiting += 1;
      return inTurn(async () => {
        // A sign-out while the change is on its way: its answer is the account's before,
        // and is neither taken nor drawn, and a refusal asks for no sign-in.
        const at = generation;
        try {
          if (from !== basis) return replaced;
          // No settings read, none shown: nothing is changed from controls left over.
          if (settings === null) return t('settings_load_error');
          const value = checked(await call(method, path, { ...body, key: settings.key, updated_at: settings.updated_at }));
          if (at !== generation) return t('account_session_ended');
          settings = value;
          onChanged(settings);
          return null;
        } catch (err) {
          if (at !== generation) return t('account_session_ended');
          // A change not made, for whatever reason, stops the changes waiting behind it:
          // they were made from the settings it was to leave.
          basis += 1;
          replaced = err.message || t('settings_load_error');
          if (!(err instanceof Refused)) throw err;
          // Awaited here, so that the drawing below shows the settings read again.
          if (err.status === 412) return await reread(t('settings_changed_elsewhere'));
          if (err.status === 401) {
            // Signed out elsewhere: the server is asked first, since the page may still
            // hold the account; then a sign-in, and the settings of the account signed in.
            replaced = t('account_session_ended');
            if (!(await account.recheck(() => true))) await account.signIn();
            return await reread(t('settings_signed_in_again'));
          }
          if (err.status === 409) {
            // Another account is signed in in this browser now: its settings are shown.
            await account.stillSignedIn(() => true);
            await reread(err.message);
          }
          return err.message;
        } finally {
          waiting -= 1;
          if (waiting === 0 && at === generation) draw();
        }
      });
    };
    // A change from this page: done, it is said briefly; refused, its reason stays here.
    const change = async (method, path, body, done) => {
      let problem;
      try {
        problem = await write(method, path, body, drawnBasis);
      } catch (err) {
        console.error(err);
        problem = err.message || t('settings_load_error');
      }
      if (problem === null) {
        say('');
        toast(done, false);
        return true;
      }
      say(problem, true);
      return false;
    };

    // ── Your partner's chart ──
    const birthHeading = (birth) => {
      const reading = format.parseWallClock(`${birth.date}T${birth.time}`);
      if (!reading) throw new Error(t('settings_answer_error', { status: 200 }));
      return [format.date(reading), format.time(reading, birth.time.length > 5), birth.place.city].join(' · ');
    };
    // The chart link of a saved birth, as a chart's own bar would write it.
    const chartParams = (birth) => {
      const params = new URLSearchParams({
        date: birth.date,
        time: birth.time,
        place: birth.place.name,
        city: birth.place.city,
        latitude: String(birth.place.latitude),
        longitude: String(birth.place.longitude),
        timezone: birth.place.timezone,
        lang: language(),
      });
      params.set('gender', birth.gender);
      if (birth.zi !== 'split_midnight') params.set('zi', birth.zi);
      // A time the place's clocks repeat names its pass, as the saved birth does.
      if (birth.fold !== null) params.set('fold', String(birth.fold));
      return params.toString();
    };
    const partnerName = (partner) => partner.name ?? t('settings_partner_unnamed');
    const drawPartner = () => {
      const partner = settings.partner;
      if (partner === null) {
        partnerBody.innerHTML = `
          <p class="settings-note">${esc(t('settings_partner_none'))}</p>
          <div class="settings-actions">
            <button type="button" class="bar-action" data-settings-action="new">${esc(t('settings_partner_new'))}</button>
          </div>`;
        return;
      }
      const pillars = partner.pillars === null
        ? `<p class="settings-problem">${esc(t('settings_partner_problem', { problem: partner.problem }))}</p>`
        : `<ol class="settings-pillars">${PILLARS.map((name) => {
          const p = partner.pillars[name];
          return `<li class="settings-pillar">
              <span class="settings-pillar-name">${esc(t('pillar_' + name))}</span>
              <span class="settings-pillar-chars" lang="zh-Hant">${esc(p.stem.chinese + p.branch.chinese)}</span>
              <span class="settings-pillar-pinyin">${esc(`${p.stem.pinyin} ${p.branch.pinyin}`)}</span>
            </li>`;
        }).join('')}</ol>`;
      partnerBody.innerHTML = `
        <p class="settings-partner-name">${esc(partnerName(partner))}</p>
        <p class="settings-note">${esc(birthHeading(partner))}</p>
        ${pillars}
        <div class="settings-actions">
          ${partner.pillars === null ? '' : `<button type="button" class="bar-action" data-settings-action="open">${esc(t('settings_partner_open'))}</button>`}
          <button type="button" class="bar-action" data-settings-action="remove">${esc(t('settings_partner_remove'))}</button>
        </div>`;
    };
    partnerBody.addEventListener('click', async (event) => {
      const action = event.target.closest('[data-settings-action]')?.dataset.settingsAction;
      if (!action) return;
      if (action === 'new') onNewChart();
      else if (action === 'open') onOpenChart(chartParams(settings.partner));
      else await change('DELETE', '/api/account/partner', {}, t('settings_partner_removed'));
    });

    // ── Where you are: the place search, as the form's, here on its own ──
    let picked = null;
    let found = [];
    let active = -1;
    let lookup = null;
    let debounce = null;
    const coordinates = (place) => `${format.coordinates(place.latitude, place.longitude)} · ${place.timezone}`;
    const drawPlace = () => {
      const place = settings.place;
      placeNow.textContent = place === null
        ? t('settings_place_none')
        : t('settings_place_now', { place: place.name, where: coordinates(place) });
      placeRemove.classList.toggle('hidden', place === null);
    };
    const closeList = () => {
      found = [];
      active = -1;
      suggestionList.innerHTML = '';
      suggestionList.classList.add('hidden');
      placeInput.setAttribute('aria-expanded', 'false');
      placeInput.removeAttribute('aria-activedescendant');
    };
    const setPlaceStatus = (text, kind = '') => {
      placeStatus.textContent = text;
      placeStatus.className = `field-status${kind ? ` ${kind}` : ''}`;
    };
    const pick = (place) => {
      clearTimeout(debounce);
      lookup?.abort();
      picked = place;
      placeInput.value = place.display;
      closeList();
      placeSave.disabled = false;
      setPlaceStatus(t('selected_city', { city: place.city, coordinates: format.coordinates(place.latitude, place.longitude), timezone: place.timezone }), 'is-found');
    };
    const showList = (items) => {
      found = items;
      active = -1;
      if (!items.length) {
        closeList();
        return;
      }
      suggestionList.innerHTML = items.map((item, index) => `
        <div role="option" id="settings-location-option-${index}" class="location-suggestion" aria-selected="false" data-index="${index}">
          <span class="location-suggestion-city">${esc(item.display)}</span>
          <span class="location-suggestion-meta">${esc(coordinates(item))}</span>
        </div>`).join('');
      suggestionList.classList.remove('hidden');
      placeInput.setAttribute('aria-expanded', 'true');
    };
    const activate = (index) => {
      const options = [...suggestionList.querySelectorAll('.location-suggestion')];
      if (!options.length) return;
      active = (index + options.length) % options.length;
      options.forEach((option, i) => {
        option.classList.toggle('is-active', i === active);
        option.setAttribute('aria-selected', String(i === active));
      });
      placeInput.setAttribute('aria-activedescendant', options[active].id);
      options[active].scrollIntoView({ block: 'nearest' });
    };
    placeInput.addEventListener('input', () => {
      picked = null;
      placeSave.disabled = true;
      clearTimeout(debounce);
      lookup?.abort();
      closeList();
      const query = placeInput.value.trim();
      setPlaceStatus('');
      if (!query) return;
      debounce = setTimeout(async () => {
        const request = new AbortController();
        lookup = request;
        // Only the lookup for the text in the field may be shown.
        const stale = () => request.signal.aborted || placeInput.value.trim() !== query;
        try {
          const response = await fetch('/api/location_suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit: 8 }),
            signal: request.signal,
          });
          const data = await response.json();
          if (stale()) return;
          if (!response.ok) throw new Error(data.detail || t('suggest_error'));
          if (!Array.isArray(data.suggestions)) throw new Error(t('suggest_error'));
          showList(data.suggestions);
          setPlaceStatus(t(data.suggestions.length ? 'pick_city' : 'no_places'));
        } catch (err) {
          if (stale()) return;
          closeList();
          setPlaceStatus(err.message || t('suggest_error'), 'is-error');
        }
      }, 180);
    });
    placeInput.addEventListener('keydown', (event) => {
      if (suggestionList.classList.contains('hidden')) return;
      if (event.key === 'ArrowDown') activate(active + 1);
      else if (event.key === 'ArrowUp') activate(active - 1);
      else if (event.key === 'Enter') pick(found[active >= 0 ? active : 0]);
      else if (event.key === 'Escape') closeList();
      else return;
      event.preventDefault();
    });
    suggestionList.addEventListener('mousedown', (event) => event.preventDefault());
    suggestionList.addEventListener('click', (event) => {
      const option = event.target.closest('.location-suggestion');
      if (option) pick(found[Number(option.dataset.index)]);
    });
    placeInput.addEventListener('blur', () => closeList());
    placeForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (picked === null) return;
      const saving = picked;
      const place = {
        name: saving.display,
        city: saving.city,
        timezone: saving.timezone,
        latitude: saving.latitude,
        longitude: saving.longitude,
      };
      // Saved, the search is cleared, unless another place was picked or typed meanwhile;
      // Save, then unavailable, hands its focus to the search.
      if (await change('PUT', '/api/account/place', { place }, t('settings_place_saved')) && picked === saving) {
        const focused = document.activeElement === placeSave;
        picked = null;
        placeInput.value = '';
        placeSave.disabled = true;
        setPlaceStatus('');
        if (focused) placeInput.focus();
      }
    });
    placeRemove.addEventListener('click', async () => {
      await change('DELETE', '/api/account/place', {}, t('settings_place_removed'));
    });

    // ── The schools: each setting's presets, the default marked in words ──
    const text = (pair) => pair[language()];
    const drawSchools = () => {
      schoolsBody.innerHTML = catalog.settings.map((setting) => {
        const chosen = settings.schools[setting.id];
        return `
          <fieldset class="settings-school" data-setting="${esc(setting.id)}">
            <legend class="settings-school-name">${esc(text(setting.name))}</legend>
            <p class="settings-note">${esc(text(setting.question))}</p>
            ${setting.presets.map((preset) => {
              const id = `settings-${setting.id}-${preset.id}`;
              const han = preset.han === null ? '' : ` <span class="settings-han"><span lang="zh-Hant">${esc(preset.han.chinese)}</span> ${esc(preset.han.pinyin)}</span>`;
              return `
                <div class="settings-preset">
                  <input type="radio" id="${id}" name="settings-${esc(setting.id)}" value="${esc(preset.id)}"${preset.id === chosen ? ' checked' : ''}
                    data-default="${preset.default}" aria-describedby="${id}-summary">
                  <label for="${id}"><span class="settings-preset-name">${esc(text(preset.name))}</span>${han}${preset.default ? ` <span class="settings-default">${esc(t('settings_school_default'))}</span>` : ''}</label>
                  <p class="settings-summary" id="${id}-summary">${esc(text(preset.summary))}</p>
                  <p class="settings-sources">${esc(t('settings_sources', { sources: preset.sources.join('; ') }))}</p>
                </div>`;
            }).join('')}
          </fieldset>`;
      }).join('') + (language() === 'fi' && catalog.finnish_provisional ? `<p class="settings-note">${esc(t('settings_finnish_provisional'))}</p>` : '');
    };
    schoolsBody.addEventListener('change', async (event) => {
      const radio = event.target.closest('input[type="radio"]');
      if (!radio) return;
      const setting = radio.closest('[data-setting]').dataset.setting;
      // The default is followed, not chosen, so a later change of default applies too.
      const choice = radio.dataset.default === 'true' ? null : radio.value;
      await change('PATCH', '/api/account/schools', { [setting]: choice }, t('settings_school_saved'));
    });

    // Drawing replaces the controls: the one that had focus hands it to its counterpart
    // (the same preset or action), or, gone, to the first control of its part, so the
    // keyboard stays where it was. A control hidden or disabled has lost focus too.
    const focusable = (node) => node.isConnected && !node.closest('.hidden') && !node.disabled;
    const draw = () => {
      if (settings === null) return;
      const focused = view.contains(document.activeElement) ? document.activeElement : null;
      const part = focused?.closest('#settings-partner-body, #settings-schools-body') ?? null;
      let counterpart = null;
      if (focused?.id) counterpart = `#${CSS.escape(focused.id)}`;
      else if (focused?.dataset.settingsAction) counterpart = `[data-settings-action="${CSS.escape(focused.dataset.settingsAction)}"]`;
      drawPartner();
      drawPlace();
      if (catalog !== null) drawSchools();
      drawnBasis = basis;
      if (focused === null || focusable(focused)) return;
      const found = counterpart === null ? null : view.querySelector(counterpart);
      const next = found !== null && focusable(found) ? found : [...(part?.querySelectorAll('button, input') ?? [])].find(focusable);
      // The place's Remove, gone with the place, hands focus to the place's search.
      (next ?? placeInput).focus();
    };

    // Shows the settings, read anew: whatever another tab changed meanwhile is shown.
    // Each showing is numbered: only the latest draws or says anything, so one that ends
    // late changes nothing of a later one, its failure included.
    let showing = 0;
    const show = async () => {
      const mine = ++showing;
      say('');
      view.classList.remove('hidden');
      view.setAttribute('aria-busy', 'true');
      try {
        await Promise.all([load(() => mine === showing), loadCatalog()]);
        if (mine !== showing) return;
        draw();
        say('');
      } catch (err) {
        if (mine !== showing) return;
        console.error(err);
        say(err.message || t('settings_load_error'), true);
      } finally {
        if (mine === showing) view.removeAttribute('aria-busy');
      }
    };
    const hide = () => {
      showing += 1;
      view.classList.add('hidden');
      view.removeAttribute('aria-busy');
      closeList();
    };
    closeButton.addEventListener('click', () => onClose());

    // Keeps a birth as the partner's chart, as a chart's bar asks (app.js): null once
    // kept, or why not.
    // The dialog has just read the settings (app.js): the change is made from them.
    const savePartner = async (birth) => write('PUT', '/api/account/partner', birth, basis);

    return {
      show,
      hide,
      load,
      current: () => settings,
      savePartner,
      partnerName,
      // A sign-out forgets what was read for the account and leaves nothing of it on the
      // page, and the changes still waiting are not made.
      forget: () => {
        settings = null;
        generation += 1;
        basis += 1;
        replaced = t('account_session_ended');
        partnerBody.innerHTML = '';
        placeNow.textContent = '';
        placeRemove.classList.add('hidden');
        schoolsBody.innerHTML = '';
        clearTimeout(debounce);
        lookup?.abort();
        picked = null;
        placeInput.value = '';
        placeSave.disabled = true;
        setPlaceStatus('');
        closeList();
        say('');
      },
      // The page's language changed: the schools are written in it.
      redraw: () => {
        if (!view.classList.contains('hidden')) draw();
      },
    };
  };
  window.EC_SETTINGS = { create, Refused };
})();
