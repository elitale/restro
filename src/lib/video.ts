/** Build an embeddable player URL for known providers, else null (link only). */
export const embedUrl = (url: string): string | null => {
  const youtube = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  if (youtube) {
    return `https://www.youtube.com/embed/${youtube[1]}`;
  }
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) {
    return `https://player.vimeo.com/video/${vimeo[1]}`;
  }
  return null;
};
