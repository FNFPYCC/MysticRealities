// ==========================================
// 1. ПОИСК ПО СТАТЬЯМ
// ==========================================
const searchInput = document.getElementById("searchInput");
const articleCards = document.querySelectorAll(".article-card");
const noResults = document.getElementById("noResults");
const searchCount = document.getElementById("searchCount");

if (searchInput) {
    searchInput.addEventListener("input", function() {
        const query = this.value.toLowerCase().trim();
        let visibleCount = 0;
        articleCards.forEach(card => {
            const title = card.dataset.title.toLowerCase();
            const text = card.textContent.toLowerCase();
            const matches = title.includes(query) || text.includes(query);
            card.style.display = matches ? "flex" : "none";
            if (matches) visibleCount++;
        });
        if (noResults) noResults.style.display = visibleCount === 0 ? "block" : "none";
        if (searchCount) searchCount.textContent = query.length > 0 ? `Найдено статей: ${visibleCount}` : "";
    });
}

// ==========================================
// 2. АККОРДЕОНЫ (САЙДБАР И КАТЕГОРИИ)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const dropdownButtons = document.querySelectorAll(".dropdown-btn");
    dropdownButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            btn.classList.toggle("active");
            const submenu = btn.nextElementSibling;
            if (submenu.style.maxHeight) {
                submenu.style.maxHeight = null;
            } else {
                submenu.style.maxHeight = submenu.scrollHeight + "px";
            }
        });
    });

    const categoryDropdowns = document.querySelectorAll(".category-dropdown");
    categoryDropdowns.forEach(card => {
        const mainBtn = card.querySelector(".category-main");
        const submenu = card.querySelector(".category-submenu");

        mainBtn.addEventListener("click", (e) => {
            if (e.target.tagName === "A") return;
            card.classList.toggle("active");
            if (submenu.style.maxHeight) {
                submenu.style.maxHeight = null;
            } else {
                submenu.style.maxHeight = submenu.scrollHeight + "px";
            }
        });
    });
});

// ==========================================
// 3. АВТОРИЗАЦИЯ ЧЕРЕЗ GITHUB
// ==========================================
// ... (твой код поиска и меню) ...

const AUTH_WORKER_URL = 'https://mystic-auth.igoredisan974.workers.dev';
const loginBtn = document.getElementById('loginBtn');

// Принимаем токен, который прилетит от Cloudflare
window.addEventListener('message', (event) => {
    // Разрешаем прием сообщений от нашего Worker
    if (event.origin === AUTH_WORKER_URL && event.data.type === 'github-auth-success') {
        if (event.data.token) {
            // Сохраняем токен в память браузера
            localStorage.setItem('github_token', event.data.token);
            // Обновляем кнопку
            checkLogin();
        }
    }
});

async function checkLogin() {
    const token = localStorage.getItem('github_token');
    if (!loginBtn) return;

    if (token) {
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `token ${token}` }
            });
            const user = await response.json();
            
            if (user.login) {
                loginBtn.textContent = `Выйти (${user.login})`;
                loginBtn.classList.add('logged-in');
                loginBtn.onclick = logout;
                return;
            }
        } catch (error) {
            console.error("Ошибка токена", error);
        }
    }
    
    // Если токена нет или он невалиден
    loginBtn.textContent = 'Войти';
    loginBtn.classList.remove('logged-in');
    loginBtn.onclick = login;
}

function login() {
    const width = 600, height = 700;
    const left = (screen.width / 2) - (width / 2);
    const top = (screen.height / 2) - (height / 2);
    window.open(AUTH_WORKER_URL, 'GitHub Login', `width=${width},height=${height},top=${top},left=${left}`);
}

function logout() {
    localStorage.removeItem('github_token');
    checkLogin();
}

document.addEventListener("DOMContentLoaded", checkLogin);