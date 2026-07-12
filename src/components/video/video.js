/**
 * video.js
 * --------------------------------------------------------------------------
 * Progressive-enhancement controller for CMS-maintained video embeds, in
 * two flavours picked from the markup:
 *
 *   A) Self-hosted <video> with responsive sources — art direction
 *      (different footage / aspect ratios per viewport) and resolution
 *      ladders (same footage, higher pixel density) are both declared as
 *      plain <source media="…"> elements.
 *   B) YouTube via a click-to-load facade — a locally hosted poster plus
 *      a play button; the actual iframe (youtube-nocookie.com) is only
 *      created after the user's click, so nothing is loaded from Google
 *      beforehand (GDPR-friendly "two-click" embed).
 *
 * What the platform already does (so this script does NOT reimplement it)
 * ----------------------------------------------------------------------
 * - <source media="…"> inside <video> is native in current browsers: at
 *   load time the browser picks the first source whose media query
 *   matches. Without JavaScript a self-hosted video therefore already
 *   shows the right variant — and, with the `controls` attribute shipped
 *   in the markup, is fully operable.
 * - `autoplay muted loop playsinline` runs an ambient video natively.
 * - What the platform does NOT do: re-evaluate the media queries when the
 *   viewport changes after load (rotate, resize), hide/show the native
 *   controls around a custom play button, pause ambient videos for
 *   reduced-motion users, or defer a YouTube iframe until consent-by-
 *   click. Those gaps are all this script fills.
 *
 * What this script adds
 * ---------------------
 * 1. Source re-selection: it mirrors the native first-match-wins rule
 *    over the <source media> list via matchMedia, listens for media-query
 *    changes and — only when the chosen URL actually differs — swaps
 *    video.src while carrying playback position and play state over.
 * 2. Click-to-play mode (default): the native controls from the markup
 *    are taken over by a single centered play button; a click hides the
 *    button, reveals the native controls and plays. Pause/end hides the
 *    controls and brings the play button back.
 * 3. Ambient mode (the <video> carries `autoplay`): a persistent
 *    play/pause toggle (WCAG 2.2.2), and `prefers-reduced-motion: reduce`
 *    prevents the autostart — pressing play is the explicit opt-in.
 * 4. YouTube facade: extracts the video id from a full URL (watch,
 *    youtu.be, shorts, embed, live) or a bare 11-character id, and builds
 *    the youtube-nocookie iframe only on click.
 *
 * Accessibility
 * -------------
 * - The toggle button ships `hidden` in the markup and is only revealed
 *   by the script, so a page without JS never shows a dead control; the
 *   no-JS baseline is the native `controls` (self-hosted) or a plain link
 *   to YouTube (facade).
 * - Button labels are localized (de/en from <html lang>) and switch
 *   between "play" and "pause"; the icons are aria-hidden, the state is
 *   also mirrored as an `is-playing` class for styling.
 * - The injected iframe gets a `title` (from data-video-title)
 *   and receives focus after the facade button disappears, so keyboard
 *   users are not dropped into a void. The click-to-play mode hands
 *   focus over in both directions: when the focused play button hides,
 *   focus moves to the <video> (whose native controls just appeared);
 *   when a pause removes the native controls again, focus moves from
 *   the <video> back to the reappearing play button.
 * - Reduced motion starts ambient videos paused (see above).
 *
 * Configuration (on the element carrying
 * data-js-module="video")
 * --------------------------------------------------------------------------
 * - `data-video-youtube="URL-or-id"` switches the module into
 *                                        facade mode. Accepts a full
 *                                        YouTube URL or the bare video id.
 * - `data-video-title="…"`     accessible title for the embedded
 *                                        iframe / the facade play button.
 * - `[data-video-toggle]`      the play (or play/pause) button
 *                                        inside the module, shipped
 *                                        `hidden`.
 * - `[data-video-fallback]`    facade only: the no-JS link to
 *                                        YouTube; hidden once the script
 *                                        runs.
 * - `[data-video-poster]`      facade only: the locally hosted
 *                                        poster image; hidden once the
 *                                        iframe exists.
 * - Self-hosted mode is configured through native attributes alone:
 *   `controls` (no-JS baseline, taken over by the script), `autoplay
 *   muted loop playsinline` (ambient mode), `poster`, `preload` and the
 *   <source media> list.
 *
 * Styling contract
 * ----------------
 * The script sets no inline styles. It toggles `hidden` on its elements,
 * writes `is-playing` on the module element and stamps the injected
 * iframe with [data-video-embed]; video.scss keys on
 * exactly these hooks. The m-video* classes are styling only —
 * the JS never touches them.
 * --------------------------------------------------------------------------
 */

import { resolveLocale } from "./resolveLocale.js"



const defaults = {

  // Behavioural hooks (data attributes, not style classes, so the JS stays
  // decoupled from the CSS). All of them live inside the module element.
  selVideo: "video",                    // the self-hosted video
  selToggle: "[data-video-toggle]",     // play / play-pause button
  selFallback: "[data-video-fallback]", // facade no-JS link
  selPoster: "[data-video-poster]",     // facade poster image

  // Per-instance option attributes (see the header comment).
  youtubeAttr: "data-video-youtube",
  titleAttr: "data-video-title",

  // Flag written onto the injected YouTube iframe so the stylesheet can
  // size it without the JS hooking onto styling classes.
  embedAttr: "data-video-embed",

  // State class written on the module element (styling hook only; the JS
  // never reads it back).
  playingClass: "is-playing",

  // Privacy-friendly embed host plus fixed player parameters: autoplay=1
  // because the iframe only ever exists after an explicit user click, and
  // rel=0 to keep the end screen from advertising unrelated videos.
  embedUrl: "https://www.youtube-nocookie.com/embed/",
  embedParams: "autoplay=1&rel=0",

  // <html lang> matching none of the offered locales falls back to this.
  fallbackLocale: "en",
}



// Localized accessible names for the toggle button. The label switches
// between play and pause (media-player convention) instead of a constant
// label with aria-pressed, because "what pressing does next" is the
// clearer announcement for a transport control.
const LABELS = {

  de: {
    play: "Video abspielen",
    pause: "Video pausieren",
    fallbackTitle: "YouTube-Video",
  },

  en: {
    play: "Play video",
    pause: "Pause video",
    fallbackTitle: "YouTube video",
  },
}



// An id is exactly 11 characters from YouTube's id alphabet.
function isYouTubeId(value) {
  return /^[\w-]{11}$/.test(value || "")
}



// Extracts the video id from whatever the CMS field holds: a bare id or
// any of the common URL shapes (watch?v=, youtu.be/, shorts/, embed/,
// live/ — with or without www./m., also youtube-nocookie). Returns ""
// when nothing usable is found so the caller can warn.
function extractYouTubeId(raw) {
  const value = (raw || "").trim()

  if (isYouTubeId(value)) return value

  let url
  try {
    url = new URL(value)
  } catch {
    return ""
  }

  const host = url.hostname.replace(/^(www|m)\./, "")

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0]
    return isYouTubeId(id) ? id : ""
  }

  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return ""

  const fromQuery = url.searchParams.get("v")
  if (isYouTubeId(fromQuery)) return fromQuery

  const segments = url.pathname.split("/").filter(Boolean)
  if (!["shorts", "embed", "live"].includes(segments[0])) return ""

  return isYouTubeId(segments[1]) ? segments[1] : ""
}



// --------------------------------------------------------------------------
// Self-hosted <video>: responsive source switching + the two play modes.
// --------------------------------------------------------------------------
class HostedVideo {

  constructor(root, video, config, reporter) {
    this.root = root
    this.video = video
    this.config = config
    this.reporter = reporter

    this.toggle = root.querySelector(config.selToggle)
    this.labels = LABELS[
      resolveLocale(Object.keys(LABELS), config.fallbackLocale)
    ]

    // The behaviour mode comes from the native attribute, read once: a
    // video that declares `autoplay` is an ambient loop with a persistent
    // toggle; anything else is click-to-play behind a single play button.
    this.ambient = video.hasAttribute("autoplay")

    // Ordered snapshot of the <source> list. The script re-runs the
    // native first-match-wins selection over it whenever a media query
    // flips (see selectSource).
    this.sources = Array.from(video.querySelectorAll("source"))
      .map((source) => ({
        src: source.getAttribute("src") || "",
        media: source.getAttribute("media") || "",
      }))
      .filter((source) => source.src !== "")

    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")

    this.setup()
  }



  setup = () => {
    if (!this.sources.length && !this.video.getAttribute("src")) {
      this.reporter?.report(
        "video",
        "the <video> has neither <source> children nor a src attribute —" +
        " nothing to play.",
        this.root
      )
      return
    }

    this.selectSource()
    this.observeMediaQueries()

    this.video.addEventListener("play", this.handlePlay)
    this.video.addEventListener("pause", this.handlePause)

    this.ambient ? this.setupAmbient() : this.setupClickToPlay()
  }



  // Ambient mode: the platform autostarts the muted loop; the script adds
  // the WCAG 2.2.2 pause control and the reduced-motion opt-out.
  setupAmbient = () => {
    if (!this.toggle) {
      this.reporter?.report(
        "video",
        `no ${this.config.selToggle} button found — an autoplaying video` +
        " must offer a pause control (WCAG 2.2.2).",
        this.root
      )
    }

    this.wireToggle()

    // Reduced motion: prevent the autostart instead of racing it. Clearing
    // the autoplay flag stops a not-yet-started playback; pause() covers
    // the case where it already began. Playing stays available as an
    // explicit opt-in via the toggle.
    if (this.reducedMotion.matches) {
      this.video.autoplay = false
      this.video.pause()
    }

    this.reducedMotion.addEventListener("change", this.handleMotionChange)
    this.syncState()
  }



  // Click-to-play mode: the markup ships native `controls` as the no-JS
  // baseline; the script takes them over and puts the single centered
  // play button in front. Without a toggle button there would be no way
  // to start the video, so in that case the native controls stay.
  setupClickToPlay = () => {
    if (!this.toggle) {
      this.reporter?.report(
        "video",
        `no ${this.config.selToggle} button found — leaving the native` +
        " controls in place.",
        this.root
      )
      return
    }

    this.video.controls = false
    this.wireToggle()
    this.syncState()
  }



  wireToggle = () => {
    if (!this.toggle) return

    this.toggle.hidden = false
    this.toggle.addEventListener("click", this.handleToggle)
  }



  // Watches every media query the source list uses, so a viewport change
  // (resize, rotation, moving to a high-density screen) re-runs the
  // selection. matchMedia change events fire exactly on a boundary cross —
  // no debounce needed.
  observeMediaQueries = () => {
    const queries = [...new Set(
      this.sources.map((source) => source.media).filter(Boolean)
    )]

    queries.forEach((query) => {
      const mq = window.matchMedia(query)

      // An unparseable query serializes to "not all" and would silently
      // never match — surface the typo instead.
      if (mq.media === "not all" && query !== "not all") {
        this.reporter?.report(
          "video",
          `"${query}" is not a valid media query; this <source> can never` +
          " match.",
          this.root
        )
      }

      mq.addEventListener("change", this.handleMediaChange)
    })
  }



  // Mirrors the native selection rule (first source whose media query
  // matches; an attribute-less source matches always) and applies it only
  // when the outcome actually changed. Playback position and play state
  // survive the swap: the position is re-applied once the new source's
  // metadata is in.
  selectSource = () => {
    if (!this.sources.length) return

    const choice = this.sources.find(
      (source) => !source.media || window.matchMedia(source.media).matches
    )

    if (!choice) {
      this.reporter?.report(
        "video",
        "no <source> matches the current viewport — add one without a" +
        " media attribute as the fallback (last in the list).",
        this.root
      )
      return
    }

    const resolved = new URL(choice.src, document.baseURI).href
    if (this.video.currentSrc === resolved) return

    const wasPlaying = !this.video.paused && !this.video.ended
    const position = this.video.currentTime

    this.video.src = choice.src

    if (position > 0) {
      this.video.addEventListener("loadedmetadata", () => {
        this.video.currentTime = position
      }, { once: true })
    }

    if (wasPlaying) {
      this.video.play().catch(() => {})
    }
  }



  // The single place that reflects the play state: the is-playing class
  // drives the icon swap, the label announces what pressing does next,
  // and in click-to-play mode the native controls swap with the button.
  syncState = () => {
    const playing = !this.video.paused && !this.video.ended

    this.root.classList.toggle(this.config.playingClass, playing)

    if (!this.toggle) return

    this.toggle.setAttribute(
      "aria-label", playing ? this.labels.pause : this.labels.play
    )

    if (this.ambient) return

    // Click-to-play: while playing the native controls own the surface
    // and the big play button disappears; on pause/end they swap back.
    this.video.controls = playing

    // Hiding the toggle while it holds the keyboard focus would drop the
    // focus to <body>, stranding keyboard users at the top of the page.
    // Hand it to the video first (focusable — its native controls just
    // came back), mirroring the facade's handoff to its iframe. Guarded
    // by activeElement so play events from elsewhere (e.g. a source swap
    // resuming playback) never steal the user's focus.
    if (playing && document.activeElement === this.toggle) {
      this.video.focus()
    }

    this.toggle.hidden = playing

    // Same handoff in reverse: pausing via the native controls leaves the
    // focus on the <video>, whose controls — and with them its keyboard
    // operability — were just removed. Hand it to the play button that
    // took the surface back over. The activeElement guard again keeps a
    // pause from elsewhere (e.g. programmatic) from stealing the focus.
    if (!playing && document.activeElement === this.video) {
      this.toggle.focus()
    }
  }



  handleToggle = () => {
    if (this.video.paused || this.video.ended) {
      this.video.play().catch(() => {})
      return
    }

    this.video.pause()
  }



  handlePlay = () => this.syncState()

  handlePause = () => this.syncState()

  handleMediaChange = () => this.selectSource()



  // A runtime switch TO "reduce" pauses the ambient loop. Switching away
  // does not auto-resume — staying still is the safe default; the toggle
  // is right there.
  handleMotionChange = (event) => {
    if (!event.matches) return

    this.video.pause()
  }
}



// --------------------------------------------------------------------------
// YouTube click-to-load facade: poster + play button now, iframe on click.
// --------------------------------------------------------------------------
class YouTubeFacade {

  constructor(root, config, reporter) {
    this.root = root
    this.config = config
    this.reporter = reporter

    this.toggle = root.querySelector(config.selToggle)
    this.fallback = root.querySelector(config.selFallback)
    this.poster = root.querySelector(config.selPoster)
    this.labels = LABELS[
      resolveLocale(Object.keys(LABELS), config.fallbackLocale)
    ]

    const raw = root.getAttribute(config.youtubeAttr)
    this.videoId = extractYouTubeId(raw)

    if (!this.videoId) {
      this.reporter?.report(
        "video",
        `"${raw}" is not a recognizable YouTube URL or video id — the` +
        " facade stays unenhanced.",
        this.root
      )
      return
    }

    this.title = root.getAttribute(config.titleAttr) || ""

    if (!this.title) {
      this.reporter?.report(
        "video",
        `no ${config.titleAttr} set — the embedded iframe needs an` +
        ` accessible title; using "${this.labels.fallbackTitle}".`,
        this.root
      )
      this.title = this.labels.fallbackTitle
    }

    this.setup()
  }



  setup = () => {
    if (!this.toggle) {
      this.reporter?.report(
        "video",
        `no ${this.config.selToggle} button found — the facade stays` +
        " unenhanced (the fallback link keeps working).",
        this.root
      )
      return
    }

    // The button replaces the no-JS link as the way in; naming the video
    // in the label spares screen-reader users a click into the unknown.
    this.toggle.setAttribute(
      "aria-label", `${this.labels.play}: ${this.title}`
    )
    this.toggle.hidden = false
    this.toggle.addEventListener("click", this.handleActivate)

    if (this.fallback) this.fallback.hidden = true
  }



  // The click IS the consent: only now anything is requested from
  // YouTube. autoplay=1 starts playback right away so the user does not
  // have to press play twice.
  handleActivate = () => {
    const iframe = document.createElement("iframe")

    iframe.src =
      `${this.config.embedUrl}${this.videoId}?${this.config.embedParams}`
    iframe.title = this.title
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media;" +
      " gyroscope; picture-in-picture; web-share"
    )
    iframe.setAttribute("allowfullscreen", "")
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin")
    iframe.setAttribute(this.config.embedAttr, "")

    this.toggle.hidden = true
    if (this.poster) this.poster.hidden = true

    this.root.classList.add(this.config.playingClass)
    this.root.appendChild(iframe)

    // The activated button just vanished from the tab order; hand focus
    // to the player so keyboard users continue where they acted.
    iframe.focus()
  }
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      "video",
      "module was initialized on a non-element node.", el
    )
    return
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  if (el.hasAttribute(defaults.youtubeAttr)) {
    new YouTubeFacade(el, defaults, reporter)
    return
  }

  const video = el.querySelector(defaults.selVideo)

  if (video) {
    new HostedVideo(el, video, defaults, reporter)
    return
  }

  reporter?.report(
    "video",
    `neither a <video> child nor ${defaults.youtubeAttr} found — nothing` +
    " to enhance.",
    el
  )
}
