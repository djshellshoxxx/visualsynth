export function createRangeControl({ definition, value, onInput = () => {}, onCommit = () => {} }) {
  const wrapper = document.createElement('label');
  wrapper.className = 'parameter-control';
  const label = document.createElement('span');
  label.textContent = definition.label ?? definition.id;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(definition.min ?? 0);
  input.max = String(definition.max ?? 1);
  input.step = definition.curve === 'integer' || definition.curve === 'choice' ? '1' : 'any';
  input.value = String(value ?? definition.defaultValue ?? 0);
  input.setAttribute('aria-label', definition.label ?? definition.id);
  input.addEventListener('input', () => onInput(Number(input.value)));
  input.addEventListener('change', () => onCommit(Number(input.value)));
  wrapper.append(label, input);
  return wrapper;
}
