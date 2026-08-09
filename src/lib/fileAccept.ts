/**
 * `accept` strings for the file pickers, in one place so the empty state and
 * the toolbar can never offer different sets — and so adding a format is a
 * single edit rather than a hunt through components.
 *
 * Extensions are listed alongside MIME types on purpose: some platforms report
 * an unhelpful MIME type, or nothing at all, so a MIME-only filter hides files
 * the app can actually read. Drag-and-drop is unfiltered either way —
 * `loadFile` is the real gate.
 */

export const ACCEPT_PDF = 'application/pdf,.pdf'

export const ACCEPT_IMAGES = 'image/jpeg,image/png,.jpg,.jpeg,.png'

/**
 * Everything the app can open, for the single "Add files" picker.
 *
 * One picker rather than one button per format: the per-format buttons made the
 * user choose a category before choosing a file, which is a question only the
 * app cares about — `loadFile` dispatches on the file itself either way. The
 * supported set is shown as labels beneath the button instead, where it informs
 * without gating.
 */
export const ACCEPT_ALL = [ACCEPT_PDF, ACCEPT_IMAGES].join(',')
