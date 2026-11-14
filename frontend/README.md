# foodpanda frontend

**English** | [简体中文](README.zh-CN.md)

HTML/CSS/JavaScript served by Flask, with real MySQL data through `/api/v1`. No npm build is required.

## Run

Follow the [project setup](../README.md#run-the-integrated-application), then run from the repository root:

```bash
python app.py
```

Open http://127.0.0.1:5000. A static server or opening index.html directly cannot provide the API.

## Features

- Buyer login/logout, store/menu browsing, search and filters.
- Individual orders: create, add/change/remove items, place or cancel drafts.
- Group orders: create/share/join/leave, manage your own items, view member totals.
- Delivery or pickup; shipping split in integer cents, remainder assigned to the host.
- A host can submit a nonempty group before or after its deadline; joining/editing stops at the deadline or submission.
- Orders shows the current buyer’s individual and joined group history, including Completed, with filters, counts and refresh.
- Submitted orders are read-only and complete after a simulated 15–60 minutes. Pages poll every 15 seconds.

Use Alice and Bob in separate browser profiles or normal/private windows; ordinary tabs share a login. Credentials, migration commands, lifecycle details and tests are in the [project guide](../README.md). Email starts blank at login.

## Files and assets

`api.js` handles asynchronous requests and CSRF; `app.js` renders API results; `styles.css` provides layout. Authentication, orders and membership are not stored in localStorage; API failures show errors.

Menus and prices come from the seeded database; local photos are mapped to actual IDs. Image/icon/QR sources are in [assets/SOURCES.md](assets/SOURCES.md). Optional Google Fonts fall back to system fonts offline. The existing panda SVG comes from Simple Icons. This is a student prototype.

[API contract](../docs/API.md) · [中文接口约定](../docs/API.zh-CN.md)
