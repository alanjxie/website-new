/* Shared folder-file view: Projects and Experience reuse links and attachments. */
(() => {
  const data = window.PortfolioData;
  const node = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  };
  const safeURL = value => {
    if (!value || !value.trim() || value.trim() === '#') return null;
    try {
      const url = new URL(value, location.href);
      return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  };
  function linksSection(links = []) {
    const section = node('section', 'detail-links');
    section.append(node('h3', '', 'Links'));
    const row = node('div', 'detail-link-row');
    for (const link of links) {
      const url = safeURL(link.url);
      if (!url) continue;
      const a = node('a', 'detail-link', link.label || url);
      a.href = url; row.append(a);
    }
    if (!row.children.length) {
      for (let i = 0; i < 2; i++) row.append(node('span', 'detail-placeholder', 'Link slot'));
    }
    section.append(row); return section;
  }
  function attachmentsSection(attachments = []) {
    const section = node('section', 'detail-attachments');
    section.append(node('h3', '', 'Attachments'));
    const row = node('div', 'detail-attachment-row');
    for (let i = 0; i < 3; i++) {
      const item = attachments[i] || {};
      const url = safeURL(item.url);
      const slot = node(url ? 'a' : 'div', `detail-attachment${url ? '' : ' is-empty'}`);
      if (url) slot.href = url;
      slot.append(node('span', '', item.title || `Attachment ${String(i + 1).padStart(2, '0')}`));
      slot.append(node('small', '', url ? item.type : 'Add file later'));
      row.append(slot);
    }
    section.append(row); return section;
  }
  function contentSection(entry) {
    const content = node('div', 'detail-content');
    if (entry.summary || entry.description) content.append(node('p', '', entry.summary || entry.description));
    for (const block of [entry.body || []].flat()) {
      if (typeof block === 'string') { content.append(node('p', '', block)); continue; }
      const url = safeURL(block.url);
      if (block.type === 'image' && url) {
        const image = node('img'); image.src = url; image.alt = block.alt || ''; content.append(image);
      } else if (block.type === 'video' && url) {
        const video = node('video'); video.src = url; video.controls = true; content.append(video);
      } else if (block.type === 'code') {
        const pre = node('pre'); pre.append(node('code', '', block.text)); content.append(pre);
      } else if (block.text) content.append(node('p', '', block.text));
    }
    return content;
  }
  function detailView(entry, kind, back) {
    const view = node('section', `portfolio-detail${entry.id === 'sdr' ? ' detail-sdr' : ''}`);
    const toolbar = node('div', 'detail-toolbar');
    const backButton = node('button', '', `← ${kind}`);
    backButton.type = 'button';
    backButton.addEventListener('click', event => {
      event.stopPropagation();
      back();
    });
    toolbar.append(backButton);
    view.addEventListener('click', event => event.stopPropagation());
    view.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      back();
    });
    const heading = node('h2', 'detail-title', entry.title || entry.organization);
    heading.tabIndex = -1;
    view.append(toolbar, heading, node('p', 'detail-category', entry.category || entry.role), contentSection(entry), linksSection(entry.links));
    if (entry.showAttachments !== false) view.append(attachmentsSection(entry.attachments));
    return { view, heading };
  }
  let active = null;
  const returnTransitions = new WeakMap();
  function openDetail(trigger, entry, kind) {
    if (active) active.restore(false);
    const panel = trigger.closest('.folder-panel');
    const folder = trigger.closest('.folder');
    returnTransitions.get(panel)?.();
    let view, dialog;
    let returning = false;
    let disposed = false;
    let exitAnimation;
    const children = panel ? [...panel.children] : [];
    const scrollTop = panel?.scrollTop || 0;
    const restore = (focus = true) => {
      disposed = true;
      exitAnimation?.cancel();
      view?.remove();
      if (dialog) { dialog.close(); dialog.remove(); }
      for (const child of children) child.hidden = false;
      if (panel) panel.scrollTop = scrollTop;
      folder?.removeEventListener('folderclose', onFolderClose);
      active = null;
      if (focus) trigger.focus({ preventScroll: true });
      // Keep the guard through DOM removal and focus restoration.
      if (panel) delete panel.dataset.detailOpen;
    };
    const onFolderClose = () => restore(false);
    // Back only removes the file view. Outside dismissal is owned by folder-nav.
    const back = () => {
      if (returning || disposed) return;
      if (!panel || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !view.animate) {
        restore();
        return;
      }
      returning = true;
      // Hold the outer folder at its current size, including after the list is
      // restored. Release this temporary size on folder close or the next detail.
      const previousHeight = panel.style.height;
      panel.style.height = `${panel.getBoundingClientRect().height}px`;
      const entranceAnimations = [];
      const release = () => {
        exitAnimation?.cancel();
        entranceAnimations.forEach(animation => animation.cancel());
        panel.style.height = previousHeight;
        folder?.removeEventListener('folderclose', release);
        returnTransitions.delete(panel);
      };
      returnTransitions.set(panel, release);
      folder?.addEventListener('folderclose', release);
      exitAnimation = view.animate([
        { opacity: 1, transform: 'translateX(0)' },
        { opacity: 0, transform: 'translateX(8px)' },
      ], { duration: 120, easing: 'ease-in', fill: 'forwards' });
      exitAnimation.finished.then(() => {
        if (disposed) return;
        restore();
        for (const child of children) {
          entranceAnimations.push(child.animate([
            { opacity: 0, transform: 'translateX(-6px)' },
            { opacity: 1, transform: 'translateX(0)' },
          ], { duration: 140, easing: 'ease-out' }));
        }
      }).catch(() => { /* Outside dismissal cancels the inner transition. */ });
    };
    const detail = detailView(entry, kind, back);
    view = detail.view;
    if (panel) {
      panel.dataset.detailOpen = 'true';
      for (const child of children) child.hidden = true;
      panel.append(view); panel.scrollTop = 0;
      folder.addEventListener('folderclose', onFolderClose);
    } else {
      dialog = node('dialog', 'standalone-detail');
      dialog.setAttribute('aria-label', entry.title || entry.organization);
      dialog.append(view); document.body.append(dialog);
      dialog.addEventListener('cancel', event => { event.preventDefault(); back(); });
      dialog.addEventListener('click', event => { if (event.target === dialog) restore(); });
      dialog.showModal();
    }
    active = { restore };
    detail.heading.focus({ preventScroll: true });
  }
  document.querySelectorAll('[data-project-detail], [data-experience-detail]').forEach(trigger => {
    const project = trigger.dataset.projectDetail;
    const entry = project ? data.projects.find(p => p.id === project) : data.experiences.find(e => e.id === trigger.dataset.experienceDetail);
    if (!entry) return;
    trigger.tabIndex = 0;
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('aria-label', `Open ${entry.title || entry.organization} details`);
    trigger.classList.add('detail-trigger');
    trigger.addEventListener('click', event => {
      if (event.target.closest('a, button')) return;
      openDetail(trigger, entry, project ? 'Projects' : 'Experience');
    });
    trigger.addEventListener('keydown', event => {
      if (event.target !== trigger || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); openDetail(trigger, entry, project ? 'Projects' : 'Experience');
    });
  });
})();
