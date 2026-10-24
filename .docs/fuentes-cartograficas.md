# Fuentes cartográficas: licencia, atribución y uso permitido

Este documento es el respaldo legal y bibliográfico de las fuentes que usa la
aplicación. La Fase 5 del plan lo exige: *"El sistema cuenta con la
justificación legal/bibliográfica documentada para el uso de las fuentes
cartográficas seleccionadas"*.

**Fecha de consulta de las licencias:** 24 de octubre de 2026.

---

## 1. OpenStreetMap — capas base

| | |
|---|---|
| Servicio | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` |
| Datos | OpenStreetMap contributors |
| Licencia | **Open Database License (ODbL) 1.0** — <https://opendatacommons.org/licenses/odbl/1-0/> |
| Licencia del código del servidor de teselas | OSM Tile Usage Policy: <https://operations.osmfoundation.org/policies/tiles/> |
| Atribución obligatoria | "© OpenStreetMap contributors" |
| Enlace en la atribución | <https://www.openstreetmap.org/copyright> |

**Lo que exige la política de uso de teselas y qué hace la app:**

- Cachear las teselas mientras el usuario navega está **permitido** — es lo
  que hace la regla de cache del service worker.
- El uso offline, el prefetch y los archivos de teselas para redistribuir
  están **prohibidos** contra los servidores de la OSMF. Por eso la app
  precachea tiles **propios**, que salen de un extract de OSM renderizado por
  nosotros y subido a nuestro propio blob storage.
- La atribución se muestra en el mapa, en cada capa.

## 2. OpenTopoMap — capa base alternativa (relieve)

| | |
|---|---|
| Servicio | `https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png` |
| Datos | OpenStreetMap contributors, SRTM |
| Licencia | **CC-BY-SA 3.0** — <https://creativecommons.org/licenses/by-sa/3.0/> |
| Atribución obligatoria | "Kartendaten: © OpenStreetMap-Mitwirkende, SRTM \| Kartendarstellung: © OpenTopoMap (CC-BY-SA)" |

Se usa como relieve. Es una capa secundaria y su política de uso pide no
generar carga excesiva; en la app es una capa opcional que el usuario elige
a mano, no la que se descarga sola.

## 3. Tiles propios — base del levantamiento

| | |
|---|---|
| Origen | Extract de OSM (Geofabrik) recortado al bbox del levantamiento |
| Renderizado | `tilemaker` + `mb-util` |
| Licencia | **ODbL 1.0**, por ser una obra derivada de los datos de OSM |
| Atribución obligatoria | La del propio levantamiento + la de OSM |
| Almacenamiento | Blob storage propio |

**La ODbL es copyleft**: si se distribuye una obra derivada —un shapefile, un
GeoJSON publicado— hay que mantener la licencia y la atribución. Por eso:

- La exportación incluye la atribución de OSM en las propiedades.
- Los archivos de exportación que se entregan a terceros deben llevar la
  atribución. El `.prj` del shapefile y las propiedades del GeoJSON la
  incluyen.

## 4. Ortofotos y capas del municipio — superposiciones

| | |
|---|---|
| Configuración | Variable de entorno `CAPAS_SUPERPUESTAS` (JSON) |
| Licencia | La que fije el convenio con la municipalidad o el organismo que provee la información |
| Atribución | La que indique ese convenio, en el campo `attribution` |

Las superposiciones se configuran **en el servidor**, no en el cliente: agregar
una ortofoto municipal es cambiar una variable de entorno, sin recompilar.

```json
[
  {
    "id": "ortofoto-2024",
    "label": "Ortofoto 2024",
    "url": "https://geoserver.municipalidad.gob.ve/geoserver/wms",
    "wmsLayers": "ortofoto_2024",
    "attribution": "Municipalidad de X — Ortofoto aérea 2024",
    "opacity": 0.8,
    "consultable": true
  }
]
```

**Antes de superponer una capa hay que confirmar el permiso de uso** con el
organismo que la provee. La política de la OSMF no alcanza para regular una
ortofoto municipal: es un convenio distinto, con sus propias condiciones
—attribución obligatoria, prohibiciones de redistribución, plazos de
vigencia.

La aplicación muestra la atribución de cada superposición activa en el panel
de capas, con el texto plano que se puede leer sin las etiquetas HTML.

## 5. Lo que la app garantiza

- **Atribución visible**: cada capa base y cada superposición lleva su
  atribución en el control de capas del mapa.
- **Sin bulk download contra terceros**: la app nunca pide teselas de OSMF
  fuera del viewport. La precarga del área se sirve **siempre** desde el blob
  propio.
- **Sin caché persistente de terceros**: el service worker cachea las teselas
  de terceros con un TTL de 30 días y una entrada máxima acotada. La política
  de OSMF exige cachear según las cabeceras del servidor o al menos 7 días.
- **Atribución en las exportaciones**: GeoJSON, Shapefile, CSV y Excel
  incluyen la referencia a la fuente.

## 6. Referencias

- Licencia ODbL 1.0: <https://opendatacommons.org/licenses/odbl/1-0/>
- OpenStreetMap Copyright: <https://www.openstreetmap.org/copyright>
- OSMF Tile Usage Policy: <https://operations.osmfoundation.org/policies/tiles/>
- CC BY-SA 3.0: <https://creativecommons.org/licenses/by-sa/3.0/>
- OpenTopoMap: <https://opentopomap.org/>
- Geofabrik (extracts de OSM): <https://download.geofabrik.de/>
- Microsoft Learn — Azure DocumentDB free tier: <https://learn.microsoft.com/azure/documentdb/free-tier>
