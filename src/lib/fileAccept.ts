/**
 * `accept` strings for the file pickers, in one place so the empty state and
 * the toolbar can never offer different sets — and so adding a format is a
 * single edit rather than a hunt through components.
 *
 * Extensions are listed alongside MIME types on purpose: Windows reports
 * `application/vnd.ms-excel` for .csv and nothing at all for some .xlsx files,
 * so a MIME-only filter hides files the app can actually read. Drag-and-drop is
 * unfiltered either way — `loadFile` is the real gate.
 */

export const ACCEPT_PDF = 'application/pdf,.pdf'

export const ACCEPT_IMAGES = 'image/jpeg,image/png,.jpg,.jpeg,.png'

export const ACCEPT_SPREADSHEETS = [
  '.csv',
  '.tsv',
  '.xlsx',
  '.xlsm',
  'text/csv',
  'text/tab-separated-values',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',')

/** Human-readable list shown under the empty state's buttons. */
export const SUPPORTED_FORMATS_LABEL = 'Supports PDF, JPEG, PNG, CSV, and Excel (.xlsx)'
