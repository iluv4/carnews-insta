# Instagram Reference Monitoring — Engagement Time-Series Analysis

Presentation material for the Time-Series Data Analysis course.

## What this is
Real engagement data from a monitored Instagram reference account
(`@netflix`, 12 recent posts pulled via the Instagram Looter RapidAPI
`user-feeds` endpoint). Each post is one observation in an irregular
engagement time series (likes / comments / plays + timestamp).

## Files
- `netflix_posts.csv` — extracted dataset (post_id, taken_at, media_type,
  like_count, comment_count, play_count, owner, caption)
- `analyze_engagement.py` — analysis + figure generation
- `figures/` — generated charts (PNG)

## Run
```bash
pip install pandas numpy matplotlib
python3 analyze_engagement.py
```

## Techniques demonstrated
1. Engagement over time + 3-post moving average
2. Robust anomaly / viral-spike detection (MAD z-score)
3. Content-format effect (likes by media type)
4. Reach -> engagement relationship (plays vs likes, Pearson r)
5. Posting hour-of-day vs engagement

## Key findings (n=12, 2026-05-20 → 06-08)
- Avg likes 110K; top post "Scooby-Doo Origins" reel = 264K
- Format: photo (196K) > reel (122K) > carousel (68K)
- Plays↔Likes correlation r = 0.73 (reels)
- No statistically extreme outlier at z>3.5 (small, high-variance sample)

## Extending the data
The API response includes `next_max_id` — paginate to collect more posts
for stronger seasonality/forecasting (SARIMA) analysis.

> Note: the RapidAPI key used to pull this data was shared in plaintext
> during development and should be rotated.
