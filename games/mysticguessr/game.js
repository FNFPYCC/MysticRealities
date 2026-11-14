
// ==========================================
// MYSTICGUESSR — MysticRealities
// Сезоны, главы, 360° панорамы и метки
// ==========================================

// Элементы страницы
const mapCanvas = document.getElementById("worldMap");
const ctx = mapCanvas.getContext("2d");

const timerElement = document.getElementById("timer");
const coordinatesElement = document.getElementById("coordinates");
const resultElement = document.getElementById("result");
const guessButton = document.getElementById("guessButton");
const startButton = document.getElementById("startButton");
const roundInfo = document.getElementById("roundInfo");
const panoramaElement = document.getElementById("panorama");
const loadingElement = document.getElementById("loading");

// ==========================================
// НАСТРОЙКИ ИГРЫ
// ==========================================

const WORLD_SIZE = 20000;
const ROUNDS = 5;
const ROUND_TIME = 180;

// ==========================================
// СПИСОК ЛОКАЦИЙ
// ==========================================

// Каждая глава имеет:
// name   — название главы
// folder — путь к папке с шестью текстурами
// x      — координата X в Minecraft
// z      — координата Z в Minecraft

const LOCATIONS = [
    {
        name: "Season 1 — Cap 1",
        folder: "season1/cap1",
        x: 1250,
        z: -3400
    }

    // Пример добавления следующей главы:
    //
    // ,{
    //     name: "Season 1 — Cap 2",
    //     folder: "season1/cap2",
    //     x: -2500,
    //     z: 1800
    // }
    //
    // Следующие сезоны добавляются точно так же.
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

    // Когда все локации использованы,
    // создаём новый перемешанный набор.
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

            // Внешняя область воды
            if (x < 5 || x > 59 || y < 5 || y > 59) {
                colorIndex = 4;
            }

            // Центральная область суши
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

    // Пиксельная сетка
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
// КООРДИНАТЫ И КАРТА
// ==========================================

function worldToMap(location) {
    return {
        x: (location.x / WORLD_SIZE + 0.5) * mapCanvas.width,
        y: (location.z / WORLD_SIZE + 0.5) * mapCanvas.height
    };
}

function mapToWorld(x, y) {
    return {
        x: Math.round(
            (x / mapCanvas.width - 0.5) * WORLD_SIZE
        ),
        z: Math.round(
            (y / mapCanvas.height - 0.5) * WORLD_SIZE
        )
    };
}

// ==========================================
// ОТРИСОВКА МЕТОК
// ==========================================

function drawMarker(position, color, radius = 10) {
    const p = worldToMap(position);

    // Тень метки
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = "#00000066";
    ctx.fill();

    // Основная метка
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();
}

function drawMap() {
    generateMap();

    // Метка игрока
    if (guess) {
        drawMarker(guess, "#a77aff", 10);
    }

    // Правильная метка
    if (roundFinished && target) {
        drawMarker(target, "#46e58c", 9);

        // Линия между метками
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
}

// ==========================================
// ВЫБОР МЕТКИ НА КАРТЕ
// ==========================================

mapCanvas.addEventListener("click", (event) => {
    if (!gameStarted || roundFinished) return;

    const rect = mapCanvas.getBoundingClientRect();

    const x =
        (event.clientX - rect.left) /
        rect.width * mapCanvas.width;

    const y =
        (event.clientY - rect.top) /
        rect.height * mapCanvas.height;

    guess = mapToWorld(x, y);

    coordinatesElement.textContent = "Метка установлена!";

    guessButton.disabled = false;

    drawMap();
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

    // Номер запроса нужен, чтобы старое изображение
    // не заменило панораму нового раунда.
    const requestId = ++panoramaRequestId;

    const basePath =
        `../../assets/panoramas/${location.folder}/`;

    const imagePaths = [
        basePath + "px.jpg",
        basePath + "nx.jpg",
        basePath + "py.jpg",
        basePath + "ny.jpg",
        basePath + "pz.jpg",
        basePath + "nz.jpg"
    ];

    loadingElement.textContent =
        `Загрузка: ${location.name}`;

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

            console.error(
                "Ошибка загрузки панорамы:",
                location.name,
                error
            );

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
            "Сначала добавь хотя бы одну локацию в LOCATIONS.";
        return;
    }

    target = randomLocation();
    guess = null;

    timeLeft = ROUND_TIME;

    gameStarted = true;
    roundFinished = false;

    coordinatesElement.textContent =
        "Метка не установлена";

    resultElement.innerHTML = "";

    guessButton.disabled = true;

    startButton.disabled = true;
    startButton.textContent = "Раунд идёт";

    roundInfo.textContent =
        `Раунд ${round} / ${ROUNDS}`;

    timerElement.textContent = "03:00";

    loadPanorama(target);

    drawMap();

    clearInterval(timerInterval);

    timerInterval = setInterval(updateTimer, 1000);
}

// ==========================================
// РАСЧЁТ РАССТОЯНИЯ
// ==========================================

function calculateDistance(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;

    return Math.round(
        Math.sqrt(dx * dx + dz * dz)
    );
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
            Math.round(
                5000 * Math.max(0, 1 - distance / 28284)
            )
        );
    }

    score += gained;

    drawMap();

    resultElement.innerHTML = `
        <h3>Результат раунда!</h3>

        <p>Локация: ${target.name}</p>

        <p>
            Расстояние:
            ${distance === null
                ? "Ответ не дан"
                : distance + " блоков"}
        </p>

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
            <button onclick="location.reload()">
                Играть снова
            </button>
        `;
    }
}

// ==========================================
// КНОПКИ
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

        const gradient = c.createLinearGradient(
            0, 0, 0, 256
        );

        gradient.addColorStop(0, pair[0]);
        gradient.addColorStop(0.62, pair[0]);
        gradient.addColorStop(0.63, pair[1]);
        gradient.addColorStop(1, pair[1]);

        c.fillStyle = gradient;
        c.fillRect(0, 0, 256, 256);

        if (index !== 5) {
            for (let i = 0; i < 100; i++) {
                c.fillStyle =
                    i % 2 ? "#315f32" : "#6a9747";

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
    panoramaScene = new THREE.Scene();

    panoramaCamera = new THREE.PerspectiveCamera(
        75,
        panoramaElement.clientWidth /
            panoramaElement.clientHeight,
        0.1,
        1000
    );

    panoramaRenderer = new THREE.WebGLRenderer({
        antialias: true
    });

    panoramaRenderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );

    panoramaRenderer.setSize(
        panoramaElement.clientWidth,
        panoramaElement.clientHeight
    );

    panoramaElement.appendChild(
        panoramaRenderer.domElement
    );

    panoramaCamera.rotation.order = "YXZ";

    panoramaScene.background = createFallbackCube();

    let dragging = false;
    let previousX = 0;
    let previousY = 0;

    const canvas = panoramaRenderer.domElement;

    canvas.style.touchAction = "none";

    // Начало вращения
    canvas.addEventListener("pointerdown", (event) => {
        dragging = true;

        previousX = event.clientX;
        previousY = event.clientY;

        canvas.setPointerCapture(event.pointerId);
    });

    // Вращение камеры
    canvas.addEventListener("pointermove", (event) => {
        if (!dragging) return;

        panoramaYaw -=
            (event.clientX - previousX) * 0.004;

        panoramaPitch -=
            (event.clientY - previousY) * 0.004;

        panoramaPitch = Math.max(
            -1.45,
            Math.min(1.45, panoramaPitch)
        );

        previousX = event.clientX;
        previousY = event.clientY;
    });

    // Окончание вращения
    function stopDragging() {
        dragging = false;
    }

    canvas.addEventListener("pointerup", stopDragging);
    canvas.addEventListener("pointercancel", stopDragging);

    // Приближение и отдаление
    canvas.addEventListener("wheel", (event) => {
        panoramaCamera.fov += event.deltaY * 0.025;

        panoramaCamera.fov = Math.max(
            45,
            Math.min(95, panoramaCamera.fov)
        );

        panoramaCamera.updateProjectionMatrix();
    });

    // Анимация
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

    // Изменение размеров окна
    window.addEventListener("resize", () => {
        const width = panoramaElement.clientWidth;
        const height = panoramaElement.clientHeight;

        if (!width || !height) return;

        panoramaCamera.aspect = width / height;
        panoramaCamera.updateProjectionMatrix();

        panoramaRenderer.setSize(width, height);
    });
}

// ==========================================
// ЗАПУСК
// ==========================================

generateMap();
drawMap();

timerElement.textContent = "03:00";
roundInfo.textContent = `Раунд 1 / ${ROUNDS}`;

coordinatesElement.textContent =
    "Метка не установлена";

createPanorama();
