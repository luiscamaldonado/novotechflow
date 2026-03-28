import os

def main():
    path = r"d:\novotechflow\terceros sag.csv"
    
    new_groups = [
        "GRUPO APPLUS", "GRUPO ARDILA LULE", "GRUPO ARGOS", "GRUPO AVAL", "GRUPO B&D",
        "GRUPO BERRY GLOBAL", "GRUPO BIENES & BIENES", "GRUPO BOSTON MEDICAL", "GRUPO BRIGHTSTAR",
        "GRUPO CADENA", "GRUPO CARBOMAS", "GRUPO COMPAS", "GRUPO COMSA CORPORACION", "GRUPO CORONA",
        "GRUPO CREDICORP", "GRUPO CREDIVALORES", "GRUPO CUEROS VELEZ", "GRUPO ENDAVA", "GRUPO ESTUDIO DE MODA",
        "GRUPO FALABELLA", "GRUPO FIDUCOLDEX", "GRUPO FISA", "GRUPO GECOLSA", "GRUPO HACEB", "GRUPO HDI SEGUROS",
        "GRUPO INSER", "GRUPO INTERGRUPO", "GRUPO KONECTA", "GRUPO LAFAYETTE", "GRUPO LEONISA", "GRUPO MAGNUM",
        "GRUPO MAKRO", "GRUPO MANPOWER", "GRUPO NUTRESA", "GRUPO OLD MUTUAL", "GRUPO ORGANIZACION VID",
        "GRUPO POSTOBON", "GRUPO PROCINAL", "GRUPO SANTAMARIA", "GRUPO SOLLA", "GRUPO SURA", "GRUPO TCC",
        "GRUPO TDM", "GRUPO TELEPERFORMANCE", "GRUPO TERPEL", "GRUPO TIGO-UNE", "GRUPO VALOREM", "GRUPO VEOLIA", "GRUPO ÉXITO"
    ]
    
    existing = set()
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
             for line in f:
                 existing.add(line.strip().upper())
                 
    with open(path, "a", encoding="utf-8") as f:
        for group in new_groups:
            if group.upper() not in existing:
                f.write(group + "\n")
                print(f"Agregado: {group}")
            else:
                print(f"Omitido (ya existe): {group}")

if __name__ == "__main__":
    main()
