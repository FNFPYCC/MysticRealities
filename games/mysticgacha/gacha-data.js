"use strict";
// ======================================================================
//  GACHA-DATA.JS — ВЕСЬ КОНТЕНТ ГАЧИ. Чтобы что-то добавить, правь только этот файл.
//
//  КАК ДОБАВИТЬ ПЕРСОНАЖА
//   1. Скопируй любую строку в AGENTS и поменяй id (латиницей, без пробелов, уникальный),
//      name, rarity ("S" или "A"), elem, role, faction, income и параметры.
//   2. Картинки положи в папку assets/gacha/ и впиши пути (от файла gacha.html):
//        image:  "../../assets/gacha/tl.png"        маленькая иконка
//        splash: "../../assets/gacha/tl_big.png"    большой арт на экране сигналов
//      Если пусто — рисуется заглушка.
//   3. limited: true — персонаж только для баннеров, в постоянный канал не попадает.
//   4. Чтобы он выпадал с повышенным шансом, впиши его id в featS нужного баннера (BANNERS ниже).
//  W-ДВИГАТЕЛЬ — строка в WEAPONS, ДИСК — строка в DISCS, БАННЕР — строка в BANNERS,
//  ТОВАР МАГАЗИНА — строка в SHOP. Для каждого типа в пуле нужен хотя бы один предмет.
// ======================================================================

const RANK_COLOR = { S: "#f5a623", A: "#b84cf0", B: "#4a90e2" };
const SHAPES = {
    agent: "<circle cx='50' cy='40' r='20' fill='C'/><rect x='20' y='65' width='60' height='30' rx='10' fill='C'/>",
    weapon: "<rect x='44' y='8' width='12' height='62' rx='4' fill='C'/><rect x='28' y='66' width='44' height='10' rx='3' fill='C'/><rect x='45' y='76' width='10' height='16' fill='C'/>",
    disk: "<circle cx='50' cy='50' r='40' fill='none' stroke='C' stroke-width='6'/><circle cx='50' cy='50' r='11' fill='C'/>"
};
const art = (type, rank) => "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='#120a0c'/>${SHAPES[type].replace(/C/g, RANK_COLOR[rank])}</svg>`);

// ---------- АГЕНТЫ ----------
// income — доход в полихромах за минуту; impact/ap/am/er — Импульс, Контроль аномалии, Знание аномалии, Восст. энергии
const AGENTS = [
    { id: "lim_1", name: "Лимитированный", rarity: "S", limited: true, elem: "Огонь", role: "Атака", faction: "Мистик Реалм", income: 100, impact: 120, ap: 95, am: 105, er: 1.2, image: "", splash: "" },
    { id: "std_1", name: "Time Lord (TL)", rarity: "S", elem: "Физ.", role: "Аномалия", faction: "Мистик Реалм", income: 50, impact: 95, ap: 120, am: 110, er: 1.2, image: "", splash: "" },
    { id: "std_2", name: "Стандартный S-2", rarity: "S", elem: "Лёд", role: "Поддержка", faction: "Мистик Реалм", income: 50, impact: 80, ap: 90, am: 90, er: 1.4, image: "", splash: "" },
    { id: "a_1", name: "Прототип TL", rarity: "A", elem: "Физ.", role: "Аномалия", faction: "Мистик Реалм", income: 20, impact: 86, ap: 116, am: 118, er: 1.2, image: "", splash: "" },
    { id: "a_2", name: "Агент A-2", rarity: "A", elem: "Электро", role: "Атака", faction: "Мистик Реалм", income: 20, impact: 100, ap: 90, am: 90, er: 1.2, image: "", splash: "" }
];

// ---------- W-ДВИГАТЕЛИ ----------
// atk — базовая атака; sub — продвинутый параметр; eff — эффект усилителя (стат: "atk%","hp%","def%","cr","cd")
const WEAPONS = [
    { id: "we_lim", name: "Лимитированный W-двигатель", rarity: "S", limited: true, atk: 713, sub: ["cd", 48], eff: ["atk%", 10] },
    { id: "we_std", name: "Стандартный W-двигатель", rarity: "S", atk: 713, sub: ["cr", 24], eff: ["atk%", 8] },
    { id: "we_a", name: "W-двигатель A", rarity: "A", atk: 594, sub: ["atk%", 18], eff: ["cd", 8] },
    { id: "we_b", name: "W-двигатель B", rarity: "B", atk: 400, sub: ["hp%", 15], eff: ["def%", 6] }
];

// ---------- ДИСКИ ----------
// set — ключ комплекта из SETS; main — основной параметр: ["atk"|"hp"|"def"|"cr"|"cd", значение]
const SETS = {
    fury: { name: "Ярость", b2: ["atk%", 10], b4: ["cr", 12] },
    bastion: { name: "Бастион", b2: ["hp%", 10], b4: ["def%", 25] },
    sharp: { name: "Острие", b2: ["cr", 8], b4: ["cd", 30] }
};
const DISCS = [
    { id: "disk_1", name: "Диск: Атака", rarity: "B", set: "fury", main: ["atk", 60] },
    { id: "disk_2", name: "Диск: Бастион", rarity: "B", set: "bastion", main: ["hp", 400] },
    { id: "disk_3", name: "Диск: Остриё", rarity: "B", set: "sharp", main: ["cr", 2.4] }
];

// ---------- БАННЕРЫ (каналы) ----------
// rule: "excl" (агент 50/50, билет Мастер-копия) | "std" (постоянный, билет Шифрокопия) | "weapon" (двигатель 75/25)
// featS / featA — id предметов повышенного шанса; end — дата окончания "ГГГГ-ММ-ДД" (без end — постоянный)
const BANNERS = [
    { id: "excl_1", rule: "excl", label: "Выделенный", name: "Эксклюзивный канал", title: "Ветер даст ответ", end: "2026-12-31", featS: ["lim_1"], featA: ["a_2"], color: "#0c1a4a" },
    { id: "weap_1", rule: "weapon", label: "Амплификация", name: "Канал W-двигателей", title: "Эхо усилителя", end: "2026-12-31", featS: ["we_lim"], featA: ["we_a"], color: "#3a1208" },
    { id: "std_1", rule: "std", label: "Стабильный", name: "Стандартный канал", title: "Постоянный поиск", featS: [], featA: [], color: "#10261d", icon: "📺" }
];

// ---------- ВАЛЮТЫ И ОТГОЛОСКИ ----------
const CURRENCY = {
    money: { name: "Полихромы", icon: "⬡" },
    echo: { name: "Отголоски", icon: "◈" },
    master: { name: "Мастер-копии", icon: "📼" },
    encrypted: { name: "Шифрокопии", icon: "🎞" }
};
const ECHOES = { S: 40, A: 20, B: 8 };   // сколько Отголосков даёт каждая попытка

// ---------- МАГАЗИН «РЕЕСТР СИГНАЛОВ» ----------
// currency — чем платим; give: { master: n } | { encrypted: n } | { item: "id" }; limit — лимит в месяц (null — без лимита)
const SHOP = [
    { id: "echo", name: "Отголоски сигнала", currency: "echo", items: [
        { key: "e_enc", name: "Шифрокопия", rank: "S", give: { encrypted: 1 }, price: 160, limit: null },
        { key: "e_mas", name: "Мастер-копия", rank: "S", give: { master: 1 }, price: 160, limit: null },
        { key: "e_we1", name: "Стандартный W-двигатель", rank: "S", give: { item: "we_std" }, price: 600, limit: 1 },
        { key: "e_we2", name: "W-двигатель A", rank: "A", give: { item: "we_a" }, price: 140, limit: 2 }
    ] },
    { id: "rev", name: "Реверберация сигнала", currency: "money", items: [
        { key: "r_enc", name: "Шифрокопия", rank: "S", give: { encrypted: 1 }, price: 90, limit: 3, sale: "40%" },
        { key: "r_mas", name: "Мастер-копия", rank: "S", give: { master: 1 }, price: 90, limit: 5, sale: "40%" },
        { key: "r_d1", name: "Диск: Атака", rank: "B", give: { item: "disk_1" }, price: 40, limit: 10 },
        { key: "r_d2", name: "Диск: Бастион", rank: "B", give: { item: "disk_2" }, price: 40, limit: 10 },
        { key: "r_d3", name: "Диск: Остриё", rank: "B", give: { item: "disk_3" }, price: 40, limit: 10 }
    ] },
    { id: "tape", name: "Покупка мастер-копий", currency: "money", items: [
        { key: "t_enc", name: "Шифрокопия", rank: "S", give: { encrypted: 1 }, price: 160, limit: null },
        { key: "t_mas", name: "Мастер-копия", rank: "S", give: { master: 1 }, price: 160, limit: null }
    ] }
];

// ---------- НАВЫКИ И РАЗУМ ----------
const SKILLS = [
    { name: "Базовая атака", icon: "✊" }, { name: "Уклонение", icon: "⮝" }, { name: "Поддержка", icon: "⇄" },
    { name: "Особая атака", icon: "✦" }, { name: "Цепная атака", icon: "☄" }
];
const MINDS = [
    { name: "Разминка", desc: "АТК +6%", fx: [["atk%", 6]] },
    { name: "Состояние потока", desc: "Крит. шанс +4%", fx: [["cr", 4]] },
    { name: "Всесторонние тренировки", desc: "Лимит уровня навыков +2", cap: true },
    { name: "Зажигаем вместе!", desc: "HP +10%", fx: [["hp%", 10]] },
    { name: "Мастер на все руки", desc: "Лимит уровня навыков +2", cap: true },
    { name: "Выход за пределы", desc: "Крит. урон +20%, АТК +10%", fx: [["cd", 20], ["atk%", 10]] }
];

// ---------- СБОРКА (не трогай) ----------
const ITEMS = [
    ...AGENTS.map((a) => ({ type: "agent", ...a })),
    ...WEAPONS.map((w) => ({ type: "weapon", ...w })),
    ...DISCS.map((d) => ({ type: "disk", ...d }))
].map((i) => ({ ...i, image: i.image || art(i.type, i.rarity) }));
