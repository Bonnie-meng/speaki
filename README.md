# Speaki · 言芽

A simple English learning website for vocabulary, listening and spoken practice. **言芽** means a language sprout: small daily practice growing into confident expression. The logo combines a conversation bubble and a new leaf. The planned public domain is **speaki.cn**. This repository is the application source, not a deployed service.

## Features

- Separate **My words** and **Word library** collections. Personal vocabulary supports date groups, search and date/progress filters.
- CEFR-J A1–B2 library: 7,801 word/POS entries, level selection, search, progress filtering, batches of up to 20 words, private review dates and mastery records. Public learning cards are generated on demand and cached once; explicit collection into My words is optional. See [content attribution](NOTICE.md).
- Listening library: 18 lessons, including 10 original human recordings from VOA and ELLLO. Filter by scene, level, source, or speaker origin. See [content attribution](NOTICE.md).
- Adjustable playback, hidden transcripts, approximate sentence following, word lookup, saved words, cumulative listening time and resume positions.
- Doubao Seeduplex full-duplex voice conversations for daily life, product work, and IELTS warm-ups, with streaming captions, natural interruption, mute and optional transcript-based expression feedback.
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

## Doubao real-time voice setup

1. In [Doubao Voice console](https://console.volcengine.com/speech/new/setting/apikeys?projectName=default), activate **Doubao real-time speech 3.0 / Seeduplex** and create a service API Key. A DeepSeek key or an Ark text-model key is not interchangeable with this credential.
2. Add `DOUBAO_REALTIME_API_KEY=...` to `.env.local` on the server, then restart the app. Never paste the key into browser code, notes, screenshots or Git. An optional `DOUBAO_REALTIME_VOICE` selects a compatible voice; default is Vivi 2.0.
3. Open Speaking and start a call. Microphone access requires HTTPS or localhost and a browser with AudioWorklet support. Headphones help prevent playback being picked up by the microphone.

The browser streams continuous 16 kHz, 16-bit mono PCM through an authenticated same-origin WebSocket. The server connects to the fixed official Seeduplex endpoint, authenticates using `X-Api-Key`, creates a new session per call, and relays only normalised audio/text events. Output is 24 kHz PCM, played progressively. When Doubao is configured, vocabulary and sentence playback also use its speech output, wrapped as a correctly labelled 24 kHz WAV; the legacy DeepSeek speech path is used only without a Doubao key. The session configuration follows the [official Seeduplex API and Web demo](https://docs.volcengine.com/docs/doubao-voice/end-to-end-real-time-voice-full-duplex-version?lang=zh). No upstream dialog ID or API Key is sent to the browser or reused between users.

Calls allow one live session per user, up to three total, with a 30-minute cap, origin/session checks, bounded audio frames, backpressure limits and disconnect cleanup. A reverse proxy must support WebSocket upgrades (Caddy does). The UI does not silently fall back to the old turn-based service when Doubao is unconfigured. Without a valid key, setup is reported before requesting microphone access.

During calls, audio including speech captured while the AI speaks goes to Doubao. Recognised text goes to DeepSeek for a separate expression-feedback panel when configured; this background request does not generate the spoken reply. Audio stays transient in the app and is not written to learning notes. Provider-side retention is governed by the provider's terms. Saving a conversation to private notes remains an explicit user action. Natural conversational coaching is not phoneme-level pronunciation assessment or an IELTS score; the old optional Azure assessment API remains available for legacy clients but is not used in the Doubao UI.

The integration is covered by mocked-provider tests. Live provider authentication, voice quality, interruption accuracy and end-to-end latency still need testing with an activated account.

## Administrator setup

Register the intended administrator through the website first, then run this on the server, using that account's number:

```sh
npm run admin -- +8613800000000
```

The number above is an example. No account becomes an administrator automatically. After a refresh, administrators see **Users** in the header. They can inspect account identifiers and registration information, then generate a temporary password for a user. Resetting revokes that user's sessions and requires a new password before learning access. Passwords are hashed with scrypt, never stored or displayed as plaintext. Recovery is manual; knowing a phone identifier alone is not proof of account ownership.

## Data storage and existing users

SQLite stores users, hashed sessions, per-user learning JSON (including private library progress), revisions, shared public word-library cards, and administrator reset events in `.data/daylight.sqlite`. The `.data` directory must be on persistent storage and backed up. It is never served by the web server or included in Git.

Learning data is fetched from the server for the current account. New learning data is not stored in a shared browser-local collection. Switching accounts clears the visible collection and in-memory caches; server requests use the authenticated user's ID. Revision checks prevent a stale tab from silently overwriting newer data.

Learning records are saved automatically to the signed-in account. Manual backup import/export and old browser-data import are not exposed in the interface.

Saving is automatic and debounced; only failures or conflicts show a header status. Failed saves can be retried; conflicting saves offer a local backup before reloading. Listening counts real elapsed playback time, including replays; pauses, stalls and seeking do not add time. A browser process forcibly terminated before the last save may lose the latest few seconds.

## Graded vocabulary data

The source catalogue is included in `data/cefrj-a1-b2.json` and served through authenticated `GET /api/word-library`. Browsing and progress storage do not need an AI key. Opening an uncached entry requests its original AI learning card; this uses the configured provider and can incur API charges. `GET /api/word-library/:id` never generates content, while `POST` with an empty JSON object prepares and validates a shared card. Public cards contain no personal prompts, notes or progress. Generation is deduplicated across users and survives restart in `word_library_cards`.

Private `learning_states.data.library` stores the user's selected level and per-entry status, reviews and due dates. Existing collections load without this field; new accounts start with empty My words. A library word only enters My words when the user adds it. Linked words synchronize that same user's review state to avoid duplicate due counts. Switching accounts clears the library session and rejects late responses.

To reproduce the catalogue, download the official source ZIP linked in [NOTICE.md](NOTICE.md), then run the standard-library-only importer:

```sh
python3 scripts/import-cefrj.py /path/to/CEFRJ_wordlist_ver1.6.zip
```

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
- Live voice calls require an activated Doubao Seeduplex service and API credit. Voice quality and latency depend on network, microphone and provider behavior; no professional pronunciation score is inferred from normal conversation.
- ELLLO subtitle boundaries are approximate, derived from source text, recognition alignment and pauses. Country labels describe speaker backgrounds, not all accents within a country.
- British Council lessons open on their original site and do not contribute to in-app listening time.
- The included ELLLO content is for non-commercial educational use; it is not covered by the code's MIT license. See [NOTICE.md](NOTICE.md).

## License

Application code: [MIT](LICENSE). Third-party learning content: [separate conditions and credits](NOTICE.md).

## Maintainer workflow

Keep changes local by default. Commit or push updates to GitHub only when the owner explicitly asks to update Git.
