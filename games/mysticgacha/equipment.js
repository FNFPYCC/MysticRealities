// Проверяем, что gameState загружен из gacha.js
if (typeof gameState === 'undefined') {
    console.error("Ошибка: gameState не найден. Убедись, что gacha.js подключен первым.");
}

// --- ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК В ПРОФИЛЕ ---
function switchModalTab(tabName, btnElement) {
    document.querySelectorAll('.modal-tab').forEach(el => el.classList.remove('active'));
    btnElement.classList.add('active');

    document.getElementById('modal-tab-stats').classList.add('hidden');
    document.getElementById('modal-tab-equip').classList.add('hidden');

    document.getElementById(`modal-tab-${tabName}`).classList.remove('hidden');
    
    // Если открыли снаряжение — обновляем кружочки
    if (tabName === 'equip' && currentCharId) {
        updateEquipSlots();
    }
}

// --- НАДЕВАНИЕ ДИСКОВ ---
function equipDisk(slotIndex) {
    if (!currentCharId) return;

    // Ищем все диски в инвентаре
    const availableDisks = Object.keys(gameState.inventory).filter(id => {
        const item = ITEMS.find(i => i.id === id);
        return item && item.type === 'material';
    });

    if (availableDisks.length === 0) {
        return alert("У тебя нет дисков! Покрути гачу.");
    }

    // Спрашиваем, какой диск надеть
    let diskNames = availableDisks.map(id => {
        const item = ITEMS.find(i => i.id === id);
        return `${item.name} (В наличии: ${gameState.inventory[id]})`;
    }).join("\n");

    let chosenName = prompt(`Какой диск надеть в слот ${slotIndex + 1}?\n\n${diskNames}`);
    
    if (chosenName) {
        const chosenDiskId = availableDisks.find(id => ITEMS.find(i => i.id === id).name.toLowerCase() === chosenName.toLowerCase());
        
        if (chosenDiskId) {
            // Инициализируем массив дисков, если его нет
            if (!gameState.equippedDisks) gameState.equippedDisks = {};
            if (!gameState.equippedDisks[currentCharId]) {
                gameState.equippedDisks[currentCharId] = [null, null, null, null, null, null];
            }

            // Надеваем диск
            gameState.equippedDisks[currentCharId][slotIndex] = chosenDiskId;
            
            // Сохраняем и обновляем
            updateUI();
            updateEquipSlots();
            alert(`Диск "${chosenName}" надет!`);
        }
    }
}

// --- ОБНОВЛЕНИЕ КРУЖОЧКОВ В ПРОФИЛЕ ---
function updateEquipSlots() {
    if (!gameState.equippedDisks || !gameState.equippedDisks[currentCharId]) return;

    const equipped = gameState.equippedDisks[currentCharId];
    const slots = document.querySelectorAll('.equip-slot');

    slots.forEach((slot, index) => {
        if (equipped[index]) {
            slot.classList.add('equipped');
            slot.innerHTML = '✔'; // Показываем галочку, что диск надет
        } else {
            slot.classList.remove('equipped');
            slot.innerHTML = index + 1; // Возвращаем цифру
        }
    });
}