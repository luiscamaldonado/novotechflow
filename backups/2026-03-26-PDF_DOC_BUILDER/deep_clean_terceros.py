import os
import re

def main():
    path = r"d:\novotechflow\terceros sag.csv"
    
    if not os.path.exists(path):
        print(f"No se encontró {path}")
        return
        
    unique_names = set()
    cleaned_lines = []
    
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            name = line.replace(";", "").strip()
            if not name:
                continue

            # Convert sequence like S . A . S . to SAS
            # This handles S.A.S, S. A. S., S A S, etc.
            name = re.sub(r'\bS\s*\.?\s*A\s*\.?\s*S\s*\.?\b', 'SAS', name, flags=re.IGNORECASE)
            # This handles S.A., S. A., S A, etc.
            name = re.sub(r'\bS\s*\.?\s*A\s*\.?\b', 'SA', name, flags=re.IGNORECASE)
            # This handles L.T.D.A., L T D A, etc.
            name = re.sub(r'\bL\s*\.?\s*T\s*\.?\s*D\s*\.?\s*A\s*\.?\b', 'LTDA', name, flags=re.IGNORECASE)
            
            # Quitar puntos restantes
            name = name.replace(".", "")
            
            # Quitar espacios múltiples y dejar solo uno
            name = re.sub(r'\s+', ' ', name)
            
            # Quitar espacios al inicio y al final
            name = name.strip()
            
            if name:
                name_upper = name.upper()
                if name_upper not in unique_names:
                    unique_names.add(name_upper)
                    cleaned_lines.append(name)
                    
    # Guardar sobre el mismo archivo
    with open(path, "w", encoding="utf-8") as f:
        for name in cleaned_lines:
            f.write(name + "\n")
            
    print(f"Limpieza de sufijos (SA, SAS, LTDA) finalizada. {len(cleaned_lines)} clientes únicos extraídos.")

if __name__ == "__main__":
    main()
