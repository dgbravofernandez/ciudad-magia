// This file exists solely so the Next.js App Router client knows that
// /{clubSlug}/... paths are valid routes and doesn't return 404 before
// making the server request.  The middleware intercepts these requests
// and rewrites them to the canonical (non-slug) routes, so this page
// component is never actually rendered in practice.
export default function ClubSlugPassthrough() {
  return null
}
