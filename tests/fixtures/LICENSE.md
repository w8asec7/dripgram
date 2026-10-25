# Synthetic garment fixtures

These six fixtures are original synthetic illustrations created in this repository for deterministic image-pipeline and opt-in live API tests. No personal photographs or third-party product photographs are included. The first five derive from the project's original bundled garment art (see assets/LICENSE.md); patterned-shirt is original SVG artwork. Licensed under CC0-1.0. The black hoodie is a darkened synthetic fixture.

No fixture test activates a physical camera. Fixture analysis demonstrates request/persistence behavior; photographic recognition accuracy still requires user testing.

Phase 3 adds red-shirt.jpg and regenerates white-oversized-tshirt.jpg as unambiguously red/white original SVG art using scripts/generate-fixtures.cjs (CC0). The previous file named white-oversized-tshirt actually used cream (#e8e4d7) art, which Meta correctly identified as cream during live QA; that was a mislabeled test fixture, not evidence of the red-photo bug. All seven fixtures remain synthetic. Pixel checks corroborate a model-proposed garment region, not whole-image averages or calibrated confidence.
