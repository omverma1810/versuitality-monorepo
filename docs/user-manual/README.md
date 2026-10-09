# Versuitality user manual

`Versuitality-User-Manual.pdf` is the illustrated manual for the atelier's team (42 pages, 75 figures).
Everything here is generated from the running application, so it can be refreshed whenever the UI changes.

| File | What it is |
| --- | --- |
| `Versuitality-User-Manual.pdf` | The manual (generated; shared out-of-band, not committed) |
| `manifest.json` | Screenshot catalogue (id, caption, section, role) |
| `build-manual.mjs`, `build.sh` | HTML -> PDF builder (two passes, so the contents page has page numbers) |

Generated and not committed (re-create with the steps below): `images/` (screenshots), `videos/` (screen recordings),
`receipt.pdf`, `orders-export.xlsx`, the HTML copy.

## Regenerating

The walkthrough scripts in `apps/web/e2e-manual/` drive a real browser through every role and module against a
**local** stack seeded with fictional data (names, `@atelier.demo` emails). Never point them at production data.

```bash
# 1. a throwaway API database with the demo team + sample data (from apps/api)
python manage.py migrate
WALKTHROUGH_PASSWORD='choose-one' python manage.py shell < ../web/e2e-manual/seed_walkthrough.py
python manage.py seed_demo
daphne -p 8000 versuitality.asgi:application &

# 2. the web app (from apps/web)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 pnpm build && pnpm start &

# 3. record (screenshots + videos land in docs/user-manual/)
export WALKTHROUGH_PASSWORD='choose-one'
for part in a-client-journey b-workshop c-admin d-ops e-edit-cancel f-returning; do node e2e-manual/part-$part.mjs; done
python e2e-manual/grab_receipt.py            # needs: pip install pymupdf

# 4. build the PDF (needs: pip install pymupdf pillow)
bash ../../docs/user-manual/build.sh
```

Videos are recorded as WebM (captions and a cursor are overlaid); convert with `ffmpeg` for sharing.
