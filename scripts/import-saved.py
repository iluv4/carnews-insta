"""
Instagram 저장 포스트 -> 템플릿 임포터
Instagram 모바일 REST API 방식 (GraphQL 우회)

사용법:
  python scripts/import-saved.py

동작:
  1. .env.local 에서 INSTAGRAM_USERNAME / INSTAGRAM_PASSWORD 읽기
  2. instaloader 로 로그인 -> sessionid 쿠키 획득
  3. Instagram 모바일 API 로 저장 포스트 전체 fetch (페이지네이션)
  4. 이미지를 public/saved-refs/ 에 저장
  5. OPENAI_API_KEY 있으면 GPT Vision 으로 디자인 DNA 분석
  6. src/templates/index.json + .jsonl 파일로 저장
"""

import os
import sys
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
import json
import shutil
import time
import base64
import urllib.request
import urllib.error
import urllib.parse
import pickle
import instaloader
from pathlib import Path
from datetime import datetime

# ── 경로 설정 ─────────────────────────────────────────────────────
ROOT           = Path(__file__).resolve().parent.parent
SAVED_REFS_DIR = ROOT / "public" / "saved-refs"
TEMPLATES_DIR  = ROOT / "src" / "templates"
INDEX_FILE     = TEMPLATES_DIR / "index.json"
SESSION_FILE   = ROOT / ".instagram-session"

# ── .env.local 파싱 ───────────────────────────────────────────────
def load_env(path: Path) -> dict:
    env = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env

env     = load_env(ROOT / ".env.local")
IG_USER = env.get("INSTAGRAM_USERNAME", "")
IG_PASS = env.get("INSTAGRAM_PASSWORD", "")
OAI_KEY = env.get("OPENAI_API_KEY", "")

if not IG_USER or not IG_PASS:
    print("[ERROR] .env.local 에 INSTAGRAM_USERNAME / INSTAGRAM_PASSWORD 가 없습니다.")
    sys.exit(1)

SAVED_REFS_DIR.mkdir(parents=True, exist_ok=True)
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

# ── 세션 쿠키 획득 ────────────────────────────────────────────────
def get_session_cookies() -> dict:
    """instaloader 로 로그인하고 세션 쿠키 딕셔너리 반환"""
    L = instaloader.Instaloader(
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
        quiet=True,
    )
    try:
        if SESSION_FILE.exists():
            L.load_session_from_file(IG_USER, str(SESSION_FILE))
            print("[OK] 세션 파일 재사용")
        else:
            print("[..] Instagram 로그인 중...")
            L.login(IG_USER, IG_PASS)
            L.save_session_to_file(str(SESSION_FILE))
            print("[OK] 로그인 성공, 세션 저장됨")
    except instaloader.exceptions.BadCredentialsException:
        print("[ERROR] 아이디 또는 비밀번호가 틀렸습니다.")
        sys.exit(1)
    except instaloader.exceptions.TwoFactorAuthRequiredException:
        code = input("[INPUT] 2FA 코드 입력: ").strip()
        L.two_factor_login(code)
        L.save_session_to_file(str(SESSION_FILE))

    # pickle 파일에서 쿠키 읽기
    with open(SESSION_FILE, "rb") as f:
        cookies = pickle.load(f)
    return cookies  # dict: {sessionid, csrftoken, ...}

# ── Instagram 모바일 API 헬퍼 ─────────────────────────────────────
IG_HEADERS_BASE = {
    "User-Agent": "Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; en_US; 458229258)",
    "X-IG-App-ID": "936619743392459",
    "Accept-Language": "en-US",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
}

def ig_get(url: str, cookies: dict) -> dict:
    cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())
    headers = {**IG_HEADERS_BASE, "Cookie": cookie_str}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"  [HTTP {e.code}] {url}\n  {body[:200]}")
        return {}

# ── 저장 포스트 전체 fetch ─────────────────────────────────────────
def fetch_all_saved(cookies: dict) -> list:
    posts = []
    max_id = None
    page = 1
    while True:
        url = "https://i.instagram.com/api/v1/feed/saved/posts/?num_results=20"
        if max_id:
            url += f"&max_id={urllib.parse.quote(max_id)}"
        print(f"  [페이지 {page}] 가져오는 중...")
        data = ig_get(url, cookies)
        if not data:
            break
        items = data.get("items", [])
        for item in items:
            media = item.get("media", item)
            posts.append(media)
        more = data.get("more_available", False)
        max_id = data.get("next_max_id")
        if not more or not max_id:
            break
        page += 1
        time.sleep(1.5)
    return posts

# ── 이미지 URL 추출 ───────────────────────────────────────────────
def best_image_url(media: dict) -> str | None:
    """미디어 객체에서 가장 높은 해상도 이미지 URL 반환"""
    # 캐러셀 (여러 장)
    carousel = media.get("carousel_media", [])
    if carousel:
        media = carousel[0]

    # image_versions2
    candidates = media.get("image_versions2", {}).get("candidates", [])
    if candidates:
        best = max(candidates, key=lambda c: c.get("width", 0))
        return best.get("url")

    return None

# ── 이미지 다운로드 ───────────────────────────────────────────────
def download_image(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            dest.write_bytes(r.read())
        return True
    except Exception as e:
        print(f"  [WARN] 이미지 다운로드 실패: {e}")
        return False

# ── OpenAI 분석 ───────────────────────────────────────────────────
def analyze_image(image_path: Path) -> str | None:
    if not OAI_KEY or OAI_KEY in ("", "your_openai_api_key_here"):
        return None
    b64 = base64.b64encode(image_path.read_bytes()).decode()
    data_url = f"data:image/jpeg;base64,{b64}"
    payload = json.dumps({
        "model": "gpt-4.1",
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": (
                "Analyze this Korean Instagram card news image and extract the Design DNA.\n"
                "Output strictly JSONL, one JSON object per line, no markdown.\n"
                "Include: background_dna, typography_dna, color_palette, "
                "graphic_elements_dna, photo_treatment_dna, subject_dna, brand_mood_dna"
            )},
            {"type": "image_url", "image_url": {"url": data_url}},
        ]}],
        "max_tokens": 1000,
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={"Authorization": f"Bearer {OAI_KEY}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            result = json.loads(r.read())
            return result["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"  [WARN] GPT 분석 실패: {e}")
        return None

# ── index.json ───────────────────────────────────────────────────
def load_index() -> list:
    return json.loads(INDEX_FILE.read_text(encoding="utf-8")) if INDEX_FILE.exists() else []

def save_index(items: list):
    INDEX_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")

# ── 메인 ─────────────────────────────────────────────────────────
def run():
    print(f"\n=== CarNews Insta — 저장 포스트 임포터 ===")
    print(f"계정: @{IG_USER}\n")

    cookies = get_session_cookies()

    print("\n[..] 저장된 포스트 목록 가져오는 중...")
    saved = fetch_all_saved(cookies)
    print(f"[OK] 총 {len(saved)}개 저장 포스트 발견\n")

    if not saved:
        print("[INFO] 저장된 포스트가 없거나 API 차단 상태입니다.")
        print("  -> Instagram 앱에서 설정 > 앱 및 미디어 > 데이터 접근을 확인해보세요.")
        sys.exit(0)

    index = load_index()
    existing_ids = {t["id"] for t in index}
    new_count = 0

    for i, media in enumerate(saved):
        shortcode = media.get("code", media.get("shortcode", f"post_{i}"))
        template_id = f"saved_{shortcode}"

        if template_id in existing_ids:
            print(f"  [{i+1}/{len(saved)}] {shortcode} — 이미 존재, 건너뜀")
            continue

        img_url = best_image_url(media)
        if not img_url:
            print(f"  [{i+1}/{len(saved)}] {shortcode} — 이미지 URL 없음, 건너뜀")
            continue

        print(f"  [{i+1}/{len(saved)}] {shortcode} 다운로드 중...")
        dest_img = SAVED_REFS_DIR / f"{template_id}.jpg"
        if not download_image(img_url, dest_img):
            continue

        # GPT 분석
        jsonl_content = None
        if OAI_KEY:
            print(f"    -> GPT 분석 중...")
            jsonl_content = analyze_image(dest_img)
            time.sleep(1)

        if not jsonl_content:
            caption = str(media.get("caption") or {})
            if isinstance(media.get("caption"), dict):
                caption = media["caption"].get("text", "")
            caption = caption[:80].replace("\n", " ")
            jsonl_content = (
                f'{{"type":"source","shortcode":"{shortcode}","caption":"{caption}"}}\n'
                f'{{"type":"note","content":"OPENAI_API_KEY 추가 후 재실행하면 GPT 분석이 됩니다."}}'
            )

        jsonl_file = TEMPLATES_DIR / f"{template_id}.jsonl"
        jsonl_file.write_text(jsonl_content, encoding="utf-8")

        raw_caption = media.get("caption") or {}
        caption_text = raw_caption.get("text", "") if isinstance(raw_caption, dict) else str(raw_caption)
        preview = caption_text[:40].strip() or f"저장 포스트 {i+1}"

        index.append({
            "id": template_id,
            "name": f"[저장] {preview}",
            "description": f"@{IG_USER} 저장 포스트",
            "tags": ["Saved", "Instagram", "Reference"],
            "file": f"{template_id}.jsonl",
            "thumbnail": f"/saved-refs/{template_id}.jpg",
            "source": f"https://www.instagram.com/p/{shortcode}/",
            "importedAt": datetime.now().isoformat(),
        })
        existing_ids.add(template_id)
        save_index(index)
        new_count += 1
        time.sleep(1)

    print(f"\n=== 완료: 신규 {new_count}개 템플릿 추가 ===")
    print(f"  이미지 위치: public/saved-refs/")
    print(f"  템플릿 위치: src/templates/")
    if not OAI_KEY:
        print(f"\n  TIP: .env.local 에 OPENAI_API_KEY 추가 후 재실행하면 GPT 디자인 분석이 적용됩니다.")

if __name__ == "__main__":
    run()
