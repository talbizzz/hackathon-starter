RELEASE VERIFICATION —21NOVEMBER2026

release-2026-11-21.json is the result and source-hash record. Browser/DB/share JSON
files retain the individual outcomes; check-*.mjs retain the assertions executed.
They are evidence scripts for this machine, not a new portable test framework.
The tests used local Next production mode at127.0.0.1:3085, disposable PostgreSQL17
with repository migrations, PostgREST13.0.7 and a local proxy at127.0.0.1:55434.
No live database credentials were used and no production data was written.
The alias fixture deliberately relaxed only the disposable neighbourhood CHECK to
reproduce live human-readable Neukölln. Final fixture count4; published=true only
in disposable QA. The delivered CSV keeps published=false.

Browser screenshots show testing data and QA votes, not real user traction.
Clipboard share worked; native share was instrumented to verify synchronous
user activation after a separate save tap. Actual phone sharing remains unchecked.
These tests do not clear TikTok/Instagram playback or production deployment.
