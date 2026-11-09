# Group Eats frontend

**English** | [简体中文](README.zh-CN.md)

Foodpanda-inspired, responsive student-project prototype. Plain HTML, CSS and JavaScript modules; no build step or npm dependencies.

## Run locally

From the repository root:

```bash
python3 -m http.server 5173 --directory frontend --bind 127.0.0.1
```

Open http://127.0.0.1:5173. Use an HTTP server; opening `index.html` directly does not load JavaScript modules reliably.

## Included

- Restaurant and grocery browsing, search, cuisine filters, sorting and favourites.
- Store menus, item favourites, basket quantities and removal.
- Demo sign-in, editable delivery address, pickup mode and local order history.
- Group creation, deadline, simulated friend joining, delivery-fee splitting, locking and cancellation.
- Responsive desktop/mobile views. Demo state persists in localStorage.

All orders, accounts and group membership are browser-local simulations. There is no backend, MySQL connection, real payment, delivery or cross-device invitation. The invite action copies a demo URL; use “Simulate a friend joining” to preview another member. Other business rules remain backend work.

## Backend handoff

`data.js` holds sample sellers and menu items. `api.js` is the replaceable data-access boundary; `app.js` renders the UI and handles interaction. Replace the mock methods with backend requests and update callers to await responses. Validate permissions, prices, membership, deadlines and transactions on the server.

Core identifiers match the schema: `user_id`, `seller_user_id`, `item_id`, `item_name`, `quantity` and `unit_price_snapshot`. UI fields such as images, delivery estimates and descriptions are presentation fixtures. Early group locking, signup and complete checkout rules need an agreed backend contract; the frontend mock does not establish a database migration.

## Assets

Local food photographs are downloaded from Unsplash. See `assets/SOURCES.md` for source URLs. Optional Google Fonts are DM Sans and Manrope; system fonts are used offline. Visual reference: https://www.foodpanda.hk/. Group Eats is a student prototype and is not affiliated with Foodpanda.

## Brand and sample listings

The interface displays foodpanda branding using the existing panda mark from Simple Icons, not a generated or redrawn mascot. See `assets/SOURCES.md` for provenance. The mock catalog contains 18 restaurants and 4 grocery stores, each with a menu. Names, prices, ratings and offers are demonstration data, not live listings. This remains the Group Eats course project.

The listing page places search at the upper right and an app-download QR/link in the left sidebar. The QR opens the official Hong Kong download page.
