// ---------------------- Data & Utilities ----------------------
const FLAGS = [
	[0, 'FCVAR_NONE'],
	[1 << 0, 'FCVAR_UNREGISTERED'],
	[1 << 1, 'FCVAR_DEVELOPMENTONLY'],
	[1 << 2, 'FCVAR_GAMEDLL'],
	[1 << 3, 'FCVAR_CLIENTDLL'],
	[1 << 4, 'FCVAR_HIDDEN'],
	[1 << 5, 'FCVAR_PROTECTED'],
	[1 << 6, 'FCVAR_SPONLY'],
	[1 << 7, 'FCVAR_ARCHIVE'],
	[1 << 8, 'FCVAR_NOTIFY'],
	[1 << 9, 'FCVAR_USERINFO'],
	[1 << 10, 'FCVAR_PRINTABLEONLY'],
	[1 << 11, 'FCVAR_UNLOGGED'],
	[1 << 12, 'FCVAR_NEVER_AS_STRING'],
	[1 << 13, 'FCVAR_REPLICATED'],
	[1 << 14, 'FCVAR_CHEAT'],
	[1 << 16, 'FCVAR_DEMO'],
	[1 << 17, 'FCVAR_DONTRECORD'],
	[1 << 20, 'FCVAR_RELOAD_MATERIALS'],
	[1 << 21, 'FCVAR_RELOAD_TEXTURES'],
	[1 << 22, 'FCVAR_NOT_CONNECTED'],
	[1 << 23, 'FCVAR_MATERIAL_SYSTEM_THREAD'],
	[1 << 24, 'FCVAR_ARCHIVE_XBOX'],
	[1 << 25, 'FCVAR_ACCESSIBLE_FROM_THREADS'],
	[1 << 28, 'FCVAR_SERVER_CAN_EXECUTE'],
	[1 << 29, 'FCVAR_SERVER_CANNOT_QUERY'],
	[1 << 30, 'FCVAR_CLIENTCMD_CAN_EXECUTE'],
];

const state = {
	manifest: null,
	builds: [],         // [{ id, label, data, map }]
	view: 'changed',    // changed | added | removed | all
	left: null,
	right: null,
	search: '',
};

function parseBuildId(filename) {
	// e.g. portal-9862575-windows.json => { game, build, platform }
	const base = filename.replace(/\.json$/, '');
	const m = base.match(/^(.*?)-(\d+)-(.*)$/);
	if (!m) return { id: base, game: base, build: '', platform: '' };
	return { id: base, game: m[1], build: m[2], platform: m[3] };
}

function labelFor(build) {
	return `${build.game} ${build.build} (${build.platform})`;
}

function decodeFlags(n) {
	if (n === 0) return ['FCVAR_NONE'];
	const out = [];
	for (const [bit, name] of FLAGS) {
		if (bit !== 0 && (n & bit)) out.push(name);
	}
	return out;
}

function flagDelta(a, b) {
	// returns {added:[names], removed:[names]} comparing a->b
	const add = [], del = [];
	const map = new Map(FLAGS.map(([bit, name]) => [bit, name]));
	for (const [bit, name] of FLAGS) {
		if (bit === 0) continue;
		const hasA = (a & bit) !== 0;
		const hasB = (b & bit) !== 0;
		if (hasB && !hasA) add.push(name);
		if (!hasB && hasA) del.push(name);
	}
	return { added: add, removed: del };
}

function toMap(arr) {
	// Normalize to map by name; value includes type fields
	const m = new Map();
	for (const it of arr) m.set(it.name, it);
	return m;
}

function normalizeItem(it) {
	// Ensure consistent presence of optional fields for diffing
	const o = { ...it };
	if (o.type === 'ConVar') {
		if (typeof o.min === 'undefined') o.min = null;
		if (typeof o.max === 'undefined') o.max = null;
	}
	if (typeof o.help === 'undefined') o.help = '';
	return o;
}

function changedFields(a, b) {
	// returns list of changed field keys between two normalized items
	const fields = new Set(Object.keys({ ...a, ...b }));
	// We only consider specific fields
	const consider = a.type === 'ConVar' || b.type === 'ConVar'
		? ['type', 'flags', 'help', 'name', 'default', 'min', 'max']
		: ['type', 'flags', 'help', 'name'];
	const out = [];
	for (const k of consider) {
		const va = a[k];
		const vb = b[k];
		const eq = (va === vb) || (Number.isNaN(va) && Number.isNaN(vb));
		if (!eq) out.push(k);
	}
	return out;
}

// ---------------------- Rendering ----------------------
function el(tag, attrs = {}, ...children) {
	const e = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) {
		if (k === 'class') e.className = v;
		else if (k === 'html') e.innerHTML = v;
		else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.substring(2), v);
		else e.setAttribute(k, v);
	}
	for (const c of children) { if (c == null) continue; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
	return e;
}

function renderControls() {
	const leftSel = document.getElementById('leftSelect');
	const rightSel = document.getElementById('rightSelect');
	leftSel.innerHTML = '';
	rightSel.innerHTML = '';
	for (const b of state.builds) {
		const o1 = el('option', { value: b.id }, labelFor(b));
		const o2 = el('option', { value: b.id }, labelFor(b));
		leftSel.appendChild(o1); rightSel.appendChild(o2);
	}
	if (!state.left) state.left = state.builds[0]?.id;
	if (!state.right) state.right = state.builds[state.builds.length - 1]?.id;
	leftSel.value = state.left; rightSel.value = state.right;

	leftSel.onchange = () => { state.left = leftSel.value; update(); };
	rightSel.onchange = () => { state.right = rightSel.value; update(); };

	document.querySelectorAll('.seg button').forEach(btn => {
		btn.onclick = () => {
			document.querySelectorAll('.seg button').forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
			state.view = btn.dataset.view;
			update();
		};
	});

	const search = document.getElementById('search');
	search.oninput = (e) => { state.search = e.target.value.trim().toLowerCase(); updateListOnly(); };
}

function computeDiff() {
	const left = state.builds.find(b => b.id === state.left);
	const right = state.builds.find(b => b.id === state.right);
	if (!left || !right) return { stats: {}, rows: [] };
	const A = left.map; const B = right.map;
	const names = new Set([...A.keys(), ...B.keys()]);
	const rows = [];
	for (const name of names) {
		const a = A.get(name) ? normalizeItem(A.get(name)) : null;
		const b = B.get(name) ? normalizeItem(B.get(name)) : null;
		if (a && b) {
			const changed = changedFields(a, b);
			rows.push({ kind: changed.length ? 'changed' : 'unchanged', name, a, b, changed });
		} else if (a && !b) {
			rows.push({ kind: 'removed', name, a, b: null, changed: [] });
		} else if (!a && b) {
			rows.push({ kind: 'added', name, a: null, b, changed: [] });
		}
	}
	// Sort by name for stable display
	rows.sort((r1, r2) => r1.name.localeCompare(r2.name));
	const stats = {
		total: rows.length,
		changed: rows.filter(r => r.kind === 'changed').length,
		added: rows.filter(r => r.kind === 'added').length,
		removed: rows.filter(r => r.kind === 'removed').length,
		unchanged: rows.filter(r => r.kind === 'unchanged').length,
	};
	return { left, right, rows, stats };
}

function matchSearch(r) {
	if (!state.search) return true;
	const hay = [r.name, r.a?.help || '', r.b?.help || ''].join('\n').toLowerCase();
	return hay.includes(state.search);
}

function renderSummary(diff) {
	const s = document.getElementById('summary');
	s.innerHTML = '';
	if (!diff.left || !diff.right) return;
	s.append(
		el('span', { class: 'stat' }, `${labelFor(diff.left)}: ${diff.left.data.length}`),
		el('span', { class: 'stat' }, `${labelFor(diff.right)}: ${diff.right.data.length}`),
		el('span', { class: 'stat' }, `Changed: ${diff.stats.changed}`),
		el('span', { class: 'stat' }, `Added: ${diff.stats.added}`),
		el('span', { class: 'stat' }, `Removed: ${diff.stats.removed}`),
		el('span', { class: 'stat' }, `Unchanged: ${diff.stats.unchanged}`),
	);
}

function kvRow(k, v, opts = {}) {
	const cls = 'kv' + (opts.changed ? ' changed' : '');
	return el('div', { class: cls },
		el('div', { class: 'k' }, k),
		el('div', { class: 'v' }, v)
	);
}

function paneForItem(title, it) {
	const p = el('div', { class: 'pane' });
	p.appendChild(el('h4', {}, title));
	if (!it) { p.appendChild(el('div', { class: 'muted' }, 'Not present')); return p; }
	p.appendChild(kvRow('Type', it.type));
	p.appendChild(kvRow('Flags', el('span', {}, `${it.flags} `, el('span', { class: 'muted' }, `(${decodeFlags(it.flags).join(', ')})`))));
	p.appendChild(kvRow('Help', el('div', { class: 'help' }, it.help || '')));
	if (it.type === 'ConVar') {
		p.appendChild(kvRow('Default', el('span', { class: 'mono' }, String(it.default))));
		p.appendChild(kvRow('Min', it.min == null ? el('span', { class: 'muted' }, '—') : String(it.min)));
		p.appendChild(kvRow('Max', it.max == null ? el('span', { class: 'muted' }, '—') : String(it.max)));
	}
	return p;
}

function renderRow(r, leftLabel, rightLabel) {
	const row = el('div', { class: 'row' });
	const header = el('div', { class: 'row-header' });
	header.appendChild(el('div', {}, el('div', { class: 'name' }, r.name), el('div', { class: 'type' }, (r.a || r.b)?.type || 'Unknown')));
	const tags = el('div', { class: 'tags' });
	const tagKind = el('span', { class: 'tag ' + r.kind }, r.kind);
	tags.appendChild(tagKind);
	header.appendChild(tags);
	const actions = el('div', { class: 'actions' });
	const btnHistory = el('button', { class: 'btn' }, 'History');
	btnHistory.onclick = () => openHistory(r.name);
	actions.appendChild(btnHistory);
	header.appendChild(actions);
	row.appendChild(header);

	if (r.kind === 'changed') {
		const grid = el('div', { class: 'diff' });
		const leftPane = el('div', { class: 'pane' });
		leftPane.appendChild(el('h4', {}, `Left • ${leftLabel}`));
		const rightPane = el('div', { class: 'pane' });
		rightPane.appendChild(el('h4', {}, `Right • ${rightLabel}`));

		// Determine the full field set for this item type
		const isConVar = (r.a?.type === 'ConVar') || (r.b?.type === 'ConVar');
		const fieldsAll = isConVar
			? ['type', 'flags', 'help', 'default', 'min', 'max']
			: ['type', 'flags', 'help'];

		for (const k of fieldsAll) {
			// Values on each side
			const ka = r.a ? r.a[k] : undefined;
			const kb = r.b ? r.b[k] : undefined;

			// For flags we’ll also render the delta box below, but still show both values
			const isChanged = r.changed.includes(k);

			if (k !== 'flags') {
				leftPane.appendChild(kvRow(k, formatVal(k, ka), { changed: isChanged }));
				rightPane.appendChild(kvRow(k, formatVal(k, kb), { changed: isChanged }));
			} else {
				const da = r.a?.flags ?? 0, db = r.b?.flags ?? 0;
				const leftFlags = el('div', {}, `${da} `, el('span', { class: 'muted' }, `(${decodeFlags(da).join(', ')})`));
				const rightFlags = el('div', {}, `${db} `, el('span', { class: 'muted' }, `(${decodeFlags(db).join(', ')})`));
				leftPane.appendChild(kvRow('flags', leftFlags, { changed: isChanged }));
				rightPane.appendChild(kvRow('flags', rightFlags, { changed: isChanged }));

				if (isChanged) {
					const { added, removed } = flagDelta(da, db);
					const deltaBox = el('div', { class: 'pane', style: 'grid-column:1/-1;' });
					deltaBox.appendChild(el('h4', {}, 'Δ Flags'));
					const deltas = [];
					if (added.length) deltas.push(el('div', {}, el('span', { class: 'flag-add' }, '+ ' + added.join(', '))));
					if (removed.length) deltas.push(el('div', {}, el('span', { class: 'flag-del' }, '− ' + removed.join(', '))));
					if (!deltas.length) deltas.push(el('div', { class: 'muted' }, 'No bit changes (numeric changed due to unknown bits?)'));
					deltaBox.append(...deltas);
					grid.appendChild(deltaBox);
				}
			}
		}

		grid.appendChild(leftPane);
		grid.appendChild(rightPane);
		row.appendChild(grid);
	}
	else if (r.kind === 'added') {
		row.appendChild(paneForItem(`Only in Right • ${rightLabel}`, r.b));
	}
	else if (r.kind === 'removed') {
		row.appendChild(paneForItem(`Only in Left • ${leftLabel}`, r.a));
	}
	else { // unchanged, when view=all
		row.appendChild(paneForItem(`Both`, r.a));
	}

	return row;
}

function formatVal(k, v) {
	if (v == null) return el('span', { class: 'muted' }, '—');
	if (k === 'help') return el('div', { class: 'help' }, v);
	return String(v);
}

function update() {
	const diff = computeDiff();
	renderSummary(diff);
	renderList(diff);
}

function updateListOnly() {
	const diff = computeDiff();
	renderList(diff);
}

function renderList(diff) {
	const list = document.getElementById('list');
	const count = document.getElementById('count');
	list.innerHTML = '';
	if (!diff.left || !diff.right) { count.textContent = ''; return; }

	const leftLabel = labelFor(diff.left);
	const rightLabel = labelFor(diff.right);

	const rows = diff.rows.filter(r => {
		if (!matchSearch(r)) return false;
		if (state.view === 'all') return true;
		return r.kind === state.view;
	});

	for (const r of rows) {
		list.appendChild(renderRow(r, leftLabel, rightLabel));
	}

	count.textContent = `${rows.length} shown`;
}

// ---------------------- History Modal ----------------------
function openHistory(name) {
	const dialog = document.getElementById('historyDialog');
	document.getElementById('histTitle').textContent = `History • ${name}`;

	// Build table: columns = builds; rows = fields
	const builds = state.builds;
	const items = builds.map(b => ({ b, it: b.map.get(name) ? normalizeItem(b.map.get(name)) : null }));
	const type = items.find(x => x.it)?.it?.type || 'Unknown';
	const fields = type === 'ConVar' ? ['present', 'type', 'flags', 'help', 'default', 'min', 'max'] : ['present', 'type', 'flags', 'help'];

	const table = document.getElementById('histTable');
	table.innerHTML = '';

	// Header
	const trh = el('tr');
	trh.appendChild(el('th', {}, 'Field'));
	for (const { b } of items) {
		trh.appendChild(el('th', { class: 'nowrap' }, labelFor(b)));
	}
	table.appendChild(trh);

	// Rows
	for (const f of fields) {
		const tr = el('tr');
		tr.appendChild(el('th', {}, f));
		for (const { it } of items) {
			let cell;
			if (f === 'present') cell = it ? el('span', { class: 'pill' }, 'present') : el('span', { class: 'muted' }, 'not present');
			else if (!it) cell = el('span', { class: 'muted' }, '—');
			else if (f === 'flags') cell = el('div', {}, String(it.flags), el('div', { class: 'muted' }, decodeFlags(it.flags).join(', ')));
			else if (f === 'help') cell = el('div', { class: 'help' }, it.help || '');
			else cell = document.createTextNode(String(it[f] ?? ''));
			const td = el('td', {}); td.appendChild(cell); tr.appendChild(td);
		}
		table.appendChild(tr);
	}

	// Chips
	const histChips = document.getElementById('histChips');
	histChips.innerHTML = '';
	histChips.appendChild(el('span', { class: 'chip' }, `Type: ${type}`));

	dialog.showModal();
}

document.getElementById('closeHist').onclick = () => document.getElementById('historyDialog').close();

// ---------------------- Boot ----------------------
async function boot() {
	// Load manifest and all files from /data/
	const base = 'data/';
	const resp = await fetch(base + 'manifest.json');
	if (!resp.ok) throw new Error('Failed to load manifest.json');
	const manifest = await resp.json();
	state.manifest = manifest;

	const builds = [];
	for (const file of manifest.files) {
		const id = file.replace(/\.json$/, '');
		const meta = parseBuildId(file);
		const r = await fetch(base + file);
		if (!r.ok) throw new Error('Failed to load ' + file);
		const data = await r.json();
		builds.push({ id: meta.id, game: meta.game, build: meta.build, platform: meta.platform, label: '', data, map: toMap(data) });
	}
	// Sort builds by build number then platform for stable order
	builds.sort((a, b) => {
		const n = Number(a.build) - Number(b.build);
		if (n !== 0) return n;
		return a.platform.localeCompare(b.platform);
	});
	for (const b of builds) b.label = labelFor(b);
	state.builds = builds;

	renderControls();
	update();
}

boot().catch(err => {
	document.body.innerHTML = '<div style="padding:24px;font-family:sans-serif;color:#e6e8f0">' +
		'<h2>Failed to load data</h2><pre style="white-space:pre-wrap;background:#151924;padding:12px;border-radius:8px;border:1px solid #242b3b">' +
		(err?.stack || String(err)) + '</pre></div>';
});
