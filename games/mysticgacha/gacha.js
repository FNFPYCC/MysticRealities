"use strict";
// ==========================================
// 1. ДАННЫЕ (меняй имена и добавляй свои предметы здесь)
// ==========================================
const SHAPES = {
    agent: "<circle cx='50' cy='40' r='20' fill='C'/><rect x='20' y='65' width='60' height='30' rx='10' fill='C'/>",
    weapon: "<rect x='44' y='8' width='12' height='62' rx='4' fill='C'/><rect x='28' y='66' width='44' height='10' rx='3' fill='C'/><rect x='45' y='76' width='10' height='16' fill='C'/>",
    disk: "<circle cx='50' cy='50' r='40' fill='none' stroke='C' stroke-width='6'/><circle cx='50' cy='50' r='11' fill='C'/>"
};
const RANK_COLOR = { S: "#f5a623", A: "#b84cf0", B: "#4a90e2" };
const art = (type, rank) => "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='#120a0c'/>${SHAPES[type].replace(/C/g, RANK_COLOR[rank])}</svg>`);

// image можно заменить на свой путь: image: "../../assets/gacha/lim_1.png"
const ITEMS = [
    { id: "lim_1", name: "Лимитированный", rarity: "S", type: "agent", income: 100 },
    { id: "std_1", name: "Time Lord (TL)", rarity: "S", type: "agent", income: 50 },
    { id: "std_2", name: "Стандартный S-2", rarity: "S", type: "agent", income: 50 },
    { id: "a_1", name: "Прототип TL", rarity: "A", type: "agent", income: 20 },
    { id: "a_2", name: "Агент A-2", rarity: "A", type: "agent", income: 20 },
    { id: "we_lim", name: "Лимитированный W-двигатель", rarity: "S", type: "weapon", atk: 713, sub: ["cd", 48], eff: ["atk%", 10] },
    { id: "we_std", name: "Стандартный W-двигатель", rarity: "S", type: "weapon", atk: 713, sub: ["cr", 24], eff: ["atk%", 8] },
    { id: "we_a", name: "W-двигатель A", rarity: "A", type: "weapon", atk: 594, sub: ["atk%", 18], eff: ["cd", 8] },
    { id: "we_b", name: "W-двигатель B", rarity: "B", type: "weapon", atk: 400, sub: ["hp%", 15], eff: ["def%", 6] },
    { id: "disk_1", name: "Диск: Атака", rarity: "B", type: "disk", set: "fury", main: ["atk", 60] },
    { id: "disk_2", name: "Диск: Бастион", rarity: "B", type: "disk", set: "bastion", main: ["hp", 400] },
    { id: "disk_3", name: "Диск: Остриё", rarity: "B", type: "disk", set: "sharp", main: ["cr", 2.4] }
].map((i) => ({ image: art(i.type, i.rarity), ...i }));

const AGENT_INFO = {
    lim_1: { faction: "Мистик Реалм", elem: "Огонь", role: "Атака", impact: 120, ap: 95, am: 105, er: 1.2 },
    std_1: { faction: "Мистик Реалм", elem: "Физ.", role: "Аномалия", impact: 95, ap: 120, am: 110, er: 1.2 },
    std_2: { faction: "Мистик Реалм", elem: "Лёд", role: "Поддержка", impact: 80, ap: 90, am: 90, er: 1.4 },
    a_1: { faction: "Мистик Реалм", elem: "Физ.", role: "Аномалия", impact: 86, ap: 116, am: 118, er: 1.2 },
    a_2: { faction: "Мистик Реалм", elem: "Электро", role: "Атака", impact: 100, ap: 90, am: 90, er: 1.2 }
};
const info = (id) => Object.assign({ faction: "—", elem: "Физ.", role: "Атака", impact: 100, ap: 90, am: 90, er: 1.2 }, AGENT_INFO[id]);

// Навыки: ядро A–F и 5 навыков до 12 уровня (лимит растёт от Разума)
const SKILLS = [
    { name: "Базовая атака", icon: "✊" }, { name: "Уклонение", icon: "⮝" }, { name: "Поддержка", icon: "⇄" },
    { name: "Особая атака", icon: "✦" }, { name: "Цепная атака", icon: "☄" }
];
const CORE_LETTERS = "ABCDEF";
// Разум (Ментальная картина): открывается дубликатами агента, M1..M6
const MINDS = [
    { name: "Разминка", desc: "АТК +6%", fx: [["atk%", 6]] },
    { name: "Состояние потока", desc: "Крит. шанс +4%", fx: [["cr", 4]] },
    { name: "Всесторонние тренировки", desc: "Лимит уровня навыков +2", cap: true },
    { name: "Зажигаем вместе!", desc: "HP +10%", fx: [["hp%", 10]] },
    { name: "Мастер на все руки", desc: "Лимит уровня навыков +2", cap: true },
    { name: "Выход за пределы", desc: "Крит. урон +20%, АТК +10%", fx: [["cd", 20], ["atk%", 10]] }
];

const STAT_NAMES = { hp: "HP", atk: "АТК", def: "ЗАЩ", cr: "Крит. шанс", cd: "Крит. урон" };
const SETS = {
    fury: { name: "Ярость", b2: ["atk%", 10], b4: ["cr", 12] },
    bastion: { name: "Бастион", b2: ["hp%", 10], b4: ["def%", 25] },
    sharp: { name: "Острие", b2: ["cr", 8], b4: ["cd", 30] }
};
const BASE = { S: [8000, 900, 650], A: [6800, 750, 550] };

// Каналы как в ZZZ: мягкий гарант растёт на 6% за крутку, жёсткий гарант S,
// гарант A каждые 10 круток, 50/50 (у W-двигателей 75/25)
const BANNERS = {
    excl: { name: "Эксклюзивный канал", kind: "агент", s: 0.006, soft: 74, hard: 90, a: 0.094, upS: 0.5, upA: 0.5,
        featS: ["lim_1"], featA: ["a_2"], poolS: ["std_1", "std_2"], poolA: ["a_1", "a_2"], poolB: ["disk_1", "disk_2", "disk_3"] },
    std: { name: "Стандартный канал", kind: "агент", s: 0.006, soft: 74, hard: 90, a: 0.094, upS: 0, upA: 0,
        featS: [], featA: [], poolS: ["std_1", "std_2"], poolA: ["a_1", "a_2"], poolB: ["disk_1", "disk_2", "disk_3"] },
    weapon: { name: "Канал W-двигателей", kind: "W-двигатель", s: 0.01, soft: 65, hard: 80, a: 0.15, upS: 0.75, upA: 0.75,
        featS: ["we_lim"], featA: ["we_a"], poolS: ["we_lim", "we_std"], poolA: ["we_a"], poolB: ["we_b"] }
};
const PULL_COST = 160, TEAM_SIZE = 3, MAX_COPIES = { agent: 7, weapon: 5 }, SOFT_STEP = 0.06;

// ==========================================
// 2. СОСТОЯНИЕ
// ==========================================
const KEY = "gacha_zzz_v3";
const freshCh = () => ({ pity: 0, aPity: 0, gS: false, gA: false });
const fresh = () => ({ money: 1600, ch: { excl: freshCh(), std: freshCh(), weapon: freshCh() },
    inv: {}, levels: {}, team: [null, null, null], equip: {}, itemLv: {}, seen: {}, skills: {}, history: [], last: Date.now() });
let state = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || "null"));
let curBanner = "excl", currentCharId = null, eqSlot = "w", eqItem = null, eqFilter = "all";

const $ = (id) => document.getElementById(id);
const ITEM = (id) => ITEMS.find((i) => i.id === id);
const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const mind = (id) => Math.min(6, (state.inv[id] || 1) - 1);
const skOf = (id) => (state.skills[id] ||= { lv: [1, 1, 1, 1, 1], core: 0 });
const skillCap = (id) => 12 + 2 * MINDS.slice(0, mind(id)).filter((m) => m.cap).length;
const eqOf = (id) => (state.equip[id] ||= { disks: [null, null, null, null, null, null], weapon: null });

function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

// ==========================================
// 3. КРУТКИ
// ==========================================
function pullOnce(b, bid) {
    const st = state.ch[bid];
    st.pity++; st.aPity++;
    const n = st.pity;
    const pS = n >= b.hard ? 1 : b.s + Math.max(0, n - (b.soft - 1)) * SOFT_STEP;
    let rank, id;

    if (Math.random() < pS) {
        rank = "S";
        const atPity = n;
        st.pity = 0; st.aPity = 0;
        if (b.upS) {
            const win = st.gS || Math.random() < b.upS;
            id = win ? pick(b.featS) : pick(b.poolS.filter((x) => !b.featS.includes(x)));
            st.gS = !win;
        } else id = pick(b.poolS);
        return { id, rank, bid, pity: atPity };
    }
    if (st.aPity >= 10 || Math.random() < b.a) {
        rank = "A"; st.aPity = 0;
        const lose = b.poolA.filter((x) => !b.featA.includes(x));
        if (b.featA.length) {
            const win = st.gA || Math.random() < b.upA || !lose.length;
            id = win ? pick(b.featA) : pick(lose);
            st.gA = !win;
        } else id = pick(b.poolA);
        return { id, rank, bid };
    }
    return { id: pick(b.poolB), rank: "B", bid };
}

// Дубликаты: агенты -> Разум M1..M6, W-двигатели -> уровень R2..R5
function give(id) {
    const it = ITEM(id), have = state.inv[id] || 0;
    if (it.type === "disk") { state.inv[id] = have + 1; return have ? "" : "NEW"; }
    const cap = MAX_COPIES[it.type];
    if (have >= cap) { const back = it.type === "agent" ? 80 : 40; state.money += back; return `+${back} ⬡`; }
    state.inv[id] = have + 1;
    if (it.type === "agent" && !have) state.levels[id] = 1;
    if (!have) return "NEW";
    return it.type === "agent" ? `M${have}` : `R${have + 1}`;
}

function doRoll(count) {
    const b = BANNERS[curBanner], cost = PULL_COST * count;
    if (state.money < cost) return toast("Недостаточно полихромов!");
    state.money -= cost;
    const results = [];
    for (let i = 0; i < count; i++) {
        const r = pullOnce(b, curBanner);
        r.note = give(r.id);
        results.push(r);
        state.history.unshift({ id: r.id, rank: r.rank, bid: r.bid, pity: r.pity || 0, t: Date.now() });
    }
    state.history = state.history.slice(0, 100);
    save(); renderTop(); renderPity(); showResults(results);
}

function showResults(results) {
    const stage = $("stage");
    stage.classList.remove("flash-s"); void stage.offsetWidth;
    if (results.some((r) => r.rank === "S")) stage.classList.add("flash-s");
    stage.innerHTML = `<div class="pull-grid ${results.length === 1 ? "single" : ""}">${results.map((r, i) => {
        const it = ITEM(r.id);
        return `<div class="pull-item r-${r.rank}" style="animation-delay:${i * 0.1}s">
            <img src="${it.image}" alt=""><b class="rarity-${r.rank}">${it.name}</b>
            <small>${r.rank}-ранг${r.note ? ` • <span class="${r.note === "NEW" ? "tag" : ""}">${r.note}</span>` : ""}</small></div>`;
    }).join("")}</div>`;
}

// ==========================================
// 4. ИНТЕРФЕЙС КРУТОК
// ==========================================
function renderBanners() {
    $("bannerSelect").innerHTML = Object.entries(BANNERS).map(([id, b]) =>
        `<button class="banner-btn ${id === curBanner ? "active" : ""}" data-b="${id}">${b.name}</button>`).join("");
    document.querySelectorAll(".banner-btn").forEach((el) => el.onclick = () => { curBanner = el.dataset.b; renderBanners(); renderPity(); });
    const b = BANNERS[curBanner], names = (a) => a.map((i) => ITEM(i).name).join(", ");
    $("bannerInfo").innerHTML = `Шанс S: <b>${(b.s * 100).toFixed(1)}%</b>, мягкий гарант с <b>${b.soft}</b>, жёсткий на <b>${b.hard}</b> • шанс A: <b>${(b.a * 100).toFixed(1)}%</b>, A гарантирован раз в 10 круток`
        + (b.featS.length ? `<br>S повышенного шанса: <b>${names(b.featS)}</b> (${b.upS * 100}/${100 - b.upS * 100}, после проигрыша следующий S — гарантированно он)` : `<br>S: <b>${names(b.poolS)}</b>, без 50/50`)
        + (b.featA.length ? `<br>A повышенного шанса: <b>${names(b.featA)}</b>` : "");
}

function renderPity() {
    const b = BANNERS[curBanner], st = state.ch[curBanner], next = st.pity + 1;
    const soft = next >= b.soft ? ` <span class="soft">• мягкий гарант! шанс S: ${Math.min(100, (b.s + (next - (b.soft - 1)) * SOFT_STEP) * 100).toFixed(1)}%</span>` : "";
    $("pityInfo").innerHTML = `До гаранта S: <span>${st.pity}</span> / ${b.hard} • до гаранта A: <span>${st.aPity}</span> / 10`
        + (b.upS ? `<br>Следующий S: <span>${st.gS ? "гарантированно повышенный" : "50/50".replace("50", b.upS * 100).replace("50", 100 - b.upS * 100)}</span>` : "") + soft;
}

function incomePerMin() {
    return state.team.reduce((sum, id) => id ? sum + ITEM(id).income + (state.levels[id] || 1) * 5 + mind(id) * 10 : sum, 0);
}
function renderTop() {
    $("moneyCount").textContent = state.money;
    $("incomeRate").textContent = `+${incomePerMin()}/мин`;
}
function tick() {
    const now = Date.now(), mins = Math.min(480, Math.floor((now - state.last) / 60000));
    if (mins > 0) {
        const gain = mins * incomePerMin();
        state.last += mins * 60000;
        if (now - state.last >= 60000) state.last = now;
        if (gain > 0) { state.money += gain; toast(`Доход: +${gain} ⬡`); }
        save(); renderTop();
    }
    $("incomeTimer").textContent = Math.ceil((60000 - (now - state.last)) / 1000) + " сек.";
}

// ==========================================
// 5. ВКЛАДКИ, ИСТОРИЯ, ИНВЕНТАРЬ
// ==========================================
function switchTab(tab) {
    document.querySelectorAll(".tab-content").forEach((el) => el.classList.add("hidden"));
    document.querySelectorAll(".tab-btn").forEach((el) => el.classList.toggle("active", el.dataset.tab === tab));
    $("tab-" + tab).classList.remove("hidden");
    if (tab === "history") renderHistory();
    if (tab === "inventory") renderInventory();
    if (tab === "characters") renderCharacters();
    if (tab === "squad") renderSquad();
}

function renderHistory() {
    $("historyList").innerHTML = state.history.length ? state.history.map((h) => {
        const it = ITEM(h.id), d = new Date(h.t);
        return `<div class="history-row"><span class="rk rarity-${h.rank}">${h.rank}</span>
            <span class="rarity-${h.rank}">${it.name} <small>• ${BANNERS[h.bid].name}${h.pity ? ` • гарант: ${h.pity}-я крутка` : ""}</small></span>
            <small>${d.toLocaleDateString()} ${d.toLocaleTimeString()}</small></div>`;
    }).join("") : `<div class="empty">Ты ещё не крутил сигналы.</div>`;
}

function freeCount(id) {
    let used = 0;
    Object.values(state.equip).forEach((e) => { used += e.disks.filter((d) => d === id).length + (e.weapon === id ? 1 : 0); });
    return (state.inv[id] || 0) - used;
}
const whoUses = (id) => Object.keys(state.equip).filter((c) => state.equip[c].weapon === id).map((c) => ITEM(c).name).join(", ");

function renderInventory() {
    const cards = (type) => ITEMS.filter((i) => i.type === type && state.inv[i.id]).map((i) => `
        <div class="char-card"><img src="${i.image}" alt=""><span class="rarity-${i.rarity}">${i.name}</span>
        <small>${i.type === "weapon" ? `R${state.inv[i.id]} • АТК ${i.atk}` : `${SETS[i.set].name} • ${STAT_NAMES[i.main[0]]} +${i.main[1]}`}</small>
        <small>${i.type === "weapon" ? (whoUses(i.id) ? "Надет: " + whoUses(i.id) : "Свободен") : `Свободно: ${freeCount(i.id)} из ${state.inv[i.id]}`}</small></div>`).join("");
    $("weaponGrid").innerHTML = cards("weapon") || `<div class="empty">Нет W-двигателей — крути канал W-двигателей.</div>`;
    $("diskGrid").innerHTML = cards("disk") || `<div class="empty">Нет дисков — они выпадают в каналах агентов.</div>`;
}

// ==========================================
// 6. АГЕНТЫ И ОТРЯД
// ==========================================
function renderCharacters() {
    const owned = ITEMS.filter((i) => i.type === "agent" && state.inv[i.id]).sort((a, b) => "SAB".indexOf(a.rarity) - "SAB".indexOf(b.rarity));
    $("characterList").innerHTML = owned.map((c) => `<div class="char-card" data-open="${c.id}">
        <img src="${c.image}" alt=""><span class="rarity-${c.rarity}">${c.name}</span>
        <small>Ур. ${state.levels[c.id] || 1} • M${mind(c.id)}</small>${state.team.includes(c.id) ? '<small class="intag">В отряде</small>' : ""}</div>`).join("")
        || `<div class="empty">У тебя нет агентов. Покрути канал агентов!</div>`;
}

function renderSquad() {
    let power = 0, hp = 0;
    $("squadCards").innerHTML = state.team.map((id, idx) => {
        if (!id) return `<div class="sq-card empty" data-add="${idx}"><div class="plus">+</div>Слот ${idx + 1}<small>Добавить агента</small></div>`;
        const it = ITEM(id), s = calcStats(id), eq = eqOf(id), inf = info(id), lvl = state.levels[id] || 1;
        power += s.atk; hp += s.hp;
        return `<div class="sq-card r-${it.rarity}">
            <img src="${it.image}" alt=""><h3 class="rarity-${it.rarity}">${it.name}</h3>
            <small>Ур. ${lvl} • M${mind(id)} • ${inf.elem} • ${inf.role}</small>
            <div class="sq-stats"><span>АТК <b>${s.atk}</b></span><span>HP <b>${s.hp}</b></span><span>Доход <b>+${it.income + lvl * 5 + mind(id) * 10}</b></span></div>
            <div class="sq-eq">W-двигатель: <b>${eq.weapon ? ITEM(eq.weapon).name : "—"}</b><br>Диски: <b>${eq.disks.filter(Boolean).length}/6</b></div>
            <div class="sq-actions"><button class="mini" data-open="${id}">Профиль</button><button class="mini dim" data-rm="${idx}">Убрать</button></div></div>`;
    }).join("");
    $("squadSummary").innerHTML = `<span>Доход отряда: <b>+${incomePerMin()} ⬡/мин</b></span><span>Суммарная АТК: <b>${power}</b></span><span>Суммарный HP: <b>${hp}</b></span>`;
    $("teamPicker").classList.add("hidden");
}

function openTeamPicker(idx) {
    const free = ITEMS.filter((i) => i.type === "agent" && state.inv[i.id] && !state.team.includes(i.id));
    const box = $("teamPicker");
    box.classList.remove("hidden");
    box.innerHTML = `<div class="title">Кого поставить в слот ${idx + 1}?</div>` +
        (free.length ? free.map((c) => `<button data-id="${c.id}">${c.name}</button>`).join("") : `<div class="empty">Нет свободных агентов.</div>`);
    box.querySelectorAll("button").forEach((b) => b.onclick = () => { state.team[idx] = b.dataset.id; save(); renderTop(); renderSquad(); });
}

// ==========================================
// 7. ПРОФИЛЬ И СНАРЯЖЕНИЕ
// ==========================================
function calcStats(id) {
    const it = ITEM(id), [h, a, d] = BASE[it.rarity], lvl = state.levels[id] || 1, inf = info(id);
    const k = 1 + 0.045 * (lvl - 1), eq = eqOf(id);
    const flat = { hp: 0, atk: 0, def: 0 }, pct = { hp: 0, atk: 0, def: 0 }, crit = { cr: 5, cd: 50 }, sets = {}, notes = [];
    const add = ([s, v]) => s.endsWith("%") ? (pct[s.slice(0, -1)] += v) : (s in crit ? (crit[s] += v) : (flat[s] += v));
    MINDS.slice(0, mind(id)).forEach((m) => (m.fx || []).forEach(add));
    const sk = skOf(id);
    pct.atk += sk.lv.reduce((x, l) => x + l - 1, 0) * 0.8 + sk.core * 3; pct.hp += sk.core * 3;

    if (eq.weapon) { const w = ITEM(eq.weapon); flat.atk += scaled(w.atk, w.id); add(w.sub); add([w.eff[0], w.eff[1] * state.inv[w.id]]); }
    eq.disks.forEach((did) => { if (did) { const dk = ITEM(did); add([dk.main[0], scaled(dk.main[1], did)]); sets[dk.set] = (sets[dk.set] || 0) + 1; } });
    Object.entries(sets).forEach(([s, n]) => {
        if (n >= 2) { add(SETS[s].b2); notes.push(`${SETS[s].name} (2): ${fmtBonus(SETS[s].b2)}`); }
        if (n >= 4) { add(SETS[s].b4); notes.push(`${SETS[s].name} (4): ${fmtBonus(SETS[s].b4)}`); }
    });
    return {
        hp: Math.round((h * k + flat.hp) * (1 + pct.hp / 100)),
        atk: Math.round((a * k + flat.atk) * (1 + pct.atk / 100)),
        def: Math.round((d * k + flat.def) * (1 + pct.def / 100)),
        cr: crit.cr.toFixed(1) + "%", cd: crit.cd.toFixed(0) + "%", impact: inf.impact,
        ap: Math.round(inf.ap * (1 + 0.02 * (lvl - 1))), am: Math.round(inf.am * (1 + 0.02 * (lvl - 1))), pen: "0%", er: inf.er.toFixed(1), notes
    };
}
function fmtVal([s, v]) { return `+${v}${s.endsWith("%") || s === "cr" || s === "cd" ? "%" : ""}`; }
function fmtBonus([s, v]) { return `${STAT_NAMES[s.replace("%", "")]} +${v}${s.endsWith("%") || s === "cr" || s === "cd" ? "%" : ""}`; }

function loadAgent(id) {
    currentCharId = id;
    const it = ITEM(id), inf = info(id);
    $("modalCharImg").src = it.image;
    $("modalCharName").textContent = it.name;
    $("modalCharRarity").textContent = it.rarity + "-РАНГ";
    $("modalCharRarity").className = "char-rarity rarity-" + it.rarity;
    $("modalChips").innerHTML = `<span>${inf.elem}</span><span>${inf.role}</span><span>${inf.faction}</span>`;
    renderModal();
}
function openModal(id) {
    loadAgent(id);
    setModalTab("stats");
    $("charModal").classList.remove("hidden");
}
function setModalTab(t) {
    if (t === "equip") { openEquip(); return; }
    document.querySelectorAll(".modal-tab").forEach((el) => el.classList.toggle("active", el.dataset.mtab === t));
    ["stats", "skills", "mind"].forEach((p) => $("modal-tab-" + p).classList.toggle("hidden", p !== t));
}
function renderModal() {
    const id = currentCharId, it = ITEM(id), lvl = state.levels[id] || 1, s = calcStats(id);
    const row = (n, v) => `<div class="stat-row"><span>${n}</span><b>${v}</b></div>`;
    $("statMeta").innerHTML = row("Уровень", lvl + " / 60") + row("Копии / Разум", `x${state.inv[id]} • M${mind(id)}/6`) +
        row("Доход", `+${it.income + lvl * 5 + mind(id) * 10} ⬡/мин`);
    $("statBox").innerHTML = row("HP", s.hp) + row("Сила атаки", s.atk) + row("Защита", s.def) + row("Импульс", s.impact) +
        row("Шанс крит.", s.cr) + row("Крит. урон", s.cd) + row("Контроль аномалии", s.ap) + row("Знание аномалии", s.am) +
        row("Шанс пробивания", s.pen) + row("Восст. энергии", s.er);
    $("setBonuses").innerHTML = s.notes.join("<br>");
    const cost = 100 + 20 * (lvl - 1);
    $("levelUpBtn").textContent = lvl >= 60 ? "Максимальный уровень" : `Прокачать уровень (${cost} ⬡)`;
    $("levelUpBtn").disabled = lvl >= 60;
    renderSkills(); renderMind(); renderStrip();
    $("cinemaLv").textContent = mind(id) + "/6";
}
function renderStrip() {
    $("agentStrip").innerHTML = ITEMS.filter((i) => i.type === "agent" && state.inv[i.id]).map((a) =>
        `<button class="strip-ag ${a.id === currentCharId ? "cur" : ""} ${state.team.includes(a.id) ? "inteam" : ""}" data-id="${a.id}" title="${a.name}"><img src="${a.image}" alt=""></button>`).join("");
}
function renderSkills() {
    const id = currentCharId, sk = skOf(id), cap = skillCap(id);
    const pill = (a, b) => `<div class="core-pill">${[a, b].map((i) => `<div class="core-node ${i < sk.core ? "on" : ""}">${CORE_LETTERS[i]}</div>`).join("")}</div>`;
    $("coreRow").innerHTML = pill(0, 1) + pill(2, 3) + pill(4, 5);
    $("coreUp").disabled = sk.core >= 6;
    $("coreUp").textContent = sk.core >= 6 ? "Основной навык: максимум (F)" : `Основной навык → ${CORE_LETTERS[sk.core]} (${300 * (sk.core + 1)} ⬡) • +3% АТК и HP`;
    $("skillRow").innerHTML = SKILLS.map((x, i) => `<div class="skill-card"><div class="skill-ic">${x.icon}</div><b>${x.name}</b>
        <div class="skill-lv">${String(sk.lv[i]).padStart(2, "0")}<small>/${cap}</small></div>
        <button class="mini" data-up="${i}" ${sk.lv[i] >= cap ? "disabled" : ""}>${sk.lv[i] >= cap ? "МАКС" : "+ " + (60 + 50 * sk.lv[i]) + " ⬡"}</button></div>`).join("");
}
function upgradeSkill(which) {
    const sk = skOf(currentCharId);
    let cost;
    if (which === "core") { if (sk.core >= 6) return; cost = 300 * (sk.core + 1); }
    else { if (sk.lv[+which] >= skillCap(currentCharId)) return; cost = 60 + 50 * sk.lv[+which]; }
    if (state.money < cost) return toast(`Нужно ${cost} ⬡`);
    state.money -= cost;
    if (which === "core") sk.core++; else sk.lv[+which]++;
    save(); renderTop(); renderModal();
}
function renderMind() {
    const m = mind(currentCharId), n = state.inv[currentCharId];
    $("mindList").innerHTML = MINDS.map((x, i) => `<div class="mind-card ${i < m ? "on" : ""}">
        <div class="mind-h"><b>${String(i + 1).padStart(2, "0")}</b>${i < m ? "РАЗУМ" : "ЗАБЛОКИРОВАНО"}</div>
        <div class="mind-b"><h4>${x.name}</h4><p>${x.desc}</p></div></div>`).join("");
    $("mindInfo").textContent = m >= 6 ? "Все разумы открыты. Лишние копии превращаются в полихромы."
        : `Копий: ${n} из 7 • следующий дубликат агента откроет Разум ${m + 1}`;
}
function levelUp() {
    const lvl = state.levels[currentCharId] || 1, cost = 100 + 20 * (lvl - 1);
    if (lvl >= 60) return;
    if (state.money < cost) return toast(`Нужно ${cost} ⬡`);
    state.money -= cost; state.levels[currentCharId] = lvl + 1;
    save(); renderTop(); renderModal();
}

const MAX_ITEM_LV = 10, LV_STEP = 0.12;
const lvOf = (id) => state.itemLv[id] || 0;
const scaled = (v, id) => Math.round(v * (1 + LV_STEP * lvOf(id)) * 10) / 10;
const slotType = () => (eqSlot === "w" ? "weapon" : "disk");
const slotItem = () => { const e = eqOf(currentCharId); return eqSlot === "w" ? e.weapon : e.disks[eqSlot]; };
const usedBy = (id) => Object.keys(state.equip).filter((c) => state.equip[c].weapon === id || state.equip[c].disks.includes(id)).map((c) => ITEM(c).name);

function openEquip() {
    eqSlot = "w"; eqFilter = "all"; eqItem = slotItem();
    $("eqTitle").textContent = ITEM(currentCharId).name;
    $("equipScreen").classList.remove("hidden");
    renderEquip();
}
function closeEquip() { $("equipScreen").classList.add("hidden"); renderModal(); }
function selectSlot(s) { eqSlot = s; eqItem = slotItem(); renderEquip(); }
function cycleFilter() { const o = ["all", "S", "A", "B"]; eqFilter = o[(o.indexOf(eqFilter) + 1) % o.length]; renderEquip(); }

function detailHtml(id) {
    const it = ITEM(id), lv = lvOf(id), n = state.inv[id], used = usedBy(id);
    const row = (a, b) => `<div class="stat-row"><span>${a}</span><b>${b}</b></div>`;
    const head = `<h2 class="rarity-${it.rarity}">${it.name}</h2>
        <div class="eq-badges"><span class="rk rarity-${it.rarity}">${it.rarity}</span><b>Ур. ${lv}/${MAX_ITEM_LV}</b></div>`;
    if (it.type === "weapon") {
        return head + `<div class="stars">${"★".repeat(n)}${"☆".repeat(MAX_COPIES.weapon - n)}</div>
            <h4>Базовые параметры</h4>${row("Базовая атака", scaled(it.atk, id))}
            <h4>Продвинутые параметры</h4>${row(STAT_NAMES[it.sub[0].replace("%", "")], fmtVal(it.sub))}
            <h4>Эффект усилителя</h4><p>${fmtBonus(it.eff)} за каждый ранг. Сейчас R${n}: <b>${fmtBonus([it.eff[0], it.eff[1] * n])}</b></p>
            <p class="muted">${used.length ? "Надет: " + used.join(", ") : "Свободен"}</p>`;
    }
    const set = SETS[it.set];
    return head + `<h4>Основной параметр</h4>${row(STAT_NAMES[it.main[0]], "+" + scaled(it.main[1], id))}
        <h4>Комплект: ${set.name}</h4><p>2 диска: ${fmtBonus(set.b2)}<br>4 диска: ${fmtBonus(set.b4)}</p>
        <p class="muted">Свободно: ${freeCount(id)} из ${n}${used.length ? " • надет: " + used.join(", ") : ""}</p>`;
}

function renderEquip() {
    const eq = eqOf(currentCharId), cur = slotItem();
    document.querySelectorAll(".ring-slot").forEach((el) => {
        const s = el.dataset.slot, id = s === "w" ? eq.weapon : eq.disks[+s];
        el.classList.toggle("selected", String(eqSlot) === s);
        el.innerHTML = id ? `<img src="${ITEM(id).image}" alt="">` : (s === "w" ? "W-ДВИГАТЕЛЬ" : +s + 1);
    });
    $("ringLv").textContent = eq.weapon ? `Ур. ${lvOf(eq.weapon)}/${MAX_ITEM_LV}` : "";
    $("eqMoney").textContent = state.money;
    $("eqFilter").textContent = "Фильтр: " + (eqFilter === "all" ? "все" : eqFilter + "-ранг");

    const items = ITEMS.filter((i) => i.type === slotType() && state.inv[i.id] && (eqFilter === "all" || i.rarity === eqFilter))
        .sort((a, b) => "SAB".indexOf(a.rarity) - "SAB".indexOf(b.rarity));
    if (!eqItem || !state.inv[eqItem] || ITEM(eqItem).type !== slotType()) eqItem = cur || (items[0] && items[0].id) || null;

    $("eqList").innerHTML = items.map((i) => `<div class="eq-tile ${i.rarity} ${i.id === eqItem ? "sel" : ""}" data-id="${i.id}">
        ${state.seen[i.id] ? "" : '<em class="new">NEW!</em>'}${i.id === cur ? '<em class="on">✔</em>' : ""}
        <img src="${i.image}" alt=""><span>Ур. ${lvOf(i.id)}</span></div>`).join("")
        || `<div class="empty">${slotType() === "weapon" ? "Нет W-двигателей." : "Нет дисков."}</div>`;
    document.querySelectorAll(".eq-tile").forEach((el) => el.onclick = () => { eqItem = el.dataset.id; state.seen[eqItem] = true; save(); renderEquip(); });

    $("eqDetail").innerHTML = eqItem ? detailHtml(eqItem) : `<div class="empty">Выбери слот справа и предмет слева.</div>`;

    const lv = eqItem ? lvOf(eqItem) : 0;
    $("eqEquip").disabled = !eqItem || eqItem === cur || freeCount(eqItem) <= 0;
    $("eqUnequip").disabled = !cur;
    $("eqUpgrade").disabled = !eqItem || lv >= MAX_ITEM_LV;
    $("eqUpgrade").textContent = eqItem && lv < MAX_ITEM_LV ? `Усилить (${80 + 40 * lv} ⬡)` : "Усилить";
}
function doEquip() {
    const eq = eqOf(currentCharId);
    if (eqSlot === "w") eq.weapon = eqItem; else eq.disks[eqSlot] = eqItem;
    save(); renderEquip();
}
function doUnequip() {
    const eq = eqOf(currentCharId);
    if (eqSlot === "w") eq.weapon = null; else eq.disks[eqSlot] = null;
    save(); renderEquip();
}
function doUpgrade() {
    const lv = lvOf(eqItem), cost = 80 + 40 * lv;
    if (lv >= MAX_ITEM_LV) return;
    if (state.money < cost) return toast(`Нужно ${cost} ⬡`);
    state.money -= cost; state.itemLv[eqItem] = lv + 1;
    save(); renderTop(); renderEquip();
}

// ==========================================
// 8. ЗАПУСК
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.onclick = () => switchTab(b.dataset.tab));
    document.querySelectorAll(".modal-tab").forEach((b) => b.onclick = () => setModalTab(b.dataset.mtab));
    document.querySelectorAll(".ring-slot").forEach((el) => el.onclick = () => selectSlot(el.dataset.slot === "w" ? "w" : +el.dataset.slot));
    $("eqBack").onclick = closeEquip; $("eqFilter").onclick = cycleFilter;
    $("eqEquip").onclick = doEquip; $("eqUnequip").onclick = doUnequip; $("eqUpgrade").onclick = doUpgrade;
    $("closeModalBtn").onclick = () => { $("charModal").classList.add("hidden"); renderCharacters(); renderSquad(); renderTop(); };
    $("cinemaBtn").onclick = () => setModalTab("mind");
    $("characterList").onclick = (e) => { const c = e.target.closest("[data-open]"); if (c) openModal(c.dataset.open); };
    $("squadCards").onclick = (e) => {
        const a = e.target.closest("[data-add]"), o = e.target.closest("[data-open]"), r = e.target.closest("[data-rm]");
        if (a) openTeamPicker(+a.dataset.add);
        else if (o) openModal(o.dataset.open);
        else if (r) { state.team[+r.dataset.rm] = null; save(); renderTop(); renderSquad(); }
    };
    $("levelUpBtn").onclick = levelUp;
    $("modal-tab-skills").onclick = (e) => { const b = e.target.closest("[data-up]"); if (b) upgradeSkill(b.dataset.up); };
    $("agentStrip").onclick = (e) => { const b = e.target.closest("[data-id]"); if (b) loadAgent(b.dataset.id); };
    $("roll1Btn").onclick = () => doRoll(1);
    $("roll10Btn").onclick = () => doRoll(10);

    renderTop(); renderBanners(); renderPity();
    setInterval(tick, 1000); tick();
});
