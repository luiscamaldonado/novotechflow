import os

def main():
    path = r"d:\novotechflow\terceros sag.csv"
    
    if not os.path.exists(path):
        print(f"No se encontró {path}")
        return
        
    unique_names = set()
    cleaned_lines = []
    
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            # Eliminar todos los punto y coma
            name = line.replace(";", "").strip()
            if name:
                name_upper = name.upper() # Use upper case for case-insensitive deduplication
                if name_upper not in unique_names:
                    unique_names.add(name_upper)
                    cleaned_lines.append(name) # Keep original casing roughly, but unique logic is case-insensitive
                    
    # Guardar sobre el mismo archivo
    with open(path, "w", encoding="utf-8") as f:
        for name in cleaned_lines:
            f.write(name + "\n")
            
    print(f"Limpieza finalizada. {len(cleaned_lines)} clientes únicos extraídos y guardados.")

if __name__ == "__main__":
    main()
