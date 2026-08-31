# YPT API Reference & Implementation Rules

Base URL: `https://pi.tgclab.com`

## Auth & Request Headers
Login returns a JWT (`jwt`). Send on every subsequent request:
```http
authorization: JWT <token>
Content-Type: application/json
Accept-Encoding: gzip
User-Agent: Dart/3.11 (dart:io)
coid: <countryID>
```
JWT expiry is ~90+ years (no refresh token flow required).

## Common Field Abbreviations
- `s`: success boolean (`true` / `false`)
- `c`: error code (present on failure)
- `n`: nickname / handle
- `e`: email
- `id`: numeric id (context-dependent)
- `ud`: permanent user id (in member-list contexts)
- `ct`: category / exam track name (e.g. "Banking", "Pri")
- `ci`: category id
- `coid`: country id (**cannot be 0 or null — causes HTTP 500**)
- `cott`: country name
- `cotz`: country timezone
- `sm`: study milliseconds (`dl.sm / 3600000` = hours studied)
- `dl`: "day log" object — today's study data (`sm`, `is` = currently studying)
- `cls`: per-member challenge submission map, keyed by challenge id string (e.g., `{"331805": { "id": 212928911, "st": 1, "la": "...", "ed": "..." }}`)
  - `st: 1` = submitted/completed, `st: 0` = not submitted
- `gs` / `ms` / `cs` / `ps`: group list variants (owned / member / created / pending)

---

## Endpoints

### 1. `POST /user/sign-in-jwt`
Email/password login.
**Body:**
```json
{
  "email": "user@example.com",
  "password": "...",
  "loginProvider": "Email",
  "new": true,
  "getx": true,
  "language": "en"
}
```
**Response:** `s`, `jwt`, `n` (nickname), `ci` (category id), `coid` (country id), `id` (user id), `e` (email), `gs` (groups), `ss` (subjects), `dl` (day log).

### 2. `POST /user/v2/reload/info`
Refresh profile, subjects, category/country ids.
**Body:**
```json
{
  "pv": 0,
  "cd": { "su": null, "sbu": null, "cu": null, "eu": null, "du": null, "tu": null }
}
```
**Response:** `n`, `ct`, `ci`, `coid`, `cott`, `cotz`, `ss` (subjects array).

### 3. `GET /group/groups/v2`
Groups list across `gs`, `ms`, `cs`, `ps` arrays. Deduplicate by `id`.

### 4. `GET /logs/group/members/v2`
Per-member study time + challenge submission status for a group.
**Query params:**
```
groupID=<int>
countryID=<int>     # REQUIRED — cannot be 0 (returns HTTP 500). Use account's real coid
isLooking=true
version=810046
```
**Member data shape (`ms[]`):**
- `ud`: Permanent user ID
- `n`: Nickname
- `dl.sm`: Study milliseconds today (`hours = dl.sm / 3600000`)
- `dl.is`: Boolean currently studying
- `cls`: Dictionary where keys are native Challenge IDs, e.g.:
  ```json
  "cls": {
    "331805": {
      "id": 212928911,
      "st": 1,
      "la": "2026-08-11T12:00:00Z",
      "ed": "2026-08-11T15:30:00Z"
    }
  }
  ```
  Note: `cls` keys define the active group challenges. `st === 1` means the member completed that challenge.

### 5. `GET /logs/day`
Per-subject study time breakdown for date `date=YYYY-MM-DD`.

### 6. `POST /study/start` & `POST /study/stop`
Live timer integration for logging study sessions.
