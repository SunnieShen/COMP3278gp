# Video workflow

The optional live showcase is at `/showcase/live`. It places the real website, key SQL and live MySQL results side by side. Results refresh every 0.5 seconds; change highlights last about 30 seconds. Writing SQL is explained as a key-statement example, not a complete query log. The READ panel displays the actual catalog SELECT.

1. Sign in as Alice and browse Harbour Cafe.
2. Create a Delivery group with a deadline 15 minutes ahead; add chicken rice.
3. Share its invite with Bob in a separate browser/private session.
4. Bob joins, adds milk tea, and changes its quantity from 1 to 2.
5. Bob leaves; his food and membership are deleted while Alice's item remains.
6. Alice places the order. Refresh to verify the Confirmed state and stored timestamps.

`/showcase/live?reset=1` clears browser demo state and signs out. It preserves database records. The default recording toolbar is hidden; use the main website for normal application testing.
