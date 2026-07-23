# The `FAQPage` JSON-LD describes seven questions that appear nowhere on the rendered page

Status: CLOSED (2026-07-23) · Priority: MEDIUM · Type: SEO/AEO — structured-data compliance · Cost: none

> Closed by the same work that closed `served-html-has-no-crawlable-content.md`.
> All seven Q&As now exist as visible HTML in the static landing section of
> `index.html`, and a script diff confirms each answer is word-for-word identical
> to its `acceptedAnswer.text` in the JSON-LD. `WebPage.speakable` was extended
> at the same time from `["h1"]` to `["#about-heading", ".landing-lede"]`, now
> that a real summary element exists to point at. See decision row 14.

> Cannot be closed independently: it is closed by whatever fixes
> `served-html-has-no-crawlable-content.md`, because the fix is literally "put
> these same seven Q&As on the page". Filed separately because the *reason* is
> different: that ticket is about crawlers seeing nothing, this one is about a
> specific Google structured-data policy that the 2026-07-23 change knowingly
> got ahead of.

## Symptom

`index.html` now carries a `FAQPage` node with seven questions and answers
(`index.html`, the `application/ld+json` block). None of that text exists in the
DOM, before or after hydration. Google's structured-data guidelines require FAQ
markup to have a visible counterpart on the page: "the content must be visible
to the user on the source page".

Introduced deliberately on 2026-07-23 as part of the SEO/AEO discovery-layer
work, with the visible half scoped as a follow-up.

## Evidence

```
$ python3 -c "import re,json; \
  d=json.loads(re.search(r'ld\+json\">(.*?)</script>', open('dist/index.html').read(), re.S).group(1)); \
  print(len([n for n in d['@graph'] if n['@type']=='FAQPage'][0]['mainEntity']), 'questions')"
7 questions

$ curl -s https://freepdfmachine.com/ | grep -c "Is Free PDF Machine really free"
0
```

The seven answers do exist as prose in `public/llms-full.txt` (section 7) and
`public/index.md` (the Questions section), which is why the markup is truthful,
just not mirrored in HTML.

## Why it matters

Less than it first appears, and the honest framing matters here.

The AEO value is real and immediate: ChatGPT, Claude, Perplexity and Google AI
Overviews parse JSON-LD directly, and this block is the highest-leverage answer
surface the site has. The answers are accurate, sourced from the README and the
code, and consistent with `/llms.txt` and `/index.md`.

The risk is narrow. Google largely retired FAQ rich results in 2023 for
non-government, non-health sites, so the realistic downside is not a manual
action but simply that the markup earns no rich result. Still, it is a stated
policy violation and it puts the JSON-LD ahead of the page, which is exactly the
kind of drift the consistency rule in `CLAUDE.md` exists to prevent.

It also blocks a smaller item: `WebPage.speakable` currently declares only
`cssSelector: ["h1"]` because there is no summary element to point at yet.

## Fix

Ship the seven Q&As as visible HTML as part of
`served-html-has-no-crawlable-content.md`, word-for-word identical to the
`acceptedAnswer.text` strings already in `index.html`. Then extend
`speakable.cssSelector` to include the summary element.

If that work is deferred indefinitely instead, the alternative is to remove the
`FAQPage` node from the graph and keep the Q&As only in `llms-full.txt` and
`index.md`, where no visible-counterpart rule applies. That trades away the
strongest AEO surface on the page, so it is the worse option unless the on-page
FAQ is being ruled out for design reasons.

No code change made by this ticket — it is an observation on the record.
