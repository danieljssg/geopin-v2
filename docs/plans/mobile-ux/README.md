# Planes de UX móvil — GeoPin

Fecha: 26 de octubre de 2026. Estado: investigación y propuesta; implementación pendiente.

Esta entrega sólo añade documentación. No implementa interfaces, cambia dependencias ni ejecuta pruebas de aplicación. Revisar el estado de main antes de ejecutar: el análisis corresponde al código local de esta sesión, no a una prueba del despliegue.

## Índice y orden de ejecución

1. [Investigación y decisiones](01-investigacion.md): evidencias, fuentes y límites.
2. [Plan de implementación](02-implementacion.md): conservación de datos, captura y navegación.
3. [Validación y aceptación](03-validacion.md): escenarios que deberán verificarse cuando se implemente.

Prioridad: preservar el borrador → separar medición y formulario → drawer de navegación → verificación móvil y escritorio. Los criterios son pendientes, no resultados de pruebas.

## Alcance acordado

- Al trazar un perímetro, liberar el mapa y mantener visibles únicamente las acciones de medición.
- Menú móvil en drawer inferior; escritorio con sidebar adaptable.
- Cerrar sesión como primera acción, luego Separator y opciones por rol, incluyendo Perfil. Quitar el disparador user-avatar sin perder acceso al perfil.
- Mantener estilos claro/oscuro de la interfaz y mapa claro.
- Documentar ahora; ejecutar posteriormente. No instalar componentes ni abrir PR de implementación en esta etapa.
