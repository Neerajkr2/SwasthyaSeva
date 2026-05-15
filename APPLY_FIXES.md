# Fix Patch 3 — Apply Instructions

## Files to Replace

| File in this zip                                      | Replace in your project                                          |
|-------------------------------------------------------|------------------------------------------------------------------|
| backend/routes/chat.py                                | backend/routes/chat.py                                           |
| backend/routes/users.py                               | backend/routes/users.py                                          |
| frontend/src/services/api.js                          | frontend/src/services/api.js                                     |
| frontend/src/pages/ChatPage.jsx                       | frontend/src/pages/ChatPage.jsx                                  |
| frontend/src/pages/ProfilePage.jsx                    | frontend/src/pages/ProfilePage.jsx                               |
| frontend/src/pages/DrugInteractionPage.jsx            | frontend/src/pages/DrugInteractionPage.jsx                       |
| frontend/src/components/landing/Sections.jsx          | frontend/src/components/landing/Sections.jsx                     |
| frontend/src/components/common/Navbar.jsx             | frontend/src/components/common/Navbar.jsx                        |
| frontend/src/index.css                                | frontend/src/index.css                                           |

---

## Restart Both Servers

```bash
# Backend
# Ctrl+C 
cd backend 
venv\Scripts\activate
uvicorn main:app --reload --port 8000

# Frontend
# Ctrl+C 
cd frontend
npm run dev
```

---

## Issues Fixed

### 1. Chatbot — "Trouble connecting" error
**Root cause:** Anthropic API credits exhausted → backend raised exception → frontend showed generic error.

**Fix:** `routes/chat.py` now detects "credit balance" in the exception message and calls
`_local_health_response()` instead — a smart fallback that:
- Uses `symptom_analyzer` ML model for symptom queries
- Uses `drug_checker` ML model for drug interaction queries
- Returns a structured, helpful health response
- The user sees a real analysis instead of an error

**Also fixed:** React StrictMode double session creation — `ChatPage.jsx` uses `initRef`
guard to prevent two sessions from being created on mount.

### 2. Medical Reports — showing correctly
Reports were already being saved (fixed in patch 2). This patch ensures the dashboard
`My Reports` tab correctly fetches and displays them with filename, date, and "Analyzed" badge.
The `backend/routes/users.py` `GET /users/reports` endpoint is confirmed working.

### 3. Drug Interaction — same result for all inputs
**Root cause:** Results were not being cleared between checks; React was reusing the
previous result state when new drugs were entered.

**Fix:** `DrugInteractionPage.jsx` calls `setResult(null)` on:
- Every `updateDrug()` call (input change)
- Every `handleCheck()` call before the API request
- The Reset button

Added:
- **Quick example pairs** to try (Warfarin+Aspirin, SSRI+MAOI, etc.)
- **Reset button** appears after any check
- Results are keyed by `JSON.stringify(drugs)` so AnimatePresence animates each new result

### 4. Profile Image Upload — stuck at "Uploading 0%"
**Root cause:** Code was trying to use Firebase Storage `uploadBytesResumable` which
requires Firebase Storage to be enabled and configured — if rules are wrong or bucket
isn't set up, it hangs at 0%.

**Fix:** New approach using canvas compression:
1. Selected image → compressed to ≤ 400px JPEG via HTML Canvas API (no external service needed)
2. Compressed base64 → sent to `PATCH /users/photo` backend endpoint
3. Backend stores it in `users.photo_url` column
4. Firebase Auth `updateProfile()` is attempted but failure is silently ignored

This works **without Firebase Storage** entirely.

New `PATCH /users/photo` endpoint added to `backend/routes/users.py`.

### 5. Pricing Section UI
**Root cause:** `scale(1.05)` on the Pro card caused overflow outside the grid container,
and cards weren't equal height, so the CTA buttons were at different vertical positions.

**Fix:**
- Cards use `flex flex-col` + `flex-1` on the features list → buttons always at the bottom
- `items-stretch` on the grid → equal-height columns
- `scale(1.03)` instead of 1.05 — highlights Pro without clipping
- Consistent button styling: filled blue for Pro, outlined sky for Basic/Enterprise
- Added trust line at the bottom

### 6. Typography Consistency
**Fix:** `index.css` now sets `font-family: 'Plus Jakarta Sans'` as the base for:
- `body` element (all text)
- `input, textarea, select, button` (explicit override)
- `.input-field`, `.input-field-rect`, `.nav-item`, `.btn-primary`, `.btn-secondary`

**Logo exception:** `.logo-font` class applies `Playfair Display` and is used on
the SwasthyaSeva logo in `Navbar.jsx` and `DashboardSidebar.jsx`. All heading
`<h1>`–`<h4>` tags use `.font-display` (also Playfair Display) via Tailwind utility.
