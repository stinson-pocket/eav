#!/usr/bin/env python3
"""Sync EAV upcoming events from public source feeds into site/data/events.json."""

from __future__ import annotations

import argparse
import html
import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, time, timedelta, timezone
from email.utils import parsedate_to_datetime

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore


EABA_RSS_URL = "https://eastatlantabiz.com/Events/RSS"
EACA_CALENDAR_PAGE_URL = "https://www.eaca.net/calendar"
BAD_EARL_CALENDAR_URL = "https://badearl.com/show-calendar/"
FALLBACK_EACA_CALENDAR_ID = "calendar@eaca.net"
DEFAULT_EACA_LOOKAHEAD_DAYS = 90
MAX_EVENTS = 24

DEFAULT_IMAGES = {
    "business": "https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=1200&q=80",
    "community": "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80",
    "music": "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80",
}


def fetch_text(url: str, headers: dict[str, str] | None = None) -> str:
    request_headers = {"User-Agent": "eav-events-sync/1.0"}
    if headers:
        request_headers.update(headers)
    req = urllib.request.Request(
        url,
        headers=request_headers,
    )
    with urllib.request.urlopen(req, timeout=25) as res:
        return res.read().decode("utf-8", errors="replace")


def fetch_json(url: str, headers: dict[str, str] | None = None):
    return json.loads(fetch_text(url, headers=headers))


def strip_html(raw: str) -> str:
    no_tags = re.sub(r"<[^>]+>", " ", raw or "")
    clean = html.unescape(no_tags)
    return re.sub(r"\s+", " ", clean).strip()


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return slug or "event"


def local_tz():
    if ZoneInfo is not None:
        return ZoneInfo("America/New_York")
    return timezone(timedelta(hours=-4))


def to_iso_local(dt: datetime) -> str:
    return dt.astimezone(local_tz()).replace(microsecond=0).isoformat()


def next_day_cutoff_utc(now_utc: datetime) -> datetime:
    """Return UTC timestamp for local midnight at the start of tomorrow."""
    local_now = now_utc.astimezone(local_tz())
    tomorrow = local_now.date() + timedelta(days=1)
    local_midnight = datetime.combine(tomorrow, time.min, tzinfo=local_tz())
    return local_midnight.astimezone(timezone.utc)


def parse_eaba_events(now_utc: datetime, cutoff_utc: datetime) -> list[dict]:
    rss_raw = fetch_text(EABA_RSS_URL)
    root = ET.fromstring(rss_raw)
    events: list[dict] = []

    for item in root.findall("./channel/item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub_date = (item.findtext("pubDate") or "").strip()
        description = (item.findtext("description") or "").strip()
        if not title or not pub_date:
            continue

        dt = parsedate_to_datetime(pub_date)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt_utc = dt.astimezone(timezone.utc)
        if dt_utc < cutoff_utc:
            continue

        summary = strip_html(description)
        if len(summary) > 220:
            summary = summary[:217].rstrip() + "..."
        if not summary:
            summary = "Upcoming event from the East Atlanta Business Association."

        events.append(
            {
                "slug": f"eaba-{slugify(title)}-{dt_utc.strftime('%Y%m%d')}",
                "title": title,
                "datetime": to_iso_local(dt_utc),
                "tags": ["business", "community"],
                "summary": summary,
                "image": DEFAULT_IMAGES["business"],
                "url": link or "https://eastatlantabiz.com/Events",
                "source": "East Atlanta Business Association",
            }
        )
    return events


def parse_eaca_calendar_details(page_html: str) -> tuple[str | None, str]:
    key_match = re.search(r"const\s+mellon\s*=\s*'([^']+)'", page_html)
    calendar_match = re.search(r"const\s+calendarId\s*=\s*'([^']+)'", page_html)
    key = key_match.group(1).strip() if key_match else None
    calendar_id = calendar_match.group(1).strip() if calendar_match else FALLBACK_EACA_CALENDAR_ID
    return key, calendar_id


def parse_eaca_events(now_utc: datetime, cutoff_utc: datetime) -> list[dict]:
    page_html = fetch_text(EACA_CALENDAR_PAGE_URL)
    api_key, calendar_id = parse_eaca_calendar_details(page_html)
    if not api_key:
        raise RuntimeError("Unable to find EACA calendar API key on source page.")

    time_min = now_utc.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    time_max = (now_utc + timedelta(days=DEFAULT_EACA_LOOKAHEAD_DAYS)).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    params = {
        "key": api_key,
        "timeMin": time_min,
        "timeMax": time_max,
        "singleEvents": "true",
        "orderBy": "startTime",
        "maxResults": "24",
    }
    url = (
        "https://www.googleapis.com/calendar/v3/calendars/"
        + urllib.parse.quote(calendar_id, safe="")
        + "/events?"
        + urllib.parse.urlencode(params)
    )
    payload = fetch_json(
        url,
        headers={
            "Referer": EACA_CALENDAR_PAGE_URL,
            "Origin": "https://www.eaca.net",
        },
    )

    events: list[dict] = []
    for item in payload.get("items", []):
        title = (item.get("summary") or "").strip()
        if not title:
            continue

        start = item.get("start", {}) or {}
        dt_str = start.get("dateTime")
        date_str = start.get("date")
        if dt_str:
            dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        elif date_str:
            dt = datetime.combine(datetime.fromisoformat(date_str).date(), time(hour=10), tzinfo=local_tz())
        else:
            continue

        dt_utc = dt.astimezone(timezone.utc)
        if dt_utc < cutoff_utc:
            continue

        summary = strip_html(item.get("description", ""))
        if len(summary) > 220:
            summary = summary[:217].rstrip() + "..."
        if not summary:
            summary = "Upcoming community event from the EACA calendar."

        events.append(
            {
                "slug": f"eaca-{slugify(title)}-{dt_utc.strftime('%Y%m%d')}",
                "title": title,
                "datetime": to_iso_local(dt_utc),
                "tags": ["community"],
                "summary": summary,
                "image": DEFAULT_IMAGES["community"],
                "url": EACA_CALENDAR_PAGE_URL,
                "source": "East Atlanta Community Association",
            }
        )
    return events


def parse_badearl_date(raw: str) -> datetime | None:
    clean = (raw or "").strip()
    formats = [
        "%A, %b. %d, %Y",
        "%A, %b %d, %Y",
    ]
    for fmt in formats:
        try:
            parsed = datetime.strptime(clean, fmt)
            return parsed.replace(hour=20, minute=0, tzinfo=local_tz())
        except ValueError:
            continue
    return None


def parse_badearl_events(now_utc: datetime, cutoff_utc: datetime) -> list[dict]:
    page_html = fetch_text(BAD_EARL_CALENDAR_URL)
    patterns = [
        re.compile(
            r'<p[^>]*class=["\']show-listing-date["\'][^>]*>([^<]+)</p>.*?'
            r'show-listing-headliner[^>]*>([^<]+)</[^>]+>.*?'
            r'more-info-btn[^>]*>\s*<a[^>]*href=["\']([^"\']+)["\']',
            re.S | re.I,
        ),
        re.compile(
            r"<p class=show-listing-date>([^<]+)</p>.*?"
            r'show-listing-headliner">([^<]+)</div>.*?'
            r'more-info-btn"><a class=cl-element-link__anchor href=([^\s>]+)',
            re.S,
        ),
    ]
    events: list[dict] = []
    matches: list[tuple[str, str, str]] = []
    for pattern in patterns:
        matches = pattern.findall(page_html)
        if matches:
            break

    for date_raw, title_raw, url_raw in matches:
        dt_local = parse_badearl_date(strip_html(date_raw))
        if dt_local is None:
            continue
        dt_utc = dt_local.astimezone(timezone.utc)
        if dt_utc < cutoff_utc:
            continue

        title = strip_html(title_raw)
        if not title:
            continue
        url = strip_html(url_raw)
        if url and url.startswith("/"):
            url = urllib.parse.urljoin(BAD_EARL_CALENDAR_URL, url)

        events.append(
            {
                "slug": f"earl-{slugify(title)}-{dt_utc.strftime('%Y%m%d')}",
                "title": title,
                "datetime": to_iso_local(dt_utc),
                "tags": ["music"],
                "summary": "Live music at The EARL in East Atlanta Village.",
                "image": DEFAULT_IMAGES["music"],
                "url": url or BAD_EARL_CALENDAR_URL,
                "source": "The EARL",
            }
        )
    return events


def merge_events(*groups: list[dict]) -> list[dict]:
    merged: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for group in groups:
        for event in group:
            key = (event.get("title", "").strip().lower(), event.get("datetime", ""))
            if key in seen:
                continue
            seen.add(key)
            merged.append(event)
    merged.sort(key=lambda x: x.get("datetime", ""))
    return merged[:MAX_EVENTS]


def run(site_root: pathlib.Path):
    now_utc = datetime.now(timezone.utc)
    cutoff_utc = next_day_cutoff_utc(now_utc)
    eaba: list[dict] = []
    eaca: list[dict] = []
    badearl: list[dict] = []
    eaba_err = None
    eaca_err = None
    badearl_err = None

    try:
        eaba = parse_eaba_events(now_utc, cutoff_utc)
    except Exception as err:  # pragma: no cover
        eaba_err = err
        print(f"Warning: EABA event sync failed: {err}", file=sys.stderr)

    try:
        eaca = parse_eaca_events(now_utc, cutoff_utc)
    except Exception as err:  # pragma: no cover
        eaca_err = err
        print(f"Warning: EACA event sync failed: {err}", file=sys.stderr)

    try:
        badearl = parse_badearl_events(now_utc, cutoff_utc)
    except Exception as err:  # pragma: no cover
        badearl_err = err
        print(f"Warning: Bad Earl event sync failed: {err}", file=sys.stderr)

    merged = merge_events(eaba, eaca, badearl)
    if not merged:
        if eaba_err or eaca_err or badearl_err:
            raise RuntimeError("No upcoming events found after source sync failures.")
        raise RuntimeError("No upcoming events found from source feeds.")

    out_path = site_root / "data" / "events.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(merged, indent=2), encoding="utf-8")

    print(
        f"Synced {len(merged)} events to {out_path} "
        f"(EABA: {len(eaba)}, EACA: {len(eaca)}, EARL: {len(badearl)})"
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--site-root",
        default=str(pathlib.Path(__file__).resolve().parents[1] / "site"),
    )
    args = parser.parse_args()
    run(pathlib.Path(args.site_root))


if __name__ == "__main__":
    main()
