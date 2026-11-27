// ==========================================
// MYSTICGUESSR — MysticRealities
// Сезоны, главы, 360° панорамы и метки
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
const scoreInfo = document.getElementById("scoreInfo");
const startScreen = document.getElementById("startScreen");
const nextButton = document.getElementById("nextButton");
const zoomInButton = document.getElementById("zoomInButton");
const zoomOutButton = document.getElementById("zoomOutButton");
const fullscreenButton = document.getElementById("fullscreenButton");
const seasonGrid = document.getElementById("seasonGrid");

if (!mapCanvas || !mapWidget || !seasonGrid) {
    throw new Error("MysticGuessr: не найдены необходимые элементы HTML.");
}

const ctx = mapCanvas.getContext("2d");
if (!ctx) throw new Error("MysticGuessr: нет Canvas-контекста карты.");

// ==========================================
// ★★★ КОНФИГ СЕЗОНОВ ★★★
// ==========================================
const SEASON_DATA = {
    1: {
        title: "MysticRealities 2",
        preview: "../../assets/seasons/2_1.png",
        map: "../../assets/maps/season1/map.png",
        worldSize: 2208,
        offsetX: 0,
        offsetZ: 0,
        available: true,
        locations: [
            { name: "Season 1 — Cap 1",  folder: "season1/cap1",  x: -232, z: 684 },
            { name: "Season 1 — Cap 2",  folder: "season1/cap2",  x: -421, z: 226 },
            { name: "Season 1 — Cap 3",  folder: "season1/cap3",  x: 0,    z: 127 },
            { name: "Season 1 — Cap 4",  folder: "season1/cap4",  x: 295,  z: -458 },
            { name: "Season 1 — Cap 5",  folder: "season1/cap5",  x: -522, z: -313 },
            { name: "Season 1 — Cap 6",  folder: "season1/cap6",  x: -295, z: -632 },
            { name: "Season 1 — Cap 7",  folder: "season1/cap7",  x: -507, z: -776 },
            { name: "Season 1 — Cap 8",  folder: "season1/cap8",  x: -139, z: -39 },
            { name: "Season 1 — Cap 9",  folder: "season1/cap9",  x: -90,  z: 379 },
            { name: "Season 1 — Cap 10", folder: "season1/cap10", x: -866, z: 559 },
            { name: "Season 1 — Cap 11", folder: "season1/cap11", x: -292, z: 144 },
            { name: "Season 1 — Cap 12", folder: "season1/cap12", x: -353, z: 29 },
            { name: "Season 1 — Cap 13", folder: "season1/cap13", x: 812,  z: 630 },
            { name: "Season 1 — Cap 14", folder: "season1/cap14", x: 957,  z: 659 },
            { name: "Season 1 — Cap 15", folder: "season1/cap15", x: -609, z: -511 }
        ]
    },
    2: {
        title: "MysticRealities 3",
        preview: "../../assets/seasons/3_1.png",
        map: "../../assets/maps/season2/map.png",
        worldSize: 6032,
        offsetX: 8, 
        offsetZ: 8,
        available: false,
        locations: [
            { name: "Season 2 — Cap 1",  folder: "season2/cap1",  x: -741, z: -2991 },
            { name: "Season 2 — Cap 2",  folder: "season2/cap2",  x: -1063, z: -2705 },
            { name: "Season 2 — Cap 3",  folder: "season2/cap3",  x: 88, z: -1030 },
            { name: "Season 2 — Cap 4",  folder: "season2/cap4",  x: 195, z: -458 },
            { name: "Season 2 — Cap 5",  folder: "season2/cap5",  x: 262, z: -444 },
            { name: "Season 2 — Cap 6",  folder: "season2/cap6",  x: 1500, z: -582 },
            { name: "Season 2 — Cap 7",  folder: "season2/cap7",  x: 2891, z: -1821 },
            { name: "Season 2 — Cap 8",  folder: "season2/cap8",  x: 1795, z: 1342 },
            { name: "Season 2 — Cap 9",  folder: "season2/cap9",  x: 1834, z: 1488 },
            { name: "Season 2 — Cap 10", folder: "season2/cap10",  x: -517, z: 600 },
            { name: "Season 2 — Cap 11", folder: "season2/cap11",  x: -416, z: 265 },
            { name: "Season 2 — Cap 12", folder: "season2/cap12",  x: -234, z: 339 },
            { name: "Season 2 — Cap 13", folder: "season2/cap13",  x: 1, z: -1776 },
            { name: "Season 2 — Cap 14", folder: "season2/cap14",  x: -434, z: 912 },
            { name: "Season 2 — Cap 15", folder: "season2/cap15",  x: 0, z: 3 },
            { name: "Season 2 — Cap 16", folder: "season2/cap16",  x: -223, z: 112 },
            { name: "Season 2 — Cap 17", folder: "season2/cap17",  x: -604, z: -27 },
            { name: "Season 2 — Cap 18", folder: "season2/cap18",  x: -1167, z: -1770 },
            { name: "Season 2 — Cap 19", folder: "season2/cap19",  x: 670, z: -164 },
            { name: "Season 2 — Cap 20", folder: "season2/cap20",  x: 493, z: -279 }
        ]
    }
};

// ---------- НАСТРОЙКИ ----------
let WORLD_SIZE = 2208;
let MAX_ROUNDS = 15;
let ROUND_TIME = 180;
let ROUNDS = 0;
let LOCATIONS = [];
let selectedSeason = 1;
let textureCheckPassed = false;

let MAP_SIZE = WORLD_SIZE;
let MAX_DISTANCE = WORLD_SIZE * Math.SQRT2;
const MAP_MAX_ZOOM = 100;
let MAP_IMAGE_SRC = SEASON_DATA[1].map;

// ---------- КАРТА ----------
let mapScale = 1, mapOffsetX = 0, mapOffsetY = 0;
let mapDragging = false, mapDragMoved = false;
let mapLastX = 0, mapLastY = 0, mapPointerStartX = 0, mapPointerStartY = 0;

// ---------- ИГРА ----------
let round = 1, score = 0, timeLeft = ROUND_TIME, timerInterval = null;
let target = null, guess = null;
let gameStarted = false, roundFinished = false;
let locationPool = [], history = [], poolReady = false;

// ---------- ПАНОРАМА ----------
let panoramaScene = null, panoramaRenderer = null, panoramaCamera = null;
let panoramaYaw = 0, panoramaPitch = 0, panoramaRequestId = 0;

// ---------- UI ----------
const seasonStatus = document.getElementById("seasonStatus");
const textureCheckButton = document.getElementById("textureCheckButton");
const textureReport = document.getElementById("textureReport");
const roundsSelect = document.getElementById("roundsSelect");
const timeSelect = document.getElementById("timeSelect");
const menuHint = document.getElementById("menuHint");
const roundsCountEl = document.getElementById("roundsCount");

// ==========================================
// ГЕНЕРАЦИЯ КАРТОЧЕК СЕЗОНОВ
// ==========================================
function renderSeasonGrid() {
    seasonGrid.innerHTML = "";

    Object.entries(SEASON_DATA).forEach(([num, data]) => {
        const n = Number(num);
        const btn = document.createElement("button");
        btn.className = "season-card" + (data.available ? "" : " coming");
        btn.dataset.season = num;
        btn.disabled = !data.available;
        if (!data.preview) btn.classList.add("no-photo");

        btn.innerHTML = `
            <span class="season-preview"${data.preview ? ` style="background-image:url('${data.preview}')"` : ""}></span>
            <span class="season-number">${String(n).padStart(2, "0")}</span>
            <b>${data.title}</b>
            <small>${data.subtitle || (data.available ? "Доступен" : "Скоро")}</small>
        `;

        btn.addEventListener("click", () => {
            if (!btn.disabled) setSeason(n);
        });

        seasonGrid.appendChild(btn);
    });
}

function setSeason(seasonNumber) {
    const data = SEASON_DATA[seasonNumber];
    if (!data || !data.available || !data.locations.length) {
        seasonStatus.textContent = `${data?.title || "Сезон"} пока не добавлен`;
        return;
    }

    selectedSeason = seasonNumber;
    LOCATIONS = data.locations;
    MAP_IMAGE_SRC = data.map;
    
    WORLD_SIZE = data.worldSize || 2208;
    MAP_SIZE = WORLD_SIZE;
    MAX_DISTANCE = WORLD_SIZE * Math.SQRT2;
    MAX_ROUNDS = LOCATIONS.length;
    
    mapCanvas.width = MAP_SIZE;
    mapCanvas.height = MAP_SIZE;
    
    updateRoundsDropdown(MAX_ROUNDS);

    ROUNDS = Math.min(Number(roundsSelect?.value || MAX_ROUNDS), LOCATIONS.length);
    textureCheckPassed = false;
    mapImage.src = MAP_IMAGE_SRC;
    locationPool = [];
    poolReady = false;

    [...seasonGrid.children].forEach(btn => {
        btn.classList.toggle("selected", Number(btn.dataset.season) === seasonNumber);
    });

    seasonStatus.textContent = `${data.title} выбран • ${LOCATIONS.length} локаций`;
    textureReport.textContent = "Запускаю автопроверку...";
    textureReport.className = "texture-report";
    startButton.disabled = true;
    menuHint.textContent = "Проверяю файлы...";
    roundsCountEl.textContent = ROUNDS;

    checkSeasonTextures();
}

function updateRoundsDropdown(max) {
    if (!roundsSelect) return;
    const currentVal = Number(roundsSelect.value);
    roundsSelect.innerHTML = "";
    
    const options = [5, 10, 15, 20, 25, 30].filter(v => v <= max);
    if (options.length === 0 || options[options.length - 1] < max) {
        options.push(max);
    }

    options.forEach(val => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = `${val} раундов`;
        if (val === (options.includes(currentVal) ? currentVal : options[options.length - 1])) {
            opt.selected = true;
        }
        roundsSelect.appendChild(opt);
    });
}

// ==========================================
// АВТО-ПРОВЕРКА ТЕКСТУР
// ==========================================
function checkImage(url) {
    return new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve({ url, ok: true });
        image.onerror = () => resolve({ url, ok: false });
        image.src = url;
    });
}

let checkToken = 0;
async function checkSeasonTextures() {
    if (!LOCATIONS.length) {
        textureReport.textContent = "В выбранном сезоне пока нет локаций.";
        return false;
    }

    const myToken = ++checkToken;
    textureCheckButton.disabled = true;
    startButton.disabled = true;
    textureReport.className = "texture-report checking";
    textureReport.textContent = "Проверяю карту и текстуры панорам...";

    const files = [MAP_IMAGE_SRC];
    LOCATIONS.forEach(location => {
        const base = `../../assets/panoramas/${location.folder}/`;
        [1, 3, 4, 5, 0, 2].forEach(n => files.push(`${base}panorama_${n}.png`));
    });

    const results = await Promise.all(files.map(checkImage));
    if (myToken !== checkToken) return false;

    const missing = results.filter(r => !r.ok);
    textureCheckPassed = missing.length === 0;
    textureCheckButton.disabled = false;
    startButton.disabled = !textureCheckPassed;

    if (textureCheckPassed) {
        textureReport.className = "texture-report success";
        textureReport.textContent = `✓ Проверка пройдена: найдено ${results.length} файлов. Можно играть!`;
        menuHint.textContent = "Всё готово. Нажми «Играть»!";
    } else {
        textureReport.className = "texture-report error";
        const examples = missing.slice(0, 5).map(i => i.url.split("/").slice(-2).join("/"));
        textureReport.textContent = `Не найдено: ${missing.length} из ${results.length}. Примеры: ${examples.join(", ")}${missing.length > 5 ? "…" : ""}`;
        menuHint.textContent = "Исправь отсутствующие файлы и повтори проверку.";
    }
    return textureCheckPassed;
}

// ==========================================
// FULLSCREEN
// ==========================================
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
        document.exitFullscreen?.();
    }
}
fullscreenButton?.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", () => {
    fullscreenButton.textContent = document.fullscreenElement ? "⤢" : "⛶";
    setTimeout(() => {
        drawMap();
        if (panoramaRenderer && panoramaCamera) {
            const w = panoramaElement.clientWidth, h = panoramaElement.clientHeight;
            if (w && h) {
                panoramaCamera.aspect = w / h;
                panoramaCamera.updateProjectionMatrix();
                panoramaRenderer.setSize(w, h);
            }
        }
    }, 120);
});

// ==========================================
// ПЕРЕМЕШИВАНИЕ
// ==========================================
function randomLocation() {
    if (LOCATIONS.length === 0) throw new Error("LOCATIONS пуст!");
    if (!poolReady) {
        locationPool = [...LOCATIONS];
        for (let i = locationPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [locationPool[i], locationPool[j]] = [locationPool[j], locationPool[i]];
        }
        poolReady = true;
    }
    return locationPool.pop();
}

// ==========================================
// КАРТА
// ==========================================
const mapImage = new Image();
mapImage.onload = () => drawMap();
mapImage.onerror = () => { console.error("Не загрузилась карта:", MAP_IMAGE_SRC); drawMap(); };
mapImage.src = MAP_IMAGE_SRC;

function generateMap() {
    if (mapImage.complete && mapImage.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(mapImage, 0, 0, mapCanvas.width, mapCanvas.height);
        return;
    }
    const tiles = 64, tileSize = mapCanvas.width / tiles;
    const colors = ["#477d3c","#285b38","#b9a45d","#e0e5e9","#397c83","#68645d","#71934a"];
    let seed = 13579;
    function random(){ seed = (seed*16807)%2147483647; return seed/2147483647; }
    for (let y=0;y<tiles;y++) for (let x=0;x<tiles;x++) {
        let ci = Math.floor(random()*colors.length);
        if (x<5||x>59||y<5||y>59) ci=4;
        if (x>12&&x<50&&y>12&&y<50&&random()>0.65) ci=0;
        ctx.fillStyle = colors[ci];
        ctx.fillRect(x*tileSize,y*tileSize,tileSize,tileSize);
    }
    ctx.strokeStyle="#ffffff12"; ctx.lineWidth=1;
    for (let i=0;i<=tiles;i+=4){
        ctx.beginPath(); ctx.moveTo(i*tileSize,0); ctx.lineTo(i*tileSize,mapCanvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,i*tileSize); ctx.lineTo(mapCanvas.width,i*tileSize); ctx.stroke();
    }
}

// ★★★ ФУНКЦИИ С УЧЕТОМ OFFSET ★★★
function worldToMap(loc){ 
    const season = SEASON_DATA[selectedSeason];
    const offX = season.offsetX || 0;
    const offZ = season.offsetZ || 0;
    return { 
        x: (loc.x - offX) + WORLD_SIZE/2 + 0.5, 
        y: (loc.z - offZ) + WORLD_SIZE/2 + 0.5 
    }; 
}

function mapToWorld(x,y){ 
    const season = SEASON_DATA[selectedSeason];
    const offX = season.offsetX || 0;
    const offZ = season.offsetZ || 0;
    return { 
        x: Math.floor(x*WORLD_SIZE/mapCanvas.width) - WORLD_SIZE/2 + offX, 
        z: Math.floor(y*WORLD_SIZE/mapCanvas.height) - WORLD_SIZE/2 + offZ 
    }; 
}

function formatCoords(p){ return `X: ${p.x}, Z: ${p.z}`; }

function clampMapOffset(){
    const minOffset = mapCanvas.width*(1-mapScale);
    mapOffsetX = Math.max(minOffset, Math.min(0, mapOffsetX));
    mapOffsetY = Math.max(minOffset, Math.min(0, mapOffsetY));
    if (mapScale <= 1){ mapScale=1; mapOffsetX=0; mapOffsetY=0; }
}

function screenUnit(){
    const rect = mapCanvas.getBoundingClientRect();
    const canvasPerCss = rect.width>0 ? mapCanvas.width/rect.width : 1;
    return canvasPerCss / mapScale;
}

function drawMarker(position, color, cssRadius=6){
    const p = worldToMap(position); const u = screenUnit(); const radius = cssRadius*u;
    ctx.beginPath(); ctx.arc(p.x,p.y,radius+2*u,0,Math.PI*2); ctx.fillStyle="#00000066"; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x,p.y,radius,0,Math.PI*2); ctx.fillStyle=color; ctx.fill();
    ctx.strokeStyle="#ffffff"; ctx.lineWidth=2*u; ctx.stroke();
}

function drawMap(){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,mapCanvas.width,mapCanvas.height);
    clampMapOffset();
    ctx.setTransform(mapScale,0,0,mapScale,mapOffsetX,mapOffsetY);
    generateMap();
    if (guess) drawMarker(guess,"#a77aff",6);
    if (roundFinished && target){
        drawMarker(target,"#46e58c",5.5);
        if (guess){
            const g = worldToMap(guess); const p = worldToMap(target); const u = screenUnit();
            ctx.beginPath(); ctx.moveTo(g.x,g.y); ctx.lineTo(p.x,p.y);
            ctx.strokeStyle="white"; ctx.lineWidth=2*u; ctx.setLineDash([6*u,6*u]); ctx.stroke(); ctx.setLineDash([]);
        }
    }
    ctx.setTransform(1,0,0,1,0,0);
}

function getMapPosition(event){
    const rect = mapCanvas.getBoundingClientRect();
    const sx = (event.clientX-rect.left)/rect.width*mapCanvas.width;
    const sy = (event.clientY-rect.top)/rect.height*mapCanvas.height;
    return { x: (sx-mapOffsetX)/mapScale, y: (sy-mapOffsetY)/mapScale };
}

mapCanvas.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    e.preventDefault();
    mapDragging = true; mapDragMoved = false;
    mapLastX = e.clientX; mapLastY = e.clientY;
    mapPointerStartX = e.clientX; mapPointerStartY = e.clientY;
    mapCanvas.setPointerCapture(e.pointerId);
});
mapCanvas.addEventListener("pointermove", e => {
    if (!mapDragging) return;
    const dx = e.clientX-mapLastX, dy = e.clientY-mapLastY;
    if (Math.abs(e.clientX-mapPointerStartX)>4 || Math.abs(e.clientY-mapPointerStartY)>4) mapDragMoved = true;
    if (mapDragMoved){
        const rect = mapCanvas.getBoundingClientRect();
        mapOffsetX += dx/rect.width*mapCanvas.width;
        mapOffsetY += dy/rect.height*mapCanvas.height;
        clampMapOffset(); drawMap();
    }
    mapLastX = e.clientX; mapLastY = e.clientY;
});
function stopMapDragging(e){
    if (!mapDragging) return;
    mapDragging = false;
    if (mapDragMoved) return;
    if (!gameStarted || roundFinished) return;
    const p = getMapPosition(e);
    if (p.x<0||p.x>=mapCanvas.width||p.y<0||p.y>=mapCanvas.height) return;
    guess = mapToWorld(p.x,p.y);
    coordinatesElement.textContent = `Метка: ${formatCoords(guess)}`;
    guessButton.disabled = false;
    drawMap();
}
mapCanvas.addEventListener("pointerup", stopMapDragging);
mapCanvas.addEventListener("pointercancel", () => { mapDragging = false; });

mapCanvas.addEventListener("wheel", e => {
    e.preventDefault();
    const rect = mapCanvas.getBoundingClientRect();
    const mx = (e.clientX-rect.left)/rect.width*mapCanvas.width;
    const my = (e.clientY-rect.top)/rect.height*mapCanvas.height;
    const old = mapScale;
    const f = e.deltaY<0?1.25:1/1.25;
    mapScale = Math.max(1, Math.min(MAP_MAX_ZOOM, mapScale*f));
    const ratio = mapScale/old;
    mapOffsetX = mx-(mx-mapOffsetX)*ratio;
    mapOffsetY = my-(my-mapOffsetY)*ratio;
    clampMapOffset(); drawMap();
}, { passive:false });

function resetMap(){ mapScale=1; mapOffsetX=0; mapOffsetY=0; drawMap(); }
resetMapButton.addEventListener("click", resetMap);

function zoomMap(f){
    const cx = mapCanvas.width/2, cy = mapCanvas.height/2, old = mapScale;
    mapScale = Math.max(1, Math.min(MAP_MAX_ZOOM, mapScale*f));
    const r = mapScale/old;
    mapOffsetX = cx-(cx-mapOffsetX)*r;
    mapOffsetY = cy-(cy-mapOffsetY)*r;
    clampMapOffset(); drawMap();
}
zoomInButton.addEventListener("click", ()=>zoomMap(1.6));
zoomOutButton.addEventListener("click", ()=>zoomMap(1/1.6));

expandMapButton.addEventListener("click", ()=>{
    mapWidget.classList.add("expanded");
    requestAnimationFrame(drawMap); setTimeout(drawMap,250);
});
closeMapButton.addEventListener("click", ()=>{
    mapWidget.classList.remove("expanded");
    requestAnimationFrame(drawMap); setTimeout(drawMap,250);
});
window.addEventListener("resize", drawMap);
mapWidget.addEventListener("transitionend", drawMap);

// ==========================================
// ТАЙМЕР
// ==========================================
function updateTimer(){
    if (!gameStarted || roundFinished) return;
    timeLeft--;
    const m = Math.floor(timeLeft/60), s = timeLeft%60;
    timerElement.textContent = `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    timerElement.classList.toggle("low", timeLeft <= 30);
    if (timeLeft <= 0){ clearInterval(timerInterval); finishRound(); }
}

// ==========================================
// ПАНОРАМА
// ==========================================
function loadPanorama(location){
    if (!panoramaScene) return;
    const requestId = ++panoramaRequestId;
    const base = `../../assets/panoramas/${location.folder}/`;
    const paths = [
        base+"panorama_1.png", base+"panorama_3.png",
        base+"panorama_4.png", base+"panorama_5.png",
        base+"panorama_0.png", base+"panorama_2.png"
    ];
    loadingElement.classList.remove("hidden");
    loadingElement.textContent = "Загрузка панорамы...";
    new THREE.CubeTextureLoader().load(paths,
        (tex)=>{
            if (requestId !== panoramaRequestId){ tex.dispose(); return; }
            const old = panoramaScene.background;
            panoramaScene.background = tex;
            if (old && old.isCubeTexture) old.dispose();
            loadingElement.classList.add("hidden");
        },
        undefined,
        (err)=>{
            if (requestId !== panoramaRequestId) return;
            console.error("Ошибка загрузки панорамы:", err);
            loadingElement.textContent = "Ошибка загрузки панорамы. Проверь текстуры.";
        }
    );
}

// ==========================================
// РАУНД
// ==========================================
function startRound(){
    if (LOCATIONS.length === 0){
        resultElement.textContent = "Сначала добавь локацию в LOCATIONS.";
        return;
    }
    target = randomLocation(); guess = null; timeLeft = ROUND_TIME;
    gameStarted = true; roundFinished = false;
    coordinatesElement.textContent = "Метка не установлена";
    resultElement.innerHTML = "";
    nextButton.hidden = true;
    mapWidget.classList.remove("expanded","finished");
    timerElement.classList.remove("low");
    scoreInfo.textContent = `Очки: ${score}`;
    guessButton.disabled = true;
    startButton.disabled = true;
    startButton.textContent = "Раунд идёт";
    roundInfo.textContent = `Раунд ${round} / ${ROUNDS}`;
    timerElement.textContent = `${String(Math.floor(ROUND_TIME/60)).padStart(2,"0")}:${String(ROUND_TIME%60).padStart(2,"0")}`;
    resetMap();
    loadPanorama(target);
    clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
}

function calculateDistance(a,b){
    const dx = a.x-b.x, dz = a.z-b.z;
    return Math.round(Math.sqrt(dx*dx+dz*dz));
}

function finishRound(){
    if (roundFinished || !target) return;
    clearInterval(timerInterval);
    roundFinished = true; gameStarted = false;
    let gained = 0, distance = null;
    if (guess){
        distance = calculateDistance(target, guess);
        gained = Math.round(5000*Math.max(0, 1-distance/MAX_DISTANCE));
    }
    score += gained;
    history.push({ round, name: target.name, distance, gained });
    scoreInfo.textContent = `Очки: ${score}`;
    mapWidget.classList.add("expanded","finished");
    guessButton.disabled = true;
    coordinatesElement.textContent = guess ? `Метка: ${formatCoords(guess)}` : "Метка не установлена";
    resultElement.innerHTML = `
        <div class="result-card">
            <div class="result-points">+${gained}</div>
            <div class="result-row"><span>Расстояние</span><b>${distance === null ? "ответ не дан" : distance+" блоков"}</b></div>
            <div class="result-row"><span>Правильные координаты</span><b>${formatCoords(target)}</b></div>
            <div class="result-row"><span>Твоя метка</span><b>${guess ? formatCoords(guess) : "—"}</b></div>
            <div class="result-row"><span>Общий счёт</span><b>${score}</b></div>
        </div>`;
    nextButton.hidden = false;
    nextButton.textContent = round < ROUNDS ? "Следующий раунд" : "Итоги игры";
    drawMap(); requestAnimationFrame(drawMap); setTimeout(drawMap,250);
}

function showFinal(){
    nextButton.hidden = true;
    const rows = history.map(h => `
        <div class="result-row">
            <span>Раунд ${h.round}</span>
            <b>${h.distance === null ? "—" : h.distance+" блоков"} • +${h.gained}</b>
        </div>`).join("");
    resultElement.innerHTML = `
        <div class="result-card">
            <div class="final-total">${score}<small>из ${ROUNDS*5000} очков</small></div>
            ${rows}
        </div>
        <button class="primary" style="margin-top:10px" onclick="location.reload()">Играть снова</button>`;
}

// ==========================================
// КНОПКИ
// ==========================================
guessButton.addEventListener("click", ()=>{
    if (!guess || !gameStarted) return;
    finishRound();
});

startButton.addEventListener("click", async ()=>{
    if (!textureCheckPassed && !(await checkSeasonTextures())) return;
    ROUNDS = Math.min(Number(roundsSelect?.value || MAX_ROUNDS), LOCATIONS.length);
    if (!ROUNDS) return;
    round = 1; score = 0; history = []; locationPool = []; poolReady = false;
    scoreInfo.textContent = "Очки: 0";
    startScreen.classList.add("hidden");
    startRound();
});

nextButton.addEventListener("click", ()=>{
    if (round < ROUNDS){ round++; startRound(); }
    else showFinal();
});

textureCheckButton?.addEventListener("click", checkSeasonTextures);
roundsSelect?.addEventListener("change", ()=>{
    ROUNDS = Math.min(Number(roundsSelect.value), LOCATIONS.length);
    roundsCountEl.textContent = ROUNDS;
    textureCheckPassed = false;
    startButton.disabled = true;
    textureReport.textContent = "Настройки изменены. Запускаю автопроверку...";
    checkSeasonTextures();
});
timeSelect?.addEventListener("change", ()=>{
    ROUND_TIME = Number(timeSelect.value);
    timerElement.textContent = `${String(Math.floor(ROUND_TIME/60)).padStart(2,"0")}:${String(ROUND_TIME%60).padStart(2,"0")}`;
});

// ==========================================
// FALLBACK CUBE
// ==========================================
function createFallbackCube(){
    const faces = [];
    const colors = [
        ["#76b9e8","#477d3c"],["#78bce9","#3b713c"],["#8dc9f1","#3d7540"],
        ["#6a9fc8","#385f37"],["#75b8e7","#4c8043"],["#263c29","#263c29"]
    ];
    colors.forEach((pair, index)=>{
        const canvas = document.createElement("canvas");
        canvas.width = 256; canvas.height = 256;
        const c = canvas.getContext("2d");
        const g = c.createLinearGradient(0,0,0,256);
        g.addColorStop(0,pair[0]); g.addColorStop(0.62,pair[0]);
        g.addColorStop(0.63,pair[1]); g.addColorStop(1,pair[1]);
        c.fillStyle = g; c.fillRect(0,0,256,256);
        if (index !== 5){
            for (let i=0;i<100;i++){
                c.fillStyle = i%2?"#315f32":"#6a9747";
                c.fillRect(Math.random()*256, 160+Math.random()*90, 12, 12);
            }
        }
        faces.push(canvas);
    });
    const tex = new THREE.CubeTexture(faces);
    tex.needsUpdate = true;
    return tex;
}

// ==========================================
// 360 ПАНОРАМА
// ==========================================
function createPanorama(){
    if (typeof THREE === "undefined"){
        loadingElement.textContent = "Ошибка: Three.js не загружен.";
        return;
    }
    panoramaScene = new THREE.Scene();
    const w = Math.max(1, panoramaElement.clientWidth);
    const h = Math.max(1, panoramaElement.clientHeight);
    panoramaCamera = new THREE.PerspectiveCamera(75, w/h, 0.1, 1000);
    try {
        panoramaRenderer = new THREE.WebGLRenderer({ antialias:true });
    } catch(e){
        loadingElement.textContent = "Не удалось запустить WebGL.";
        return;
    }
    panoramaRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    panoramaRenderer.setSize(w, h);
    panoramaElement.appendChild(panoramaRenderer.domElement);
    panoramaCamera.rotation.order = "YXZ";
    panoramaScene.background = createFallbackCube();

    let dragging = false, px = 0, py = 0;
    const canvas = panoramaRenderer.domElement;
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", e=>{
        dragging = true; px = e.clientX; py = e.clientY;
        canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", e=>{
        if (!dragging) return;
        panoramaYaw   -= (e.clientX-px)*0.004;
        panoramaPitch -= (e.clientY-py)*0.004;
        panoramaPitch = Math.max(-1.45, Math.min(1.45, panoramaPitch));
        px = e.clientX; py = e.clientY;
    });
    const stop = ()=>dragging=false;
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);
    canvas.addEventListener("wheel", e=>{
        panoramaCamera.fov += e.deltaY*0.025;
        panoramaCamera.fov = Math.max(45, Math.min(95, panoramaCamera.fov));
        panoramaCamera.updateProjectionMatrix();
    });

    function animate(){
        requestAnimationFrame(animate);
        panoramaCamera.rotation.y = panoramaYaw;
        panoramaCamera.rotation.x = panoramaPitch;
        panoramaRenderer.render(panoramaScene, panoramaCamera);
    }
    animate();

    window.addEventListener("resize", ()=>{
        const nw = panoramaElement.clientWidth, nh = panoramaElement.clientHeight;
        if (!nw || !nh) return;
        panoramaCamera.aspect = nw/nh;
        panoramaCamera.updateProjectionMatrix();
        panoramaRenderer.setSize(nw, nh);
    });
}

// ==========================================
// СТАРТ
// ==========================================
mapCanvas.width = MAP_SIZE;
mapCanvas.height = MAP_SIZE;

renderSeasonGrid();
setSeason(1);

mapCanvas.style.imageRendering = "auto";
generateMap();
drawMap();

timerElement.textContent = `${String(Math.floor(ROUND_TIME/60)).padStart(2,"0")}:${String(ROUND_TIME%60).padStart(2,"0")}`;
roundInfo.textContent = `Раунд 1 / ${ROUNDS}`;
coordinatesElement.textContent = "Метка не установлена";
roundsCountEl.textContent = ROUNDS;

createPanorama();