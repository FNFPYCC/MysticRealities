
const mapCanvas = document.getElementById("worldMap");
const ctx = mapCanvas.getContext("2d");

const timerElement = document.getElementById("timer");
const coordinatesElement = document.getElementById("coordinates");
const resultElement = document.getElementById("result");
const guessButton = document.getElementById("guessButton");
const startButton = document.getElementById("startButton");
const roundInfo = document.getElementById("roundInfo");

const panoramaElement = document.getElementById("panorama");

const WORLD_SIZE = 20000;
const ROUNDS = 5;
const ROUND_TIME = 180;

let round = 1;
let score = 0;
let timeLeft = ROUND_TIME;
let timerInterval = null;

let target = null;
let guess = null;
let gameStarted = false;
let roundFinished = false;

// Генератор случайной локации
function randomLocation() {
    return {
        x: Math.floor(Math.random() * WORLD_SIZE) - WORLD_SIZE / 2,
        z: Math.floor(Math.random() * WORLD_SIZE) - WORLD_SIZE / 2
    };
}

// Рисуем пиксельную карту
function generateMap() {
    const tiles = 64;
    const tileSize = mapCanvas.width / tiles;

    const colors = [
        "#477d3c", // Равнины
        "#285b38", // Лес
        "#b9a45d", // Пустыня
        "#e0e5e9", // Снег
        "#397c83", // Вода
        "#68645d", // Горы
        "#71934a"  // Редкий биом
    ];

    // Детерминированный рисунок карты
    let seed = 13579;

    function random() {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    }

    for (let y = 0; y < tiles; y++) {
        for (let x = 0; x < tiles; x++) {
            let colorIndex = Math.floor(random() * colors.length);

            // Большие области воды
            if (x < 5 || x > 59 || y < 5 || y > 59) {
                colorIndex = 4;
            }

            // Центральные области суши
            if (x > 12 && x < 50 && y > 12 && y < 50) {
                if (random() > 0.65) colorIndex = 0;
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

    // Лёгкая пиксельная сетка
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

// Перевод координат мира в положение на карте
function worldToMap(location) {
    return {
        x: (location.x / WORLD_SIZE + 0.5) * mapCanvas.width,
        y: (location.z / WORLD_SIZE + 0.5) * mapCanvas.height
    };
}

// Перевод точки на карте в координаты мира
function mapToWorld(x, y) {
    return {
        x: Math.round((x / mapCanvas.width - 0.5) * WORLD_SIZE),
        z: Math.round((y / mapCanvas.height - 0.5) * WORLD_SIZE)
    };
}

// Отрисовка меток
function drawMap() {
    generateMap();

    if (guess) {
        const p = worldToMap(guess);

        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.fillStyle = "#a77aff";
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    if (roundFinished && target) {
        const p = worldToMap(target);

        ctx.beginPath();
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
        ctx.fillStyle = "#46e58c";
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.stroke();

        if (guess) {
            const g = worldToMap(guess);

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

// Выбор метки мышкой
mapCanvas.addEventListener("click", (event) => {
    if (!gameStarted || roundFinished) return;

    const rect = mapCanvas.getBoundingClientRect();

    const x = (event.clientX - rect.left) / rect.width * mapCanvas.width;
    const y = (event.clientY - rect.top) / rect.height * mapCanvas.height;

    guess = mapToWorld(x, y);

    coordinatesElement.textContent =
        `Координаты: X ${guess.x} | Z ${guess.z}`;

    guessButton.disabled = false;

    drawMap();
});

// Таймер
function updateTimer() {
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

// Начало раунда
function startRound() {
    target = randomLocation();
    guess = null;

    timeLeft = ROUND_TIME;
    gameStarted = true;
    roundFinished = false;

    coordinatesElement.textContent = "Координаты: не выбраны";
    resultElement.textContent = "";

    guessButton.disabled = true;
    startButton.disabled = true;
    startButton.textContent = "Раунд идёт";

    roundInfo.textContent = `Раунд ${round} / ${ROUNDS}`;
    timerElement.textContent = "03:00";

    drawMap();

    clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
}

// Расчёт расстояния
function calculateDistance(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;

    return Math.round(Math.sqrt(dx * dx + dz * dz));
}

// Завершение раунда
function finishRound() {
    if (roundFinished) return;

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
        <p>Правильные координаты:</p>
        <p>X: ${target.x} | Z: ${target.z}</p>
        <p>Расстояние: ${distance === null ? "Ответ не дан" : distance + " блоков"}</p>
        <p>Получено очков: ${gained}</p>
        <p>Общий счёт: ${score}</p>
    `;

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

// Инициализация карты
generateMap();
drawMap();

// Начальное состояние
timerElement.textContent = "03:00";
roundInfo.textContent = `Раунд 1 / ${ROUNDS}`;


// ----------------------------------
// 360° CUBEMAP
// ----------------------------------

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

function createPanorama() {
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
        75,
        panoramaElement.clientWidth / panoramaElement.clientHeight,
        0.1,
        1000
    );

    const renderer = new THREE.WebGLRenderer({
        antialias: true
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    renderer.setSize(
        panoramaElement.clientWidth,
        panoramaElement.clientHeight
    );

    panoramaElement.appendChild(renderer.domElement);

    camera.rotation.order = "YXZ";

    let yaw = 0;
    let pitch = 0;
    let dragging = false;
    let previousX = 0;
    let previousY = 0;

    scene.background = createFallbackCube();

    const imagePaths = [
        "../../assets/panoramas/px.jpg",
        "../../assets/panoramas/nx.jpg",
        "../../assets/panoramas/py.jpg",
        "../../assets/panoramas/ny.jpg",
        "../../assets/panoramas/pz.jpg",
        "../../assets/panoramas/nz.jpg"
    ];

    new THREE.CubeTextureLoader().load(
        imagePaths,
        (texture) => {
            scene.background = texture;
            document.getElementById("loading").textContent =
                "360° панорама загружена";
        },
        undefined,
        () => {
            document.getElementById("loading").textContent =
                "Демонстрационный фон. Добавь 6 изображений.";
        }
    );

    renderer.domElement.addEventListener("pointerdown", (event) => {
        dragging = true;
        previousX = event.clientX;
        previousY = event.clientY;
        renderer.domElement.setPointerCapture(event.pointerId);
    });

    renderer.domElement.addEventListener("pointermove", (event) => {
        if (!dragging) return;

        yaw -= (event.clientX - previousX) * 0.004;
        pitch -= (event.clientY - previousY) * 0.004;

        pitch = Math.max(-1.45, Math.min(1.45, pitch));

        previousX = event.clientX;
        previousY = event.clientY;
    });

    renderer.domElement.addEventListener("pointerup", () => {
        dragging = false;
    });

    renderer.domElement.addEventListener("pointercancel", () => {
        dragging = false;
    });

    renderer.domElement.addEventListener("wheel", (event) => {
        camera.fov += event.deltaY * 0.025;
        camera.fov = Math.max(45, Math.min(95, camera.fov));
        camera.updateProjectionMatrix();
    });

    function animate() {
        requestAnimationFrame(animate);

        camera.rotation.y = yaw;
        camera.rotation.x = pitch;

        renderer.render(scene, camera);
    }

    animate();

    window.addEventListener("resize", () => {
        const width = panoramaElement.clientWidth;
        const height = panoramaElement.clientHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize(width, height);
    });
}

createPanorama();
