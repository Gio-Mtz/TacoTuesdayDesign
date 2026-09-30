# Taco Tuesday Consulting — Design System

**Concepto:** *Agave & Maíz* — raíces de Jalisco, registro B2B.
Un solo tema, dos modos (claro y oscuro). Sin variantes de color por pantalla.

```
TacoTuesdayDesign/
├── 00-brand/          concepto, reglas de uso, voz y tono, logotipos SVG
├── 01-tokens/         tokens.json (fuente de verdad), theme.css, _tokens.scss
├── 02-icons/          30 iconos SVG 24×24 + sprite.svg (generado) + icons.json
├── 03-preview/        index.html — ábrelo en el navegador y ve todo junto
└── tools/             sync-icons.mjs — regenera todas las copias del sprite
```

**Empieza aquí:** abre `03-preview/index.html` en Chrome. Trae un botón para alternar
claro/oscuro y muestra paleta, tipografía, componentes, iconos y escalas.

---

## La decisión que hay que entender antes de usarlo

Hay **dos capas de color** y mezclarlas es el error que rompe el modo oscuro:

| Capa | Ejemplo | Cambia con el tema |
| --- | --- | --- |
| **Paleta cruda** | `--tt-agave-600`, `$agave 600` | ❌ Nunca |
| **Token semántico** | `--tt-brand`, `--tt-text-primary` | ✅ Sí |

En un componente **siempre** usas la capa semántica:

```scss
.card {
  background: var(--tt-bg-surface);   // ✅
  color: var(--tt-text-primary);      // ✅
  border: 1px solid var(--tt-border); // ✅
}

.card-mal {
  background: #FFFFFF;                // ❌ se queda blanca en modo oscuro
  color: tt.agave(600);               // ❌ Sass resuelve en build, no en runtime
}
```

El modo oscuro **no son colores distintos**: son los mismos colores en otro papel. Por eso
`--tt-brand` pasa de `agave-600` en claro a `agave-300` en oscuro — sobre un lienzo casi negro
el verde oscuro no alcanza contraste, y el claro llega a ~9:1.

Regla mental: **Sass para lo que no cambia (medidas, breakpoints, mixins), CSS custom
properties para todo lo que cambie en tiempo de ejecución.**

---

## Cómo conectarlo a la UI de Angular

1. Copia `01-tokens/theme.css` y `01-tokens/_tokens.scss` a `TacoTuesdayUI/src/styles/`.
2. En `src/styles.scss`:

```scss
@use 'styles/tokens' as tt;
@import 'styles/theme.css';
```

3. En `src/index.html`, las fuentes y el favicon:

```html
<link rel="icon" href="favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

4. Copia `00-brand/logo/favicon.svg` a `public/favicon.svg`. El sprite **no se copia a mano**:
   `node tools/sync-icons.mjs` escribe `../TacoTuesdayUI/public/icons.svg` (ver *Agregar un icono*).
5. Un icono se usa así:

```html
<svg width="20" height="20" aria-hidden="true"><use href="/icons.svg#tt-search"/></svg>
```

Como los iconos usan `stroke="currentColor"`, heredan el color del texto de su contenedor.
Un icono dentro de un botón primario se pone blanco solo, sin una sola línea de CSS extra.

---

## Agregar un icono

El dibujo de cada icono vive en **un solo lugar**: su archivo en `02-icons/`. Todo lo demás
—el sprite, la copia del sprite que trae el preview, la galería, el sprite del repo de la UI y
el número de iconos de este README— lo **genera** `tools/sync-icons.mjs`.

```bash
node tools/sync-icons.mjs          # regenera todas las copias
node tools/sync-icons.mjs --check  # no escribe nada; sale con error si alguna copia se desvió
```

Para agregar uno:

1. Pon `02-icons/mi-icono.svg` junto a los demás. 24×24, `viewBox="0 0 24 24"`,
   `stroke="currentColor"`, trazo 1.75.
2. Agrega `"mi-icono"` a `02-icons/icons.json`, **en el lugar donde quieres que salga** en la
   galería. El orden es curado, no alfabético: los iconos parecidos van juntos.
3. Corre `node tools/sync-icons.mjs`.

Un archivo que no esté en la lista, o un nombre en la lista sin archivo, es un **error duro**.
Eso es a propósito: no se puede agregar un icono a medias.

> **Por qué existe este script.** El mismo dibujo estaba escrito en **cinco** lugares, y una de
> las copias —la que el preview trae inline para poder abrirse sin servidor— se mantenía a mano.
> Al agregar el sol y la luna hubo que tocar cuatro archivos y acordarse de los cuatro. Nada
> avisaba si se olvidaba uno: la galería del design system simplemente mostraría un hueco, o
> peor, un icono viejo, **en silencio**. Ningún build, ningún test y ningún CI ve eso. Ahora hay
> un solo origen y un comando que compara. Es la misma clase de falla que el correo que apuntaba
> a un buzón inexistente: **un valor duplicado cuya copia nadie compara**.

---

## El interruptor de tema

El tema se resuelve en tres niveles, en orden:

1. `<html data-theme="dark">` o `="light"` → lo que el usuario eligió, gana siempre.
2. `@media (prefers-color-scheme: dark)` → lo que dice el sistema operativo.
3. `:root` → claro, el default.

Un servicio de Angular que lo maneje solo tiene que escribir `data-theme` en el `<html>` y
guardar la preferencia. Si no hay preferencia guardada, **no escribas nada** y deja que gane
el sistema operativo — ese es el punto del nivel 2.

---

## Accesibilidad, ya resuelta en los tokens

- `--tt-brand` sobre blanco: **6.2:1** (texto normal AA ✅)
- Blanco sobre `--tt-brand`: **6.2:1** — por eso el botón primario usa `agave-600` y no `agave-500`,
  que se quedaba en 4.3:1 y reprobaba.
- `--tt-brand` (agave-300) sobre `--tt-bg-canvas` en oscuro: **~9:1** ✅
- `theme.css` define **un solo anillo de foco** para todo el producto y respeta
  `prefers-reduced-motion`.

Si cambias un color, **vuelve a medir el contraste**. No lo estimes de ojo: los verdes y los
azules engañan mucho.

---

## Lo que falta (y a propósito no está)

- **Los logos usan `<text>` vivo.** Antes de mandarlos fuera, convierte el texto a curvas.
  Está explicado en `00-brand/brand.md`.
- **No hay librería de componentes.** Los tokens son la base; los componentes se construyen
  en la UI cuando cada pantalla los pida. Construir 40 componentes que nadie usa todavía es
  justo el tipo de trabajo que se siente productivo y no lo es.
- **No hay ilustraciones ni fotos.** Cuando hagan falta, la regla es: fotos reales de gente
  real trabajando, nunca stock de gente sonriendo con laptops.
