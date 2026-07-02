/**
 * Tabs
 * provides accessible tab switching 
 * with hash activation and keyboard navigation
 */

const defaults = {
  selTabTitle: '[data-tab-title]',
  selTabContent: '[data-tab-content]'
}

class Tabs {


  
  constructor(tabModule, params, reporter) {
    this.module = tabModule;
    this.reporter = reporter;
    this.selTabTitle = params.selTabTitle;
    this.selTabContent = params.selTabContent;
    this.itemsMap = {};
    this.activeItem = null;

    this.createItemMap();
    this.showOrphanedContent();
    this.activateLinkedTab();
    this.activateDefaultTab();
    this.startListening();
  }

  

  // maps titles to content panels via data-content id
  createItemMap = () => {
    this.module.querySelectorAll(this.selTabTitle).forEach((tabTitle) => {
      const target = tabTitle.dataset.content;
      if (!target) return;

      const tabContentItem = this.resolveContentItem(target);

      if (!tabContentItem) {
        this.handleMissingContentItem(target);
        return;
      }

      this.itemsMap[target] = { tabTitle, tabContentItem };
    })
  }


  // resolves tab panels within the module first, then by document id.
  resolveContentItem = (id) => {
    const selector = `#${this.escapeCssId(id)}`
    return this.module.querySelector(selector) || document.getElementById(id)
  }


  // escapes tab panel ids for safe use in query selectors.
  escapeCssId = (id) => {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(id)
    }

    return id.replace(/([^\w-])/g, "\\$1")
  }

  

  // warns about panels that are not referenced by any tab
  showOrphanedContent = () => {
    const allContentItems = this.module.querySelectorAll(this.selTabContent);

    allContentItems.forEach((contentItem) => {
      if (!this.itemsMap[contentItem.id])
        this.handleOrphanedContent(contentItem.id);
    })
  }

  

  // opens the tab referenced by the current hash, if any
  activateLinkedTab = () => {
    const target = location.hash.replace("#", "");
    if (!this.itemsMap[target]) return;

    this.openTab(this.itemsMap[target]);
  }

  

  // ensures one tab is open by default
  activateDefaultTab = () => {
    if (this.activeItem) return;
    const firstTab = Object.values(this.itemsMap)[0];
    if (firstTab) this.openTab(firstTab);
  }


  
  // wires up click and keyboard interaction
  startListening = () => {
    this.module.addEventListener("click", this.handleClick);
    this.module.addEventListener("keydown", this.handleKeydown);
    this.module.addEventListener("keyup", this.handleKeyup);
  }


  
  // opens clicked tab title
  handleClick = (e) => {
    const tabTitleEl = e.target.closest(this.selTabTitle);
    if (!tabTitleEl) return;

    const clickedTab = Object.values(this.itemsMap).find(
      (item) => item.tabTitle === tabTitleEl
    );

    if (!clickedTab || clickedTab === this.activeItem) return;

    this.openTab(clickedTab);
  }

  

  // supports arrow/home/end navigation between tab titles
  handleKeydown = (e) => {
    const currentTab = this.getActiveTab();
    if (!currentTab) return;

    if (e.key === "Enter" || e.key === " ") e.preventDefault();

    let newTab = null;

    switch (e.key) {
      case 'ArrowLeft':
        newTab = this.getPreviousTab(currentTab);
        break;
      case 'ArrowRight':
        newTab = this.getNextTab(currentTab);
        break;
      case 'Home':
        newTab = this.getFirstTab();
        break;
      case 'End':
        newTab = this.getLastTab();
        break;
      default:
        return;
    }

    if (newTab) newTab.tabTitle.focus();
  }

  

  // opens the focused tab on enter/space
  handleKeyup = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const currentTab = this.getActiveTab();
    if (currentTab) this.openTab(currentTab);
  }


  
  // opens a tab and updates classes/aria
  openTab = (item) => {
    this.closeActiveTab();
    this.toggleItemClass(item, true);
    this.updateAriaAttributes(item, true);
    this.activeItem = item;
  }


  
  // closes the currently active tab
  closeActiveTab = () => {
    if (!this.activeItem) return;
    this.toggleItemClass(this.activeItem, false);
    this.updateAriaAttributes(this.activeItem, false);
  }


  
  // toggles active class on title and panel
  toggleItemClass = (item, isActive) => {
    item.tabTitle.classList.toggle("is-activeTab", isActive);
    item.tabContentItem.classList.toggle("is-activeTab", isActive);
  }


  
  // updates aria-selected, tabindex, and hidden state
  updateAriaAttributes = (item, isActive) => {
    item.tabTitle.setAttribute("aria-selected", isActive ? "true" : "false");
    item.tabTitle.setAttribute("tabindex", isActive ? "0" : "-1");
    item.tabContentItem.hidden = !isActive;
  }


  
  // returns the currently focused tab title item
  getActiveTab = () =>
    Object.values(this.itemsMap).find((item) => item.tabTitle === document.activeElement);

  

  // returns the first available tab item.
  getFirstTab = () => Object.values(this.itemsMap)[0];
  // returns the last available tab item.
  getLastTab = () => Object.values(this.itemsMap).slice(-1)[0];
  // returns the previous tab item with wrap-around.
  getPreviousTab = (current) => this.getSiblingTab(current, -1);
  // returns the next tab item with wrap-around.
  getNextTab = (current) => this.getSiblingTab(current, 1);


  
  // returns a sibling tab with wrap-around
  getSiblingTab = (current, direction) => {
    const tabs = Object.values(this.itemsMap);
    const index = tabs.indexOf(current);
    const newIndex = (index + direction + tabs.length) % tabs.length;

    return tabs[newIndex];
  }


  
  // warns about tab panels that are not referenced by any title.
  handleOrphanedContent = (id) =>
    this.reporter?.report("tabs", `orphaned tab content: '${id}'`);



  handleMissingContentItem = (id) =>
    this.reporter?.report("tabs", `missing tab content: '${id}'`);
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter

  if (!(el instanceof HTMLElement)) {
    reporter?.report("tabs", "module was initialized on a non-element node.", el)
    return
  }

  new Tabs(el, defaults, reporter)
}
