#!/usr/bin/env python3
"""
ML Analysis: Medication Adherence Prediction
Data: Rheumatology backup JSON
"""

import json
import sys
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.preprocessing import LabelEncoder
import warnings
warnings.filterwarnings('ignore')

# ── Tee: output to stdout AND file ──────────────────────────────────────────
class Tee:
    def __init__(self, filename):
        self.terminal = sys.stdout
        self.log = open(filename, 'w', encoding='utf-8')

    def write(self, message):
        self.terminal.write(message)
        self.log.write(message)

    def flush(self):
        self.terminal.flush()
        self.log.flush()

    def close(self):
        self.log.close()

OUTPUT_FILE = '/home/user/Dados-Reumato-Claude/ml_items_auroc_results.txt'
tee = Tee(OUTPUT_FILE)
sys.stdout = tee

# ── Constants ────────────────────────────────────────────────────────────────
DATA_PATH = '/root/.claude/uploads/e8adc5a8-da29-5395-b412-4b73c749cad3/a2dbaa3d-backup_reumatologia_20260617.json'

# van den Bemt CQR discriminant coefficients
CQR_COEFS = {
    'cqr1': 0.076, 'cqr2': 0.151, 'cqr3': 0.146, 'cqr4': -0.076,
    'cqr5': 0.183, 'cqr6': -0.018, 'cqr7': 0.148, 'cqr8': 0.046,
    'cqr9': 0.134, 'cqr10': 0.176, 'cqr11': 0.076, 'cqr12': 0.029,
    'cqr13': 0.076, 'cqr14': 0.126, 'cqr15': 0.172, 'cqr16': 0.134,
    'cqr17': 0.115, 'cqr18': 0.076, 'cqr19': 0.167,
}
CQR_CONSTANT = -6.434
CQR_THRESHOLD = -0.5849

# Feature keys to check
REQUIRED_KEYS = [
    'cqr3', 'cqr5', 'cqr8', 'cqr9', 'cqr15', 'cqr16', 'cqr17', 'cqr19',
    'hads1a', 'hads3a', 'hads5a', 'hads7a',
    'hads1d', 'hads3d', 'hads4d', 'hads5d', 'hads6d', 'hads6a',
    'seams1', 'seams2', 'seams3', 'seams4', 'seams6', 'seams7',
    'seams8', 'seams9', 'seams10', 'seams11',
    'bmqc1', 'bmqc3', 'bmqc4', 'bmqn2', 'bmqn3', 'bmqc6', 'bmqn5',
]

CQR_ITEMS = ['cqr3', 'cqr5', 'cqr8', 'cqr9', 'cqr15', 'cqr16', 'cqr17', 'cqr19']
NON_CQR_ITEMS = [k for k in REQUIRED_KEYS if k not in CQR_ITEMS]

# ── Load data ────────────────────────────────────────────────────────────────
print("=" * 70)
print("ML ADHERENCE ANALYSIS — RHEUMATOLOGY DATA")
print("=" * 70)
print(f"\nLoading data from: {DATA_PATH}")

with open(DATA_PATH, 'r', encoding='utf-8') as f:
    raw = json.load(f)

print(f"Total records loaded: {len(raw)}")

# ── Flatten each record ──────────────────────────────────────────────────────
def flatten_record(rec):
    flat = {}

    # CQR items: cqr_respostas keys are "1".."19" → cqr1..cqr19
    cqr = rec.get('cqr_respostas', {})
    for k, v in cqr.items():
        try:
            flat[f'cqr{k}'] = float(v) if v != '' else np.nan
        except (ValueError, TypeError):
            flat[f'cqr{k}'] = np.nan

    # HADS items: hads_respostas keys like "1A","1D" → hads1a, hads1d
    hads = rec.get('hads_respostas', {})
    for k, v in hads.items():
        key = 'hads' + k.lower().replace('-', '')
        try:
            flat[key] = float(v) if v != '' else np.nan
        except (ValueError, TypeError):
            flat[key] = np.nan

    # SEAMS items: seams_respostas keys "1".."13" → seams1..seams13
    seams = rec.get('seams_respostas', {})
    for k, v in seams.items():
        try:
            flat[f'seams{k}'] = float(v) if v != '' else np.nan
        except (ValueError, TypeError):
            flat[f'seams{k}'] = np.nan

    # BMQ items: bmq_respostas keys like "bmqn-1","bmqc-1" → bmqn1, bmqc1
    bmq = rec.get('bmq_respostas', {})
    for k, v in bmq.items():
        key = k.replace('-', '').lower()
        try:
            flat[key] = float(v) if v != '' else np.nan
        except (ValueError, TypeError):
            flat[key] = np.nan

    # Adherence label
    adesao = rec.get('adesao_cqr', None)
    if adesao is not None and adesao != '':
        flat['adesao_cqr'] = adesao
    else:
        flat['adesao_cqr'] = None

    # Also store pre-computed cqr_aderente if present
    flat['cqr_aderente'] = rec.get('cqr_aderente', None)

    return flat

records = [flatten_record(r) for r in raw]
df = pd.DataFrame(records)

print(f"Flattened dataframe shape: {df.shape}")

# ── Check which required keys exist ─────────────────────────────────────────
print("\n--- Feature Key Availability ---")
existing_keys = [k for k in REQUIRED_KEYS if k in df.columns]
missing_keys  = [k for k in REQUIRED_KEYS if k not in df.columns]
print(f"Keys found ({len(existing_keys)}): {existing_keys}")
print(f"Keys missing ({len(missing_keys)}): {missing_keys}")

# ── Compute adherence label y ────────────────────────────────────────────────
def compute_label(row):
    # Use existing adesao_cqr if present
    if row.get('adesao_cqr') is not None:
        val = row['adesao_cqr']
        if isinstance(val, (int, float)):
            return int(val)
        if isinstance(val, str):
            v = val.strip().lower()
            if v in ('1', 'aderente', 'adherent', 'sim', 'yes', 'true'):
                return 1
            if v in ('0', 'nao', 'não', 'non-adherent', 'nao aderente', 'não aderente', 'no', 'false'):
                return 0

    # Fall back: use pre-computed cqr_aderente field
    ca = row.get('cqr_aderente')
    if ca is not None and ca != '':
        v = str(ca).strip().lower()
        if 'aderente' in v and 'não' not in v and 'nao' not in v:
            return 1
        if 'não' in v or 'nao' in v or v == 'não aderente':
            return 0

    # Fall back: discriminant score from CQR items
    score = CQR_CONSTANT
    missing_any = False
    for item, coef in CQR_COEFS.items():
        val = row.get(item)
        if val is None or (isinstance(val, float) and np.isnan(val)):
            missing_any = True
            break
        score += coef * float(val)
    if missing_any:
        return np.nan
    return 1 if score > CQR_THRESHOLD else 0

df['y'] = df.apply(compute_label, axis=1)

print(f"\n--- Adherence Label Distribution ---")
vc = df['y'].value_counts(dropna=False)
print(vc.to_string())

# ── Filter to usable rows ────────────────────────────────────────────────────
# Use only keys that exist in data
avail_keys = [k for k in REQUIRED_KEYS if k in df.columns]

# Drop rows where y is missing
df_clean = df[df['y'].notna()].copy()
df_clean['y'] = df_clean['y'].astype(int)

# Drop rows where any feature is null
df_clean = df_clean.dropna(subset=avail_keys)

print(f"\nRows after filtering (non-null features + valid label): {len(df_clean)}")
print(f"Class distribution: {dict(df_clean['y'].value_counts().sort_index())}")

if len(df_clean) < 20:
    print("\nERROR: Not enough samples for cross-validation. Aborting.")
    sys.stdout = tee.terminal
    tee.close()
    sys.exit(1)

# ── ML helpers ───────────────────────────────────────────────────────────────
def run_cv(X, y, label=""):
    models = {
        'Logistic Regression': LogisticRegression(C=1.0, max_iter=1000, random_state=42),
        'Random Forest':       RandomForestClassifier(n_estimators=100, random_state=42),
        'Gradient Boosting':   GradientBoostingClassifier(random_state=42),
    }
    cv = StratifiedKFold(n_splits=10, shuffle=True, random_state=42)
    results = {}
    if label:
        print(f"\n  {label} (n={len(y)}, n_features={X.shape[1]})")
    for name, model in models.items():
        scores = cross_val_score(model, X, y, cv=cv, scoring='roc_auc', n_jobs=-1)
        results[name] = scores
        print(f"    {name:30s}  AUC = {scores.mean():.4f} ± {scores.std():.4f}")
    return results

# ── 1. Main 10-fold CV with all available items ──────────────────────────────
print("\n" + "=" * 70)
print("SECTION 1: 10-FOLD STRATIFIED CV — ALL AVAILABLE ITEMS")
print("=" * 70)

X_all = df_clean[avail_keys].values
y_all = df_clean['y'].values

results_all = run_cv(X_all, y_all, "All available items")

# Determine best model
best_model_name = max(results_all, key=lambda k: results_all[k].mean())
best_mean_auc   = results_all[best_model_name].mean()
print(f"\nBest model: {best_model_name} (AUC = {best_mean_auc:.4f})")

# ── 2. Feature importances for best model ───────────────────────────────────
print("\n" + "=" * 70)
print(f"SECTION 2: TOP-10 FEATURE IMPORTANCES — {best_model_name.upper()}")
print("=" * 70)

if best_model_name == 'Logistic Regression':
    best_clf = LogisticRegression(C=1.0, max_iter=1000, random_state=42)
    best_clf.fit(X_all, y_all)
    importances = np.abs(best_clf.coef_[0])
    imp_label   = "Abs(Coefficient)"
elif best_model_name == 'Random Forest':
    best_clf = RandomForestClassifier(n_estimators=100, random_state=42)
    best_clf.fit(X_all, y_all)
    importances = best_clf.feature_importances_
    imp_label   = "Feature Importance"
else:
    best_clf = GradientBoostingClassifier(random_state=42)
    best_clf.fit(X_all, y_all)
    importances = best_clf.feature_importances_
    imp_label   = "Feature Importance"

top10_idx = np.argsort(importances)[::-1][:10]
print(f"\n{'Rank':<6} {'Feature':<20} {imp_label}")
print("-" * 45)
for rank, idx in enumerate(top10_idx, 1):
    print(f"{rank:<6} {avail_keys[idx]:<20} {importances[idx]:.6f}")

# ── 3. Sub-analyses ──────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("SECTION 3: SUB-ANALYSES")
print("=" * 70)

avail_cqr     = [k for k in CQR_ITEMS if k in df_clean.columns]
avail_non_cqr = [k for k in NON_CQR_ITEMS if k in df_clean.columns]

print("\n--- A) CQR items only ---")
if avail_cqr:
    df_cqr = df_clean.dropna(subset=avail_cqr)
    X_cqr  = df_cqr[avail_cqr].values
    y_cqr  = df_cqr['y'].values
    if len(np.unique(y_cqr)) >= 2 and len(y_cqr) >= 10:
        run_cv(X_cqr, y_cqr, f"CQR items: {avail_cqr}")
    else:
        print("  Not enough samples or classes for CV.")
else:
    print("  No CQR items available.")

print("\n--- B) Non-CQR items only (HADS + SEAMS + BMQ) ---")
if avail_non_cqr:
    df_nc = df_clean.dropna(subset=avail_non_cqr)
    X_nc  = df_nc[avail_non_cqr].values
    y_nc  = df_nc['y'].values
    if len(np.unique(y_nc)) >= 2 and len(y_nc) >= 10:
        run_cv(X_nc, y_nc, f"Non-CQR items: {avail_non_cqr}")
    else:
        print("  Not enough samples or classes for CV.")
else:
    print("  No non-CQR items available.")

print("\n--- C) All items combined ---")
run_cv(X_all, y_all, "All items combined")

print("\n" + "=" * 70)
print(f"Results saved to: {OUTPUT_FILE}")
print("=" * 70)

sys.stdout = tee.terminal
tee.close()
