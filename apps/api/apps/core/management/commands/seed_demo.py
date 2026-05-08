"""Populate the database with realistic demo data for screenshots / testing.

Idempotent — run any time. Existing rows aren't touched; only the missing
pieces are filled in. Pass ``--fresh`` to wipe demo-tagged data first.

    docker compose exec api python manage.py seed_demo
    docker compose exec api python manage.py seed_demo --fresh
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Role, User
from apps.appointments.models import (
    Appointment,
    AppointmentKind,
    AppointmentStatus,
    NotifyVia,
)
from apps.crm.models import Client
from apps.inventory.models import Fabric, FabricPattern
from apps.measurements.models import MeasurementSet
from apps.orders.models import (
    Order,
    OrderLineItem,
    OrderStatus,
    OrderStatusEvent,
    OrderType,
)
from apps.orders.transitions import transition_order
from apps.qa.checklist import CHECKLIST_ITEMS
from apps.qa.models import QcInspection, QcOutcome


DEMO_TAG = 'demo:seeded'

FABRICS = [
    {
        'name': 'Italian Wool — Navy Pinstripe',
        'supplier': 'Reda',
        'color': 'Navy',
        'pattern': FabricPattern.STRIPE,
        'fabric_type': 'Wool',
        'quantity_meters': Decimal('38.5'),
        'low_stock_threshold': Decimal('6'),
        'cost_per_meter': Decimal('3200'),
        'price_per_meter': Decimal('5400'),
    },
    {
        'name': 'Egyptian Cotton — White',
        'supplier': 'Albini',
        'color': 'White',
        'pattern': FabricPattern.SOLID,
        'fabric_type': 'Cotton',
        'quantity_meters': Decimal('24'),
        'low_stock_threshold': Decimal('5'),
        'cost_per_meter': Decimal('1100'),
        'price_per_meter': Decimal('1850'),
    },
    {
        'name': 'Charcoal Glen Check',
        'supplier': 'Loro Piana',
        'color': 'Charcoal',
        'pattern': FabricPattern.CHECK,
        'fabric_type': 'Wool',
        'quantity_meters': Decimal('4'),  # low stock
        'low_stock_threshold': Decimal('5'),
        'cost_per_meter': Decimal('4800'),
        'price_per_meter': Decimal('7800'),
    },
    {
        'name': 'Linen — Stone',
        'supplier': 'Solbiati',
        'color': 'Stone',
        'pattern': FabricPattern.TEXTURED,
        'fabric_type': 'Linen',
        'quantity_meters': Decimal('18'),
        'low_stock_threshold': Decimal('5'),
        'cost_per_meter': Decimal('1600'),
        'price_per_meter': Decimal('2700'),
    },
    {
        'name': 'Silk Brocade — Maroon',
        'supplier': 'Banaras Mills',
        'color': 'Maroon',
        'pattern': FabricPattern.PRINT,
        'fabric_type': 'Silk',
        'quantity_meters': Decimal('11'),
        'low_stock_threshold': Decimal('4'),
        'cost_per_meter': Decimal('2200'),
        'price_per_meter': Decimal('3600'),
    },
]

CLIENTS = [
    {
        'full_name': 'Aarav Mehta',
        'mobile': '+919810010001',
        'email': 'aarav.mehta@example.com',
        'address': '12 Pali Hill, Mumbai',
        'age_group': '25_34',
        'occasion_preferences': ['business', 'wedding'],
        'fabric_preferences': ['wool', 'cotton'],
        'notes': 'Prefers slim taper, working buttonholes.',
    },
    {
        'full_name': 'Rohan Iyer',
        'mobile': '+919810010002',
        'email': 'rohan.iyer@example.com',
        'address': 'Koramangala, Bengaluru',
        'age_group': '35_44',
        'occasion_preferences': ['formal', 'casual'],
        'fabric_preferences': ['linen', 'cotton'],
        'notes': '',
    },
    {
        'full_name': 'Vikram Bose',
        'mobile': '+919810010003',
        'email': '',
        'address': 'Salt Lake, Kolkata',
        'age_group': '45_54',
        'occasion_preferences': ['ethnic', 'festive'],
        'fabric_preferences': ['silk', 'cotton'],
        'notes': 'Right shoulder slightly higher than left — note on every visit.',
    },
    {
        'full_name': 'Karan Malhotra',
        'mobile': '+919810010004',
        'email': 'karan.malhotra@example.com',
        'address': 'GK-II, Delhi',
        'age_group': '25_34',
        'occasion_preferences': ['wedding'],
        'fabric_preferences': ['wool', 'silk'],
        'notes': '',
    },
    {
        'full_name': 'Aditya Reddy',
        'mobile': '+919810010005',
        'email': 'aditya.reddy@example.com',
        'address': 'Banjara Hills, Hyderabad',
        'age_group': 'under_25',
        'occasion_preferences': ['casual', 'business'],
        'fabric_preferences': ['cotton', 'denim'],
        'notes': '',
    },
]

MEASUREMENT_DEFAULTS = dict(
    upper_length=30,
    upper_shoulder=18,
    upper_sleeve=24.5,
    upper_half_sleeve=10,
    upper_chest=42,
    upper_waist=36,
    upper_hip=40,
    upper_cuff=9,
    upper_collar=15.5,
    upper_arms=14,
    lower_length=42,
    lower_bottom=15,
    lower_knee=18,
    lower_waist=34,
    lower_hip=40,
    lower_seat_round=42,
    lower_inseam=31,
    lower_thigh=22,
)


# (status, walk_path) — the order is created in `order_received` and then
# walked forward through these transitions one at a time so each phase tile
# (production, trial, QC, delivery) lights up.
ORDER_RECIPES = [
    {
        'client_idx': 0,
        'fabric_idx': 0,
        'meters': Decimal('1.8'),
        'garment': 'suit',
        'unit_price': Decimal('38000'),
        'quantity': 1,
        'walk': [
            OrderStatus.REQUIREMENTS_NOTED,
            OrderStatus.CUTTING_STARTED,
            OrderStatus.STITCHING_IN_PROGRESS,
            OrderStatus.READY_FOR_TRIAL,
            OrderStatus.READY_FOR_QC,
            OrderStatus.READY_FOR_DELIVERY,
            OrderStatus.DELIVERED,
        ],
        'qc': 'pass',
    },
    {
        'client_idx': 1,
        'fabric_idx': 1,
        'meters': Decimal('2.4'),
        'garment': 'shirt',
        'unit_price': Decimal('4500'),
        'quantity': 2,
        'walk': [
            OrderStatus.REQUIREMENTS_NOTED,
            OrderStatus.CUTTING_STARTED,
            OrderStatus.STITCHING_IN_PROGRESS,
            OrderStatus.READY_FOR_TRIAL,
        ],
    },
    {
        'client_idx': 2,
        'fabric_idx': 4,
        'meters': Decimal('3.5'),
        'garment': 'sherwani',
        'unit_price': Decimal('48000'),
        'quantity': 1,
        'walk': [
            OrderStatus.REQUIREMENTS_NOTED,
            OrderStatus.CUTTING_STARTED,
            OrderStatus.STITCHING_IN_PROGRESS,
            OrderStatus.READY_FOR_TRIAL,
            OrderStatus.READY_FOR_QC,
        ],
    },
    {
        'client_idx': 3,
        'fabric_idx': 2,
        'meters': Decimal('1.6'),
        'garment': 'blazer',
        'unit_price': Decimal('29000'),
        'quantity': 1,
        'walk': [
            OrderStatus.REQUIREMENTS_NOTED,
            OrderStatus.CUTTING_STARTED,
            OrderStatus.STITCHING_IN_PROGRESS,
            OrderStatus.READY_FOR_TRIAL,
            OrderStatus.READY_FOR_QC,
            # QC fails — see below
        ],
        'qc': 'fail',
    },
    {
        'client_idx': 4,
        'fabric_idx': 3,
        'meters': Decimal('1.4'),
        'garment': 'trouser',
        'unit_price': Decimal('5800'),
        'quantity': 2,
        'walk': [
            OrderStatus.REQUIREMENTS_NOTED,
            OrderStatus.CUTTING_STARTED,
        ],
    },
    {
        'client_idx': 0,
        'fabric_idx': 1,
        'meters': Decimal('2.2'),
        'garment': 'shirt',
        'unit_price': Decimal('4200'),
        'quantity': 3,
        'walk': [
            OrderStatus.REQUIREMENTS_NOTED,
        ],
    },
]


class Command(BaseCommand):
    help = 'Seed realistic demo data so every screen has something to show.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fresh',
            action='store_true',
            help='Delete previously-seeded demo rows first.',
        )

    @transaction.atomic
    def handle(self, *args, **opts):
        if opts.get('fresh'):
            self._wipe()

        actor = self._actor()

        fabrics = self._seed_fabrics()
        clients, measurements = self._seed_clients_and_measurements(actor)
        self._seed_orders(actor, clients, fabrics, measurements)
        self._seed_appointments(actor, clients)

        self.stdout.write(self.style.SUCCESS('Demo data seeded ✦'))

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _actor(self) -> User | None:
        admin = (
            User.objects.filter(is_active=True, role=Role.ADMIN).order_by('created_at').first()
            or User.objects.filter(is_superuser=True, is_active=True).first()
        )
        if not admin:
            self.stdout.write(self.style.WARNING(
                'No active admin found — seed_owners first or pass `--activate-with-password`.'
            ))
        return admin

    def _wipe(self) -> None:
        # Demo rows are tagged via mobile prefix on clients; cascade removes
        # measurements + orders for them.
        n_clients = Client.objects.filter(mobile__startswith='+919810010').delete()
        n_fabrics = Fabric.objects.filter(name__in=[f['name'] for f in FABRICS]).delete()
        n_appts = Appointment.objects.filter(notes__contains=DEMO_TAG).delete()
        self.stdout.write(self.style.WARNING(
            f'Wiped demo data — clients/measurements/orders {n_clients}, fabrics {n_fabrics}, '
            f'appointments {n_appts}.'
        ))

    def _seed_fabrics(self) -> list[Fabric]:
        out: list[Fabric] = []
        for spec in FABRICS:
            fabric, created = Fabric.objects.get_or_create(
                name=spec['name'],
                defaults=spec,
            )
            out.append(fabric)
            mark = '+' if created else '·'
            self.stdout.write(f'  {mark} fabric {fabric.code} {fabric.name} ({fabric.quantity_meters} m)')
        return out

    def _seed_clients_and_measurements(self, actor) -> tuple[list[Client], list[MeasurementSet]]:
        clients: list[Client] = []
        measurements: list[MeasurementSet] = []
        for spec in CLIENTS:
            client, created = Client.objects.get_or_create(
                mobile=spec['mobile'],
                defaults={**spec, 'created_by': actor},
            )
            clients.append(client)
            mark = '+' if created else '·'
            self.stdout.write(f'  {mark} client {client.client_id} {client.full_name}')

            ms = client.measurements.first()
            if ms is None:
                ms = MeasurementSet.objects.create(
                    client=client,
                    garment_types=['shirt', 'trouser'],
                    garment_count=2,
                    fabric_details='Demo intake measurements',
                    customization_notes=spec.get('notes', ''),
                    created_by=actor,
                    **MEASUREMENT_DEFAULTS,
                )
                self.stdout.write(f'    + measurement set @ {ms.created_at:%Y-%m-%d %H:%M}')
            measurements.append(ms)
        return clients, measurements

    def _seed_orders(
        self,
        actor,
        clients: list[Client],
        fabrics: list[Fabric],
        measurements: list[MeasurementSet],
    ) -> None:
        from apps.notifications.services import notify_order_created

        for recipe in ORDER_RECIPES:
            client = clients[recipe['client_idx']]
            fabric = fabrics[recipe['fabric_idx']]
            ms = measurements[recipe['client_idx']]

            # Avoid creating duplicate orders on re-runs — heuristic: skip
            # if this client already has an order for the same garment in
            # the last seven days.
            recent = client.orders.filter(
                line_items__garment_type=recipe['garment'],
                created_at__gte=timezone.now() - timedelta(days=7),
            ).exists()
            if recent:
                self.stdout.write(f'  · skip (recent order exists) {client.full_name}')
                continue

            unit_price = recipe['unit_price']
            qty = recipe['quantity']
            order = Order.objects.create(
                client=client,
                measurement_set=ms,
                order_type=OrderType.FULL,
                status=OrderStatus.ORDER_RECEIVED,
                trial_date=(timezone.localdate() + timedelta(days=5)),
                delivery_date=(timezone.localdate() + timedelta(days=18)),
                subtotal=unit_price * qty,
                advance=(unit_price * qty) // 3,
                notes=f'Seeded by seed_demo · {DEMO_TAG}',
                created_by=actor,
            )
            OrderLineItem.objects.create(
                order=order,
                garment_type=recipe['garment'],
                fabric_description=fabric.name,
                fabric=fabric,
                meters_used=recipe['meters'],
                quantity=qty,
                unit_price=unit_price,
            )
            # Initial status event so the timeline has an entry.
            OrderStatusEvent.objects.create(
                order=order,
                from_status='',
                to_status=OrderStatus.ORDER_RECEIVED,
                actor=actor,
            )
            # Notification for created order
            try:
                notify_order_created(order)
            except Exception:
                pass

            # Walk it through the recipe's transitions.
            for target in recipe['walk']:
                try:
                    transition_order(order=order, target=target, actor=actor, reason='')
                except Exception as exc:
                    self.stdout.write(self.style.WARNING(
                        f'    transition {target} skipped on {order.order_id}: {exc}'
                    ))
                    break

            # If the recipe wants a QC outcome, record it.
            qc = recipe.get('qc')
            if qc and order.status == OrderStatus.READY_FOR_QC:
                self._record_qc(order, actor, qc)

            self.stdout.write(self.style.SUCCESS(
                f'  + order {order.order_id} {client.full_name} → {order.status}'
            ))

    def _record_qc(self, order, actor, outcome: str) -> None:
        # Build a checklist payload mirroring what the UI submits.
        checklist = {
            item['key']: {'result': 'pass', 'note': ''}
            for item in CHECKLIST_ITEMS
        }
        if outcome == 'fail':
            checklist['stitching_quality'] = {
                'result': 'fail',
                'note': 'Visible stitch bunching on the right shoulder seam.',
            }
            comment = 'Right shoulder bunching — needs to be redone before QC.'
            target = OrderStatus.QC_REJECTED
            inspection_outcome = QcOutcome.FAIL
        else:
            comment = 'Clean finish, measurements bang on.'
            target = OrderStatus.READY_FOR_DELIVERY
            inspection_outcome = QcOutcome.PASS

        QcInspection.objects.create(
            order=order,
            inspector=actor,
            outcome=inspection_outcome,
            checklist=checklist,
            overall_comment=comment,
        )
        try:
            transition_order(order=order, target=target, actor=actor, reason=comment)
        except Exception as exc:
            self.stdout.write(self.style.WARNING(
                f'    QC transition {target} skipped on {order.order_id}: {exc}'
            ))

    def _seed_appointments(self, actor, clients: list[Client]) -> None:
        if Appointment.objects.filter(notes__contains=DEMO_TAG).exists():
            self.stdout.write('  · appointments already seeded')
            return
        now = timezone.now().replace(minute=0, second=0, microsecond=0)
        plan = [
            (clients[0], AppointmentKind.MEASUREMENT, now + timedelta(hours=3)),
            (clients[1], AppointmentKind.TRIAL, now + timedelta(days=1, hours=4)),
            (clients[2], AppointmentKind.DELIVERY, now + timedelta(days=2, hours=2)),
            (clients[3], AppointmentKind.CONSULTATION, now + timedelta(days=4, hours=1)),
        ]
        for client, kind, when in plan:
            Appointment.objects.create(
                client=client,
                full_name=client.full_name,
                mobile=client.mobile,
                email=client.email,
                scheduled_at=when,
                duration_minutes=30,
                kind=kind,
                status=AppointmentStatus.SCHEDULED,
                notify_via=NotifyVia.BOTH,
                notes=f'Auto-scheduled by seed_demo · {DEMO_TAG}',
                created_by=actor,
            )
            self.stdout.write(f'  + appointment {client.full_name} · {kind} @ {when:%Y-%m-%d %H:%M}')
