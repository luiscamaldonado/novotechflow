import os
import re
import unicodedata

def remove_accents(input_str):
    nfkd_form = unicodedata.normalize('NFKD', input_str)
    return u"".join([c for c in nfkd_form if not unicodedata.combining(c)])

def main():
    path = r"d:\novotechflow\terceros sag.csv"
    
    if not os.path.exists(path):
        print(f"No se encontró {path}")
        return
        
    unique_names = set()
    cleaned_lines = []
    
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            name = line.strip()
            if not name:
                continue

            # Eliminar tildes
            name = remove_accents(name)
            
            if name:
                name_upper = name.upper()
                if name_upper not in unique_names:
                    unique_names.add(name_upper)
                    cleaned_lines.append(name)
                    
    # Guardar sobre el mismo archivo
    with open(path, "w", encoding="utf-8") as f:
        for name in cleaned_lines:
            f.write(name + "\n")
            
    print(f"Limpieza de tildes finalizada. {len(cleaned_lines)} clientes únicos extraídos.")

if __name__ == "__main__":
    main()
