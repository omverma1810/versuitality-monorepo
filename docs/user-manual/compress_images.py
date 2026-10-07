"""PNG screenshots -> .jpg/ (quality 84) so the PDF stays a shareable size."""
import pathlib
from PIL import Image
here = pathlib.Path(__file__).parent
out = here / '.jpg'; out.mkdir(exist_ok=True)
for p in (here / 'images').glob('*.png'):
    Image.open(p).convert('RGB').save(out / (p.stem + '.jpg'), quality=84, optimize=True)
