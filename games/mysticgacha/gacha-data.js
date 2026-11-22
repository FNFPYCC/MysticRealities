"use strict";
// ======================================================================
//  GACHA-DATA.JS — сборка контента. Сами данные (агенты, двигатели, диски, баннеры, магазин, Разум)
//  лежат в gacha-content.js. Менять их удобнее всего редактором gacha-editor.py (запусти его двойным кликом
//  или командой: python gacha-editor.py). Здесь править ничего не нужно.
// ======================================================================

const RANK_COLOR = { S: "#f5a623", A: "#b84cf0", B: "#4a90e2" };
const SHAPES = {
    agent: "<circle cx='50' cy='40' r='20' fill='C'/><rect x='20' y='65' width='60' height='30' rx='10' fill='C'/>",
    weapon: "<rect x='44' y='8' width='12' height='62' rx='4' fill='C'/><rect x='28' y='66' width='44' height='10' rx='3' fill='C'/><rect x='45' y='76' width='10' height='16' fill='C'/>",
    disk: "<circle cx='50' cy='50' r='40' fill='none' stroke='C' stroke-width='6'/><circle cx='50' cy='50' r='11' fill='C'/>"
};
// Заглушка-картинка, пока для предмета не указана своя
const art = (type, rank) => "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='#120a0c'/>${SHAPES[type].replace(/C/g, RANK_COLOR[rank])}</svg>`);

const AGENTS = CONTENT.agents, WEAPONS = CONTENT.weapons, DISCS = CONTENT.discs, SETS = CONTENT.sets;
const BANNERS = CONTENT.banners, SHOP = CONTENT.shop, ECHOES = CONTENT.echoes, MINDS = CONTENT.minds;

const CURRENCY = {
    money: { name: "Полихромы", icon: "⬡" },
    echo: { name: "Отголоски", icon: "◈" },
    master: { name: "Мастер-копии", icon: "📼" },
    encrypted: { name: "Шифрокопии", icon: "🎞" }
};
const SKILLS = [
    { name: "Базовая атака", icon: "✊" }, { name: "Уклонение", icon: "⮝" }, { name: "Поддержка", icon: "⇄" },
    { name: "Особая атака", icon: "✦" }, { name: "Цепная атака", icon: "☄" }
];

const ITEMS = [
    ...AGENTS.map((a) => ({ type: "agent", ...a })),
    ...WEAPONS.map((w) => ({ type: "weapon", ...w })),
    ...DISCS.map((d) => ({ type: "disk", ...d }))
].map((i) => ({ ...i, image: i.image || art(i.type, i.rarity) }));
