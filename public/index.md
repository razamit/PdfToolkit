# Free PDF Machine

**Private PDF editor that runs entirely in your browser.** Merge, crop and split
PDFs, fill forms, add page numbers and watermarks, and run English OCR locally.
Document content is never uploaded, and there is no signup, account or cost.

Open it at [freepdfmachine.com](https://freepdfmachine.com/), pick your files, and
start working. There is no upload step, and you can optionally install the app for
offline use after the first online visit.

- **Free.** No paid tier, no trial, no product-added watermark, no page limit.
- **Private.** Files are opened and edited inside your browser tab and never sent
  anywhere. There is no server to store them.
- **No signup.** No email, no account, no login screen.
- **No quality loss.** The exported PDF is rebuilt from the original bytes of the
  file you opened, not from what is drawn on screen.

Accepts PDF, JPEG and PNG. Exports a single PDF.

Office files are not converted, on purpose: Word, PowerPoint and Excel each export
a better PDF than a browser can, with your real fonts and their own layout engine.
Use File → Print → Save as PDF (or File → Export as PDF) there, then open that PDF
here.

## What you can do

| | |
|---|---|
| **Merge** | Combine any number of PDFs and images into one document. Each page's border is colour-coded by the file it came from. |
| **Add blank pages** | Start with an A4 page or append one matching the document's prevailing paper size, then edit and reorder it like any other page. |
| **Reorder** | Drag pages into any order, freely across source files. |
| **Rotate and delete** | In 90 degree steps, one page at a time or many at once. |
| **Resize** | A4, US Letter, the document's own dominant page size, or leave originals untouched. |
| **Sign** | Draw a signature, place it, move and resize it. Drawn signatures are reusable for the rest of the session. |
| **Annotate** | Text boxes in seven sizes and four colours, placed images, text highlighting, and a free-hand highlighter that works on scanned pages too. |
| **Undo and split** | Undo or redo up to 100 page edits, and split ranges into separate PDFs in one ZIP. |
| **Crop and stamp** | Crop one, selected or all pages, then add page numbers and watermarks during export. |
| **Fill forms** | Fill supported standard AcroForm fields and flatten the values into the exported PDF. |
| **Local OCR** | Recognize English text on selected pages on-device and add an invisible searchable text layer. |
| **Offline app** | Install or revisit after the first online load to start, edit and export without a connection. OCR needs one online use to cache its model. |
| **Export** | The whole document, or only the pages you selected. |

## How the privacy claim works

There is no upload endpoint. The page reads your file into memory using the
browser's own file APIs, every edit happens in the tab, and the exported PDF is
assembled in the browser and saved straight back to your device. Nothing is
transmitted, so there is no remote document copy for anyone to store, read or
leak.

The site does count how often each action is used, and only that. Each tracked
action sends one event name from a fixed list of eight, and nothing else: no
filenames, no annotation text, no image data. There is no third-party analytics
script, no cookie and no persistent identifier. The lifetime totals are shown
publicly on the page under "The machine so far".

The optional feedback form is separate: it sends only the category, message and
optional email you deliberately submit to Netlify Forms. It never includes
document content. Working documents are not persisted between visits; only the
offline application shell and, after first use, OCR model data may be cached.

## How the quality guarantee works

Display and export are separate systems. Previews are rasterized with
[pdf.js](https://mozilla.github.io/pdf.js/) purely so you can see the pages, and
those pixels are never exported. The export is built with
[@cantoo/pdf-lib](https://www.npmjs.com/package/@cantoo/pdf-lib) at the PDF object
level: `copyPages` copies the original content byte for byte, rotation is stored
as the page's `/Rotate` metadata rather than re-rendering, and embedded JPEGs keep
their original bytes so they are never re-compressed. A 300 DPI scan exports at
300 DPI.

## Compared with online PDF editors that upload your files

Most free web PDF tools upload your document to their servers, process it there,
and hand back a download link. That means your file sits on someone else's
infrastructure under their retention window and access controls, and the free tier
is usually gated by an email signup, a daily quota, or a watermark.

Free PDF Machine never uploads the file, asks for nothing, and adds no branding
watermark. A batch watermark appears only when the user configures one.

The trade-offs, stated fairly: everything runs on your own hardware, so very large
documents are bounded by your device's memory. OCR is English-only, form filling
supports standard AcroForms but not XFA, and there is no compression targeting a
smaller file size, collaboration or cloud storage. Nothing is kept between
sessions.

## Questions

**Is Free PDF Machine really free?**
Yes, completely. There is no paid tier, no trial, no product-added watermark, no
page limit, and no feature reserved for a premium plan. A batch watermark is
added only if you choose one. The price is 0 USD.

**Do my PDF files get uploaded anywhere?**
No. Files are opened and edited inside your own browser tab and are never sent to
a server. There is no upload step because there is no server-side processing to
upload to.

**Do I need to sign up or create an account?**
No. There is no account system at all. The consequence is that nothing is saved
between visits, so download your exported PDF before closing the tab.

**What can it do to a PDF?**
Merge PDFs and images; insert editable blank pages; reorder, rotate, delete,
resize and crop pages; undo and redo page edits; split ranges into a ZIP; add signatures, annotations, page
numbers and watermarks; fill and flatten supported AcroForm fields; and run
English OCR locally on selected scanned pages. Export the whole document or only
selected pages.

**Can it convert Word, PowerPoint or Excel files to PDF?**
No, and that is deliberate. Word, PowerPoint, Excel, Pages and Keynote can each
export a PDF themselves, and that file is produced by the application that owns the
format, using your real fonts and its own layout engine, so it matches your
document exactly. A converter running inside a browser has to reimplement that
layout with substituted fonts, and it will differ somewhere. Export the PDF from
the application that made the file, then add it here to merge, crop, split, sign,
annotate, fill or OCR it.

**Does it work offline?**
Yes, after the first online visit. Install it or revisit it after the offline
cache has been prepared and the editor can load without a connection. PDF editing
and export stay local. OCR's English model must be used online once before that
model is available offline.

**Does editing reduce the quality of my PDF?**
No. The export is rebuilt from the original bytes of the file you opened, so text
stays text, vectors stay vectors, and embedded JPEGs are never re-compressed.

**Is it safe for confidential documents?**
It is designed for that case. Contracts, medical records and identity documents
stay on your machine. Note that it cannot open a PDF locked with a password to
view.

## Who built it

[Amit Raz](https://rzailabs.com/) at [RZ AI Labs](https://rzailabs.com/), an AI
consulting and software development practice in Haifa, Israel.

- Project page: https://rzailabs.com/projects/free-pdf-machine
- How it was built with Claude Code: https://rzailabs.com/blog/free-pdf-editor-claude-code
- Source: https://github.com/razamit/PdfToolkit
- Contact: amit@rzailabs.com

Last verified: 2026-08-09
