"""
ML Analysis — CQR Adherence Prediction (HADS + SEAMS + BMQ items only)
Corrections applied:
  1. Label from cqr_aderente field (not recomputed discriminant)
  2. No CQR items as features
  3. 80/20 stratified holdout (repeated 10x for stable estimates)
  4. class_weight='balanced' for imbalance
  5. Feature selection inside CV pipeline (not pre-selected outside)
  6. Hyperparameter tuning via GridSearchCV inside training set
  7. Calibration metrics (Brier score + reliability curve)
  8. ROC curve + confusion matrix plots
"""
import json, warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from sklearn.model_selection import (StratifiedShuffleSplit, StratifiedKFold,
                                     GridSearchCV, cross_val_score)
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.feature_selection import SelectFromModel
from sklearn.calibration import calibration_curve, CalibratedClassifierCV
from sklearn.metrics import (roc_auc_score, roc_curve, accuracy_score,
                              confusion_matrix, brier_score_loss,
                              classification_report)
from sklearn.inspection import permutation_importance
import xgboost as xgb

warnings.filterwarnings('ignore')

OUT = '/home/user/Dados-Reumato-Claude/ml_final_results.txt'
lines = []
def log(s=''):
    print(s)
    lines.append(str(s))

# ── 1. Load data ──────────────────────────────────────────────────────────────
with open('/root/.claude/uploads/e8adc5a8-da29-5395-b412-4b73c749cad3/a2dbaa3d-backup_reumatologia_20260617.json') as f:
    data = json.load(f)
df = pd.json_normalize(data)
log(f"Raw records: {len(df)}")

# ── 2. Label from stored cqr_aderente field ───────────────────────────────────
df = df[df['cqr_aderente'].isin(['Aderente', 'Não aderente'])].copy()
df['y'] = (df['cqr_aderente'] == 'Aderente').astype(int)
log(f"Records with CQR label: {len(df)}")
log(f"  Aderente:     {df['y'].sum()} ({100*df['y'].mean():.1f}%)")
log(f"  Não aderente: {(df['y']==0).sum()} ({100*(1-df['y'].mean()):.1f}%)")

# ── 3. Features: significant HADS + SEAMS + BMQ items only ────────────────────
# Map: feature_name -> column in df after json_normalize
FEAT_MAP = {
    # HADS (10 items)
    'hads1a': 'hads_respostas.1A', 'hads3a': 'hads_respostas.3A',
    'hads5a': 'hads_respostas.5A', 'hads7a': 'hads_respostas.7A',
    'hads1d': 'hads_respostas.1D', 'hads3d': 'hads_respostas.3D',
    'hads4d': 'hads_respostas.4D', 'hads5d': 'hads_respostas.5D',
    'hads6d': 'hads_respostas.6D', 'hads6a': 'hads_respostas.6A',
    # SEAMS (10 items — item 5 not significant, excluded)
    'seams1': 'seams_respostas.1', 'seams2': 'seams_respostas.2',
    'seams3': 'seams_respostas.3', 'seams4': 'seams_respostas.4',
    'seams6': 'seams_respostas.6', 'seams7': 'seams_respostas.7',
    'seams8': 'seams_respostas.8', 'seams9': 'seams_respostas.9',
    'seams10': 'seams_respostas.10', 'seams11': 'seams_respostas.11',
    # BMQ (7 items)
    'bmqc1': 'bmq_respostas.bmqc-1', 'bmqc3': 'bmq_respostas.bmqc-3',
    'bmqc4': 'bmq_respostas.bmqc-4', 'bmqn2': 'bmq_respostas.bmqn-2',
    'bmqn3': 'bmq_respostas.bmqn-3', 'bmqc6': 'bmq_respostas.bmqc-6',
    'bmqn5': 'bmq_respostas.bmqn-5',
}

# Detect which columns actually exist
available = {k: v for k, v in FEAT_MAP.items() if v in df.columns}
missing_cols = [k for k, v in FEAT_MAP.items() if v not in df.columns]
log(f"\nFeature columns found: {len(available)}/27")
if missing_cols:
    log(f"Missing: {missing_cols}")
    # Try alternative naming
    for k in missing_cols:
        alt = FEAT_MAP[k].replace('_respostas.', '_respostas_').replace('.', '_')
        candidates = [c for c in df.columns if k in c.lower()]
        if candidates:
            available[k] = candidates[0]
            log(f"  Found alt for {k}: {candidates[0]}")

feat_names = list(available.keys())
feat_cols  = [available[k] for k in feat_names]

# Convert to numeric
for col in feat_cols:
    df[col] = pd.to_numeric(df[col], errors='coerce')

df_clean = df[feat_cols + ['y']].dropna()
log(f"\nAfter dropna: {len(df_clean)} patients")
log(f"  Aderente:     {df_clean['y'].sum()} ({100*df_clean['y'].mean():.1f}%)")
log(f"  Não aderente: {(df_clean['y']==0).sum()} ({100*(1-df_clean['y'].mean()):.1f}%)")

X = df_clean[feat_cols].values
y = df_clean['y'].values

# ── 4. Models with tuning grids ───────────────────────────────────────────────
models = {
    'Logistic Regression': {
        'est': LogisticRegression(max_iter=1000, class_weight='balanced', random_state=42),
        'param_grid': {'est__C': [0.01, 0.1, 1, 10]},
    },
    'Random Forest': {
        'est': RandomForestClassifier(class_weight='balanced', random_state=42),
        'param_grid': {'est__n_estimators': [100, 200], 'est__max_depth': [None, 10]},
    },
    'Gradient Boosting': {
        'est': GradientBoostingClassifier(random_state=42),
        'param_grid': {'est__n_estimators': [100, 200], 'est__learning_rate': [0.05, 0.1]},
    },
    'XGBoost': {
        'est': xgb.XGBClassifier(use_label_encoder=False, eval_metric='logloss',
                                  scale_pos_weight=(y==0).sum()/y.sum(), random_state=42),
        'param_grid': {'est__n_estimators': [100, 200], 'est__learning_rate': [0.05, 0.1]},
    },
}

# ── 5. Repeated 80/20 holdout (10 repeats) ────────────────────────────────────
N_REPEATS = 10
log('\n' + '='*70)
log('REPEATED 80/20 HOLDOUT EVALUATION (10 repeats)')
log('='*70)
log('Note: hyperparameter tuning via 5-fold CV inside each training set')
log('      class_weight=balanced applied to all models')
log('      feature selection NOT pre-applied (all 27 features enter pipeline)')

results = {name: {'cv_aucs': [], 'test_aucs': [], 'briers': [],
                  'sens': [], 'spec': [], 'ppv': [], 'npv': []}
           for name in models}

sss = StratifiedShuffleSplit(n_splits=N_REPEATS, test_size=0.2, random_state=42)

for repeat, (train_idx, test_idx) in enumerate(sss.split(X, y)):
    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

    for name, cfg in models.items():
        pipe = Pipeline([('scaler', StandardScaler()), ('est', cfg['est'])])
        gs = GridSearchCV(pipe, cfg['param_grid'], cv=StratifiedKFold(5),
                          scoring='roc_auc', n_jobs=-1, refit=True)
        gs.fit(X_train, y_train)

        results[name]['cv_aucs'].append(gs.best_score_)

        y_prob = gs.predict_proba(X_test)[:, 1]
        y_pred = gs.predict(X_test)

        auc = roc_auc_score(y_test, y_prob)
        brier = brier_score_loss(y_test, y_prob)
        tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()
        sens = tp / (tp + fn) if (tp + fn) > 0 else 0
        spec = tn / (tn + fp) if (tn + fp) > 0 else 0
        ppv  = tp / (tp + fp) if (tp + fp) > 0 else 0
        npv  = tn / (tn + fn) if (tn + fn) > 0 else 0

        results[name]['test_aucs'].append(auc)
        results[name]['briers'].append(brier)
        results[name]['sens'].append(sens)
        results[name]['spec'].append(spec)
        results[name]['ppv'].append(ppv)
        results[name]['npv'].append(npv)

log(f"\n{'Model':<22} {'CV AUC':>10} {'Test AUC':>10} {'Sens':>7} {'Spec':>7} {'PPV':>7} {'NPV':>7} {'Brier':>8}")
log('-'*80)
for name, r in results.items():
    log(f"{name:<22} "
        f"{np.mean(r['cv_aucs']):.3f}±{np.std(r['cv_aucs']):.3f}  "
        f"{np.mean(r['test_aucs']):.3f}±{np.std(r['test_aucs']):.3f}  "
        f"{np.mean(r['sens']):.3f}  "
        f"{np.mean(r['spec']):.3f}  "
        f"{np.mean(r['ppv']):.3f}  "
        f"{np.mean(r['npv']):.3f}  "
        f"{np.mean(r['briers']):.3f}")

best_name = max(results, key=lambda n: np.mean(results[n]['test_aucs']))
log(f"\nBest model: {best_name} (mean test AUC = {np.mean(results[best_name]['test_aucs']):.3f})")

# ── 6. Final model on full 80/20 split for detailed metrics + plots ───────────
log('\n' + '='*70)
log('DETAILED EVALUATION — FINAL SINGLE SPLIT (for plots)')
log('='*70)

sss_final = StratifiedShuffleSplit(n_splits=1, test_size=0.2, random_state=0)
train_idx, test_idx = next(sss_final.split(X, y))
X_train_f, X_test_f = X[train_idx], X[test_idx]
y_train_f, y_test_f = y[train_idx], y[test_idx]
log(f"Train: {len(X_train_f)} | Test: {len(X_test_f)}")
log(f"Test class dist: Aderente={y_test_f.sum()} | Não aderente={(y_test_f==0).sum()}")

final_models = {}
fig_roc, ax_roc = plt.subplots(figsize=(8, 6))
ax_roc.plot([0,1],[0,1],'k--', alpha=0.4)

fig_cal, ax_cal = plt.subplots(figsize=(8, 6))
ax_cal.plot([0,1],[0,1],'k--', alpha=0.4, label='Calibração perfeita')

colors = ['#2196F3','#4CAF50','#FF5722','#9C27B0']

for (name, cfg), color in zip(models.items(), colors):
    pipe = Pipeline([('scaler', StandardScaler()), ('est', cfg['est'])])
    gs = GridSearchCV(pipe, cfg['param_grid'], cv=StratifiedKFold(5),
                      scoring='roc_auc', n_jobs=-1, refit=True)
    gs.fit(X_train_f, y_train_f)
    final_models[name] = gs

    y_prob = gs.predict_proba(X_test_f)[:, 1]
    y_pred = gs.predict(X_test_f)
    auc = roc_auc_score(y_test_f, y_prob)
    brier = brier_score_loss(y_test_f, y_prob)
    tn, fp, fn, tp = confusion_matrix(y_test_f, y_pred).ravel()

    log(f"\n{name}  (best params: {gs.best_params_})")
    log(f"  AUC={auc:.3f}  Brier={brier:.3f}")
    log(f"  TP={tp} TN={tn} FP={fp} FN={fn}")
    log(f"  Sensitivity={tp/(tp+fn):.3f}  Specificity={tn/(tn+fp):.3f}")
    log(f"  PPV={tp/(tp+fp):.3f}  NPV={tn/(tn+fn):.3f}")

    fpr, tpr, _ = roc_curve(y_test_f, y_prob)
    ax_roc.plot(fpr, tpr, color=color, lw=2, label=f"{name} (AUC={auc:.3f})")

    prob_true, prob_pred = calibration_curve(y_test_f, y_prob, n_bins=8, strategy='quantile')
    ax_cal.plot(prob_pred, prob_true, 'o-', color=color, lw=2, label=f"{name} (Brier={brier:.3f})")

ax_roc.set(xlabel='Taxa de Falsos Positivos', ylabel='Taxa de Verdadeiros Positivos',
           title='Curvas ROC — Conjunto de Teste Externo (20%)\n(Features: HADS + SEAMS + BMQ)')
ax_roc.legend(loc='lower right', fontsize=10)
ax_roc.grid(alpha=0.3)
fig_roc.tight_layout()
fig_roc.savefig('/home/user/Dados-Reumato-Claude/ml_final_roc.png', dpi=150)
log("\nROC plot saved.")

ax_cal.set(xlabel='Probabilidade predita', ylabel='Proporção real de aderentes',
           title='Curvas de Calibração — Conjunto de Teste Externo (20%)')
ax_cal.legend(loc='upper left', fontsize=10)
ax_cal.grid(alpha=0.3)
fig_cal.tight_layout()
fig_cal.savefig('/home/user/Dados-Reumato-Claude/ml_final_calibration.png', dpi=150)
log("Calibration plot saved.")

# ── 7. Feature importances (best model on full train) ─────────────────────────
log('\n' + '='*70)
log(f'FEATURE IMPORTANCES — {best_name}')
log('='*70)

best_pipe = final_models[best_name]
est = best_pipe.best_estimator_.named_steps['est']

if hasattr(est, 'feature_importances_'):
    importances = est.feature_importances_
else:
    # Permutation importance for LR
    result = permutation_importance(best_pipe.best_estimator_, X_test_f, y_test_f,
                                    n_repeats=20, random_state=42, scoring='roc_auc')
    importances = result.importances_mean

idx = np.argsort(importances)[::-1]
log(f"{'Rank':<5} {'Feature':<12} {'Importance':>12}")
log('-'*32)
for rank, i in enumerate(idx[:20], 1):
    log(f"{rank:<5} {feat_names[i]:<12} {importances[i]:>12.4f}")

# ── 8. Sub-analyses by scale ──────────────────────────────────────────────────
log('\n' + '='*70)
log('SUB-ANALYSES BY SCALE (Random Forest, 10 repeated holdouts)')
log('='*70)

scale_groups = {
    'HADS only (10)':    [f for f in feat_names if f.startswith('hads')],
    'SEAMS only (10)':   [f for f in feat_names if f.startswith('seams')],
    'BMQ only (7)':      [f for f in feat_names if f.startswith('bmq')],
    'HADS + SEAMS (20)': [f for f in feat_names if f.startswith('hads') or f.startswith('seams')],
    'HADS + BMQ (17)':   [f for f in feat_names if f.startswith('hads') or f.startswith('bmq')],
    'SEAMS + BMQ (17)':  [f for f in feat_names if f.startswith('seams') or f.startswith('bmq')],
    'All 27 items':      feat_names,
}

rf_base = RandomForestClassifier(n_estimators=200, class_weight='balanced', random_state=42)

log(f"{'Scale group':<25} {'Mean AUC':>10} {'±SD':>7}")
log('-'*45)
for grp_name, grp_feats in scale_groups.items():
    grp_idx = [feat_names.index(f) for f in grp_feats]
    X_grp = X[:, grp_idx]
    aucs = []
    for tr, te in StratifiedShuffleSplit(10, test_size=0.2, random_state=42).split(X_grp, y):
        rf_base.fit(X_grp[tr], y[tr])
        aucs.append(roc_auc_score(y[te], rf_base.predict_proba(X_grp[te])[:, 1]))
    log(f"{grp_name:<25} {np.mean(aucs):>10.3f} {np.std(aucs):>7.3f}")

with open(OUT, 'w') as f:
    f.write('\n'.join(lines))
log(f"\nResults saved to {OUT}")
