"""Shared definition of the QC checklist.

This is the single source of truth on the backend. The frontend mirrors the
order + labels in `apps/web/src/lib/qa.ts`. Changes here should be reflected
there.
"""
from __future__ import annotations

CHECKLIST_ITEMS: list[dict[str, str]] = [
    {
        'key': 'stitching_quality',
        'label': 'Stitching quality',
        'description': 'Consistent stitch length, no skipped stitches, secure backstitching.',
    },
    {
        'key': 'finishing',
        'label': 'Finishing',
        'description': 'Edges finished cleanly, no loose threads, hems tidy.',
    },
    {
        'key': 'measurement_match',
        'label': 'Measurements match',
        'description': 'Garment matches the captured measurements within tolerance.',
    },
    {
        'key': 'buttons_buttonholes',
        'label': 'Buttons & buttonholes',
        'description': 'Buttons securely attached, holes well finished, alignment clean.',
    },
    {
        'key': 'lining',
        'label': 'Lining inspection',
        'description': 'Lining sits flat, no bunching, attached cleanly to the shell.',
    },
    {
        'key': 'pressing',
        'label': 'Pressing & finish',
        'description': 'Garment is pressed without shine marks or scorching.',
    },
    {
        'key': 'fabric_defects',
        'label': 'Fabric integrity',
        'description': 'No visible defects, weaves, or pulls in the fabric.',
    },
]

ITEM_KEYS: set[str] = {item['key'] for item in CHECKLIST_ITEMS}

VALID_RESULTS: set[str] = {'pass', 'fail'}
