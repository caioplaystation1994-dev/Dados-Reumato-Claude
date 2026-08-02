#!/usr/bin/env python3
"""Extrai tabelas estruturadas de um PDF usando pdfplumber e imprime JSON no stdout.

Uso: python3 extract_tables.py <caminho-do-pdf>

Saida: lista de {"page": N, "rows": [[celula, ...], ...]}. Filtra tabelas
minusculas/degeneradas (provavelmente artefatos de deteccao, nao tabelas
reais) exigindo pelo menos 2 linhas, 2 colunas e uma fracao minima de
celulas preenchidas.
"""
import sys
import json
import re


def is_real_table(rows):
    if len(rows) < 2:
        return False
    if max(len(r) for r in rows) < 2:
        return False
    total = sum(len(r) for r in rows)
    filled_cells = [c for r in rows for c in r if c and c.strip()]
    if total == 0 or (len(filled_cells) / total) < 0.4:
        return False
    # Cabecalho/rodape de pagina repetido (ex.: "www.nature.com/scientificreports"
    # aparecendo em varias celulas) e mal-detectado como tabela pelo pdfplumber —
    # o sinal e poucos valores DISTINTOS entre as celulas preenchidas, ou
    # qualquer celula parecendo URL/nome de dominio.
    distinct = set(filled_cells)
    if len(distinct) <= 1:
        return False
    if any(('www.' in c.lower() or 'http' in c.lower()) for c in filled_cells):
        return False
    return True


# Algumas fontes/PDFs confundem o pdfplumber e ele extrai o texto da celula
# com a ordem dos caracteres inteiramente invertida (ex.: "elbaT" em vez de
# "Table"), embora o pdftotext extraia o mesmo PDF corretamente — e um bug
# de ordenacao de glifos especifico dessas fontes, nao um problema geral.
# Deteccao: contar palavras de dicionario (PT/EN) no texto normal vs. no
# texto com cada celula revertida; se a versao revertida bate muito mais,
# a tabela provavelmente esta invertida.
_DICT_WORDS = [
    'the', 'and', 'of', 'in', 'with', 'for', 'patients', 'trial', 'results',
    'group', 'study', 'treatment', 'outcome', 'value', 'risk',
    'de', 'da', 'do', 'em', 'para', 'dos', 'das', 'nao', 'entre', 'com',
    'pacientes', 'grupo', 'valor', 'anos', 'media',
]
_DICT_RE = re.compile(r'\b(' + '|'.join(_DICT_WORDS) + r')\b')


def _dict_score(text):
    return len(_DICT_RE.findall(text.lower()))


def fix_reversed_table(rows):
    normal_score = sum(_dict_score(c) for r in rows for c in r if c)
    reversed_score = sum(_dict_score(c[::-1]) for r in rows for c in r if c)
    if reversed_score >= 3 and reversed_score > normal_score * 1.5:
        return [[c[::-1] if c else c for c in r] for r in rows]
    return rows


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "uso: extract_tables.py <pdf>"}))
        sys.exit(1)
    pdf_path = sys.argv[1]
    try:
        import pdfplumber
    except ImportError:
        print(json.dumps({"error": "pdfplumber nao instalado"}))
        sys.exit(1)

    tables = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_idx, page in enumerate(pdf.pages):
                for raw in page.extract_tables():
                    cleaned = [[(c or '').strip() for c in row] for row in raw]
                    if is_real_table(cleaned):
                        cleaned = fix_reversed_table(cleaned)
                        tables.append({"page": page_idx + 1, "rows": cleaned})
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

    print(json.dumps(tables, ensure_ascii=False))


if __name__ == "__main__":
    main()
