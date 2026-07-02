/**
 * Accordion
 * toggles accordion items (single-open or multi-open) and keeps aria/state classes in sync
 */

// Copy-paste note: requires _shared/js/getCssCustomProperty.js (copy it into the target project as well)
import { getCssCustomProperty } from "./getCssCustomProperty.js"



const defaults = {
  selTitle: "data-nav-widget-title",
  selContent: "data-nav-widget-content",
  cssCustomPropertyName: "--an-duration",
  getCssCustomProperty,
}



class Accordion {
  
  constructor(accordion, params, reporter) {
    this.accordion = accordion;
    this.reporter = reporter;
    this.selTitle = `[${params.selTitle}]`;
    this.selContent = `[${params.selContent}]`;

    // maps title elements to their corresponding content elements
    this.itemsMap = new Map();

    // helper to read css custom properties (used for scroll delay)
    this.getCssCustomProperty = params.getCssCustomProperty;
    this.cssCustomPropertyName = params.cssCustomPropertyName;

    // open single mode: only one item may be open at a time
    this.isOpenSingle = this.accordion.dataset.type === 'openSingle';

    this.animationDelay = 0;
    this.scrollIntoView = this.accordion.hasAttribute("data-scroll-into-view");

    this.markInitialized();
    this.getAnimationDelay();
    this.createItemsMap();
    this.startListening();
  }

  

  // prevents double initialization
  markInitialized = () => {
    this.accordion.classList.add('is-initialized');
  }


  
  // reads the animation duration (seconds) and converts it to ms
  getAnimationDelay = () => {
    const scope = document.body;
    const delay = this.getCssCustomProperty(scope, this.cssCustomPropertyName);
    const delayUnitless = parseFloat(delay.replace('s', ''));
    const delayInMs = delayUnitless * 1000;

    this.animationDelay = delayInMs;
  }


  
  // builds title -> content mapping via data-content
  createItemsMap = () => {
    const allTitles = this.accordion.querySelectorAll(this.selTitle);
    const allContents = this.accordion.querySelectorAll(this.selContent);

    allTitles.forEach(title => {
      const contentID = title.dataset.content;
      const content = [...allContents].find(item => item.id === contentID);
      if (!content) return;
      this.itemsMap.set(title, content);
    })
  }


  
  // uses event delegation for clicks and adds basic keyboard support
  startListening = () => {

    this.accordion.addEventListener('click', (e) => {
      const clickedTitle =
        [...this.itemsMap.keys()].find(title => title.contains(e.target));

      if (clickedTitle) this.setItemState(clickedTitle);
    })

    this.accordion.addEventListener('keyup', this.checkKey);
  }

  

  // applies open/close rules and optional scroll behavior
  setItemState = (title) => {
    if (!title || !this.itemsMap.has(title)) return;

    const clickedOnActiveItem = title.classList.contains('is-active');
    const doScroll = !clickedOnActiveItem && this.scrollIntoView;
    const clickedOnActiveOpenSingleItem =
      this.isOpenSingle && title.classList.contains('is-active');

    // open single mode: clicking the active item only closes it
    if (clickedOnActiveOpenSingleItem) {
      this.toggleItem(title);
      return;
    }

    // open single mode: close all items before opening the new one
    if (this.isOpenSingle) this.closeAllItems();

    this.toggleItem(title);

    if (doScroll) this.scrollActiveItemIntoView(title);
  }


  
  // toggles via keyboard (space)
  checkKey = (e) => {
    switch (e.key) {
      case ' ':
        e.preventDefault();
        this.setItemState(e.target.closest(this.selTitle))
        break;
      default:
        return;
    }
  }


  
  // toggles aria-expanded and state classes for a single item
  toggleItem = (title) => {
    const content = this.itemsMap.get(title);

    const isExpanded = title.getAttribute('aria-expanded') === 'true';
    title.setAttribute('aria-expanded', !isExpanded);

    content.classList.toggle('is-open');
    title.classList.toggle('is-active');
  }


  
  // scrolls to the title after the open animation
  scrollActiveItemIntoView = (title) => {
    setTimeout(() => { title.scrollIntoView(); }, this.animationDelay);
  }


  
  // closes all items and resets aria
  closeAllItems = () => {
    this.itemsMap.forEach((content, title) => {
      title.setAttribute('aria-expanded', 'false');
      title.classList.remove('is-active');
      content.classList.remove('is-open');
    })
  }
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter

  if (!(el instanceof HTMLElement)) {
    reporter?.report("accordion", "module was initialized on a non-element node.", el)
    return
  }

  if (el.classList.contains("is-initialized")) return

  new Accordion(el, defaults, reporter)
}
