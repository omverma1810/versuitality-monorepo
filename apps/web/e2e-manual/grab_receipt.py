"""Download the PDF receipt of the walkthrough order via the API and render page 1 as a manual figure.

   WALKTHROUGH_PASSWORD=... python grab_receipt.py   (needs: pymupdf)
"""
import json, os, pathlib, urllib.request
import pymupdf

OUT = pathlib.Path(os.environ.get('WT_OUT', pathlib.Path(__file__).resolve().parents[3] / 'docs' / 'user-manual'))
API = os.environ.get('WT_API', 'http://localhost:8000')
journey = json.loads((OUT / '.journey.json').read_text())

req = urllib.request.Request(f'{API}/api/auth/login/', data=json.dumps({'email': 'frontdesk@atelier.demo', 'password': os.environ['WALKTHROUGH_PASSWORD']}).encode(), headers={'Content-Type': 'application/json'})
token = json.load(urllib.request.urlopen(req))['tokens']['access']
req = urllib.request.Request(f"{API}/api/orders/{journey['orderId']}/pdf/", headers={'Authorization': f'Bearer {token}'})
data = urllib.request.urlopen(req).read()
(OUT / 'receipt.pdf').write_bytes(data)

page = pymupdf.open(stream=data, filetype='pdf')[0]
pix = page.get_pixmap(dpi=130)
(OUT / 'images').mkdir(exist_ok=True)
pix.save(OUT / 'images' / 'a20-receipt.png')

manifest = json.loads((OUT / 'manifest.json').read_text())
manifest['a20-receipt'] = {'file': 'a20-receipt.png', 'title': 'The printable PDF receipt', 'section': 'Creating an order', 'role': 'staff'}
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2))
print('receipt rendered', pix.width, 'x', pix.height)
