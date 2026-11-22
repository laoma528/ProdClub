const pageSize = 8;
const pageParameter = 'updates-page';

function publicationTime(card) {
  const date = Date.parse(card.querySelector('time[datetime]')?.dateTime ?? '');
  return Number.isFinite(date) ? date : -Infinity;
}

for (const list of document.querySelectorAll('.tutorial-entries')) {
  const cards = Array.from(list.children);
  cards.sort((left, right) => publicationTime(right) - publicationTime(left));
  list.append(...cards);

  const section = list.closest('#updates');
  const pagination = section?.querySelector('.tutorial-pagination');
  if (!pagination || cards.length <= pageSize) continue;

  const total = Math.ceil(cards.length / pageSize);
  const previous = pagination.querySelector('[data-previous]');
  const next = pagination.querySelector('[data-next]');
  const status = pagination.querySelector('[role="status"]');
  const title = section.querySelector('h2');

  function pageLink(number) {
    const url = new URL(location.href);
    if (number === 1) url.searchParams.delete(pageParameter);
    else url.searchParams.set(pageParameter, String(number));
    url.hash = section.id;
    return url;
  }

  function renderPage() {
    const raw = new URL(location.href).searchParams.get(pageParameter) ?? '';
    const current = /^\d+$/.test(raw) ? Math.min(total, Math.max(1, Number(raw))) : 1;
    const start = (current - 1) * pageSize;
    cards.forEach((card, index) => {
      card.hidden = index < start || index >= start + pageSize;
    });

    previous.hidden = current === 1;
    next.hidden = current === total;
    previous.href = pageLink(Math.max(1, current - 1));
    next.href = pageLink(Math.min(total, current + 1));
    status.textContent = `第 ${current} 页 / 共 ${total} 页`;
  }

  pagination.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.pushState(null, '', link.href);
    renderPage();
    section.scrollIntoView({ block: 'start', behavior: 'instant' });
    title.focus({ preventScroll: true });
  });

  window.addEventListener('popstate', renderPage);
  renderPage();
  pagination.hidden = false;
}
