// Встроенные картинки-заглушки (чтобы не было битых иконок)
const PLACEHOLDER_CHAR = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23120a0c'/%3E%3Ccircle cx='50' cy='40' r='20' fill='%23ed263d'/%3E%3Crect x='20' y='65' width='60' height='30' rx='10' fill='%23ed263d'/%3E%3C/svg%3E";
const PLACEHOLDER_ITEM = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23120a0c'/%3E%3Crect x='25' y='25' width='50' height='50' fill='%23b84cf0'/%3E%3C/svg%3E";

const ITEMS = [
    { id: 'std_1', name: 'Time Lord (TL)', rarity: 'legendary', image: PLACEHOLDER_CHAR, pool: 'standard', type: 'character', baseIncome: 50 },
    { id: 'lim_1', name: 'Лимитированный', rarity: 'legendary', image: PLACEHOLDER_CHAR, pool: 'limited', type: 'character', baseIncome: 100 },
    { id: 'tl_1', name: 'Прототип TL', rarity: 'rare', image: PLACEHOLDER_CHAR, pool: 'any', type: 'character', baseIncome: 20 },
    { id: 'disk_1', name: 'Диск', rarity: 'epic', image: PLACEHOLDER_ITEM, pool: 'any', type: 'material' }
];

let gameState = JSON.parse(localStorage.getItem('gacha_state_v5')) || {
    money: 1600, 
    pityCount: 0, 
    guaranteed: false,
    inventory: {}, 
    team: [null, null, null, null] 
};

// --- ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ---
function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    btnElement.classList.add('active');

    if (tabId === 'inventory') renderInventory();
    if (tabId === 'characters') renderCharacters();
}

// --- ВЕРХНЯЯ ПАНЕЛЬ И ДОХОД ---
function updateUI() {
    document.getElementById('moneyCount').textContent = gameState.money;
    document.getElementById('pityDisplay').textContent = gameState.pityCount;
    document.getElementById('guaranteeStatus').textContent = gameState.guaranteed ? "(Гарант!)" : "";
    localStorage.setItem('gacha_state_v5', JSON.stringify(gameState));
}

function collectIncome() {
    const INCOME_INTERVAL = 60 * 1000; 
    const now = Date.now();
    const lastCollect = parseInt(localStorage.getItem('gacha_last_collect_v5')) || now;

    if (now - lastCollect >= INCOME_INTERVAL) {
        let totalIncome = 0;
        gameState.team.forEach(charId => {
            if (charId) {
                const char = ITEMS.find(i => i.id === charId);
                const copies = gameState.inventory[charId] || 1;
                if (char && char.baseIncome) totalIncome += char.baseIncome + (copies - 1) * 10;
            }
        });

        if (totalIncome > 0) {
            gameState.money += totalIncome;
            updateUI();
            showNotification(`Собрано ${totalIncome} 🪙!`);
        }
        localStorage.setItem('gacha_last_collect_v5', now);
    }
}

function updateTimer() {
    const INCOME_INTERVAL = 60 * 1000; 
    const now = Date.now();
    const lastCollect = parseInt(localStorage.getItem('gacha_last_collect_v5')) || now;
    const timeLeft = Math.max(0, INCOME_INTERVAL - (now - lastCollect));
    const timerEl = document.getElementById('incomeTimer');
    if (timerEl) timerEl.textContent = Math.ceil(timeLeft / 1000);
}

function showNotification(message) {
    const notif = document.createElement('div');
    notif.style.cssText = `position: fixed; top: 20px; right: 20px; background: var(--panel); border: 1px solid var(--bright); color: var(--text); padding: 15px 25px; border-radius: 8px; z-index: 1000; font-weight: bold;`;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}

// --- КРУТКИ ---
function doRoll(count) {
    if (gameState.money < 160 * count) { alert("Недостаточно монет!"); return; }
    gameState.money -= 160 * count;
    
    for (let i = 0; i < count; i++) {
        gameState.pityCount++;
        let isSRank = (gameState.pityCount >= 90) || (Math.random() < 0.006);

        let droppedItem;
        if (isSRank) {
            gameState.pityCount = 0;
            let isLimited = gameState.guaranteed ? true : Math.random() < 0.5;
            if (isLimited) { droppedItem = ITEMS.find(i => i.pool === 'limited'); gameState.guaranteed = false; }
            else { droppedItem = ITEMS.find(i => i.pool === 'standard'); gameState.guaranteed = true; }
        } else {
            const pool = ITEMS.filter(i => i.rarity !== 'legendary');
            droppedItem = pool[Math.floor(Math.random() * pool.length)];
        }

        if (gameState.inventory[droppedItem.id]) gameState.inventory[droppedItem.id] += 1;
        else gameState.inventory[droppedItem.id] = 1;
        
        if (i === count - 1) {
            document.getElementById('gachaPlaceholder').style.display = 'none';
            const card = document.getElementById('resultCard');
            card.classList.remove('hidden');
            document.getElementById('resultImage').src = droppedItem.image;
            document.getElementById('resultName').textContent = droppedItem.name;
            document.getElementById('resultRarity').textContent = droppedItem.rarity.toUpperCase();
            document.getElementById('resultRarity').className = `rarity-${droppedItem.rarity}`;
        }
    }
    updateUI();
}

// --- ОТРИСОВКА СПИСКОВ ---
function renderInventory() {
    const grid = document.getElementById('inventoryGrid');
    grid.innerHTML = '';
    for (const [id, count] of Object.entries(gameState.inventory)) {
        const item = ITEMS.find(i => i.id === id);
        if (!item || item.type === 'character') continue; 
        
        const el = document.createElement('div');
        el.className = 'char-card';
        el.innerHTML = `
            <div style="position: relative;">
                <img src="${item.image}">
                <span style="position: absolute; bottom: 0; right: 0; background: var(--bright); padding: 2px 6px; border-radius: 10px; font-size:12px;">x${count}</span>
            </div>
            <span class="rarity-${item.rarity}">${item.name}</span>
        `;
        grid.appendChild(el);
    }
}

function renderCharacters() {
    const teamSlots = document.getElementById('teamSlots');
    const charList = document.getElementById('characterList');
    teamSlots.innerHTML = '';
    charList.innerHTML = '';

    // 1. Отрисовка слотов команды
    gameState.team.forEach((charId, index) => {
        const slot = document.createElement('div');
        slot.className = `slot ${charId ? 'filled' : ''}`;
        
        if (charId) {
            const char = ITEMS.find(i => i.id === charId);
            slot.innerHTML = `
                <img src="${char.image}">
                <span>${char.name}</span>
            `;
            // Клик по занятому слоту убирает персонажа
            slot.onclick = () => { 
                gameState.team[index] = null; 
                renderCharacters(); 
                updateUI(); 
            };
        } else {
            slot.innerHTML = `<span>+</span>`;
            // Клик по пустому слоту добавляет первого доступного
            slot.onclick = () => {
                // Ищем любого персонажа, которого еще нет в команде
                const availableCharId = Object.keys(gameState.inventory).find(id => {
                    const item = ITEMS.find(i => i.id === id);
                    return item && item.type === 'character' && !gameState.team.includes(id);
                });

                if (availableCharId) {
                    gameState.team[index] = availableCharId;
                    renderCharacters();
                    updateUI();
                } else {
                    alert("У тебя нет свободных персонажей! Сначала покрути гачу.");
                }
            };
        }
        teamSlots.appendChild(slot);
    });

    // 2. Отрисовка списка всех персонажей
    for (const [id, count] of Object.entries(gameState.inventory)) {
        const char = ITEMS.find(i => i.id === id);
        
        if (char && char.type === 'character') {
            const el = document.createElement('div');
            el.className = 'char-card';
            el.innerHTML = `
                <img src="${char.image}">
                <span class="rarity-${char.rarity}">${char.name}</span>
                <small style="color: var(--muted); font-size: 11px;">Копии: x${count}</small>
            `;
            // Клик по карточке открывает профиль
            el.onclick = () => openCharModal(id);
            charList.appendChild(el);
        }
    }
}

// --- ПРОФИЛЬ ---
function openCharModal(charId) {
    const char = ITEMS.find(i => i.id === charId);
    const copies = gameState.inventory[charId] || 1;

    document.getElementById('modalCharImg').src = char.image;
    document.getElementById('modalCharName').textContent = char.name;
    document.getElementById('modalCharRarity').textContent = char.rarity.toUpperCase() + '-RANK';
    document.getElementById('modalCharCopies').textContent = `x${copies}`;
    document.getElementById('modalCharIncome').textContent = `+${char.baseIncome + (copies - 1) * 10} 🪙`;
    
    let mindLevel = Math.min(6, copies - 1); 
    document.getElementById('modalMindscapeLevel').textContent = `${Math.max(0, mindLevel)}/6`;

    document.getElementById('charModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('charModal').classList.add('hidden');
}

function showMindscape() {
    alert(`Уровень Разума: ${document.getElementById('modalMindscapeLevel').textContent}`);
}

// --- ЗАПУСК ---
document.addEventListener("DOMContentLoaded", () => {
    updateUI();
    document.getElementById('roll1Btn').onclick = () => doRoll(1);
    document.getElementById('roll10Btn').onclick = () => doRoll(10);
    setInterval(updateTimer, 1000);
    setInterval(collectIncome, 1000);
    collectIncome(); 
});