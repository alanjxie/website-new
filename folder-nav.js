/* Accessible disclosure navigation: one connected folder open at a time. */
(() => {
  document.querySelectorAll('.folder-nav').forEach((nav) => {
    const folders = [...nav.querySelectorAll('.folder')];
    const setOpen = (folder, open) => {
      if (!open) folder.dispatchEvent(new Event('folderclose'));
      folder.classList.toggle('is-open', open);
      folder.querySelector('button').setAttribute('aria-expanded', String(open));
      folder.querySelector('.folder-panel').inert = !open;
    };
    const hasDetail = () => folders.some(folder => folder.querySelector('.folder-panel').dataset.detailOpen === 'true');
    const closeAll = () => folders.forEach(folder => setOpen(folder, false));
    folders.forEach(folder => {
      const panel = folder.querySelector('.folder-panel');
      panel.addEventListener('click', event => event.stopPropagation());
      folder.querySelector('button').addEventListener('click', () => {
        // Folder tabs lie outside a detail panel: dismiss, rather than navigate away.
        if (hasDetail()) { closeAll(); return; }
        const opening = !folder.classList.contains('is-open');
        closeAll();
        setOpen(folder, opening);
      });
      folder.querySelector('.folder-close').addEventListener('click', () => {
        closeAll();
        folder.querySelector('.folder-tab').focus();
      });
      folder.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
        closeAll();
        if (link.hash && link.pathname === location.pathname) {
          const target = document.getElementById(link.hash.slice(1));
          if (target) {
            target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
          }
        }
      }));
    });
    document.addEventListener('click', event => {
      // Use the original event path even if a Back action removed its target.
      const path = event.composedPath();
      if (folders.some(folder => path.includes(folder.querySelector('.folder-panel')))) return;
      if (hasDetail() || !path.includes(nav)) closeAll();
    });
    nav.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || hasDetail()) return;
      const open = folders.find(folder => folder.classList.contains('is-open'));
      if (open) {
        event.preventDefault();
        closeAll();
        open.querySelector('button').focus();
      }
    });
    nav.addEventListener('focusout', event => {
      if (!hasDetail() && !nav.contains(event.relatedTarget)) closeAll();
    });
  });
})();
