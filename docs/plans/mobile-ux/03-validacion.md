# Validación futura y criterios de aceptación

Estado: todos los escenarios pendientes. No son resultados obtenidos.

## Matriz de dispositivos

Verificar 320/375/390 px de ancho, móvil horizontal, tablet 768/1024 px y escritorio 1440 px. Incluir Safari iOS y Chrome Android en dispositivo real para teclado, GPS y safe area; emulación complementa pero no sustituye esas comprobaciones. Cubrir temas claro/oscuro, administrador/encuestador, conexión/offline y GPS denegado, débil y preciso.

## Captura

| Escenario | Resultado requerido |
| --- | --- |
| Rellenar nombre y atributos; iniciar perímetro | Formulario desaparece, teclado se cierra, mapa responde y datos se conservan. |
| Añadir tres o más vértices y finalizar | Formulario reaparece con mismos atributos y geometría válida. |
| Geometría inválida | Error visible/anunciado en medición; no volver ni borrar el borrador. |
| Retrazar y cancelar | Recuperar polígono, medidas y área manual anteriores, según corresponda. |
| Deshacer hasta cero vértices | Sin errores; Finalizar permanece deshabilitado. |
| Ocultar, reabrir o rotar dispositivo | Un único borrador consistente; no campos duplicados accesibles. |
| Nueva lectura GPS durante trazado | Cámara estable; ningún salto que altere la tarea. |
| Abrir Capas mientras se mide | Opciones y controles alcanzables, sin solapamiento con Finalizar. |
| Guardado fallido u offline | Mostrar resultado real; no borrar datos antes de confirmación de encolado/guardado. |

## Navegación y accesibilidad

- Drawer sale desde abajo; primera acción Cerrar sesión, separador y navegación del rol debajo. Avatar eliminado; Perfil sigue disponible.
- Focus inicial en título/cierre, nunca en Cerrar sesión; tabulación contenida, Escape/cierre devuelve foco al botón Menú. Screen reader anuncia título y ruta activa.
- Al cerrar, mapa vuelve a aceptar gestos. No queda overlay, scroll bloqueado ni foco en contenido oculto.
- Abrir menú desde trazado y cerrarlo preserva vértices. Intentar navegar o salir con cambios permite cancelar la salida sin pérdida.
- Cierre de sesión fallido presenta error y conserva la sesión; éxito redirige correctamente.
- Sidebar de escritorio no obliga a desplazamiento horizontal de la página. Drawer con enlaces de administrador funciona en pantallas bajas mediante scroll interno.
- Teclado no tapa campo enfocado, error ni acción principal; comprobar zoom de texto, movimiento reducido y contraste. Mapa mantiene apariencia clara.

## Comprobaciones técnicas al implementar

Añadir pruebas de comportamiento donde aporten valor: conservación del borrador al cambiar superficies, restauración al cancelar y transición tras validación geométrica. Reutilizar pruebas de dominio existentes; evitar snapshots que sólo reproduzcan clases CSS. Ejecutar comprobaciones de tipos/lint pertinentes y pruebas de interacción disponibles, sin arrancar dev/start/build si continúa vigente la restricción del usuario.

Registrar evidencia de los escenarios realmente probados, navegador, viewport y limitaciones. No afirmar conformidad de accesibilidad o validación en dispositivo sin haberla realizado.

## Criterio para cerrar la implementación

Se puede rellenar un registro, medir en mapa, cancelar/reintentar, volver al formulario y guardarlo sin perder atributos ni tener que cerrar manualmente paneles para dibujar. La navegación comparte enlaces/roles, abre desde abajo en móvil y no oculta controles del mapa después de cerrarse.
