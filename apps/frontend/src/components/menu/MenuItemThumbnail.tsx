import { resolveMediaUrl } from "@/lib/mediaUrl";

export type MenuItemThumbnailImage = {
  url: string;
  width?: number | null;
  height?: number | null;
};

type MenuItemThumbnailProps = {
  itemName: string;
  image?: MenuItemThumbnailImage | null;
  size?: "default" | "admin" | "sales";
};

export default function MenuItemThumbnail({
  itemName,
  image,
  size = "default",
}: Readonly<MenuItemThumbnailProps>) {
  const imageUrl = resolveMediaUrl(image?.url);
  const sizeClasses = size === "admin"
    ? "w-full max-w-[260px] shrink-0 self-start sm:w-[250px]"
    : size === "sales"
      ? "mx-auto mb-4 w-[88%]"
      : "mb-4 w-full";

  return (
    <div className={`aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-slate-700/60 ${sizeClasses}`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`Fotografía de ${itemName}`}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-medium text-slate-300">
          Sin imagen
        </div>
      )}
    </div>
  );
}
