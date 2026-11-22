"use strict";
// Движок гачи. Контент (агенты, двигатели, диски, баннеры, магазин) лежит в gacha-data.js
const STAT_NAMES = { hp: "HP", atk: "АТК", def: "ЗАЩ", cr: "Крит. шанс", cd: "Крит. урон" };
const BASE = { S: [8000, 900, 650], A: [6800, 750, 550] };
const CORE_LETTERS = "ABCDEF";
// Правила каналов как в ZZZ: мягкий гарант +6% за попытку, жёсткий гарант S, гарант A раз в 10 попыток, 50/50 (у двигателей 75/25)
const RULES = {
    excl: { kind: "agent", ticket: "master", s: 0.006, soft: 74, hard: 90, a: 0.094, upS: 0.5, upA: 0.5 },
    std: { kind: "agent", ticket: "encrypted", s: 0.006, soft: 74, hard: 90, a: 0.094, upS: 0, upA: 0 },
    weapon: { kind: "weapon", ticket: "master", s: 0.01, soft: 65, hard: 80, a: 0.15, upS: 0.75, upA: 0.75 }
};
const TAPE_PRICE = 160, MAX_COPIES = { agent: 7 }, SOFT_STEP = 0.06;
const MAX_LV = { weapon: 60, disk: 15 }, LV_STEP = { weapon: 0.02, disk: 0.08 };

// ==========================================
// СОСТОЯНИЕ И ПРОФИЛИ
// ==========================================
const KEY = "gacha_zzz_v5";
const freshCh = () => ({ pity: 0, aPity: 0, gS: false, gA: false });
const fresh = () => ({ money: 1600, master: 5, encrypted: 3, echo: 0, ch: { excl: freshCh(), std: freshCh(), weapon: freshCh() },
    inv: {}, minds: {}, levels: {}, team: [null, null, null], equip: {}, gear: [], nextUid: 1, seen: {}, skills: {}, history: [],
    bought: {}, boughtMonth: "", last: Date.now(), savedAt: 0 });
let state = fresh(), profile = null;
let curId = BANNERS[0].id, curTab = "roll", currentCharId = null, eqSlot = "w", eqItem = null, eqFilter = "all";

const $ = (id) => document.getElementById(id);
const ITEM = (id) => ITEMS.find((i) => i.id === id);
const info = (id) => Object.assign({ faction: "—", elem: "Физ.", role: "Атака", impact: 100, ap: 90, am: 90, er: 1.2 }, ITEM(id));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const mind = (id) => Math.min(6, state.minds[id] || 0);                       // пробуждённые уровни Разума
const dupesLeft = (id) => Math.max(0, (state.inv[id] || 1) - 1 - mind(id));   // дубликаты, ещё не потраченные
const gearOf = (uid) => state.gear.find((g) => g.uid === uid);
const scaledG = (v, g) => Math.round(v * (1 + LV_STEP[ITEM(g.id).type] * g.lv) * 10) / 10;
const holder = (uid) => Object.keys(state.equip).find((c) => state.equip[c].weapon === uid || state.equip[c].disks.includes(uid)) || null;
const skOf = (id) => (state.skills[id] ||= { lv: [1, 1, 1, 1, 1], core: 0 });
// У агента могут быть свои уровни Разума (поле minds в gacha-content.js), иначе берутся общие
const mindsOf = (id) => { const m = ITEM(id).minds; return Array.isArray(m) && m.length === 6 ? m : MINDS; };
const skillCap = (id) => 12 + 2 * mindsOf(id).slice(0, mind(id)).filter((m) => m.cap).length;
const eqOf = (id) => (state.equip[id] ||= { disks: [null, null, null, null, null, null], weapon: null });
const curBanner = () => BANNERS.find((b) => b.id === curId) || BANNERS[0];

function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}
let cloudOn = false, cloudTimer = null;
function setCloud(text, bad) {
    const el = $("cloudState");
    el.textContent = text; el.className = "cloud" + (bad ? " bad" : "");
}
function save() {
    if (!profile) return;
    state.savedAt = Date.now();
    localStorage.setItem(KEY + ":" + profile, JSON.stringify(state));
    if (cloudOn) { setCloud("☁ синхронизация…"); clearTimeout(cloudTimer); cloudTimer = setTimeout(pushCloud, 4000); }
}
function pushCloud() {
    return CLOUD.save(profile, state).then(() => setCloud("☁ сохранено в GitHub"))
        .catch(() => { cloudOn = false; setCloud("☁ облако недоступно (нужно право gist) — прогресс хранится в браузере", true); });
}
// Вход выполнен: берём локальный прогресс игрока и сверяем с облаком — побеждает более свежий
function startSession(user) {
    profile = "gh_" + user.id; cloudOn = true;
    $("loginScreen").classList.add("hidden");
    $("profName").textContent = user.login;
    state = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY + ":" + profile) || "null"));
    renderAll();
    setCloud("☁ загрузка из GitHub…");
    CLOUD.load(profile).then((r) => {
        if (r && (r.savedAt || 0) > (state.savedAt || 0)) {
            state = Object.assign(fresh(), r);
            localStorage.setItem(KEY + ":" + profile, JSON.stringify(state));
            renderAll(); setCloud("☁ синхронизировано с GitHub");
        } else pushCloud();
    }).catch(() => { cloudOn = false; setCloud("☁ облако недоступно (нужно право gist) — прогресс хранится в браузере", true); });
}
function showLogin(msg, canLogin) {
    $("loginMsg").textContent = msg;
    $("ghBtn").style.display = canLogin ? "" : "none";
    $("loginScreen").classList.remove("hidden");
}
async function initAuth() {
    showLogin("Проверяем вход…", false);
    const user = await ghVerify();
    if (user) startSession(user);
    else showLogin("Для игры нужен вход через GitHub. Прогресс сохраняется в твоём аккаунте.", true);
}
function logoutGH() {
    clearTimeout(cloudTimer);
    if (profile && cloudOn) CLOUD.save(profile, state).catch(() => {});
    ghLogout(); profile = null; cloudOn = false;
    showLogin("Ты вышел из аккаунта. Войди через GitHub, чтобы продолжить.", true);
}
function exportSave() {
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
    prompt("Код сохранения (уже скопирован). Сохрани его, чтобы перенести прогресс на другое устройство:", code);
}
function importSave() {
    const code = prompt("Вставь код сохранения:");
    if (!code) return;
    try { state = Object.assign(fresh(), JSON.parse(decodeURIComponent(escape(atob(code.trim()))))); save(); renderAll(); toast("Сохранение загружено"); }
    catch (e) { toast("Неверный код сохранения"); }
}
function renderAll() { renderTop(); renderSig(); switchTab(curTab); }

// ==========================================
// КРУТКИ
// ==========================================
const poolIds = (type, rank, limited) => ITEMS.filter((i) => i.type === type && i.rarity === rank && (limited === undefined || !!i.limited === limited)).map((i) => i.id);
function runtime(b) {
    const r = RULES[b.rule], agent = r.kind === "agent";
    return { ...r, ...b, featS: b.featS || [], featA: b.featA || [],
        poolS: poolIds(r.kind, "S", false), poolA: poolIds(r.kind, "A"), poolB: poolIds(agent ? "disk" : "weapon", "B") };
}

function pullOnce(b) {
    const st = state.ch[b.rule];
    st.pity++; st.aPity++;
    const n = st.pity;
    const pS = n >= b.hard ? 1 : b.s + Math.max(0, n - (b.soft - 1)) * SOFT_STEP;
    if (Math.random() < pS) {
        st.pity = 0; st.aPity = 0;
        let id;
        if (b.upS && b.featS.length) {
            const lose = b.poolS.filter((x) => !b.featS.includes(x));
            const win = st.gS || Math.random() < b.upS || !lose.length;
            id = win ? pick(b.featS) : pick(lose);
            st.gS = !win;
        } else id = pick(b.poolS);
        return { id, rank: "S", pity: n };
    }
    if (st.aPity >= 10 || Math.random() < b.a) {
        st.aPity = 0;
        let id;
        const lose = b.poolA.filter((x) => !b.featA.includes(x));
        if (b.featA.length) {
            const win = st.gA || Math.random() < b.upA || !lose.length;
            id = win ? pick(b.featA) : pick(lose);
            st.gA = !win;
        } else id = pick(b.poolA);
        return { id, rank: "A" };
    }
    return { id: pick(b.poolB), rank: "B" };
}

// Агенты: дубликаты открывают Разум M1..M6. W-двигатели и диски не стакаются: каждый — отдельный предмет.
function give(id) {
    const it = ITEM(id);
    if (it.type !== "agent") {
        const first = !state.gear.some((g) => g.id === id);
        state.gear.push({ uid: state.nextUid++, id, lv: 0 });
        return first ? "NEW" : "";
    }
    const have = state.inv[id] || 0;
    if (have >= MAX_COPIES.agent) { state.money += 80; return "+80 ⬡"; }
    state.inv[id] = have + 1;
    if (!have) { state.levels[id] = 1; return "NEW"; }
    return "ДУБЛЬ";   // уровень Разума не растёт сам: игрок пробуждает его в «Ментальной картине»
}

function doRoll(count) {
    const b = runtime(curBanner()), t = b.ticket;
    if (!b.poolS.length || !b.poolA.length || !b.poolB.length) return toast("Баннер настроен неверно: в пуле нет предметов");
    if (state[t] < count) {
        const lack = count - state[t], cost = lack * TAPE_PRICE;
        if (state.money < cost) return toast(`Не хватает: ${CURRENCY[t].name} ×${lack}. Нужно ${cost} ⬡`);
        if (!confirm(`Не хватает ${CURRENCY[t].name} ×${lack}. Купить за ${cost} ⬡?`)) return;
        state.money -= cost; state[t] += lack;
    }
    state[t] -= count;
    const results = []; let echo = 0;
    for (let i = 0; i < count; i++) {
        const r = pullOnce(b);
        r.note = give(r.id);
        echo += ECHOES[r.rank];
        results.push(r);
        state.history.unshift({ id: r.id, rank: r.rank, bid: b.id, pity: r.pity || 0, t: Date.now() });
    }
    state.echo += echo;
    state.history = state.history.slice(0, 100);
    save(); renderTop(); renderSig(); showResults(results, echo);
}

function showResults(results, echo) {
    $("resGrid").className = "res-grid" + (results.length === 1 ? " single" : "");
    $("resGrid").innerHTML = results.map((r, i) => {
        const it = ITEM(r.id);
        return `<div class="res-wrap" style="animation-delay:${i * 0.12}s"><div class="res-card r-${r.rank}"><img src="${it.image}" alt="">
            <span class="res-rank">${r.rank}<small>RANK</small></span>${r.note ? `<em class="res-note">${r.note}</em>` : ""}</div>
            <div class="res-name rarity-${r.rank}">${it.name}</div></div>`;
    }).join("");
    $("resEcho").textContent = echo;
    $("resultScreen").classList.remove("hidden");
}

// ==========================================
// ЭКРАН СИГНАЛОВ, МАГАЗИН, ВЕРХНЯЯ ПАНЕЛЬ
// ==========================================
function incomePerMin() {
    return state.team.reduce((sum, id) => id ? sum + ITEM(id).income + (state.levels[id] || 1) * 5 + mind(id) * 10 : sum, 0);
}
const chipsHtml = () => ["encrypted", "master", "money", "echo"].map((k) =>
    `<div class="cur-chip" title="${CURRENCY[k].name}"><b>${state[k]}</b><i>${CURRENCY[k].icon}</i></div>`).join("");
function renderTop() {
    $("moneyCount").textContent = state.money;
    $("incomeRate").textContent = `+${incomePerMin()}/мин`;
    $("sigCur").innerHTML = chipsHtml();
    $("shopCur").innerHTML = chipsHtml();
}

function renderSig() {
    const b = runtime(curBanner()), st = state.ch[b.rule], tk = CURRENCY[b.ticket];
    const featItem = ITEM(b.featS[0]);
    $("sigSide").innerHTML = BANNERS.map((x) => {
        const f = x.featS && x.featS[0] ? ITEM(x.featS[0]) : null;
        return `<button class="sig-ch ${x.id === b.id ? "on" : ""}" data-b="${x.id}"><span class="sig-ico" ${f ? `style="background-image:url('${f.image}')"` : ""}>${f ? "" : (x.icon || "✦")}</span>
            <span><small>СИГНАЛ</small><b>${x.label}</b></span></button>`;
    }).join("");
    $("sigStage").style.background = `linear-gradient(135deg, ${b.color || "#0c1a4a"}, #05070f 80%)`;
    const big = featItem ? (featItem.splash || featItem.image) : "";
    $("sigChar").src = big; $("sigChar").style.display = big ? "block" : "none";
    $("sigTitle").textContent = b.title;
    const days = b.end ? Math.max(0, Math.ceil((new Date(b.end) - Date.now()) / 864e5)) : null;
    $("sigTime").textContent = days === null ? "Постоянный канал" : `Осталось ${days} д.`;
    const what = b.kind === "weapon" ? "S-двигателя" : "S-сигнала";
    $("sigText").innerHTML = b.featS.length
        ? `Шанс получения <span class="g">эксклюзивного ${what}</span>${b.featA.length ? ` и <span class="p">A-${b.kind === "weapon" ? "двигателей" : "сигналов"}</span>` : ""} повышен!`
        : `Все S-агенты постоянного пула выпадают в равных долях.`;
    $("sigName").innerHTML = featItem ? `<i>S</i>${featItem.name}` : "";
    $("sigName").style.display = featItem ? "block" : "none";
    $("sigA").innerHTML = b.featA.length ? `<i>A</i>` + b.featA.map((id) => `<img src="${ITEM(id).image}" alt="" title="${ITEM(id).name}">`).join("") : "";
    $("sigA").style.display = b.featA.length ? "flex" : "none";
    $("sigPity").innerHTML = `Попыток до гарантированного <span class="p">A</span>-сигнала: <b>${10 - st.aPity}</b><br>Попыток до гарантированного <span class="g">S</span>-сигнала: <b>${b.hard - st.pity}</b>`
        + (b.upS ? `<br><small>Следующий S: ${st.gS ? "гарантированно повышенный" : `${b.upS * 100}/${100 - b.upS * 100}`}</small>` : "");
    $("tk1").innerHTML = `${tk.icon} ×1 <small>(есть ${state[b.ticket]})</small>`;
    $("tk10").innerHTML = `${tk.icon} ×10`;
}

function showDetails() {
    const b = runtime(curBanner()), names = (a) => a.map((i) => ITEM(i).name).join(", ") || "—";
    $("detailsBody").innerHTML = `<h2>${b.title}</h2><p class="muted">${b.name}</p>
        <p>Шанс S: <b>${(b.s * 100).toFixed(1)}%</b> (мягкий гарант с ${b.soft}-й попытки, жёсткий на ${b.hard}-й)<br>
        Шанс A: <b>${(b.a * 100).toFixed(1)}%</b>, A гарантирован раз в 10 попыток<br>Билет: <b>${CURRENCY[b.ticket].name}</b></p>
        <p>${b.featS.length ? `S повышенного шанса: <b>${names(b.featS)}</b> (${b.upS * 100}% при попадании, после проигрыша следующий S гарантирован)` : `S в равных долях: <b>${names(b.poolS)}</b>`}</p>
        ${b.featA.length ? `<p>A повышенного шанса: <b>${names(b.featA)}</b></p>` : ""}
        <p class="muted">Попыток на этом баннере: ${state.history.filter((h) => h.bid === b.id).length}</p>`;
    $("detailsScreen").classList.remove("hidden");
}

// --- Магазин «Реестр сигналов» ---
let shopTab = SHOP[0].id;
const monthKey = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1); };
function boughtCount(key) {
    if (state.boughtMonth !== monthKey()) { state.boughtMonth = monthKey(); state.bought = {}; }
    return state.bought[key] || 0;
}
function openShop() { $("shopScreen").classList.remove("hidden"); renderShop(); }
function renderShop() {
    const tab = SHOP.find((t) => t.id === shopTab) || SHOP[0], cur = CURRENCY[tab.currency];
    $("shopTabs").innerHTML = SHOP.map((t) => `<button class="${t.id === tab.id ? "on" : ""}" data-t="${t.id}">${t.name}</button>`).join("");
    const cards = tab.items.map((it) => {
        const left = it.limit === null ? null : it.limit - boughtCount(it.key);
        const give = it.give, qty = give.item ? 1 : (give.master || give.encrypted);
        const icon = give.item ? `<img src="${ITEM(give.item).image}" alt="">` : CURRENCY[give.master ? "master" : "encrypted"].icon;
        return `<div class="shop-card r-${it.rank} ${left === 0 ? "sold" : ""}" data-key="${it.key}">${it.sale ? `<span class="sale">${it.sale}<br>OFF</span>` : ""}
            <div class="nm">${it.name}</div><div class="ic">${icon}</div><div class="qty">×${qty}</div>
            <div class="lim">${left === null ? "Неограниченно" : left === 0 ? "Распродано" : `В этом месяце ×${left}`}</div>
            <div class="pr"><span>${cur.icon}</span><b>${it.price}</b></div></div>`;
    });
    while (cards.length < 12) cards.push(`<div class="shop-card empty"><div class="ic">EMPTY</div></div>`);
    $("shopGrid").innerHTML = cards.join("");
}
function buy(key) {
    const tab = SHOP.find((t) => t.id === shopTab), it = tab.items.find((x) => x.key === key);
    if (!it) return;
    if (it.limit !== null && boughtCount(key) >= it.limit) return toast("Лимит на этот месяц исчерпан");
    if (state[tab.currency] < it.price) return toast(`Не хватает: ${CURRENCY[tab.currency].name}`);
    state[tab.currency] -= it.price;
    if (it.give.item) give(it.give.item);
    else if (it.give.master) state.master += it.give.master;
    else state.encrypted += it.give.encrypted;
    state.bought[key] = boughtCount(key) + 1;
    save(); renderTop(); renderShop(); renderSig();
    toast(`Получено: ${it.name}`);
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
    curTab = tab;
    document.querySelectorAll(".tab-content").forEach((el) => el.classList.add("hidden"));
    document.querySelectorAll(".tab-btn").forEach((el) => el.classList.toggle("active", el.dataset.tab === tab));
    $("tab-" + tab).classList.remove("hidden");
    if (tab === "roll") renderSig();
    if (tab === "history") renderHistory();
    if (tab === "inventory") renderInventory();
    if (tab === "characters") renderCharacters();
    if (tab === "squad") renderSquad();
}

function renderHistory() {
    $("historyList").innerHTML = state.history.length ? state.history.map((h) => {
        const it = ITEM(h.id), d = new Date(h.t);
        return `<div class="history-row"><span class="rk rarity-${h.rank}">${h.rank}</span>
            <span class="rarity-${h.rank}">${it.name} <small>• ${(BANNERS.find((x) => x.id === h.bid) || { name: "—" }).name}${h.pity ? ` • гарант: ${h.pity}-я крутка` : ""}</small></span>
            <small>${d.toLocaleDateString()} ${d.toLocaleTimeString()}</small></div>`;
    }).join("") : `<div class="empty">Ты ещё не крутил сигналы.</div>`;
}

function renderInventory() {
    const cards = (type) => state.gear.filter((g) => ITEM(g.id).type === type)
        .sort((a, b) => "SAB".indexOf(ITEM(a.id).rarity) - "SAB".indexOf(ITEM(b.id).rarity) || b.lv - a.lv || a.uid - b.uid)
        .map((g) => {
            const i = ITEM(g.id), w = holder(g.uid);
            return `<div class="char-card"><img src="${i.image}" alt=""><span class="rarity-${i.rarity}">${i.name}</span>
                <small>Ур. ${g.lv}/${MAX_LV[type]} • ${type === "weapon" ? "АТК " + scaledG(i.atk, g) : SETS[i.set].name + " • " + STAT_NAMES[i.main[0]] + " +" + scaledG(i.main[1], g)}</small>
                <small>${w ? "Надет: " + ITEM(w).name : "Свободен"}</small></div>`;
        }).join("");
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
            <div class="sq-eq">W-двигатель: <b>${eq.weapon ? ITEM(gearOf(eq.weapon).id).name : "—"}</b><br>Диски: <b>${eq.disks.filter(Boolean).length}/6</b></div>
            <div class="sq-actions"><button class="mini" data-open="${id}">Профиль</button><button class="mini" data-pick="${idx}">Заменить</button><button class="mini dim" data-rm="${idx}">Убрать</button></div></div>`;
    }).join("");
    $("squadSummary").innerHTML = `<span>Доход отряда: <b>+${incomePerMin()} ⬡/мин</b></span><span>Суммарная АТК: <b>${power}</b></span><span>Суммарный HP: <b>${hp}</b></span>`;
}

// --- Выбор агента в слот отряда (как в ZZZ) ---
let pickSlot = 0, pickId = null;
const ownedAgents = () => ITEMS.filter((i) => i.type === "agent" && state.inv[i.id])
    .sort((a, b) => "SAB".indexOf(a.rarity) - "SAB".indexOf(b.rarity) || (state.levels[b.id] || 1) - (state.levels[a.id] || 1));
function openPick(idx) {
    pickSlot = idx; pickId = state.team[idx] || (ownedAgents()[0] || {}).id || null;
    $("pickScreen").classList.remove("hidden"); renderPick();
}
function closePick() { $("pickScreen").classList.add("hidden"); renderSquad(); renderTop(); }
function renderPick() {
    const list = ownedAgents(), cur = state.team[pickSlot];
    if (!pickId || !state.inv[pickId]) pickId = list.length ? list[0].id : null;
    $("pkTitle").textContent = `Выбор агента — слот ${pickSlot + 1}`;
    $("pkGrid").innerHTML = list.map((a) => {
        const n = state.team.indexOf(a.id) + 1;
        return `<div class="pk-card r-${a.rarity} ${a.id === pickId ? "sel" : ""}" data-id="${a.id}">${n ? `<i class="pk-n">${n}</i>` : ""}
            <img src="${a.image}" alt=""><div class="pk-bar"><b>${a.rarity}</b>Ур. ${state.levels[a.id] || 1}<span>${info(a.id).elem}</span></div></div>`;
    }).join("") || `<div class="empty">У тебя пока нет агентов — покрути сигналы.</div>`;
    const a = pickId && ITEM(pickId);
    $("pkArt").src = a ? (a.splash || a.image) : ""; $("pkArt").style.display = a ? "block" : "none";
    $("pkName").textContent = a ? a.name : "";
    $("pkChips").innerHTML = a ? `<span>${info(a.id).elem}</span><span>${info(a.id).role}</span>` : "";
    $("pkAssign").textContent = cur ? "Заменить" : "В отряд";
    $("pkAssign").disabled = !a || pickId === cur;
}
function assignSlot(idx, id) {
    const j = state.team.indexOf(id);
    if (j >= 0 && j !== idx) state.team[j] = state.team[idx];   // агент уже в другом слоте — меняемся местами
    state.team[idx] = id;
    save();
}
function autoPick() {   // «Быстрый подбор»: три самых сильных агента по АТК
    state.team = ownedAgents().map((a) => ({ id: a.id, atk: calcStats(a.id).atk })).sort((a, b) => b.atk - a.atk).slice(0, 3).map((x) => x.id);
    while (state.team.length < 3) state.team.push(null);
    save(); renderPick(); renderTop();
}

// ==========================================
// 7. ПРОФИЛЬ И СНАРЯЖЕНИЕ
// ==========================================
function calcStats(id) {
    const it = ITEM(id), [h, a, d] = BASE[it.rarity], lvl = state.levels[id] || 1, inf = info(id);
    const k = 1 + 0.045 * (lvl - 1), eq = eqOf(id);
    const flat = { hp: 0, atk: 0, def: 0 }, pct = { hp: 0, atk: 0, def: 0 }, crit = { cr: 5, cd: 50 }, sets = {}, notes = [];
    const add = ([s, v]) => s.endsWith("%") ? (pct[s.slice(0, -1)] += v) : (s in crit ? (crit[s] += v) : (flat[s] += v));
    mindsOf(id).slice(0, mind(id)).forEach((m) => (m.fx || []).forEach(add));
    const sk = skOf(id);
    pct.atk += sk.lv.reduce((x, l) => x + l - 1, 0) * 0.8 + sk.core * 3; pct.hp += sk.core * 3;

    if (eq.weapon) { const g = gearOf(eq.weapon), w = ITEM(g.id); flat.atk += scaledG(w.atk, g); add(w.sub); add(w.eff); }
    eq.disks.forEach((uid) => { if (uid) { const g = gearOf(uid), dk = ITEM(g.id); add([dk.main[0], scaledG(dk.main[1], g)]); sets[dk.set] = (sets[dk.set] || 0) + 1; } });
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
    if (t === "mind") { openMind(); return; }
    document.querySelectorAll(".modal-tab").forEach((el) => el.classList.toggle("active", el.dataset.mtab === t));
    ["stats", "skills", "equip"].forEach((p) => $("modal-tab-" + p).classList.toggle("hidden", p !== t));
    $("charModal").classList.toggle("eqmode", t === "equip");
}
function renderModal() {
    const id = currentCharId, it = ITEM(id), lvl = state.levels[id] || 1, s = calcStats(id);
    const row = (n, v) => `<div class="stat-row"><span>${n}</span><b>${v}</b></div>`;
    $("statMeta").innerHTML = row("Уровень", lvl + " / 60") + row("Копии / Разум", `x${state.inv[id]} • M${mind(id)}/6`) + row("Дублей для Разума", dupesLeft(id)) +
        row("Доход", `+${it.income + lvl * 5 + mind(id) * 10} ⬡/мин`);
    $("statBox").innerHTML = row("HP", s.hp) + row("Сила атаки", s.atk) + row("Защита", s.def) + row("Импульс", s.impact) +
        row("Шанс крит.", s.cr) + row("Крит. урон", s.cd) + row("Контроль аномалии", s.ap) + row("Знание аномалии", s.am) +
        row("Шанс пробивания", s.pen) + row("Восст. энергии", s.er);
    $("setBonuses").innerHTML = s.notes.join("<br>");
    const cost = 100 + 20 * (lvl - 1);
    $("levelUpBtn").textContent = lvl >= 60 ? "Максимальный уровень" : `Прокачать уровень (${cost} ⬡)`;
    $("levelUpBtn").disabled = lvl >= 60;
    renderSkills(); renderStrip(); renderEquipView();
    $("cinemaLv").textContent = mind(id) + "/6";
    $("cinemaBtn").classList.toggle("alert", dupesLeft(id) > 0 && mind(id) < 6);
}
function renderEquipView() {
    const eq = eqOf(currentCharId);
    let html = "";
    eq.disks.forEach((uid, i) => {
        const g = uid && gearOf(uid);
        html += `<div class="ring-slot rs${i + 1}" data-view="${i}">${g ? `<img src="${ITEM(g.id).image}" alt="">` : i + 1}</div>`
            + (g ? `<div class="slv lv${i + 1}">Lv. ${g.lv}/${MAX_LV.disk}</div>` : "");
    });
    const w = eq.weapon && gearOf(eq.weapon);
    html += `<div class="ring-slot ring-w" data-view="w">${w ? `<img src="${ITEM(w.id).image}" alt="">` : "W-ДВИГАТЕЛЬ"}</div>`
        + (w ? `<div class="slv lvw">Lv. ${w.lv}/${MAX_LV.weapon}</div>` : "");
    $("viewRing").innerHTML = html;
    $("viewNotes").innerHTML = calcStats(currentCharId).notes.join("<br>") || "Надень 2 или 4 диска одного комплекта — получишь бонус.";
}
const stripHtml = () => ITEMS.filter((i) => i.type === "agent" && state.inv[i.id]).map((a) =>
    `<button class="strip-ag ${a.id === currentCharId ? "cur" : ""} ${state.team.includes(a.id) ? "inteam" : ""}" data-id="${a.id}" title="${a.name}"><img src="${a.image}" alt=""></button>`).join("");
function renderStrip() { $("agentStrip").innerHTML = stripHtml(); }
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
// --- «Ментальная картина»: дубликаты копятся, Разум пробуждает игрок ---
let awakenIdx = null;
function openMind() { renderMindScreen(); $("mindScreen").classList.remove("hidden"); }
function closeMind() { $("mindScreen").classList.add("hidden"); renderModal(); }
function renderMindScreen() {
    const id = currentCharId, it = ITEM(id), m = mind(id), left = dupesLeft(id), list = mindsOf(id);
    const st = (i) => (i < m ? "on" : (i === m && left > 0 ? "can" : "off"));
    $("msStrip").innerHTML = stripHtml();
    $("msArt").src = it.splash || it.image;
    $("msSide").innerHTML = list.map((x, i) => `<button class="ms-lv ${st(i)}" data-i="${i}"><b>${String(i + 1).padStart(2, "0")}</b><small>LEVEL</small></button>`
        + (i === 2 ? '<div class="ms-stage-t">STAGE</div>' : "")).join("") + `<div class="ms-dupes">Дублей: <b>${left}</b></div>`;
    $("msCards").innerHTML = list.map((x, i) => {
        const s = st(i);
        return `<div class="ms-card mc${i + 1} ${s}" data-i="${i}" title="${x.desc}"><span class="ms-n">${String(i + 1).padStart(2, "0")}</span>
            <div class="ms-h">${s === "on" ? "MIND" : s === "can" ? "ПРОБУДИТЬ" : "LOCKED"}${s === "can" ? '<i class="ms-bang">!</i>' : ""}</div><div class="ms-t">${x.name}</div></div>`;
    }).join("");
}
function askAwaken(i) {
    const id = currentCharId, m = mind(id), x = mindsOf(id)[i];
    if (i < m) return toast(`Разум ${i + 1} уже пробуждён: ${x.desc}`);
    if (i > m) return toast(`Сначала пробуди Разум ${m + 1}`);
    if (!dupesLeft(id)) return toast("Нужен дубликат агента — крути сигналы");
    awakenIdx = i;
    $("awTitle").textContent = x.name; $("awDesc").textContent = x.desc;
    $("awCount").textContent = `1/${dupesLeft(id)}`; $("awImg").src = ITEM(id).image;
    $("awakenScreen").classList.remove("hidden");
}
function doAwaken() {
    const id = currentCharId;
    if (awakenIdx !== mind(id) || !dupesLeft(id)) return;
    state.minds[id] = mind(id) + 1;
    save();
    $("awakenScreen").classList.add("hidden");
    toast(`Пробуждён Разум ${mind(id)}: ${mindsOf(id)[awakenIdx].name}`);
    renderMindScreen(); renderModal(); renderTop();
}
function levelUp() {
    const lvl = state.levels[currentCharId] || 1, cost = 100 + 20 * (lvl - 1);
    if (lvl >= 60) return;
    if (state.money < cost) return toast(`Нужно ${cost} ⬡`);
    state.money -= cost; state.levels[currentCharId] = lvl + 1;
    save(); renderTop(); renderModal();
}

const slotType = () => (eqSlot === "w" ? "weapon" : "disk");
const slotItem = () => { const e = eqOf(currentCharId); return eqSlot === "w" ? e.weapon : e.disks[eqSlot]; };
const upCost = (g) => (ITEM(g.id).type === "weapon" ? 40 + 10 * g.lv : 40 + 25 * g.lv);

function openEquip(slot = "w") {
    eqSlot = slot; eqFilter = "all"; eqItem = slotItem();
    $("eqTitle").textContent = ITEM(currentCharId).name;
    $("equipScreen").classList.remove("hidden");
    renderEquip();
}
function closeEquip() { $("equipScreen").classList.add("hidden"); renderModal(); }
function selectSlot(s) { eqSlot = s; eqItem = slotItem(); renderEquip(); }
function cycleFilter() { const o = ["all", "S", "A", "B"]; eqFilter = o[(o.indexOf(eqFilter) + 1) % o.length]; renderEquip(); }

function detailHtml(uid) {
    const g = gearOf(uid), it = ITEM(g.id), w = holder(uid);
    const row = (a, b) => `<div class="stat-row"><span>${a}</span><b>${b}</b></div>`;
    const head = `<h2 class="rarity-${it.rarity}">${it.name}</h2>
        <div class="eq-badges"><span class="rk rarity-${it.rarity}">${it.rarity}</span><b>Ур. ${g.lv}/${MAX_LV[it.type]}</b></div>`;
    const foot = `<p class="muted" style="margin-top:14px">${w ? (w === currentCharId ? "Надет на этом агенте" : "Надет у агента " + ITEM(w).name + " — сначала сними его там") : "Свободен"}</p>`;
    if (it.type === "weapon") {
        return head + `<h4>Базовые параметры</h4>${row("Базовая атака", scaledG(it.atk, g))}
            <h4>Продвинутые параметры</h4>${row(STAT_NAMES[it.sub[0].replace("%", "")], fmtVal(it.sub))}
            <h4>Эффект усилителя</h4><p>${fmtBonus(it.eff)}</p>` + foot;
    }
    const set = SETS[it.set];
    return head + `<h4>Основной параметр</h4>${row(STAT_NAMES[it.main[0]], "+" + scaledG(it.main[1], g))}
        <h4>Комплект: ${set.name}</h4><p>2 диска: ${fmtBonus(set.b2)}<br>4 диска: ${fmtBonus(set.b4)}</p>` + foot;
}

function renderEquip() {
    const eq = eqOf(currentCharId), cur = slotItem();
    document.querySelectorAll(".ring-slot[data-slot]").forEach((el) => {
        const s = el.dataset.slot, uid = s === "w" ? eq.weapon : eq.disks[+s];
        el.classList.toggle("selected", String(eqSlot) === s);
        el.innerHTML = uid ? `<img src="${ITEM(gearOf(uid).id).image}" alt="">` : (s === "w" ? "W-ДВИГАТЕЛЬ" : +s + 1);
    });
    $("ringLv").textContent = eq.weapon ? `Ур. ${gearOf(eq.weapon).lv}/${MAX_LV.weapon}` : "";
    $("eqMoney").textContent = state.money;
    $("eqFilter").textContent = "Фильтр: " + (eqFilter === "all" ? "все" : eqFilter + "-ранг");

    const items = state.gear.filter((g) => ITEM(g.id).type === slotType() && (eqFilter === "all" || ITEM(g.id).rarity === eqFilter))
        .sort((a, b) => "SAB".indexOf(ITEM(a.id).rarity) - "SAB".indexOf(ITEM(b.id).rarity) || b.lv - a.lv || a.uid - b.uid);
    if (!eqItem || !gearOf(eqItem) || ITEM(gearOf(eqItem).id).type !== slotType()) eqItem = cur || (items[0] && items[0].uid) || null;

    $("eqList").innerHTML = items.map((g) => {
        const i = ITEM(g.id), w = holder(g.uid);
        return `<div class="eq-tile ${i.rarity} ${g.uid === eqItem ? "sel" : ""}" data-uid="${g.uid}">
            ${state.seen[g.uid] ? "" : '<em class="new">NEW!</em>'}${g.uid === cur ? '<em class="on">✔</em>' : ""}
            ${w ? `<img class="wear" src="${ITEM(w).image}" alt="">` : ""}<img src="${i.image}" alt=""><span>Ур. ${g.lv}</span></div>`;
    }).join("") || `<div class="empty">${slotType() === "weapon" ? "Нет W-двигателей." : "Нет дисков."}</div>`;
    document.querySelectorAll(".eq-tile").forEach((el) => el.onclick = () => { eqItem = +el.dataset.uid; state.seen[eqItem] = true; save(); renderEquip(); });

    $("eqDetail").innerHTML = eqItem ? detailHtml(eqItem) : `<div class="empty">Выбери слот справа и предмет слева.</div>`;

    const g = eqItem && gearOf(eqItem);
    $("eqEquip").textContent = cur ? "Заменить" : "Экипировать";
    $("eqEquip").disabled = !g || eqItem === cur || !!holder(eqItem);
    $("eqUnequip").disabled = !cur;
    const max = g ? MAX_LV[ITEM(g.id).type] : 0;
    $("eqUpgrade").disabled = !g || g.lv >= max;
    $("eqUpgrade").textContent = g && g.lv < max ? `Усилить (${upCost(g)} ⬡)` : (g ? "Макс. уровень" : "Усилить");
}
function doEquip() {
    if (!eqItem || holder(eqItem)) return toast("Этот предмет уже надет");
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
    const g = gearOf(eqItem);
    if (!g || g.lv >= MAX_LV[ITEM(g.id).type]) return;
    const cost = upCost(g);
    if (state.money < cost) return toast(`Нужно ${cost} ⬡`);
    state.money -= cost; g.lv++;
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
    $("closeModalBtn").onclick = () => { $("charModal").classList.add("hidden"); renderCharacters(); renderSquad(); renderTop(); if (!$("pickScreen").classList.contains("hidden")) renderPick(); };
    $("cinemaBtn").onclick = () => setModalTab("mind");
    $("pkGrid").onclick = (e) => { const c = e.target.closest("[data-id]"); if (c) { pickId = c.dataset.id; renderPick(); } };
    $("pkAssign").onclick = () => { assignSlot(pickSlot, pickId); closePick(); };
    $("pkCancel").onclick = closePick; $("pkAuto").onclick = autoPick;
    document.querySelectorAll("[data-pktab]").forEach((b) => b.onclick = () => { if (pickId) { openModal(pickId); setModalTab(b.dataset.pktab); } });
    $("msBack").onclick = closeMind;
    $("msSide").onclick = (e) => { const b = e.target.closest("[data-i]"); if (b) askAwaken(+b.dataset.i); };
    $("msCards").onclick = (e) => { const b = e.target.closest("[data-i]"); if (b) askAwaken(+b.dataset.i); };
    $("msStrip").onclick = (e) => { const b = e.target.closest("[data-id]"); if (b) { loadAgent(b.dataset.id); renderMindScreen(); } };
    $("awCancel").onclick = () => $("awakenScreen").classList.add("hidden"); $("awOk").onclick = doAwaken;
    $("viewRing").onclick = (e) => { const b = e.target.closest("[data-view]"); if (b) openEquip(b.dataset.view === "w" ? "w" : +b.dataset.view); };
    $("characterList").onclick = (e) => { const c = e.target.closest("[data-open]"); if (c) openModal(c.dataset.open); };
    $("squadCards").onclick = (e) => {
        const a = e.target.closest("[data-add]"), o = e.target.closest("[data-open]"), r = e.target.closest("[data-rm]"), p = e.target.closest("[data-pick]");
        if (a) openPick(+a.dataset.add);
        else if (p) openPick(+p.dataset.pick);
        else if (o) openModal(o.dataset.open);
        else if (r) { state.team[+r.dataset.rm] = null; save(); renderTop(); renderSquad(); }
    };
    $("levelUpBtn").onclick = levelUp;
    $("modal-tab-skills").onclick = (e) => { const b = e.target.closest("[data-up]"); if (b) upgradeSkill(b.dataset.up); };
    $("agentStrip").onclick = (e) => { const b = e.target.closest("[data-id]"); if (b) loadAgent(b.dataset.id); };
    $("roll1Btn").onclick = () => doRoll(1);
    $("roll10Btn").onclick = () => doRoll(10);

    $("sigSide").onclick = (e) => { const b = e.target.closest("[data-b]"); if (b) { curId = b.dataset.b; renderSig(); } };
    $("sigRegistry").onclick = openShop;
    $("sigDetails").onclick = showDetails;
    $("detailsClose").onclick = () => $("detailsScreen").classList.add("hidden");
    $("resultScreen").onclick = () => $("resultScreen").classList.add("hidden");
    $("shopBack").onclick = () => $("shopScreen").classList.add("hidden");
    $("shopTabs").onclick = (e) => { const b = e.target.closest("[data-t]"); if (b) { shopTab = b.dataset.t; renderShop(); } };
    $("shopGrid").onclick = (e) => { const c = e.target.closest("[data-key]"); if (c) buy(c.dataset.key); };
    $("ghBtn").onclick = ghLogin;
    $("profSwitch").onclick = logoutGH; $("saveExport").onclick = exportSave; $("saveImport").onclick = importSave;
    window.addEventListener("gh-auth", initAuth);

    setInterval(tick, 1000);
    initAuth();
});
