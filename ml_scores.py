"""
ML Analysis — Escores totais das escalas vs itens isolados
Features: BMQ necessity, BMQ concerns, SEAMS total, HADS-Ansiedade, HADS-Depressão
Label: cqr_aderente (campo do app)
Pipeline: 80/20 holdout x10 repetições, class_weight=balanced, GridSearchCV
"""
import json, warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from sklearn.model_selection import StratifiedShuffleSplit, StratifiedKFold, GridSearchCV
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (roc_auc_score, roc_curve, brier_score_loss,
                              confusion_matrix)
from sklearn.inspection import permutation_importance
import xgboost as xgb

warnings.filterwarnings('ignore')

OUT = '/home/user/Dados-Reumato-Claude/ml_scores_results.txt'
lines = []
def log(s=''):
    print(s); lines.append(str(s))

# ── 1. Load ───────────────────────────────────────────────────────────────────
with open('/root/.claude/uploads/e8adc5a8-da29-5395-b412-4b73c749cad3/a2dbaa3d-backup_reumatologia_20260617.json') as f:
    data = json.load(f)
df = pd.json_normalize(data)

df = df[df['cqr_aderente'].isin(['Aderente', 'Não aderente'])].copy()
df['y'] = (df['cqr_aderente'] == 'Aderente').astype(int)

# ── 2. Feature sets ───────────────────────────────────────────────────────────
SCORE_FEATS = {
    'bmq_necessity': 'BMQ Necessidade',
    'bmq_concerns':  'BMQ Preocupações',
    'seams_score':   'SEAMS Total',
    'hads_anx':      'HADS Ansiedade',
    'hads_dep':      'HADS Depressão',
}
# HAQ included separately to test
ALL_FEATS = list(SCORE_FEATS.keys()) + ['haq_score']

for col in ALL_FEATS:
    df[col] = pd.to_numeric(df[col], errors='coerce')

df_5  = df[list(SCORE_FEATS.keys()) + ['y']].dropna()
df_6  = df[ALL_FEATS + ['y']].dropna()

log('='*70)
log('ML — ESCORES TOTAIS DAS ESCALAS (sem itens isolados, sem CQR)')
log('='*70)
log(f"\nDataset (5 escores, sem HAQ): n={len(df_5)}  "
    f"Aderente={df_5['y'].sum()} ({100*df_5['y'].mean():.1f}%)  "
    f"Não aderente={(df_5['y']==0).sum()} ({100*(1-df_5['y'].mean()):.1f}%)")
log(f"Dataset (6 escores, com HAQ): n={len(df_6)}  "
    f"Aderente={df_6['y'].sum()} ({100*df_6['y'].mean():.1f}%)  "
    f"Não aderente={(df_6['y']==0).sum()} ({100*(1-df_6['y'].mean()):.1f}%)")

# ── 3. Models ─────────────────────────────────────────────────────────────────
MODELS = {
    'Logistic Regression': (
        LogisticRegression(max_iter=1000, class_weight='balanced', random_state=42),
        {'est__C': [0.01, 0.1, 1, 10]}),
    'Random Forest': (
        RandomForestClassifier(class_weight='balanced', random_state=42),
        {'est__n_estimators': [100, 200], 'est__max_depth': [None, 10]}),
    'Gradient Boosting': (
        GradientBoostingClassifier(random_state=42),
        {'est__n_estimators': [100, 200], 'est__learning_rate': [0.05, 0.1]}),
    'XGBoost': (
        xgb.XGBClassifier(use_label_encoder=False, eval_metric='logloss', random_state=42),
        {'est__n_estimators': [100, 200], 'est__learning_rate': [0.05, 0.1]}),
}

def run_repeated_holdout(X, y, feat_names, label, n_repeats=10):
    log(f"\n{'─'*70}")
    log(f"Feature set: {label}  ({X.shape[1]} features)")
    log(f"{'Model':<22} {'CV AUC':>12} {'Test AUC':>12} {'Sens':>7} {'Spec':>7} {'VPP':>7} {'VPN':>7} {'Brier':>8}")
    log('─'*80)

    sss = StratifiedShuffleSplit(n_splits=n_repeats, test_size=0.2, random_state=42)
    all_results = {}

    for name, (est, grid) in MODELS.items():
        cv_aucs, test_aucs, briers, sens_l, spec_l, ppv_l, npv_l = [],[],[],[],[],[],[]
        # Fix scale_pos_weight for XGBoost per split
        for tr, te in sss.split(X, y):
            X_tr, X_te = X[tr], X[te]
            y_tr, y_te = y[tr], y[te]
            if 'XGBoost' in name:
                est.set_params(scale_pos_weight=(y_tr==0).sum()/y_tr.sum())
            pipe = Pipeline([('sc', StandardScaler()), ('est', est)])
            gs = GridSearchCV(pipe, grid, cv=StratifiedKFold(5),
                              scoring='roc_auc', n_jobs=-1, refit=True)
            gs.fit(X_tr, y_tr)
            cv_aucs.append(gs.best_score_)
            y_prob = gs.predict_proba(X_te)[:,1]
            y_pred = gs.predict(X_te)
            test_aucs.append(roc_auc_score(y_te, y_prob))
            briers.append(brier_score_loss(y_te, y_prob))
            tn,fp,fn,tp = confusion_matrix(y_te, y_pred).ravel()
            sens_l.append(tp/(tp+fn) if tp+fn>0 else 0)
            spec_l.append(tn/(tn+fp) if tn+fp>0 else 0)
            ppv_l.append(tp/(tp+fp) if tp+fp>0 else 0)
            npv_l.append(tn/(tn+fn) if tn+fn>0 else 0)

        all_results[name] = {'test_aucs': test_aucs}
        log(f"{name:<22} "
            f"{np.mean(cv_aucs):.3f}±{np.std(cv_aucs):.3f}  "
            f"{np.mean(test_aucs):.3f}±{np.std(test_aucs):.3f}  "
            f"{np.mean(sens_l):.3f}  {np.mean(spec_l):.3f}  "
            f"{np.mean(ppv_l):.3f}  {np.mean(npv_l):.3f}  "
            f"{np.mean(briers):.3f}")

    return all_results

X5 = df_5[list(SCORE_FEATS.keys())].values
y5 = df_5['y'].values
X6 = df_6[ALL_FEATS].values
y6 = df_6['y'].values

res5 = run_repeated_holdout(X5, y5, list(SCORE_FEATS.keys()), '5 escores (sem HAQ)')
res6 = run_repeated_holdout(X6, y6, ALL_FEATS, '6 escores (com HAQ)')

# ── 4. Comparison table: scores vs items ─────────────────────────────────────
log('\n' + '='*70)
log('COMPARAÇÃO: Escores totais vs Itens isolados (Regressão Logística)')
log('='*70)
log(f"{'Abordagem':<35} {'AUC médio':>10} {'±DP':>7}")
log('─'*55)
log(f"{'Escores totais (5 escalas, sem HAQ)':<35} {np.mean(res5['Logistic Regression']['test_aucs']):>10.3f} {np.std(res5['Logistic Regression']['test_aucs']):>7.3f}")
log(f"{'Escores totais (6 escalas, com HAQ)':<35} {np.mean(res6['Logistic Regression']['test_aucs']):>10.3f} {np.std(res6['Logistic Regression']['test_aucs']):>7.3f}")
log(f"{'Itens isolados (27 itens HADS+SEAMS+BMQ)':<35} {'0.743':>10} {'0.028':>7}  ← análise anterior")

# ── 5. Final single split for plots + feature importances ────────────────────
log('\n' + '='*70)
log('IMPORTÂNCIA DAS FEATURES — Regressão Logística (permutation, 1 split)')
log('='*70)

sss1 = StratifiedShuffleSplit(n_splits=1, test_size=0.2, random_state=0)
tr, te = next(sss1.split(X5, y5))
X_tr, X_te = X5[tr], X5[te]
y_tr, y_te = y5[tr], y5[te]

pipe_lr = Pipeline([('sc', StandardScaler()),
                    ('est', LogisticRegression(C=0.1, max_iter=1000,
                                               class_weight='balanced', random_state=42))])
pipe_lr.fit(X_tr, y_tr)
perm = permutation_importance(pipe_lr, X_te, y_te, n_repeats=30,
                               random_state=42, scoring='roc_auc')
feat_labels = list(SCORE_FEATS.values())
idx = np.argsort(perm.importances_mean)[::-1]
for i in idx:
    log(f"  {feat_labels[i]:<25} {perm.importances_mean[i]:>8.4f} ± {perm.importances_std[i]:.4f}")

# ── 6. ROC plot comparing scores vs items ────────────────────────────────────
fig, ax = plt.subplots(figsize=(8,6))
ax.plot([0,1],[0,1],'k--', alpha=0.4)

colors = {'Logistic Regression':'#2196F3','Random Forest':'#4CAF50',
          'Gradient Boosting':'#FF5722','XGBoost':'#9C27B0'}

# Refit final models for ROC on single split
for name, (est, grid) in MODELS.items():
    if 'XGBoost' in name:
        est.set_params(scale_pos_weight=(y_tr==0).sum()/y_tr.sum())
    pipe = Pipeline([('sc', StandardScaler()), ('est', est)])
    gs = GridSearchCV(pipe, grid, cv=StratifiedKFold(5),
                      scoring='roc_auc', n_jobs=-1, refit=True)
    gs.fit(X_tr, y_tr)
    y_prob = gs.predict_proba(X_te)[:,1]
    auc = roc_auc_score(y_te, y_prob)
    fpr, tpr, _ = roc_curve(y_te, y_prob)
    ax.plot(fpr, tpr, lw=2, color=colors[name], label=f"{name} (AUC={auc:.3f})")

ax.set(xlabel='Taxa de Falsos Positivos', ylabel='Taxa de Verdadeiros Positivos',
       title='Curvas ROC — Escores Totais das Escalas\n(BMQ Necessity, BMQ Concerns, SEAMS, HADS-A, HADS-D)')
ax.legend(loc='lower right', fontsize=10)
ax.grid(alpha=0.3)
fig.tight_layout()
fig.savefig('/home/user/Dados-Reumato-Claude/ml_scores_roc.png', dpi=150)
log('\nROC salvo em ml_scores_roc.png')

with open(OUT,'w') as f:
    f.write('\n'.join(lines))
log(f"Resultados salvos em {OUT}")
