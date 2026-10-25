export function validateImageMetadata(input: {
  width: number;
  height: number;
  fileSize?: number;
  mimeType?: string | null;
}) {
  if (input.width < 1 || input.height < 1)
    throw new Error("This image could not be read. Choose another photo.");
  if (input.fileSize && input.fileSize > 10 * 1024 * 1024)
    throw new Error("Choose an image smaller than 10 MB.");
  if (input.mimeType && !input.mimeType.startsWith("image/"))
    throw new Error("Choose a photo, rather than a video or document.");
}
