class Ar25StageText {

  static init = (params) => {
    if (!document.querySelector(params.selContainer)) return false;

    const containers = document.querySelectorAll(params.selContainer);
    containers.forEach(container => new Ar25StageText(container, params));
  }



  constructor(container, params) {
    this.container = container;
    this.fadeSize = params.fadeSize || 15;   // fade depth in % of the container height
    this.threshold = params.threshold || 1;  // px tolerance before an edge counts as "reached"
    this.ticking = false;

    this.bindEvents();
    this.updateMask();
  }



  bindEvents = () => {
    this.container.addEventListener('scroll', this.requestUpdate, { passive: true });
    window.addEventListener('resize', this.requestUpdate);

    // catch layout/content size changes (responsive video, font swap, ...)
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(this.requestUpdate);
      this.resizeObserver.observe(this.container);
    }
  }



  // throttle: collapse bursts of scroll/resize events into one paint frame
  requestUpdate = () => {
    if (this.ticking) return;
    this.ticking = true;

    requestAnimationFrame(() => {
      this.updateMask();
      this.ticking = false;
    });
  }



  // adaptive fade: only fade an edge while there is still content beyond it.
  updateMask = () => {
    const { scrollTop, scrollHeight, clientHeight } = this.container;

    const fadeTop = scrollTop > this.threshold;
    const fadeBottom = scrollTop + clientHeight < scrollHeight - this.threshold;

    const mask = this.buildMask(fadeTop, fadeBottom);
    this.container.style.maskImage = mask;
    this.container.style.webkitMaskImage = mask;
  }



  buildMask = (fadeTop, fadeBottom) => {
    const top = fadeTop ? 'transparent 0%' : 'black 0%';
    const bottom = fadeBottom ? 'transparent 100%' : 'black 100%';

    return `linear-gradient(to bottom, ${top}, black ${this.fadeSize}%, black ${100 - this.fadeSize}%, ${bottom})`;
  }
}
