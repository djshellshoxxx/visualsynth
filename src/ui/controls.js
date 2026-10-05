import { parameterHelp } from '../help/guidance.js';

function formatValue(definition, value) {
  if (definition.curve === 'choice') return definition.choices?.[Math.round(value)] ?? String(value);
  if (definition.curve === 'integer') return String(Math.round(value));
  const magnitude = Math.abs(value);
  const text = magnitude >= 100 ? value.toFixed(0) : magnitude >= 10 ? value.toFixed(1) : value.toFixed(2);
  return definition.unit ? `${text} ${definition.unit}` : text;
}

export function createRangeControl({ definition, value, onInput = () => {}, onCommit = () => {} }) {
  const wrapper = document.createElement('label');
  wrapper.className = 'parameter-control';
  wrapper.dataset.parameterId = definition.id;
  const help = parameterHelp(definition);
  wrapper.title = help;
  wrapper.setAttribute('aria-description', help);

  const heading = document.createElement('span');
  heading.className = 'parameter-heading';
  const label = document.createElement('span');
  label.textContent = definition.label ?? definition.id;
  const output = document.createElement('output');
  const current = Number(value ?? definition.defaultValue ?? 0);
  output.value = formatValue(definition, current);
  output.textContent = output.value;
  heading.append(label, output);

  let input;
  if (definition.curve === 'choice' && definition.choices?.length) {
    input = document.createElement('select');
    definition.choices.forEach((choice, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = choice;
      input.append(option);
    });
    input.value = String(Math.round(current));
  } else {
    input = document.createElement('input');
    input.type = 'range';
    input.min = String(definition.min ?? 0);
    input.max = String(definition.max ?? 1);
    input.step = definition.curve === 'integer' ? '1' : 'any';
    input.value = String(current);
  }
  input.setAttribute('aria-label', definition.label ?? definition.id);
  input.setAttribute('aria-description', help);
  input.title = help;
  input.addEventListener('input', () => {
    const next = Number(input.value);
    output.value = formatValue(definition, next);
    output.textContent = output.value;
    onInput(next);
  });
  input.addEventListener('change', () => onCommit(Number(input.value)));
  wrapper.append(heading, input);
  return wrapper;
}

export function createParameterBank(instance, definition, handlers = {}) {
  const bank = document.createElement('div');
  bank.className = 'parameter-bank';
  for (const parameter of definition.parameters ?? []) {
    bank.append(createRangeControl({
      definition: parameter,
      value: instance.parameters?.[parameter.id] ?? parameter.defaultValue,
      onInput: value => handlers.onParameterPreview?.(instance.id, parameter.id, value),
      onCommit: value => handlers.onParameter?.(instance.id, parameter.id, value)
    }));
  }
  return bank;
}
