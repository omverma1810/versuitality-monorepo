"""Find the page of each chapter heading in the built PDF -> .toc-pages.json (second pass fills the contents page)."""
import json, pathlib, pymupdf

here = pathlib.Path(__file__).parent
sections = json.loads((here / '.sections.json').read_text())
doc = pymupdf.open(here / 'Versuitality-User-Manual.pdf')
pages, start = {}, 2  # skip cover (0) and contents (1)
for s in sections:
    for i in range(start, len(doc)):
        if s['title'][:24] in doc[i].get_text():
            pages[s['id']] = i + 1
            start = i
            break
(here / '.toc-pages.json').write_text(json.dumps(pages))
print(pages, 'pages total:', len(doc))
