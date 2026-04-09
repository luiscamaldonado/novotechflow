# Walkthrough: Sistema de Notificaciones del Dashboard

> **Fecha:** 2026-04-09  
> **Autor:** Asistente IA  
> **Commits:** 3 incrementales → 1 commit final consolidado

---

## Resumen General

Se implementó un sistema completo de notificaciones para el Dashboard de NovoTechFlow.
El sistema alerta a los usuarios comerciales sobre propuestas que requieren atención
(fechas de cierre próximas/vencidas, vigencia expirada, propuestas estancadas, y
desviaciones de TRM en escenarios multi-moneda).

---

## Chat 1: Notification Engine + Hook

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `apps/web/src/lib/notification-engine.ts` | Motor puro (262 líneas). 7 tipos de notificación, 4 reglas de negocio, 0 dependencias de React. |
| `apps/web/src/hooks/useNotifications.ts` | Hook de React (100 líneas). Consume el engine, gestiona estado de lectura con localStorage, expone `notifications`, `warnings`, `urgents`, contadores y `markAsRead`/`markAllRead`. |

### Reglas de negocio implementadas

| Regla | Severidad | Condición |
|-------|-----------|-----------|
| `CLOSE_DATE_WARNING` | WARNING | Fecha de cierre ≤ 5 días |
| `CLOSE_DATE_EXPIRED` | URGENT | Fecha de cierre vencida |
| `VALIDITY_WARNING` | WARNING | Fecha de vigencia ≤ 5 días |
| `VALIDITY_EXPIRED` | URGENT | Fecha de vigencia vencida |
| `STALE_30_DAYS` | WARNING | Sin actualización 30–44 días |
| `STALE_45_DAYS` | URGENT | Sin actualización ≥ 45 días |
| `TRM_DEVIATION` | URGENT | Desviación TRM > 60 COP vs. tasa actual |

### Decisiones de diseño

- **Funciones puras:** El engine no depende de React. Facilita testing futuro.
- **IDs determinísticos:** `{proposalId}-{type}[-{scenarioName}]` permite persistir estado de lectura entre sesiones.
- **localStorage:** Estado de lectura persiste en `novotechflow_read_notifications`.

---

## Chat 2: NotificationBells (UI de campanas + popover)

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `apps/web/src/pages/dashboard/NotificationBells.tsx` | Componente (217 líneas). 2 campanas (WARNING/URGENT) con popovers flotantes independientes. |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `apps/web/src/pages/Dashboard.tsx` | Importar `NotificationBells` y `useNotifications`. Integrar campanas en el header. State `_showAllNotifications` (prefixed para no romper tsc hasta el Chat 3). |

### Decisiones de diseño

- **2 campanas separadas:** Amber (advertencias) y roja (urgentes), cada una con su popover.
- **Auto-mark on open:** Al abrir un popover, marca automáticamente como leídas todas las de esa severidad.
- **Click-outside close:** Listener `mousedown` en document para cerrar popover.
- **"Ver todas" CTA:** Footer del popover navega al panel completo (Chat 3).

---

## Chat 3: NotificationPanel (Panel completo)

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `apps/web/src/pages/dashboard/NotificationPanel.tsx` | Modal overlay (190 líneas). Lista completa de notificaciones, ordenada por severidad y estado de lectura. |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `apps/web/src/pages/Dashboard.tsx` | Importar `NotificationPanel`. Desestructurar `notifications` y `markAsRead` del hook. Quitar underscore de `showAllNotifications`. Renderizar `<NotificationPanel>` al final del JSX. |

### Especificaciones del panel

- **Modal overlay:** `bg-black/30`, centrado, cierra con click en fondo, botón X, o tecla Escape.
- **Panel interior:** `bg-white rounded-2xl shadow-2xl`, `max-w-lg`, `max-height: 80vh` con scroll.
- **Ordenamiento:** URGENT primero → WARNING después. Dentro de cada grupo, no leídas primero.
- **Badges:**
  - URGENTE: `bg-red-100 text-red-700 text-[9px] font-black uppercase`
  - PREVENTIVA: `bg-amber-100 text-amber-700 text-[9px] font-black uppercase`
- **Indicadores:**
  - No leída: `bg-indigo-50/50 border-l-4 border-indigo-400` + punto azul
  - Leída: `bg-white border-transparent`
- **Acciones:** Click individual marca como leída. Botón "Marcar todas como leídas" en header.
- **Empty state:** Ícono de campana gris + "No hay notificaciones pendientes".

---

## Inventario completo de archivos

### Creados (3)

```
apps/web/src/lib/notification-engine.ts          (262 líneas)
apps/web/src/hooks/useNotifications.ts            (100 líneas)
apps/web/src/pages/dashboard/NotificationBells.tsx (217 líneas)
apps/web/src/pages/dashboard/NotificationPanel.tsx (190 líneas)
```

### Modificados (1)

```
apps/web/src/pages/Dashboard.tsx
  - Imports: +NotificationBells, +NotificationPanel, +useNotifications
  - Hook: useNotifications(proposals, trmRate) → destructure all exports
  - State: showAllNotifications + setShowAllNotifications
  - JSX: <NotificationBells> en header, <NotificationPanel> al final
```

---

## Commit final

```bash
git add -A
git commit -m "feat: full notification panel + integrate into Dashboard"
```

---

## Diagrama de arquitectura

```
┌──────────────────────────────────┐
│          Dashboard.tsx           │
│  ┌────────────────────────────┐  │
│  │  useNotifications(hook)    │  │
│  │  └── notification-engine   │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌──────────────┐  ┌──────────┐  │
│  │NotifBells    │  │NotifPanel│  │
│  │(popover x2)  │  │(modal)   │  │
│  └──────────────┘  └──────────┘  │
└──────────────────────────────────┘
```

### Flujo de datos

```
proposals + trmRate
    │
    ▼
notification-engine.generateNotifications()
    │
    ▼
useNotifications (hook)
    ├── notifications[]
    ├── warnings[] / urgents[]
    ├── unreadWarnings / unreadUrgents
    ├── markAsRead(ids[])
    └── markAllRead(severity)
         │
    ┌────┴────┐
    ▼         ▼
BellButton  NotificationPanel
(popover)   (modal overlay)
```
