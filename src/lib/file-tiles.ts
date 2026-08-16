/* ── corridor contents ────────────────────────────────────────────────────
 * What a person actually keeps a lifetime of files for: trips, the people they
 * went with, the food, the gigs, the pets, the graduations, the long drives.
 * The corridor is the argument for the product, so it has to look like a real
 * library rather than one stock theme repeated.
 *
 * Self-hosted from /public/photos rather than hotlinked, so the page owes
 * nothing to a third party at runtime: no extra DNS and TLS handshake before
 * the hero can paint, no CDN outage that empties the corridor, and no image
 * host added to the Content-Security-Policy of an origin that holds a Telegram
 * session key.
 *
 * Sizing note: the corridor draws exactly `cards` images (see ImageStreamHero
 * — it walks `images[i % length]` for i < cards), so any photo past that index
 * is downloaded by nobody. The list length and the card count are kept equal
 * on purpose. These are 800×1100, matching the 18:25 card ratio and their real
 * on-screen size; the four `wide-*` files are 1600px because the scroll
 * sequence expands them to fill the viewport.
 * ──────────────────────────────────────────────────────────────────────── */

type Photo = { src: string; alt: string }

const p = (name: string, alt: string): Photo => ({ src: `/photos/${name}.webp`, alt })

/* Alt text describes what is in the frame. The corridor itself is decorative
   and marked aria-hidden, but these records are reused where the description
   is read out, and an empty alt there would be a gap. */
export const CORRIDOR: Photo[] = [
  p('family-beach', 'A family running together into the sea on a bright day'),
  p('hikers-autumn', 'Hikers climbing a green mountain trail in autumn'),
  p('concert-night', 'A packed concert crowd lit from the stage'),
  p('pasta-dough', 'Hands shaping fresh pasta dough on a wooden table'),
  p('graduation-caps', 'Graduates throwing their caps in the air'),
  p('skate-venice', 'A skateboarder mid-trick at a beachfront skatepark'),
  p('berlin-rain', 'A city street at night, lights reflected in the wet road'),
  p('cat-sofa', 'A calico cat stretched out on a sofa'),
  p('desert-road', 'A car on a long, straight desert road seen from above'),
  p('dog-2', 'A young woman kneeling in a field at sunset, embracing a golden retriever'),
  p('mountains-misty', 'Mist rolling across a rugged mountain range'),
  p('breakfast-table', 'Breakfast bowls being topped with fruit and nuts on a sunlit table'),
  p('city-lighttrails', 'Long-exposure light trails along a city street at night'),
  p('mountain-village', 'Parents walking with their daughter through a mountain village'),
  p('utah-canyon', 'Desert canyons seen through a car window'),
  p('surf-family', 'A family carrying surfboards along the beach'),
]

/** Kept equal to CORRIDOR.length so every photo is actually used — and capped
    around sixteen, because past that the cards overlap so tightly that each one
    reads as a sliver rather than a photograph. */
export const CORRIDOR_CARDS = CORRIDOR.length

/** The four the scroll sequence converges on — wide, and high enough resolution
    to survive expanding to the full viewport. */
export const PHOTOS = {
  topLeft: '/photos/wide-mountains.webp',
  topRight: '/photos/wide-family.webp',
  bottomLeft: '/photos/wide-city.webp',
  bottomRight: '/photos/wide-concert.webp',
}

export const PHOTO_LIST = CORRIDOR
