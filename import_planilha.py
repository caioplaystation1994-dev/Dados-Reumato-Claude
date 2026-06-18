"""
Import 9 new patients from planilha_claude_17_06.xlsx into backup JSON.
Uses positional index mapping (headers are shifted in this spreadsheet).
"""
import json
import numpy as np
import pandas as pd

XLSX = '/root/.claude/uploads/e8adc5a8-da29-5395-b412-4b73c749cad3/e36855e4-planilha_claude_17_06.xlsx'
BACKUP = '/home/user/Dados-Reumato-Claude/backup_reumatologia_20260617.json'
OUT = '/home/user/Dados-Reumato-Claude/backup_reumatologia_20260617.json'

df = pd.read_excel(XLSX, sheet_name='Página1', header=0)
print(f"Shape: {df.shape}")

with open(BACKUP) as f:
    existing = json.load(f)

existing_rghc = {p.get('rghc','').strip().upper() for p in existing}
print(f"Existing patients: {len(existing)}")

# ── Text → number maps ────────────────────────────────────────────────────────
CQR_MAP = {
    'Concordo muito': 4, 'Concordo': 3,
    'Não concordo': 2, 'Nao concordo': 2,
    'Não concordo de forma alguma': 1, 'Nao concordo de forma alguma': 1,
}
HAQ_MAP = {
    'Sem qualquer dificuldade': 0, 'Com alguma dificuldade': 1,
    'Com muita dificuldade': 2, 'Incapaz de realizar': 3,
}
SEAMS_MAP = {
    'Muito confiante': 3, 'Pouco confiante': 2, 'Não estou confiante': 1,
    'Nao estou confiante': 1,
}
BMQ_MAP = {
    'Concordo totalmente': 5, 'Concordo': 4,
    'Nem concordo nem discordo': 3, 'Discordo': 2, 'Discordo totalmente': 1,
}

# HADS per-item maps (index → (item_key, {text: score}))
HADS_ITEMS = {
    75: ('6A', {'A maior parte do tempo': 3, 'Boa parte do tempo': 2, 'De vez em quando': 1, 'Nunca': 0}),
    76: ('1D', {'Já não sinto mais prazer em nada': 3, 'Só um pouco': 2, 'So um pouco': 2,
                'Não tanto quanto antes': 1, 'Nao tanto quanto antes': 1,
                'Sim, do mesmo jeito que antes': 0}),
    77: ('2A', {'Sim, e de um jeito muito forte': 3, 'Sim, mas não tão forte': 2,
                'Sim, mas não tao forte': 2, 'Sim, mas nao tão forte': 2, 'Sim, mas nao tao forte': 2,
                'Não sinto nada disso': 0, 'Nao sinto nada disso': 0}),
    78: ('2D', {'Atualmente bem menos': 3, 'Atualmente um pouco menos': 2,
                'Do mesmo jeito que antes': 0}),
    79: ('7A', {'A maior parte do tempo': 3, 'Boa parte do tempo': 2, 'Raramente': 0}),
    80: ('3A', {'A maior parte do tempo': 3, 'Muitas vezes': 2, 'Poucas vezes': 1}),
    81: ('3D', {'Nunca': 3, 'Poucas vezes': 2, 'Sim, quase sempre': 0}),
    82: ('4A', {'Nunca': 3, 'De vez em quando': 2, 'Quase sempre': 0}),
    83: ('7D', {'Nunca': 3, 'De vez em quando': 2, 'Muitas vezes': 1, 'Quase sempre': 0}),
    84: ('5D', {'Completamente': 3,
                'Não estou mais me cuidando como deveria': 2, 'Nao estou mais me cuidando como deveria': 2,
                'Talvez não tanto quanto antes': 1, 'Talvez nao tanto quanto antes': 1,
                'Me cuido do mesmo jeito que antes': 0}),
    85: ('4D', {'Sim, demais': 3, 'Bastante': 2, 'Um pouco': 1}),
    86: ('6D', {'Bem menos do que antes': 2, 'Um pouco menos do que antes': 1,
                'Do mesmo jeito que antes': 0}),
    87: ('1A', {'A quase todo momento': 3, 'Várias vezes': 2, 'Varias vezes': 2,
                'De vez em quando': 1, 'Não sinto isso': 0, 'Nao sinto isso': 0}),
    88: ('5A', {'Quase sempre': 3, 'Várias vezes': 2, 'Varias vezes': 2, 'Poucas vezes': 1}),
}

BMQ_KEYS = ['bmqn-1','bmqn-2','bmqn-3','bmqn-4','bmqn-5',
            'bmqc-1','bmqc-2','bmqc-3','bmqc-4','bmqc-5','bmqc-6']

def safe_map(val, mapping, label=''):
    if pd.isna(val) or val == '':
        return None
    s = str(val).strip()
    if s in mapping:
        return mapping[s]
    # Try case-insensitive
    sl = s.lower()
    for k, v in mapping.items():
        if k.lower() == sl:
            return v
    print(f"  WARN unmapped [{label}]: '{s}'")
    return None

def cqr_classify(respostas):
    """van den Bemt 2010 discriminant function"""
    WEIGHTS = {
        '1': -0.03419, '2': 0.02470, '3': 0.10789, '4': -0.04392,
        '5': -0.23002, '6': -0.08784, '7': 0.25613, '8': 0.12271,
        '9': 0.07507, '10': 0.24703, '11': -0.13850, '12': 0.05471,
        '13': 0.01619, '14': 0.05013, '15': -0.02994, '16': -0.03117,
        '17': 0.00765, '18': -0.04840, '19': -0.04838,
    }
    CONSTANT = -6.434
    score = CONSTANT
    for k, w in WEIGHTS.items():
        v = respostas.get(k)
        if v is None:
            return None, None
        score += w * v
    return score, 'Aderente' if score >= -0.5849 else 'Não aderente'

new_patients = []
skipped = 0

for row_idx, row in df.iterrows():
    vals = row.values

    nome = str(vals[1]).strip() if not pd.isna(vals[1]) else ''
    rghc = str(vals[2]).strip() if not pd.isna(vals[2]) else ''
    if not nome or nome == 'nan':
        continue
    if rghc.upper() in existing_rghc:
        print(f"  SKIP (already exists): {nome} ({rghc})")
        skipped += 1
        continue

    p = {
        'nome': nome,
        'rghc': rghc,
        'doenca': str(vals[3]).strip() if not pd.isna(vals[3]) else '',
        'religiao': str(vals[4]).strip() if not pd.isna(vals[4]) else '',
        'estado_civil': str(vals[5]).strip() if not pd.isna(vals[5]) else '',
        'filhos': str(vals[6]).strip() if not pd.isna(vals[6]) else '',
        'escolaridade': str(vals[7]).strip() if not pd.isna(vals[7]) else '',
        'renda': str(vals[8]).strip() if not pd.isna(vals[8]) else '',
        'ocupacao': str(vals[9]).strip() if not pd.isna(vals[9]) else '',
        'carga_horaria': str(vals[10]).strip() if not pd.isna(vals[10]) else '',
        'local_residencia': str(vals[11]).strip() if not pd.isna(vals[11]) else '',
        'num_pessoas': str(vals[12]).strip() if not pd.isna(vals[12]) else '',
        'situacao_moradia': str(vals[13]).strip() if not pd.isna(vals[13]) else '',
        'tabagismo': str(vals[14]).strip() if not pd.isna(vals[14]) else '',
        'etilismo': str(vals[15]).strip() if not pd.isna(vals[15]) else '',
    }

    # Barriers (indices 17-26)
    barrier_keys = ['material_educ','acompanhamento','dif_doenca','conhec_complic',
                    'dif_trat','facilidade_consulta','falta_farm','compra_med',
                    'custo_med','deslocamento']
    for i, k in enumerate(barrier_keys):
        p[k] = str(vals[17+i]).strip() if not pd.isna(vals[17+i]) else ''

    # EVA fields (indices 27-35, skipping index 33 = fadiga)
    eva_keys = ['eva_comunic','eva_confianca','eva_participacao','eva_suporte',
                'eva_dor','eva_estresse', None, 'eva_ptga','eva_satisfacao']
    for i, k in enumerate(eva_keys):
        if k:
            raw = vals[27+i]
            p[k] = str(int(float(raw))) if not pd.isna(raw) and raw != '' else ''

    # CQR items 1-19 (indices 36-54)
    cqr_r = {}
    for i in range(19):
        v = safe_map(vals[36+i], CQR_MAP, f'CQR-{i+1}')
        cqr_r[str(i+1)] = v
    p['cqr_respostas'] = cqr_r
    cqr_score, cqr_label = cqr_classify(cqr_r)
    p['cqr_score'] = round(cqr_score, 4) if cqr_score is not None else None
    p['cqr_aderente'] = cqr_label

    # HAQ items 1-20 (indices 55-74)
    haq_r = {}
    for i in range(20):
        v = safe_map(vals[55+i], HAQ_MAP, f'HAQ-{i+1}')
        haq_r[str(i+1)] = v
    p['haq_respostas'] = haq_r
    haq_vals = [v for v in haq_r.values() if v is not None]
    p['haq_score'] = round(sum(haq_vals)/20, 4) if haq_vals else None

    # HADS items (indices 75-88)
    hads_r = {}
    hads_anx_items = ['1A','2A','3A','4A','5A','6A','7A']
    hads_dep_items = ['1D','2D','3D','4D','5D','6D','7D']
    for idx, (item_key, item_map) in HADS_ITEMS.items():
        v = safe_map(vals[idx], item_map, f'HADS-{item_key}')
        hads_r[item_key] = v
    p['hads_respostas'] = hads_r
    anx_vals = [hads_r.get(k) for k in hads_anx_items if hads_r.get(k) is not None]
    dep_vals = [hads_r.get(k) for k in hads_dep_items if hads_r.get(k) is not None]
    p['hads_anx'] = sum(anx_vals) if len(anx_vals) == 7 else None
    p['hads_dep'] = sum(dep_vals) if len(dep_vals) == 7 else None

    # SEAMS items 1-13 (indices 89-101)
    seams_r = {}
    for i in range(13):
        v = safe_map(vals[89+i], SEAMS_MAP, f'SEAMS-{i+1}')
        seams_r[str(i+1)] = v
    p['seams_respostas'] = seams_r
    seams_vals = [v for v in seams_r.values() if v is not None]
    p['seams_score'] = sum(seams_vals) if len(seams_vals) == 13 else None

    # BMQ items (indices 102-112)
    bmq_r = {}
    for i, k in enumerate(BMQ_KEYS):
        v = safe_map(vals[102+i], BMQ_MAP, f'BMQ-{k}')
        bmq_r[k] = v
    p['bmq_respostas'] = bmq_r
    n_vals = [bmq_r.get(k) for k in ['bmqn-1','bmqn-2','bmqn-3','bmqn-4','bmqn-5'] if bmq_r.get(k) is not None]
    c_vals = [bmq_r.get(k) for k in ['bmqc-1','bmqc-2','bmqc-3','bmqc-4','bmqc-5','bmqc-6'] if bmq_r.get(k) is not None]
    p['bmq_necessity'] = round(sum(n_vals)/len(n_vals), 4) if n_vals else None
    p['bmq_concerns'] = round(sum(c_vals)/len(c_vals), 4) if c_vals else None
    p['bmq_diff'] = round(p['bmq_necessity'] - p['bmq_concerns'], 4) if p['bmq_necessity'] and p['bmq_concerns'] else None

    new_patients.append(p)
    print(f"  OK: {nome} ({rghc}) → {cqr_label}")

print(f"\nNew patients to add: {len(new_patients)}, skipped: {skipped}")

merged = existing + new_patients
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(merged, f, ensure_ascii=False, indent=2)
print(f"Saved {len(merged)} patients to {OUT}")
