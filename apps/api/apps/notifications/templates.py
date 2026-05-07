"""Premium-voice notification templates.

Each `Template` carries an email pair (subject + body) and a WhatsApp body.
Both versions render from the same string-format context so the messaging
stays consistent across channels.

Templates that should never be sent to the client (internal-only status
transitions) set `notify_client = False`. The dispatcher records nothing
in those cases — the in-app order timeline is the source of truth.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from apps.orders.models import OrderStatus


@dataclass(frozen=True)
class Template:
    key: str
    email_subject: str
    email_body: str
    whatsapp_body: str
    notify_client: bool = True


# ---------------------------------------------------------------------------
# Per-template content
# ---------------------------------------------------------------------------
TEMPLATES: dict[str, Template] = {
    'order_received': Template(
        key='order_received',
        email_subject='Welcome to Versuitality — your order {order_id} is in',
        email_body=(
            'Dear {client_first_name},\n\n'
            'Thank you for entrusting Versuitality with your next bespoke garment.\n\n'
            'We have received your order {order_id} and our master tailor will '
            'review your requirements shortly.\n\n'
            'Order summary\n'
            '— Garments: {garment_summary}\n'
            '{maybe_trial_line}'
            '{maybe_delivery_line}\n'
            "We will keep you updated at every stage of the journey. Should you "
            'need to reach us, simply reply to this email or visit the store.\n\n'
            'Warmly,\n'
            'The Versuitality team'
        ),
        whatsapp_body=(
            '✦ *Versuitality*\n\n'
            'Hello {client_first_name}, your order {order_id} is with us.\n\n'
            '*Garments:* {garment_summary}\n'
            '{maybe_trial_line_short}'
            "We'll keep you updated as your bespoke garment comes together."
        ),
    ),
    'requirements_noted': Template(
        key='requirements_noted',
        email_subject='Order {order_id} — your requirements have been noted',
        email_body=(
            'Dear {client_first_name},\n\n'
            'A quick note that our master tailor has reviewed your requirements '
            'for order {order_id} and is preparing to begin work.\n\n'
            "We'll be in touch as production progresses.\n\n"
            'Warmly,\n'
            'The Versuitality team'
        ),
        whatsapp_body=(
            '✦ *Versuitality*\n\n'
            'Order {order_id}: our master has reviewed your requirements and is '
            'preparing to begin work. More updates as we go.'
        ),
    ),
    'cutting_started': Template(
        key='cutting_started',
        email_subject='Order {order_id} — cutting has begun',
        email_body=(
            'Dear {client_first_name},\n\n'
            'Cutting has commenced on your bespoke garment ({order_id}). '
            'This is the first physical step toward bringing your piece to life.\n\n'
            "We'll write again as the stitching gets underway.\n\n"
            'Warmly,\n'
            'The Versuitality team'
        ),
        whatsapp_body=(
            '✦ *Versuitality*\n\n'
            "Cutting has begun on your order {order_id}. We'll let you know "
            'when stitching starts.'
        ),
    ),
    'stitching_in_progress': Template(
        key='stitching_in_progress',
        email_subject='Order {order_id} — stitching is underway',
        email_body=(
            'Dear {client_first_name},\n\n'
            'Your garment is now being stitched. We will share another update '
            'when it is ready for your trial fitting.\n\n'
            'Warmly,\n'
            'The Versuitality team'
        ),
        whatsapp_body=(
            '✦ *Versuitality*\n\n'
            'Your order {order_id} is now being stitched. Trial-ready update '
            'coming soon.'
        ),
    ),
    'ready_for_trial': Template(
        key='ready_for_trial',
        email_subject='Order {order_id} — your trial is ready',
        email_body=(
            'Dear {client_first_name},\n\n'
            'Your bespoke garment ({order_id}) is ready for trial. Please visit '
            'us at your convenience so we can ensure a perfect fit.\n\n'
            '{maybe_trial_line}'
            'Warmly,\n'
            'The Versuitality team'
        ),
        whatsapp_body=(
            '✦ *Versuitality*\n\n'
            'Order {order_id}: your trial is ready. Please drop by at your '
            'convenience for the fitting. {maybe_trial_line_short}'
        ),
    ),
    'alteration_in_progress': Template(
        key='alteration_in_progress',
        email_subject='Order {order_id} — alterations underway',
        email_body=(
            'Dear {client_first_name},\n\n'
            'We are applying the alterations noted during your trial. Your '
            'garment will be ready for final inspection shortly.\n\n'
            'Warmly,\n'
            'The Versuitality team'
        ),
        whatsapp_body=(
            '✦ *Versuitality*\n\n'
            "Alterations are underway on your order {order_id}. We'll write "
            'again once the final inspection is complete.'
        ),
    ),
    # ready_for_qc + qc_rejected are *internal* only — the client is shielded
    # from QA mechanics. The order timeline is the source of truth.
    'ready_for_qc': Template(
        key='ready_for_qc',
        email_subject='', email_body='', whatsapp_body='',
        notify_client=False,
    ),
    'qc_rejected': Template(
        key='qc_rejected',
        email_subject='', email_body='', whatsapp_body='',
        notify_client=False,
    ),
    'ready_for_delivery': Template(
        key='ready_for_delivery',
        email_subject='Order {order_id} — ready for collection',
        email_body=(
            'Dear {client_first_name},\n\n'
            'Your bespoke order {order_id} has cleared our final inspection and '
            'is ready for collection. We look forward to seeing you at the store.\n\n'
            'Warmly,\n'
            'The Versuitality team'
        ),
        whatsapp_body=(
            '✦ *Versuitality*\n\n'
            'Your order {order_id} is ready for collection. We look forward '
            'to seeing you at the store.'
        ),
    ),
    'delivered': Template(
        key='delivered',
        email_subject='Thank you for choosing Versuitality',
        email_body=(
            'Dear {client_first_name},\n\n'
            'Thank you for collecting order {order_id}. It has been a privilege '
            'to craft this piece for you.\n\n'
            'If our work has met your expectations, a kind word shared with '
            "those close to you means a great deal. And if there's anything we "
            'could do better, please tell us — we read every reply.\n\n'
            'Warmly,\n'
            'The Versuitality team'
        ),
        whatsapp_body=(
            '✦ *Versuitality*\n\n'
            'Thank you for collecting order {order_id}, {client_first_name}. '
            'It has been a privilege to craft this piece for you.\n\n'
            'A word shared with someone close to you would mean the world.'
        ),
    ),
}


# Map of OrderStatus → Template key. Used by the status-change dispatcher so
# the trigger pipeline stays a one-line lookup.
STATUS_TEMPLATE_MAP: dict[str, str] = {
    OrderStatus.REQUIREMENTS_NOTED: 'requirements_noted',
    OrderStatus.CUTTING_STARTED: 'cutting_started',
    OrderStatus.STITCHING_IN_PROGRESS: 'stitching_in_progress',
    OrderStatus.READY_FOR_TRIAL: 'ready_for_trial',
    OrderStatus.ALTERATION_IN_PROGRESS: 'alteration_in_progress',
    OrderStatus.READY_FOR_QC: 'ready_for_qc',
    OrderStatus.QC_REJECTED: 'qc_rejected',
    OrderStatus.READY_FOR_DELIVERY: 'ready_for_delivery',
    OrderStatus.DELIVERED: 'delivered',
}


def list_template_keys() -> Iterable[str]:
    return TEMPLATES.keys()
