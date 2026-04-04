/** Extract a Google Drive file ID from any share URL format */
function extractDriveId(url: string): string | null {
  if (!url) return null
  // /d/FILE_ID format
  const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (m1) return m1[1]
  // ?id=FILE_ID or &id=FILE_ID format (Google Forms uploads, open?id=...)
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (m2) return m2[1]
  return null
}

/** Convert a Google Drive share link to a direct-view URL */
export function driveViewUrl(url: string): string {
  if (!url) return url
  const id = extractDriveId(url)
  return id ? `https://drive.google.com/file/d/${id}/view` : url
}

/** Convert a Google Drive share link to a direct CDN image URL */
export function driveImageUrl(url: string): string {
  if (!url) return url
  const id = extractDriveId(url)
  // lh3.googleusercontent.com/d/ works as direct <img> src for public Drive files
  return id ? `https://lh3.googleusercontent.com/d/${id}` : url
}
