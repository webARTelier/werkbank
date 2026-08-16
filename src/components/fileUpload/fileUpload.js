/**
 * fileUpload.js
 * ----------------------------------------------------------------------------
 * Makes a native file field say what is attached to it, and lets the reader
 * correct it: the whole component becomes a drop target, every file gets a row
 * with its name and its size, and each row carries a control that takes that
 * one file back out. A file input is the one control that keeps its own value
 * a secret — it reports "3 files", names none of them, and offers no way to
 * drop the one that was picked by mistake short of choosing all three again.
 *
 * The progress bar is an endpoint, not a flag
 * ------------------------------------------
 * "Show a progress bar" cannot be a display option, because a submitted form
 * reports nothing back to the page while it uploads: no event, no byte count,
 * nothing. A bar therefore means taking the transfer AWAY from the form, which
 * changes what the server receives, what a failure looks like and who clears
 * up afterwards. So the option is the endpoint itself, and one attribute picks
 * which of two lanes the box runs in:
 *
 *   no data-fileupload-url    the FORM carries the files on submit and the
 *                             rows name what it will carry. The default, and
 *                             right wherever a plain form post is right —
 *                             which is more often than the other lane.
 *   data-fileupload-url="…"   THIS MODULE carries each file the moment it is
 *                             chosen, with a real <progress> per row, cancel
 *                             and retry — and the form ends up holding only
 *                             the handles the server returned, so pressing
 *                             Send is instant instead of being the moment the
 *                             megabytes start moving.
 *
 * There is deliberately no state in between: a box that promised a bar with
 * nowhere to send to would be a bar that never moves. What the second lane
 * costs is an upload route, a second server-side shape and a sweep for
 * unclaimed files — see the readme, and do not reach for it by default.
 *
 * What the platform already does
 * ------------------------------
 * - The control opens the picker, is operated from the keyboard, and its own
 *   button is the single-pointer alternative that WCAG 2.5.7 asks for next to
 *   any dragging. This module never replaces it, which is why the field stays
 *   visible in the box.
 * - A file input is ALREADY a drop target: files dropped on the control
 *   itself are assigned to it and fire "change", with no script at all. What
 *   this module adds is the SIZE of that target and a visible invitation to
 *   use it — not the capability.
 * - "accept" tells the picker which types to offer, "multiple" how many files
 *   may be chosen, and "required" makes an empty field fail the form's own
 *   validation with the browser's own message. All three keep working in both
 *   lanes; none of them is reimplemented.
 * - setCustomValidity() is the platform's channel for a constraint it has no
 *   attribute for. A size limit is exactly that — there is no "maxsize" — and
 *   so is "wait, something is still uploading", so both are routed through it
 *   rather than through a submit handler of this module's own: the form
 *   refuses to send, the browser writes the message, and validity,
 *   validationMessage and formValidation's rendering all keep working off the
 *   standard.
 * - "input.files" is a FileList and cannot be written to element by element,
 *   but the whole list can be assigned from a DataTransfer — the platform's
 *   own way of rewriting a selection. That is what makes a per-file remove
 *   control possible in the form lane without keeping a second copy of the
 *   list.
 * - XMLHttpRequest.upload fires progress events with loaded/total while the
 *   request body goes out. fetch() does NOT: a request body cannot be observed
 *   on its way out (streaming request bodies need HTTP/2, duplex support and
 *   are unavailable in most engines). So XHR in the upload lane is not legacy
 *   code kept around — it is the only API in the platform that can answer "how
 *   far along is this".
 * - <progress> IS a progress bar: a role, a value, a max, announced by
 *   assistive tech and rendered by the engine. A div with a width would have
 *   to reimplement every part of that. Without a value attribute it is
 *   INDETERMINATE, which is exactly the state between "the last byte left the
 *   browser" and "the server answered" — no third element, no spinner.
 * - FormData + XHR send a real multipart body, so a File needs no encoding and
 *   no base64 detour, and xhr.abort() cancels a transfer for real: the socket
 *   closes and the server stops receiving.
 * - A hidden input is how a value nobody typed travels in a form, which is
 *   what a server-side handle is.
 * - Intl names a byte size ("1,2 MB" / "1.2 MB") and a percentage in the
 *   page's language, so neither is assembled by hand.
 *
 * What this script adds
 * ---------------------
 * In both lanes:
 * 1. The drop zone: the component's whole box, rather than the control's few
 *    hundred pixels. A drag carrying files paints the box as a target
 *    ("data-fileupload-dragging") and a drop hands what it carries to the same
 *    intake the picker feeds.
 * 2. The field's own "accept" applied to that drop, so a dropped file cannot
 *    end up somewhere the picker would never have offered it. It is a filter
 *    and not a verdict: "accept" names types, the server checks contents, and
 *    a rejected file is reported rather than dropped quietly. A dropped
 *    FOLDER is turned away by the same rule and for the same reason: the
 *    picker cannot produce one without "webkitdirectory", so a box that read
 *    one out on its own would be doing what the control it is attached to
 *    cannot (see splitDrop).
 * 3. The list of what is attached — one row per file, its name and its size —
 *    which is the whole of what the native control does not show.
 * 4. The two size limits the platform has no attribute for, read from the
 *    field: "data-fileupload-maxsize" per file and "data-fileupload-maxtotal"
 *    for the selection as a whole. Where a total limit is set the running
 *    total is printed under the list, so the budget is visible while there is
 *    still room in it rather than only complained about once it is spent.
 * 5. One visible "role=status" line stating the outcome — what was removed,
 *    what was not accepted, what is over the limit, how many files are
 *    attached now. Visible rather than hidden, so a sighted reader and a
 *    screen reader are told the same thing by the same node.
 * 6. The resting statement that the box really is a drop target:
 *    "data-fileupload-ready", which is what the stylesheet hangs the dashed
 *    zone and its invitation on. Deliberately the module's to set — a box that
 *    invites a drop it cannot receive would hand the file to the browser,
 *    which opens it and takes the reader off the half-filled form.
 *
 * In the form lane (no endpoint):
 * 7. Removal of one file, through a DataTransfer written back to the field
 *    (see setSelection). The one thing the platform has no control for at all:
 *    a FileList is what it is, and choosing again replaces all of it.
 * 8. A file over a limit STAYS where the reader put it, its row says why, and
 *    the field is made invalid — dropping it would take away what they just
 *    chose and leave a single-file field reading "no file chosen" with no
 *    explanation anywhere near it.
 * 9. The occasion the change event misses: a form reset clears the field
 *    without firing one (the same gap autoGrowTextarea covers).
 *
 * In the upload lane (an endpoint is configured):
 * 10. The queue — at most "data-fileupload-concurrency" transfers at a time
 *     (3 by default), because twenty parallel uploads on one line finish later
 *     than three at a time and report nonsense on the way. A file over a limit
 *     is refused at the door instead of marked: the point of checking in the
 *     browser is to not spend two minutes sending something the server will
 *     throw away, and a row here means a transfer.
 * 11. The row's bar, its state in words, and the controls that state allows.
 *     Rows are built once and updated in place — replacing them wholesale (the
 *     form lane's way) would restart the bar and throw away the focus of
 *     whoever is pressing Cancel.
 * 12. The handles as hidden inputs, under the name the AUTHOR put on the file
 *     field — which this lane takes off the field, so the same bytes cannot
 *     travel twice. "required" moves the same way and keeps meaning "at least
 *     one file", answered against the queue.
 * 13. The honest tail end: 100 % means the last byte left the browser, not
 *     that the server is finished with it. The bar goes indeterminate and the
 *     row says so rather than sitting at "100 %" and looking stuck.
 * 14. A form that cannot be sent while anything is unfinished, and — where
 *     "data-fileupload-delete-url" is set — a DELETE for a handle the reader
 *     took back out, so the server is told about the file it is now storing
 *     for nobody.
 *
 * Accessibility
 * -------------
 * - Dragging is never the only way in: the native control is untouched and
 *   keeps the picker one Enter away (WCAG 2.5.7). The zone is an addition on
 *   top of a control that already worked.
 * - The list is real content, not a decoration: a <ul> of rows, each with a
 *   real <button type="button"> named after its file by a visually-hidden text
 *   node rather than an aria-label — the name still reads when the stylesheet
 *   never arrives, and "Remove report.pdf" tells a screen-reader user which
 *   row they are on where three identical "Remove"s would not.
 * - Pressing a row's control destroys the element the focus was on, so focus
 *   is moved to the row that takes its place, or to the field when the last
 *   row goes (see restoreFocus).
 * - Every <progress> is named by its own row's file name through
 *   aria-labelledby, so "photo.jpg, 42 %" is what is announced, not "progress
 *   bar" three times.
 * - The percentages are NEVER announced: a bar is a live-updating value, not
 *   an event, and a live region on it would talk over everything else. The
 *   status line announces the transitions a reader has to act on — uploaded,
 *   failed, not accepted, over the limit — politely, one sentence at a time.
 * - Whatever is wrong with a row is a WORD in it ("too large", "failed"),
 *   never only a colour, and the same is true in a forced-colors context.
 * - The status line is polite and never assertive: files arriving is not an
 *   interruption. It is one node for both channels, so the spoken and the
 *   printed sentence cannot drift apart.
 * - The drag state is presentational only — no ARIA, nothing claimed. A drag
 *   is a pointer gesture in progress, not a state of the field.
 *
 * Configuration
 * -------------
 * On the ROOT, because they say how — and whether — to upload:
 *
 *   data-fileupload-url            where to POST each file. Its presence IS
 *                                  the progress bar; absent, the form carries
 *                                  the files and no bar is possible.
 *   data-fileupload-part           the multipart part name  (default "file")
 *   data-fileupload-name           the hidden inputs' name  (default: the
 *                                  file field's own name attribute)
 *   data-fileupload-key            the JSON key holding the handle
 *                                  (default "id")
 *   data-fileupload-delete-url     DELETE <url>?<key>=<handle> when a row
 *                                  goes, under the key above
 *   data-fileupload-token          a CSRF token to send as a header
 *   data-fileupload-token-header   that header's name
 *                                  (default "X-CSRF-Token")
 *   data-fileupload-concurrency    transfers at a time (default 3)
 *
 * On the FIELD, because they are constraints on the value and every other
 * constraint on that value — accept, multiple, required — is an attribute of
 * the field, which is where the next author will look for them:
 *
 *   data-fileupload-maxsize="5MB"    the largest a single file may be
 *   data-fileupload-maxtotal="20MB"  the largest the selection may be
 *
 * Both take a size with a unit ("5MB", "1,5 gb", "500 kb") or a bare number
 * of bytes, decimal steps throughout (see parseByteSize). Absent, malformed
 * or zero means no limit: a component that invented one would refuse a file
 * the author never said anything about. Read fresh on every pass, like
 * "accept", so a project may tighten either one while the page is open.
 *
 * Everything else is still the platform's: what may be chosen is "accept",
 * how many is "multiple", whether the form may be sent without a file is
 * "required". The look is CSS (see the token block in fileUpload.scss). The
 * wording of the status line, the states, the limits and the controls is built
 * in for de/en and picked from <html lang>, the way every announcing component
 * here does it.
 *
 * Put data-js-behavior="fileUpload" on the WRAPPER, not on the input: the
 * drop target is the box, and the input is what the box is built around.
 * ----------------------------------------------------------------------------
 */



// rafThrottle defers the one occasion that must not be answered in place: a
// form reset is cancelable, so in the form lane the field still holds its old
// values while the event is being handled and the list can only be rebuilt a
// frame later.
import { rafThrottle } from './rafThrottle.js';
import { resolveLocale } from './resolveLocale.js';
import { formatTemplate } from './formatTemplate.js';
import { parseByteSize } from './parseByteSize.js';
import { parseNonNegative } from './parseNonNegative.js';
import { formatByteSize } from './formatByteSize.js';
import { matchesAccept } from './matchesAccept.js';
import { fileKey } from './fileKey.js';
import { uniqueId } from './uniqueId.js';



const defaults = {

  // "The box really is a drop target." Set on the root once the module is
  // listening and can act on a drop, removed again by the cleanup function,
  // and only ever written. The stylesheet draws the dashed zone and shows the
  // drop invitation on it and on nothing else: until a drop can be received,
  // inviting one would hand the file to the browser, which opens it and takes
  // the reader off the form they were filling in.
  readyAttr: 'data-fileupload-ready',

  // "A drag carrying files is over the box." Presence IS the state, so
  // writing it is idempotent — which matters, because dragover fires
  // continuously for as long as the pointer is inside.
  draggingAttr: 'data-fileupload-dragging',

  // Where to POST each file. This one attribute picks the lane: with it the
  // module carries the bytes and every row gets a bar, without it the form
  // carries them and no bar is possible (see the file header).
  urlAttr: 'data-fileupload-url',

  // The rest of the upload lane's settings, on the root because they all say
  // HOW to upload. Every one of them is optional.
  partAttr: 'data-fileupload-part',
  nameAttr: 'data-fileupload-name',
  keyAttr: 'data-fileupload-key',
  deleteUrlAttr: 'data-fileupload-delete-url',
  tokenAttr: 'data-fileupload-token',
  tokenHeaderAttr: 'data-fileupload-token-header',
  concurrencyAttr: 'data-fileupload-concurrency',

  // The two size limits, read from the FIELD: a limit is a constraint on the
  // value, and accept / multiple / required all live there too. Optional, and
  // parsed by parseByteSize — an absent, malformed or zero value is no limit
  // at all.
  maxSizeAttr: 'data-fileupload-maxsize',
  maxTotalAttr: 'data-fileupload-maxtotal',

  // The defaults for the four optional upload settings above.
  part: 'file',
  key: 'id',
  tokenHeader: 'X-CSRF-Token',
  concurrency: 3,

  // The row's state, as one attribute with a value rather than a flag per
  // state: a row is in exactly one state, and an attribute that can only hold
  // one value cannot be left in two. The form lane writes one state
  // ("oversize"), the upload lane five — see the states map.
  stateAttr: 'data-fileupload-state',

  // "The selection as a whole is over the total", on the running total line.
  // Derived on every pass from the files themselves, so it cannot outlive
  // what it describes.
  exceededAttr: 'data-fileupload-exceeded',

  // The injected nodes. The attributes are what this module finds them by
  // (behavioural hooks, so the JS never depends on the class names), the
  // classes are what the stylesheet styles them by.
  listAttr: 'data-fileupload-list',
  itemAttr: 'data-fileupload-item',
  removeAttr: 'data-fileupload-remove',
  retryAttr: 'data-fileupload-retry',
  totalAttr: 'data-fileupload-total',
  noticeAttr: 'data-fileupload-notice',

  listClass: 'c-fileUpload__list',
  itemClass: 'c-fileUpload__item',
  nameClass: 'c-fileUpload__name',
  sizeClass: 'c-fileUpload__size',
  progressClass: 'c-fileUpload__progress',
  stateClass: 'c-fileUpload__state',
  removeClass: 'c-fileUpload__remove',
  retryClass: 'c-fileUpload__retry',
  retryWordClass: 'c-fileUpload__retryWord',
  controlLabelClass: 'c-fileUpload__controlLabel',
  totalClass: 'c-fileUpload__total',
  noticeClass: 'c-fileUpload__notice',

  // <html lang> matching none of the locales below falls back to this one.
  fallbackLocale: 'en',
};



// Every state a row can be in, named rather than inlined as strings: they are
// written into an attribute the stylesheet reads, and a typo on either side
// would be silent.
const states = {

  // The upload lane, in the order a file passes through them.
  queued: 'queued',
  uploading: 'uploading',
  processing: 'processing',
  done: 'done',
  failed: 'failed',

  // The form lane's only state — a file the form may not send. It shares the
  // attribute because it is the same kind of fact about a row, which is what
  // lets one stylesheet rule colour both it and a failed transfer.
  oversize: 'oversize',
};



// The states that are neither finished nor stalled — what "still working on
// it" means for the queue, for the concurrency cap and for the form.
const busyStates = [states.queued, states.uploading, states.processing];



// The built-in wording. {placeholders} are interpolated by formatTemplate,
// and the templates stay plain strings so the whole map is JSON-shaped and a
// project can replace it in one piece (formValidation's reason).
//
// The count sentence is a separate message from what just happened, because
// the two are always announced together and only one of them varies: "report
// .pdf removed. 2 files selected." The two lanes count different things — a
// selection the form will carry, transfers that have arrived — so each has its
// own three templates rather than one set stretched over both.
const labels = {

  de: {
    remove: '{name} entfernen',
    removed: '{name} entfernt.',
    tooLarge: 'zu groß',
    total: '{total} von {max}',

    // Both lanes: a folder is the one thing a drop can carry that the picker
    // never produces, and neither lane has any use for one.
    folderOne: '{names} ist ein Ordner — bitte legen Sie die Dateien darin ab.',
    folderMany:
      '{count} Ordner wurden nicht übernommen ({names}) — bitte legen Sie ' +
      'die Dateien darin ab.',

    // The form lane.
    selectedNone: 'Keine Datei ausgewählt.',
    selectedOne: '1 Datei ausgewählt.',
    selectedMany: '{count} Dateien ausgewählt.',
    rejectedOne: '{names} wurde nicht übernommen — dieses Feld nimmt {accept}.',
    rejectedMany:
      '{count} Dateien wurden nicht übernommen ({names}) — dieses Feld ' +
      'nimmt {accept}.',
    oversizeOne: '{names} ist zu groß — höchstens {max} pro Datei.',
    oversizeMany:
      '{count} Dateien sind zu groß ({names}) — höchstens {max} pro Datei.',
    totalExceeded: 'Zusammen {total} — höchstens {max} insgesamt.',

    // The upload lane.
    stateQueued: 'wartet',
    stateProcessing: 'wird verarbeitet …',
    stateDone: 'hochgeladen',
    stateFailed: 'fehlgeschlagen',

    cancel: 'Upload von {name} abbrechen',
    retry: '{name} erneut hochladen',

    // What the retry control SHOWS, next to the name above, which is what it
    // is called. Two strings because the row has no space for the sentence and
    // a screen reader has no use for the word on its own.
    retryWord: 'Erneut',

    uploaded: '{name} hochgeladen.',
    failed: '{name} konnte nicht hochgeladen werden.',

    // The reason comes from the server and ends on nothing in particular, so
    // it goes in brackets: the sentence closes either way, and no one has to
    // patch punctuation onto a string someone else wrote.
    failedWith: '{name} konnte nicht hochgeladen werden ({reason}).',
    canceled: 'Upload von {name} abgebrochen.',
    retrying: '{name} wird erneut hochgeladen.',

    refusedType: '{name} wurde nicht übernommen — dieses Feld nimmt {accept}.',
    refusedSize: '{name} ist zu groß — höchstens {max} pro Datei.',
    refusedTotal: '{name} passt nicht mehr — höchstens {max} insgesamt.',

    attachedNone: 'Keine Datei angehängt.',
    attachedOne: '1 Datei angehängt.',
    attachedMany: '{count} Dateien angehängt.',

    requiredNone: 'Bitte hängen Sie mindestens eine Datei an.',
    busyOne: '1 Datei wird noch hochgeladen.',
    busyMany: '{count} Dateien werden noch hochgeladen.',
    stuckOne: '1 Datei ist nicht hochgeladen — erneut versuchen oder entfernen.',
    stuckMany:
      '{count} Dateien sind nicht hochgeladen — erneut versuchen oder ' +
      'entfernen.',
  },

  en: {
    remove: 'Remove {name}',
    removed: '{name} removed.',
    tooLarge: 'too large',
    total: '{total} of {max}',

    // Both lanes: a folder is the one thing a drop can carry that the picker
    // never produces, and neither lane has any use for one.
    folderOne: '{names} is a folder — drop the files inside it instead.',
    folderMany:
      '{count} folders were not accepted ({names}) — drop the files inside ' +
      'them instead.',

    // The form lane.
    selectedNone: 'No file selected.',
    selectedOne: '1 file selected.',
    selectedMany: '{count} files selected.',
    rejectedOne: '{names} was not accepted — this field takes {accept}.',
    rejectedMany:
      '{count} files were not accepted ({names}) — this field takes {accept}.',
    oversizeOne: '{names} is too large — {max} per file at most.',
    oversizeMany:
      '{count} files are too large ({names}) — {max} per file at most.',
    totalExceeded: '{total} together — {max} in total at most.',

    // The upload lane.
    stateQueued: 'waiting',
    stateProcessing: 'processing …',
    stateDone: 'uploaded',
    stateFailed: 'failed',

    cancel: 'Cancel the upload of {name}',
    retry: 'Upload {name} again',

    // What the retry control SHOWS, next to the name above, which is what it
    // is called. Two strings because the row has no space for the sentence and
    // a screen reader has no use for the word on its own.
    retryWord: 'Retry',

    uploaded: '{name} uploaded.',
    failed: '{name} could not be uploaded.',

    // The reason comes from the server and ends on nothing in particular, so
    // it goes in brackets: the sentence closes either way, and no one has to
    // patch punctuation onto a string someone else wrote.
    failedWith: '{name} could not be uploaded ({reason}).',
    canceled: 'Upload of {name} canceled.',
    retrying: '{name} is being uploaded again.',

    refusedType: '{name} was not accepted — this field takes {accept}.',
    refusedSize: '{name} is too large — {max} per file at most.',
    refusedTotal: '{name} no longer fits — {max} in total at most.',

    attachedNone: 'No file attached.',
    attachedOne: '1 file attached.',
    attachedMany: '{count} files attached.',

    requiredNone: 'Please attach at least one file.',
    busyOne: '1 file is still uploading.',
    busyMany: '{count} files are still uploading.',
    stuckOne: '1 file is not uploaded — try again or remove it.',
    stuckMany: '{count} files are not uploaded — try again or remove them.',
  },
};



// Can a selection be rewritten at all? A FileList cannot be edited, so
// everything the FORM lane does beyond LISTING files goes through a
// DataTransfer: the drop merges into one, and removing a file writes one back.
// Where it cannot be constructed there is no honest drop zone and no remove
// control to offer, and that lane falls back to naming what the picker chose
// (see SelectionList.canDrop). The upload lane needs none of this — its files
// go to an XHR, not back into the field. Asked once per page: a fact about the
// engine, not about an element.
const canRewriteSelection = (() => {
  try {
    return typeof new DataTransfer().items?.add === 'function';
  } catch {
    return false;
  }
})();



// ============================================================================
// The box: everything both lanes share
// ============================================================================
//
// The drop zone, the list, the running total, the status line, the limits and
// the focus a removal owes. What it deliberately does NOT know is who carries
// the bytes — that is the whole of the difference between the two subclasses,
// and it is asked through four hooks: intake(), sync(), canDrop() and the
// optional claim() / teardown().

class UploadBox {

  constructor(root, params, reporter, setup) {
    this.root = root;
    this.params = params;
    this.reporter = reporter;
    this.field = setup.field;
    this.destroyed = false;

    // What just happened, in words, for the one status write that follows it.
    // Held rather than written straight out because a write describes the
    // whole box, and this is the one thing it cannot read off the box itself.
    // Added to through note(), never assigned: one gesture can produce two
    // sentences — a drop carrying a folder AND a file of the wrong type — and
    // the second must not overwrite the first.
    this.pendingNotice = '';

    // Where the focus has to go once the control that was pressed is gone —
    // the index of its row, which after a removal is the row that takes its
    // place and after a retry is the same row again. Null on every write
    // nobody asked for by pressing a control.
    this.focusIndex = null;

    const locale = resolveLocale(Object.keys(labels), params.fallbackLocale);
    this.labels = labels[locale];

    // The page's own language for the sizes and the percentages too, so "1,2
    // MB" and "1.2 MB" follow the same <html lang> the wording above does. An
    // empty attribute leaves the choice to the browser, which is the right
    // default and the one Intl makes for undefined.
    this.intlLocale = document.documentElement.lang || undefined;
  }



  // Construction and starting are two steps on purpose. A subclass's methods
  // are class fields, and those are initialized only AFTER this class's
  // constructor body has run — so nothing here may call one. init() therefore
  // constructs first and starts second, by which time the lane is whole.
  start = () => {
    this.build();
    this.startListening();
    this.claim?.();
    this.sync();

    // Last, and only in a lane that can receive a drop: this attribute is what
    // makes the box invite one. readMore sets its ready attribute first for the
    // opposite reason — there it LIFTS a hiding rule, so anything before it
    // would risk leaving content hidden; here it makes a promise, so nothing
    // may precede the listeners that keep it.
    if (this.canDrop()) this.root.setAttribute(this.params.readyAttr, '');
  };



  // The three nodes the markup cannot carry, because each only ever describes
  // what a reader has just handed over: the list, the running total against a
  // total limit, and the line that states the outcome. Appended to the root, so
  // all three sit inside the drop zone and a drop over them counts.
  build = () => {
    const { params } = this;

    this.list = document.createElement('ul');
    this.list.className = params.listClass;
    this.list.setAttribute(params.listAttr, '');

    // Stated because the stylesheet takes the bullets off, and WebKit reads
    // "list-style: none" as "this is no longer a list" — the rows would lose
    // their count and their position with it. The same role="list" the index
    // page carries on its own board lists.
    this.list.setAttribute('role', 'list');

    // The running total, and deliberately NOT a live region: it is a standing
    // fact about the selection rather than an event, and role="status" would
    // have "12,4 MB of 20 MB" read out after every single file. What has to be
    // announced is the limit being reached, and that is the notice's job.
    this.total = document.createElement('p');
    this.total.className = params.totalClass;
    this.total.setAttribute(params.totalAttr, '');

    // Polite, visible, and the only channel: a sighted reader and a screen
    // reader are told the same thing by the same node, so the two sentences
    // cannot drift apart. Never assertive — a file arriving is not an
    // interruption.
    this.notice = document.createElement('p');
    this.notice.className = params.noticeClass;
    this.notice.setAttribute(params.noticeAttr, '');
    this.notice.setAttribute('role', 'status');
    this.notice.setAttribute('aria-live', 'polite');

    this.root.append(this.list, this.total, this.notice);
  };



  startListening = () => {

    // The picker, a drop on the control itself, and the form lane's own writes
    // to the field all arrive as one event — which is what makes each lane's
    // rendering single-pathed.
    this.field.addEventListener('change', this.handleChange);
    this.list.addEventListener('click', this.handleListClick);

    // Only where a drop can actually be acted on. In the form lane without a
    // DataTransfer the dropped files could not be written to the field, so
    // claiming the drop would swallow it: better to leave it to the control,
    // which takes a drop on itself without any help (see the file header).
    if (this.canDrop()) {
      this.root.addEventListener('dragover', this.handleDragOver);
      this.root.addEventListener('dragleave', this.handleDragLeave);
      this.root.addEventListener('drop', this.handleDrop);
    }

    // A reset is dispatched on the FORM and does not bubble up from the
    // controls it resets, so that is where the listener goes.
    this.form = this.field.form;
    this.form?.addEventListener('reset', this.handleReset);
  };



  // ---------------------------------------------------------------- limits --

  // Both limits from the field, on every pass rather than at construction —
  // the same reading matchesAccept() gives the accept attribute, and for the
  // same reason: a project may tighten either one while the page is open.
  // parseByteSize turns "5MB" into bytes and anything unusable into null,
  // which is what "no limit" is spelled as everywhere below.
  readLimits = () => {
    const { field, params } = this;

    return {
      maxSize: parseByteSize(field.getAttribute(params.maxSizeAttr)),
      maxTotal: parseByteSize(field.getAttribute(params.maxTotalAttr)),
    };
  };



  // The running total, and only where a total limit exists to measure it
  // against: "12,4 MB of 20 MB" states the budget while there is still room,
  // instead of the component staying silent until it has been spent.
  //
  // A line of text and not a second bar, deliberately: in the upload lane the
  // bars in the rows are about bytes on their way to a server, and a bar here
  // would be about a budget. Two bars meaning two different things in one box
  // is one too many.
  //
  // "exceeded" is only ever true in the form lane — the upload lane refuses a
  // file that would not fit instead of taking it in (see TransferQueue.refuse).
  renderTotal = (count, bytes, maxTotal, exceeded) => {
    const show = Boolean(maxTotal) && count > 0;

    this.total.hidden = !show;
    this.total.toggleAttribute(this.params.exceededAttr, show && exceeded);

    if (!show) {
      this.total.textContent = '';
      return;
    }

    this.total.textContent = formatTemplate(this.labels.total, {
      total: this.formatSize(bytes),
      max: this.formatSize(maxTotal),
    });
  };



  // ---------------------------------------------------------------- status --

  // What the status line says: what just happened, what the box holds now, and
  // what is wrong with it. Separate messages, because they vary independently —
  // and an empty box nobody has touched yet says nothing at all, since "no file
  // selected" is the resting state of every file field on the web and needs no
  // announcing.
  //
  // The problems come last on purpose: they are the sentence the reader has to
  // act on, and a live region reads to the end.
  writeNotice = (count, prefix, extra = []) => {
    const quiet = !count && !this.pendingNotice;

    this.notice.textContent = quiet
      ? ''
      : [this.pendingNotice, this.countText(count, prefix), ...extra]
        .filter(Boolean)
        .join(' ');

    this.pendingNotice = '';
  };



  // One more sentence for the next status write. Added rather than assigned,
  // because the occasions that have something to say are not exclusive: a
  // single drop can carry a folder and a file of the wrong type, and the two
  // are found in different places (handleDrop and each lane's intake).
  note = (text) => {
    if (!text) return;

    this.pendingNotice =
      this.pendingNotice ? `${this.pendingNotice} ${text}` : text;
  };



  // "2 files selected." / "2 files attached." — the two lanes count different
  // things, so each names its own set of three templates by prefix.
  countText = (count, prefix) => {
    const { labels } = this;

    if (count > 1) return formatTemplate(labels[`${prefix}Many`], { count });
    return count ? labels[`${prefix}One`] : labels[`${prefix}None`];
  };



  // Every size in this component goes through here, so the page's language is
  // stated once rather than at each of the places that print one.
  formatSize = (bytes) => formatByteSize(bytes, this.intlLocale);



  // Pressing a row's control takes the element the focus was on away, so it
  // has to be put somewhere deliberate: the control that moved up into the
  // freed place, the last one where the freed place was the last one, and the
  // field itself once no row is left. Two presses do that — a removal, which
  // takes the whole row, and a retry, which hides its own button the moment
  // the row stops being failed (there the index is the same row, and the
  // control at it is the one that now says "cancel"). Only ever after a press:
  // focusIndex is set by those two and by nothing else, so a write caused by
  // the picker or by a drop never moves the focus.
  restoreFocus = (controls) => {
    const index = this.focusIndex;
    this.focusIndex = null;

    if (index === null) return;

    if (!controls.length) {
      this.field.focus();
      return;
    }

    controls[Math.min(index, controls.length - 1)]?.focus();
  };



  // ------------------------------------------------------------------ drag --

  // Is this drag one this box could take? Two questions, and both have to be
  // asked before the drop is claimed: a drag of selected text or of a link
  // carries no file and must be left to the page, and a disabled field takes
  // nothing at all.
  //
  // "types" is a frozen array in current engines and a DOMStringList in older
  // ones, so the check is borrowed rather than called on it.
  canAccept = (event) => {
    const types = event.dataTransfer?.types;
    if (!types) return false;
    if (this.field.disabled) return false;

    return Array.prototype.includes.call(types, 'Files');
  };



  // preventDefault() here is not a nicety: without it the drop is refused,
  // because the platform's default for a dragover is "this is not a drop
  // target". dropEffect makes the pointer say "copy" rather than "move" —
  // nothing leaves the reader's disk.
  handleDragOver = (event) => {
    if (!this.canAccept(event)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';

    this.setDragging(true);
  };



  // dragleave fires on every step from one child to the next as well, so the
  // state may only be dropped when the pointer has really left the box.
  // relatedTarget is where it went — null when it left the window entirely,
  // which contains() answers with false, which is the right answer.
  handleDragLeave = (event) => {
    if (this.root.contains(event.relatedTarget)) return;

    this.setDragging(false);
  };



  // preventDefault() again, and this time it is what keeps the reader on the
  // page: the browser's default for a dropped file is to open it, which
  // abandons a half-filled form.
  handleDrop = (event) => {
    if (!this.canAccept(event)) return;

    event.preventDefault();
    this.setDragging(false);

    const { files, folders } = this.splitDrop(event.dataTransfer);
    if (!files.length && !folders.length) return;

    // Before intake(), which adds its own sentences to the same notice: a
    // drop can carry a folder and a file of the wrong type at once.
    this.note(this.folderText(folders));

    // Even with nothing left to take in — a drop of folders alone still has
    // something to say, and both lanes' intake() write the notice when they
    // are handed an empty list (see SelectionList.intake / TransferQueue's).
    this.intake(files);
  };



  // A dropped FOLDER, sorted out of what the drop carries. It is the one
  // thing a drop can bring that the picker never produces — a file input
  // without "webkitdirectory" cannot yield a directory — and it arrives in
  // "files" looking almost like an empty file, so it would otherwise become a
  // row naming a folder and, in the upload lane, a transfer that fails on the
  // first read.
  //
  // Three things this has to get right:
  //   - Ask the ENTRY, not the file. "size === 0 && type === ''" is what a
  //     folder looks like, and so is an empty file with no extension.
  //   - Ask it HERE. The DataTransfer is only alive while the event is being
  //     dispatched, so webkitGetAsEntry() has to be called synchronously —
  //     there is nothing left to ask a frame later.
  //   - Only ever discard on an explicit isDirectory. A synthetic
  //     DataTransfer answers null in Chromium (measured) and an entry in
  //     WebKit, so "no entry" must mean "not a folder" or a programmatic drop
  //     would lose every file in one of the two engines.
  //
  // items[] and files[] run parallel for kind === "file"; where that does not
  // add up, nothing is filtered rather than guessed at.
  splitDrop = (transfer) => {
    const files = Array.from(transfer.files);
    const items = transfer.items;

    if (!items) return { files, folders: [] };

    const entries = Array.prototype.filter.call(
      items, (item) => item.kind === 'file'
    );

    if (entries.length !== files.length) return { files, folders: [] };

    const folders = [];

    const kept = files.filter((file, index) => {
      if (!entries[index].webkitGetAsEntry?.()?.isDirectory) return true;

      folders.push(file.name);
      return false;
    });

    return { files: kept, folders };
  };



  // What was turned away for being a folder, and what to do instead. Its own
  // sentence rather than the accept one: "this field takes application/pdf"
  // would be a wrong reason, since no accept value would have let a directory
  // in.
  folderText = (names) => {
    if (!names.length) return '';

    const template = names.length > 1
      ? this.labels.folderMany
      : this.labels.folderOne;

    return formatTemplate(template, {
      count: names.length,
      names: names.join(', '),
    });
  };



  setDragging = (dragging) => {
    this.root.toggleAttribute(this.params.draggingAttr, dragging);
  };



  // --------------------------------------------------------------- teardown --

  // Optional teardown for hosts that mount/unmount the same subtree
  // repeatedly — see destroyModulesInScope() in boot.js. The reset listener
  // sits on the form and the three injected nodes are the field's siblings, so
  // a second init() on kept markup would otherwise find a second list and a
  // second status region describing the same files. The two attributes go too:
  // the ready one because it promises a drop zone this instance no longer
  // serves, the dragging one because a drag that was over the box when the
  // subtree went is over nothing now.
  //
  // And the custom validity goes back, which is the one thing written onto the
  // FIELD rather than into this module's own nodes: a message left behind would
  // block a form with a demand whose author is no longer here to explain it.
  //
  // Whatever a lane holds beyond that is handed back by its own teardown().
  destroy = () => {
    this.destroyed = true;

    this.teardown?.();

    this.form?.removeEventListener('reset', this.handleReset);

    if (this.field) {
      this.field.removeEventListener('change', this.handleChange);
      this.field.setCustomValidity('');
    }

    this.root.removeEventListener('dragover', this.handleDragOver);
    this.root.removeEventListener('dragleave', this.handleDragLeave);
    this.root.removeEventListener('drop', this.handleDrop);

    this.list?.remove();
    this.total?.remove();
    this.notice?.remove();

    this.root.removeAttribute(this.params.draggingAttr);
    this.root.removeAttribute(this.params.readyAttr);
  };
}



// ============================================================================
// The form lane: the FORM carries the bytes
// ============================================================================
//
// The field's own FileList is the value, and this lane only ever describes it
// and edits it. Nothing is uploaded: the files travel with the form the way
// they always did, and the server stays the only place where a file is really
// checked.

class SelectionList extends UploadBox {

  constructor(root, params, reporter, setup) {
    super(root, params, reporter, setup);

    // A form reset empties the field, and it is the one value change here that
    // fires no change event — so the form's own "reset" has to stand in for it.
    // Deferred to the next frame, because the event is cancelable: while it is
    // being handled the field still holds its files.
    this.handleReset = rafThrottle(this.sync);
  }



  // A drop can only be acted on where the selection can be rewritten, and so
  // can a remove control. Both are the same capability (see
  // canRewriteSelection), so where it is missing this lane falls back to naming
  // what the picker chose — which is still the whole reason it exists.
  canDrop = () => canRewriteSelection;



  // The whole rendering, from the field and nothing else: a FileList is the
  // value that will be submitted, so reading it on every pass is what keeps the
  // list from claiming a file the form does not carry. Every write here is
  // idempotent — the rows are replaced wholesale, the notice is assigned.
  sync = () => {
    if (this.destroyed) return;

    const files = Array.from(this.field.files);
    const limits = this.readLimits();
    const checked = this.checkLimits(files, limits);
    const messages = this.limitText(limits, checked);

    this.list.replaceChildren(
      ...files.map((file) => this.buildItem(file, checked.oversize.has(file)))
    );

    // An empty list is nothing to read and nothing to paint, so it leaves the
    // accessibility tree with the attribute the platform has for exactly that.
    // The stylesheet restores [hidden] over its own display, the way readMore
    // does for its toggle.
    this.list.hidden = !files.length;

    this.renderTotal(
      files.length, checked.bytes, limits.maxTotal, checked.exceeded
    );

    this.writeNotice(files.length, 'selected', messages);

    // Before anything can be submitted, and from the one place that sees every
    // selection change.
    this.syncValidity(messages);

    this.restoreFocus(
      this.list.querySelectorAll(`[${this.params.removeAttr}]`)
    );
  };



  // The limits against the selection: which files are over the per-file one,
  // how much the selection weighs, and whether that is over the total.
  //
  // Both violations are reported the same way — the file STAYS where the reader
  // put it, the row says why, and the field itself becomes invalid (see
  // syncValidity). Removing it instead would take away what they just chose,
  // leave a single-file field reading "no file chosen", and work only in an
  // engine that can rewrite a selection at all; a constraint that the platform
  // enforces for us needs none of that. The upload lane refuses such a file
  // outright, and for a reason that does not apply here: there a row means a
  // transfer, here it means the field's own value.
  checkLimits = (files, limits) => {
    const oversize = limits.maxSize
      ? files.filter((file) => file.size > limits.maxSize)
      : [];

    const bytes = files.reduce((sum, file) => sum + file.size, 0);

    return {
      oversize: new Set(oversize),
      oversizeNames: oversize.map((file) => file.name),
      bytes,
      exceeded: Boolean(limits.maxTotal) && bytes > limits.maxTotal,
    };
  };



  // What the limits have to say, as whole sentences — one list for both
  // channels that need them: the status line the reader sees and the validation
  // message the browser shows on submit. Composed once, so what is announced
  // and what blocks the form cannot say two different things.
  limitText = (limits, checked) => {
    const { labels } = this;
    const messages = [];
    const names = checked.oversizeNames;

    if (names.length) {
      const template = names.length > 1
        ? labels.oversizeMany
        : labels.oversizeOne;

      messages.push(formatTemplate(template, {
        count: names.length,
        names: names.join(', '),
        max: this.formatSize(limits.maxSize),
      }));
    }

    if (checked.exceeded) {
      messages.push(formatTemplate(labels.totalExceeded, {
        total: this.formatSize(checked.bytes),
        max: this.formatSize(limits.maxTotal),
      }));
    }

    return messages;
  };



  // The one piece of validation this lane adds, and it adds it THROUGH the
  // platform: setCustomValidity() makes the field invalid, so the form refuses
  // to send, the browser writes the message next to the control, and everything
  // downstream keeps working off the standard — validity, validationMessage,
  // and formValidation, which honours an author-set custom message above every
  // message of its own. No submit handler here, no second copy of the rule.
  //
  // Cleared with an empty string on every pass that finds nothing wrong: custom
  // validity is sticky, and a message left behind would block a form whose
  // files are all within the limits now.
  syncValidity = (messages) => {
    this.field.setCustomValidity(messages.join(' '));
  };



  // The notice for the selection as it stands, without touching the rows — for
  // the one occasion that has something to say and nothing to change (a drop in
  // which every file was rejected, see intake). A full pass would write the
  // same sentence, but it would replace the rows on the way, and with them the
  // remove button a keyboard reader may be standing on.
  refreshNotice = () => {
    const files = Array.from(this.field.files);
    const limits = this.readLimits();
    const messages = this.limitText(limits, this.checkLimits(files, limits));

    this.writeNotice(files.length, 'selected', messages);
  };



  // ------------------------------------------------------------------ rows --

  // One row: the name, the size, why it is a problem where it is one, and —
  // where a selection can be rewritten at all — the control that takes this
  // file back out. textContent throughout: a file name comes from outside the
  // page and is never markup.
  buildItem = (file, oversize) => {
    const { params } = this;

    const item = document.createElement('li');
    item.className = params.itemClass;
    item.setAttribute(params.itemAttr, '');

    const name = document.createElement('span');
    name.className = params.nameClass;
    name.textContent = file.name;

    const size = document.createElement('span');
    size.className = params.sizeClass;
    size.textContent = this.formatSize(file.size);

    item.append(name, size);

    // The word comes before the control, so the row reads "video.mp4, 82 MB,
    // too large, remove video.mp4" in the order the eye takes it in.
    if (oversize) {
      item.setAttribute(params.stateAttr, states.oversize);
      item.append(this.buildFlag());
    }

    if (!canRewriteSelection) return item;

    item.append(this.buildRemove(file));
    return item;
  };



  // Why this row is a problem, next to the size that makes it one. A word and
  // not merely a tone: the row's edge changes colour as well, and colour on its
  // own is not a signal (WCAG 1.4.1) — nor is it one in a forced-colors
  // context, where the palette is replaced wholesale. It is the same element
  // the upload lane puts its state in, for the same reason.
  //
  // The limit itself is not repeated here. Three oversize rows would state it
  // three times; the status line names it once, and the browser names it again
  // on the field when the form is submitted.
  buildFlag = () => {
    const flag = document.createElement('span');
    flag.className = this.params.stateClass;
    flag.textContent = this.labels.tooLarge;

    return flag;
  };



  // The remove control. A real button, because that is what it is, and typed
  // explicitly: these rows sit inside a form, where an untyped button submits
  // it.
  //
  // Its name is a text node rather than an aria-label — the same reason
  // _visuallyHidden.scss gives: a name in the DOM still reads when the
  // stylesheet never arrives, and it names the file, because "Remove" three
  // times in a row tells a screen-reader user nothing about which one.
  buildRemove = (file) => {
    const { params } = this;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = params.removeClass;
    button.setAttribute(params.removeAttr, '');

    const label = document.createElement('span');
    label.className = params.controlLabelClass;
    label.textContent = formatTemplate(this.labels.remove, { name: file.name });

    button.append(label);
    return button;
  };



  // ---------------------------------------------------------------- intake --

  // What a drop or a pick does to the selection. Three decisions in order, and
  // each of them is the field's own attribute answering, not this module's
  // policy:
  //
  //   - "accept" decides what may join at all. A file the picker would never
  //     have offered has no business arriving through the back door, and the
  //     reader is told which one and why rather than watching it vanish.
  //   - "multiple" decides whether the drop appends or replaces. A field that
  //     takes one file takes the first of what was dropped on it.
  //   - the files already there decide what a repeat adds: the same file
  //     dropped twice is the same file, and a FileList that carried it twice
  //     would upload it twice. Name, size and timestamp together are as close
  //     to an identity as a File gets.
  intake = (dropped) => {
    const accepted = [];
    const rejected = [];

    // The field's own accept list, read on every drop rather than at
    // construction: a project may narrow it while the page is open. Empty
    // means the field takes anything, which is what an absent attribute says.
    const accept = this.field.accept;

    dropped.forEach((file) => {
      (matchesAccept(file, accept) ? accepted : rejected).push(file);
    });

    const multiple = this.field.multiple;
    const kept = multiple ? Array.from(this.field.files) : [];
    const keys = new Set(kept.map(fileKey));

    accepted.forEach((file) => {
      if (keys.has(fileKey(file))) return;

      keys.add(fileKey(file));
      kept.push(file);
    });

    const next = multiple ? kept : kept.slice(0, 1);

    this.note(this.rejectionText(rejected));

    // Nothing accepted and nothing to change: a drop of three rejected files
    // still has something to say, so the notice is written on its own here.
    // The pass that would normally do it is driven by the field's change
    // event, and the field is not changing.
    if (!accepted.length) {
      this.refreshNotice();
      return;
    }

    this.setSelection(next);
  };



  // What was turned away, and what the field would have taken instead. The
  // accept attribute is quoted as the author wrote it: it is the only
  // description of the wanted types that exists, and a component that
  // paraphrased it would be inventing one.
  rejectionText = (rejected) => {
    if (!rejected.length) return '';

    const names = rejected.map((file) => file.name).join(', ');
    const accept = this.field.accept;
    const template = rejected.length > 1
      ? this.labels.rejectedMany
      : this.labels.rejectedOne;

    return formatTemplate(template, {
      count: rejected.length,
      names,
      accept,
    });
  };



  // The one write to the field, and the platform's own way of doing it: a
  // FileList cannot be edited, but it can be replaced by the one a
  // DataTransfer holds.
  //
  // The change event is dispatched by hand because assigning "files" fires
  // none — and everything downstream is listening for it: this lane's own
  // rendering, a project's upload preview, formValidation re-checking a
  // required field. It bubbles, for the same reason: a form-level listener has
  // to hear it the way it hears the picker.
  setSelection = (files) => {
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));

    this.field.files = transfer.files;
    this.field.dispatchEvent(new Event('change', { bubbles: true }));
  };



  removeAt = (index) => {
    const files = Array.from(this.field.files);
    const [removed] = files.splice(index, 1);

    if (!removed) return;

    this.note(formatTemplate(this.labels.removed, { name: removed.name }));

    // The freed place is where the focus goes once the row is gone (see
    // restoreFocus), and the pass that follows the change event below is where
    // it happens.
    this.focusIndex = index;

    this.setSelection(files);
  };



  // ------------------------------------------------------------- listeners --

  handleChange = () => {
    this.sync();
  };



  // Delegated, because the rows are replaced on every pass and a listener per
  // button would have to be attached again each time. The row's position is the
  // index: the list is built from the FileList in order, so what the reader
  // sees third is the third file.
  handleListClick = (event) => {
    const { params } = this;

    const button = event.target.closest?.(`[${params.removeAttr}]`);
    if (!button) return;

    const item = button.closest(`[${params.itemAttr}]`);
    const index = Array.prototype.indexOf.call(this.list.children, item);

    if (index < 0) return;

    this.removeAt(index);
  };
}



// ============================================================================
// The upload lane: THIS MODULE carries the bytes
// ============================================================================
//
// The field is only the picker here and is emptied on every intake; the queue
// is what the box holds. Each file goes out on its own XHR, the row shows how
// far it has got, and the form ends up carrying the handles the server returned
// instead of the files themselves.

class TransferQueue extends UploadBox {

  constructor(root, params, reporter, setup) {
    super(root, params, reporter, setup);

    this.url = setup.url;
    this.handleName = setup.handleName;

    // One record per row, in the order the rows are shown. This — and not the
    // field — is what the queue is.
    this.records = [];

    // What is already in the queue, so the same file picked twice is one row
    // (fileKey). Kept alongside the records rather than derived from them,
    // because it is asked once per intaken file.
    this.keys = new Set();

    this.percentFormatter = this.buildPercentFormatter();

    this.part = (root.getAttribute(params.partAttr) || '').trim() || params.part;
    this.key = (root.getAttribute(params.keyAttr) || '').trim() || params.key;
    this.deleteUrl = (root.getAttribute(params.deleteUrlAttr) || '').trim();
    this.token = (root.getAttribute(params.tokenAttr) || '').trim();
    this.tokenHeader =
      (root.getAttribute(params.tokenHeaderAttr) || '').trim() ||
      params.tokenHeader;

    // At least one, whatever the markup says: a cap of zero would be a queue
    // that never starts anything.
    this.concurrency = Math.max(
      1,
      Math.round(parseNonNegative(
        root.getAttribute(params.concurrencyAttr), params.concurrency
      ))
    );
  }



  // Nothing has to be written back into the field here — the dropped files go
  // straight to an XHR — so this lane can take a drop in any engine.
  canDrop = () => true;



  // The bytes must not travel twice. From here on the form carries handles and
  // the field is only a picker, so its name comes off and teardown() puts it
  // back. Called from start(), which only runs once the lane has been chosen:
  // a box that could not be configured as a queue never gets this far and
  // leaves a field that still posts (see chooseLane).
  claim = () => {
    this.fieldName = this.field.name;
    this.field.removeAttribute('name');

    // "required" has to move here too, and for a reason that would otherwise be
    // a trap: the field is EMPTIED on every intake (see handleChange), so a
    // field that still carried the attribute would refuse the form forever, no
    // matter how many files are attached. The author's meaning — "at least one
    // file" — is kept and answered by syncValidity from the queue instead.
    this.fieldRequired = this.field.required;
    this.field.required = false;
  };



  // ---------------------------------------------------------------- intake --

  // The picker. The field is emptied straight away: the bytes leave through
  // XHR and the field carries no name any more, so its own FileList has no
  // further job — and a field still holding a file would report no change when
  // the same file is picked again after being taken out of the queue.
  handleChange = () => {
    const files = Array.from(this.field.files);

    this.field.value = '';
    this.intake(files);
  };



  // Everything that arrives, from either direction, comes through here. Three
  // questions per file, in order, and the first two are the field's own
  // attributes answering rather than this module's policy:
  //
  //   - "accept" decides what may join at all. A dropped file the picker would
  //     never have offered has no business arriving through the back door, and
  //     the reader is told which one and why.
  //   - the size limits decide what is worth starting. A file over the limit is
  //     refused here and not uploaded-then-rejected: the point of checking in
  //     the browser is to not spend two minutes sending something the server
  //     will throw away.
  //   - the queue decides what is new. The same file twice is one row.
  //
  // A refused file gets no row, unlike in the form lane: there, the file IS the
  // field's value and taking it away would leave the reader with nothing to
  // look at. Here a row means a transfer, and a file that will never be sent is
  // not one — so it is announced instead.
  intake = (files) => {
    const accept = this.field.accept;
    const limits = this.readLimits();
    const refusals = [];

    // A single-file field replaces rather than appends, the way its own picker
    // always did. Whatever is there goes first, transfer and handle included.
    if (!this.field.multiple && files.length) this.clearQueue();

    const incoming = this.field.multiple ? files : files.slice(0, 1);
    let total = this.queuedBytes();

    incoming.forEach((file) => {
      const refusal = this.refuse(file, accept, limits, total);

      if (refusal) {
        refusals.push(refusal);
        return;
      }

      const key = fileKey(file);
      if (this.keys.has(key)) return;

      this.keys.add(key);
      total += file.size;
      this.addRecord(file);
    });

    this.note(refusals.join(' '));

    this.pump();
    this.sync();
  };



  // Why this file cannot join, as the sentence the reader gets — or an empty
  // string when it can. The total is passed in rather than read, because within
  // one intake every accepted file has already made the queue heavier.
  refuse = (file, accept, limits, total) => {
    const { labels } = this;

    // The accept attribute is quoted as the author wrote it: it is the only
    // description of the wanted types that exists, and a component that
    // paraphrased it would be inventing one.
    if (!matchesAccept(file, accept)) {
      return formatTemplate(labels.refusedType, { name: file.name, accept });
    }

    if (limits.maxSize && file.size > limits.maxSize) {
      return formatTemplate(labels.refusedSize, {
        name: file.name,
        max: this.formatSize(limits.maxSize),
      });
    }

    if (limits.maxTotal && total + file.size > limits.maxTotal) {
      return formatTemplate(labels.refusedTotal, {
        name: file.name,
        max: this.formatSize(limits.maxTotal),
      });
    }

    return '';
  };



  queuedBytes = () =>
    this.records.reduce((sum, record) => sum + record.file.size, 0);



  // ----------------------------------------------------------------- queue --

  // What may run now. Called after every state change, so a slot freed by a
  // finished, failed or cancelled transfer is filled by the next in line —
  // which is the whole of the scheduling this lane needs.
  pump = () => {
    if (this.destroyed) return;

    const running = this.records.filter(
      (record) => record.state === states.uploading
        || record.state === states.processing
    ).length;

    const free = this.concurrency - running;
    if (free <= 0) return;

    this.records
      .filter((record) => record.state === states.queued)
      .slice(0, free)
      .forEach(this.startTransfer);
  };



  // One transfer. XMLHttpRequest and not fetch(), for the one reason given in
  // the file header: fetch cannot report how far a request body has got, and
  // that number is this lane's entire purpose.
  startTransfer = (record) => {
    const data = new FormData();

    // The third argument keeps the original file name in the multipart part,
    // which is what a server reads it from.
    data.append(this.part, record.file, record.file.name);

    const xhr = new XMLHttpRequest();

    record.xhr = xhr;
    record.state = states.uploading;
    record.loaded = 0;
    record.error = '';

    xhr.open('POST', this.url);

    // Let XHR parse the answer: a body that is not JSON then arrives as null
    // and is handled as a failure, with no try/catch around a JSON.parse of
    // what may well be an HTML error page.
    xhr.responseType = 'json';

    // Same-origin cookies ride along on their own; a token has to be asked
    // for. Set after open() and before send(), which is the only window the
    // API allows.
    if (this.token) xhr.setRequestHeader(this.tokenHeader, this.token);

    xhr.upload.addEventListener('progress', (event) => {
      this.handleProgress(record, event);
    });

    // The last byte has left the browser. NOT "the server is done": that is
    // the wait this state exists to be honest about (see the file header).
    xhr.upload.addEventListener('load', () => {
      this.handleSent(record);
    });

    xhr.addEventListener('load', () => this.handleResponse(record));
    xhr.addEventListener('error', () => this.fail(record));

    // Deliberately no timeout: a large file on a slow line is slow, not
    // broken, and a transfer this module cut off after N seconds would look
    // exactly like a server that refused it.

    xhr.send(data);
    this.updateRow(record);
  };



  handleProgress = (record, event) => {
    if (this.destroyed) return;

    // Without a computable length there is no fraction to show, and the bar
    // stays indeterminate rather than inventing one.
    if (!event.lengthComputable) return;

    record.loaded = event.loaded;
    record.total = event.total;

    this.updateRow(record);
  };



  handleSent = (record) => {
    if (this.destroyed) return;
    if (record.state !== states.uploading) return;

    record.state = states.processing;
    this.updateRow(record);
  };



  // The answer. Two things have to be true for a file to count as uploaded: a
  // 2xx, and a handle in the body — because a handle is what the form will
  // carry, and a 200 with nothing in it leaves this lane with a row it cannot
  // submit.
  handleResponse = (record) => {
    if (this.destroyed) return;

    const xhr = record.xhr;
    record.xhr = null;

    const body = xhr.response;
    const ok = xhr.status >= 200 && xhr.status < 300;

    // Stringified before it is judged, so a numeric handle of 0 is a handle
    // and not a missing one — and an empty string still counts as missing,
    // which it is: nothing would travel in the hidden input.
    const raw = body?.[this.key];
    const handle = raw == null ? '' : String(raw);

    if (!ok || !handle) {

      // A server-supplied message is shown as it stands — it is the only
      // description of what went wrong that anyone actually wrote.
      this.fail(record, body?.error, ok
        ? `answered ${xhr.status} without a "${this.key}" in the body`
        : `answered ${xhr.status}`);
      return;
    }

    record.state = states.done;
    record.handle = handle;

    this.note(
      formatTemplate(this.labels.uploaded, { name: record.file.name })
    );

    this.updateRow(record);
    this.pump();
    this.sync();
  };



  // A failure the reader can act on: the row keeps the File, so Retry is a real
  // offer rather than "choose it again".
  //
  // "detail" is for the console and never for the reader — a contract broken by
  // the endpoint (a 500, a body without a handle) is an author's problem and
  // belongs where an author looks. A plain network error passes no detail and
  // reports nothing: there is nothing for anyone to fix in the code.
  fail = (record, reason, detail) => {
    if (this.destroyed) return;

    record.xhr = null;
    record.state = states.failed;
    record.error = (reason || '').trim();

    this.note(record.error
      ? formatTemplate(this.labels.failedWith, {
        name: record.file.name,
        reason: record.error,
      })
      : formatTemplate(this.labels.failed, { name: record.file.name }));

    if (detail) {
      this.reporter?.report(
        'fileUpload',
        `POST ${this.url} ${detail} — "${record.file.name}" was not stored.`,
        { el: this.root }
      );
    }

    this.updateRow(record);
    this.pump();
    this.sync();
  };



  // ------------------------------------------------------------------ rows --

  addRecord = (file) => {
    const record = {
      file,
      state: states.queued,
      loaded: 0,
      total: file.size,
      handle: '',
      error: '',
      xhr: null,
      nodes: null,
    };

    this.records.push(record);
    this.buildRow(record);
    this.list.append(record.nodes.item);
    this.updateRow(record);

    return record;
  };



  // A row is built once and then only updated (see updateRow). Rebuilding it on
  // every progress event would restart the <progress> element and drop the focus
  // of a reader who is standing on its Cancel control — which is why this lane
  // keeps records where the form lane simply reads the field.
  //
  // textContent throughout: a file name comes from outside the page and is
  // never markup.
  buildRow = (record) => {
    const { params } = this;

    const item = document.createElement('li');
    item.className = params.itemClass;
    item.setAttribute(params.itemAttr, '');

    const name = document.createElement('span');
    name.className = params.nameClass;
    name.id = uniqueId('fileUpload-name');
    name.textContent = record.file.name;

    const size = document.createElement('span');
    size.className = params.sizeClass;
    size.textContent = this.formatSize(record.file.size);

    // The platform's own progress bar, named by the file name next to it:
    // "photo.jpg, 42 %" rather than a nameless bar repeated per row.
    const progress = document.createElement('progress');
    progress.className = params.progressClass;
    progress.max = 1;
    progress.setAttribute('aria-labelledby', name.id);

    const state = document.createElement('span');
    state.className = params.stateClass;

    const remove = this.buildControl(params.removeClass, params.removeAttr);
    const retry = this.buildControl(params.retryClass, params.retryAttr);

    // Retry SHOWS a word where remove shows a cross: "try this one again" has
    // no glyph everybody reads the same way, and the row already has one icon
    // control. The word is aria-hidden because the button is already named
    // after its file by the text node beside it — without that, a reader would
    // hear "Retry, Upload photo.jpg again".
    const retryWord = document.createElement('span');
    retryWord.className = params.retryWordClass;
    retryWord.setAttribute('aria-hidden', 'true');
    retryWord.textContent = this.labels.retryWord;
    retry.button.append(retryWord);

    item.append(name, size, progress, state, retry.button, remove.button);

    record.nodes = {
      item,
      name,
      progress,
      state,
      remove: remove.button,
      removeLabel: remove.label,
      retry: retry.button,
      retryLabel: retry.label,
      handle: null,
    };
  };



  // A control. A real button, and typed explicitly: these rows sit inside a
  // form, where an untyped button submits it.
  //
  // Its name is a text node rather than an aria-label — the same reason
  // _visuallyHidden.scss gives: a name in the DOM still reads when the
  // stylesheet never arrives, and it names the file, because "Cancel" three
  // times in a row says nothing about which transfer.
  buildControl = (className, attribute) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.setAttribute(attribute, '');

    const label = document.createElement('span');
    label.className = this.params.controlLabelClass;

    button.append(label);

    return { button, label };
  };



  // Everything a row shows, derived from its record and written idempotently,
  // so calling this after any change is always safe and never accumulates.
  updateRow = (record) => {
    const { params, labels } = this;
    const { nodes } = record;

    nodes.item.setAttribute(params.stateAttr, record.state);

    this.updateProgress(record);

    nodes.state.textContent = this.stateText(record);

    // While a transfer is running, taking the row out means cancelling it —
    // the same control, a different promise, so a different name.
    const busy = busyStates.includes(record.state);
    nodes.removeLabel.textContent = formatTemplate(
      busy ? labels.cancel : labels.remove, { name: record.file.name }
    );

    nodes.retry.hidden = record.state !== states.failed;
    nodes.retryLabel.textContent =
      formatTemplate(labels.retry, { name: record.file.name });

    this.updateHandle(record);
  };



  // The bar, in the three shapes it has: a fraction while bytes are moving,
  // indeterminate once they have all gone and the server has not answered
  // yet — that is what a <progress> without a value IS — and gone once the row
  // has reached a resting state, where a full bar would say "working" for
  // something that is finished.
  updateProgress = (record) => {
    const progress = record.nodes.progress;
    const resting = record.state === states.done
      || record.state === states.failed;

    progress.hidden = resting;

    if (record.state === states.processing) {
      progress.removeAttribute('value');
      return;
    }

    const fraction = record.total ? record.loaded / record.total : 0;
    progress.value = Math.min(1, Math.max(0, fraction));
  };



  // The state in words. A percentage while it is moving — through Intl, so the
  // separator and the sign's position are the reader's own — and a named state
  // otherwise. This is what makes the row readable without the colour, in a
  // forced-colors context, and out loud.
  stateText = (record) => {
    const { labels } = this;

    if (record.state === states.queued) return labels.stateQueued;
    if (record.state === states.processing) return labels.stateProcessing;
    if (record.state === states.done) return labels.stateDone;
    if (record.state === states.failed) return labels.stateFailed;

    const fraction = record.total ? record.loaded / record.total : 0;
    return this.formatPercent(fraction);
  };



  // The handle, as the hidden input that carries it into the form. It lives
  // INSIDE its own row, so a row and the value it stands for are one thing:
  // removing the row removes the handle, and no bookkeeping can drift.
  updateHandle = (record) => {
    const { nodes } = record;
    const wanted = record.state === states.done && record.handle;

    if (!wanted) {
      nodes.handle?.remove();
      nodes.handle = null;
      return;
    }

    if (!nodes.handle) {
      nodes.handle = document.createElement('input');
      nodes.handle.type = 'hidden';
      nodes.item.append(nodes.handle);
    }

    nodes.handle.name = this.handleName;
    nodes.handle.value = record.handle;
  };



  // --------------------------------------------------------------- removal --

  // A reader pressing a row's control. The freed place is where the focus goes
  // (see restoreFocus), and the sync() below is where that happens.
  removeAt = (index) => {
    const record = this.records[index];
    if (!record) return;

    const wasBusy = busyStates.includes(record.state);

    this.takeOut(index);

    this.note(formatTemplate(
      wasBusy ? this.labels.canceled : this.labels.removed,
      { name: record.file.name }
    ));

    this.focusIndex = index;

    this.pump();
    this.sync();
  };



  // Taking a row out, whatever state it was in: a running transfer is aborted
  // (the socket really closes), an uploaded file is reported to the server where
  // a delete URL was given, and the record, its key and its row go.
  //
  // It announces nothing and moves no focus, because it is also how a queue is
  // emptied wholesale — see clearQueue.
  takeOut = (index) => {
    const record = this.records[index];
    if (!record) return;

    record.xhr?.abort();
    record.xhr = null;

    if (record.handle) this.deleteHandle(record.handle);

    this.records.splice(index, 1);
    this.keys.delete(fileKey(record.file));
    record.nodes.item.remove();
  };



  // A single-file field replacing its content, a form reset, and teardown()
  // handing the box back. Silent by design, and it must not touch the focus:
  // replacing a file is not the same act as removing one, and a reader who has
  // just used the picker is not expecting to be put somewhere else.
  clearQueue = () => {
    while (this.records.length) this.takeOut(this.records.length - 1);
  };



  // Tell the server about a file it is now storing for nobody. Optional,
  // because not every backend has a route for it — and even with one, a reader
  // who closes the tab mid-form leaves an orphan behind, so a server that
  // stores uploads before a form is submitted needs an age-based sweep either
  // way (see the readme).
  //
  // fetch() is right here and XHR is not: there is no progress to report on a
  // DELETE, nothing to cancel, and no answer this lane acts on.
  //
  // The handle travels under the same word the server used to hand it over —
  // data-fileupload-key, "id" unless the author says otherwise. One name for
  // one thing in both directions; a fixed "id" here would have an endpoint
  // that answers { "uuid": … } asked about an id it never mentioned.
  deleteHandle = (handle) => {
    if (!this.deleteUrl) return;

    const url = new URL(this.deleteUrl, document.baseURI);
    url.searchParams.set(this.key, handle);

    const headers = this.token ? { [this.tokenHeader]: this.token } : undefined;

    // keepalive, so a delete fired as the page goes away still leaves.
    fetch(url, { method: 'DELETE', headers, keepalive: true })
      .catch(() => {

        // Nothing to do and nothing to say: the reader's file is out of their
        // form, which is what they asked for. The orphan is the server's
        // sweep to make.
      });
  };



  // ------------------------------------------------- status and the form ---

  // Everything that describes the queue as a whole rather than one row: the
  // list's visibility, the running total, the sentence, the form's verdict, and
  // the focus a removal owes. Called after every change, and idempotent
  // throughout.
  sync = () => {
    if (this.destroyed) return;

    const counts = this.counts();

    // An empty list is nothing to read and nothing to paint, so it leaves the
    // accessibility tree with the attribute the platform has for exactly that.
    // The stylesheet restores [hidden] over its own display, the way readMore
    // does for its toggle.
    this.list.hidden = !this.records.length;

    // The budget the next file will be measured against (see refuse), which is
    // why it counts every row and not only the finished ones. Never exceeded:
    // a file that would not fit was refused at the door.
    this.renderTotal(
      this.records.length,
      this.queuedBytes(),
      this.readLimits().maxTotal,
      false
    );

    this.writeNotice(counts.done, 'attached');
    this.syncValidity(counts);

    this.restoreFocus(this.records.map((record) => record.nodes.remove));
  };



  counts = () => {
    const busy = this.records.filter(
      (record) => busyStates.includes(record.state)
    ).length;

    const failed = this.records.filter(
      (record) => record.state === states.failed
    ).length;

    return { done: this.records.length - busy - failed, busy, failed };
  };



  // Why the form may not be sent yet, through the platform's own channel:
  // setCustomValidity() on the visible field makes the browser refuse the
  // submit and write the message next to the control, and formValidation
  // renders it above every message of its own. So there is no submit handler
  // here — nothing to fight over with the project's own, nothing to get wrong
  // about a form this module does not own.
  //
  // Cleared with an empty string the moment the queue is quiet: custom validity
  // is sticky, and a message left behind would block a form whose uploads are
  // all finished.
  syncValidity = ({ done, busy, failed }) => {
    const { labels } = this;
    const messages = [];

    // The author's "required", answered against the queue rather than against
    // the field's own (always empty) files. Only where there is nothing else to
    // say: a failed row already tells the reader what to do about it, and
    // "attach at least one file" on top of that would be two demands for one
    // problem.
    if (this.fieldRequired && !done && !busy && !failed) {
      messages.push(labels.requiredNone);
    }

    if (busy) {
      messages.push(busy > 1
        ? formatTemplate(labels.busyMany, { count: busy })
        : labels.busyOne);
    }

    if (failed) {
      messages.push(failed > 1
        ? formatTemplate(labels.stuckMany, { count: failed })
        : labels.stuckOne);
    }

    this.field.setCustomValidity(messages.join(' '));
  };



  // ------------------------------------------------------------- listeners --

  // Delegated, because a row's controls come and go and a listener per button
  // would have to be attached again each time. The row's position is its index:
  // the list is built from the records in order.
  handleListClick = (event) => {
    const { params } = this;
    const button = event.target.closest?.('button');
    if (!button) return;

    const item = button.closest(`[${params.itemAttr}]`);
    const index = this.records.findIndex(
      (record) => record.nodes.item === item
    );

    if (index < 0) return;

    if (button.hasAttribute(params.retryAttr)) {
      this.retryAt(index);
      return;
    }

    if (button.hasAttribute(params.removeAttr)) this.removeAt(index);
  };



  // A retry takes its own control away: the row stops being failed, and
  // updateRow hides the Retry button the reader is standing on. So it owes the
  // same two things a removal owes — a place for the focus and a sentence.
  //
  // The focus goes to the same index, which here is the same row: the control
  // there is the one that now reads "cancel this upload", which is the only
  // thing left to do about a transfer that has just been started again.
  //
  // And it says so, because the status line would otherwise be cleared by the
  // very press that made it wrong: the failure it was reporting is no longer
  // the state of anything.
  retryAt = (index) => {
    const record = this.records[index];
    if (!record || record.state !== states.failed) return;

    record.state = states.queued;
    record.loaded = 0;
    record.error = '';

    this.note(
      formatTemplate(this.labels.retrying, { name: record.file.name })
    );

    this.focusIndex = index;

    this.updateRow(record);
    this.pump();
    this.sync();
  };



  // Reset means "put this form back the way it was", so the queue goes with
  // it — rows, hidden inputs and, where a delete URL is configured, the files
  // already on the server. Leaving them attached would make Reset a lie.
  //
  // No deferral to the next frame, unlike the form lane's reset handling:
  // nothing here is read back from the field, so it does not matter that the
  // event is cancelable and the field still holds its value while it runs.
  handleReset = () => {
    this.clearQueue();
    this.pump();
    this.sync();
  };



  // Three things here outlive the subtree if they are not handed back: the
  // running transfers (aborted — the rows that would have carried their handles
  // are going, so finishing them would only leave orphans), and the field's
  // name and "required" (put back, so the form posts files again the way it did
  // before this lane took over). The custom validity is cleared by destroy().
  teardown = () => {
    this.records.forEach((record) => record.xhr?.abort());
    this.records = [];
    this.keys.clear();

    if (!this.field) return;

    if (this.fieldName) this.field.name = this.fieldName;
    if (this.fieldRequired) this.field.required = true;
  };



  // --------------------------------------------------------------- format ---

  formatPercent = (fraction) => {
    if (this.percentFormatter) return this.percentFormatter.format(fraction);

    return `${Math.round(fraction * 100)} %`;
  };



  buildPercentFormatter = () => {
    try {
      return new Intl.NumberFormat(this.intlLocale, {
        style: 'percent',
        maximumFractionDigits: 0,
      });
    } catch {
      return null;
    }
  };
}



// Which lane the markup asked for, decided before anything is constructed —
// because it is one decision about the whole box and both lanes need the field
// to make it. Two of the three answers here are "the form carries the bytes":
// no endpoint asks for that lane outright, and an endpoint that cannot be
// wired up falls back to it rather than leaving the box dead. A queue whose
// handles have nothing to travel under would submit an empty request, which is
// worse than a plain, working file field.
const chooseLane = (root, params, reporter) => {
  const field = root.querySelector('input[type="file"]');

  if (!field) {
    reporter?.report(
      'fileUpload',
      'no <input type="file"> in the component root — there is nothing to ' +
      'attach a drop zone to. Put data-js-behavior="fileUpload" on the ' +
      'element WRAPPING the field, not on the field itself.', { el: root }
    );
    return null;
  }

  const url = (root.getAttribute(params.urlAttr) || '').trim();
  if (!url) return { Lane: SelectionList, field };

  // The name the handles will travel under. The field's own name is the default
  // on purpose: the server then sees ONE name either way — files under it
  // without this module, handles under it with it.
  const handleName =
    (root.getAttribute(params.nameAttr) || '').trim() || field.name;

  if (!handleName) {
    reporter?.report(
      'fileUpload',
      `the file field needs a name (or ${params.nameAttr} on the root) for ` +
      `${params.urlAttr} to be of any use — the handles would have nothing ` +
      'to travel under. Uploading is off; the field keeps its files and the ' +
      'form posts them.', { el: root }
    );
    return { Lane: SelectionList, field };
  }

  return { Lane: TransferQueue, field, url, handleName };
};



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'fileUpload',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const setup = chooseLane(el, defaults, reporter);
  if (!setup) return;

  const instance = new setup.Lane(el, defaults, reporter, setup);

  // Constructed and started separately — see UploadBox.start for why.
  instance.start();

  return instance.destroy;
}
