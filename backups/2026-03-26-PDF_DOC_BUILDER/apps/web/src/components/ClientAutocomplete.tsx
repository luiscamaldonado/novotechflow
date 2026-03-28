import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { Search, Loader2, X, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

// ──────────────────────────────────────────────────────────
// Interfaces / Tipos
// ──────────────────────────────────────────────────────────

/** Representa un cliente del maestro de datos. */
interface Client {
  id: string;
  name: string;
  nit?: string;
}

/** Estructura de respuesta del endpoint /clients/search. */
interface SearchResponse {
  results: Client[];
  suggestion: string | null;
}

/**
 * Props del componente ClientAutocomplete.
 *
 * @property onSelect - Callback ejecutado al seleccionar un cliente o escribir un nombre nuevo.
 * @property defaultValue - Valor inicial del campo de texto.
 * @property placeholder - Texto guía cuando el campo está vacío.
 * @property className - Clases CSS adicionales para el contenedor raíz.
 */
interface ClientAutocompleteProps {
  onSelect: (client: Client | { id: null; name: string }) => void;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}

// ──────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────

/** Tiempo de espera antes de disparar la búsqueda (ms). */
const DEBOUNCE_DELAY_MS = 300;

/** Número mínimo de caracteres para activar la búsqueda. */
const MIN_SEARCH_LENGTH = 2;

// ──────────────────────────────────────────────────────────
// Componente
// ──────────────────────────────────────────────────────────

/**
 * Componente de autocompletado inteligente para búsqueda de clientes.
 *
 * @description
 * Características principales:
 * - Búsqueda con debounce para optimizar llamadas al backend.
 * - Sugerencia tipo Google ("¿Quisiste decir...?") cuando no hay coincidencias exactas.
 * - Auto-registro: los nombres nuevos se guardan automáticamente al crear la propuesta.
 * - Ranking de relevancia: los resultados más relevantes aparecen primero.
 */
export function ClientAutocomplete({
  onSelect,
  defaultValue = '',
  placeholder = 'Buscar cliente...',
  className,
}: ClientAutocompleteProps) {
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Client[]>([]);
  const [suggestionTip, setSuggestionTip] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Búsqueda con debounce ──────────────────────────────
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < MIN_SEARCH_LENGTH || !isOpen) {
        setSuggestions([]);
        setSuggestionTip(null);
        return;
      }

      setIsLoading(true);
      try {
        const response = await api.get<SearchResponse>(
          `/clients/search?q=${encodeURIComponent(query)}`
        );
        setSuggestions(response.data.results);
        setSuggestionTip(response.data.suggestion);
      } catch (error) {
        console.error('Error buscando clientes:', error);
        setSuggestions([]);
        setSuggestionTip(null);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // ── Cerrar dropdown al hacer clic fuera ────────────────
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Handlers ───────────────────────────────────────────

  /** Selecciona un cliente de la lista y cierra el dropdown. */
  const handleSelect = (client: Client): void => {
    setQuery(client.name);
    setIsOpen(false);
    setSuggestionTip(null);
    onSelect(client);
  };

  /** Aplica la sugerencia "¿Quisiste decir...?" al campo de búsqueda y notifica al padre. */
  const handleApplySuggestion = (): void => {
    if (!suggestionTip) return;

    const fixedName = suggestionTip;
    setQuery(fixedName);
    setSuggestionTip(null);
    setIsOpen(true);
    onSelect({ id: null, name: fixedName });
  };

  /** Controla los cambios de texto y sincroniza con el formulario padre. */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(true);
    onSelect({ id: null, name: value });
  };

  /** Limpia el campo y resetea el estado del formulario padre. */
  const handleClear = (): void => {
    setQuery('');
    onSelect({ id: null, name: '' });
  };

  // ── Condiciones de renderizado ─────────────────────────
  const showSuggestionTip = suggestionTip && !isLoading && suggestions.length === 0;
  const showDropdown = isOpen && (query.length >= MIN_SEARCH_LENGTH || isLoading);
  const showEmptyState = query.length >= MIN_SEARCH_LENGTH && !suggestionTip;

  // ── Render ─────────────────────────────────────────────
  return (
    <div className={cn('relative w-full', className)} ref={dropdownRef}>
      {/* Campo de búsqueda */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="block w-full pl-10 pr-10 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all shadow-inner"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Sugerencia inteligente tipo Google */}
      {showSuggestionTip && (
        <div className="mt-2 px-1 text-sm animate-in fade-in slide-in-from-top-1">
          <span className="text-slate-400 italic">¿Quisiste decir: </span>
          <button
            onClick={handleApplySuggestion}
            className="text-violet-400 font-bold hover:underline hover:text-violet-300 transition-colors inline-flex items-center"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            {suggestionTip}
          </button>
          <span className="text-slate-400 italic">?</span>
        </div>
      )}

      {/* Dropdown de resultados */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-72 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="p-6 flex flex-col justify-center items-center text-slate-400 space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              <span className="text-xs font-medium tracking-wider uppercase">
                Buscando en la base de datos...
              </span>
            </div>
          ) : suggestions.length > 0 ? (
            <ul className="py-2 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600">
              {suggestions.map((client) => (
                <li
                  key={client.id}
                  onClick={() => handleSelect(client)}
                  className="px-4 py-3 hover:bg-violet-600/90 cursor-pointer transition-all group flex flex-col border-b border-white/5 last:border-0"
                >
                  <div className="font-semibold text-white group-hover:text-white truncate">
                    {client.name}
                  </div>
                  {client.nit && (
                    <div className="text-[10px] text-slate-500 group-hover:text-violet-200 mt-0.5 font-mono">
                      NIT: {client.nit}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : showEmptyState && (
            <div className="p-5 text-center">
              <p className="text-sm text-slate-400">
                No se encontraron resultados para &quot;{query}&quot;
              </p>
              <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-tighter">
                Se registrará como un cliente nuevo
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
