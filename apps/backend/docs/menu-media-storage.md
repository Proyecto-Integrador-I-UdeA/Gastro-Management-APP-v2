# Almacenamiento de imágenes de menú

La implementación actual usa `MediaStorage` para mantener la lógica de menú
independiente del proveedor de archivos. El único driver disponible es `local` y
está destinado exclusivamente al desarrollo.

- `MEDIA_STORAGE_DRIVER=local` selecciona el driver local.
- `MEDIA_LOCAL_ROOT` define un directorio fuera del repositorio.
- `MEDIA_PUBLIC_BASE_URL` es opcional y antepone el origen público a las rutas
  `/menu-media/files/:storageKey`.
- Sin `MEDIA_LOCAL_ROOT`, el desarrollo local usa
  `<datos locales del usuario>/GastroManagement/media`, siempre fuera del
  repositorio. Las pruebas inyectan un directorio temporal aislado.

El driver local se rechaza cuando `NODE_ENV=production`. Un despliegue productivo
debe incorporar un driver durable de object storage mediante la misma interfaz;
el filesystem efímero de Railway no es almacenamiento durable.

Los archivos JPEG, PNG y WebP se conservan byte a byte: esta fase no recorta,
redimensiona ni recomprime imágenes. PostgreSQL guarda solamente metadatos,
checksum SHA-256 y la clave aleatoria de almacenamiento.

Los estados de `MediaAsset` permiten detectar trabajo pendiente:

- `UNATTACHED`: upload todavía no asociado; permite localizar uploads abandonados.
- `ATTACHED`: imagen principal actualmente asociada a un `MenuItem`.
- `PENDING_DELETE`: la referencia activa ya fue retirada y la eliminación física
  puede reintentarse de forma idempotente.
