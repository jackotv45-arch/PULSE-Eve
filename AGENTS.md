# Notes techniques

## Project rules

- The PULSE visual design is the client's original site CSS, kept verbatim in `src/styles.css` under the "CSS D'ORIGINE" marker; extend it with new classes in the same style rather than rewriting it with Tailwind utilities, because the client asked not to change the site.
- Registrations, check-ins and personal data are only written/read through server functions in `src/lib/event.functions.ts` calling SECURITY DEFINER SQL functions; tables holding personal data have no anon/authenticated policies, so the browser can never read them directly.
- Duplicate prevention, capacity and rate limiting are enforced inside the `register_participant` SQL function (atomic, row-locked), not only in the UI, per the client's spec.
- QR codes encode only `PULSE-EVT:<secret token>` (no personal data); ticket pages are reached by that token.
- Events are rows in `events` (multi-event ready); the public page shows the slug in `CURRENT_EVENT_SLUG`.
- Public page content (event info, programme, FAQ, hero image, featured event) lives in the `events` row and is edited from `/admin`; components must read it from `get_featured_event`, never hardcode it.
- Back-office access is `staff` rows (role admin|agent) checked server-side by `requireStaff`/`requireAdmin` in `src/lib/admin/auth-middleware.ts`; the browser only holds the session token.
- Check-ins go through the `check_in_participant` SQL function (row lock) so concurrent scans never double-validate.
