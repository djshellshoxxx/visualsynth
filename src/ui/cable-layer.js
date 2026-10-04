const SVG_NS = 'http://www.w3.org/2000/svg';

function centerInRoot(element, rootRect) {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left - rootRect.left + rect.width / 2,
    y: rect.top - rootRect.top + rect.height / 2
  };
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
      const bend = Math.max(40, Math.abs(end.x - start.x) * 0.45);

      const path = document.createElementNS(SVG_NS, 'path');
      path.dataset.connectionId = connection.id;
      path.setAttribute('d', `M ${start.x} ${start.y} C ${start.x + bend} ${start.y}, ${end.x - bend} ${end.y}, ${end.x} ${end.y}`);
      path.setAttribute('tabindex', '0');
      path.setAttribute('role', 'button');
      path.setAttribute('aria-label', `Disconnect ${connection.from.moduleId} ${connection.from.portId} from ${connection.to.moduleId} ${connection.to.portId}`);
      path.addEventListener('click', event => {
        event.stopPropagation();
        this.onRemove(connection.id);
      });
      path.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault();
          this.onRemove(connection.id);
        }
      });
      this.svg.append(path);
    }
  }
}
