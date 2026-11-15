/* Local navigation, motion, and reading aids. No account or order data is collected. */
(() => {
  'use strict';

  const header = document.querySelector('.site-header');
  const menu = document.querySelector('.menu');
  const navigation = document.getElementById('navigation');
  const readingProgress = document.querySelector('.reading-progress');
  const sectionRail = document.querySelector('.section-rail');
  const workflowNav = document.querySelector('.workflow-nav');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const menuScreen = window.matchMedia('(max-width: 1024px)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const revealNodes = [...document.querySelectorAll('[data-reveal]')];

  function closeMenu() {
    menu?.setAttribute('aria-expanded', 'false');
    menu?.setAttribute('aria-label', '打开菜单');
    navigation?.classList.remove('open');
  }

  menu?.addEventListener('click', () => {
    if (!navigation) return;
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
    navigation.classList.toggle('open', open);
    if (open) {
      window.requestAnimationFrame(() => {
        if (menu.getAttribute('aria-expanded') !== 'true') return;
        [...navigation.querySelectorAll('a')].find(link => link.getClientRects().length)?.focus();
      });
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menu.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || !event.target.closest('.site-header')) closeMenu();
  });
  navigation?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  menuScreen.addEventListener('change', closeMenu);

  function trackedLinks(selector) {
    return [...document.querySelectorAll(selector)].map(link => {
      const href = link.getAttribute('href');
      if (!href?.startsWith('#') || href.length < 2) return null;
      let target;
      try {
        target = document.getElementById(decodeURIComponent(href.slice(1)));
      } catch {
        return null;
      }
      return target ? { link, target } : null;
    }).filter(Boolean);
  }

  const sectionLinks = trackedLinks('.section-rail a');
  const workflowLinks = trackedLinks('.workflow-nav a');

  function highlight(items, useCurrent, track, property) {
    if (!items.length) return;
    const marker = Math.min(window.innerHeight * 0.4, 320);
    let selectedIndex = 0;
    for (let index = 0; index < items.length; index += 1) {
      if (items[index].target.getBoundingClientRect().top <= marker) selectedIndex = index;
      else break;
    }
    items.forEach((item, index) => {
      const active = index === selectedIndex;
      item.link.classList.toggle('is-active', active);
      if (useCurrent) {
        if (active) item.link.setAttribute('aria-current', 'location');
        else item.link.removeAttribute('aria-current');
      }
    });
    track?.style.setProperty(property, String(items.length > 1 ? selectedIndex / (items.length - 1) : 0));
  }

  function revealWithinViewport() {
    revealNodes.forEach(node => {
      if (!node.classList.contains('is-revealed') && node.getBoundingClientRect().top < window.innerHeight * 0.98) {
        node.classList.add('is-revealed');
      }
    });
  }

  let framePending = false;
  function updateScrollState() {
    framePending = false;
    const y = Math.max(0, window.scrollY);
    header?.classList.toggle('is-scrolled', y > 24);
    if (readingProgress) {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      readingProgress.style.setProperty('--reading-progress', String(total > 0 ? Math.min(1, y / total) : 0));
    }
    highlight(sectionLinks, true, sectionRail, '--rail-progress');
    highlight(workflowLinks, false, workflowNav, '--workflow-progress');
    revealWithinViewport();
  }

  function queueScrollUpdate() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(updateScrollState);
  }

  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(queueScrollUpdate, {
      rootMargin: '-20% 0px -45% 0px',
      threshold: [0, 0.25, 0.5, 1]
    });
    new Set([...sectionLinks, ...workflowLinks].map(item => item.target))
      .forEach(target => sectionObserver.observe(target));
  }
  window.addEventListener('scroll', queueScrollUpdate, { passive: true });
  window.addEventListener('resize', queueScrollUpdate, { passive: true });
  window.addEventListener('load', queueScrollUpdate, { once: true });
  window.addEventListener('pageshow', queueScrollUpdate);
  document.fonts?.ready.then(queueScrollUpdate);
  updateScrollState();

  /* Existing viewport content stays visible if this deferred script arrives late. */
  if (revealNodes.length && 'IntersectionObserver' in window && !reducedMotion.matches) {
    try {
      const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      revealNodes.forEach(node => {
        if (!node.classList.contains('is-revealed')) revealObserver.observe(node);
      });
      document.documentElement.classList.add('motion-ready');
    } catch {
      revealNodes.forEach(node => node.classList.add('is-revealed'));
    }
  }
  document.addEventListener('focusin', event => {
    if (event.target instanceof Element) event.target.closest('[data-reveal]')?.classList.add('is-revealed');
  });

  const copyButton = document.getElementById('copy-coupon');
  const copyStatus = document.getElementById('copy-status');
  let copying = false;
  function setCopyStatus(message, success) {
    if (copyStatus) {
      copyStatus.textContent = message;
      copyStatus.dataset.state = success ? 'success' : 'error';
    }
    if (copyButton) {
      copyButton.innerHTML = success
        ? '已复制 NJJU47 <span aria-hidden="true">✓</span>'
        : '复制优惠码 <span aria-hidden="true">↗</span>';
    }
  }
  copyButton?.addEventListener('click', async () => {
    if (copying || copyButton.disabled || copyButton.getAttribute('aria-disabled') === 'true') return;
    if (copyStatus) copyStatus.textContent = '';
    if (!navigator.clipboard?.writeText) {
      setCopyStatus('请手动复制优惠码 NJJU47。', false);
      return;
    }
    copying = true;
    try {
      await navigator.clipboard.writeText('NJJU47');
      setCopyStatus('已复制优惠码 NJJU47，下单前请核对订单中的优惠码与实付金额。', true);
    } catch {
      setCopyStatus('未能复制，请手动复制优惠码 NJJU47。', false);
    } finally {
      copying = false;
    }
  });

  document.querySelectorAll('.back-to-top').forEach(button => {
    button.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
      document.querySelector('.site-header .brand')?.focus({ preventScroll: true });
    });
  });

  const faqControllers = new WeakMap();
  const activeFaqStates = new Set();

  function stopFaqAnimation(state) {
    if (state.resizeFrame !== null) window.cancelAnimationFrame(state.resizeFrame);
    state.resizeFrame = null;
    if (state.animation) {
      state.animation.onfinish = null;
      state.animation.oncancel = null;
      state.animation.cancel();
      state.animation = null;
    }
    activeFaqStates.delete(state);
  }

  function finishFaqState(state, open) {
    stopFaqAnimation(state);
    state.targetOpen = open;
    state.item.open = open;
    state.item.style.height = state.originalHeight;
    state.item.classList.remove('is-faq-animating', 'is-faq-closing');
    queueScrollUpdate();
  }

  function closedFaqHeight(state) {
    const style = window.getComputedStyle(state.item);
    return state.summary.getBoundingClientRect().height +
      (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0) +
      (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
  }

  function animateFaqState(state) {
    const item = state.item;
    // Read the rendered frame before cancelling so rapid reversals do not jump.
    const startHeight = item.getBoundingClientRect().height;
    stopFaqAnimation(state);
    if (reducedMotion.matches || typeof item.animate !== 'function') {
      finishFaqState(state, state.targetOpen);
      return;
    }

    item.open = true;
    item.classList.remove('is-faq-closing');
    item.style.height = 'auto';
    const expandedHeight = item.getBoundingClientRect().height;
    const collapsedHeight = closedFaqHeight(state);
    const endHeight = state.targetOpen ? expandedHeight : collapsedHeight;
    if (Math.abs(endHeight - startHeight) < 0.75) {
      finishFaqState(state, state.targetOpen);
      return;
    }

    item.style.height = `${startHeight}px`;
    item.classList.add('is-faq-animating');
    item.classList.toggle('is-faq-closing', !state.targetOpen);
    const fullDistance = Math.max(1, expandedHeight - collapsedHeight);
    const remaining = Math.min(1, Math.max(0.4, Math.abs(endHeight - startHeight) / fullDistance));
    try {
      const animation = item.animate([
        { height: `${startHeight}px` },
        { height: `${endHeight}px` }
      ], { duration: 360 * remaining, easing: 'cubic-bezier(.22,.8,.28,1)', fill: 'both' });
      state.animation = animation;
      activeFaqStates.add(state);
      animation.onfinish = () => {
        if (state.animation === animation) finishFaqState(state, state.targetOpen);
      };
    } catch {
      finishFaqState(state, state.targetOpen);
    }
  }

  function setFaqOpen(item, open, animate = true) {
    const state = faqControllers.get(item);
    if (!state) {
      item.open = open;
      return;
    }
    if (open) {
      state.siblings.forEach(other => {
        if (other === item) return;
        const otherState = faqControllers.get(other);
        if (other.open || otherState?.targetOpen) setFaqOpen(other, false, animate);
      });
    }
    if (!animate || reducedMotion.matches || typeof item.animate !== 'function') {
      finishFaqState(state, open);
      return;
    }
    if (state.targetOpen === open && state.animation) return;
    state.targetOpen = open;
    if (!state.animation && item.open === open) return;
    animateFaqState(state);
  }

  function retargetFaq(state) {
    if (!state.animation || state.resizeFrame !== null) return;
    state.resizeFrame = window.requestAnimationFrame(() => {
      state.resizeFrame = null;
      if (state.animation) animateFaqState(state);
    });
  }

  document.querySelectorAll('.faq').forEach(group => {
    const items = [...group.querySelectorAll('details')].filter(item => item.closest('.faq') === group);
    items.forEach(item => {
      const summary = [...item.children].find(child => child.tagName === 'SUMMARY');
      if (!summary) return;
      const state = {
        item, summary, siblings: items, targetOpen: item.open,
        originalHeight: item.style.height, animation: null, resizeFrame: null
      };
      faqControllers.set(item, state);
      summary.addEventListener('click', event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
            reducedMotion.matches || typeof item.animate !== 'function') return;
        // Summary still supplies native Enter/Space activation and focus semantics.
        event.preventDefault();
        setFaqOpen(item, !state.targetOpen);
      });
      item.addEventListener('toggle', () => {
        if (state.animation) {
          // An external native close wins over a pending expansion.
          if (!item.open) finishFaqState(state, false);
          return;
        }
        state.targetOpen = item.open;
        if (item.open) {
          state.siblings.forEach(other => {
            if (other !== item) setFaqOpen(other, false, !reducedMotion.matches);
          });
        }
      });
      if ('ResizeObserver' in window) {
        const observer = new ResizeObserver(() => retargetFaq(state));
        // Observe natural content, not the details box whose height is animating.
        [...item.children].forEach(child => observer.observe(child));
      }
    });
  });
  window.addEventListener('resize', () => activeFaqStates.forEach(retargetFaq), { passive: true });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) [...activeFaqStates].forEach(state => finishFaqState(state, state.targetOpen));
  });

  function detailsTarget(hash) {
    if (!hash || hash === '#') return null;
    try {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      return target?.matches('details') ? target : null;
    } catch {
      return null;
    }
  }

  function openHashDetails() {
    const target = detailsTarget(window.location.hash);
    if (!target) return;
    let ancestor = target.parentElement?.closest('details');
    while (ancestor) {
      setFaqOpen(ancestor, true, false);
      ancestor = ancestor.parentElement?.closest('details');
    }
    // Resolve the final layout before scrolling to a deep link.
    setFaqOpen(target, true, false);
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
      target.querySelector('summary')?.focus({ preventScroll: true });
      target.closest('[data-reveal]')?.classList.add('is-revealed');
    });
  }
  window.addEventListener('hashchange', openHashDetails);
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey ||
        event.altKey || !(event.target instanceof Element)) return;
    const link = event.target.closest('a[href]');
    if (!link) return;
    const destination = new URL(link.href, window.location.href);
    if (destination.origin !== window.location.origin || destination.pathname !== window.location.pathname ||
        destination.search !== window.location.search || !detailsTarget(destination.hash)) return;
    if (destination.hash === window.location.hash) {
      event.preventDefault();
      openHashDetails();
    }
  });
  openHashDetails();

  const heroMedia = document.querySelector('.hero-media');
  const heroStage = heroMedia?.closest('.hero') || heroMedia;
  let heroBounds = null;
  let heroFrame = null;
  let heroX = 0;
  let heroY = 0;
  let heroLightX = 0;
  let heroLightY = 0;
  function resetHero() {
    heroBounds = null;
    heroX = 0;
    heroY = 0;
    if (heroFrame !== null) window.cancelAnimationFrame(heroFrame);
    heroFrame = null;
    heroMedia?.style.setProperty('--hero-offset-x', '0px');
    heroMedia?.style.setProperty('--hero-offset-y', '0px');
    heroMedia?.style.setProperty('--hero-lit', '0');
  }
  heroStage?.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse' || !finePointer.matches || reducedMotion.matches) return;
    heroBounds = heroStage.getBoundingClientRect();
    heroMedia.style.setProperty('--hero-lit', '1');
  });
  heroStage?.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !finePointer.matches || reducedMotion.matches) return;
    heroBounds ||= heroStage.getBoundingClientRect();
    heroX = Math.max(-1, Math.min(1, ((event.clientX - heroBounds.left) / heroBounds.width - 0.5) * 2)) * 5;
    heroY = Math.max(-1, Math.min(1, ((event.clientY - heroBounds.top) / heroBounds.height - 0.5) * 2)) * 2.5;
    const mediaBounds = heroMedia.getBoundingClientRect();
    heroLightX = Math.max(0, Math.min(mediaBounds.width, event.clientX - mediaBounds.left));
    heroLightY = Math.max(0, Math.min(mediaBounds.height, event.clientY - mediaBounds.top));
    if (heroFrame !== null) return;
    heroFrame = window.requestAnimationFrame(() => {
      heroFrame = null;
      heroMedia.style.setProperty('--hero-offset-x', `${heroX.toFixed(2)}px`);
      heroMedia.style.setProperty('--hero-offset-y', `${heroY.toFixed(2)}px`);
      heroMedia.style.setProperty('--hero-x', `${heroLightX.toFixed(2)}px`);
      heroMedia.style.setProperty('--hero-y', `${heroLightY.toFixed(2)}px`);
    });
  });
  heroStage?.addEventListener('pointerleave', resetHero);
  finePointer.addEventListener('change', resetHero);

  document.querySelectorAll('.voices-group[aria-hidden="true"], .logo-group[aria-hidden="true"]')
    .forEach(group => group.setAttribute('inert', ''));
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      document.documentElement.classList.remove('motion-ready');
      revealNodes.forEach(node => node.classList.add('is-revealed'));
    }
    resetHero();
  });

  const screenshotDialog = document.getElementById('screenshot-dialog');
  const expandedElement = document.getElementById('screenshot-expanded');
  const expandedImage = expandedElement?.matches('img') ? expandedElement : expandedElement?.querySelector('img');
  const screenshotCaption = document.getElementById('screenshot-caption');
  const allowedScreenshots = new Set([
    'assets/screenshots/choose-and-pay.png',
    'assets/screenshots/recharge-home.png',
    'assets/screenshots/submit-session.png',
    'assets/screenshots/subscription-active.png'
  ]);
  let screenshotTrigger = null;
  document.querySelectorAll('.screenshot-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const source = trigger.getAttribute('data-image-src');
      if (!screenshotDialog || !expandedImage || !allowedScreenshots.has(source) ||
          typeof screenshotDialog.showModal !== 'function') return;
      screenshotTrigger = trigger;
      const title = trigger.getAttribute('data-image-title') || '充值站公开界面';
      expandedImage.src = source;
      expandedImage.alt = title;
      if (screenshotCaption) screenshotCaption.textContent = title;
      if (!screenshotDialog.open) screenshotDialog.showModal();
    });
  });
  screenshotDialog?.querySelector('[data-close-screenshot]')?.addEventListener('click', () => screenshotDialog.close());
  screenshotDialog?.addEventListener('click', event => {
    if (event.target !== screenshotDialog) return;
    const bounds = screenshotDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
      screenshotDialog.close();
    }
  });
  screenshotDialog?.addEventListener('close', () => {
    if (screenshotTrigger?.isConnected) screenshotTrigger.focus({ preventScroll: true });
  });

  document.querySelectorAll('a[data-service-placement]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.defaultPrevented || link.getAttribute('aria-disabled') === 'true' || link.hasAttribute('disabled')) return;
      const href = link.getAttribute('href');
      if (!href) return;
      let destination;
      try {
        destination = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (!['http:', 'https:'].includes(destination.protocol) || destination.origin === window.location.origin) return;
      document.dispatchEvent(new CustomEvent('prodclub:service-click', {
        detail: { site: 'prodclub-vip', page: window.location.pathname, placement: link.dataset.servicePlacement }
      }));
    });
  });
})();
