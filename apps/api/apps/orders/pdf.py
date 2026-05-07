"""ReportLab order receipt — premium-feeling Versuitality layout."""
from __future__ import annotations

from io import BytesIO
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from .models import Order, OrderStatus, PRODUCTION_FLOW

GOLD = colors.HexColor('#CBA624')
GOLD_SOFT = colors.HexColor('#F6EBB7')
NAVY = colors.HexColor('#261F53')
NAVY_SOFT = colors.HexColor('#3A2F6D')
INK = colors.HexColor('#0E0B22')
MUTED = colors.HexColor('#6B6890')
SURFACE = colors.HexColor('#FBF8EE')
LINE = colors.HexColor('#E0DACA')

STATUS_LABELS = dict(OrderStatus.choices)


def _styles():
    base = getSampleStyleSheet()
    base.add(ParagraphStyle('VSWordmark', fontName='Times-Bold', fontSize=22,
                            leading=24, textColor=GOLD, alignment=0,
                            spaceAfter=0, letterSpace=2))
    base.add(ParagraphStyle('VSStrap', fontName='Helvetica', fontSize=7,
                            textColor=GOLD, leading=8))
    base.add(ParagraphStyle('VSLabel', fontName='Helvetica', fontSize=7,
                            textColor=MUTED, leading=10, spaceAfter=1))
    base.add(ParagraphStyle('VSValue', fontName='Helvetica-Bold', fontSize=10,
                            textColor=INK, leading=13))
    base.add(ParagraphStyle('VSSection', fontName='Helvetica-Bold', fontSize=10,
                            textColor=NAVY, leading=12, spaceBefore=4,
                            spaceAfter=4))
    base.add(ParagraphStyle('VSBody', fontName='Helvetica', fontSize=9,
                            textColor=INK, leading=12))
    base.add(ParagraphStyle('VSMono', fontName='Courier-Bold', fontSize=10,
                            textColor=GOLD, leading=12))
    return base


def _draw_chrome(canv: Canvas, doc, order: Order) -> None:
    """Draw the page header / footer chrome on every page."""
    canv.saveState()
    width, height = A4

    # Top brand band
    band_h = 22 * mm
    canv.setFillColor(NAVY)
    canv.rect(0, height - band_h, width, band_h, stroke=0, fill=1)

    # Mark — gold V
    cx, cy = 18 * mm, height - band_h / 2
    canv.setStrokeColor(GOLD)
    canv.setLineWidth(2)
    canv.line(cx - 5 * mm, cy + 4 * mm, cx, cy - 5 * mm)
    canv.line(cx + 5 * mm, cy + 4 * mm, cx, cy - 5 * mm)
    canv.setLineWidth(1.2)
    canv.line(cx - 7 * mm, cy + 6 * mm, cx + 7 * mm, cy + 6 * mm)

    canv.setFont('Times-Bold', 16)
    canv.setFillColor(GOLD)
    canv.drawString(30 * mm, height - band_h / 2 - 1, 'VERSUITALITY')
    canv.setFont('Helvetica', 6)
    canv.setFillColor(GOLD_SOFT)
    canv.drawString(30 * mm, height - band_h / 2 - 6 * mm,
                    'BESPOKE · TAILORING')

    # Order id (top right)
    canv.setFillColor(GOLD)
    canv.setFont('Helvetica-Bold', 9)
    canv.drawRightString(width - 18 * mm, height - 9 * mm, 'ORDER')
    canv.setFont('Courier-Bold', 12)
    canv.drawRightString(width - 18 * mm, height - 16 * mm, order.order_id)

    # Bottom hairline + footer
    canv.setStrokeColor(LINE)
    canv.line(18 * mm, 22 * mm, width - 18 * mm, 22 * mm)
    canv.setFillColor(MUTED)
    canv.setFont('Helvetica', 7)
    canv.drawString(18 * mm, 14 * mm,
                    'Versuitality · Internal order receipt — please retain for your reference.')
    canv.drawRightString(width - 18 * mm, 14 * mm,
                         f'Page {canv.getPageNumber()}')

    canv.restoreState()


def _kv_table(rows: Iterable[tuple[str, str]], styles, col_widths=None):
    data = []
    for label, value in rows:
        data.append([
            Paragraph(label, styles['VSLabel']),
            Paragraph(value or '—', styles['VSValue']),
        ])
    t = Table(data, colWidths=col_widths or [40 * mm, 75 * mm])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
    ]))
    return t


def _items_table(order: Order, styles):
    header = [
        Paragraph('#', styles['VSLabel']),
        Paragraph('Garment', styles['VSLabel']),
        Paragraph('Fabric', styles['VSLabel']),
        Paragraph('Customization', styles['VSLabel']),
        Paragraph('Qty', styles['VSLabel']),
        Paragraph('Unit', styles['VSLabel']),
        Paragraph('Total', styles['VSLabel']),
    ]
    rows = [header]
    for i, li in enumerate(order.line_items.all(), 1):
        rows.append([
            Paragraph(str(i), styles['VSBody']),
            Paragraph(li.garment_type.title(), styles['VSValue']),
            Paragraph(li.fabric_description or '—', styles['VSBody']),
            Paragraph(li.customization_notes or '—', styles['VSBody']),
            Paragraph(str(li.quantity), styles['VSBody']),
            Paragraph(f'{li.unit_price:,.2f}', styles['VSBody']),
            Paragraph(f'{li.line_total:,.2f}', styles['VSValue']),
        ])
    t = Table(
        rows,
        colWidths=[8 * mm, 28 * mm, 35 * mm, 50 * mm, 12 * mm, 18 * mm, 22 * mm],
        repeatRows=1,
    )
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), GOLD),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [SURFACE, colors.white]),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return t


def _measurements_block(order: Order, styles):
    ms = order.measurement_set
    if ms is None:
        return Paragraph('No measurement set linked to this order.', styles['VSBody'])

    upper = [
        ('Length', ms.upper_length),
        ('Shoulder', ms.upper_shoulder),
        ('Sleeve', ms.upper_sleeve),
        ('½ Sleeve', ms.upper_half_sleeve),
        ('Chest', ms.upper_chest),
        ('Waist', ms.upper_waist),
        ('Hip', ms.upper_hip),
        ('Cuff', ms.upper_cuff),
        ('Collar', ms.upper_collar),
        ('Arms', ms.upper_arms),
    ]
    lower = [
        ('Length', ms.lower_length),
        ('Bottom', ms.lower_bottom),
        ('Knee', ms.lower_knee),
        ('Waist', ms.lower_waist),
        ('Hip', ms.lower_hip),
        ('Seat round', ms.lower_seat_round),
        ('Inseam', ms.lower_inseam),
        ('Thigh', ms.lower_thigh),
    ]

    def grid(title, items):
        cells = [
            Paragraph(f'<b><font color="{GOLD.hexval()}">{title}</font></b>',
                      styles['VSSection'])
        ]
        rows = [cells]
        pair_row = []
        for i, (label, val) in enumerate(items):
            txt = (
                f'<font name="Helvetica" color="{MUTED.hexval()}" size="7">{label}</font>  '
                f'<font name="Helvetica-Bold" color="{INK.hexval()}" size="10">'
                f'{val if val is not None else "—"}</font>'
            )
            pair_row.append(Paragraph(txt, styles['VSBody']))
            if (i + 1) % 5 == 0:
                rows.append(pair_row + [''] * (5 - len(pair_row)))
                pair_row = []
        if pair_row:
            rows.append(pair_row + [''] * (5 - len(pair_row)))
        t = Table(rows, colWidths=[33 * mm] * 5)
        t.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), GOLD_SOFT),
            ('LINEBELOW', (0, 0), (-1, -1), 0.3, LINE),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ]))
        return t

    blocks = [grid('Upper · shirt / kurta / blazer', upper), Spacer(1, 4),
              grid('Lower · trouser / pant', lower)]

    suit_lines = []
    if ms.suit_lapel_style or ms.suit_button_stance or ms.suit_vent:
        suit_lines.append(Spacer(1, 4))
        suit_text = '  ·  '.join(
            f'<b>{lbl}:</b> {val}'
            for lbl, val in (
                ('Lapel', ms.get_suit_lapel_style_display()),
                ('Buttons', ms.get_suit_button_stance_display()),
                ('Vent', ms.get_suit_vent_display()),
            ) if val
        )
        suit_lines.append(Paragraph(suit_text, styles['VSBody']))

    return blocks + suit_lines


def _timeline_table(order: Order, styles):
    rows = [[
        Paragraph('Status', styles['VSLabel']),
        Paragraph('Stamp', styles['VSLabel']),
    ]]
    for status in PRODUCTION_FLOW:
        ev = order.status_events.filter(to_status=status).order_by('created_at').first()
        when = ev.created_at.strftime('%d %b %Y · %H:%M') if ev else '—'
        is_current = status == order.status
        marker = '●' if ev else '○'
        color = GOLD if is_current else (NAVY if ev else MUTED)
        label_html = (
            f'<font color="{color.hexval()}">{marker}</font>  '
            f'<font color="{(GOLD if is_current else INK).hexval()}">'
            f'{STATUS_LABELS[status]}</font>'
        )
        rows.append([
            Paragraph(label_html, styles['VSBody']),
            Paragraph(when, styles['VSBody']),
        ])
    t = Table(rows, colWidths=[110 * mm, 60 * mm], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), GOLD),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, LINE),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t


def _totals_table(order, styles):
    rows = [
        [Paragraph('Subtotal', styles['VSLabel']),
         Paragraph(f'{order.subtotal:,.2f}', styles['VSValue'])],
        [Paragraph('Advance', styles['VSLabel']),
         Paragraph(f'{order.advance:,.2f}', styles['VSValue'])],
        [Paragraph('<b>Balance</b>', styles['VSLabel']),
         Paragraph(f'<b><font color="{GOLD.hexval()}">{order.balance:,.2f}</font></b>',
                   styles['VSValue'])],
    ]
    t = Table(rows, colWidths=[40 * mm, 35 * mm], hAlign='RIGHT')
    t.setStyle(TableStyle([
        ('LINEABOVE', (0, -1), (-1, -1), 0.6, GOLD),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    return t


def render_order_pdf(order: Order) -> bytes:
    buf = BytesIO()
    doc = BaseDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=30 * mm,
        bottomMargin=24 * mm,
        title=f'Versuitality Order {order.order_id}',
        author='Versuitality',
    )
    frame = Frame(
        doc.leftMargin,
        doc.bottomMargin,
        doc.width,
        doc.height,
        id='body',
    )
    doc.addPageTemplates([
        PageTemplate(
            id='main',
            frames=[frame],
            onPage=lambda canv, d: _draw_chrome(canv, d, order),
        )
    ])

    styles = _styles()
    story = []

    # Status banner
    status_label = STATUS_LABELS.get(order.status, order.status)
    banner = Table(
        [[
            Paragraph(
                f'<font color="{MUTED.hexval()}" size="7">CURRENT STATUS</font><br/>'
                f'<font color="{NAVY.hexval()}" size="14"><b>{status_label}</b></font>',
                styles['VSBody'],
            ),
            Paragraph(
                f'<font color="{MUTED.hexval()}" size="7">ORDER DATE</font><br/>'
                f'<font color="{INK.hexval()}" size="11"><b>'
                f'{order.created_at.strftime("%d %b %Y · %H:%M")}</b></font>',
                styles['VSBody'],
            ),
            Paragraph(
                f'<font color="{MUTED.hexval()}" size="7">DELIVERY</font><br/>'
                f'<font color="{INK.hexval()}" size="11"><b>'
                f'{order.delivery_date.strftime("%d %b %Y") if order.delivery_date else "TBD"}'
                f'</b></font>',
                styles['VSBody'],
            ),
        ]],
        colWidths=[70 * mm, 50 * mm, 50 * mm],
    )
    banner.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), GOLD_SOFT),
        ('LINEBELOW', (0, 0), (-1, -1), 1, GOLD),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(banner)
    story.append(Spacer(1, 8))

    # Client + meta
    client = order.client
    rows_left = [
        ('Client', client.full_name),
        ('Client ID', client.client_id),
        ('Mobile', client.mobile),
        ('Email', client.email or '—'),
    ]
    rows_right = [
        ('Order type', order.get_order_type_display()),
        ('Trial date', order.trial_date.strftime('%d %b %Y') if order.trial_date else '—'),
        ('Delivery date', order.delivery_date.strftime('%d %b %Y') if order.delivery_date else '—'),
        ('Created by', order.created_by.full_name if order.created_by else '—'),
    ]
    meta = Table(
        [[_kv_table(rows_left, styles), _kv_table(rows_right, styles)]],
        colWidths=[85 * mm, 85 * mm],
    )
    meta.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(meta)
    story.append(Spacer(1, 10))

    # Garments
    story.append(Paragraph('Garments', styles['VSSection']))
    story.append(_items_table(order, styles))
    story.append(Spacer(1, 6))
    story.append(_totals_table(order, styles))
    story.append(Spacer(1, 12))

    # Measurements
    story.append(Paragraph('Measurements', styles['VSSection']))
    story.extend(_measurements_block(order, styles))
    story.append(Spacer(1, 12))

    # Notes
    if order.notes:
        story.append(Paragraph('Notes', styles['VSSection']))
        story.append(Paragraph(order.notes.replace('\n', '<br/>'), styles['VSBody']))
        story.append(Spacer(1, 10))

    # Status timeline
    story.append(Paragraph('Status timeline', styles['VSSection']))
    story.append(_timeline_table(order, styles))

    doc.build(story)
    return buf.getvalue()
