/* Accessible disclosure navigation: one connected folder open at a time. */
(() => {
  document.querySelectorAll('.folder-nav').forEach((nav) => {
    const folders = [...nav.querySelectorAll('.folder')];
    const setOpen = (folder, open) => {
      folder.classList.toggle('is-open', open);
      folder.querySelector('button').setAttribute('aria-expanded', String(open));
      folder.querySelector('.folder-panel').inert = !open;
    };
    const closeAll = () => folders.forEach(folder => setOpen(folder, false));
    folders.forEach(folder => {
      folder.querySelector('button').addEventListener('click', () => {
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
      if (!nav.contains(event.target)) closeAll();
    });
    nav.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const open = folders.find(folder => folder.classList.contains('is-open'));
      if (open) {
        event.preventDefault();
        closeAll();
        open.querySelector('button').focus();
      }
    });
    nav.addEventListener('focusout', event => {
      if (!nav.contains(event.relatedTarget)) closeAll();
    });
  });
})();
