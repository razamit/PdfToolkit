# Free PDF Machine

**Free PDF editor that runs entirely in your browser.** Merge, reorder, rotate,
resize, sign and annotate PDFs, then export with no quality loss. Your files are
never uploaded to a server, and there is no signup, no account and no cost.

Open it at [freepdfmachine.com](https://freepdfmachine.com/), pick your files, and
start working. There is no upload step and nothing to install.

- **Free.** No paid tier, no trial, no watermark, no page limit.
- **Private.** Files are opened and edited inside your browser tab and never sent
  anywhere. There is no server to store them.
- **No signup.** No email, no account, no login screen.
- **No quality loss.** The exported PDF is rebuilt from the original bytes of the
  file you opened, not from what is drawn on screen.

Accepts PDF, JPEG and PNG. Exports a single PDF.

## What you can do

| | |
|---|---|
| **Merge** | Combine any number of PDFs and images into one document. Each page's border is colour-coded by the file it came from. |
| **Reorder** | Drag pages into any order, freely across source files. |
| **Rotate and delete** | In 90 degree steps, one page at a time or many at once. |
| **Resize** | A4, US Letter, the document's own dominant page size, or leave originals untouched. |
| **Sign** | Draw a signature, place it, move and resize it. Drawn signatures are reusable for the rest of the session. |
| **Annotate** | Text boxes in seven sizes and four colours, placed images, text highlighting, and a free-hand highlighter that works on scanned pages too. |
| **Export** | The whole document, or only the pages you selected. |

## How the privacy claim works

There is no upload endpoint. The page reads your file into memory using the
browser's own file APIs, every edit happens in the tab, and the exported PDF is
assembled in the browser and saved straight back to your device. Nothing is
transmitted, so there is nothing for anyone to store, read or leak. It is not a
retention policy that could change later; there is no data.

The site does count how often each action is used, and only that. Each tracked
action sends one event name from a fixed list of eight, and nothing else: no
filenames, no annotation text, no image data. There is no third-party analytics
script, no cookie and no persistent identifier. The lifetime totals are shown
publicly on the page under "The machine so far".

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

Free PDF Machine never uploads the file, asks for nothing, and adds no watermark.

The trade-offs, stated fairly: everything runs on your own hardware, so very large
documents are bounded by your device's memory. There is no OCR, no PDF form
filling, no compression targeting a smaller file size, and no collaboration or
cloud storage. Nothing is kept between sessions. If you need any of those, use a
different tool.

## Questions

**Is Free PDF Machine really free?**
Yes, completely. There is no paid tier, no trial, no watermark, no page limit, and
no feature reserved for a premium plan. The price is 0 USD.

**Do my PDF files get uploaded anywhere?**
No. Files are opened and edited inside your own browser tab and are never sent to
a server. There is no upload step because there is no server-side processing to
upload to.

**Do I need to sign up or create an account?**
No. There is no account system at all. The consequence is that nothing is saved
between visits, so download your exported PDF before closing the tab.

**What can it do to a PDF?**
Merge several PDFs and images into one document, reorder pages by dragging them,
rotate in 90 degree steps, delete pages, resize to A4, US Letter or the document's
dominant size, add a hand-drawn signature, add text boxes, place images, highlight
selected text, and draw free-hand highlighter marks over any page including
scanned ones. Multi-select acts on many pages at once, and you can export either
the whole document or just the pages you selected.

**Does it work offline?**
Partly. The page has to load over the internet at least once. After that the
editing work is fully local, so if your connection drops mid-session you can still
finish and export your document.

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

Last verified: 2026-07-23
