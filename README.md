# Omarieden Shopify theme

A 1:1 port of omarieden.com (React SPA) to a Shopify Online Store 2.0 theme. The original stylesheet (all route chunks), fonts, icons, animations and DOM structure are reused verbatim; only the data layer is Shopify.

## 1. Upload
Online Store > Themes > Add theme > Upload zip file > `omarieden-theme.zip`. Do not publish yet; use "Customize" / "Preview".

## 2. Navigation (Online Store > Navigation)
Create these menus (handles matter):
- `main-menu` (3 levels): Women > CLOTHING > Dresses… Each level-1 item links to its department collection, level-2 to a sub-department collection, level-3 to a category collection. This one menu drives the desktop nav, mega menu, mobile menu, breadcrumbs and the "Category" tree in the filter drawer.
- `footer-about` (about us), `footer-service` (contact us, FAQ), `footer-policies` (Orders and delivery, Returns and refunds, Payment and pricing), `footer-privacy` (privacy policy, terms & condition).
Theme settings > Navigation lets you pick a different main menu.

## 3. Pages (Online Store > Pages) and their templates
| Page | Template to select |
|---|---|
| About us | `page.about` |
| Contact us | `page.contact` |
| FAQs | `page.faqs` |
| Discover all brands | `page.brands` |
| Wishlist (handle must be `wishlist`) | `page.wishlist` |
| Privacy policy, Terms & conditions | `page.legal` (breadcrumb-bar layout) or `page` |
| Orders & delivery, Returns & refunds, Payment & pricing | `page.policy` (maroon hero + typography layout). Paste the page text as rich text (H2/H3/paragraph/list/table). |
| Tote bag workshop, Bear activity, Cake box, Fairy garden, Pottery | `page.activation` and set the Google Form URL in the section settings |
All page copy for About / Contact / FAQs lives in the theme editor (section settings and blocks) with the live site's text pre-filled.

## 4. Products
- Vendor = brand (shown above the title and in the brands page, sorted A–Z from all vendors).
- Options: `Color` and `Size` (names configurable in Theme settings > Products). Colour swatches use Shopify's native colour swatches when set on the option; otherwise the "Colour swatch map" in theme settings (`NAME:#hex` per line).
- Tags: `trending` shows the Trending badge, `new` shows New.
- Metafields (Theme settings > Products): style code `custom.style_code` (falls back to the variant SKU), material `custom.material`, care `custom.care`.
- Collections: set a "Trending collection" (cart page "Trending now") and a fallback for "You might also like".
- Collection banner: the collection image is used as the hero; a default banner can be set in Theme settings > Collections.

### Product card
`snippets/product-card.liquid` (styles `assets/od-card.css`, behaviour `assets/od-card.js`). Badge top-left (metafield `custom.badge`, single line text; falls back to the tags `new` / `trending`), wishlist top-right, round arrows + dots to browse the product images, colour dots with "n colour(s)", and a square "+" that opens the quick-add.
Quick-add (`snippets/quick-add-drawer.liquid`): on desktop a drawer slides in from the side (left in Arabic), on mobile a bottom sheet slides up. It shows the images two at a time, the colour swatches, the sizes ("Low in stock" when fewer than 5 units are tracked), Add to cart with the price, and "More details" (description + `custom.material` metafield). The theme-check ImgWidthAndHeight warnings on icons are expected.

## 5. Languages (Arabic)
Settings > Languages > add Arabic, publish it, and translate content with Shopify's Translate & Adapt. The theme ships `locales/ar.json` with the original site's Arabic UI strings, applies `dir="rtl"`, the Arabic fonts and the original RTL class variants automatically. The header flag / footer "Language & Region" open the same drawer as the original and use Shopify's localization form.

## 6. Tracking
Theme settings > Tracking & scripts: paste GTM / Clarity / MoEngage / verification tags. (Google & YouTube and Facebook channel apps are the recommended way for the pixels.)

## 7. Checkout branding
Settings > Checkout > Customize: logo `images_dark_logo.svg`, background #fcf8f2, buttons #551c25 (maroon) / text #e5d9c7, font Bricolage is not available on checkout; pick the closest system font.

## 8. Redirects from the old URLs (Online Store > Navigation > URL redirects)
`/about-us` → `/pages/about-us`, `/contact-us` → `/pages/contact-us`, `/faqs` → `/pages/faqs`, `/discover-all-brands` → `/pages/discover-all-brands`, `/privacy-policy` → `/pages/privacy-policy`, `/terms-and-conditions` → `/pages/terms-and-conditions`, `/orders-and-delivery` → `/pages/orders-and-delivery`, `/returns-and-refunds` → `/pages/returns-and-refunds`, `/payment-and-pricing` → `/pages/payment-and-pricing`, `/my-account` → `/account`, `/cart` (same), `/product-details/*` → the new product URLs (bulk-import a CSV: old path → `/products/<handle>`), `/collections?dId=…` → the matching collection (query-string routes cannot be redirected by Shopify; link the old departments from the menu instead).

## What is intentionally different from the live site
- Checkout is Shopify's.
- Login is Shopify customer accounts (email + one-time code with "new customer accounts") instead of phone OTP; the popover keeps the same design.
- Wishlist is stored in the visitor's browser (per customer when logged in). Cross-device sync needs a small app; the theme exposes `window.OD.wishlist` for that.
- Search suggestions come from Shopify predictive search; filters come from Shopify's storefront filters (enable them in Search & Discovery).
- "You might also like" uses Shopify product recommendations.

## Files of interest
- `assets/omarieden.css.liquid` — the original CSS (main bundle + every route chunk), asset URLs rewritten.
- `assets/theme.js` — all interactions (header, mega menu, drawers, accordions, swipers, search, cart, wishlist, variants, filters, load-more).
- `snippets/product-card.liquid` — the product card used everywhere.

## 9. Cart drawer
Adding a product (product page, quick add, "Trending now" +) or clicking the header bag icon opens the "Shopping Bag" drawer (`sections/cart-drawer.liquid`, rendered from `layout/theme.liquid` inside `#modal`). It re-renders through the Section Rendering API after every change, shows the free-shipping progress (Theme settings > Free shipping threshold), quantity / remove / move-to-wishlist per line, a "Trending now" carousel (Customize > Cart drawer > Trending now collection, falls back to the theme "Trending collection"), Checkout and "View my bag" (the `/cart` page stays as the full bag). Styling: `assets/od-cart.css`; behaviour: `assets/od-cart.js`.

## 10. Menu banners / side menu
- **Side menu**: the hamburger icon (now shown on desktop too, left of the language flag) opens a drawer (`snippets/side-menu.liquid`, rendered from the header section; styles `assets/od-menu.css`, behaviour `assets/od-menu.js`). Level 1 lists the departments of `main-menu` plus "My account" and "Language & Region"; tapping a department slides in its level-2 panel ("View all …", the first sub-department flat, the others as accordions, then the banners). Slides from the left in English and from the right in Arabic. The desktop hover mega menu is unchanged.
- **Menu banners**: Customize > Header > Add block > **Menu banners**. Set *Department* to the exact title of the level-1 menu item (e.g. `Women`, case-insensitive), then pick up to two images (3:4, 900 x 1200 px), a caption (shown uppercase under the image) and a link for each. The banners appear on the right of that department's desktop mega menu and at the bottom of its side-menu panel. One block per department, up to 12; departments without a block just show their link columns. A tile without an image shows a placeholder in the theme editor only and is hidden on the live store.

## 11. Collection and search pages (September update)
- No hero banner. Title + product count, then category buttons generated automatically from the main menu (sub-departments of the current department; level-1 departments on the search page).
- Desktop toolbar: Filter, Sort by, category buttons. Mobile: Filter / Sort by row sits under the categories and becomes a sticky olive bar under the header when scrolling.
- Product grid: 4 or 5 per row on desktop (toggle in the toolbar, remembered for the session), 2 on mobile.


## 12. September 6 update (build 5)

### Product cards
- Quick-view button: maroon circle with the outline bag + plus icon (`snippets/icon-bag-plus.liquid`). Sold-out products show a sandstone "Sold out" badge instead and the image is faded.
- Thin chevron arrows on desktop (on hover) and mobile. Desktop hover crossfades to the second image (Net-a-Porter behaviour); clicking an arrow or a colour dot pins the card on that image until the mouse leaves.
- Badges are product-driven: **Theme settings > Product badges**. Rules top to bottom, first matches win, max two badges, "Sold out" replaces the others. Rule sources: the product field `custom.badge` (text), tags or collection handles (e.g. `trending`, `new`, `limited`, `prive`), automatic "New" (published within N days), automatic "Sale" (compare-at price higher; label or discount %). Labels have English + Arabic and colours. The same badge shows on collection, search, home sliders, wishlist, cart trending, quick view and the product page gallery. The old per-section "Badge text" setting on the home slider is gone.

### Drawers
- Quick view sits above the wishlist / cart / menu drawers with its own blur. Adding to cart from the wishlist closes the wishlist so the cart drawer is visible.
- Cart drawer renders instantly from the cart JSON (add / change / cart.js); the Section Rendering refresh only runs in the background afterwards. First open shows a skeleton while the cart loads.

### Collection / search
- Sort, filters and category buttons load results without a page reload (fetch + `history.pushState`); skeleton cards while loading, "Updating" spinner in the toolbar; back / forward buttons work.
- Infinite scroll shows skeleton placeholder cards for the next page. Images fade in when loaded, site-wide.
- Desktop grid toggle 4 / 5 per row in the toolbar.

### Home
- "Shop by category" now uses the same side gutter as every other section; all product sliders have the arrows centred on the container edges and the last card is cut at the same right edge (`.od-carousel`).
- New section **Just Arrived (live)** (`sections/just-arrived.liquid`, `assets/od-home.js/.css`): Net-a-Porter Live animation, a new card slides in every few seconds. Source = a collection (newest first) or hand-picked products; heading, italic part, "n new pieces this week" line, tagline, cards visible, speed, caption ("Just arrived", price or nothing) and colours are settings. The same section has a **Privé Live** preset (dark colours, hand-picked products).
- New sections **Editorial cards** (presets "Curated Edits cards" and "News & Events cards"): 2 or 3 cards, latest from a blog or hand-picked, "Read all" link.

### Block library (`sections/od-*.liquid`, `assets/od-blocks.css/.js`)
Available on pages, articles and the home page: Big banner (image / video, overlay, text position), Small banner, Image + text (image left / right, ratio), Image row (1 / 2 / 3, captions, lightbox), Cards (icon or image, 2 to 4 per row), Text, Product grid (collection or picked, 3 to 5 per row, optional gold tag), Quote, Video (uploaded or YouTube / Vimeo, cover), FAQ / accordion, Spacer / divider (line, ornament) and Form (three kinds: Book your visit (Privé), Join the next event, Reserve a table (cafe)). Every block has its own colours and spacing. Forms submit without reload: the contact form emails the store and, when an email is given, the person is saved in Customers with the tag (plus `cat:` / `style:` tags for Privé). If Shopify asks for a captcha the form falls back to a normal submit.

### Curated Edits and News & Events (blogs)
- Create the blogs **Curated Edits** and **News & Events** (Online Store > Blog posts > Manage blogs). Assign templates: blog `curated-edits` and `news-events`.
- Article fields (Settings > Custom data > Blog posts, namespace `custom`): `gallery` (list of files, up to 12, recaps), `event_dates` (text), `location` (text), `location_url` (URL), `products` (list of products, "Shop the post"). Tag `recap` = event recap (photo collage in the list, gallery page), tag `blog` = post; any other tag = category (tabs).
- Article templates: `article` (blog post: title above the cover, reading column, Shop the post, related posts, event form), `article.recap` (hero with details, gallery with lightbox, products seen at the event, related events, form), `article.curated-edits` (story: intro, cover, then library blocks). In the theme editor use "Create template" on an article to give it its own layout.
- Hero banner section: image (desktop / mobile), title (defaults to the blog title), overlay colour + opacity, title colour, height. Blog list section: style (news / edits), tabs, image side, recap thumbnail photos 1 / 3 / 5, photo-count badge, excerpt length, posts per page, load more button or infinite.
- Related posts: automatic (same tag, newest, filled with the latest) or hand-picked; 2 to 4; can be removed.

### Omarieden Privé
- Create a page and assign template `prive` (`templates/page.prive.json`): gate, big banner, image + text, image row, cards, small banner, product grid (gold Privé tag), Privé Live, FAQ, Book your visit form. Everything is editable and reorderable; add more blocks from the library.
- **Theme settings > Privé access**: everyone, logged-in customers with the tag `prive` (secure, server-side), or a password (light gate in the browser, sessionStorage). The gate section is the screen visitors see when locked.
- Book your visit form: name, phone, email, categories (multi, list in the section), style (single, list in the section), notes, optional image under the text; saves the customer with tags `prive, cat:Women, style:Modern` and emails the store.

### Events
- **Theme settings > Events**: events collection (create a collection `events`, keep it out of the menu), events listing page (create a page with template `events`), "n days left" window, "Selling fast" threshold, terms link.
- Each event = a product with product type `Event`, in the events collection, template `event`. Variants = ticket types (price 0 = free, inventory = seats, track quantity on). Product fields (Settings > Custom data > Products, namespace `custom`): `event_start` (date and time), `event_end` (date and time), `venue` (text), `address` (multi-line), `map_url` (URL), `duration` (text), `short_description` (multi-line), `details` (multi-line: a line starting with `#` starts an accordion, `- ` lines become bullets), `attendee_fields` (multi-line, one per line `Label|required` or `Label|optional`), `sessions` (multi-line, one per line `2026-10-02T19:00|Thu 2 Oct, 7pm`, only when an event has several dates), `gallery` (list of files), `banner_video` (file, optional). Variant field `custom.description` (text) shows under the ticket name. Manual tags on the product: `prive` (gold tag), `kids`, `members`.
- Event page: banner (video / image) with the automatic tag, title, short description, date / venue / duration, description, accordions, location card + map + directions, photos, sticky price card "Select tickets". Booking page (`?view=event-booking`): session, tickets with steppers and live seats left, attendee fields per ticket, terms, sandstone summary card, Checkout (Shopify checkout; each ticket is its own line with the answers as line item properties).
- "Upcoming events" section: next 1 to 4 events with buttons to the listing; used on the News & Events page, home page, Privé page and recap / event pages.
- Ticket email: paste `paste-in-code-editor/order-confirmation-email.liquid` in Settings > Notifications > Customer notifications > Order confirmation (Edit code). Ticket orders get a ticket layout (event, date, time, venue, ticket type, attendee details, booking number); product orders keep the normal layout; mixed orders show both. No QR code (an events app can be added later without changing the pages).

### Breadcrumbs
Plain text trail on every page except the home page (`snippets/breadcrumbs.liquid`, rendered from the layout): muted parent links, chevrons, current page in maroon; the path follows the main menu, products show the collection they were opened from; mobile shows only "< parent". On pages with a hero (blogs, articles, Privé, cafe, events) it sits over the image.

### Super Botanical cafe
- Create a page with template `cafe` (`templates/page.cafe.json`). Colours are only #182c29 and #f0d58e (plus tints), square corners.
- Sections: Big banner (hero, image or video), Cafe intro (logo with width slider or name, address, hours, text), Cafe category tabs (generated automatically from the menu sections on the page, Seasonal first in gold, sticky, scroll sideways on mobile), Cafe: seasonal menu (stamp-frame cards in a static grid, background image + overlay, items per row, all items always visible), Cafe: menu category (one per category, up to 50 items, 2 columns desktop / 1 mobile, photo thumbnail, Arabic and English names, description, calories, allergen mark, price with the Riyal symbol), the library blocks (small banner, image row, image + text, text, spacer) and the Reserve a table form (customer tag `cafe`).
- Menu items are blocks, not products: photo, name EN / AR, description EN / AR, price, calories, allergens + note, tag (new / signature / seasonal), hide.
- Fonts: Brams / Faune (Arabic Rigot / Sada / Hudhud) are not included yet; the page uses Basteleur + Bricolage until the font files are supplied.

### Welcome popup
Customize > Welcome popup (in the layout, off by default): image (desktop right / mobile top), eyebrow, heading, text, email, interest checkboxes (Women / Men / Kids, saved as tags `interest:women` etc. with the base tag), Continue, No thanks, consent text, delay, exit intent, days before showing again, pages to hide on, success screen with the discount code (create the code in Discounts). Step 2 (phone / WhatsApp) is built but off: it needs an SMS app (Klaviyo, Postscript); the popup dispatches `od:popup:phone` for it.


## 13. Build 6 (6 September 2026)

Round 6 feedback, 15 items: Net-a-Porter row animation for Just Arrived / Privé Live (od-home.js, transform only);
thin plus quick-view icon; mobile sliders 2.3 cards + olive dots (theme.js `cards`, theme-shopify.css) and editorial
cards scroll row with dots (od-blocks.js); Blog list section blog picker + no-blog note; events collection picker in
Events list and Upcoming events; schema fixes (ranges need 3..102 values, text settings cannot have an empty default);
Curated Edits cards in templates/index.json; font pairing across all new CSS (Basteleur Moonlight 300 headings,
Bricolage 400 body, Arabic-Regular); Image row / banners section (1-4 per row, heading / subtext / button per banner);
cafe menu rows on a photo / text / price grid with photo size + shape; cafe seasonal cards as plain cream blocks with
photo position option; olive carousel arrows for .od-carousel; sold-out fade on the image link; Privé Live colours;
booking page without the mobile sticky bar.
