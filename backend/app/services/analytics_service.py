import sqlite3, logging, re, json
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)
DB_PATH = Path("app/data/analytics.db")
_DS_CACHE_PATH = Path("app/data/dataset_stats_cache.json")

def _get_conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def _init_db():
    with _get_conn() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL,
            headline TEXT NOT NULL, credibility TEXT NOT NULL, confidence REAL NOT NULL,
            ml_score REAL DEFAULT 0, llm_score REAL DEFAULT 0,
            evidence_score REAL DEFAULT 0, source TEXT DEFAULT 'text')""")
        conn.commit()

_init_db()

def record_verification(headline, credibility, confidence, score_breakdown, source="text"):
    ts = datetime.now(timezone.utc).isoformat()
    ml  = round(float(score_breakdown.get("ml_score", 0) or 0), 4)
    llm = round(float(score_breakdown.get("llm_score", 0) or 0), 4)
    ev  = round(float(score_breakdown.get("evidence_score", 0) or 0), 4)
    with _get_conn() as conn:
        conn.execute("INSERT INTO verifications (ts,headline,credibility,confidence,ml_score,llm_score,evidence_score,source) VALUES (?,?,?,?,?,?,?,?)",
                     (ts, headline, credibility, round(confidence,4), ml, llm, ev, source))
        conn.commit()

def get_dashboard_data():
    try:
        with _get_conn() as conn:
            rows = conn.execute("SELECT * FROM verifications ORDER BY id ASC").fetchall()
        if not rows:
            return _empty_dashboard()
        total = len(rows)

        verdicts = {"True": 0, "Fake": 0, "Unverified": 0}
        conf_buckets = {"0-20%": 0, "20-40%": 0, "40-60%": 0, "60-80%": 0, "80-100%": 0}
        daily: dict = {}
        hourly = {h: 0 for h in range(24)}
        total_conf = 0.0
        ml_scores, llm_scores, ev_scores = [], [], []
        verdict_conf: dict = {}  # for avg_confidence_by_verdict

        all_headlines: list  = []
        fake_headlines: list = []

        for row in rows:
            r   = dict(row)
            v   = r["credibility"]
            conf = r["confidence"] or 0.0

            verdicts[v] = verdicts.get(v, 0) + 1
            total_conf += conf
            pct = int(conf * 100)
            if pct < 20:   conf_buckets["0-20%"]   += 1
            elif pct < 40: conf_buckets["20-40%"]  += 1
            elif pct < 60: conf_buckets["40-60%"]  += 1
            elif pct < 80: conf_buckets["60-80%"]  += 1
            else:          conf_buckets["80-100%"] += 1

            try:
                day = r["ts"][:10]
                if day not in daily:
                    daily[day] = {"True": 0, "Fake": 0, "Unverified": 0}
                daily[day][v] = daily[day].get(v, 0) + 1
            except Exception:
                pass
            try:
                hourly[int(r["ts"][11:13])] += 1
            except Exception:
                pass

            ml_scores.append(r["ml_score"] or 0)
            llm_scores.append(r["llm_score"] or 0)
            ev_scores.append(r["evidence_score"] or 0)

            if v not in verdict_conf:
                verdict_conf[v] = {"sum": 0.0, "count": 0}
            verdict_conf[v]["sum"]   += conf
            verdict_conf[v]["count"] += 1

            headline = r.get("headline", "")
            all_headlines.append(headline)
            if v == "Fake":
                fake_headlines.append(headline)

        sorted_days = sorted(daily.keys())[-14:]

        # ── Keyword clouds ────────────────────────────────────────────────────
        top_keywords      = _top_words(all_headlines,  n=25)
        top_fake_keywords = _top_words(fake_headlines, n=25)

        # ── Avg confidence by verdict ─────────────────────────────────────────
        avg_confidence_by_verdict = {
            v: {"avg": round(d["sum"] / d["count"], 4), "count": d["count"]}
            for v, d in verdict_conf.items() if d["count"] > 0
        }

        recent_list = [dict(r) for r in reversed(rows[-10:])]
        conf_dist   = [{"range": k, "count": v} for k, v in conf_buckets.items()]

        return {
            "total":   total,
            "verdicts": verdicts,
            "avg_confidence":    round(total_conf / total, 4),
            "avg_ml_score":      round(sum(ml_scores) / total, 4),
            "avg_llm_score":     round(sum(llm_scores) / total, 4),
            "avg_evidence_score":round(sum(ev_scores) / total, 4),
            "daily_trend":       [{"day": d, **daily[d]} for d in sorted_days],
            "hourly_activity":   [{"hour": h, "count": hourly[h]} for h in range(24)],
            # Provide BOTH key names so frontend normalisation always works
            "confidence_distribution": conf_dist,
            "confidence_dist":         conf_dist,
            "recent_verifications":    recent_list,
            "recent":                  recent_list,
            "top_keywords":            top_keywords,
            "top_fake_keywords":       top_fake_keywords,
            "avg_confidence_by_verdict": avg_confidence_by_verdict,
            "totals": {
                "total":            total,
                "true_count":       verdicts.get("True", 0),
                "fake_count":       verdicts.get("Fake", 0),
                "unverified_count": verdicts.get("Unverified", 0),
                "image_count":      sum(1 for r in rows if dict(r).get("source") == "image_ocr"),
            },
        }
    except Exception as e:
        logger.error(f"get_dashboard_data failed: {e}")
        return _empty_dashboard()


def _empty_dashboard():
    conf_dist = [{"range": r, "count": 0} for r in ["0-20%", "20-40%", "40-60%", "60-80%", "80-100%"]]
    return {
        "total": 0,
        "verdicts": {"True": 0, "Fake": 0, "Unverified": 0},
        "avg_confidence": 0, "avg_ml_score": 0,
        "avg_llm_score": 0, "avg_evidence_score": 0,
        "daily_trend": [],
        "hourly_activity": [{"hour": h, "count": 0} for h in range(24)],
        "confidence_distribution": conf_dist,
        "confidence_dist":         conf_dist,
        "recent_verifications": [],
        "recent":               [],
        "top_keywords":           [],
        "top_fake_keywords":      [],
        "avg_confidence_by_verdict": {},
        "totals": {
            "total": 0, "true_count": 0, "fake_count": 0,
            "unverified_count": 0, "image_count": 0,
        },
    }


_STOP = {"the","a","an","and","or","but","in","on","at","to","for","of","with","by","from","is","are","was","were","be","been",
         "has","had","have","will","would","could","should","may","might","this","that","these","those","it","its","as",
         "he","she","they","we","you","i","not","no","so","up","do","did","said","says","about","after","before","over",
         "into","than","also","just","more","their","his","her","our","one","two","new","can","all","who","what","when","how"}

_TOPICS = {
    "politics": ["election","president","congress","senate","democrat","republican","vote","government","trump","biden","political"],
    "health":   ["vaccine","covid","virus","cancer","drug","hospital","disease","health","medical","doctor","treatment","pandemic"],
    "science":  ["climate","nasa","research","study","scientist","space","earth","environment","energy","nuclear","technology"],
    "business": ["stock","market","bank","economy","trade","company","billion","million","dollar","inflation","crypto"],
    "crime":    ["murder","arrest","police","shooting","killed","crime","court","prison","suspect","weapon","attack"],
    "media":    ["facebook","twitter","google","media","news","report","fake","social","network","youtube","internet"],
    "migration":["immigration","border","refugee","migrant","illegal","deportation"],
}

def get_dataset_stats():
    if _DS_CACHE_PATH.exists():
        try:
            if (datetime.now().timestamp() - _DS_CACHE_PATH.stat().st_mtime) < 86400:
                with open(_DS_CACHE_PATH, encoding="utf-8") as f:
                    cached = json.load(f)
                if cached.get("available"):
                    return cached
        except Exception:
            pass
    csv_path = next((p for p in [Path("app/data/WELFake_Dataset.csv")] if p.exists()), None)
    if csv_path is None:
        r = {"available": False, "reason": "WELFake CSV not found"}
        _save_cache(r); return r
    try:
        import pandas as pd
        CHUNK, MAX_ROWS = 5000, 20000
        label_col = title_col = None
        fake_titles, real_titles, title_lengths = [], [], []
        total = total_fake = rows_read = 0
        topic_counts = {t: {"fake": 0, "real": 0} for t in _TOPICS}
        for chunk in pd.read_csv(csv_path, chunksize=CHUNK, low_memory=False):
            if rows_read >= MAX_ROWS: break
            if label_col is None:
                label_col = _find_col(chunk, ["label","labels","class"])
                title_col = _find_col(chunk, ["title","headline","head"])
                if not label_col or not title_col:
                    return {"available": False, "reason": "Unrecognised CSV schema"}
            chunk = chunk.head(MAX_ROWS - rows_read)
            rows_read += len(chunk)
            labels = chunk[label_col].fillna(-1).astype(int)
            is_fake = labels == 1
            total += len(chunk); total_fake += int(is_fake.sum())
            titles = chunk[title_col].fillna("").astype(str)
            fake_titles.extend(titles[is_fake].tolist()[:1500])
            real_titles.extend(titles[~is_fake].tolist()[:1500])
            title_lengths.extend(titles.str.len().tolist())
            for title, fake in zip(titles, is_fake):
                tl = title.lower()
                for topic, kws in _TOPICS.items():
                    if any(k in tl for k in kws):
                        topic_counts[topic]["fake" if fake else "real"] += 1; break
        if not total:
            return {"available": False, "reason": "Empty dataset"}
        real_total = total - total_fake
        result = {"available": True, "total_articles": total,
                  "fake_count": total_fake, "real_count": real_total,
                  "fake_pct": round(total_fake/total*100,1), "real_pct": round(real_total/total*100,1),
                  "fake_keywords": _top_words(fake_titles), "real_keywords": _top_words(real_titles),
                  "title_length_dist": _len_dist(title_lengths), "topic_fake_rates": _topic_stats(topic_counts),
                  "dataset_name": "WELFake (Kaggle)",
                  "dataset_note": "72,134 labeled news articles - binary labels (Fake / Real)"}
        _save_cache(result); return result
    except Exception as e:
        logger.error(f"get_dataset_stats error: {e}")
        r = {"available": False, "reason": str(e)}; _save_cache(r); return r

def _find_col(df, names):
    for c in df.columns:
        if c.lower().strip() in names: return c

def _top_words(titles, n=20):
    freq = {}
    for t in titles:
        for w in re.sub(r"[^a-z ]","",t.lower()).split():
            if len(w) > 3 and w not in _STOP: freq[w] = freq.get(w,0)+1
    return [{"word":w,"count":c} for w,c in sorted(freq.items(),key=lambda x:-x[1])[:n]]

def _len_dist(lengths):
    b={"0-30":0,"31-60":0,"61-90":0,"91-120":0,"121+":0}
    for l in lengths:
        if l<=30: b["0-30"]+=1
        elif l<=60: b["31-60"]+=1
        elif l<=90: b["61-90"]+=1
        elif l<=120: b["91-120"]+=1
        else: b["121+"]+=1
    return [{"range":k,"count":v} for k,v in b.items()]

def _topic_stats(tc):
    s=[]
    for topic,c in tc.items():
        t=c["fake"]+c["real"]
        if t<5: continue
        s.append({"topic":topic,"fake":c["fake"],"real":c["real"],"total":t,
                  "fake_rate":round(c["fake"]/t*100,1),"real_rate":round(c["real"]/t*100,1)})
    return sorted(s,key=lambda x:-x["fake_rate"])

def _save_cache(data):
    try:
        _DS_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(_DS_CACHE_PATH,"w",encoding="utf-8") as f:
            json.dump(data,f,ensure_ascii=False,indent=2)
    except Exception as ex:
        logger.warning(f"Cache save failed: {ex}")
