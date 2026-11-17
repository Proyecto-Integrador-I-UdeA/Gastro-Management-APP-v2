# Almacenamiento de imágenes de menú

La implementación usa `MediaStorage` para mantener la lógica de menú
independiente del proveedor de archivos. `MEDIA_STORAGE_DRIVER` elige el
proveedor.

`local` es el driver de desarrollo:

- `MEDIA_LOCAL_ROOT` define un directorio fuera del repositorio.
- `MEDIA_PUBLIC_BASE_URL` es opcional y antepone el origen público a las rutas
  `/menu-media/files/:storageKey`.
- Sin `MEDIA_LOCAL_ROOT`, el desarrollo local usa
  `<datos locales del usuario>/GastroManagement/media`, siempre fuera del
  repositorio. Las pruebas inyectan un directorio temporal aislado.
- Se rechaza cuando `NODE_ENV=production`, porque el disco de Railway es efímero.

`r2` guarda los archivos en Cloudflare R2 y es el driver de producción:

- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_BUCKET_NAME` son obligatorias.
- `R2_ENDPOINT`, o en su lugar `R2_ACCOUNT_ID`, define el endpoint S3.
- `R2_PUBLIC_BASE_URL` es opcional. Si está presente, la URL de la imagen apunta
  al bucket público. Si falta, la imagen se sirve por `/menu-media/files/:storageKey`
  y el backend la lee desde R2.

Los archivos JPEG, PNG y WebP se conservan byte a byte: esta fase no recorta,
redimensiona ni recomprime imágenes. PostgreSQL guarda solamente metadatos,
checksum SHA-256 y la clave aleatoria de almacenamiento.

Los estados de `MediaAsset` permiten detectar trabajo pendiente:

- `UNATTACHED`: upload todavía no asociado; permite localizar uploads abandonados.
- `ATTACHED`: imagen principal actualmente asociada a un `MenuItem`.
- `PENDING_DELETE`: la referencia activa ya fue retirada y la eliminación física
  puede reintentarse de forma idempotente.
