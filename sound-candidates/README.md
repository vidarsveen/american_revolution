# Sound candidates

Generated sound effects waiting to be listened to. **Nothing in here is part
of the site** — this whole folder is gitignored. A candidate only reaches the
app when it is promoted with `--accept`, which copies it into
`content/<pack>/sound/` and writes its licence and prompt into
`content/<pack>/sound.json`.

## How to listen

Open a folder and play the **`.mp3`** files. They are:

- **looped three times** if the effect is a loop, so you can hear whether the
  join gives itself away;
- **loudness-matched** to each other, so you are comparing character rather
  than which one happens to be louder. Generators normalise nothing, and the
  first batch of hooves was judged "too quiet" when the real difference was a
  level and not a sound.

The `.wav` beside each one is the real 48 kHz file that `--accept` reads. The
`.json` records exactly what produced it — prompt, seed, model, licence — so
any candidate can be traced or regenerated.

`_synthesised/` holds the versions `sound/library.js` builds from code, for
comparison. Those are the fallback: no model, no licence, no download.

## Naming

    wind-mbare-2.mp3
    │    │     └── seed index
    │    └──────── tag, set with --tag: which wording produced it
    └───────────── the effect, and the folder it lives in

## Picking one

    python tools/gen-sound.py american-revolution --accept wind-mbare=2

That applies the loop crossfade, levels it to the same ceilings every
synthesised effect uses, and records the paperwork. A tagged candidate is
still filed under its base effect — `wind-mbare` becomes `wind`, because the
engine only knows the plain name.

## Making more

    .venv-moss/Scripts/python.exe tools/gen-sound.py american-revolution wind \
        --backend moss --candidates 2 --tag gusty --prompt "…"

Roughly 25 seconds a clip. See `tools/gen-sound.py` for the backends and the
licence position of each.
