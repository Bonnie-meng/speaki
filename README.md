# Speaki / Daylight

A simple English learning website for vocabulary, listening and spoken practice. The current interface is called Daylight; the planned public domain is **speaki.cn**. This repository is the application source, not a deployed service.

## Features

- Vocabulary cards with pronunciation, meanings, everyday phrases, examples, and spaced review. Group by date added and filter by today, recent days, or a specific date.
- Listening library: 18 lessons, including 10 original human recordings from VOA and ELLLO. Filter by scene, level, source, or speaker origin. See [content attribution](NOTICE.md).
- Adjustable playback, hidden transcripts, approximate sentence following, word lookup, saved words, cumulative listening time and resume positions.
- Turn-based voice conversations for daily life, product work, and IELTS warm-ups. Optional Azure pronunciation assessment.
- Mainland China (+86) phone identifier and password sign-up. No SMS service is required; phone ownership is not verified.
- Seven-day fixed sessions, per-account learning storage, account password changes, and administrator-assisted resets.
- A compact interface, consistent dropdown controls, desktop lists and mobile layouts.

## Run locally

Use a supported Node.js LTS release (Node 24 is the container runtime).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Add your API credentials to `.env.local` locally. Do not commit credentials. Open http://127.0.0.1:4173, then register an account. Recordings and account storage work without an AI key; generated word cards, voice calls, and generated speech need the relevant service credentials. AI usage is billed by the provider.

Phone identifiers accept only mainland China mobile numbers. New passwords require 6–8 letters or numbers (A–Z, a–z, 0–9). Existing passwords still work at sign-in. The sign-in cookie is HttpOnly, SameSite=Lax and expires after seven days; public deployment requires HTTPS and adds Secure cookies.

## Administrator setup

Register the intended administrator through the website first, then run this on the server, using that account's number:

```sh
npm run admin -- +8613800000000
```

The number above is an example. No account becomes an administrator automatically. After a refresh, administrators see **Users** in the header. They can inspect account identifiers and registration information, then generate a temporary password for a user. Resetting revokes that user's sessions and requires a new password before learning access. Passwords are hashed with scrypt, never stored or displayed as plaintext. Recovery is manual; knowing a phone identifier alone is not proof of account ownership.

## Data storage and existing users

SQLite stores users, hashed sessions, per-user learning JSON, revisions, and administrator reset events in `.data/daylight.sqlite`. The `.data` directory must be on persistent storage and backed up. It is never served by the web server or included in Git.

Learning data is fetched from the server for the current account. New learning data is not stored in a shared browser-local collection. Switching accounts clears the visible collection and in-memory caches; server requests use the authenticated user's ID. Revision checks prevent a stale tab from silently overwriting newer data.

The **Account → Import previous browser data** action can move an old local collection into the signed-in account. It downloads a backup of the current account first, requires an explicit import action, and removes the old shared browser collection only after the server confirms the import. Never import another person's collection. JSON backup import/export is available under Account → Data backup.

Saving is debounced and shows its status in the header. Failed saves can be retried; conflicting saves offer a local backup before reloading. Listening counts real elapsed playback time, including replays; pauses, stalls and seeking do not add time. A browser process forcibly terminated before the last save may lose the latest few seconds.

## Public deployment

Set a persistent database path and the exact public HTTPS origin:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PUBLIC_ORIGIN=https://speaki.cn
DATABASE_PATH=/app/.data/daylight.sqlite
```

The included Docker Compose configuration runs the app behind Caddy, which provides HTTPS after DNS points to your server. It assumes a single application instance with a persistent SQLite volume. The current local preview is not an internet deployment.

```sh
docker compose up -d --build
docker compose exec app npm run admin -- +8613800000000
```

Configure the real account number, DNS, API credentials and server firewall yourself. The example deployment does not expose the Node port directly. Rate limits cover registration, login and AI requests. The application trusts forwarded client IPs only when explicitly enabled and when requests arrive from a local proxy; otherwise limits use the socket address.

## Checks

```sh
npm run check
npm test
```

Tests cover account isolation, session expiry, permission boundaries, password resets, data persistence, cross-origin rejection, and learning/player behavior. Fixtures use local fake accounts and mocked provider calls.

## Limitations

- No SMS verification, automatic password recovery, or email service.
- Voice conversations are turn-based, with recognition and response latency; pronunciation assessment requires a separate Azure Speech resource.
- ELLLO subtitle boundaries are approximate, derived from source text, recognition alignment and pauses. Country labels describe speaker backgrounds, not all accents within a country.
- British Council lessons open on their original site and do not contribute to in-app listening time.
- The included ELLLO content is for non-commercial educational use; it is not covered by the code's MIT license. See [NOTICE.md](NOTICE.md).

## License

Application code: [MIT](LICENSE). Third-party learning content: [separate conditions and credits](NOTICE.md).
