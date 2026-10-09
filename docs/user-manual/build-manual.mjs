// Builds docs/user-manual/Versuitality-User-Manual.pdf (+ .html) from manifest.json and images/.
//   cd apps/web && node ../../docs/user-manual/build-manual.mjs
// Run the walkthrough first (apps/web/e2e-manual) so the screenshots exist.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRequire } from 'node:module';

const require = createRequire(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../apps/web/package.json'));
const { chromium } = require('@playwright/test');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IMAGES = path.join(HERE, 'images');
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json'), 'utf8'));
const tocPages = fs.existsSync(path.join(HERE, '.toc-pages.json')) ? JSON.parse(fs.readFileSync(path.join(HERE, '.toc-pages.json'), 'utf8')) : {};
const logoSvg = fs.readFileSync(path.join(HERE, '../../apps/web/public/brand/logo.svg'), 'utf8');
const markSvg = fs.readFileSync(path.join(HERE, '../../apps/web/public/brand/mark.svg'), 'utf8');

let figNo = 0;
const used = new Set();
const img = (id) => {
  const m = manifest[id];
  if (!m) throw new Error(`Missing screenshot: ${id}`);
  used.add(id);
  const jpg = path.join(HERE, '.jpg', `${path.parse(m.file).name}.jpg`);
  if (fs.existsSync(jpg)) return `data:image/jpeg;base64,${fs.readFileSync(jpg).toString('base64')}`;
  return `data:image/png;base64,${fs.readFileSync(path.join(IMAGES, m.file)).toString('base64')}`;
};
const fig = (id, caption) => {
  const m = manifest[id];
  figNo += 1;
  return `<figure><img src="${img(id)}" alt=""/><figcaption><b>Figure ${figNo}.</b> ${caption ?? m.title}</figcaption></figure>`;
};
const fig2 = (a, b) => `<div class="pair">${fig(a)}${fig(b)}</div>`;
const steps = (...items) => `<ol class="steps">${items.map((t) => `<li>${t}</li>`).join('')}</ol>`;
const tip = (t) => `<div class="callout tip"><b>Tip</b> ${t}</div>`;
const note = (t) => `<div class="callout note"><b>Good to know</b> ${t}</div>`;
const who = (...roles) => `<p class="who">${roles.map((r) => `<span class="pill ${r.toLowerCase()}">${r}</span>`).join(' ')}</p>`;

const SECTIONS = [];
const section = (id, title, html) => SECTIONS.push({ id, title, html });

// ------------------------------------------------------------------ 1. Welcome
section('welcome', 'Welcome to Versuitality', `
<p class="lead">Versuitality Operations is the single place where your atelier runs: from the moment a client walks in, through measurements and production, to quality check, delivery and the books.</p>
<p>Everyone signs in with their own account. What each person can see and do depends on their <b>role</b>, so the front desk, the master tailor, quality control and the accountant each get a focused workspace, while the owner sees everything. Changes appear on everyone’s screen live &mdash; there is no need to refresh.</p>

<h3>The five roles</h3>
<table class="grid">
<tr><th>Role</th><th>Who</th><th>Works with</th></tr>
<tr><td><span class="pill admin">Admin</span></td><td>Owners</td><td>Everything: team &amp; roles, audit log, analytics, and every module below</td></tr>
<tr><td><span class="pill staff">Staff</span></td><td>Front desk</td><td>Appointments, clients, measurements, orders, receipts, delivery, inventory</td></tr>
<tr><td><span class="pill master">Master</span></td><td>Master tailor / workshop</td><td>Production board and every production step, rework, fabric stock</td></tr>
<tr><td><span class="pill qa">QA</span></td><td>Quality control</td><td>The inspection queue, checklist, pass / reject</td></tr>
<tr><td><span class="pill accountant">Accountant</span></td><td>Finance</td><td>Orders (read-only), receipts, analytics and Excel export</td></tr>
</table>

<h3>The life of an order</h3>
<div class="flow">
  <div class="node staff">Order received<br/><small>Front desk</small></div><span>&rarr;</span>
  <div class="node mixed">Requirements noted<br/><small>Front desk / Master</small></div><span>&rarr;</span>
  <div class="node master">Cutting started<br/><small>Master</small></div><span>&rarr;</span>
  <div class="node master">Stitching in progress<br/><small>Master</small></div><span>&rarr;</span>
  <div class="node master">Ready for trial<br/><small>Master</small></div>
</div>
<div class="flow">
  <div class="node master">Ready for QC<br/><small>Master</small></div><span>&rarr;</span>
  <div class="node qa">Quality check<br/><small>QA passes or rejects</small></div><span>&rarr;</span>
  <div class="node staff">Ready for delivery<br/><small>after QA pass</small></div><span>&rarr;</span>
  <div class="node staff">Delivered<br/><small>Front desk</small></div>
</div>
<p class="small">An order can also be <b>cancelled</b> by the front desk before delivery; this is final and needs a reason. If quality control rejects a garment, it goes back to the master (<i>QC rejected</i> &rarr; rework &rarr; <i>Ready for QC</i>) with the reason recorded. Each order gets an ID such as <b>VS-20261007-0007</b>: the date, then a running number.</p>

<h3>How this manual is organised</h3>
<p>Part 1 follows one real visit from start to finish &mdash; <i>a client walks in and leaves with a confirmed order</i>. The chapters after it describe each role’s daily work. Every screen shown is from the live system (names and numbers are sample data).</p>
`);

// -------------------------------------------------------------- 2. Getting started
section('start', 'Getting started', `
${who('Everyone')}
<h3>Signing in</h3>
${steps(
  'Open the Versuitality address your administrator gave you.',
  'Enter your <b>work email</b> and <b>password</b>, then press <b>Sign in</b>.',
  'You land on your <b>dashboard</b>. If the sign-in fails, check the email and password; after a few wrong attempts wait a minute and try again.',
)}
${fig2('a01-login', 'a02-login-filled')}
<p>The small status light on the sign-in page confirms the system is reachable. New teammates do not need a password in advance: the owner sends an <b>invitation link</b> (see <i>Team &amp; roles</i>) and they choose their own.</p>

<h3>Finding your way around</h3>
<ul>
<li>The <b>left menu</b> lists only the areas your role can use. On a phone it becomes a bar at the bottom of the screen.</li>
<li>The <b>search bar</b> at the top finds a client by name, mobile number or client ID. Press <b>Ctrl&nbsp;+&nbsp;K</b> (&#8984;&nbsp;K on Mac) from anywhere.</li>
<li>The green <b>LIVE</b> light means you are receiving updates in real time.</li>
<li>Your name at the top right opens the menu where you <b>sign out</b>. Always sign out on shared computers.</li>
</ul>
${fig('a03-dashboard-staff', 'The dashboard: today’s appointments, live order counts and low-stock warnings')}
${tip('Mobile numbers are the client’s identity. Type them any way you like &mdash; <i>98200 55123</i>, <i>09820055123</i> or <i>+91 98200 55123</i> &mdash; and the system recognises the same person.')}
`);

// --------------------------------------------------- 3. A client walks in (journey)
section('journey', 'Part 1 · A client walks in: from welcome to a confirmed order', `
${who('Staff', 'Admin')}
<p>This chapter follows one visit exactly as it happens at the counter. It is also available as a screen recording (<i>client-journey</i> video).</p>

<h3>Step 1 &mdash; See who is expected</h3>
<p>Open <b>Appointments</b> to see today’s bookings. If the client has an appointment, you will recognise them here; walk-ins simply continue to step 2.</p>
${fig('a04-appointments')}

<h3>Step 2 &mdash; Register the client</h3>
<p>Choose <b>Clients &rarr; Register</b> (or <i>Quick actions &rarr; Register a client</i> on the dashboard). The form has four short steps.</p>
${steps(
  '<b>Contact details.</b> Full name and the WhatsApp mobile number are required; email and address are optional. If the number already exists, a <i>Returning client</i> card appears so you never create a duplicate.',
  '<b>Style preferences.</b> Tap the occasions and fabrics the client likes and add private notes (for example &ldquo;prefers a slim taper&rdquo;). All optional.',
  '<b>Measurements.</b> Choose the garments, then type the measurements in inches.',
  '<b>Review.</b> Check everything with the client and press <b>Save client &amp; measurements</b>.',
)}
${fig('a05-client-contact')}
${fig('a06-client-preferences')}

<h3>Step 3 &mdash; Take the measurements</h3>
<p>Tap the garments being made (a suit adds the jacket and trouser sections). Type each measurement; the figure on the right highlights the point you are on, so nothing is mismeasured or skipped. The sheet accepts half inches and rejects impossible values.</p>
${fig('a07-measurements')}
${fig('a08-measurements-fabric', 'Further down: fabric notes, customisation notes and an optional photo of the cloth swatch')}
${fig('a09-client-review')}

<p>Saving creates the client’s permanent profile with a unique client ID, and stores the measurement set. On the <b>Measurements</b> tab every visit is kept, newest first, and can be exported to Excel.</p>
${fig2('a10-client-profile', 'a11-client-measurements')}

<h3>Step 4 &mdash; Write the order</h3>
<p>Go to <b>Orders &rarr; New order</b> (or the quick action on the dashboard).</p>
${steps(
  '<b>Client.</b> Search by name, mobile or ID and tap the client. Choose <i>Full bespoke</i> or <i>Alteration</i>.',
  '<b>Garments.</b> Add one line per garment: type, fabric description, quantity and price. If the fabric is in your inventory, pick it and enter the metres &mdash; stock is deducted automatically.',
  '<b>Measurements and dates.</b> Link the measurement set from today’s visit, set the <b>trial</b> and <b>delivery</b> dates and record the <b>advance</b> paid.',
  '<b>Review</b> the total and press <b>Create order</b>.',
)}
${fig('a12-order-client')}
${fig('a13-order-garments')}
${fig2('a14-order-measurements', 'a15-order-schedule')}
${fig('a16-order-review')}

<h3>Step 5 &mdash; Order confirmed</h3>
<p>The order receives its ID, the balance is calculated, and the order appears at once on the master’s production board and on every dashboard. The client’s first notification (&ldquo;Order received&rdquo;) is logged.</p>
${fig('a17-order-created')}
<p>Press <b>PDF receipt</b> to open the printable receipt for the client. It includes the garments, amounts, balance and &mdash; for the workshop &mdash; the full measurement sheet.</p>
${fig('a20-receipt', 'The PDF receipt: client, garments, amounts, balance, the full measurement sheet and the order timeline')}

<h3>Step 6 &mdash; Hand over to the workshop</h3>
<p>Once the requirements have been confirmed with the client, the front desk presses <b>Move to Requirements noted</b>. The panel only ever offers the steps <i>your role</i> may take. Every change is stamped on the <b>timeline</b> with who made it and when, and the client’s notifications are listed beneath it.</p>
${fig2('a18-order-actions', 'a19-order-timeline-notified')}
${note('Customer messages (WhatsApp and email) are generated for each status change and shown in the <i>Notifications</i> list on the order. They are delivered to the client as soon as your messaging accounts are connected; until then they are only logged.')}
`);

// -------------------------------------------------------------- 4. Front desk
section('frontdesk', 'Front desk (Staff)', `
${who('Staff', 'Admin')}
<p>Your daily rhythm: check appointments, register or find clients, record measurements, write orders, give receipts and hand over finished garments.</p>

<h3>Appointments</h3>
${steps(
  'Open <b>Appointments &rarr; New appointment</b>.',
  'Enter the name and mobile (or pick an existing client), the date and time, the <b>type</b> &mdash; consultation, measurement, trial or delivery &mdash; and the reminder method.',
  'Save. The booking appears in the list and on the dashboard on the day.',
)}
${fig('c12-appointment-new')}
${fig('c13-appointments-list')}

<h3>Finding clients</h3>
<p>Use the <b>Clients</b> page or the search bar at the top. You can search by name, any part of the mobile number, the last four digits, email, or the client ID.</p>
${fig('c14-clients-list')}

<h3>Changing an order</h3>
<p>Open the order and press <b>Edit order</b>. What can change depends on how far the garment has got:</p>
<ul>
<li><b>Before cutting starts</b> (<i>Order received</i> or <i>Requirements noted</i>): garments, prices, fabric, dates, payment, notes and the linked measurements. Fabric already deducted from stock is put back and re-deducted automatically.</li>
<li><b>Once cutting has started:</b> garments are locked; dates, payment, notes and measurements can still change.</li>
<li><b>After delivery:</b> you can still record payments and notes.</li>
</ul>
<p>The total and balance update as you type, the advance can never exceed the total, and every edit is written to the audit log (what changed, who and when).</p>
${fig('e01-order-edit-cancel-buttons')}
${fig('e02-order-edit-form')}
${fig('e03-order-edited')}

<h3>Cancelling an order</h3>
<p>Press <b>Cancel order</b> and give a reason. If tracked fabric was used you can choose whether it goes back to stock (it does by default before cutting). A cancelled order is final: it stays on record with who cancelled it and why, but it leaves the production board, the active counts and the revenue figures. A delivered order cannot be cancelled.</p>
${fig2('e04-order-cancel-dialog', 'e05-order-cancelled')}
${note('Only front desk and administrators can edit or cancel orders. The master, quality control and finance never see these buttons.')}

<h3>Delivering an order</h3>
<p>When quality control passes a garment the order becomes <b>Ready for delivery</b> and the client is told to collect it. When the client takes the garment, open the order and press <b>Move to Delivered</b>. Only the front desk can do this.</p>
${fig2('b18-order-ready-for-delivery', 'b19-order-delivered')}
${tip('Use the search box on the Orders page to find an order by its ID, the client’s name or mobile number.')}
`);

// ------------------------------------------------------------------ 5. Master
section('master', 'Workshop (Master tailor)', `
${who('Master', 'Admin')}
<p>The master’s workspace is the <b>production board</b>: every order grouped by its current stage, updated live as the front desk and quality control act.</p>
${fig2('b01-dashboard-master', 'b02-orders-board')}

<h3>Moving an order through production</h3>
${steps(
  'Open the order. You can see the garments, notes, the linked measurements and the timeline.',
  'Press the next step: <b>Cutting started</b> &rarr; <b>Stitching in progress</b> &rarr; <b>Ready for trial</b>. After the trial (or an alteration) choose <b>Ready for QC</b>.',
  'Each press is recorded with your name and time. The client is notified at the key milestones.',
)}
${fig('b03-order-master')}
${fig2('b04-cutting-started', 'b05-ready-for-trial')}
<p>The master sends work to quality control but cannot pass it himself &mdash; that is deliberate, so every garment gets a second pair of eyes.</p>
${fig('b06-ready-for-qc')}

<h3>When a garment is rejected</h3>
<p>If quality control finds a defect, the order returns as <b>QC rejected</b>. The order page lists the inspection, the exact checklist items that failed and the inspector’s notes. Fix the garment, choose <b>Alteration in progress</b> (or <b>Stitching in progress</b>) and then <b>Ready for QC</b> again.</p>
${fig('b14-order-qc-rejected')}
${fig('b15-order-inspections')}

<h3>Fabric stock</h3>
<p>Fabric used on an order is deducted automatically. The <b>Inventory</b> page shows the metres in stock and flags low stock; open a fabric to see its <b>movement ledger</b> &mdash; every metre in or out and the order it went to. The master can record wastage or samples from the same screen.</p>
${fig2('b07-inventory-master', 'b08-fabric-ledger')}
`);

// --------------------------------------------------------------------- 6. QA
section('qa', 'Quality control (QA)', `
${who('QA', 'Admin')}
<p>Quality control sees only the orders waiting for inspection. Nothing else in the shop is distracting or editable.</p>
${steps(
  'Open <b>Quality Check</b>. The queue lists orders the master has marked <i>Ready for QC</i>. Press <b>Start</b> on one.',
  'Work down the <b>checklist</b>, marking every item <b>Pass</b> or <b>Fail</b>. Add a note on any failed item describing what to redo.',
  'If everything passes, press <b>Pass &mdash; ready for delivery</b> and confirm. If anything failed, press <b>Reject &mdash; start rework</b> and confirm.',
)}
${fig('b09-qc-queue')}
${fig('b10-qc-checklist')}
${fig('b11-qc-fail-note')}
<p>A rejection needs an overall comment and at least one failed item; a pass requires every item to pass &mdash; the buttons stay disabled until the inspection is complete and consistent.</p>
${fig2('b12-qc-reject-confirm', 'b13-qc-rejected-result')}
<p>After rework the garment comes back to the queue for a fresh inspection; earlier inspections remain visible on the order.</p>
${fig2('b16-qc-all-pass', 'b17-qc-pass-confirm')}
`);

// ----------------------------------------------------------------- 7. Accountant
section('accountant', 'Finance (Accountant)', `
${who('Accountant', 'Admin')}
<p>Finance gets a read-only view of orders &mdash; amounts, advances, balances and receipts &mdash; and the analytics pages. There are no production buttons to press by mistake.</p>
${fig2('b20-dashboard-accountant', 'b21-orders-accountant')}
${fig('b22-order-accountant')}

<h3>Analytics</h3>
<p>Choose a date range to see orders and revenue against the previous period, the revenue trend, quality outcomes, orders by stage, garment mix, top clients and the production funnel. Press <b>Export Excel</b> to download the orders for that period.</p>
${fig('b23-analytics')}
${fig('b24-analytics-more')}
`);

// ------------------------------------------------------------------- 8. Admin
section('admin', 'Owner / Administrator', `
${who('Admin')}
<p>Owners can do everything the other roles can, plus manage the team and review activity.</p>
${fig('c01-dashboard-admin')}

<h3>Team &amp; roles</h3>
${steps(
  'Open <b>Team &amp; roles</b> and press <b>Invite teammate</b>.',
  'Enter their name, email and choose a <b>role</b>.',
  'Copy the <b>one-time setup link</b> and send it to them (WhatsApp, email, anything). The link works once and expires.',
  'The teammate opens the link, chooses a password and is signed in. You can change anyone’s role or deactivate their access from the same list at any time.',
)}
${fig('c02-team')}
${fig2('c03-invite', 'c04-invite-link')}
${fig2('c05-setup-password', 'c06-new-teammate-dashboard')}
${note('Deactivating a person ends their access immediately but keeps their history on the orders they touched.')}

<h3>Audit log</h3>
<p>The <b>Audit log</b> is a permanent record of sign-ins, failed sign-ins, invitations, role changes and every order status change &mdash; who, what and when. Filter by action or search by person.</p>
${fig('c07-audit-log')}

<h3>Orders, clients and search</h3>
${fig2('c08-orders-admin', 'c09-orders-search')}
${fig2('c15-clients-search', 'c16-global-search')}

<h3>Inventory</h3>
<p>Add each bolt of fabric once (supplier, colour, type, opening stock, cost and selling price per metre, and a low-stock threshold). From then on, stock moves automatically when orders use it, and you can record restocks, wastage and samples. The dashboard warns when a fabric drops below its threshold.</p>
${fig2('c10-fabric-new', 'c11-fabric-restock')}

<h3>Analytics</h3>
${fig('c17-analytics-admin')}
`);

// -------------------------------------------------------------------- 9. Mobile
section('mobile', 'Using Versuitality on a phone or tablet', `
${who('Everyone')}
<p>Everything works on a phone. The left menu becomes a bottom bar, cards stack, and forms are sized for thumbs &mdash; handy for taking measurements at the counter on a tablet.</p>
<div class="pair three">${fig('m01-mobile-dashboard')}${fig('m02-mobile-orders')}${fig('m03-mobile-intake')}</div>
`);

// ------------------------------------------------------------------- 10. Reference
section('reference', 'Quick reference', `
<h3>Who can do what</h3>
<table class="grid matrix">
<tr><th>Area</th><th>Admin</th><th>Staff</th><th>Master</th><th>QA</th><th>Acct.</th></tr>
<tr><td>Dashboard</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td></tr>
<tr><td>Clients &amp; measurements</td><td>edit</td><td>edit</td><td>view</td><td>&ndash;</td><td>&ndash;</td></tr>
<tr><td>Appointments</td><td>edit</td><td>edit</td><td>&ndash;</td><td>&ndash;</td><td>&ndash;</td></tr>
<tr><td>Create, edit, cancel orders</td><td>&#10003;</td><td>&#10003;</td><td>&ndash;</td><td>&ndash;</td><td>&ndash;</td></tr>
<tr><td>View orders</td><td>all</td><td>all</td><td>all</td><td>only in QC</td><td>all</td></tr>
<tr><td>Production steps</td><td>any</td><td>requirements, delivery</td><td>&#10003;</td><td>&ndash;</td><td>&ndash;</td></tr>
<tr><td>Quality inspection</td><td>&#10003;</td><td>&ndash;</td><td>&ndash;</td><td>&#10003;</td><td>&ndash;</td></tr>
<tr><td>PDF receipt</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td><td>&ndash;</td><td>&#10003;</td></tr>
<tr><td>Inventory</td><td>edit</td><td>edit</td><td>view + stock moves</td><td>&ndash;</td><td>&ndash;</td></tr>
<tr><td>Customer message log</td><td>&#10003;</td><td>&#10003;</td><td>&ndash;</td><td>&ndash;</td><td>&ndash;</td></tr>
<tr><td>Analytics &amp; Excel export</td><td>&#10003;</td><td>&ndash;</td><td>&ndash;</td><td>&ndash;</td><td>&#10003;</td></tr>
<tr><td>Team &amp; roles, audit log</td><td>&#10003;</td><td>&ndash;</td><td>&ndash;</td><td>&ndash;</td><td>&ndash;</td></tr>
</table>

<h3>Who moves an order to which status</h3>
<table class="grid">
<tr><th>Step</th><th>Who</th></tr>
<tr><td>Order received &rarr; Requirements noted</td><td>Front desk or Master</td></tr>
<tr><td>Requirements noted &rarr; Cutting started &rarr; Stitching in progress &rarr; Ready for trial</td><td>Master</td></tr>
<tr><td>Ready for trial &rarr; Alteration in progress</td><td>Master or Front desk</td></tr>
<tr><td>Ready for trial / Alteration in progress &rarr; Ready for QC</td><td>Master</td></tr>
<tr><td>Ready for QC &rarr; Ready for delivery <i>or</i> QC rejected</td><td>Quality control</td></tr>
<tr><td>QC rejected &rarr; Stitching / Alteration / Ready for QC</td><td>Master</td></tr>
<tr><td>Ready for delivery &rarr; Delivered</td><td>Front desk</td></tr>
</table>
<p class="small">An administrator can set any status in an exceptional case; the audit log records it.</p>

<h3>Keyboard &amp; handy tips</h3>
<ul>
<li><b>Ctrl / &#8984; + K</b> &mdash; search clients from any page.</li>
<li>Search orders by ID (<b>VS-20261007-0007</b>), client name, mobile or the last four digits.</li>
<li>Prices are in rupees (&#8377;). Measurements are in inches, to the half inch.</li>
</ul>

<h3>If something looks wrong</h3>
<table class="grid">
<tr><th>You see</th><th>What to do</th></tr>
<tr><td>A menu item is missing</td><td>Your role does not include it. Ask the owner to review your role under <i>Team &amp; roles</i>.</td></tr>
<tr><td>&ldquo;Invalid credentials&rdquo; at sign-in</td><td>Check the email and password. If forgotten, ask the owner to send a fresh setup link.</td></tr>
<tr><td>A status button you expect is not there</td><td>That step belongs to another role (see the table above), or the order is not at that stage yet.</td></tr>
<tr><td>The LIVE light is not green</td><td>Your connection dropped. Reload the page &mdash; nothing is lost.</td></tr>
<tr><td>A fabric cannot be added to an order</td><td>There is not enough stock. Restock it in <i>Inventory</i> or describe the fabric in text without tracking.</td></tr>
</table>
`);

// ------------------------------------------------------------------- HTML shell
const logoDataUri = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`;
const markDataUri = `data:image/svg+xml;base64,${Buffer.from(markSvg).toString('base64')}`;
const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const tocRows = SECTIONS.map((s, i) => {
  const pg = tocPages[s.id];
  return `<li><span class="n">${i + 1}</span><span class="t">${s.title}</span><span class="dots"></span><span class="p">${pg ?? ''}</span></li>`;
}).join('');

const css = `
@page { size: A4; margin: 17mm 15mm 18mm 15mm;
  @bottom-left { content: 'Versuitality Operations · User Manual'; font: 8px 'Liberation Sans', Arial, sans-serif; color: #7a76a0; }
  @bottom-right { content: 'Page ' counter(page) ' of ' counter(pages); font: 8px 'Liberation Sans', Arial, sans-serif; color: #7a76a0; } }
@page :first { margin: 0; @bottom-left { content: none; } @bottom-right { content: none; } }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'Liberation Sans', 'DejaVu Sans', Arial, sans-serif; font-size: 10.4pt; line-height: 1.5; color: #1d1a3a; }
h1, h2, h3, .serif { font-family: 'Bitstream Charter', 'Liberation Serif', 'DejaVu Serif', Georgia, serif; }
.cover { height: 297mm; width: 210mm; background: linear-gradient(160deg, #261F53 0%, #1a1540 62%, #130f33 100%); color: #fff; position: relative; page-break-after: always; overflow: hidden; }
.cover .logo { position: absolute; top: 28mm; left: 24mm; display: flex; align-items: center; gap: 6mm; }
.cover .logo img { width: 20mm; height: 20mm; }
.cover .wm { font-size: 26pt; letter-spacing: 3pt; color: #e2c23e; font-weight: 700; line-height: 1; }
.cover .tag { font-size: 8pt; letter-spacing: 5pt; color: #CBA624; margin-top: 3mm; opacity: .8; }
.cover .ring { position: absolute; right: -60mm; top: 90mm; width: 170mm; height: 170mm; border: 1.2mm solid rgba(203,166,36,.35); border-radius: 50%; }
.cover .ring.two { right: -30mm; top: 120mm; width: 110mm; height: 110mm; border-color: rgba(203,166,36,.2); }
.cover h1 { position: absolute; left: 24mm; top: 112mm; font-size: 40pt; line-height: 1.1; margin: 0; color: #e2c23e; font-weight: 600; letter-spacing: .5pt; }
.cover .sub { position: absolute; left: 24mm; top: 154mm; width: 120mm; font-size: 14pt; color: #d9d4ff; line-height: 1.45; }
.cover .meta { position: absolute; left: 24mm; bottom: 26mm; font-size: 10pt; color: #b9b2ee; letter-spacing: .12em; text-transform: uppercase; }
.cover .meta b { color: #e2c23e; }
.page-break { page-break-before: always; }
.toc { page-break-after: always; }
.toc h2 { font-size: 24pt; color: #261F53; border-bottom: 2px solid #CBA624; padding-bottom: 6px; margin: 0 0 14px; }
.toc ol { list-style: none; padding: 0; margin: 0; }
.toc li { display: flex; align-items: baseline; gap: 8px; font-size: 12pt; padding: 7px 0; border-bottom: 1px solid #ece9f7; }
.toc .n { width: 22px; color: #CBA624; font-weight: 700; font-family: 'Bitstream Charter', serif; }
.toc .dots { flex: 1; border-bottom: 1px dotted #b8b3d6; transform: translateY(-3px); }
.toc .p { width: 24px; text-align: right; color: #55507a; }
.toc .how { margin-top: 26px; padding: 14px 16px; background: #f5f2e4; border-left: 4px solid #CBA624; border-radius: 6px; font-size: 10pt; }
section.chapter { page-break-before: always; }
section.chapter:first-of-type { page-break-before: auto; }
section.chapter > h2 { font-size: 23pt; color: #261F53; margin: 0 0 6px; padding-bottom: 6px; border-bottom: 2px solid #CBA624; line-height: 1.15; }
section.chapter > h2 .num { color: #CBA624; margin-right: 8px; }
h3 { font-size: 14pt; color: #261F53; margin: 20px 0 6px; break-after: avoid; }
p { margin: 6px 0; } p.lead { font-size: 12pt; color: #3a3566; }
p.small { font-size: 9.2pt; color: #55507a; }
ul, ol { margin: 6px 0 6px 20px; padding: 0; } li { margin: 3px 0; }
ol.steps { counter-reset: s; list-style: none; margin: 8px 0; padding: 0; }
ol.steps li { counter-increment: s; position: relative; padding: 6px 8px 6px 38px; margin: 6px 0; background: #faf9ff; border: 1px solid #e8e5f6; border-radius: 8px; break-inside: avoid; }
ol.steps li::before { content: counter(s); position: absolute; left: 9px; top: 6px; width: 21px; height: 21px; line-height: 21px; text-align: center; border-radius: 50%; background: #261F53; color: #e2c23e; font-weight: 700; font-size: 9.5pt; }
figure { margin: 10px 0 12px; break-inside: avoid; page-break-inside: avoid; }
figure img { width: 100%; display: block; border: 1px solid #cfc9ec; border-radius: 8px; box-shadow: 0 3px 10px rgba(38,31,83,.18); }
figcaption { font-size: 8.8pt; color: #55507a; margin-top: 5px; text-align: center; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: start; }
.pair.three { grid-template-columns: repeat(3, 1fr); }
.pair figure { margin: 6px 0 8px; }
.callout { border-radius: 8px; padding: 8px 12px; margin: 10px 0; font-size: 9.8pt; break-inside: avoid; }
.callout.tip { background: #fff8dc; border-left: 4px solid #CBA624; }
.callout.note { background: #eef0ff; border-left: 4px solid #4b43a8; }
.callout b { margin-right: 6px; text-transform: uppercase; font-size: 8.5pt; letter-spacing: .08em; }
table.grid { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 9.6pt; break-inside: avoid; }
table.grid th { background: #261F53; color: #e2c23e; text-align: left; padding: 6px 8px; font-weight: 600; }
table.grid td { padding: 6px 8px; border-bottom: 1px solid #e4e0f3; vertical-align: top; }
table.grid tr:nth-child(even) td { background: #faf9ff; }
table.matrix td, table.matrix th { text-align: center; } table.matrix td:first-child, table.matrix th:first-child { text-align: left; }
.pill { display: inline-block; padding: 1px 9px; border-radius: 999px; font-size: 8.5pt; font-weight: 700; border: 1px solid; }
.pill.admin { color: #8a6d00; background: #fff4c7; border-color: #CBA624; }
.pill.staff { color: #1f4aa8; background: #e4edff; border-color: #7da0f2; }
.pill.master { color: #5b2fa3; background: #efe6ff; border-color: #a98be0; }
.pill.qa { color: #8a4b00; background: #ffeed9; border-color: #e5a45b; }
.pill.accountant { color: #0f6b4f; background: #def7ec; border-color: #6bc4a0; }
.pill.everyone { color: #261F53; background: #eceaf8; border-color: #b8b3d6; }
p.who { margin: 8px 0 12px; }
.flow { display: flex; align-items: stretch; gap: 6px; margin: 8px 0; }
.flow span { align-self: center; color: #CBA624; font-weight: 700; }
.node { flex: 1; text-align: center; padding: 8px 4px; border-radius: 8px; font-size: 9pt; font-weight: 700; line-height: 1.25; border: 1px solid; }
.node small { display: block; font-weight: 500; font-size: 7.8pt; opacity: .85; margin-top: 2px; }
.node.staff { background: #e4edff; border-color: #7da0f2; color: #1f4aa8; }
.node.master { background: #efe6ff; border-color: #a98be0; color: #5b2fa3; }
.node.qa { background: #ffeed9; border-color: #e5a45b; color: #8a4b00; }
.node.mixed { background: linear-gradient(90deg, #e4edff, #efe6ff); border-color: #a98be0; color: #3c3a86; }
`;

const chapters = SECTIONS.map(
  (s, i) => `<section class="chapter" id="${s.id}"><h2><span class="num">${i + 1}</span>${s.title}</h2>${s.html}</section>`,
).join('\n');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>Versuitality Operations — User Manual</title><style>${css}</style></head><body>
<div class="cover">
  <div class="logo"><img src="${markDataUri}" alt=""/><div><div class="wm serif">VERSUITALITY</div><div class="tag">BESPOKE · TAILORING</div></div></div>
  <div class="ring"></div><div class="ring two"></div>
  <h1 class="serif">User Manual</h1>
  <div class="sub">Versuitality Operations &mdash; running your bespoke atelier from the first measurement to the final fitting.</div>
  <div class="meta">Version 1.0 &nbsp;·&nbsp; <b>${today}</b></div>
</div>
<div class="toc">
  <h2 class="serif">Contents</h2>
  <ol>${tocRows}</ol>
  <div class="how"><b>Where to start.</b> New to the system? Read <i>Welcome</i> and <i>Getting started</i>, then jump to the chapter for your role. The walkthrough in <i>Part 1</i> shows a complete visit &mdash; a client walking in to a confirmed order &mdash; and is also provided as a short screen recording.</div>
</div>
${chapters}
</body></html>`;

fs.writeFileSync(path.join(HERE, 'Versuitality-User-Manual.html'), html);

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.pdf({
  path: path.join(HERE, 'Versuitality-User-Manual.pdf'),
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: '17mm', bottom: '18mm', left: '15mm', right: '15mm' },
});
await browser.close();

const unused = Object.keys(manifest).filter((k) => !used.has(k));
console.log(`Manual built: ${figNo} figures, ${SECTIONS.length} chapters.`);
if (unused.length) console.log('Screenshots not used in the manual:', unused.join(', '));
fs.writeFileSync(path.join(HERE, '.sections.json'), JSON.stringify(SECTIONS.map((s, i) => ({ id: s.id, title: s.title, n: i + 1 }))));
