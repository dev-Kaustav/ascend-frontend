// Stock photographs for the categories, matched by category name, used until a category carries
// its own icon_url. All are from Unsplash (Unsplash License: free for commercial use, no
// attribution required):
//   puffs         dion armadi        https://unsplash.com/photos/o3pQFG1q8lA
//   roasted-nuts  Ella Olsson        https://unsplash.com/photos/yhDLCNAvt8k
//   namkeen       Gurth Bramall      https://unsplash.com/photos/GewInw_r1pI
//   dry-fruits    Naveena V          https://unsplash.com/photos/s5lqJZwadI0
const PHOTOS = [
  { match: /puff|ball|twist/, src: "/store/categories/puffs.jpg" },
  { match: /roasted|seed|chana/, src: "/store/categories/roasted-nuts.jpg" },
  { match: /namkeen|bhujia|mixture|sev/, src: "/store/categories/namkeen.jpg" },
  { match: /dry fruit|cashew|kaju/, src: "/store/categories/dry-fruits.jpg" }
];

export function categoryPhoto(name) {
  const key = String(name || "").toLowerCase();
  return PHOTOS.find((photo) => photo.match.test(key))?.src ?? null;
}
