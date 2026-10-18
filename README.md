# Mopnote

Mopnote is a static, mobile-first cleaning estimate studio. It creates customer-ready quote pages from a cleaning company's own prices, with no sign-in, server or API keys.

## Get started

1. Open the [live site](https://kotenchik667.github.io/mopnote/).
2. Select **Business studio**, enter the business name, WhatsApp number including country code, and actual local rates.
3. Edit minimum charge, bedrooms, bathrooms and optional areas.
4. Fine-tune service / condition multipliers, repeat-visit discounts, time estimates, travel and tax if needed.
5. Press **Copy customer link**. Open it in a private browser window and check the estimate before giving it to clients.
6. Customers select the job and click **Ask about availability**, which opens a *prefilled* WhatsApp conversation. The cleaner must still confirm pricing and appointments.

No price on the default demo should be treated as a local market recommendation. **Replace the sample figures before using this commercially.**

## What is included

- Responsive website for phones, tablets and desktop browsers.
- Customer-facing estimate form for rooms, whole-home floor size, service, condition, frequency and add-ons.
- Deterministic pricing, including minimum price, size-based floor, adjusted service cost, recurring discount, travel, sales tax and an indicative range.
- Private studio-only approximate labor cost and pre-overhead remainder; not an accounting or profit calculation.
- Business name, WhatsApp contact, optional external HTTPS booking URL.
- Print/save-PDF, copy estimate, embed snippet, JSON config export, local draft storage, shareable public pricing link.
- Versioned links, including decoding the original Mopnote v1 customer links.
- Light/dark UI, reduced-motion support, keyboard focus, offline PWA shell and automated Node tests.

## Limits and privacy

Mopnote has **no database**, **no server-side lead tracking**, **no built-in payment processing**, **no appointment calendar**, and **no automatic sending of messages**. Clicking a WhatsApp CTA opens an external app/page. **Nothing is booked or sent until a person confirms it there.** The customer-entered name, preferred date, area and notes remain in the local form until they copy, print, or choose to open WhatsApp. The external WhatsApp service or configured booking provider has its own privacy practices.

Pricing configuration is embedded in the URL fragment for portability. It is **not secret**, so never include internal costs, passwords or hidden customer details in the link. New links omit the internal hourly labor cost. Customer-visible rates, business contact and crew size remain public in the URL. Separate operations-desk cost assumptions are local-only and not in the link. Older customer links may still contain earlier fields; replace old links when privacy matters.

Business settings are automatically kept in the same browser with localStorage. Opening the public link elsewhere does not sync settings, and changing saved settings **does not** update an already shared link; copy a new link to publish updates.

Offline mode depends on visiting the site once online. WhatsApp and external booking pages do not work offline.

## Technical architecture

- \`engine.js\`: pure, bounded price calculation and versioned URL codec (tested with Node built-in runner).
- \`app.js\`: UI controls, safe text DOM rendering, local persistence and user actions.
- \`index.html\` / \`styles.css\`: accessible responsive UI and print layout.
- \`sw.js\` + \`manifest.webmanifest\`: installable/offline-capable static shell.
- \`tests/pricing.test.cjs\`: logic, backward compatibility and input safety tests.

Run \`node --test tests/*.test.cjs\`. CI also checks JS syntax.

## Revenue experiments to validate

Mopnote is **not a revenue guarantee**. A practical day-one test is offering an actual cleaning business a branded setup and integration service for an agreed fee, then measuring whether a customer accepts and pays. The product itself remains free to use until you deliberately add a real merchant setup and documented terms. Avoid fabricating testimonials or statistics.

## Reddit-only product research

Decisions were informed by community anecdotes, not verified universal best practices:

- [Cleaning owners: quote by rooms/time rather than square footage alone](https://www.reddit.com/r/cleaningbusiness/comments/1sy2tna/i_need_help_with_quote_calculator/)
- [Residential phone quotes, scope and condition](https://www.reddit.com/r/cleaningbusiness/comments/1sh6chh/how_do_you_give_over_the_phone_estimates/)
- [Estimate without visiting for every job](https://www.reddit.com/r/cleaningbusiness/comments/1vcmbr0/do_you_always_do_in_person_estimates/)
- [Split line items and prevent losing leads during quotes](https://www.reddit.com/r/cleaningbusiness/comments/1tnfp0d/cleaning_business_owners_where_do_you_lose_the/)
- [Clear product messaging and landing page hierarchy](https://www.reddit.com/r/SaaS/comments/1tdmux8/where_do_you_guys_find_actually_good_saas_landing/)
- [Mobile design complaints and overly long landing text](https://www.reddit.com/r/SaaS/comments/1tp5qjs/is_anyone_open_to_give_me_a_honest_feedback_on/)
- [First paying customers: specific pain and active conversations](https://www.reddit.com/r/micro_saas/comments/1u2wuct/how_did_you_get_your_first_paying_customers_for/)

Licensed imagery and external paid dependencies: none. The optional font request to Google Fonts falls back to installed fonts when unavailable.


## Visual redesign — Reddit research, 2026-10-18

The third-generation interface deliberately changes the *product layout* rather than simply recoloring it. The page now opens with a plain editorial statement, and the application becomes an actual ruled workbench: editable line-item rates on one side and a receipt-like live estimate on the other. Mobile keeps the same information architecture in one column, with a persistent price bar. Input labels are explicit and readable. There are no glass panels, floating preview cards, generic three-step grid, rounded UI, stock photos or artificial customer statistics.

Reddit threads that guided the design critique:

- [Preventing the AI slop look: purposeful design, overused cards and template structure](https://www.reddit.com/r/webdesign/comments/1uhuovu/preventing_the_ai_slop_look/)
- [AI-generated UI and misplaced visual polish](https://www.reddit.com/r/UXDesign/comments/1tvt03p/aigenerated_ui_proves_people_value_design_but_not/)
- [Most AI-made looking sites: numbered sections and scrolling banners](https://www.reddit.com/r/webdesign/comments/1wkj84c/most_aimade_looking_websites/)
- [A beginner guide to systematic spacing](https://www.reddit.com/r/web_design/comments/1i46mu3/my_biggest_tip_for_beginners/)
- [Form labels versus placeholders](https://www.reddit.com/r/UXDesign/comments/196t2cu)
- [Less decorative design, more operational density](https://www.reddit.com/r/UXDesign/comments/1wq9xi6/our_users_kept_asking_us_to_make_the_design_worse/)
- [Clear purpose and obvious next actions for service enquiries](https://www.reddit.com/r/webdesign/comments/1sx6plp/i_stopped_making_beautiful_websites/)

These Reddit opinions are design references, not validation that real customers prefer this layout. Test with cleaners and customers before drawing conversion conclusions.


## Continuous glitch background / October 2026

Version 4 adds a persistent, independent canvas animation behind the editorial workbench: a fine registration grid, horizontal scan traces, red/ink pixel fragments, moving signal bands and small metadata glyphs. No external image, video or animation library is loaded. The estimator's inputs, sticky quote receipt, link codec and calculations are unchanged.

In version 4 the GLITCH ON/OFF switch controlled the animation. Version 5 removes the switch and expands the ambient field with continuous harmonic waveforms, signal splits, cursor-reactive noise and pricing pulses. The animation still pauses in background tabs and is disabled when the system requests reduced motion. It cannot capture clicks (pointer-events:none) and is hidden when printing. The cached offline shell includes both new files, under its new v4 cache key.

Only these **Reddit discussions** were consulted for the treatment:
- [Pixelated/glitch effect: comments identifying an HTML canvas approach](https://www.reddit.com/r/css/comments/14xncvz/)
- [Scanline pseudo-element CSS technique](https://www.reddit.com/r/css/comments/wcp7au/)
- [Canvas used for glitchy pixel art](https://www.reddit.com/r/creativecoding/comments/1esrzgn/)
- [Performance pitfalls from excessive website animation](https://www.reddit.com/r/web_design/comments/1sfpvjo/)
- [Keeping animations out of the user's way](https://www.reddit.com/r/web_design/comments/1wcj9yw/)
- [Accessibility trade-offs in homepage motion](https://www.reddit.com/r/web_design/comments/13b8o08/)

The effect is an aesthetic feature, not a claim of higher conversion. Test it on real devices before deciding on its default intensity.


## Operations release v5

### Production readiness

- Real contact handoff: a valid international WhatsApp number or HTTPS booking URL is required before a customer link can be copied. The link does not create an actual booking or record a customer automatically.
- A visible readiness message points out missing business identity, missing contact routes and unchanged *sample* rates. Do not treat sample prices as market data.
- Quotations are powered by the deterministic calculator; public rates are inspectable from the URL fragment. Private loaded labor wage, fixed supplies, overhead, travel cost, payment fee and risk parameters are stored only locally under a separate key and are not sent or embedded in the link.
- No payment integration, leads database, automatic email delivery, real-time availability or server analytics are claimed. The owner needs a merchant account and actual consenting clients to make revenue.

### Mathematical operations model

The optional, clearly labeled *illustrative* desk estimates:

- Contribution after labor, loaded wage, supplies, travel, overhead and payment costs:
  \`contribution = quote_ex_tax - hours * loaded_hourly_wage - supplies - overhead - travel - quote_ex_tax * fee_rate\`.
- Required price to attain target contribution margin \`m\`: \`(labor + fixed_costs) / (1 - m - payment_fee_rate)\`, where the denominator is positive.
- First derivative of target price with respect to labor wage: \`d(price)/d(wage) = labor_hours / (1 - m - payment_fee_rate)\`.
- Illustrative 90th-percentile labor-hours under an assumed normal distribution: \`mean_hours + 1.28155 * mean_hours * coefficient_of_variation\`.
- Queue utilization and approximate wait for a **single team** with random arrivals, based on \`rho = weekly_jobs * elapsed_hours / weekly_available_team_hours\`; the rough M/G/1 wait is measured in available team-hours, not ordinary wall-clock time. When utilization reaches 100%, the model marks overload rather than outputting a nonsensical finite wait.

These are not forecasts, verified probabilities, accounting figures or actual productivity benchmarks. The business must calibrate them against real job records.

### Retrieval-backed guidance, not fake RAG

The offline source index uses local BM25-style token retrieval across a small set of Reddit discussion summaries. It returns source URLs and transparently written snippets. It does **not** call a language model, invent advice or claim a full generative RAG stack.

### Tested functionality

- Node tests cover calculator invariants, legacy links, invalid input limits, link confidentiality, model sensitivity, queue overload and Reddit source retrieval.
- Chromium end-to-end checks exercise setup edits, persistence, responsive mobile sizes, customer links, WhatsApp handoff without sending, notes, clipboard, embed, export, print and accessibility settings.
- Automated screenshots are attached to GitHub Actions runs. Browser automation is not a substitute for user testing on physical devices.
- [Reddit-sourced potential prospects and first-revenue plan](docs/reddit-prospects.md). This is research, not evidence of paid customers.
