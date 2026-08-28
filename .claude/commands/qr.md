---
description: Turn a URL — or whatever is on the clipboard — into a QR code to scan with a phone
argument-hint: "[url]  (leave empty to use the clipboard)"
allowed-tools: Bash(python tools/qr.py:*), Bash(.venv/Scripts/python.exe tools/qr.py:*), SendUserFile
---

Run the QR tool and hand the user the image.

```
!`.venv/Scripts/python.exe tools/qr.py $ARGUMENTS`
```

The tool wrote `shots/qr.png` and printed the URL it encoded.

**Send that PNG to the user with SendUserFile** (`display: "render"`, and put the
encoded URL in the caption) so they can scan it straight off the screen. Do not
paste the URL as text and stop there — typing a long URL on a phone is the
entire problem this command exists to solve.

Then say nothing else unless something went wrong.

If the tool reported an error:

- **nothing on the clipboard** — ask the user to copy the link first, or to pass
  it as an argument.
- **that does not look like a URL** — say what it received. The tool already
  repairs the common damage (a leading character lost on the way out of a
  terminal, a missing scheme), so anything it still refuses is genuinely not a
  URL.
- **pip install qrcode** — install it into `.venv` and run again.
