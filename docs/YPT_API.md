# YPT API Reference Documentation

Base URL: `https://pi.tgclab.com`

## Authentication & Headers

Login returns a JWT token (`jwt`). Send on every subsequent request:
```http
authorization: JWT <token>
Content-Type: application/json
Accept-Encoding: gzip
User-Agent: Dart/3.11 (dart:io)
coid: <countryID>
```

JWT expiry is ~90+ years (no refresh token flow required).

## Common Field Abbreviations

| Key | Meaning |
|---|---|
| `s` | Success boolean (`true` / `false`) |
| `c` | Error code (present on failure) |
| `n` | Nickname / handle |
| `e` | Email address |
| `id` | Numeric ID (context-dependent) |
| `ud` | Permanent user ID (in member-list contexts) |
| `ct` | Category / exam track name (e.g. "Banking", "Pri") |
| `ci` | Category ID |
| `coid` | Country ID (**cannot be 0 or null — causes HTTP 500**) |
| `cott` | Country name |
| `cotz` | Country timezone |
| `sm` | Study milliseconds (`dl.sm / 3600000` = hours studied) |
| `dl` | "Day log" object — today's study data |
| `cls` | Per-member challenge submission map, keyed by challenge ID string |
| `gs` / `ms` / `cs` / `ps` | Group list variants (owned / member / created / pending) |

---

## Key Endpoints

### 1. `POST /user/sign-in-jwt`
Email/password login.
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
**Response (200):** `s`, `jwt`, `n`, `ci`, `coid`, `id`, `e`, `gs`, `ss`, `dl`.

### 2. `POST /user/v2/reload/info`
Refresh profile, subjects, category, and country ID.
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
**Query Parameters:**
```
groupID=<int>
countryID=<int>     # REQUIRED — cannot be 0 (returns HTTP 500). Use account's real coid
isLooking=true
version=810046
```
**Each entry in `ms[]`:**
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
  `st: 1` = submitted/completed, `st: 0` = not submitted.
  Challenge IDs are extracted from the keys of `cls`.

### 5. `GET /logs/day`
Per-subject study time breakdown for date `date=YYYY-MM-DD`.

### 6. `POST /study/start` & `POST /study/stop`
Live timer integration for starting/stopping subject timers.
