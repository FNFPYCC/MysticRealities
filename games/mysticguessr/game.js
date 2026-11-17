
// ==========================================
// MYSTICGUESSR — MysticRealities
// Сезоны, главы, 360° панорамы и метки
// ==========================================

// ==========================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// ==========================================

const mapCanvas = document.getElementById("worldMap");
const mapWidget = document.getElementById("mapWidget");

const expandMapButton = document.getElementById("expandMapButton");
const closeMapButton = document.getElementById("closeMapButton");
const resetMapButton = document.getElementById("resetMapButton");

const timerElement = document.getElementById("timer");
const coordinatesElement = document.getElementById("coordinates");
const resultElement = document.getElementById("result");
const guessButton = document.getElementById("guessButton");
const startButton = document.getElementById("startButton");
const roundInfo = document.getElementById("roundInfo");
const panoramaElement = document.getElementById("panorama");
const loadingElement = document.getElementById("loading");

if (!mapCanvas || !mapWidget || !timerElement ||
    !coordinatesElement || !resultElement ||
    !guessButton || !startButton || !roundInfo ||
    !panoramaElement || !loadingElement) {
    throw new Error("MysticGuessr: не найдены необходимые элементы HTML.");
}

const ctx = mapCanvas.getContext("2d");

if (!ctx) {
    throw new Error("MysticGuessr: не удалось создать Canvas-контекст карты.");
}

// ==========================================
// НАСТРОЙКИ ИГРЫ
// ==========================================

const WORLD_SIZE = 20000;
const ROUNDS = 5;
const ROUND_TIME = 180;

// ==========================================
// СОСТОЯНИЕ КАРТЫ
// ==========================================

let mapScale = 1;
let mapOffsetX = 0;
let mapOffsetY = 0;

let mapDragging = false;
let mapDragMoved = false;

let mapLastX = 0;
let mapLastY = 0;

let mapPointerStartX = 0;
let mapPointerStartY = 0;

// ==========================================
// ЛОКАЦИИ
// ==========================================

const LOCATIONS = [
    {
        name: "Season 1 — Cap 1",
        folder: "season1/cap1",
        x: -232,
        z: 684
    }

    // Следующая глава:
    //
    // ,{
    //     name: "Season 1 — Cap 2",
    //     folder: "season1/cap2",
    //     x: -2500,
    //     z: 1800
    // }
];

// ==========================================
// ПЕРЕМЕННЫЕ ИГРЫ
// ==========================================

let round = 1;
let score = 0;
let timeLeft = ROUND_TIME;
let timerInterval = null;

let target = null;
let guess = null;

let gameStarted = false;
let roundFinished = false;

let locationPool = [];

let panoramaScene = null;
let panoramaRenderer = null;
let panoramaCamera = null;

let panoramaYaw = 0;
let panoramaPitch = 0;

let panoramaRequestId = 0;

// ==========================================
// ПЕРЕМЕШИВАНИЕ ЛОКАЦИЙ
// ==========================================

function randomLocation() {
    if (LOCATIONS.length === 0) {
        throw new Error("Список LOCATIONS пуст!");
    }

    if (locationPool.length === 0) {
        locationPool = [...LOCATIONS];

        for (let i = locationPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));

            [locationPool[i], locationPool[j]] =
                [locationPool[j], locationPool[i]];
        }
    }

    return locationPool.pop();
}

// ==========================================
// ПИКСЕЛЬНАЯ КАРТА
// ==========================================

function generateMap() {
    const tiles = 64;
    const tileSize = mapCanvas.width / tiles;

    const colors = [
        "#477d3c",
        "#285b38",
        "#b9a45d",
        "#e0e5e9",
        "#397c83",
        "#68645d",
        "#71934a"
    ];

    let seed = 13579;

    function random() {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    }

    for (let y = 0; y < tiles; y++) {
        for (let x = 0; x < tiles; x++) {
            let colorIndex = Math.floor(random() * colors.length);

            if (x < 5 || x > 59 || y < 5 || y > 59) {
                colorIndex = 4;
            }

            if (x > 12 && x < 50 && y > 12 && y < 50) {
                if (random() > 0.65) {
                    colorIndex = 0;
                }
            }

            ctx.fillStyle = colors[colorIndex];

            ctx.fillRect(
                x * tileSize,
                y * tileSize,
                tileSize,
                tileSize
            );
        }
    }

    // Сетка
    ctx.strokeStyle = "#ffffff12";
    ctx.lineWidth = 1;

    for (let i = 0; i <= tiles; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i * tileSize, 0);
        ctx.lineTo(i * tileSize, mapCanvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * tileSize);
        ctx.lineTo(mapCanvas.width, i * tileSize);
        ctx.stroke();
    }
}

// ==========================================
// КООРДИНАТЫ
// ==========================================

function worldToMap(location) {
    return {
        x: (location.x / WORLD_SIZE + 0.5) * mapCanvas.width,
        y: (location.z / WORLD_SIZE + 0.5) * mapCanvas.height
    };
}

function mapToWorld(x, y) {
    return {
        x: Math.round((x / mapCanvas.width - 0.5) * WORLD_SIZE),
        z: Math.round((y / mapCanvas.height - 0.5) * WORLD_SIZE)
    };
}

// ==========================================
// ОГРАНИЧЕНИЕ ПЕРЕМЕЩЕНИЯ КАРТЫ
// ==========================================

function clampMapOffset() {
    const minOffset = mapCanvas.width * (1 - mapScale);

    mapOffsetX = Math.max(
        minOffset,
        Math.min(0, mapOffsetX)
    );

    mapOffsetY = Math.max(
        minOffset,
        Math.min(0, mapOffsetY)
    );

    if (mapScale <= 1) {
        mapScale = 1;
        mapOffsetX = 0;
        mapOffsetY = 0;
    }
}

// ==========================================
// МЕТКИ
// ==========================================

function drawMarker(position, color, radius = 10) {
    const p = worldToMap(position);

    ctx.beginPath();
    ctx.arc(p.x, p.y, radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = "#00000066";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();
}

// ==========================================
// ОТРИСОВКА КАРТЫ
// ==========================================

function drawMap() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.clearRect(
        0,
        0,
        mapCanvas.width,
        mapCanvas.height
    );

    clampMapOffset();

    ctx.setTransform(
        mapScale,
        0,
        0,
        mapScale,
        mapOffsetX,
        mapOffsetY
    );

    generateMap();

    if (guess) {
        drawMarker(guess, "#a77aff", 10);
    }

    if (roundFinished && target) {
        drawMarker(target, "#46e58c", 9);

        if (guess) {
            const g = worldToMap(guess);
            const p = worldToMap(target);

            ctx.beginPath();
            ctx.moveTo(g.x, g.y);
            ctx.lineTo(p.x, p.y);

            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ==========================================
// ПОЛУЧЕНИЕ КООРДИНАТ КУРСОРА
// ==========================================

function getMapPosition(event) {
    const rect = mapCanvas.getBoundingClientRect();

    const screenX =
        (event.clientX - rect.left) / rect.width * mapCanvas.width;

    const screenY =
        (event.clientY - rect.top) / rect.height * mapCanvas.height;

    return {
        x: (screenX - mapOffsetX) / mapScale,
        y: (screenY - mapOffsetY) / mapScale
    };
}

// ==========================================
// НАЧАЛО ПЕРЕМЕЩЕНИЯ
// ==========================================

mapCanvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    event.preventDefault();

    mapDragging = true;
    mapDragMoved = false;

    mapLastX = event.clientX;
    mapLastY = event.clientY;

    mapPointerStartX = event.clientX;
    mapPointerStartY = event.clientY;

    mapCanvas.setPointerCapture(event.pointerId);
});

// ==========================================
// ПЕРЕМЕЩЕНИЕ КАРТЫ
// ==========================================

mapCanvas.addEventListener("pointermove", (event) => {
    if (!mapDragging) return;

    const dx = event.clientX - mapLastX;
    const dy = event.clientY - mapLastY;

    if (
        Math.abs(event.clientX - mapPointerStartX) > 4 ||
        Math.abs(event.clientY - mapPointerStartY) > 4
    ) {
        mapDragMoved = true;
    }

    if (mapDragMoved) {
        const rect = mapCanvas.getBoundingClientRect();

        mapOffsetX += dx / rect.width * mapCanvas.width;
        mapOffsetY += dy / rect.height * mapCanvas.height;

        clampMapOffset();
        drawMap();
    }

    mapLastX = event.clientX;
    mapLastY = event.clientY;
});

// ==========================================
// ЗАВЕРШЕНИЕ ПЕРЕМЕЩЕНИЯ И УСТАНОВКА МЕТКИ
// ==========================================

function stopMapDragging(event) {
    if (!mapDragging) return;

    mapDragging = false;

    if (mapDragMoved) return;

    if (!gameStarted || roundFinished) return;

    const position = getMapPosition(event);

    if (
        position.x < 0 ||
        position.x > mapCanvas.width ||
        position.y < 0 ||
        position.y > mapCanvas.height
    ) {
        return;
    }

    guess = mapToWorld(position.x, position.y);

    coordinatesElement.textContent = "Метка установлена!";

    guessButton.disabled = false;

    drawMap();
}

mapCanvas.addEventListener("pointerup", stopMapDragging);

mapCanvas.addEventListener("pointercancel", () => {
    mapDragging = false;
});

// ==========================================
// МАСШТАБИРОВАНИЕ КОЛЁСИКОМ
// ==========================================

mapCanvas.addEventListener("wheel", (event) => {
    event.preventDefault();

    const rect = mapCanvas.getBoundingClientRect();

    const mouseX =
        (event.clientX - rect.left) / rect.width * mapCanvas.width;

    const mouseY =
        (event.clientY - rect.top) / rect.height * mapCanvas.height;

    const oldScale = mapScale;

    const zoomFactor = event.deltaY < 0 ? 1.15 : 1 / 1.15;

    mapScale = Math.max(
        1,
        Math.min(8, mapScale * zoomFactor)
    );

    const ratio = mapScale / oldScale;

    mapOffsetX = mouseX - (mouseX - mapOffsetX) * ratio;
    mapOffsetY = mouseY - (mouseY - mapOffsetY) * ratio;

    clampMapOffset();
    drawMap();

}, { passive: false });

// ==========================================
// СБРОС КАРТЫ
// ==========================================

function resetMap() {
    mapScale = 1;
    mapOffsetX = 0;
    mapOffsetY = 0;

    drawMap();
}

resetMapButton.addEventListener("click", resetMap);

// ==========================================
// РАЗВОРАЧИВАНИЕ КАРТЫ
// ==========================================

expandMapButton.addEventListener("click", () => {
    mapWidget.classList.add("expanded");

    requestAnimationFrame(drawMap);
});

closeMapButton.addEventListener("click", () => {
    mapWidget.classList.remove("expanded");

    requestAnimationFrame(drawMap);
});

// ==========================================
// ТАЙМЕР
// ==========================================

function updateTimer() {
    if (!gameStarted || roundFinished) return;

    timeLeft--;

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    timerElement.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    if (timeLeft <= 0) {
        clearInterval(timerInterval);
        finishRound();
    }
}

// ==========================================
// ЗАГРУЗКА ПАНОРАМЫ
// ==========================================

function loadPanorama(location) {
    if (!panoramaScene) return;

    const requestId = ++panoramaRequestId;

    const basePath =
        `../../assets/panoramas/${location.folder}/`;

    // Порядок CubeTextureLoader:
    // +X, -X, +Y, -Y, +Z, -Z
    // В этой конфигурации верх — panorama_4,
    // низ — panorama_5.

    const imagePaths = [
        basePath + "panorama_2.png",
        basePath + "panorama_3.png",
        basePath + "panorama_4.png",
        basePath + "panorama_5.png",
        basePath + "panorama_0.png",
        basePath + "panorama_1.png"
    ];

    loadingElement.textContent = `Загрузка: ${location.name}`;

    new THREE.CubeTextureLoader().load(
        imagePaths,

        (texture) => {
            if (requestId !== panoramaRequestId) {
                texture.dispose();
                return;
            }

            const oldTexture = panoramaScene.background;

            panoramaScene.background = texture;

            if (oldTexture && oldTexture.isCubeTexture) {
                oldTexture.dispose();
            }

            loadingElement.textContent = location.name;
        },

        undefined,

        (error) => {
            if (requestId !== panoramaRequestId) return;

            console.error("Ошибка загрузки панорамы:", error);

            loadingElement.textContent =
                `Ошибка загрузки: ${location.name}. Проверь текстуры.`;
        }
    );
}

// ==========================================
// НАЧАЛО РАУНДА
// ==========================================

function startRound() {
    if (LOCATIONS.length === 0) {
        resultElement.textContent =
            "Сначала добавь локацию в LOCATIONS.";
        return;
    }

    target = randomLocation();
    guess = null;

    timeLeft = ROUND_TIME;

    gameStarted = true;
    roundFinished = false;

    coordinatesElement.textContent = "Метка не установлена";
    resultElement.innerHTML = "";

    guessButton.disabled = true;

    startButton.disabled = true;
    startButton.textContent = "Раунд идёт";

    roundInfo.textContent = `Раунд ${round} / ${ROUNDS}`;
    timerElement.textContent = "03:00";

    resetMap();

    loadPanorama(target);

    clearInterval(timerInterval);

    timerInterval = setInterval(updateTimer, 1000);
}

// ==========================================
// РАССТОЯНИЕ
// ==========================================

function calculateDistance(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;

    return Math.round(Math.sqrt(dx * dx + dz * dz));
}

// ==========================================
// ЗАВЕРШЕНИЕ РАУНДА
// ==========================================

function finishRound() {
    if (roundFinished || !target) return;

    clearInterval(timerInterval);

    roundFinished = true;
    gameStarted = false;

    let gained = 0;
    let distance = null;

    if (guess) {
        distance = calculateDistance(target, guess);

        gained = Math.max(
            0,
            Math.round(5000 * Math.max(0, 1 - distance / 28284))
        );
    }

    score += gained;

    drawMap();

    resultElement.innerHTML = `
        <h3>Результат раунда!</h3>
        <p>Локация: ${target.name}</p>
        <p>Расстояние: ${distance === null ? "Ответ не дан" : distance + " блоков"}</p>
        <p>Получено очков: ${gained}</p>
        <p>Общий счёт: ${score}</p>
    `;

    coordinatesElement.textContent =
        guess ? "Метка проверена" : "Метка не установлена";

    guessButton.disabled = true;
    startButton.disabled = false;

    if (round < ROUNDS) {
        startButton.textContent = "Следующий раунд";
    } else {
        startButton.textContent = "Игра завершена";
        startButton.disabled = true;

        resultElement.innerHTML += `
            <h2>Игра окончена!</h2>
            <h2>Итог: ${score} / 25000</h2>
            <button onclick="location.reload()">Играть снова</button>
        `;
    }
}

// ==========================================
// КНОПКИ ИГРЫ
// ==========================================

guessButton.addEventListener("click", () => {
    if (!guess || !gameStarted) return;

    finishRound();
});

startButton.addEventListener("click", () => {
    if (roundFinished) {
        round++;
    }

    if (round <= ROUNDS) {
        startRound();
    }
});

// ==========================================
// FALLBACK-ПАНОРАМА
// ==========================================

function createFallbackCube() {
    const faces = [];

    const colors = [
        ["#76b9e8", "#477d3c"],
        ["#78bce9", "#3b713c"],
        ["#8dc9f1", "#3d7540"],
        ["#6a9fc8", "#385f37"],
        ["#75b8e7", "#4c8043"],
        ["#263c29", "#263c29"]
    ];

    colors.forEach((pair, index) => {
        const canvas = document.createElement("canvas");

        canvas.width = 256;
        canvas.height = 256;

        const c = canvas.getContext("2d");

        const gradient = c.createLinearGradient(0, 0, 0, 256);

        gradient.addColorStop(0, pair[0]);
        gradient.addColorStop(0.62, pair[0]);
        gradient.addColorStop(0.63, pair[1]);
        gradient.addColorStop(1, pair[1]);

        c.fillStyle = gradient;
        c.fillRect(0, 0, 256, 256);

        if (index !== 5) {
            for (let i = 0; i < 100; i++) {
                c.fillStyle = i % 2 ? "#315f32" : "#6a9747";

                c.fillRect(
                    Math.random() * 256,
                    160 + Math.random() * 90,
                    12,
                    12
                );
            }
        }

        faces.push(canvas);
    });

    const texture = new THREE.CubeTexture(faces);
    texture.needsUpdate = true;

    return texture;
}

// ==========================================
// СОЗДАНИЕ 360° ПАНОРАМЫ
// ==========================================

function createPanorama() {
    if (typeof THREE === "undefined") {
        loadingElement.textContent = "Ошибка: Three.js не загружен.";
        console.error("Three.js не найден.");
        return;
    }

    panoramaScene = new THREE.Scene();

    const width = Math.max(1, panoramaElement.clientWidth);
    const height = Math.max(1, panoramaElement.clientHeight);

    panoramaCamera = new THREE.PerspectiveCamera(
        75,
        width / height,
        0.1,
        1000
    );

    try {
        panoramaRenderer = new THREE.WebGLRenderer({
            antialias: true
        });
    } catch (error) {
        loadingElement.textContent = "Не удалось запустить WebGL.";
        console.error(error);
        return;
    }

    panoramaRenderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );

    panoramaRenderer.setSize(width, height);

    panoramaElement.appendChild(panoramaRenderer.domElement);

    panoramaCamera.rotation.order = "YXZ";
    panoramaScene.background = createFallbackCube();

    let dragging = false;

    let previousX = 0;
    let previousY = 0;

    const canvas = panoramaRenderer.domElement;

    canvas.style.touchAction = "none";

    canvas.addEventListener("pointerdown", (event) => {
        dragging = true;

        previousX = event.clientX;
        previousY = event.clientY;

        canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", (event) => {
        if (!dragging) return;

        panoramaYaw -= (event.clientX - previousX) * 0.004;
        panoramaPitch -= (event.clientY - previousY) * 0.004;

        panoramaPitch = Math.max(
            -1.45,
            Math.min(1.45, panoramaPitch)
        );

        previousX = event.clientX;
        previousY = event.clientY;
    });

    function stopDragging() {
        dragging = false;
    }

    canvas.addEventListener("pointerup", stopDragging);
    canvas.addEventListener("pointercancel", stopDragging);

    canvas.addEventListener("wheel", (event) => {
        panoramaCamera.fov += event.deltaY * 0.025;

        panoramaCamera.fov = Math.max(
            45,
            Math.min(95, panoramaCamera.fov)
        );

        panoramaCamera.updateProjectionMatrix();
    });

    function animate() {
        requestAnimationFrame(animate);

        panoramaCamera.rotation.y = panoramaYaw;
        panoramaCamera.rotation.x = panoramaPitch;

        panoramaRenderer.render(
            panoramaScene,
            panoramaCamera
        );
    }

    animate();

    window.addEventListener("resize", () => {
        const newWidth = panoramaElement.clientWidth;
        const newHeight = panoramaElement.clientHeight;

        if (!newWidth || !newHeight) return;

        panoramaCamera.aspect = newWidth / newHeight;
        panoramaCamera.updateProjectionMatrix();

        panoramaRenderer.setSize(newWidth, newHeight);
    });
}

// ==========================================
// ЗАПУСК
// ==========================================

mapCanvas.width = 512;
mapCanvas.height = 512;

generateMap();
drawMap();

timerElement.textContent = "03:00";
roundInfo.textContent = `Раунд 1 / ${ROUNDS}`;
coordinatesElement.textContent = "Метка не установлена";

createPanorama();
