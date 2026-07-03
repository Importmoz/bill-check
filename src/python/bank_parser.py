import pandas as pd
import os
import json
import sys
import re
import unicodedata
import datetime
import hashlib

def normalize_str(s):
    if not s: return ""
    s = str(s).upper().strip()
    # Remover acentos e caracteres especiais
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    return s

def build_signature(bank, date_str, amount, balance, reference, description):
    # Formata valores para garantir consistência com o frontend
    bank_clean = str(bank or "").strip()
    date_clean = str(date_str or "").split(' ')[0] # YYYY-MM-DD
    amount_clean = "{:.2f}".format(float(amount or 0))
    balance_clean = "{:.2f}".format(float(balance or 0))
    ref_clean = str(reference or "").strip()
    desc_clean = re.sub(r'\s+', '', str(description or "")).upper()
    
    raw = f"{bank_clean}|{date_clean}|{amount_clean}|{balance_clean}|{ref_clean}|{desc_clean}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()

def clean_amount(val):
    if pd.isna(val) or val == '': return 0.0
    if isinstance(val, (int, float, complex)):
        return float(val.real) if hasattr(val, 'real') else float(val)
    
    s = str(val).replace('MZN', '').strip()
    if not s: return 0.0
    
    # Remover sinais e espaços de milhares comuns em bancos
    s = s.replace('+', '').replace('\xa0', '').replace(' ', '')
    
    # Lógica para detetar separador de milhar vs decimal
    if ',' in s and '.' in s:
        if s.rfind('.') < s.rfind(','): # Estilo 1.234,56
            s = s.replace('.', '').replace(',', '.')
        else: # Estilo 1,234.56
            s = s.replace(',', '')
    elif ',' in s: # Estilo 1234,56
        s = s.replace(',', '.')
    
    try:
        # Remover qualquer caractere que não seja número, ponto ou sinal de menos
        s = re.sub(r'[^0-9.-]', '', s)
        return float(s)
    except:
        return 0.0

def is_bank_fee(desc):
    d = normalize_str(desc)
    pattern = r'\b(COMISS[A-Z]*|IMPOSTO|SELO|MANUTENCAO|JUROS|DESPESAS|IOF|TAXA|TAXE|TAX)\b'
    match = re.search(pattern, d)
    return match is not None

def extract_order_id(desc):
    match = re.search(r'ID\s*([A-Z0-9]+)', desc, re.IGNORECASE)
    if match: return match.group(1).upper()
    return ""

def process_file(filepath):
    filename = os.path.basename(filepath)
    results = []
    bank, owner, acc_num = "UNKNOWN", "UNKNOWN", ""
    fn_upper = filename.upper()
    
    accounts = {
        "75470366": ("BIM BOSS", "FILIPE CHITOFO"),
        "330788916": ("BIM JUPITER", "JUPITER LOGISTICS LDA"),
        "9244900": ("NEDBANK JUPITER", "JUPITER LOGISTICS LDA"),
        "1086059371008": ("STB JUPITER", "JUPITER LOGISTICS LDA"),
        "18909451710002": ("BCI BOSS", "FILIPE CHITOFO"),
        "15466194210001": ("BCI JUPITER", "JUPITER LOGISTICS LDA")
    }
    
    for acc, (b, o) in accounts.items():
        if acc in fn_upper:
            bank, owner, acc_num = b, o, acc
            break
            
    # Tentar ler o ficheiro com múltiplos motores
    df = None
    read_error = ""
    try:
        df = pd.read_excel(filepath)
    except Exception as e1:
        read_error += f" engine1: {str(e1)}"
        try:
            df = pd.read_excel(filepath, engine='xlrd')
        except Exception as e2:
            read_error += f" engine2: {str(e2)}"
            try:
                tables = pd.read_html(filepath)
                if tables: df = tables[0]
            except Exception as e3:
                read_error += f" engine3: {str(e3)}"
                print(f"DEBUG: Erro crítico ao ler {filepath}. Erros: {read_error}", file=sys.stderr)
                # Não retornamos lista vazia aqui. Vamos retornar um erro JSON.
                print(json.dumps({"error": f"Erro interno ao ler o ficheiro. Certifique-se que o pandas e xlrd estão instalados na VPS. Detalhes: {read_error}"}))
                sys.exit(1)
    
    if df is None or df.empty: 
        print(json.dumps({"error": "O ficheiro está vazio ou não pôde ser interpretado."}))
        sys.exit(1)

    # Nedbank specific: check filename pattern
    if "00009244900" in filename or "9244900" in filename:
        bank, owner, acc_num = "NEDBANK", "JUPITER LOGISTICS LDA", "9244900"

    # Tentar detetar banco pelo conteúdo de forma agressiva
    if bank == "UNKNOWN":
        # Diagnóstico para o log do servidor
        print(f"DEBUG: Diagnóstico de {filename} (Primeiras 5 linhas):", file=sys.stderr)
        
        # Procurar por números de conta em qualquer lugar do DataFrame
        all_vals_str = " ".join([str(v) for v in df.values.flatten()])
        for acc, (b, o) in accounts.items():
            if acc in all_vals_str or acc.lstrip('0') in all_vals_str:
                bank, owner, acc_num = b, o, acc
                print(f"DEBUG: Banco detetado via conteúdo global: {bank}", file=sys.stderr)
                break

    if bank == "UNKNOWN":
        for i, row in df.head(15).iterrows():
            row_str = " ".join([str(v) for v in row.values])
            for acc, (b, o) in accounts.items():
                # Correspondência direta por string (importante para zeros à esquerda como no Nedbank)
                if acc in row_str or acc.lstrip('0') in row_str:
                    bank, owner, acc_num = b, o, acc
                    break
                # Correspondência matemática (evita erro de notação científica 1.54e+13)
                for v in row.values:
                    try:
                        if pd.notna(v) and float(str(v).replace(' ','')) == float(acc):
                            bank, owner, acc_num = b, o, acc
                            break
                    except: pass
                if bank != "UNKNOWN": break

    # Fallback agressivo: detetar banco por nomes/palavras-chave no nome do arquivo ou conteúdo global
    if bank == "UNKNOWN":
        all_vals_str = (" ".join([str(v) for v in df.values.flatten()]) + " " + fn_upper).upper()
        if "BCI" in all_vals_str:
            bank, owner = "BCI", "JUPITER LOGISTICS LDA"
        elif "BIM" in all_vals_str or "MILLENNIUM" in all_vals_str:
            bank, owner = "BIM", "JUPITER LOGISTICS LDA"
        elif "NEDBANK" in all_vals_str or "NED" in all_vals_str:
            bank, owner = "NEDBANK", "JUPITER LOGISTICS LDA"
        elif "STANDARD" in all_vals_str or "STB" in all_vals_str:
            bank, owner = "STB", "JUPITER LOGISTICS LDA"

    header_row = -1
    keywords = ['DATA', 'DESCRI', 'DESCRIO', 'CREDITO', 'CRDITO', 'DEBITO', 'DBITO', 'SALDO', 'VALOR', 'MONTANTE', 'DETALHE', 'MOVIMENTO', 'MOEDA', 'MOV', 'DOCUMENTO', 'OPER', 'TRANSAC']

    
    # 1. Procurar o cabeçalho nas primeiras 50 linhas
    for i, row in df.head(50).iterrows():
        # Converter todos os valores da linha para uma string normalizada
        row_vals = [normalize_str(str(x)) for x in row.values if not pd.isna(x)]
        row_str = " ".join(row_vals)
        
        # Se a linha tiver palavras-chave de extrato bancário
        matches = [k for k in keywords if k in row_str]
        if len(matches) >= 3 or (len(matches) >= 2 and ('DATA' in row_str or 'DATE' in row_str)):

            header_row = i
            
            # Criar novos nomes de colunas baseados nesta linha
            new_cols = []
            for idx, c in enumerate(row.values):
                val = normalize_str(str(c))
                if not val or val == 'NAN' or 'UNNAMED' in val: 
                    val = f"COL_{idx}"
                
                # Evitar nomes duplicados (comum em Excel mal formatado)
                orig = val
                count = 1
                while val in new_cols:
                    val = f"{orig}_{count}"
                    count += 1
                new_cols.append(val)
            
            # Reconfigurar o DataFrame: usar a linha i como cabeçalho e descartar tudo acima (inclusive a linha i)
            df.columns = new_cols
            df = df.iloc[i+1:].reset_index(drop=True)
            break
    
    if header_row == -1:
        # Se não encontrou cabeçalho, tentamos ver se a primeira linha já é o cabeçalho (fallback)
        cols_str = " ".join([normalize_str(str(c)) for c in df.columns])
        if sum(1 for k in keywords if k in cols_str) >= 2:
            header_row = 0
            df.columns = [normalize_str(str(c)) for c in df.columns]
        else:
            print(f"DEBUG: Cabeçalho não encontrado em {filepath}. Primeiras linhas: {df.head(3).to_string()}", file=sys.stderr)
            print(json.dumps({"error": f"Não foi possível localizar as colunas do cabeçalho da tabela. A leitura do ficheiro pelo Pandas na VPS retornou uma estrutura inesperada."}))
            sys.exit(1)


    cols = df.columns.tolist()
    
    # Deteção de Colunas
    date_col = next((c for c in cols if 'MOV' in c and 'DATA' in c), None)
    if not date_col:
        date_col = next((c for c in cols if 'DATA' in c and 'VALOR' not in c), None)
    if not date_col:
        date_col = next((c for c in cols if 'DATA' in c or 'DATE' in c), None)
        
    desc_col = next((c for c in cols if any(k in c for k in ['DESCRI', 'DETALHE', 'HISTO', 'OPERAC'])), None)
    if not desc_col and len(cols) > 4: desc_col = cols[4]
    
    ref_col = next((c for c in cols if any(k in c for k in ['REFER', 'DOCUM', 'DOC', 'REF', 'TALAO'])), None)
    
    credit_col = next((c for c in cols if any(k in c for k in ['CREDIT', 'ENTRADA', 'DEPOSITO', 'INCOME', 'CRDITO'])), None)
    
    amount_col = next((c for c in cols if ('VALOR' in c or 'MONTANTE' in c or 'AMOUNT' in c) and 'DATA' not in c), None)
    
    # Ensure balance column is defined before diagnostics
    balance_col = next((c for c in cols if 'SALDO' in c or 'BALANCE' in c), None)

    # Forçar output UTF-8 para evitar problemas de encoding no servidor
    try:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    except Exception:
        pass

    # Log de diagnóstico das colunas
    print(f"DEBUG: Banco Detetado: {bank}", file=sys.stderr)
    print(f"DEBUG: Colunas Mapeadas -> Data: {date_col}, Desc: {desc_col}, Valor: {amount_col}, Saldo: {balance_col}, Ref: {ref_col}", file=sys.stderr)
    
    if not date_col or (not amount_col and not credit_col):
        print(f"DEBUG: Erro Crítico - Colunas essenciais não encontradas!", file=sys.stderr)
        print(f"DEBUG: Colunas disponíveis: {cols}", file=sys.stderr)
        print(json.dumps({"error": f"Não foi possível detetar o cabeçalho correto no ficheiro. Colunas encontradas: {cols}"}))
        sys.exit(1)

    for _, row in df.iterrows():
        try:
            if date_col not in row or pd.isna(row[date_col]): continue
            
            desc_val = str(row[desc_col]) if desc_col else ""
            if not desc_val or desc_val.lower() == 'nan': continue
            
            income = 0.0
            if credit_col:
                income = clean_amount(row[credit_col])
            elif amount_col:
                val = clean_amount(row[amount_col])
                if val > 0: income = val
            
            if income <= 0.01: continue
            
            # Anti-data (filtros de segurança)
            if len(str(int(income))) == 8 and (str(int(income)).startswith('20')): continue

            date_val = row[date_col]
            try:
                if isinstance(date_val, (pd.Timestamp, datetime.datetime)):
                    date_str = date_val.strftime('%Y-%m-%d %H:%M:%S')
                else:
                    date_str = pd.to_datetime(date_val, dayfirst=True).strftime('%Y-%m-%d %H:%M:%S')
            except:
                date_str = str(date_val)

            ref_val = str(row[ref_col]) if ref_col and not pd.isna(row[ref_col]) else ""
            bal_val = clean_amount(row[balance_col]) if balance_col else 0.0
            
            # Gerar assinatura determinística
            sig = build_signature(bank, date_str, income, bal_val, ref_val, desc_val)

            results.append({
                "date": date_str, "bank": bank, "account_owner": owner, "account_number": acc_num,
                "description": desc_val.strip(),
                "reference": ref_val,
                "amount": income, "balance": bal_val,
                "signature": sig,
                "order_id": extract_order_id(desc_val), "reconciled": False
            })
        except:
            continue
            
    return results

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file provided"}))
        sys.exit(1)
        
    final_data = []
    for arg in sys.argv[1:]:
        if os.path.isfile(arg):
            final_data.extend(process_file(arg))
            
    print(json.dumps(final_data, indent=2))
