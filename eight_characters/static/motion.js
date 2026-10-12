// Natural flow: the Tactile spring selected in the interactive motion study.
// Every channel keeps its position and velocity when its destination changes.
(() => {
  'use strict';
  const model = Object.freeze({ stiffness: 180, damping: 20, mass: 1, travel: 20, feedback: 100 });
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const channels = new WeakMap();
  const panelStates = new WeakMap();
  const moving = new Set();
  let frame = 0;
  let previousTime = 0;
  const clamp = (value) => Math.max(0, Math.min(1, value));

  const mark = (owner) => {
    const active = [...channels.get(owner).values()].some((channel) => channel.active);
    owner.toggleAttribute('data-motion-running', active);
  };
  const complete = (channel) => {
    channel.active = false;
    moving.delete(channel);
    channel.write({ ...channel.value });
    mark(channel.owner);
    channel.complete?.();
  };
  const tick = (now) => {
    const elapsed = Math.min((now - previousTime) / 1000, .032);
    previousTime = now;
    const steps = Math.max(1, Math.ceil(elapsed / .008));
    const dt = elapsed / steps;
    for (const channel of moving) {
      if (!channel.owner.isConnected) {
        channel.active = false;
        moving.delete(channel);
        mark(channel.owner);
        continue;
      }
      if (now < channel.start) continue;
      let resting = true;
      for (const key of Object.keys(channel.target)) {
        for (let step = 0; step < steps; step++) {
          channel.velocity[key] += (-model.stiffness * (channel.value[key] - channel.target[key])
            - model.damping * channel.velocity[key]) / model.mass * dt;
          channel.value[key] += channel.velocity[key] * dt;
        }
        const range = channel.range[key];
        if (Math.abs(channel.value[key] - channel.target[key]) > range * .0008
          || Math.abs(channel.velocity[key]) > range * .008) resting = false;
      }
      if (resting) {
        Object.assign(channel.value, channel.target);
        Object.keys(channel.velocity).forEach((key) => { channel.velocity[key] = 0; });
        complete(channel);
      } else channel.write({ ...channel.value });
    }
    frame = moving.size ? requestAnimationFrame(tick) : 0;
  };

  const spring = (owner, name, { from, to, write, complete: done, delay = 0, rebase = false }) => {
    let own = channels.get(owner);
    if (!own) { own = new Map(); channels.set(owner, own); }
    let channel = own.get(name);
    if (!channel) {
      channel = { owner, value: { ...from }, velocity: {}, range: {}, active: false };
      own.set(name, channel);
    } else if (rebase) Object.assign(channel.value, from);
    for (const key of Object.keys(to)) {
      if (!Number.isFinite(to[key]) || !Number.isFinite(channel.value[key])) {
        throw new Error(`Natural flow received a non-finite ${name}.${key}.`);
      }
      channel.velocity[key] ??= 0;
      channel.range[key] = Math.max(1, Math.abs(to[key] - channel.value[key]));
    }
    channel.target = { ...to };
    channel.write = write;
    channel.complete = done;
    channel.start = performance.now() + delay;
    channel.active = true;
    if (preference.matches) {
      Object.assign(channel.value, to);
      Object.keys(channel.velocity).forEach((key) => { channel.velocity[key] = 0; });
      complete(channel);
      return;
    }
    moving.add(channel);
    mark(owner);
    write({ ...channel.value });
    if (!frame) { previousTime = performance.now(); frame = requestAnimationFrame(tick); }
  };
  const value = (owner, name) => {
    const channel = channels.get(owner)?.get(name);
    return channel ? { ...channel.value } : null;
  };
  const cancel = (owner, name) => {
    const channel = channels.get(owner)?.get(name);
    if (!channel) return;
    channel.active = false;
    moving.delete(channel);
    channels.get(owner).delete(name);
    mark(owner);
  };
  const finish = () => {
    for (const channel of [...moving]) {
      Object.assign(channel.value, channel.target);
      Object.keys(channel.velocity).forEach((key) => { channel.velocity[key] = 0; });
      complete(channel);
    }
  };

  const disclose = (element, open, animate = true, after = null) => {
    element.setAttribute('data-flow-disclosure', '');
    element.inert = !open;
    if (!animate) {
      cancel(element, 'disclosure');
      element.style.height = open ? 'auto' : '0px';
      element.style.opacity = open ? '1' : '0';
      after?.();
      return;
    }
    spring(element, 'disclosure', {
      from: { height: element.getBoundingClientRect().height, opacity: Number(getComputedStyle(element).opacity) },
      to: { height: open ? element.scrollHeight : 0, opacity: open ? 1 : 0 },
      write: ({ height, opacity }) => {
        element.style.height = `${Math.max(0, height)}px`;
        element.style.opacity = String(clamp(opacity));
      },
      complete: () => { element.style.height = open ? 'auto' : '0px'; after?.(); },
    });
  };
  const reveal = (element, { distance = model.travel, delay = 0 } = {}) => {
    spring(element, 'reveal', {
      from: { progress: 0 }, to: { progress: 1 }, delay,
      write: ({ progress }) => {
        element.style.opacity = String(clamp(progress));
        element.style.setProperty('--flow-enter-y', `${(1 - progress) * distance}px`);
        element.setAttribute('data-flow-enter', '');
      },
      complete: () => { element.style.opacity = ''; element.style.removeProperty('--flow-enter-y');
        element.removeAttribute('data-flow-enter'); cancel(element, 'reveal'); },
    });
  };

  const layout = (root, change, selector = ':scope > *') => {
    const elements = [...root.querySelectorAll(selector)];
    const before = new Map(elements.map((element) => [element, element.getBoundingClientRect()]));
    const result = change();
    for (const element of root.querySelectorAll(selector)) {
      const old = before.get(element);
      if (!old || !old.width || !old.height) continue;
      element.removeAttribute('data-flow-layout');
      const next = element.getBoundingClientRect();
      if (!next.width || !next.height) continue;
      const from = { x: old.left - next.left, y: old.top - next.top,
        sx: old.width / next.width, sy: old.height / next.height };
      if (Math.abs(from.x) < .5 && Math.abs(from.y) < .5
        && Math.abs(from.sx - 1) < .001 && Math.abs(from.sy - 1) < .001) continue;
      element.setAttribute('data-flow-layout', '');
      spring(element, 'layout', { from, to: { x: 0, y: 0, sx: 1, sy: 1 }, rebase: true,
        write: ({ x, y, sx, sy }) => {
          element.style.setProperty('--flow-layout-x', `${x}px`); element.style.setProperty('--flow-layout-y', `${y}px`);
          element.style.setProperty('--flow-layout-sx', String(sx)); element.style.setProperty('--flow-layout-sy', String(sy));
        },
        complete: () => {
          element.removeAttribute('data-flow-layout');
          ['x', 'y', 'sx', 'sy'].forEach((key) => element.style.removeProperty(`--flow-layout-${key}`));
          cancel(element, 'layout');
        },
      });
    }
    return result;
  };
  const scroll = (element, left, top = element.scrollTop) => spring(element, 'scroll', {
    from: { left: element.scrollLeft, top: element.scrollTop }, to: { left, top },
    write: (next) => { element.scrollLeft = next.left; element.scrollTop = next.top; },
    complete: () => cancel(element, 'scroll'),
  });

  const retire = (element) => {
    queueMicrotask(() => {
      if (!element.classList.contains('hidden')) return;
      const parent = element.closest('.chart-panel');
      if (!parent || !parent.hasAttribute('data-flow-leaving') || element.closest('.chart-container.hidden')) {
        element.replaceChildren(); return;
      }
      element.setAttribute('data-flow-retain', '');
      panelStates.get(parent).retired.add(element);
    });
  };
  const panel = (element, open) => {
    let state = panelStates.get(element);
    if (!state) {
      state = { open: false, box: null, retired: new Set(), saved: null };
      panelStates.set(element, state);
      new ResizeObserver(() => {
        if (state.open && !element.closest('.hidden')) state.box = element.getBoundingClientRect();
      }).observe(element);
    }
    if (state.open === open) return;
    state.open = open;
    element.inert = !open;
    if (open) {
      for (const child of state.retired) {
        child.removeAttribute('data-flow-retain');
        if (child.classList.contains('hidden')) child.replaceChildren();
      }
      state.retired.clear();
      if (state.saved) Object.assign(element.style, state.saved);
      element.removeAttribute('data-flow-leaving'); element.classList.remove('hidden');
      state.box = element.getBoundingClientRect();
    } else {
      const box = state.box ?? element.getBoundingClientRect();
      state.saved ??= Object.fromEntries(['position', 'left', 'top', 'right', 'bottom', 'width', 'height', 'margin']
        .map((key) => [key, element.style[key]]));
      element.setAttribute('data-flow-leaving', '');
      Object.assign(element.style, { position: 'fixed', left: `${box.left}px`, top: `${box.top}px`,
        right: 'auto', bottom: 'auto', width: `${box.width}px`, height: `${box.height}px`, margin: '0' });
      element.classList.add('hidden');
    }
    spring(element, 'panel', {
      from: { progress: open ? 0 : 1 }, to: { progress: open ? 1 : 0 },
      write: ({ progress }) => {
        element.style.opacity = String(clamp(progress));
        element.style.setProperty('--flow-enter-y', `${(1 - progress) * model.travel}px`);
        element.setAttribute('data-flow-enter', '');
      },
      complete: () => {
        element.style.opacity = ''; element.style.removeProperty('--flow-enter-y'); element.removeAttribute('data-flow-enter');
        if (!open) {
          element.removeAttribute('data-flow-leaving'); Object.assign(element.style, state.saved); state.saved = null;
          for (const child of state.retired) { child.removeAttribute('data-flow-retain'); child.replaceChildren(); }
          state.retired.clear();
        }
      },
    });
  };

  // Semantic surfaces enter as one unit. Updating a reading does not replay a
  // chart's entrance, and focus/selection changes never trigger decorative motion.
  document.addEventListener('DOMContentLoaded', () => {
    const scenes = '#input-view, #chart-view, #today-view, #settings-view, #compare-view';
    const contents = '#context-detail, #pillar-detail, #luck-detail, #relationship-detail, '
      + '#today-detail, #today-scale, #today-pillars, #today-couple, #today-in-chart, #today-hours, '
      + '#settings-mine-body, #settings-couples-body, #settings-charts-body, #library-list, '
      + '#params-body, #legend-panel, #inspector-panel';
    const previous = new WeakMap();
    document.querySelectorAll(contents).forEach((element) => previous.set(element, element.innerHTML));
    const observer = new MutationObserver((records) => {
      const changed = new Set();
      for (const record of records) {
        const element = record.target;
        if (!(element instanceof Element)) continue;
        if (record.type === 'attributes' && element.matches(scenes)) {
          const wasHidden = (record.oldValue || '').split(/\s+/).includes('hidden');
          if (wasHidden && !element.classList.contains('hidden')) reveal(element);
        }
        if (record.type === 'childList') {
          const surface = element.closest(contents);
          if (surface) changed.add(surface);
        }
      }
      for (const element of changed) {
        const html = element.innerHTML;
        if (previous.get(element) === html) continue;
        previous.set(element, html);
        if (element.getClientRects().length && !element.closest('.hidden')) reveal(element, { distance: 8 });
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['class'], attributeOldValue: true });
  });

  // CSS-only feedback samples this same spring; spatial transitions use the live
  // integrator so a reversal preserves velocity instead of restarting an easing.
  let position = 0, velocity = 0;
  const samples = [0];
  do {
    velocity += (-model.stiffness * (position - 1) - model.damping * velocity) * .008;
    position += velocity * .008;
    samples.push(position);
  } while (Math.abs(position - 1) > .0008 || Math.abs(velocity) > .008);
  samples[samples.length - 1] = 1;
  const css = document.documentElement.style;
  css.setProperty('--flow-settle', `${(samples.length - 1) * 8}ms`);
  css.setProperty('--flow-spring', `linear(${samples.map((sample) => sample.toFixed(5)).join(',')})`);
  css.setProperty('--flow-feedback', `${model.feedback}ms`);
  preference.addEventListener('change', () => { if (preference.matches) finish(); });
  window.addEventListener('beforeprint', finish);
  window.EC_MOTION = Object.freeze({ model, spring, value, cancel, disclose, reveal, layout, scroll, panel, retire, finish,
    reduced: () => preference.matches, active: () => moving.size > 0 });
})();
