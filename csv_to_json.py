"""
Converte dados_reumatologia.csv → backup_from_csv.json
Formato compatível com o aplicativo coleta_dados_reumatologia.html
"""
import csv, json, re
from datetime import datetime

CSV_IN  = '/home/user/Dados-Reumato-Claude/dados_reumatologia.csv'
JSON_OUT = '/home/user/Dados-Reumato-Claude/backup_from_csv.json'

def val(v):
    """Limpa valor: None/espaço vazio → string vazia"""
    if v is None:
        return ''
    v = str(v).strip()
    return '' if v in ('None', 'nan', '-') else v

def num(v):
    """Converte para número ou string vazia"""
    v = val(v)
    if v == '':
        return ''
    try:
        f = float(v)
        return int(f) if f == int(f) else f
    except:
        return v

def split_list(v):
    """Converte string separada por vírgulas/ponto-e-vírgula em lista"""
    v = val(v)
    if not v:
        return []
    return [x.strip() for x in re.split(r'[;,]', v) if x.strip()]

with open(CSV_IN, encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

print(f"Linhas lidas: {len(rows)}")
print(f"Colunas: {list(rows[0].keys())[:10]}...")

pacientes = []
erros = 0

for i, r in enumerate(rows, 1):
    try:
        # ── Identificação ────────────────────────────────────────────────────
        p = {
            'rghc':         val(r.get('RGHC')),
            'nome':         val(r.get('Nome Completo')),
            'nascimento':   val(r.get('Data de Nascimento')),
            'inicio_seg':   val(r.get('Início de Seguimento')),
            'entrevista':   val(r.get('Data da Entrevista')),
            'idade':        val(r.get('Idade (anos)')),
            'sexo':         val(r.get('Sexo')),
            'etnia':        val(r.get('Etnia')),
            'doenca':       val(r.get('Doença')),
            'tempo_diag':   val(r.get('Tempo de Diagnóstico')),
            'atividade':    val(r.get('Atividade de Doença')),
            'tempo_remissao': val(r.get('Tempo em Remissão')),

            # ── Laboratorial ─────────────────────────────────────────────────
            'vhs':    val(r.get('VHS (mm/h)')),
            'pcr':    val(r.get('PCR (mg/L)')),
            'cpk':    val(r.get('CPK (U/L)')),
            'das28':  val(r.get('DAS28')),
            'asdas':  val(r.get('ASDAS')),
            'dapsa':  val(r.get('DAPSA')),
            'sledai': val(r.get('SLEDAI')),
            'myoact': val(r.get('MYOACT')),
            'mmt8':   val(r.get('MMT8')),
            'bvas':   val(r.get('BVAS')),
            'itas':   val(r.get('ITAS')),

            # ── Tratamento ───────────────────────────────────────────────────
            'num_med':       val(r.get('Nº de Medicações')),
            'gcs':           val(r.get('Corticosteroide (dose equiv. prednisona)')),
            'csdmard':       split_list(r.get('csDMARD em Uso')),
            'bdmard':        split_list(r.get('bDMARD em Uso')),
            'tsdmard':       split_list(r.get('tsDMARD em Uso')),
            'tempo_dmard':   val(r.get('Tempo desde Última Mudança do Tratamento')),
            'csdmard_prev':  split_list(r.get('csDMARD Prévios')),
            'bdmard_prev':   split_list(r.get('bDMARD Prévios')),
            'tsdmard_prev':  split_list(r.get('tsDMARD Prévios')),
            'comorbidades':  split_list(r.get('Comorbidades')),
            'med_continuas': split_list(r.get('Medicações Contínuas')),
            'reacao':        val(r.get('Histórico de Reação Adversa a DMARD')),
            'reacao_quais':  split_list(r.get('Reação Adversa – Quais Medicações')),
            'intervalo':     val(r.get('Intervalo Médio entre Consultas')),
            'dmard_posologia': {},
            'hospitalizacoes': val(r.get('Hospitalizações no Último Ano (nº)')),

            # ── Socioeconômico ───────────────────────────────────────────────
            'religiao':          val(r.get('Religião')),
            'estado_civil':      val(r.get('Estado Civil')),
            'filhos':            val(r.get('Filhos')),
            'escolaridade':      val(r.get('Escolaridade')),
            'renda':             val(r.get('Renda Familiar Mensal')),
            'ocupacao':          val(r.get('Ocupação')),
            'carga_horaria':     val(r.get('Carga Horária Semanal')),
            'local_residencia':  val(r.get('Localização da Residência')),
            'num_pessoas':       val(r.get('Pessoas na Residência')),
            'situacao_moradia':  val(r.get('Situação de Moradia')),
            'tabagismo':         val(r.get('Tabagismo')),
            'etilismo':          val(r.get('Etilismo')),
            'material_educ':     val(r.get('Recebe Material Educativo')),
            'acompanhamento':    val(r.get('Acompanhamento Multidisciplinar')),

            # ── Barreiras ────────────────────────────────────────────────────
            'dif_doenca':        val(r.get('Dificuldade de Entender Doença')),
            'conhec_complic':    val(r.get('Conhece Complicações da Doença')),
            'dif_trat':          val(r.get('Dificuldade de Entender Tratamento')),
            'facilidade_consulta': val(r.get('Facilidade para Marcar Consultas')),
            'falta_farm':        val(r.get('Falta de Medicação na Farmácia')),
            'compra_med':        val(r.get('Consegue Comprar Medicação em Falta')),
            'custo_med':         val(r.get('Custo da Medicação é Problema')),
            'deslocamento':      val(r.get('Deslocamento é Problema')),

            # ── EVA ──────────────────────────────────────────────────────────
            'comunic':      val(r.get('EVA – Clareza de Comunicação Médica (0–100)')),
            'confianca':    val(r.get('EVA – Confiança na Equipe Médica (0–100)')),
            'participacao': val(r.get('EVA – Participação nas Decisões (0–100)')),
            'satisfacao':   val(r.get('EVA – Satisfação com Tratamento (0–100)')),
            'suporte':      val(r.get('EVA – Suporte Social (0–100)')),
            'eva_dor':      val(r.get('EVA Dor (0–100)')),
            'eva_estresse': val(r.get('EVA Estresse (0–100)')),
            'eva_ptga':     val(r.get('EVA PtGA – Avaliação Global do Paciente (0–100)')),
        }

        # ── BMQ ──────────────────────────────────────────────────────────────
        bmq_keys = [
            ('bmqn-1','BMQ-N1: Saúde depende dos medicamentos'),
            ('bmqn-2','BMQ-N2: Vida impossível sem os medicamentos'),
            ('bmqn-3','BMQ-N3: Sem medicamentos estaria muito doente'),
            ('bmqn-4','BMQ-N4: Saúde futura depende dos medicamentos'),
            ('bmqn-5','BMQ-N5: Medicamentos protegem de ficar pior'),
            ('bmqc-1','BMQ-C1: Preocupa ter de tomar os medicamentos'),
            ('bmqc-2','BMQ-C2: Preocupa efeitos a longo prazo'),
            ('bmqc-3','BMQ-C3: Medicamentos são um mistério'),
            ('bmqc-4','BMQ-C4: Medicamentos perturbam a vida'),
            ('bmqc-5','BMQ-C5: Preocupa dependência dos medicamentos'),
            ('bmqc-6','BMQ-C6: Medicamentos causam efeitos desagradáveis'),
        ]
        bmq_resp = {}
        for key, col in bmq_keys:
            v = num(r.get(col))
            if v != '':
                bmq_resp[key] = v
        p['bmq_respostas'] = bmq_resp
        p['bmq_necessity'] = num(r.get('BMQ Necessity Total (5–25)'))
        p['bmq_concerns']  = num(r.get('BMQ Concerns Total (6–30)'))
        p['bmq_diff']      = num(r.get('BMQ Diferença Necessity−Concerns'))

        # ── SEAMS ─────────────────────────────────────────────────────────────
        seams_keys = [
            ('1', 'SEAMS-1: Vários medicamentos por dia'),
            ('2', 'SEAMS-2: Mais de uma vez ao dia'),
            ('3', 'SEAMS-3: Fora de casa'),
            ('4', 'SEAMS-4: Dia agitado'),
            ('5', 'SEAMS-5: Efeitos colaterais'),
            ('6', 'SEAMS-6: Ninguém lembra de tomar'),
            ('7', 'SEAMS-7: Horários inconvenientes'),
            ('8', 'SEAMS-8: Rotina bagunçada'),
            ('9', 'SEAMS-9: Incerto de como tomar'),
            ('10','SEAMS-10: Incerto do horário'),
            ('11','SEAMS-11: Sentindo-se doente'),
            ('12','SEAMS-12: Medicamento parece diferente'),
            ('13','SEAMS-13: Médico troca medicamentos'),
        ]
        seams_resp = {}
        for key, col in seams_keys:
            v = num(r.get(col))
            if v != '':
                seams_resp[key] = v
        p['seams_respostas'] = seams_resp
        p['seams_score'] = num(r.get('SEAMS Total (13–39)'))

        # ── HADS ─────────────────────────────────────────────────────────────
        hads_keys = [
            ('1A','HADS-A1: Tenso ou contraído'),
            ('2A','HADS-A2: Medo de coisa ruim acontecer'),
            ('3A','HADS-A3: Cabeça cheia de preocupações'),
            ('4A','HADS-A4: Sentado à vontade / relaxado (inv.)'),
            ('5A','HADS-A5: Sensação ruim de medo'),
            ('6A','HADS-A6: Inquieto / não pode ficar parado'),
            ('7A','HADS-A7: Sensação de entrar em pânico'),
            ('1D','HADS-D1: Gosta das mesmas coisas de antes (inv.)'),
            ('2D','HADS-D2: Dá risada quando vê coisas engraçadas (inv.)'),
            ('3D','HADS-D3: Sente-se alegre (inv.)'),
            ('4D','HADS-D4: Lento para pensar / fazer coisas'),
            ('5D','HADS-D5: Perdeu interesse na aparência'),
            ('6D','HADS-D6: Espera animado coisas boas (inv.)'),
            ('7D','HADS-D7: Sente prazer em TV / rádio / leitura (inv.)'),
        ]
        hads_resp = {}
        for key, col in hads_keys:
            v = num(r.get(col))
            if v != '':
                hads_resp[key] = v
        p['hads_respostas'] = hads_resp
        p['hads_anx'] = num(r.get('HADS Ansiedade Total (0–21)'))
        p['hads_dep'] = num(r.get('HADS Depressão Total (0–21)'))

        # ── HAQ ──────────────────────────────────────────────────────────────
        haq_keys = [
            ('1', 'HAQ-1: Vestir-se / amarrar sapatos / abotoar'),
            ('2', 'HAQ-2: Lavar a cabeça e os cabelos'),
            ('3', 'HAQ-3: Levantar-se de cadeira sem braços'),
            ('4', 'HAQ-4: Deitar e levantar da cama'),
            ('5', 'HAQ-5: Cortar um pedaço de carne'),
            ('6', 'HAQ-6: Levar copo/xícara à boca'),
            ('7', 'HAQ-7: Abrir saco de leite'),
            ('8', 'HAQ-8: Caminhar em lugares planos'),
            ('9', 'HAQ-9: Subir cinco degraus'),
            ('10','HAQ-10: Lavar e secar o corpo após banho'),
            ('11','HAQ-11: Tomar banho de chuveiro'),
            ('12','HAQ-12: Sentar e levantar do vaso sanitário'),
            ('13','HAQ-13: Pegar objeto acima da cabeça'),
            ('14','HAQ-14: Curvar-se para pegar roupas no chão'),
            ('15','HAQ-15: Segurar-se em pé no ônibus/metrô'),
            ('16','HAQ-16: Abrir potes previamente abertos'),
            ('17','HAQ-17: Abrir e fechar torneiras'),
            ('18','HAQ-18: Fazer compras na redondeza'),
            ('19','HAQ-19: Entrar e sair de ônibus'),
            ('20','HAQ-20: Varrer / puxar água com rodo'),
        ]
        haq_resp = {}
        for key, col in haq_keys:
            v = num(r.get(col))
            if v != '':
                haq_resp[key] = v
        p['haq_respostas'] = haq_resp
        p['haq_score'] = num(r.get('HAQ-DI (0–3)'))

        # ── CQR ──────────────────────────────────────────────────────────────
        cqr_keys = [
            ('1', 'CQR-1: Médico diz para tomar, eu tomo'),
            ('2', 'CQR-2: Tomo para ter menos problemas'),
            ('3', 'CQR-3: Não me atrevo a esquecer'),
            ('4', 'CQR-4 (NEG): Prefiro terapias alternativas'),
            ('5', 'CQR-5: Ficam no mesmo local / não esqueço'),
            ('6', 'CQR-6: Confio no reumatologista'),
            ('7', 'CQR-7: Ainda posso fazer o que quero'),
            ('8', 'CQR-8 (NEG): Não gosto de tomar medicamentos'),
            ('9', 'CQR-9 (NEG): Nas férias esqueço de tomar'),
            ('10','CQR-10: Se não tomarmos, para que consultar?'),
            ('11','CQR-11 (NEG): Não espero milagres'),
            ('12','CQR-12 (NEG): Se não aguentar pode jogar fora'),
            ('13','CQR-13: Sem os medicamentos a inflamação volta'),
            ('14','CQR-14: Meu corpo me avisa se não tomar'),
            ('15','CQR-15: Saúde acima de tudo / tomo para ficar bem'),
            ('16','CQR-16: Uso organizador de comprimidos'),
            ('17','CQR-17: O que o médico diz, presto atenção'),
            ('18','CQR-18: Sem os medicamentos tenho mais queixas'),
            ('19','CQR-19 (NEG): No fim de semana às vezes não tomo'),
        ]
        cqr_resp = {}
        for key, col in cqr_keys:
            v = num(r.get(col))
            if v != '':
                cqr_resp[key] = v
        p['cqr_respostas']      = cqr_resp
        p['cqr_score']          = num(r.get('CQR-19 Score Discriminante (Taking Compliance ≤ 80%)'))
        p['cqr_score_continuo'] = num(r.get('CQR-19 Score Contínuo (0–100)'))
        p['cqr_aderente']       = val(r.get('CQR-19 Classificação de Adesão (Aderente / Não aderente)'))

        p['ts'] = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.000Z')
        p['_importado'] = True

        pacientes.append(p)

    except Exception as e:
        erros += 1
        print(f"Erro na linha {i}: {e}")

print(f"\nPacientes convertidos: {len(pacientes)}")
print(f"Erros: {erros}")

# Verify a complete patient
complete = [p for p in pacientes if p['cqr_respostas'] and p['hads_respostas']]
print(f"Com CQR + HADS preenchidos: {len(complete)}")
with_name = [p for p in pacientes if p['nome']]
print(f"Com nome: {len(with_name)}")

with open(JSON_OUT, 'w', encoding='utf-8') as f:
    json.dump(pacientes, f, ensure_ascii=False, indent=2)

print(f"\nArquivo gerado: {JSON_OUT}")
print(f"Tamanho: {len(open(JSON_OUT).read()) / 1024 / 1024:.1f} MB")
