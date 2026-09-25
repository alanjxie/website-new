/* Add entries here. Optional: dates, location, tags, bullets, links [{label, href}]. */
(() => {
  const experiences = window.PortfolioData.experiences;
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  function renderExperience(entry) {
    const card = element('article', 'experience-card');
    if (entry.id === 'gtri') card.dataset.experienceDetail = entry.id;
    card.append(element('h3', 'experience-title', entry.organization), element('p', 'experience-role', entry.role));
    if (entry.dates || entry.location) card.append(element('p', 'experience-meta', [entry.dates, entry.location].filter(Boolean).join(' · ')));
    for (const line of [entry.description].flat().filter(Boolean)) card.append(element('p', '', line));
    if (entry.bullets?.length) {
      const list = element('ul');
      entry.bullets.forEach(text => list.append(element('li', '', text)));
      card.append(list);
    }
    if (entry.tags?.length) {
      const tags = element('ul', 'experience-tags');
      entry.tags.forEach(text => tags.append(element('li', '', text)));
      card.append(tags);
    }
    if (entry.links?.length) {
      const links = element('div', 'experience-links');
      entry.links.forEach(link => {
        const href = link.url || link.href;
        if (!href || !/^(https?:\/\/|mailto:|\.\/|\/|#)/i.test(href)) return;
        const anchor = element('a', '', link.label);
        anchor.href = href;
        links.append(anchor);
      });
      card.append(links);
    }
    return card;
  }
  document.querySelectorAll('.experience-list').forEach(list => list.replaceChildren(...experiences.map(renderExperience)));
})();
