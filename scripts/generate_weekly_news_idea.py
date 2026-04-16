#!/usr/bin/env python3
"""Generate one weekly EAV news draft (source-attributed) for editorial review."""

from __future__ import annotations

import json
import pathlib
from datetime import datetime, timezone


def load_events(events_path: pathlib.Path) -> list[dict]:
    if not events_path.exists():
        return []
    return json.loads(events_path.read_text(encoding="utf-8"))


def build_story_from_event(event: dict, now_iso: str) -> tuple[str, str]:
    title = (event.get("title") or "").strip() or "East Atlanta Village Weekly Event Spotlight"
    source = (event.get("source") or "Source").strip()
    source_url = (event.get("url") or "").strip()
    event_dt = (event.get("datetime") or "").strip()
    summary = (event.get("summary") or "").strip()

    story_title = f"Draft: {title} highlights this week in East Atlanta Village"
    body = f"""Draft status: Working draft. Not yet approved for publication.

{source} reports an upcoming East Atlanta Village event: {title}. The listed date/time is {event_dt}, and this item continues the weekly pattern of neighborhood activity spanning music, business, and community programming.

For readers in East Atlanta Village, this is useful as a practical planning signal for the week ahead. It can also support nearby businesses by increasing local awareness and foot traffic around event windows.

{summary if summary else "The event details should be reviewed before publication to confirm lineup, timing, and venue notes."}

Source attribution: Based on information published by {source}.
Source link: {source_url if source_url else "https://eastatlantabiz.com/Events"}

Internal note:
- Generated automatically on {now_iso}
- Please fact-check details before publishing live.
"""
    return story_title, body


def run(project_root: pathlib.Path) -> pathlib.Path:
    events_path = project_root / "site" / "data" / "events.json"
    drafts_dir = project_root / "reports" / "news-drafts"
    drafts_dir.mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc)
    now_iso = now.replace(microsecond=0).isoformat()
    stamp = now.strftime("%Y%m%d")

    events = load_events(events_path)
    lead_event = events[0] if events else {}
    story_title, body = build_story_from_event(lead_event, now_iso)

    out = drafts_dir / f"weekly-news-idea-{stamp}.md"
    out.write_text(f"# {story_title}\n\n{body}", encoding="utf-8")
    return out


def main() -> None:
    project_root = pathlib.Path(__file__).resolve().parents[1]
    out = run(project_root)
    print(f"Generated weekly news draft: {out}")


if __name__ == "__main__":
    main()
