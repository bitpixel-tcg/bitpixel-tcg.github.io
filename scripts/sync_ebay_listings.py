#!/usr/bin/env python3
"""Sync a seller's active eBay listings into public/data/listings.json.

Design rules
------------
* eBay owns: title, price, availableTo (auction end), status.
* You own (never overwritten): id, description, game, category, productType,
  language, condition, tags, featured, theme, createdAt, images,
  marketplaceUrl, seller.
* Entries are matched through an `ebayItemId` field. It is back-filled from
  /itm/<number> links the first time. Entries without one are treated as
  manual and are left completely alone.
* New eBay listings are appended with inferred defaults; refine them by hand
  later and the script will keep your edits.
* A managed listing that is missing from search results is checked with
  getItem. Only when eBay confirms it has ended is it marked ENDED_STATUS
  (default "sold"; the site then sends visitors to your seller profile) and
  stamped with `endedAt`. The Browse API cannot tell a sale from a withdrawn
  or unsold listing, so every ended listing is treated the same way. It is removed 
  KEEP_ENDED_DAYS days later (0 = remove at once).
  Entries already marked "sold" keep that status.
* For local runs, put your variables in a gitignored .env file at the repo
  root (see load_dotenv). Real environment variables take priority.
* In sandbox mode the script never writes (dry run only), so sandbox IDs
  cannot wipe real data.
"""
import base64
import datetime as dt
import json
import os
import re
import sys
import time
import unicodedata

import requests


def load_dotenv(path=".env"):
    """Load KEY=VALUE lines from a local .env (if present) into os.environ.

    Real environment variables always win, so GitHub Actions (which has no
    .env file and passes secrets as env vars) is unaffected.
    """
    try:
        lines = open(path, encoding="utf-8-sig").read().splitlines()
    except FileNotFoundError:
        return
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[7:]
        key, _, value = line.partition("=")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key.strip(), value)


load_dotenv()

T0 = time.time()


def log(msg):
    print(f"[{time.time() - T0:6.1f}s] {msg}", flush=True)


ENV = os.environ.get("EBAY_ENV", "sandbox").lower()
BASE = "https://api.sandbox.ebay.com" if ENV == "sandbox" else "https://api.ebay.com"
SELLER = os.environ.get("EBAY_SELLER", "")
MARKETPLACE = os.environ.get("EBAY_MARKETPLACE", "EBAY_GB")
SITE_SELLER = os.environ.get("SITE_SELLER_NAME", "Blue Byte")
THEME = os.environ.get("SITE_THEME", "blue")
# Browse search needs a keyword or category even with a seller filter, so we
# run several queries and merge the results by item id.
QUERIES = [
    q.strip()
    for q in os.environ.get(
        "EBAY_QUERIES",
        "pokemon,yugioh,yu-gi-oh,one piece,magic the gathering,trading card,card bundle",
    ).split(",")
    if q.strip()
]
LISTINGS_PATH = os.environ.get("LISTINGS_PATH", "public/data/listings.json")
META_PATH = os.environ.get("META_PATH", "public/data/listings-meta.json")
KEEP_ENDED_DAYS = int(os.environ.get("KEEP_ENDED_DAYS", "36500"))
# Status given to listings that have ended: "sold" (default) or "unavailable".
ENDED_STATUS = os.environ.get("ENDED_STATUS", "sold")
# A single seller should never match more than this many results per query;
# if eBay reports more, the seller filter is not being applied, so abort.
MAX_RESULTS = int(os.environ.get("MAX_RESULTS", "500"))
META_REFRESH_HOURS = 3
DRY_RUN = os.environ.get("DRY_RUN") == "1" or (
    ENV == "sandbox" and os.environ.get("ALLOW_SANDBOX_WRITE") != "1"
)

_token = None


# --------------------------------------------------------------------------
# eBay API helpers
# --------------------------------------------------------------------------
def get_token():
    global _token
    if _token:
        return _token
    log("requesting access token")
    creds = base64.b64encode(
        f"{os.environ['EBAY_CLIENT_ID']}:{os.environ['EBAY_CLIENT_SECRET']}".encode()
    ).decode()
    r = requests.post(
        f"{BASE}/identity/v1/oauth2/token",
        headers={
            "Authorization": f"Basic {creds}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={
            "grant_type": "client_credentials",
            "scope": "https://api.ebay.com/oauth/api_scope",
        },
        timeout=30,
    )
    r.raise_for_status()
    _token = r.json()["access_token"]
    log("got access token")
    return _token


def api_get(path, params=None):
    """GET with light retry on 429/5xx. Returns the Response (caller checks)."""
    for attempt in range(4):
        r = requests.get(
            f"{BASE}{path}",
            headers={
                "Authorization": f"Bearer {get_token()}",
                "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE,
            },
            params=params,
            timeout=(10, 30),
        )
        if r.status_code in (429, 500, 502, 503, 504) and attempt < 3:
            log(f"eBay returned {r.status_code}, retrying ({attempt + 1}/3)")
            time.sleep(2 * (attempt + 1))
            continue
        return r
    return r


def legacy_id(item_id):
    """'v1|257801251271|0' -> '257801251271'."""
    parts = str(item_id).split("|")
    return parts[1] if len(parts) > 1 else parts[0]


def fetch_active():
    """All active listings for the seller, keyed by legacy item id."""
    found = {}
    wanted = SELLER.lower()
    for q in QUERIES:
        offset = 0
        while True:
            r = api_get(
                "/buy/browse/v1/item_summary/search",
                {
                    "q": q,
                    "filter": f"sellers:{{{SELLER}}}",
                    "limit": 200,
                    "offset": offset,
                },
            )
            r.raise_for_status()
            data = r.json()
            total = data.get("total", 0)
            if offset == 0:
                log(f"query '{q}': {total} result(s)")
            if total > MAX_RESULTS:
                sys.exit(
                    f"Query '{q}' reports {total} results, far more than one seller "
                    f"should have. The seller filter is probably not being applied "
                    f"(check EBAY_SELLER spelling and EBAY_MARKETPLACE). Aborting."
                )
            for s in data.get("itemSummaries", []):
                name = (s.get("seller") or {}).get("username", "").lower()
                if name and name != wanted:
                    sys.exit(
                        f"Got an item from seller '{name}' while searching for "
                        f"'{SELLER}'. The seller filter is not being applied. Aborting."
                    )
                found[legacy_id(s["itemId"])] = s
            offset += 200
            if offset >= total:
                break
    return found


def get_item(eid):
    r = api_get(f"/buy/browse/v1/item/v1|{eid}|0")
    return r.json() if r.ok else None


def item_is_ended(eid):
    """True only when eBay confirms the listing is over. Unsure -> False."""
    r = api_get(f"/buy/browse/v1/item/v1|{eid}|0")
    if r.status_code == 404:
        return True
    if not r.ok:
        return False
    d = r.json()
    end = d.get("itemEndDate")
    if end:
        try:
            if parse_iso(end) < dt.datetime.now(dt.timezone.utc):
                return True
        except ValueError:
            pass
    return any(
        a.get("estimatedAvailabilityStatus") == "OUT_OF_STOCK"
        for a in d.get("estimatedAvailabilities", [])
    )


# --------------------------------------------------------------------------
# Mapping helpers
# --------------------------------------------------------------------------
def parse_iso(value):
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def id_from_url(url):
    m = re.search(r"/itm/(?:[^/?]+/)?(\d{9,})", url or "")
    return m.group(1) if m else None


def map_price(s):
    opts = set(s.get("buyingOptions", []))
    p = s.get("price") or {}
    amount = float(p["value"]) if p.get("value") else None
    cur = p.get("currency")
    if "AUCTION" in opts and "FIXED_PRICE" not in opts:
        return {"prefix": "Bid now"}  # README: auctions omit amount/currency
    out = {}
    if amount is not None and cur:
        out = {"amount": amount, "currency": cur}
    out["prefix"] = "Bid or Buy It Now" if "AUCTION" in opts else "Buy It Now"
    return out


def map_end(s):
    if "AUCTION" in s.get("buyingOptions", []) and s.get("itemEndDate"):
        return s["itemEndDate"]
    return None


def infer_game(title):
    t = title.lower()
    if re.search(r"yu-?gi-?oh", t):
        return "Yu-Gi-Oh!"
    if "one piece" in t:
        return "One Piece"
    if re.search(r"\bmagic\b|\bmtg\b", t):
        return "Magic"
    return "Pokémon"


def infer_category(title):
    t = title.lower()
    if re.search(r"binder|sleeve|deck box|playmat|toploader|storage", t):
        return "Accessories", "Accessories"
    if re.search(r"booster box|elite trainer|\betb\b|booster bundle|\btin\b|collection box|sealed", t):
        return "Sealed", "Sealed Product"
    if re.search(r"bundle|lot of|\d+\s*cards", t):
        return "Singles", "Mixed Card Bundle"
    return "Singles", "Singles"


def infer_language(title):
    t = title.lower()
    for key, name in [
        ("japanese", "Japanese"), ("korean", "Korean"), ("chinese", "Chinese"),
        ("german", "German"), ("french", "French"), ("italian", "Italian"),
        ("spanish", "Spanish"),
    ]:
        if key in t:
            return name
    return "English"


def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:50].strip("-")


def best_images(summary, detail):
    urls = []
    src = detail or summary
    if src.get("image", {}).get("imageUrl"):
        urls.append(src["image"]["imageUrl"])
    for a in (detail or {}).get("additionalImages", []) or summary.get("additionalImages", []):
        if a.get("imageUrl"):
            urls.append(a["imageUrl"])
    seen, out = set(), []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def build_new(s, detail, today, taken_ids):
    eid = legacy_id(s["itemId"])
    title = s["title"]
    category, product_type = infer_category(title)
    game = infer_game(title)
    new_id = f"{slugify(title)}-{eid}"
    while new_id in taken_ids:
        new_id += "-x"
    tags = sorted({game.lower().replace("!", "").replace("-", ""), category.lower()})
    item = {
        "id": new_id,
        "ebayItemId": eid,
        "title": title,
        "description": s.get("shortDescription", "") or "",
        "game": game,
        "category": category,
        "productType": product_type,
        "language": infer_language(title),
        "condition": s.get("condition") or "Not specified",
        "seller": SITE_SELLER,
        "price": map_price(s),
        "images": best_images(s, detail),
        "marketplace": "eBay",
        "marketplaceUrl": s["itemWebUrl"],
        "tags": tags,
        "featured": False,
        "status": "available",
        "createdAt": today,
        "theme": THEME,
    }
    end = map_end(s)
    if end:
        item["availableTo"] = end
    return item


def refresh_existing(entry, s):
    """Apply only eBay-owned fields to a managed entry. Returns changed bool."""
    before = json.dumps(entry, sort_keys=True)
    entry["title"] = s["title"]
    entry["price"] = map_price(s)
    end = map_end(s)
    if end:
        entry["availableTo"] = end
    else:
        entry.pop("availableTo", None)
    if entry.get("status") in ("sold", "unavailable"):  # relisted
        entry["status"] = "available"
    entry.pop("endedAt", None)
    return json.dumps(entry, sort_keys=True) != before


# --------------------------------------------------------------------------
# File IO (preserves the file's existing line endings)
# --------------------------------------------------------------------------
def read_listings():
    try:
        raw = open(LISTINGS_PATH, "rb").read()
    except FileNotFoundError:
        return [], "\n"
    newline = "\r\n" if b"\r\n" in raw else "\n"
    return json.loads(raw.decode("utf-8")), newline


def dump(obj, newline):
    text = json.dumps(obj, indent=2, ensure_ascii=False)
    return (text.replace("\n", newline) + newline).encode("utf-8")


def write_if_changed(path, payload):
    try:
        if open(path, "rb").read() == payload:
            return False
    except FileNotFoundError:
        pass
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "wb") as f:
        f.write(payload)
    return True


# --------------------------------------------------------------------------
def main():
    if not SELLER:
        sys.exit("EBAY_SELLER is not set")
    if ENDED_STATUS not in ("sold", "unavailable"):
        sys.exit('ENDED_STATUS must be "sold" or "unavailable"')
    if not re.fullmatch(r"[A-Za-z0-9._-]+", SELLER):
        sys.exit(
            f"EBAY_SELLER looks wrong: '{SELLER}'. Use only the eBay username "
            f"(for example bitpixeltcg), not a URL or a parameter like _ssn=..."
        )
    now = dt.datetime.now(dt.timezone.utc)
    today = now.date().isoformat()

    existing, newline = read_listings()
    for e in existing:  # back-fill ebayItemId from /itm/ links
        if not e.get("ebayItemId"):
            eid = id_from_url(e.get("marketplaceUrl"))
            if eid:
                e["ebayItemId"] = eid
    managed = {e["ebayItemId"]: e for e in existing if e.get("ebayItemId")}
    manual = [e["id"] for e in existing if not e.get("ebayItemId")]

    log(f"environment: {ENV}, seller: {SELLER}, marketplace: {MARKETPLACE}, dry run: {DRY_RUN}")
    active = fetch_active()
    log(f"{len(active)} active listing(s) for '{SELLER}'")

    added, updated, removed, flagged = [], [], [], []
    taken = {e["id"] for e in existing}

    new_items = []
    for eid, s in active.items():
        if eid not in managed:
            log(f"new listing {eid}: fetching details")
            item = build_new(s, get_item(eid), today, taken)
            taken.add(item["id"])
            new_items.append(item)
            added.append(item["id"])

    result = []
    for e in existing:
        eid = e.get("ebayItemId")
        if not eid:
            result.append(e)  # manual entry: untouched
        elif eid in active:
            if refresh_existing(e, active[eid]):
                updated.append(e["id"])
            result.append(e)
        elif e.get("endedAt") or (log(f"checking whether {eid} has ended") or item_is_ended(eid)):  # endedAt: already confirmed, skip the API call
            ended_on = dt.date.fromisoformat(e.get("endedAt") or today)
            if (now.date() - ended_on).days >= KEEP_ENDED_DAYS:
                removed.append(e["id"])
            else:
                changed_entry = False
                if e.get("status") == "available":
                    e["status"] = ENDED_STATUS
                    changed_entry = True
                if not e.get("endedAt"):
                    e["endedAt"] = today
                    changed_entry = True
                if changed_entry:
                    updated.append(e["id"])
                result.append(e)
        else:
            flagged.append(e["id"])  # could not confirm ended: keep as-is
            result.append(e)

    result = new_items + result

    lines = [
        f"Added {len(added)}: {added}",
        f"Updated {len(updated)}: {updated}",
        f"Removed (ended > {KEEP_ENDED_DAYS} days) {len(removed)}: {removed}",
        f"Kept, could not confirm ended {len(flagged)}: {flagged}",
        f"Manual entries left untouched: {len(manual)}",
    ]
    print("\n".join(lines))
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
            f.write("### Listing sync (%s%s)\n" % (ENV, ", dry run" if DRY_RUN else ""))
            f.write("\n".join(f"- {l}" for l in lines) + "\n")

    if DRY_RUN:
        print("Dry run: nothing written.")
        return

    changed = write_if_changed(LISTINGS_PATH, dump(result, newline))

    # "Last checked" file so the site can disclose data age (ALA 8.1(c)).
    refresh_meta = changed
    try:
        prev = json.load(open(META_PATH, encoding="utf-8"))
        age = now - parse_iso(prev["checkedAt"])
        refresh_meta = refresh_meta or age > dt.timedelta(hours=META_REFRESH_HOURS)
    except (FileNotFoundError, KeyError, ValueError):
        refresh_meta = True
    if refresh_meta:
        meta = {"checkedAt": now.isoformat(timespec="seconds"), "source": "eBay"}
        write_if_changed(META_PATH, dump(meta, "\n"))
    print("listings.json changed." if changed else "listings.json unchanged.")


if __name__ == "__main__":
    main()