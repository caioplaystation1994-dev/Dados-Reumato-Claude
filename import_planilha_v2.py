"""
Import 9 new patients from planilha_claude_17_06.xlsx — versão corrigida.
Mapeamento confirmado por análise de cabeçalhos + valores + verificação com pacientes existentes.

CQR  : 36-54  (19 itens — cabeçalhos EVA para 36-44 mas dados CQR foram digitados lá)
HAQ  : 64-83  (20 itens)
HADS : 84-88  (5 itens parciais: 5D,4D,6D,1A,5A). Inez exception: 75-88 (14 itens)
SEAMS: 89-101 (13 itens)
BMQ  : 102-112 (11 itens: bmqn-1..5, bmqc-1..6)

CQR classificação usa coeficientes reais do app (coleta_dados_reumatologia.html linha 877)
"""
import json
import numpy as np
import pandas as pd

XLSX = '/root/.claude/uploads/e8adc5a8-da29-5395-b412-4b73c749cad3/e36855e4-planilha_claude_17_06.xlsx'
BACKUP = '/root/.claude/uploads/e8adc5a8-da29-5395-b412-4b73c749cad3/63b42ab0-backup_reumatologia_20260618_1.json'
OUT = '/home/user/Dados-Reumato-Claude/backup_reumatologia_20260618_atualizado.json'

df = pd.read_excel(XLSX, sheet_name='Página1', header=0)
print(f'Planilha: {df.shape[0]} pacientes, {df.shape[1]} colunas')

with open(BACKUP) as f:
    existing = json.load(f)
existing_rghc = {p.get('rghc','').strip().upper() for p in existing}
print(f'Backup base: {len(existing)} pacientes')

# ── Coeficientes discriminantes REAIS do app ─────────────────────────────────
CQR_CONSTANT = -3.4777269054494035
CQR_COEFS = [
    -0.44477276433284296,   # item 1
    -0.9517389645231992,    # item 2
     1.675784309611586,     # item 3
    -0.21007515279754496,   # item 4
     0.024391234120956798,  # item 5
    -0.5353316565428011,    # item 6
     0.0029544189406322916, # item 7
     0.01351792034638963,   # item 8
    -0.010590545774048919,  # item 9
    -0.25455764022117855,   # item 10
     0.10226435257826295,   # item 11
     0.11545009043160576,   # item 12
     0.024759537503381134,  # item 13
     0.10908547284802167,   # item 14
     0.4474790434938089,    # item 15
     0.22838272884627178,   # item 16
     0.5350275091774594,    # item 17
    -0.4190977732412856,    # item 18
     0.6828717614297019,    # item 19
]
CQR_CUT = -0.5848941176

# ── Mapas de texto ─────────────────────────────────────────────────────────────
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
    'Muito confiante': 3, 'Pouco confiante': 2,
    'Não estou confiante': 1, 'Nao estou confiante': 1,
}
BMQ_MAP = {
    'Concordo totalmente': 5, 'Concordo': 4,
    'Nem concordo nem discordo': 3, 'Discordo': 2, 'Discordo totalmente': 1,
}

# HADS — mapeamento por índice de coluna (respostas específicas por item)
HADS_ITEMS = {
    # Para pacientes sem HAQ (ex: Inez): itens 75-83 também são HADS
    75: ('6A', {'A maior parte do tempo':3,'Boa parte do tempo':2,'De vez em quando':1,'Nunca':0}),
    76: ('1D', {'Já não sinto mais prazer em nada':3,'Só um pouco':2,'So um pouco':2,
                'Não tanto quanto antes':1,'Nao tanto quanto antes':1,'Sim, do mesmo jeito que antes':0}),
    77: ('2A', {'Sim, e de um jeito muito forte':3,'Sim, mas não tão forte':2,
                'Sim, mas nao tao forte':2,'Não sinto nada disso':0,'Nao sinto nada disso':0}),
    78: ('2D', {'Atualmente bem menos':3,'Atualmente um pouco menos':2,'Do mesmo jeito que antes':0}),
    79: ('7A', {'A maior parte do tempo':3,'Boa parte do tempo':2,'Raramente':0}),
    80: ('3A', {'A maior parte do tempo':3,'Muitas vezes':2,'Poucas vezes':1}),
    81: ('3D', {'Nunca':3,'Poucas vezes':2,'Sim, quase sempre':0}),
    82: ('4A', {'Nunca':3,'De vez em quando':2,'Quase sempre':0}),
    83: ('7D', {'Nunca':3,'De vez em quando':2,'Muitas vezes':1,'Quase sempre':0}),
    # Itens 84-88: presentes para TODOS os pacientes
    84: ('5D', {'Completamente':3,'Não estou mais me cuidando como deveria':2,
                'Nao estou mais me cuidando como deveria':2,
                'Talvez não tanto quanto antes':1,'Talvez nao tanto quanto antes':1,
                'Me cuido do mesmo jeito que antes':0}),
    85: ('4D', {'Sim, demais':3,'Bastante':2,'Um pouco':1}),
    86: ('6D', {'Bem menos do que antes':2,'Um pouco menos do que antes':1,'Do mesmo jeito que antes':0}),
    87: ('1A', {'A quase todo momento':3,'Várias vezes':2,'Varias vezes':2,
                'De vez em quando':1,'Não sinto isso':0,'Nao sinto isso':0}),
    88: ('5A', {'Quase sempre':3,'Várias vezes':2,'Varias vezes':2,'Poucas vezes':1}),
}
HADS_ANX_ITEMS = ['1A','2A','3A','4A','5A','6A','7A']
HADS_DEP_ITEMS = ['1D','2D','3D','4D','5D','6D','7D']

BMQ_KEYS = ['bmqn-1','bmqn-2','bmqn-3','bmqn-4','bmqn-5',
            'bmqc-1','bmqc-2','bmqc-3','bmqc-4','bmqc-5','bmqc-6']

def safe_map(val, mapping, label=''):
    if pd.isna(val) or str(val).strip() in ('', 'nan'):
        return None
    s = str(val).strip()
    if s in mapping:
        return mapping[s]
    sl = s.lower()
    for k, v in mapping.items():
        if k.lower() == sl:
            return v
    print(f'  WARN [{label}]: "{s}"')
    return None

new_patients = []
skipped = 0

for row_idx, row in df.iterrows():
    vals = row.values

    nome = str(vals[1]).strip() if not pd.isna(vals[1]) else ''
    rghc = str(vals[2]).strip() if not pd.isna(vals[2]) else ''
    if not nome or nome == 'nan':
        continue
    if rghc.upper() in existing_rghc:
        print(f'  SKIP: {nome} ({rghc})')
        skipped += 1
        continue

    p = {
        'nome': nome, 'rghc': rghc,
        'doenca':         str(vals[3]).strip() if not pd.isna(vals[3]) else '',
        'religiao':       str(vals[4]).strip() if not pd.isna(vals[4]) else '',
        'estado_civil':   str(vals[5]).strip() if not pd.isna(vals[5]) else '',
        'filhos':         str(vals[6]).strip() if not pd.isna(vals[6]) else '',
        'escolaridade':   str(vals[7]).strip() if not pd.isna(vals[7]) else '',
        'sabe_ler':       str(vals[8]).strip() if not pd.isna(vals[8]) else '',
        'renda':          str(vals[9]).strip() if not pd.isna(vals[9]) else '',
        'ocupacao':       str(vals[10]).strip() if not pd.isna(vals[10]) else '',
        'carga_horaria':  str(vals[11]).strip() if not pd.isna(vals[11]) else '',
        'locomocao':      str(vals[12]).strip() if not pd.isna(vals[12]) else '',
        'local_residencia': str(vals[13]).strip() if not pd.isna(vals[13]) else '',
        'num_pessoas':    str(vals[14]).strip() if not pd.isna(vals[14]) else '',
        'situacao_moradia': str(vals[15]).strip() if not pd.isna(vals[15]) else '',
        'tabagismo':      str(vals[16]).strip() if not pd.isna(vals[16]) else '',
        'etilismo':       str(vals[17]).strip() if not pd.isna(vals[17]) else '',
    }

    # Barreiras (18-34)
    barrier_keys = [
        ('alergias',18), ('doenca_paciente',19), ('num_remedios',20),
        ('comorbidades',21), ('material_educ',22), ('acompanhamento',23),
        ('dif_doenca',24), ('conhec_complic',25), ('dif_trat',26),
        ('freq_posologia',27), ('sabe_doses',28), ('recurso_auxiliar',29),
        ('parou_efeitos',30), ('facilidade_consulta',31), ('falta_farm',32),
        ('compra_med',33), ('custo_med',34), ('esquece_med',35),
    ]
    for k, idx in barrier_keys:
        p[k] = str(vals[idx]).strip() if not pd.isna(vals[idx]) else ''

    # EVA (36-44) — ATENÇÃO: para estes pacientes, foram digitados dados CQR aqui
    # Os dados EVA ficaram sem preenchimento
    for k in ['eva_comunic','eva_confianca','eva_participacao','eva_suporte',
              'eva_dor','eva_estresse','eva_fadiga','eva_ptga','consideracao']:
        p[k] = ''

    # CQR — 36-54 (19 itens confirmado)
    cqr_r = {}
    for j in range(19):
        v = safe_map(vals[36+j], CQR_MAP, f'CQR-{j+1}')
        cqr_r[str(j+1)] = v

    complete = all(v is not None for v in cqr_r.values())
    if complete:
        score = CQR_CONSTANT + sum(CQR_COEFS[i]*cqr_r[str(i+1)] for i in range(19))
        label = 'Aderente' if score >= CQR_CUT else 'Não aderente'
        p['cqr_score'] = round(score, 4)
        p['cqr_aderente'] = label
    else:
        missing = [k for k,v in cqr_r.items() if v is None]
        print(f'  WARN CQR itens faltando {missing} em {nome}')
        p['cqr_score'] = None
        p['cqr_aderente'] = ''
    p['cqr_respostas'] = cqr_r

    # HAQ — 64-74 (apenas 11 itens capturados nesta versão do formulário)
    haq_r = {}
    for j in range(11):
        v = safe_map(vals[64+j], HAQ_MAP, f'HAQ-{j+1}')
        haq_r[str(j+1)] = v
    p['haq_respostas'] = haq_r
    haq_vals = [v for v in haq_r.values() if v is not None]
    p['haq_score'] = None  # HAQ incompleto, não computa DI

    # HADS — 75-88 para TODOS os pacientes (14 itens)
    hads_r = {}
    hads_indices = range(75, 89)

    for idx in hads_indices:
        if idx in HADS_ITEMS:
            item_key, item_map = HADS_ITEMS[idx]
            v = safe_map(vals[idx], item_map, f'HADS-{item_key}')
            hads_r[item_key] = v

    p['hads_respostas'] = hads_r
    anx_vals = [hads_r.get(k) for k in HADS_ANX_ITEMS if hads_r.get(k) is not None]
    dep_vals = [hads_r.get(k) for k in HADS_DEP_ITEMS if hads_r.get(k) is not None]
    p['hads_anx'] = sum(anx_vals) if len(anx_vals) == 7 else None
    p['hads_dep'] = sum(dep_vals) if len(dep_vals) == 7 else None

    # SEAMS — 89-101 (13 itens)
    seams_r = {}
    for j in range(13):
        v = safe_map(vals[89+j], SEAMS_MAP, f'SEAMS-{j+1}')
        seams_r[str(j+1)] = v
    p['seams_respostas'] = seams_r
    seams_vals = [v for v in seams_r.values() if v is not None]
    p['seams_score'] = sum(seams_vals) if len(seams_vals) == 13 else None

    # BMQ — 102-112 (11 itens)
    bmq_r = {}
    for j, k in enumerate(BMQ_KEYS):
        v = safe_map(vals[102+j], BMQ_MAP, f'BMQ-{k}')
        bmq_r[k] = v
    p['bmq_respostas'] = bmq_r
    n_vals = [bmq_r[k] for k in ['bmqn-1','bmqn-2','bmqn-3','bmqn-4','bmqn-5'] if bmq_r.get(k) is not None]
    c_vals = [bmq_r[k] for k in ['bmqc-1','bmqc-2','bmqc-3','bmqc-4','bmqc-5','bmqc-6'] if bmq_r.get(k) is not None]
    p['bmq_necessity'] = round(sum(n_vals)/len(n_vals), 4) if n_vals else None
    p['bmq_concerns']  = round(sum(c_vals)/len(c_vals), 4) if c_vals else None
    p['bmq_diff'] = round(p['bmq_necessity'] - p['bmq_concerns'], 4) \
                    if p['bmq_necessity'] and p['bmq_concerns'] else None

    new_patients.append(p)
    haq_str = f'HAQ={p["haq_score"]}' if p['haq_score'] is not None else 'HAQ=sem dado'
    hads_str = f'anx={p["hads_anx"]},dep={p["hads_dep"]}' if p['hads_anx'] is not None else 'HADS parcial'
    print(f'  OK: {nome[:30]} → {p["cqr_aderente"]} (score={p["cqr_score"]}) | {haq_str} | {hads_str}')

print(f'\nNovos pacientes: {len(new_patients)}, ignorados: {skipped}')

merged = existing + new_patients
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(merged, f, ensure_ascii=False, indent=2)
print(f'Salvo: {len(merged)} pacientes em {OUT}')
