// Lab5 first-person, proximity-based annotation system for PlayCanvas 2.23.3.
// Spherical collision-only entities are trigger volumes, never solid obstacles.
export function createWorldAnnotations({ pc, state, canvas, el, hitAhead, report, download }) {
  const zones = new Map();
  const markers = new Map();
  const overlaps = new Set();
  const point = new pc.Vec3();
  let candidate = null;
  let opened = null;
  let previousPadDown = false;
  let physicsEnterCount = 0;

  const normalize = (item, index) => ({
    id: String(item.id || 'note-' + index),
    position: item.position.map(Number),
    title: String(item.title || 'Annotation ' + (index + 1)),
    text: String(item.text || ''),
    radius: Math.max(0.75, Math.min(30, Number(item.radius) || 3)),
    mode: item.mode === 'interact' ? 'interact' : 'auto'
  });

  function close() {
    opened = null;
    el('tooltip').hidden = true;
  }

  function toggle() {
    if (!el('panel').hidden || !candidate) return;
    if (opened === candidate.id) return close();
    opened = candidate.id;
    el('tooltip-title').textContent = candidate.title;
    el('tooltip-text').textContent = candidate.text;
    el('tooltip').hidden = false;
  }

  function destroyZones() {
    for (const zone of zones.values()) zone.destroy();
    zones.clear();
    overlaps.clear();
    candidate = null;
    close();
  }

  function rebuild() {
    destroyZones();
    if (!state.app) return;
    for (const note of state.annotations) {
      const zone = new pc.Entity('LAB5_TRIGGER_' + note.id);
      zone.setPosition(...note.position);
      // Collision only, NO rigidbody: creates a nonblocking physics trigger.
      zone.addComponent('collision', { type: 'sphere', radius: note.radius });
      state.app.root.addChild(zone);
      zone.collision.on('triggerenter', body => {
        if (body === state.player) {
          overlaps.add(note.id);
          physicsEnterCount++;
        }
      });
      zone.collision.on('triggerleave', body => {
        if (body === state.player) overlaps.delete(note.id);
      });
      zones.set(note.id, zone);
    }
  }

  function markerFor(note, index) {
    let marker = markers.get(note.id);
    if (!marker) {
      marker = document.createElement('div');
      marker.className = 'hotspot';
      marker.setAttribute('aria-hidden', 'true');
      el('hotspots').appendChild(marker);
      markers.set(note.id, marker);
    }
    marker.textContent = String(index + 1);
    marker.classList.toggle('near', candidate?.id === note.id);
    return marker;
  }

  function findNearest() {
    if (!state.player) return null;
    const pos = state.player.getPosition();
    let result = null;
    let nearestDistance = Infinity;
    for (const note of state.annotations) {
      // Distance fallback also handles a player already inside at scene startup,
      // missed physics ticks and teleports, without depending on mouse clicks.
      const distance = Math.hypot(
        pos.x - note.position[0],
        pos.y - note.position[1],
        pos.z - note.position[2]
      );
      if (distance <= note.radius + 0.2 && distance < nearestDistance) {
        result = note;
        nearestDistance = distance;
      }
    }
    return result;
  }

  function drawMarkers() {
    if (!state.camera || !state.app) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const gw = Math.max(1, state.app.graphicsDevice.width);
    const gh = Math.max(1, state.app.graphicsDevice.height);
    const eye = state.camera.getPosition();
    const forward = state.camera.forward;
    const seen = new Set();

    state.annotations.forEach((note, index) => {
      const marker = markerFor(note, index);
      point.set(...note.position);
      const delta = point.clone().sub(eye);
      const s = state.camera.camera.worldToScreen(point);
      const x = s.x * width / gw;
      const y = s.y * height / gh;
      const visible = delta.dot(forward) > 0.05 &&
        Number.isFinite(x) && Number.isFinite(y) &&
        x > 18 && x < width - 18 && y > 18 && y < height - 18;
      marker.hidden = !visible;
      if (visible) {
        marker.style.left = x + 'px';
        marker.style.top = y + 'px';
      }
      if (opened === note.id) {
        const card = el('tooltip');
        card.hidden = !visible;
        if (visible) {
          card.style.left = Math.max(145, Math.min(width - 145, x)) + 'px';
          card.style.top = Math.max(68, Math.min(height - 190, y - 90)) + 'px';
        }
      }
      seen.add(note.id);
    });
    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }
  }

  function update() {
    if (!state.player) return;
    // Hide in-world controls while the authoring/settings panel is open.
    if (!el('panel').hidden) {
      el('interaction-prompt').hidden = true;
      el('interact-btn').hidden = true;
      drawMarkers();
      return;
    }

    const next = findNearest();
    const changed = next?.id !== candidate?.id;
    candidate = next;
    const prompt = el('interaction-prompt');
    const touch = el('interact-btn');
    if (next) {
      prompt.textContent = next.title + ' · [E] ' + (opened === next.id ? 'Close' : 'Inspect');
      prompt.hidden = false;
      touch.hidden = false;
      if (changed) {
        close();
        if (next.mode === 'auto') toggle();
      }
    } else {
      prompt.hidden = true;
      touch.hidden = true;
      if (opened) close();
    }

    // Xbox X button; controller A can remain assigned to jumping.
    const pad = navigator.getGamepads?.()?.[0];
    const down = !!pad?.buttons?.[2]?.pressed;
    if (down && !previousPadDown) toggle();
    previousPadDown = down;
    drawMarkers();
  }

  function list() {
    const listElement = el('notes-list');
    listElement.replaceChildren();
    for (const [index, note] of state.annotations.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = state.selected === note.id ? 'active' : '';
      button.textContent = (index + 1) + '. ' + note.title + ' · ' +
        note.radius.toFixed(1) + 'm · ' + note.mode;
      button.onclick = () => select(note.id);
      listElement.appendChild(button);
    }
  }

  function select(id) {
    const note = state.annotations.find(item => item.id === id);
    if (!note) return;
    state.selected = id;
    el('note-editor').hidden = false;
    el('note-title').value = note.title;
    el('note-text').value = note.text;
    el('note-radius').value = note.radius;
    el('note-mode').value = note.mode;
    list();
  }

  async function load(config) {
    try {
      const response = await fetch(config.annotationsUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Annotations must be a JSON array');
      state.annotations = data.filter(item => item && Array.isArray(item.position) &&
        item.position.length === 3 && item.position.every(n => Number.isFinite(Number(n))))
        .map(normalize);
    } catch (error) {
      console.warn('[Lab5] Annotation file unavailable:', error);
      state.annotations = [];
    }
    list();
    rebuild();
  }

  el('place-note').onclick = () => {
    if (!state.camera) return;
    const hit = hitAhead(25);
    const p = hit?.point || state.camera.getPosition().clone()
      .add(state.camera.forward.clone().mulScalar(3));
    const note = {
      id: 'note-' + Date.now(),
      position: [p.x, p.y, p.z],
      title: 'New annotation',
      text: 'Describe this 3D location.',
      radius: 3,
      mode: 'auto'
    };
    state.annotations.push(note);
    rebuild();
    select(note.id);
    report('3D trigger created. Set its radius, then export annotations.json.', 'ok');
  };

  el('save-note').onclick = () => {
    const note = state.annotations.find(item => item.id === state.selected);
    if (!note) return;
    note.title = el('note-title').value.trim() || 'Untitled annotation';
    note.text = el('note-text').value;
    note.radius = Math.max(0.75, Math.min(30, Number(el('note-radius').value) || 3));
    note.mode = el('note-mode').value === 'interact' ? 'interact' : 'auto';
    rebuild();
    list();
    report('Annotation trigger updated. Export JSON to publish changes.', 'ok');
  };

  el('delete-note').onclick = () => {
    state.annotations = state.annotations.filter(note => note.id !== state.selected);
    state.selected = null;
    el('note-editor').hidden = true;
    rebuild();
    list();
  };
  el('export-notes').onclick = () =>
    download('annotations.json', JSON.stringify(state.annotations, null, 2) + '\n');

  window.addEventListener('keydown', event => {
    if (event.repeat || !['KeyE', 'KeyF'].includes(event.code) || !el('panel').hidden) return;
    if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if (candidate) {
      event.preventDefault();
      toggle();
    }
  });

  el('interact-btn').onclick = toggle;
  el('tooltip-close').onclick = close;
  window.addEventListener('blur', () => { previousPadDown = false; });

  return {
    load, update, rebuild,
    diagnostics: () => ({
      zones: zones.size,
      overlappingPhysicsTriggers: overlaps.size,
      triggerEnterEvents: physicsEnterCount,
      nearest: candidate?.id || null,
      open: opened
    })
  };
}
