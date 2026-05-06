"""
저장 포스트 이미지 다운로더
shortcodes.json -> og:image 추출 -> public/saved-refs/ 저장 -> src/templates/index.json 업데이트
"""
import sys
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

import json, urllib.request, urllib.error, time, re
from pathlib import Path
from datetime import datetime
from html.parser import HTMLParser

ROOT           = Path(__file__).resolve().parent.parent
SAVED_REFS_DIR = ROOT / "public" / "saved-refs"
TEMPLATES_DIR  = ROOT / "src" / "templates"
INDEX_FILE     = TEMPLATES_DIR / "index.json"
CODES_FILE     = Path(__file__).parent / "saved_shortcodes.json"

SAVED_REFS_DIR.mkdir(parents=True, exist_ok=True)
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

# ── HTML 파서로 og:image + og:title 추출 ─────────────────────────
class OGParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.og = {}
    def handle_starttag(self, tag, attrs):
        if tag == "meta":
            d = dict(attrs)
            prop = d.get("property", d.get("name", ""))
            if prop.startswith("og:") and "content" in d:
                self.og[prop[3:]] = d["content"]

def fetch_og(shortcode: str) -> dict:
    url = f"https://www.instagram.com/p/{shortcode}/"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            html = r.read().decode("utf-8", errors="replace")
        parser = OGParser()
        parser.feed(html[:20000])
        return parser.og
    except Exception as e:
        print(f"  [WARN] og fetch 실패 {shortcode}: {e}")
        return {}

def download_image(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            dest.write_bytes(r.read())
        return True
    except Exception as e:
        print(f"  [WARN] 이미지 다운로드 실패: {e}")
        return False

def load_index() -> list:
    return json.loads(INDEX_FILE.read_text(encoding="utf-8")) if INDEX_FILE.exists() else []

def save_index(items: list):
    INDEX_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")

def run():
    shortcodes = json.loads(CODES_FILE.read_text(encoding="utf-8"))
    print(f"\n=== 저장 포스트 다운로더 ===")
    print(f"총 {len(shortcodes)}개 처리 예정\n")

    index = load_index()
    existing_ids = {t["id"] for t in index}
    ok, skip, fail = 0, 0, 0

    for i, code in enumerate(shortcodes):
        tid = f"saved_{code}"
        dest = SAVED_REFS_DIR / f"{tid}.jpg"

        if tid in existing_ids and dest.exists():
            print(f"  [{i+1}/{len(shortcodes)}] {code} — 건너뜀 (이미 있음)")
            skip += 1
            continue

        print(f"  [{i+1}/{len(shortcodes)}] {code} ...", end=" ", flush=True)

        og = fetch_og(code)
        img_url = og.get("image", "")
        title   = og.get("title", f"저장 포스트 {i+1}")[:50]

        if not img_url:
            print("og:image 없음, 건너뜀")
            fail += 1
            time.sleep(1)
            continue

        if not download_image(img_url, dest):
            fail += 1
            time.sleep(1)
            continue

        print(f"OK  ({dest.stat().st_size // 1024}KB)")

        if tid not in existing_ids:
            index.append({
                "id": tid,
                "name": f"[저장] {title}",
                "description": "Instagram 저장 포스트 레퍼런스",
                "tags": ["Saved", "Instagram", "Reference"],
                "file": f"{tid}.jsonl",
                "thumbnail": f"/saved-refs/{tid}.jpg",
                "source": f"https://www.instagram.com/p/{code}/",
                "importedAt": datetime.now().isoformat(),
            })
            # 빈 jsonl 생성 (분석 없이 썸네일만)
            jsonl = TEMPLATES_DIR / f"{tid}.jsonl"
            if not jsonl.exists():
                jsonl.write_text(
                    f'{{"type":"source","shortcode":"{code}","title":"{title}"}}\n'
                    f'{{"type":"note","content":"OPENAI_API_KEY 설정 후 python scripts/analyze_saved.py 실행"}}',
                    encoding="utf-8"
                )
            existing_ids.add(tid)
            save_index(index)
            ok += 1

        time.sleep(0.8)  # rate limit 방지

    print(f"\n=== 완료 ===")
    print(f"  성공: {ok}개  |  건너뜀: {skip}개  |  실패: {fail}개")
    print(f"  이미지: public/saved-refs/")
    print(f"  템플릿: src/templates/index.json ({len(index)}개)")

if __name__ == "__main__":
    run()
