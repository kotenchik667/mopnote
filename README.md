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

Pricing configuration is embedded in the URL fragment for portability. It is **not secret**, so never include internal costs, passwords or hidden customer details in the link. The studio's labor-cost estimate and crew size are also part of the public configuration data: the UI hides the calculation from the customer view, but an informed user could inspect the link. Store only rates you are comfortable exposing; the private metrics should not be treated as confidential.

Business settings are automatically kept in the same browser with localStorage. Opening the public link elsewhere does not sync settings, and changing saved settings **does not** update an already shared link; copy a new link to publish updates.

Offline mode depends on visiting the site once online, and external fonts / WhatsApp won't operate offline.

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
