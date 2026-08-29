#!/usr/bin/env python3
"""
Generate pictures from text, and record what they do and do not claim.

    .venv/Scripts/python.exe tools/gen-image.py italy-wine --list
    .venv/Scripts/python.exe tools/gen-image.py italy-wine barolo-hills --candidates 4
    .venv/Scripts/python.exe tools/gen-image.py italy-wine --accept barolo-hills=2

Prompts live in content/<pack>/image-prompts.json, versioned with the pack, so
"what did we ask for" survives the person who asked.

Candidates land in <project>/image-candidates/<pack>/<id>/ — top level, in
plain English, gitignored. Same reasoning as sound-candidates: they get opened
by hand, and hunting for them under content/<pack>/media/_candidates or in
AppData was hopeless. Nothing enters the pack until one is named with
--accept.


NOT A PYTHON MODEL STACK
------------------------

This shells out to stable-diffusion.cpp's sd-cli.exe, the way narrate.py
shells out to ffmpeg. It is deliberately NOT the diffusers + PyTorch route
that .venv-audio and .venv-moss took: there is no fourth venv, no 3 GB of
torch, and no from_pretrained to ignore torch_dtype and silently spill 10 GB
into system RAM. Read the header of gen-sound.py for what that cost.

Binary and weights live OUTSIDE the repo, beside it:

    ../sd-cpp/bin/sd-cli.exe
    ../sd-cpp/models/{diffusion_models,text_encoders,vae}/

Override with FORTELL_SDCPP if they are somewhere else.


LICENCE
-------
FLUX.2-klein-4B, Qwen3-4B and the FLUX.2 VAE are all Apache 2.0, so an
accepted picture carries no restriction and the build stays commercially
usable — the same bar MOSS clears for sound.

Beware the neighbours. FLUX.2-klein-9B and FLUX.2-dev are both under the FLUX
Non-Commercial Licence, and that is routinely described as "open for
commercial use" by conflating OUTPUT rights with MODEL-DEPLOYMENT rights.
Only klein-4B is genuinely unrestricted. Check the LICENSE file, never a
summary of it; this is the AudioGen lesson one model family over.


THE THING THIS TOOL IS ACTUALLY FOR
-----------------------------------

Nine images were generated to decide whether any of this was worth building.
Every single defect in them was semantic, not visual:

    asked for a redoubt (a raised bank) -> got a pit dug into the ground
    asked for a bottle with NO label    -> got a label, full of gibberish
    asked for A bottle and a glass      -> got two bottles
    asked for Nebbiolo grapes           -> got generic dark grapes
    asked for an 18th-century hillside  -> got a steamboat behind it
                                        -> and hallucinated signatures, twice

The model draws far better than it reasons. So:

  · `claims` and `omits` are REQUIRED on every accepted picture, and
    check-data.py fails without them. `omits` is the one that earns its
    place: it is where "this is not actually Nebbiolo" gets written down,
    beside the picture, where the next person will read it.

  · the candidate review is a subject-literate job, not an aesthetic one. Of
    two candidates for the same corrected prompt, the prettier painting was
    the one with the steamboat in it. Nothing about its beauty flagged that.

FOUR REFUSALS, and only the last is a matter of taste:

  1. A face of a real named person. The packs already ship two men faceless
     rather than use a doubtful photograph; inventing one is worse.
  2. Legible text — labels, signage, inscriptions, appellations, trademarks.
     An invented battle is an illustration; an invented Barolo label is a
     forgery, and no badge fixes a forgery. This also happens to forbid
     exactly what diffusion models are worst at.
  3. The identifying detail the story is asserting: the grape variety, the
     fortification's shape, the ship's rig, the uniform.
  4. Anything photographic in a pack whose pack.json sets allowPhoto false.

Refusals 1, 2 and 4 are mechanical and live in this file. Refusal 3 cannot be
automated and is what `omits` exists to record.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SDCPP = os.environ.get("FORTELL_SDCPP",
                       os.path.join(os.path.dirname(ROOT), "sd-cpp"))

BACKEND = {
    "flux2-klein-4b": {
        "diffusion": "diffusion_models/flux-2-klein-4b-Q8_0.gguf",
        "llm": "text_encoders/Qwen3-4B-Q5_K_M.gguf",
        "vae": "vae/flux2-vae.safetensors",
        "steps": 4,
        "cfg": 1.0,
        "method": "flux2-klein-4b-Q8_0",
        "licence": "Apache-2.0",
        "credit": "Generated with FLUX.2-klein-4B (Black Forest Labs), "
                  "Apache 2.0, via stable-diffusion.cpp.",
        "source": "https://huggingface.co/black-forest-labs/FLUX.2-klein-4B",
    },
}

# fetch-media.py's numbers, and they have to be the same or an accepted
# picture sits at a different weight and sharpness from every archive plate
# beside it.
MAX_W = 1800
JPEG_Q = 84

# Square by default, NOT 16:9. The stage is mobile-first and portrait, and a
# 16:9 plate under `cover` on a phone shows about a quarter of its width --
# measured on the drawn torpedo boat, which arrived as a funnel and nothing
# else. Square crops acceptably in both orientations.
#
# `wide` is still here because an archive picture can be any shape and a cue
# may legitimately want one, but tools/check-plate-crop.py fails a generated
# picture below 45% visible, and `wide` is 30%. In practice: portrait.
ASPECTS = {
    "square":   (1024, 1024),
    "portrait": (896, 1152),
    "wide":     (1152, 640),
}

# THE BOTTOM FIFTH OF EVERY PICTURE IS FURNITURE.
#
# Measured on the running app at 390x844: the caption box starts at y=674 and
# the transport at y=746, so the bottom 20% of the stage is covered — and the
# plate is full-bleed behind both. A portrait picture shows its whole height,
# so the bottom fifth of the FILE is the bottom fifth of the SCREEN.
#
# It was reported the only way it could be: "the yeast of all ingredients is
# behind the caption". The four ingredients ran top to bottom down the frame
# and the last one landed under the subtitles. Nothing was wrong with the
# picture; it was composed for a frame that is not the one it is shown in.
#
# So every prompt carries this, appended the way `style` is, rather than left
# to whoever writes the next one to remember. A prompt may opt out with
# `"safeBottom": false` — a texture, a wall, a field of grain has no subject
# to keep out of the way, and telling the model to leave a quarter of it empty
# would just waste the frame.
SAFE_BOTTOM = ("composition: the subject sits in the upper two thirds of the frame, "
               "the lower quarter is plain empty surface with nothing important in it")

# Asking for these is asking for refusal 2. Not a spell-check of the output --
# the review pass catches text that appears uninvited -- but a prompt that
# requests text is refused before a GPU is warmed up.
TEXT_WORDS = re.compile(
    r"\b(label|labell?ed|sign|signage|signpost|text|writing|written|lettering|"
    r"inscription|inscribed|logo|brand|branded|trademark|banner|poster|"
    r"newspaper|headline|billboard|menu|price\s?tag|certificate|"
    r"docg|doc\b|denominazione|appellation)\b", re.I)

PHOTO_WORDS = re.compile(
    r"\b(photo|photograph|photographic|photorealistic|dslr|35mm|"
    r"kodak|polaroid|film\s?still|documentary\s?photo)\b", re.I)


class GpuLock:
    """One generation run at a time, per machine.

    Two sd-cli processes on one 8 GB card do not queue and do not OOM
    cleanly. They die with

        CUDA error: unspecified launch failure
          in ggml_cuda_flash_attn_ext_mma_f16_case

    which reads like a driver fault or a broken build, and is neither -- it is
    simply two processes asking for the same shared memory. Cost: a whole
    batch of six prompts, silently, because each failure is one line in a log
    nobody was watching. A lock is cheaper than recognising that twice.
    """

    def __init__(self):
        self.path = os.path.join(ROOT, "image-candidates", ".gpu-lock")

    def __enter__(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        try:
            fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            age = time.time() - os.path.getmtime(self.path)
            if age < 3600:
                die(f"another gen-image run holds the GPU "
                    f"({age / 60:.0f} min old). Two sd-cli processes on one "
                    f"card fail with a CUDA launch error that looks like a "
                    f"driver fault. Wait for it, or delete {self.path} if it "
                    f"is stale.")
            os.unlink(self.path)
            fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.write(fd, str(os.getpid()).encode())
        os.close(fd)
        return self

    def __exit__(self, *exc):
        try:
            os.unlink(self.path)
        except OSError:
            pass


def die(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(2)


def pack_dir(pack: str) -> str:
    d = os.path.join(ROOT, "content", pack)
    if not os.path.isdir(d):
        die(f"no pack at {d}")
    return d


def jload(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def jdump(path, obj):
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=1)
        fh.write("\n")


def prompts_for(pack: str) -> dict:
    p = os.path.join(pack_dir(pack), "image-prompts.json")
    d = jload(p)
    if d is None:
        die(f"no {p} — nothing to generate")
    return {k: v for k, v in d.items() if not k.startswith("//")}


def check_refusals(pack: str, pid: str, spec: dict) -> list:
    """The three mechanical refusals. Returns reasons; empty means allowed."""
    bad = []
    prompt = f"{spec.get('prompt', '')} {spec.get('style', '')}"

    # A NEGATED MENTION IS THE CAREFUL CASE, not the dangerous one. "no labels
    # at all", "nothing written anywhere in frame" — that is a prompt trying to
    # keep text OUT, and refusing it taught the writer to stop saying so, which
    # is the opposite of what this guard is for. Found on the first prompt that
    # was deliberately careful about it. Only a mention with no negation in
    # front of it counts.
    NEG = r"(?:no|not|without|nothing|never|free of|absent|un)\s*"
    hit = None
    for m in TEXT_WORDS.finditer(prompt):
        before = prompt[max(0, m.start() - 40):m.start()].lower()
        if re.search(NEG + r"[\w\s,]{0,24}$", before):
            continue
        hit = m
        break
    if hit:
        bad.append(
            f"prompt asks for legible text ({hit.group(0)!r}). An invented "
            f"battle is an illustration; an invented label is a forgery. "
            f"Compose so the text is not in frame.")

    manifest = jload(os.path.join(pack_dir(pack), "pack.json"), {}) or {}
    allow_photo = (manifest.get("media", {})
                           .get("generated", {})
                           .get("allowPhoto", False))
    hit = PHOTO_WORDS.search(prompt)
    if hit and not allow_photo:
        bad.append(
            f"prompt asks for a photograph ({hit.group(0)!r}) and this pack "
            f"sets allowPhoto false. A plate that looks like a record IS a "
            f"record to a sixteen-year-old.")

    people = jload(os.path.join(pack_dir(pack), "people.json"), []) or []
    blob = f"{pid} {prompt} {spec.get('claims','')}".lower()
    for person in people:
        if not isinstance(person, dict):
            continue
        names = [person.get("id", "")]
        name = person.get("name") or {}
        if isinstance(name, dict):
            names += [str(v) for v in name.values()]
        for n in names:
            n = str(n).strip().lower()
            if len(n) > 3 and re.search(rf"\b{re.escape(n)}\b", blob):
                bad.append(
                    f"names the real person {person.get('id')!r} — faces of "
                    f"named people are never generated")
                break
        else:
            continue
        break
    return bad


def sd_paths(backend: str):
    b = BACKEND[backend]
    exe = os.path.join(SDCPP, "bin", "sd-cli.exe")
    if not os.path.exists(exe):
        die(f"no sd-cli at {exe} — set FORTELL_SDCPP, or see this file's header")
    out = {"exe": exe}
    for key in ("diffusion", "llm", "vae"):
        p = os.path.join(SDCPP, "models", b[key])
        if not os.path.exists(p):
            die(f"missing weights: {p}")
        out[key] = p
    return out


def full_prompt(spec: dict) -> str:
    """What actually goes to the model — and what `--accept` compares against.

    One function, because the two were assembled separately and drifted the
    first time anything was appended to the prompt.
    """
    style = spec.get("style") or ""
    prompt = spec["prompt"] + (", " + style if style else "")
    if spec.get("safeBottom", True):
        prompt += ", " + SAFE_BOTTOM
    return prompt


def generate(pack, pid, spec, n, backend, seed0):
    b = BACKEND[backend]
    paths = sd_paths(backend)
    w, h = ASPECTS.get(spec.get("aspect", "square"), ASPECTS["square"])
    prompt = full_prompt(spec)

    outdir = os.path.join(ROOT, "image-candidates", pack, pid)
    os.makedirs(outdir, exist_ok=True)
    made = []
    for i in range(n):
        seed = seed0 + i
        dest = os.path.join(outdir, f"{i + 1:02d}-seed{seed}.png")
        cmd = [
            paths["exe"],
            "--diffusion-model", paths["diffusion"],
            "--vae", paths["vae"],
            "--llm", paths["llm"],
            "-p", prompt,
            "--cfg-scale", str(b["cfg"]),
            "--steps", str(spec.get("steps", b["steps"])),
            "--auto-fit",            # NOT --offload-to-cpu; see below
            "--diffusion-fa",
            "-W", str(w), "-H", str(h),
            "--seed", str(seed),
            "-o", dest,
        ]
        print(f"  [{i + 1}/{n}] seed {seed} … ", end="", flush=True)
        r = subprocess.run(cmd, capture_output=True, text=True)
        log = (r.stdout or "") + (r.stderr or "")

        # The CUDA build without the separate cudart pack does not ERROR. It
        # prints "no usable GPU devices", loads the CPU backend and runs at
        # 53 s/step instead of 17 -- which reads exactly like "too small a
        # card" and is not. That is the MOSS bug wearing different clothes,
        # and the only reason it was caught is that the load line reports
        # where the weights went. Refuse rather than take four minutes a
        # picture and let someone conclude the GPU is too small.
        m = re.search(r"total params memory size.*?VRAM ([\d.]+)MB", log)
        if m and float(m.group(1)) == 0.0:
            die("all weights loaded to RAM, none to VRAM — the CUDA runtime "
                "DLLs are missing beside sd-cli.exe. Download the release's "
                "cudart-sd-bin-win-cu12-x64.zip and extract it into bin/. "
                "Without it this runs on the CPU at 3x the time and never "
                "says so.")
        if r.returncode != 0 or not os.path.exists(dest):
            print("FAILED")
            print(log[-1200:], file=sys.stderr)
            continue
        secs = re.search(r"generate_image completed in ([\d.]+)s", log)
        print(f"{secs.group(1)}s" if secs else "ok")
        made.append(dest)

    # WHAT THIS RUN MADE, and from what prompt. Without it --accept indexes a
    # DIRECTORY, and a directory accumulates: candidates are named 01..0N per
    # run, so a second render put 01-seed800 fourth in sorted order and
    # `--accept id=4` handed back a picture from the previous prompt — with the
    # new claims and omits written beside it. A record that says one thing over
    # a file that shows another is the exact defect claims/omits exist to stop.
    with open(os.path.join(outdir, "_run.json"), "w", encoding="utf-8") as fh:
        json.dump({"prompt": prompt,
                   "aspect": spec.get("aspect", "square"),
                   "backend": backend,
                   "files": [os.path.basename(f) for f in made]},
                  fh, ensure_ascii=False, indent=1)
    return outdir, made


def _warn_if_blank(path):
    """Say so if the picture just accepted reads as a blank screen.

    IMPORTS the check rather than copying its numbers. A threshold maintained
    in two places and visible in one is worse than a threshold nobody wrote
    down -- the same argument as engine/verbs.json, and as the stylesheet that
    outlived its renderer. tools/check-picture.py owns BRIGHT and FLAT.
    """
    import importlib.util
    from PIL import Image
    src = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "check-picture.py")
    try:
        spec = importlib.util.spec_from_file_location("check_picture", src)
        cp = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cp)
        im = cp.visible_crop(Image.open(path).convert("L"))
        bands = [cp.band_stats(im, i) for i in range(cp.BANDS)]
        bad = [i for i, (m, s) in enumerate(bands)
               if i >= cp.BANDS // 2 and m > cp.BRIGHT and s < cp.FLAT]
        if bad:
            m, s = bands[max(bad, key=lambda i: bands[i][0])]
            print(f"  WARNING: the lower part of this picture is blank paper "
                  f"— brightness {m:.0f}, detail {s:.0f}. On a phone, under "
                  f"the caption, that reads as the screen having stopped. "
                  f"Re-render with something in the bottom of the frame, or "
                  f"accept it knowingly.")
    except Exception:
        pass          # never let a warning break an accept


def accept(pack, pid, index, backend):
    from PIL import Image

    spec = prompts_for(pack).get(pid) or die(f"no prompt {pid!r}")
    for field in ("claims", "omits"):
        if not str(spec.get(field, "")).strip():
            die(f"{pid}: image-prompts.json must carry {field!r} before this "
                f"can be accepted — check-data.py will refuse it otherwise, "
                f"and it is the field that stops a beautiful picture making "
                f"a claim nobody checked")

    outdir = os.path.join(ROOT, "image-candidates", pack, pid)
    run_path = os.path.join(outdir, "_run.json")
    run = {}
    if os.path.exists(run_path):
        with open(run_path, encoding="utf-8") as fh:
            run = json.load(fh)

    # The SAME assembly the render used. Comparing against `prompt + style`
    # alone made every candidate look stale the moment SAFE_BOTTOM started
    # being appended — the guard that exists to stop a picture being paired
    # with somebody else's claims refused every picture instead.
    wanted = full_prompt(spec)

    if run:
        # This run's numbers, in this run's order. Anything else in the folder
        # belongs to an earlier prompt and is deliberately not offered.
        files = [f for f in run.get("files", [])
                 if os.path.exists(os.path.join(outdir, f))]
        stale = sorted(f for f in os.listdir(outdir)
                       if f.endswith(".png") and f not in files)
        if stale:
            print(f"  ({len(stale)} candidate(s) from an earlier render are in "
                  f"the folder and are not numbered here)")
        if run.get("prompt") != wanted:
            die(f"the candidates in {os.path.relpath(outdir, ROOT)} were made "
                f"from a different prompt than image-prompts.json carries now."
                f"\n  candidates: {run.get('prompt', '')[:100]}..."
                f"\n  prompt now: {wanted[:100]}..."
                f"\nRe-render before accepting: the picture and the claims "
                f"written beside it have to be about the same thing.")
    else:
        files = sorted(f for f in os.listdir(outdir)
                       if f.endswith(".png")) if os.path.isdir(outdir) else []
        if files:
            print("  (no _run.json: these candidates predate the manifest, so "
                  "the numbering is the folder's and may span several renders)")
    if not files:
        die(f"no candidates in {outdir}")
    if not 1 <= index <= len(files):
        die(f"pick 1..{len(files)}; got {index}")
    src = os.path.join(outdir, files[index - 1])

    media_dir = os.path.join(pack_dir(pack), "media")
    os.makedirs(media_dir, exist_ok=True)
    dest = os.path.join(media_dir, f"{pid}.jpg")
    im = Image.open(src)
    im.thumbnail((MAX_W, MAX_W), Image.LANCZOS)
    im.convert("RGB").save(dest, "JPEG", quality=JPEG_Q, optimize=True,
                           progressive=True)

    b = BACKEND[backend]
    mp = os.path.join(pack_dir(pack), "media.json")
    media = jload(mp, {}) or {}
    entry = {
        "kind": "made",
        "file": f"{pid}.jpg",
        "fit": spec.get("fit", "cover"),
        "method": b["method"],
        "title": spec.get("title", {"no": pid, "en": pid}),
        "claims": spec["claims"],
        "omits": spec["omits"],
        "licence": b["licence"],
        "credit": b["credit"],
        "source": b["source"],
        "prompt": spec["prompt"],
    }
    media[pid] = entry
    jdump(mp, media)

    # AT THE DOOR, not in a report somebody runs later. SAFE_BOTTOM asks the
    # model to keep the subject in the upper two thirds, and for a year nobody
    # measured whether it did -- so a picture went in whose lower half was
    # plain white studio paper, and under a caption on a phone that is not
    # composition, it is a blank screen. It was reported as one.
    #
    # A warning and not a refusal: the number describes how a picture READS,
    # and a person accepting one can see it and disagree. What must not happen
    # again is nobody being told.
    _warn_if_blank(dest)

    kb = os.path.getsize(dest) // 1024
    print(f"accepted {files[index - 1]}  ->  {dest}  ({im.size[0]}x{im.size[1]}, {kb} KB)")
    print(f"  claims: {entry['claims']}")
    print(f"  omits : {entry['omits']}")


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pack")
    ap.add_argument("id", nargs="?")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--candidates", type=int, default=4)
    ap.add_argument("--seed", type=int, default=100)
    ap.add_argument("--backend", default="flux2-klein-4b", choices=sorted(BACKEND))
    ap.add_argument("--accept", metavar="ID=N")
    ap.add_argument("--all", action="store_true",
                    help="generate every prompt that has no picture yet")
    a = ap.parse_args()

    specs = prompts_for(a.pack)

    if a.list:
        media = jload(os.path.join(pack_dir(a.pack), "media.json"), {}) or {}
        for pid, spec in specs.items():
            have = "  in pack" if pid in media else ""
            bad = check_refusals(a.pack, pid, spec)
            mark = "  REFUSED" if bad else have
            print(f"{pid:<26}{spec.get('aspect','square'):<10}{mark}")
            for r in bad:
                print(f"    ! {r}")
        return 0

    if a.accept:
        pid, _, n = a.accept.partition("=")
        accept(a.pack, pid, int(n or 1), a.backend)
        return 0

    todo = [a.id] if a.id else list(specs)
    if a.all:
        media = jload(os.path.join(pack_dir(a.pack), "media.json"), {}) or {}
        todo = [p for p in specs if p not in media]
    with GpuLock():
      for pid in todo:
        spec = specs.get(pid)
        if not spec:
            die(f"no prompt {pid!r} in image-prompts.json")
        bad = check_refusals(a.pack, pid, spec)
        if bad:
            print(f"{pid}: REFUSED")
            for r in bad:
                print(f"  ! {r}")
            continue
        print(f"{pid}  ({spec.get('aspect','square')})")
        outdir, made = generate(a.pack, pid, spec, a.candidates, a.backend, a.seed)
        print(f"  -> {outdir}  ({len(made)} candidates)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
