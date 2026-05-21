export function setupDropdown({ root, button, menu, onSelect, defaultValue }) {
  if (!root || !button || !menu) {
    return;
  }
  const close = () => root.classList.remove('is-open');

  button.addEventListener('click', (event) => {
    event.preventDefault();
    root.classList.toggle('is-open');
  });

  menu.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const item = target ? target.closest('[data-value]') : null;
    if (!item) {
      return;
    }
    const value = item.dataset.value;
    const label = item.textContent.trim();
    button.textContent = label;
    button.dataset.value = value;
    close();
    if (onSelect) {
      onSelect(value, label);
    }
  });

  document.addEventListener('click', (event) => {
    if (!root.contains(event.target)) {
      close();
    }
  });

  if (defaultValue) {
    const match = menu.querySelector(`[data-value="${defaultValue}"]`);
    if (match) {
      match.click();
    }
  }
}

export function bindFileLabel(input, label, emptyText = 'No file selected') {
  const update = () => {
    const fileName = input.files?.[0]?.name || emptyText;
    label.textContent = fileName;
  };
  input.addEventListener('change', update);
  update();
}
