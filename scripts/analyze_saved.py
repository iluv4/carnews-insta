"""
저장 포스트 GPT Vision 분석 + 업종 분류
사용법: python scripts/analyze_saved.py

.env.local 에 OPENAI_API_KEY 가 있어야 합니다.
각 이미지를 GPT-4o 로 분석해 design DNA + 업종 카테고리를 추출하고
src/templates/index.json 을 업데이트합니다.
"""
import sys
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

import json, base64, time, urllib.request, urllib.error
from pathlib import Path

ROOT          = Path(__file__).resolve().parent.parent
SAVED_REFS    = ROOT / "public" / "saved-refs"
TEMPLATES_DIR = ROOT / "src" / "templates"
INDEX_FILE    = TEMPLATES_DIR / "index.json"

CATEGORIES = [
    "사진관/스튜디오",
    "보험/금융",
    "뷰티/코스메틱",
    "음식점/카페",
    "교육/정보",
    "패션/라이프스타일",
    "SNS/마케팅",
    "부동산/인테리어",
    "기타",
]

def load_env():
    p = ROOT / ".env.local"
    env = {}
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env

def gpt_analyze(image_path: Path, api_key: str) -> dict:
    b64 = base64.b64encode(image_path.read_bytes()).decode()
    data_url = f"data:image/jpeg;base64,{b64}"

    prompt = f"""You are analyzing a Korean Instagram card news image.

TASK: Return a single JSON object (not JSONL) with exactly these fields:
1. "category": ONE of {json.dumps(CATEGORIES, ensure_ascii=False)}
2. "design_dna": JSONL string (newline-separated JSON objects) covering:
   background_dna, typography_dna, color_palette, graphic_elements_dna,
   photo_treatment_dna, subject_dna, brand_mood_dna
3. "tags": array of 2-4 Korean keywords describing the content/style

Output ONLY raw JSON, no markdown, no explanation."""

    payload = json.dumps({
        "model": "gpt-4.1",
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": data_url, "detail": "low"}},
        ]}],
        "max_tokens": 1200,
        "response_format": {"type": "json_object"},
    }).encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        result = json.loads(r.read())
    content = result["choices"][0]["message"]["content"]
    return json.loads(content)

def run():
    env = load_env()
    api_key = env.get("OPENAI_API_KEY", "")
    if not api_key:
        print("[ERROR] .env.local 에 OPENAI_API_KEY 를 추가하세요.")
        sys.exit(1)

    index = json.loads(INDEX_FILE.read_text(encoding="utf-8"))
    saved = [t for t in index if t["id"].startswith("saved_")]
    already_done = [t for t in saved if t.get("category")]

    print(f"\n=== GPT 업종 분류 + 디자인 DNA 분석 ===")
    print(f"저장 포스트: {len(saved)}개  |  이미 분류됨: {len(already_done)}개\n")

    ok = skip = fail = 0
    for i, entry in enumerate(index):
        if not entry["id"].startswith("saved_"):
            continue
        if entry.get("category"):
            print(f"  [{i+1}] {entry['id']} — 건너뜀 (이미 분류됨: {entry['category']})")
            skip += 1
            continue

        shortcode = entry["id"].replace("saved_", "")
        img_path  = SAVED_REFS / f"{entry['id']}.jpg"
        if not img_path.exists():
            print(f"  [{i+1}] {entry['id']} — 이미지 없음")
            fail += 1
            continue

        print(f"  [{i+1}/{len(index)}] {shortcode} 분석 중...", end=" ", flush=True)
        try:
            result = gpt_analyze(img_path, api_key)

            # index 업데이트
            entry["category"] = result.get("category", "기타")
            entry["tags"]      = result.get("tags", entry.get("tags", []))

            # jsonl 파일 저장 (design DNA)
            dna = result.get("design_dna", "")
            if dna:
                jsonl_path = TEMPLATES_DIR / f"{entry['id']}.jsonl"
                jsonl_path.write_text(dna, encoding="utf-8")

            INDEX_FILE.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"OK [{entry['category']}]")
            ok += 1
        except Exception as e:
            print(f"실패 — {e}")
            fail += 1

        time.sleep(0.5)  # rate limit

    print(f"\n=== 완료: 성공 {ok}  건너뜀 {skip}  실패 {fail} ===")

    # 카테고리별 통계
    cats = {}
    for t in index:
        c = t.get("category", "미분류")
        cats[c] = cats.get(c, 0) + 1
    print("\n카테고리별 분포:")
    for c, n in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {c}: {n}개")

if __name__ == "__main__":
    run()
