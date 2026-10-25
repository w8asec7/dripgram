# Asset licenses and provenance

All active clothing/outfit imagery is real photography. No illustrated, animated or AI-generated fashion assets are used. The retired drawings are outside application assets in ignored local QA storage. Thread icon is a typographic app mark, not a fashion image.

## Licensed demo photographs

Downloaded October24,2026 from Pexels under the [Pexels License](https://www.pexels.com/license/), which permits app use and cropping/resizing. Attribution is provided voluntarily. No endorsement by depicted people, photographers or brands is implied. Demo accounts are fictional; these are not their actual posts. Representative closet/catalog photos are not photographs of a user's exact item. Real user uploads take precedence and are never overwritten.

Photos are bundled locally in `assets/photography`; runtime hotlinks are not required. JPEG derivatives are resized/compressed and garment-focused crops are recorded in `scripts/crop-fashion-photos.cjs`. No recoloring or generated content. Some exact fits, shades, fabrics and brands differ; representative labeling is shown in the app.

- **tee-cream** — [Daniel & Hannah Snipes / Pexels](https://www.pexels.com/photo/minimalist-fashion-flat-lay-of-white-t-shirt-37704838/).
- **tee-black** — [Hanna Pad / Pexels](https://www.pexels.com/photo/a-black-shirt-hanging-on-the-wall-8532616/).
- **tee-rose** — [MART PRODUCTION / Pexels](https://www.pexels.com/photo/orange-crew-neck-t-shirt-9558265/).
- **hoodie-sage** — [SHVETS production / Pexels](https://www.pexels.com/photo/a-man-wearing-a-green-hoodie-9775675/).
- **hoodie-grey** — [Maurício Mascaro / Pexels](https://www.pexels.com/photo/man-wearing-gray-hoodie-907863/).
- **pants-sand** — [Salomon Byuma / Pexels](https://www.pexels.com/photo/man-in-white-long-sleeves-and-beige-pants-9322977/).
- **pants-black** — [Amar Preciado / Pexels](https://www.pexels.com/photo/a-man-holding-a-black-pants-10217710/).
- **jeans-blue** — [Mica Asato / Pexels](https://www.pexels.com/photo/two-hanged-blue-stonewash-and-blue-jeans-1082528/).
- **jacket-olive** — [Darya Grey_Owl / Pexels](https://www.pexels.com/photo/young-tourist-in-olive-jacket-by-the-sea-27378027/).
- **jacket-rust** — [cottonbro studio / Pexels](https://www.pexels.com/photo/man-in-a-bright-orange-jacket-9222629/).
- **shirt-blue** — [MART PRODUCTION / Pexels](https://www.pexels.com/photo/blue-button-up-shirt-hanging-on-white-metal-bar-9558723/).
- **shirt-navy** — [dayong tien / Pexels](https://www.pexels.com/photo/dark-blue-shirt-on-hanger-22441317/).
- **sweater-oat** — [cottonbro studio / Pexels](https://www.pexels.com/photo/a-woman-in-beige-sweater-7760243/).
- **shorts-sand** — [Marcelo Dias / Pexels](https://www.pexels.com/photo/man-in-white-t-shirt-and-beige-shorts-holding-two-sticks-2287357/).
- **shoes-white** — [Hurrah suhail / Pexels](https://www.pexels.com/photo/photo-of-white-sneakers-11324525/).
- **shoes-brown** — [Jovie Pujadas Ladura / Pexels](https://www.pexels.com/photo/brown-leather-slip-on-shoes-near-wristwatch-8394709/).
- **bag-black** — [Ray Piedra / Pexels](https://www.pexels.com/photo/black-crossbody-bag-on-chair-1502217/).
- **cap-green** — [x / Pexels](https://www.pexels.com/photo/green-cap-and-smartphone-on-sand-12650833/).
- **look-formal** — [Eduardo Ordone / Pexels](https://www.pexels.com/photo/man-in-black-suit-standing-13360982/).
- **look-casual** — [Alexander Mass / Pexels](https://www.pexels.com/photo/young-woman-crossing-city-street-in-casual-outfit-34614494/).
- **look-smart** — [Salomon Byuma / Pexels](https://www.pexels.com/photo/man-in-white-long-sleeves-and-beige-pants-9322977/).
- **look-tonal** — [Elina Volkova / Pexels](https://www.pexels.com/photo/a-man-in-beige-sweater-and-beige-pants-12056637/).
- **look-street** — [mohamed abdelghaffar / Pexels](https://www.pexels.com/photo/man-wearing-checked-jacket-on-a-street-21701014/).
- **look-layered** — [Atahan Demir / Pexels](https://www.pexels.com/photo/man-in-denim-jacket-and-hoodie-standing-on-street-16166526/).
- **look-summer** — [Mustapha Damilola / Pexels](https://www.pexels.com/photo/casual-style-man-in-jacket-24561192/).
- **look-vintage** — [Wolrider YURTSEVEN / Pexels](https://www.pexels.com/photo/fashionable-man-in-vintage-streetwear-jacket-30615470/).

Machine-readable source/download URLs and license links: `assets/photography/sources.json`. Restore only from these permitted sources using `node scripts/fetch-fashion-photos.cjs` then `node scripts/crop-fashion-photos.cjs`; visually inspect any replacement. Do not restore the old illustration generator. Test-only synthetic color fixtures are not app imagery.

## Final demo polish additions — October25,2026

Licensed simple-outfit additions, downloaded and bundled with no external runtime dependency:

- **look-everyday** — [Matheus Bertelli / Pexels](https://www.pexels.com/photo/man-in-white-crew-neck-t-shirt-and-black-pants-3856022/).
- **look-hoodie** — [Lappen Fashion / Pexels](https://www.pexels.com/photo/man-wearing-gray-sweater-and-blue-denim-jeans-4295985/).
- **look-basics** — [Jhay NaLang Po / Pexels](https://www.pexels.com/photo/man-in-black-crew-neck-t-shirt-and-beige-pants-6539638/).
- **tee-blue-photo** — [Ali Babajahdi / Pexels](https://www.pexels.com/photo/a-blue-t-shirt-hanging-on-a-wall-22613978/). Representative graphic/fit only.
- **tee-red-photo** — [Jonathan Borba / Pexels](https://www.pexels.com/photo/portrait-of-man-wearing-red-t-shirt-19456417/). Garment-only crop; representative red/burgundy color and fit differ from the original QA item.

Only three exactly identified local demo QA garments and one identified QA clothing post receive substitute catalog imagery. Their original records are archived first in local app storage; their original files remain intact. Real-account uploads and other user-created demo records are untouched. Rishi's default demo avatar is a shoe photograph, not a claim that a stock model is Rishi. Fictional sample profiles use representative licensed photos.
