const SVG_NS = 'http://www.w3.org/2000/svg';

function centerInRoot(element, rootRect) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left - rootRect.left + rect.width / 2, y: rect.top - rootRect.top + rect.height / 2 };
}

function endpointLabel(element, endpoint, direction) {
  const card = element.closest('[data-module-id]');
  const title = card?.querySelector('.module-card-header strong')?.textContent?.trim() || endpoint.moduleId;
  const signal = String(element.dataset.signalType ?? 'signal').toUpperCase();
  return `${direction} ${title}.${endpoint.portId} • ${signal}`;
}

export class CableLayer {
  constructor(root, { onRemove = () => {} } = {}) {
    this.root = root;
    this.onRemove = onRemove;
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.id = 'cable-layer';
    this.svg.classList.add('cable-layer');
    this.svg.setAttribute('aria-label', 'Patch cables');
    this.root.append(this.svg);
  }

  render(connections = []) {
    this.svg.replaceChildren();
    const rootRect = this.root.getBoundingClientRect();

    for (const connection of connections) {
      const from = this.root.querySelector(`[data-module-id="${CSS.escape(connection.from.moduleId)}"] [data-port-id="${CSS.escape(connection.from.portId)}"]`);
      const to = this.root.querySelector(`[data-module-id="${CSS.escape(connection.to.moduleId)}"] [data-port-id="${CSS.escape(connection.to.portId)}"]`);
      if (!from || !to) continue;

      const start = centerInRoot(from, rootRect);
      const end = centerInRoot(to, rootRect);
      const delta = end.x - start.x;
      const direction = delta >= 0 ? 1 : -1;
      const bend = Math.max(52, Math.abs(delta) * 0.38);
      const pathId = `cable-path-${String(connection.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
      const d = `M ${start.x} ${start.y} C ${start.x + direction * bend} ${start.y}, ${end.x - direction * bend} ${end.y}, ${end.x} ${end.y}`;

      const group = document.createElementNS(SVG_NS, 'g');
      group.classList.add('cable-connection');
      group.dataset.connectionGroupId = connection.id;

      const path = document.createElementNS(SVG_NS, 'path');
      path.id = pathId;
      path.dataset.connectionId = connection.id;
      path.setAttribute('d', d);
      path.setAttribute('tabindex', '0');
      path.setAttribute('role', 'button');
      const description = `Signal cable from ${connection.from.moduleId} ${connection.from.portId} to ${connection.to.moduleId} ${connection.to.portId}. Click or press Delete to disconnect.`;
      path.setAttribute('aria-label', `Disconnect ${connection.from.moduleId} ${connection.from.portId} from ${connection.to.moduleId} ${connection.to.portId}`);
      path.setAttribute('aria-description', description);
      const title = document.createElementNS(SVG_NS, 'title');
      title.textContent = description;
      path.append(title);
      path.addEventListener('click', event => { event.stopPropagation(); this.onRemove(connection.id); });
      path.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault();
          this.onRemove(connection.id);
        }
      });
      group.append(path);

      const addLabel = (className, textValue, offset) => {
        const text = document.createElementNS(SVG_NS, 'text');
        text.classList.add('cable-label', className);
        text.setAttribute('dy', '-7');
        text.setAttribute('style', 'font:600 10px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#bfeaff;paint-order:stroke;stroke:#071019;stroke-width:3px;stroke-linejoin:round;pointer-events:none');
        const textPath = document.createElementNS(SVG_NS, 'textPath');
        textPath.setAttribute('href', `#${pathId}`);
        textPath.setAttribute('startOffset', offset);
        textPath.textContent = textValue;
        text.append(textPath);
        group.append(text);
      };

      addLabel('cable-label-source', endpointLabel(from, connection.from, 'OUT'), '8%');
      addLabel('cable-label-destination', endpointLabel(to, connection.to, 'IN'), '58%');
      this.svg.append(group);
    }
  }
}
