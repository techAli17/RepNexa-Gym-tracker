# Exercise images: licence review

Status: **not shipped.** No third-party image is bundled. Each exercise shows an original front/back muscle map (`components/exercise/MuscleMap.tsx`) drawn from its listed muscles, and users can add their own photo.

## free-exercise-db (yuhonas/free-exercise-db)

Checked 2026-10-12 through the GitHub API and the repository README.

| Question | Finding |
| --- | --- |
| Declared licence | Unlicense (public-domain dedication), for the repository as a whole |
| Activity | Last push 2026-09-27, about 2,000 stars |
| Where the data comes from | The README says it restructures [wrkout/exercises.json](https://github.com/wrkout/exercises.json), which is also marked Unlicense |
| Where the **images** come from | Not documented in either repository. Neither names a photographer, illustrator or original source, and there is no per-image licence |

### Why the images are not bundled yet

A repository's licence only covers what its authors had the right to license. Neither repository says who created the photos or whether they had the right to dedicate them to the public domain. The upstream project now also points to a commercial dataset, which raises the question rather than settling it.

Shipping in a commercial app needs one of:

1. Written confirmation from the maintainers of where the images come from, and that they had the rights to dedicate them to the public domain, or
2. Images commissioned or drawn for RepNexa, or
3. Images from a source with a clear licence and named author (for example CC0 or CC BY with attribution).

The **text data** (names, muscles, equipment) is low-risk under the Unlicense and could be used to grow the catalog. RepNexa's built-in instructions are original text either way.

## When images are added

- Bundle them at build time (no runtime downloads), resized to about 600 px WebP.
- Generate `src/data/exercises/imageManifest.ts` that maps `imageKey` to `require()`d assets. `Exercise.imageKey` already exists; `null` keeps today's icon fallback.
- Map new catalog entries onto the existing built-in exercise IDs. Never change an ID: logged workouts and backups refer to them.
- List the source, author and licence for each image set under Settings → About → Exercise illustrations.
