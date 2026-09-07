import { API_BASE_URL } from "@/config/apiBaseUrl";

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;

export function resolveMediaUrl(
  mediaUrl: string | null | undefined,
  apiBaseUrl = API_BASE_URL,
): string | null {
  if (!mediaUrl) return null;
  if (ABSOLUTE_URL_PATTERN.test(mediaUrl) || mediaUrl.startsWith("blob:")) {
    return mediaUrl;
  }

  return `${apiBaseUrl.replace(/\/+$/, "")}/${mediaUrl.replace(/^\/+/, "")}`;
}
