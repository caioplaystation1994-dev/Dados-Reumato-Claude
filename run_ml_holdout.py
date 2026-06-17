import json
import numpy as np
import pandas as pd
import sys
import os

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (roc_auc_score, roc_curve, confusion_matrix, accuracy_score)

try:
    from xgboost import XGBClassifier
    xgb_available = True
except ImportError:
    xgb_available = False

OUTPUT_FILE = '/home/user/Dados-Reumato-Claude/ml_holdout_results.txt'
ROC_FILE = '/home/user/Dados-Reumato-Claude/ml_holdout_roc.png'
DATA_FILE = '/root/.claude/uploads/e8adc5a8-da29-5395-b412-4b73c749cad3/a2dbaa3d-backup_reumatologia_20260617.json'

lines = []

def log(msg=''):
    print(msg)
    lines.append(str(msg))

# ── 1. Load data ──────────────────────────────────────────────────────────────
log("Loading data...")
with open(DATA_FILE, 'r', encoding='utf-8') as f:
    raw = json.load(f)

df = pd.json_normalize(raw)
log(f"Raw shape: {df.shape}")

# ── Column mapping ────────────────────────────────────────────────────────────
# CQR: cqr_respostas.1 .. cqr_respostas.19
# HADS anxiety: hads_respostas.1A,2A,3A,4A,5A,6A,7A
# HADS depression: hads_respostas.1D,2D,3D,4D,5D,6D,7D
# SEAMS: seams_respostas.1 .. seams_respostas.13
# BMQ concerns: bmq_respostas.bmqc-1 .. bmq_respostas.bmqc-6
# BMQ necessity: bmq_respostas.bmqn-1 .. bmq_respostas.bmqn-5

# ── 2. CQR discriminant ───────────────────────────────────────────────────────
cqr_src_cols = [f'cqr_respostas.{i}' for i in range(1, 20)]
cqr_coefs = [0.076, 0.151, 0.146, -0.076, 0.183, -0.018, 0.148, 0.046,
             0.134, 0.176, 0.076, 0.029, 0.076, 0.126, 0.172, 0.134,
             0.115, 0.076, 0.167]

for c in cqr_src_cols:
    df[c] = pd.to_numeric(df[c], errors='coerce')

found_cqr = [c for c in cqr_src_cols if c in df.columns]
log(f"CQR columns found: {len(found_cqr)}/19")

score = pd.Series(-6.434, index=df.index, dtype=float)
for col, coef in zip(cqr_src_cols, cqr_coefs):
    if col in df.columns:
        score = score + coef * df[col]

df['cqr_disc_score'] = score
df['adherent'] = (score > -0.5849).astype(int)

# ── 3. Feature mapping ────────────────────────────────────────────────────────
# Requested names -> actual column names
# HADS items: hads1a=hads_respostas.1A, hads3a=hads_respostas.3A, etc.
# The HADS items requested (27 features):
#   Anxiety: hads1a,hads3a,hads5a,hads7a,hads6a  (items 1,3,5,7,6 — but spec also has hads1d..hads6d)
#   Depression: hads1d,hads3d,hads4d,hads5d,hads6d
#   SEAMS: seams1..seams11 (items 1-4,6-11 — note item 5 and 12,13 not listed)
#   BMQ: bmqc1,bmqc3,bmqc4,bmqn2,bmqn3,bmqc6,bmqn5

feat_map = {
    # HADS anxiety
    'hads1a':  'hads_respostas.1A',
    'hads3a':  'hads_respostas.3A',
    'hads5a':  'hads_respostas.5A',
    'hads7a':  'hads_respostas.7A',
    'hads6a':  'hads_respostas.6A',
    # HADS depression
    'hads1d':  'hads_respostas.1D',
    'hads3d':  'hads_respostas.3D',
    'hads4d':  'hads_respostas.4D',
    'hads5d':  'hads_respostas.5D',
    'hads6d':  'hads_respostas.6D',
    # SEAMS
    'seams1':  'seams_respostas.1',
    'seams2':  'seams_respostas.2',
    'seams3':  'seams_respostas.3',
    'seams4':  'seams_respostas.4',
    'seams6':  'seams_respostas.6',
    'seams7':  'seams_respostas.7',
    'seams8':  'seams_respostas.8',
    'seams9':  'seams_respostas.9',
    'seams10': 'seams_respostas.10',
    'seams11': 'seams_respostas.11',
    # BMQ
    'bmqc1':   'bmq_respostas.bmqc-1',
    'bmqc3':   'bmq_respostas.bmqc-3',
    'bmqc4':   'bmq_respostas.bmqc-4',
    'bmqn2':   'bmq_respostas.bmqn-2',
    'bmqn3':   'bmq_respostas.bmqn-3',
    'bmqc6':   'bmq_respostas.bmqc-6',
    'bmqn5':   'bmq_respostas.bmqn-5',
}

feature_names = list(feat_map.keys())  # 27 logical names

# Check availability
available = {k: v for k, v in feat_map.items() if v in df.columns}
missing = [k for k in feat_map if feat_map[k] not in df.columns]
log(f"Feature columns found: {len(available)}/27")
if missing:
    log(f"Missing features: {missing}")

# Build working dataframe with renamed columns
work_cols = {v: k for k, v in available.items()}
df_work = df[[feat_map[k] for k in available] + ['adherent', 'cqr_disc_score']].rename(columns=work_cols)

for col in list(available.keys()):
    df_work[col] = pd.to_numeric(df_work[col], errors='coerce')

available_feats = list(available.keys())

# Drop rows with NaN in features or target
df_clean = df_work[available_feats + ['adherent', 'cqr_disc_score']].dropna()

log(f"\nRows before dropna: {len(df)}")
log(f"Rows after dropna:  {len(df_clean)}")
log(f"Class distribution: Adherent={df_clean['adherent'].sum()} | Non-adherent={(df_clean['adherent']==0).sum()}")
log(f"Adherence rate: {df_clean['adherent'].mean()*100:.1f}%")

X = df_clean[available_feats].values
y = df_clean['adherent'].values

if len(np.unique(y)) < 2:
    log("\nERROR: Only one class present in target. Check CQR scoring.")
    sys.exit(1)

# ── 4. Train/test split ───────────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)

log(f"\nTrain size: {len(X_train)} | Test size: {len(X_test)}")
log(f"Train class dist: Adherent={y_train.sum()} | Non-adherent={(y_train==0).sum()}")
log(f"Test  class dist: Adherent={y_test.sum()} | Non-adherent={(y_test==0).sum()}")

# ── 5. Model definitions ──────────────────────────────────────────────────────
models = {
    'Logistic Regression': Pipeline([
        ('scaler', StandardScaler()),
        ('clf', LogisticRegression(C=1, max_iter=1000, random_state=42))
    ]),
    'Random Forest': RandomForestClassifier(n_estimators=200, random_state=42),
    'Gradient Boosting': GradientBoostingClassifier(n_estimators=200, random_state=42),
}

if xgb_available:
    models['XGBoost'] = XGBClassifier(
        n_estimators=200, random_state=42,
        use_label_encoder=False, eval_metric='logloss',
        verbosity=0
    )
else:
    log("\nWARNING: XGBoost not available, skipping.")

# ── 6. 10-fold CV on training set ─────────────────────────────────────────────
log("\n" + "="*60)
log("10-FOLD STRATIFIED CV (training set)")
log("="*60)

cv = StratifiedKFold(n_splits=10, shuffle=True, random_state=42)
cv_results = {}

for name, model in models.items():
    scores = cross_val_score(model, X_train, y_train, cv=cv, scoring='roc_auc', n_jobs=-1)
    cv_results[name] = scores
    log(f"{name}: AUC = {scores.mean():.4f} ± {scores.std():.4f}")

# ── 7-8. Train on full 80% and evaluate on 20% ───────────────────────────────
log("\n" + "="*60)
log("HELD-OUT TEST SET EVALUATION (20%)")
log("="*60)

test_results = {}
trained_models = {}

for name, model in models.items():
    model.fit(X_train, y_train)
    trained_models[name] = model

    if hasattr(model, 'predict_proba'):
        y_prob = model.predict_proba(X_test)[:, 1]
    else:
        y_prob = model.decision_function(X_test)

    y_pred = (y_prob >= 0.5).astype(int)

    auc = roc_auc_score(y_test, y_prob)
    acc = accuracy_score(y_test, y_pred)

    tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    ppv = tp / (tp + fp) if (tp + fp) > 0 else 0
    npv = tn / (tn + fn) if (tn + fn) > 0 else 0

    test_results[name] = {
        'auc': auc, 'accuracy': acc,
        'sensitivity': sensitivity, 'specificity': specificity,
        'ppv': ppv, 'npv': npv,
        'y_prob': y_prob, 'y_pred': y_pred,
        'tp': tp, 'tn': tn, 'fp': fp, 'fn': fn
    }

    log(f"\n{name}:")
    log(f"  AUC:         {auc:.4f}")
    log(f"  Accuracy:    {acc:.4f}")
    log(f"  Sensitivity: {sensitivity:.4f}")
    log(f"  Specificity: {specificity:.4f}")
    log(f"  PPV:         {ppv:.4f}")
    log(f"  NPV:         {npv:.4f}")
    log(f"  TP={tp} TN={tn} FP={fp} FN={fn}")

# ── 9. ROC curves ─────────────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(8, 6))
colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728']

for (name, res), color in zip(test_results.items(), colors):
    fpr, tpr, _ = roc_curve(y_test, res['y_prob'])
    ax.plot(fpr, tpr, color=color, lw=2,
            label=f"{name} (AUC={res['auc']:.3f})")

ax.plot([0, 1], [0, 1], 'k--', lw=1)
ax.set_xlabel('False Positive Rate', fontsize=12)
ax.set_ylabel('True Positive Rate', fontsize=12)
ax.set_title('ROC Curves — Held-out Test Set (20%)', fontsize=13)
ax.legend(loc='lower right', fontsize=10)
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig(ROC_FILE, dpi=150)
plt.close()
log(f"\nROC plot saved to: {ROC_FILE}")

# ── 10. Feature importances for best model ────────────────────────────────────
best_model_name = max(test_results, key=lambda n: test_results[n]['auc'])
log(f"\n{'='*60}")
log(f"FEATURE IMPORTANCES — Best model: {best_model_name}")
log("="*60)

best_model = trained_models[best_model_name]

importances = None
if isinstance(best_model, Pipeline):
    clf = best_model.named_steps['clf']
    if hasattr(clf, 'coef_'):
        importances = np.abs(clf.coef_[0])
elif hasattr(best_model, 'feature_importances_'):
    importances = best_model.feature_importances_

if importances is not None:
    feat_imp = sorted(zip(available_feats, importances), key=lambda x: x[1], reverse=True)
    log(f"{'Feature':<15} {'Importance':>12}")
    log("-" * 28)
    for feat, imp in feat_imp[:15]:
        log(f"{feat:<15} {imp:>12.4f}")
else:
    log("Feature importances not available for this model type.")

# ── Summary ───────────────────────────────────────────────────────────────────
log(f"\n{'='*60}")
log("SUMMARY — CV AUC vs Test AUC")
log("="*60)
log(f"{'Model':<25} {'CV AUC':>12} {'Test AUC':>10}")
log("-" * 50)
for name in models:
    cv_m = cv_results[name].mean()
    cv_s = cv_results[name].std()
    t_auc = test_results[name]['auc']
    log(f"{name:<25} {cv_m:.4f}±{cv_s:.3f} {t_auc:>10.4f}")

# Save to file
with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

log(f"\nResults saved to: {OUTPUT_FILE}")
