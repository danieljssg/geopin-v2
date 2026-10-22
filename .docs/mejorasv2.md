# Plan de Ejecución Técnico para Desarrollo del Sistema GIS (Móvil + Web)

---

## 1. Visión General y Alcance del Proyecto

### 1.1 Objetivo del Proyecto

Diseñar, optimizar y escalar una solución integral (App Móvil para campo + Plataforma Web administrativa) orientada al levantamiento de información catastral, infraestructura y servicios urbanos. El sistema debe superar los cuellos de botella de conectividad offline, imprecisión de geolocalización, limitaciones en la captura de geometrías de parcelas y la fragmentación en la recolección de datos en campo.

### 1.2 Alcance del Levantamiento Urbano

\* \*\*Entidad Geográfica Principal:\*\* Parcelas, viviendas (unifamiliares/multifamiliares) y equipamientos urbanos (iglesias, estaciones de servicio, terminales, comercios).


\* \*\*Módulos Temáticos de Datos:\*\*
1. \*Edificación y Usos:\* Fachadas, tipos de construcción, metros cuadrados, parcelamiento.


2. \*Equipamiento Urbano:\* Escuelas, comercios, paradas, áreas recreativas, vegetación/arborización.


3. \*Servicios e Infraestructura:\* Acueductos, alcantarillado, tipos de drenaje, redes eléctricas, vialidad, telecomunicaciones, aseo urbano y cloacas.


4. \*Análisis Urbanístico:\* Cálculo automático de superávit/déficit o saturación de servicios.





---

## 2. Fases de Ejecución

\`\`\`
+-----------------------------------------------------------------------------------+
| FASE 1: Arquitectura Base, Sincronización y Corrección Técnica                     |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| FASE 2: Captura en Campo, Geometría y UX Móvil                                   |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| FASE 3: Estructuración Modular y Motor de Datos Dinámico                         |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| FASE 4: Consolidación, Cruce de Datos y Backend Administrativo                    |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| FASE 5: Optimización de Almacenamiento, Fuentes Cartográficas y Despliegue         |
+-----------------------------------------------------------------------------------+

\`\`\`

---

### FASE 1: Arquitectura Base, Sincronización y Corrección Técnica

#### Objetivos

Resolver las fallas críticas de conectividad offline y la imprecisión del sensor GPS detectadas durante las pruebas iniciales.

#### Tareas Técnicas

1. \*\*Implementación de Arquitectura \*Offline-First\*:\*\*
\* Configurar base de datos embebida local (ej. SQLite / WatermelonDB / IndexedDB) para almacenamiento persistente en el dispositivo móvil.
\* Diseñar cola de sincronización diferida (\*Background Sync\*) que almacene coordenadas, pines y formularios cuando no haya cobertura celular o megas.


\* Garantizar precarga de teselas de mapas (\*tiles\*) en memoria caché para navegación en zonas de baja cobertura.




2. \*\*Mitigación y Calibración de Geolocalización (GPS):\*\*
\* Implementar filtro de precisión GPS en el cliente: descartar lecturas con margen de error superior a $15\\text{ metros}$ para evitar saltos hacia redomas o puntos distantes (desfases de 30 a 60m).
\* Agregar indicador visual en pantalla sobre el estado del GPS (precisión en metros y estado de la fijación de satélites).
\* Implementar opción de "Ubicación Asistida o Manual": permitir fijar la posición sobre el mapa si la lectura del sensor es imprecisa.
\* Automatizar mecanismo de reintento de conexión de red para evitar depender del reinicio manual de la interfaz de red (modo avión).





#### Hitos de la Fase 1

\* \*\*\[Hito 1.1\]:\*\* Sistema capaz de capturar y guardar 100% de los registros en modo offline sin pérdida de datos.


\* \*\*\[Hito 1.2\]:\*\* Reducción del margen de error de posicionamiento a $&lt;10\\text{ metros}$ en la fijación de pines.

#### Checklist de Verificación (Fase 1)

\* \[ \] La app permite capturar pines y formularios completos sin conexión a Internet.


\* \[ \] Los datos locales se sincronizan automáticamente con el servidor al detectar red.


\* \[ \] La app rechaza o alerta sobre lecturas de GPS con precisión menor a 15 metros.
\* \[ \] Se dispone de opción para ajustar la posición del pin manualmente en la pantalla.
\* \[ \] El sistema no se congela ni requiere alternar el modo avión manualmente ante cortes de red.



---

### FASE 2: Captura en Campo, Geometría y UX Móvil

#### Objetivos

Optimizar la velocidad de recolección de datos en campo por parcela y añadir capacidades de medición de geometrías (superficie/polígonos).

#### Tareas Técnicas

1. \*\*Módulo de Trazado de Geometría y Polígonos (\*Overlay\*):\*\*
\* Desarrollar motor de digitalización de parcelas para dibujar límites sobre la pantalla (\*polígonos/overlay\*).
\* Implementar cálculo automático de área ($\\text{m}^2$) y perímetro a partir de los vértices marcados.
\* Permitir el ingreso manual o la edición del valor de metros cuadrados en caso de no realizar el trazado gráfico.




2. \*\*Reorganización del Flujo de Captura Multifuncional (Unificación de Visita):\*\*
\* Rediseñar la interfaz móvil para permitir el registro unificado por parcela en \*\*una sola visita\*\* (capturar fachada, uso de suelo, servicios, drenajes y observaciones en el mismo momento).


\* Habilitar la opción de navegación por pestañas dentro de la misma ficha de la parcela para alternar entre categorías (\*Edificación\*, \*Servicios\*, \*Equipamiento\*).




3. \*\*Optimización de Entrada de Datos:\*\*
\* Reemplazar restricciones numéricas rígidas por campos de entrada flexibles (permitir enteros, decimales y rangos sin bloqueos).


\* Habilitar campos de texto amplio (\*textareas\*) para notas de campo u observaciones dinámicas.





#### Hitos de la Fase 2

\* \*\*\[Hito 2.1\]:\*\* Herramienta funcional de trazado de polígonos y cálculo automático de $\\text{m}^2$ integrada en el cliente móvil.


\* \*\*\[Hito 2.2\]:\*\* Formulario unificado de captura única por vivienda completado en $&lt;5\\text{ minutos}$ por parcela.



#### Checklist de Verificación (Fase 2)

\* \[ \] Es posible definir el contorno de una parcela mediante toque en pantalla o coordenadas.
\* \[ \] El sistema calcula y llena automáticamente los metros cuadrados del polígono trazado.


\* \[ \] El encuestador puede registrar fachada, servicios e infraestructura en la misma pantalla/visita sin cambiar de módulo principal.


\* \[ \] No existen bloqueos por longitud fija de caracteres en campos de descripción.


\* \[ \] Las opciones faltantes (\*Categoría: Infraestructura\* -&gt; iglesia, E/S, terminal) están disponibles.



---

### FASE 3: Estructuración Modular y Motor de Datos Dinámico

#### Objetivos

Proveer escalabilidad al sistema mediante la creación de módulos/submódulos independientes y personalizables por el cliente (estilo GIS/QGIS).

#### Tareas Técnicas

1. \*\*Motor de Campos Editables y Detección de Módulos (\*Schema Builder\*):\*\*
\* Construir un administrador de esquemas para que el usuario/administrador pueda crear, editar o eliminar campos personalizados por módulo (estilo QGIS).


\* Permitir la definición de tipos de datos por campo: lista desplegable, texto libre, entero, decimal, booleano.


2. \*\*Arquitectura de Módulos e Trabajo en Paralelo:\*\*
\* Estructurar el backend con submódulos independientes pero interconectados por la clave primaria de la parcela:
\* \*Módulo A: Urbanismo y Edificación\*.


\* \*Módulo B: Redes e Infraestructura\* (Acueductos, Drenajes, Cloacas, Electricidad).


\* \*Módulo C: Equipamiento y Servicios\* (Vialidad, Telecomunicaciones, Aseo).




\* Habilitar concurrencia: permitir que múltiples encuestadores registren simultáneamente diferentes módulos de una misma parcela en tiempo real o diferido.



#### Hitos de la Fase 3

\* \*\*\[Hito 3.1\]:\*\* Módulo administrativo web funcional para agregar/modificar campos del formulario sin desplegar nuevo código.


\* \*\*\[Hito 3.2\]:\*\* Soporte de registro concurrente de múltiples encuestadores sobre la misma entidad catastral.

#### Checklist de Verificación (Fase 3)

\* \[ \] El administrador puede crear un nuevo campo (ej. "Estado de Alcantarillado") desde la web y verlo reflejado en la app móvil.


\* \[ \] Las tablas de la base de datos soportan vinculación relacional/no relacional mediante el ID único de parcela.
\* \[ \] Se habilitó la lista completa de servicios: Acueductos, Drenajes, Cloacas, Electricidad, Vialidad, Telecomunicaciones, Aseo.



---

### FASE 4: Consolidación, Cruce de Datos y Backend Administrativo

#### Objetivos

Procesar, consolidar y analizar los datos recolectados por distintos equipos en campo, eliminando duplicidades.

#### Tareas Técnicas

1. \*\*Motor de Ingesta y Cruce de Datos:\*\*
\* Desarrollar módulo de importación y conciliación de archivos Excel/CSV generados por distintos encuestadores.


\* Crear algoritmo de detección de duplicados basado en proximidad geográfica (buffer de $2\\text{ metros}$) o ID de parcela.
\* Diseñar interfaz de resolución de conflictos para combinar registros de un mismo inmueble capturados por diferentes usuarios.




2. \*\*Tablero de Control (\*Dashboard\*) y Módulo de Análisis:\*\*
\* Implementar visualización en mapa de calor y capas de pines de los levantamientos realizados vs. pendientes (ej. 163 completados de 283).


\* Desarrollar motor de cálculo de saturación/déficit de equipamiento urbano y cobertura de servicios a partir de los datos consolidados.


\* Exportación de reportes tabulares y geográficos en formatos estándar (GeoJSON, Shapefile, Excel).





#### Hitos de la Fase 4

\* \*\*\[Hito 4.1\]:\*\* Algoritmo de consolidación e ingesta cruzada de matrices/Excel operativo sin colisión de datos.


\* \*\*\[Hito 4.2\]:\*\* Módulo de análisis de déficit/saturación de servicios generando reportes automáticos.



#### Checklist de Verificación (Fase 4)

\* \[ \] El sistema permite cargar múltiples archivos Excel de campo y cruzarlos sin borrar registros.


\* \[ \] El mapa del Dashboard diferencia visualmente parcelas completadas de las faltantes.


\* \[ \] Se generan indicadores automáticos de cobertura de agua, electricidad, aseo y drenajes.


\* \[ \] Opción de exportar la base de datos geográfica completa a Excel y GeoJSON.



---

### FASE 5: Optimización de Almacenamiento, Fuentes Cartográficas y Despliegue

#### Objetivos

Asegurar la viabilidad financiera del proyecto respecto al almacenamiento y disponibilizar capas base cartográficas actualizadas de forma legal.

#### Tareas Técnicas

1. \*\*Estrategia y Gestión de Almacenamiento Multimedia:\*\*
\* Adoptar arquitectura orientada a metadatos estructurados (priorizar texto/coordenadas para reducir costos).


\* \*Si se requiere captura fotográfica:\* implementar compresión agresiva en el dispositivo móvil (máximo $1920\\times1080$, calidad JPG 70%) antes del envío.
\* Configurar proveedor de almacenamiento en la nube de bajo costo mediante objetos (\*S3-Compatible / Bucket\*) con políticas de ciclo de vida.


2. \*\*Integración de Capas Cartográficas Actualizadas (Ortofotos / Fuentes Externas):\*\*
\* Configurar servidores de teselas basados en proveedores de software libre o fuentes externas con sustento legal/bibliográfico para superar el desfase de Google Maps.


\* Permitir la superposición de ortofotos o capas WMS/WMTS personalizadas sobre el mapa base del cliente móvil.




3. \*\*Despliegue y Pruebas de Carga:\*\*
\* Configuración de servidores de producción para la plataforma web y base de datos espacial (PostGIS / MongoDB 2dsphere).
\* Ejecución de pruebas de estrés con carga simulada de miles de entidades geográficas simultáneas.



#### Hitos de la Fase 5

\* \*\*\[Hito 5.1\]:\*\* Integración de capa de mapas base actualizados con respaldo de citación legal/bibliográfica.


\* \*\*\[Hito 5.2\]:\*\* Sistema desplegado en producción con arquitectura optimizada en costos de almacenamiento.

#### Checklist de Verificación (Fase 5)

\* \[ \] La carga de imágenes o archivos no satura el ancho de banda ni genera sobrecostos excesivos de almacenamiento.
\* \[ \] Las imágenes aéreas u ortofotos utilizadas permiten visualizar construcciones recientes no presentes en Google Maps.


\* \[ \] El sistema cuenta con la justificación legal/bibliográfica documentada para el uso de las fuentes cartográficas seleccionadas.


\* \[ \] Despliegue final verificado y listo para levantamientos masivos en campo.