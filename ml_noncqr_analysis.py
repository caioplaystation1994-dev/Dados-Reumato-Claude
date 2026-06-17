"""
ML Analysis: Predicting CQR-19 adherence using non-CQR features (HADS, SEAMS, BMQ)
"""

import subprocess
subprocess.run(["pip", "install", "xgboost", "-q"], check=False)

import json
import numpy as np
import pandas as pd
import warnings
warnings.filterwarnings("ignore")

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.metrics import roc_auc_score

try:
    from xgboost import XGBClassifier
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print("XGBoost not available, skipping.")

# ─── Load data ───────────────────────────────────────────────────────────────
DATA_PATH = "/root/.claude/uploads/e8adc5a8-da29-5395-b412-4b73c749cad3/a2dbaa3d-backup_reumatologia_20260617.json"
OUTPUT_PATH = "/home/user/Dados-Reumato-Claude/ml_noncqr_results.txt"

with open(DATA_PATH, "r", encoding="utf-8") as f:
    raw = json.load(f)

print(f"Total records in JSON: {len(raw)}")

# ─── Extract features from nested dicts ──────────────────────────────────────
# HADS keys in JSON: "1A","3A","5A","7A","1D","3D","4D","5D","6D","6A"
HADS_ITEMS = {
    "hads1a": "1A", "hads3a": "3A", "hads5a": "5A", "hads7a": "7A",
    "hads1d": "1D", "hads3d": "3D", "hads4d": "4D", "hads5d": "5D",
    "hads6d": "6D", "hads6a": "6A"
}
# SEAMS keys in JSON: "1","2","3","4","6","7","8","9","10","11"
SEAMS_ITEMS = {
    "seams1": "1", "seams2": "2", "seams3": "3", "seams4": "4",
    "seams6": "6", "seams7": "7", "seams8": "8", "seams9": "9",
    "seams10": "10", "seams11": "11"
}
# BMQ keys in JSON: "bmqc-1","bmqc-3","bmqc-4","bmqn-2","bmqn-3","bmqc-6","bmqn-5"
BMQ_ITEMS = {
    "bmqc1": "bmqc-1", "bmqc3": "bmqc-3", "bmqc4": "bmqc-4",
    "bmqn2": "bmqn-2", "bmqn3": "bmqn-3", "bmqc6": "bmqc-6", "bmqn5": "bmqn-5"
}
# CQR keys in JSON: "1".."19"
CQR_ITEMS = [str(i) for i in range(1, 20)]

# van den Bemt discriminant coefficients
CQR_INTERCEPT = -6.434
CQR_COEFS = {
    "1": 0.076, "2": 0.151, "3": 0.146, "4": -0.076, "5": 0.183,
    "6": -0.018, "7": 0.148, "8": 0.046, "9": 0.134, "10": 0.176,
    "11": 0.076, "12": 0.029, "13": 0.076, "14": 0.126, "15": 0.172,
    "16": 0.134, "17": 0.115, "18": 0.076, "19": 0.167
}

rows = []
for rec in raw:
    row = {}

    # HADS
    hads = rec.get("hads_respostas", {}) or {}
    for feat, key in HADS_ITEMS.items():
        val = hads.get(key)
        row[feat] = val if val is not None and val != "" else np.nan

    # SEAMS
    seams = rec.get("seams_respostas", {}) or {}
    for feat, key in SEAMS_ITEMS.items():
        val = seams.get(key)
        row[feat] = val if val is not None and val != "" else np.nan

    # BMQ
    bmq = rec.get("bmq_respostas", {}) or {}
    for feat, key in BMQ_ITEMS.items():
        val = bmq.get(key)
        row[feat] = val if val is not None and val != "" else np.nan

    # CQR
    cqr = rec.get("cqr_respostas", {}) or {}
    cqr_score = CQR_INTERCEPT
    cqr_ok = True
    for key in CQR_ITEMS:
        val = cqr.get(key)
        if val is None or val == "":
            cqr_ok = False
            break
        cqr_score += CQR_COEFS[key] * float(val)
    row["cqr_ok"] = cqr_ok
    row["cqr_score"] = cqr_score if cqr_ok else np.nan

    rows.append(row)

df = pd.DataFrame(rows)

# Compute target
df["adherent"] = (df["cqr_score"] > -0.5849).astype(int)

# All feature names
HADS_FEATS = list(HADS_ITEMS.keys())
SEAMS_FEATS = list(SEAMS_ITEMS.keys())
BMQ_FEATS = list(BMQ_ITEMS.keys())
ALL_FEATS = HADS_FEATS + SEAMS_FEATS + BMQ_FEATS

# Keep only rows with all 27 features AND all CQR items non-null
mask = df[ALL_FEATS].notna().all(axis=1) & df["cqr_ok"]
df_clean = df[mask].copy()

print(f"Patients with complete data (27 features + CQR): {len(df_clean)}")
vc = df_clean["adherent"].value_counts().sort_index()
print(f"Class distribution: Non-adherent (0)={vc.get(0,0)}, Adherent (1)={vc.get(1,0)}")
print(f"Adherence rate: {df_clean['adherent'].mean()*100:.1f}%")

X_all = df_clean[ALL_FEATS].values.astype(float)
y = df_clean["adherent"].values

# ─── Models ──────────────────────────────────────────────────────────────────
cv = StratifiedKFold(n_splits=10, shuffle=True, random_state=42)

models = {
    "Logistic Regression": Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(C=1, max_iter=1000, random_state=42))
    ]),
    "Random Forest": RandomForestClassifier(n_estimators=200, random_state=42),
    "Gradient Boosting": GradientBoostingClassifier(n_estimators=200, random_state=42),
}
if XGBOOST_AVAILABLE:
    models["XGBoost"] = XGBClassifier(n_estimators=200, random_state=42,
                                       eval_metric="logloss", verbosity=0)

results = {}
lines = []

header = "\n" + "="*70
lines.append(header)
lines.append("  ML ANALYSIS: Predicting CQR-19 Adherence (Non-CQR Features)")
lines.append("="*70)
lines.append(f"\nDataset: {len(df_clean)} patients")
lines.append(f"Non-adherent (0): {vc.get(0,0)}  |  Adherent (1): {vc.get(1,0)}")
lines.append(f"Adherence rate: {df_clean['adherent'].mean()*100:.1f}%")
lines.append(f"\nFeatures: {len(ALL_FEATS)} items (HADS=10, SEAMS=10, BMQ=7)")
lines.append("\n" + "-"*70)
lines.append("  MAIN RESULTS — 10-fold Stratified CV (AUC)")
lines.append("-"*70)

for name, model in models.items():
    scores = cross_val_score(model, X_all, y, cv=cv, scoring="roc_auc")
    mean_auc = scores.mean()
    std_auc = scores.std()
    ci_lo = mean_auc - 1.96 * std_auc
    ci_hi = mean_auc + 1.96 * std_auc
    results[name] = {"mean": mean_auc, "std": std_auc, "scores": scores}
    line = (f"  {name:<25} AUC = {mean_auc:.4f} ± {std_auc:.4f}  "
            f"95%CI [{ci_lo:.4f}, {ci_hi:.4f}]")
    lines.append(line)
    print(line)

# Best model
best_name = max(results, key=lambda k: results[k]["mean"])
best_mean = results[best_name]["mean"]
lines.append(f"\n  Best model: {best_name} (AUC={best_mean:.4f})")
print(f"\n  Best model: {best_name} (AUC={best_mean:.4f})")

# ─── Feature importances ─────────────────────────────────────────────────────
lines.append("\n" + "-"*70)
lines.append(f"  FEATURE IMPORTANCES — {best_name} (top 15)")
lines.append("-"*70)

best_model = models[best_name]
best_model.fit(X_all, y)

if hasattr(best_model, "feature_importances_"):
    importances = best_model.feature_importances_
elif hasattr(best_model, "named_steps"):
    clf = best_model.named_steps["clf"]
    importances = np.abs(clf.coef_[0])
else:
    importances = None

if importances is not None:
    feat_imp = sorted(zip(ALL_FEATS, importances), key=lambda x: x[1], reverse=True)[:15]
    for rank, (feat, imp) in enumerate(feat_imp, 1):
        line = f"  {rank:2d}. {feat:<12} {imp:.4f}"
        lines.append(line)
        print(line)

# ─── Sub-analyses ─────────────────────────────────────────────────────────────
lines.append("\n" + "-"*70)
lines.append(f"  SUB-ANALYSES — {best_name}, 10-fold CV")
lines.append("-"*70)

subsets = {
    "HADS only (10)": HADS_FEATS,
    "SEAMS only (10)": SEAMS_FEATS,
    "BMQ only (7)": BMQ_FEATS,
    "HADS + SEAMS (20)": HADS_FEATS + SEAMS_FEATS,
    "HADS + BMQ (17)": HADS_FEATS + BMQ_FEATS,
    "SEAMS + BMQ (17)": SEAMS_FEATS + BMQ_FEATS,
}

for subset_name, feats in subsets.items():
    # Need complete data for this subset
    mask_sub = df_clean[feats].notna().all(axis=1)
    X_sub = df_clean.loc[mask_sub, feats].values.astype(float)
    y_sub = df_clean.loc[mask_sub, "adherent"].values

    # Rebuild model same type
    if best_name == "Logistic Regression":
        sub_model = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(C=1, max_iter=1000, random_state=42))
        ])
    elif best_name == "Random Forest":
        sub_model = RandomForestClassifier(n_estimators=200, random_state=42)
    elif best_name == "Gradient Boosting":
        sub_model = GradientBoostingClassifier(n_estimators=200, random_state=42)
    elif best_name == "XGBoost":
        sub_model = XGBClassifier(n_estimators=200, random_state=42,
                                   eval_metric="logloss", verbosity=0)

    scores_sub = cross_val_score(sub_model, X_sub, y_sub, cv=cv, scoring="roc_auc")
    mean_sub = scores_sub.mean()
    std_sub = scores_sub.std()
    line = f"  {subset_name:<25} AUC = {mean_sub:.4f} ± {std_sub:.4f}  (n={len(X_sub)})"
    lines.append(line)
    print(line)

lines.append("\n" + "="*70)

# ─── Write output ─────────────────────────────────────────────────────────────
output_text = "\n".join(lines)
with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
    f.write(output_text)

print(f"\nResults written to: {OUTPUT_PATH}")
