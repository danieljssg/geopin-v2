# Investigación: captura GIS y navegación móvil

## Evidencias del repositorio

| Archivo | Hallazgo | Consecuencia |
| --- | --- | --- |
| `app/campo/page.tsx` | El panel depende de `formularioAbierto`; puede ocupar 82% del contenedor. El modo de trazado no lo oculta. | El formulario intercepta el espacio necesario para dibujar. |
| `components/field/GeometriaPanel.tsx` | Iniciar, confirmar reemplazo y volver a trazar llaman a `poligono.iniciar()`. Finalizar, deshacer y cancelar viven en ese panel. | Ocultarlo sin trasladar acciones dejaría el dibujo sin controles. |
| `components/field/FormularioParcela.tsx` | Nombre, categoría, descripción y atributos viven en estado local. Hay instancias distintas para escritorio y móvil. | Desmontar el formulario o cambiar de breakpoint puede perder o divergir datos. |
| `lib/field/use-poligono.ts` | `iniciar` elimina la geometría anterior; `cancelar` sólo vacía el borrador. `terminar` devuelve éxito o error. | Cancelar un retrazado no restaura por sí solo la geometría anterior. |
| `components/NavBar.tsx` | Dropdown móvil y dropdown de avatar duplican Perfil/Cerrar sesión. Enlaces por rol; escritorio desde `sm`. | Navegación pequeña y redundante; tablets estrechas pueden necesitar drawer. |

Estos hallazgos proceden de lectura estática. No se midieron tiempos ni se realizaron sesiones de usuarios o pruebas en dispositivos.

## Fuentes consultadas

Consultadas el 26 de octubre de 2026. Son referencias de patrones; no demuestran que una solución concreta sea óptima para GeoPin.

- [QField: Digitize and edit](https://docs.qfield.org/how-to/data-collection/digitize/): distingue exploración y digitalización, con creación de geometría y atributos. Aplicación propuesta: modo explícito de medición con acciones propias.
- [ArcGIS Field Maps: Capture](https://doc.arcgis.com/en/field-maps/android/use-maps/capture.htm): captura combina ubicación y formulario, y distingue ubicación GPS y selección sobre mapa. Aplicación propuesta: separar tareas espaciales y atributos sin perder su relación.
- [shadcn/ui: Drawer, variante Base UI](https://ui.shadcn.com/docs/components/base/drawer): referencia para composición de portal, overlay y contenido. Verificar compatibilidad con versiones instaladas antes de adoptar; no mezclar ejemplos Radix y Base UI sin revisión.
- [WAI-ARIA: Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): un modal vuelve inerte el fondo y gestiona el foco dentro. Aplicación: navegación modal, pero controles de trazado no modales para poder usar el mapa.

## Decisiones propuestas para GeoPin

1. Medir y rellenar son fases distintas de un mismo borrador. Al iniciar trazado, cerrar la superficie del formulario, ocultar teclado y mantener los datos en un propietario estable.
2. Mostrar durante el trazado una barra compacta con vértices, área/perímetro, Deshacer, Cancelar y Finalizar. No exigir volver a abrir el formulario para terminar.
3. Finalizar sólo vuelve al formulario si la geometría es válida. Cancelar restaura el estado anterior al trazado, incluidos polígono y área manual.
4. Evitar recentrado GPS automático mientras se dibuja: podría mover el mapa entre dos vértices. Mantener lectura de precisión; recentrar mediante acción explícita.
5. Drawer inferior de navegación con acciones amplias. Cerrar sesión primero es una preferencia explícita del usuario, no una recomendación derivada de las herramientas GIS. No enfocarlo automáticamente al abrir: enfocar el título o cierre del drawer.
6. Retirar avatar y conservar Perfil en el menú. Desktop: sidebar con la misma fuente de enlaces por rol; móvil/tablet estrecha: drawer inferior.
7. Objetivo de diseño: áreas táctiles de al menos 44 × 44 CSS px y separación suficiente. Es un objetivo del producto, no una afirmación de conformidad WCAG. Evitar scroll de página en captura; aceptar scroll interno en formularios y menús largos.

## Alternativas y límites

Una sheet parcialmente abierta mantiene contexto, pero ocupa superficie y puede interceptar gestos: preferir cerrarla al medir. No basta con aumentar z-index. Mirilla central para colocar vértices puede mejorar precisión con el dedo; dejar como experimento posterior, conservando inicialmente la interacción actual.

No se propone cambiar MongoDB, API, umbral de precisión GPS ni cálculo geodésico. La medición sobre mapa no debe presentarse como levantamiento topográfico certificado. La persistencia de borradores tras recargar es una ampliación separada: esta fase garantiza conservación durante la sesión y cambios de panel/breakpoint.
