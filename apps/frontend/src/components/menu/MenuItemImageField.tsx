"use client";

import { ChangeEvent, useEffect, useId, useRef, useState } from "react";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export const MAX_MENU_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const ALLOWED_FILE_EXTENSION = /\.(?:jpe?g|png|webp)$/i;

export type MenuItemImageSummary = {
  assetId: number;
  url: string;
  width: number;
  height: number;
};

type MenuItemImageFieldProps = {
  itemName: string;
  currentImage?: MenuItemImageSummary | null;
  selectedFile: File | null;
  onSelectedFileChange: (file: File | null) => void;
  onDeleteCurrent?: () => void;
  disabled?: boolean;
  deleting?: boolean;
};

export default function MenuItemImageField({
  itemName,
  currentImage = null,
  selectedFile,
  onSelectedFileChange,
  onDeleteCurrent,
  disabled = false,
  deleting = false,
}: Readonly<MenuItemImageFieldProps>) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const displayedUrl = previewUrl || resolveMediaUrl(currentImage?.url);
  const accessibleName = itemName.trim() || "plato";

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_MENU_IMAGE_BYTES) {
      setValidationError("La imagen supera el tamaño máximo de 5 MB.");
      event.target.value = "";
      return;
    }
    const hasAllowedMimeType = !file.type || ALLOWED_MIME_TYPES.has(file.type.toLowerCase());
    if (!hasAllowedMimeType || !ALLOWED_FILE_EXTENSION.test(file.name)) {
      setValidationError("Formato no permitido. Usa JPG, PNG o WebP.");
      event.target.value = "";
      return;
    }

    setValidationError(null);
    onSelectedFileChange(file);
  };

  const discardSelectedFile = () => {
    setValidationError(null);
    if (inputRef.current) inputRef.current.value = "";
    onSelectedFileChange(null);
  };

  return (
    <section className="space-y-3" aria-labelledby={`${inputId}-title`}>
      <div>
        <h2 id={`${inputId}-title`} className="text-lg font-semibold text-slate-800">
          Imagen del plato
        </h2>
        <p className="text-sm text-slate-600">JPG, PNG o WebP · Máx. 5 MB</p>
      </div>

      <div className="aspect-[4/3] w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
        {displayedUrl ? (
          <img
            src={displayedUrl}
            alt={`Fotografía de ${accessibleName}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-500">
            <span aria-hidden="true" className="text-4xl">🍽️</span>
            <span className="text-sm font-medium">Sin imagen</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <label
          htmlFor={inputId}
          className={`inline-flex rounded-xl bg-[#001F3F] px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-[#003366]"
          }`}
        >
          {selectedFile || currentImage ? "Cambiar imagen" : "Seleccionar imagen"}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleFileChange}
          disabled={disabled}
        />

        {selectedFile && (
          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={discardSelectedFile}
            disabled={disabled}
          >
            Quitar imagen seleccionada
          </button>
        )}

        {!selectedFile && currentImage && onDeleteCurrent && (
          <button
            type="button"
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onDeleteCurrent}
            disabled={disabled || deleting}
          >
            {deleting ? "Eliminando..." : "Eliminar imagen"}
          </button>
        )}
      </div>

      {validationError && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {validationError}
        </p>
      )}
    </section>
  );
}
