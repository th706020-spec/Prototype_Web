(function () {
  const wrappers = document.querySelectorAll('[data-select]');
  if (!wrappers.length) {
    return;
  }

  wrappers.forEach((wrapper) => {
    const trigger = wrapper.querySelector('[data-select-trigger]');
    const label = wrapper.querySelector('[data-select-label]');
    const menu = wrapper.querySelector('[data-select-menu]');
    const select = wrapper.querySelector('select');
    if (!trigger || !label || !menu || !select) {
      return;
    }

    const syncLabel = () => {
      const option = select.options[select.selectedIndex];
      label.textContent = option ? option.textContent : '';
    };

    const close = () => {
      wrapper.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    };

    trigger.addEventListener('click', () => {
      wrapper.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', wrapper.classList.contains('is-open'));
    });

    menu.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const option = target ? target.closest('[data-value]') : null;
      if (!option) {
        return;
      }
      select.value = option.dataset.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      syncLabel();
      close();
    });

    document.addEventListener('click', (event) => {
      if (!wrapper.contains(event.target)) {
        close();
      }
    });

    syncLabel();
  });
})();
