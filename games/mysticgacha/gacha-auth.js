"use strict";
// ======================================================================
//  GACHA-AUTH.JS — вход ТОЛЬКО через GitHub (тот же Worker и тот же токен, что на вики)
//  Прогресс хранится в приватном Gist аккаунта игрока: файл mysticrealities-gacha.json
// ======================================================================
const AUTH_WORKER_URL = "https://mystic-auth.igoredisan974.workers.dev";
const GH_FILE = "mysticrealities-gacha.json";
let gistId = null, saveChain = Promise.resolve();

const ghToken = () => localStorage.getItem("github_token");
const ghFetch = (path, opts = {}) => fetch("https://api.github.com" + path, {
    ...opts, headers: { Authorization: `token ${ghToken()}`, Accept: "application/vnd.github+json", ...(opts.headers || {}) }
});

// Токен прилетает от Worker после входа в окне GitHub (как на вики)
window.addEventListener("message", (event) => {
    if (event.origin === AUTH_WORKER_URL && event.data && event.data.type === "github-auth-success" && event.data.token) {
        localStorage.setItem("github_token", event.data.token);
        window.dispatchEvent(new Event("gh-auth"));
    }
});

function ghLogin() {
    const w = 600, h = 700;
    window.open(AUTH_WORKER_URL, "GitHub Login", `width=${w},height=${h},top=${(screen.height - h) / 2},left=${(screen.width - w) / 2}`);
}
function ghLogout() {
    localStorage.removeItem("github_token");
    localStorage.removeItem("gacha_gh_user");
    gistId = null;
}
// Возвращает {id, login} или null (нет токена / токен недействителен)
async function ghVerify() {
    if (!ghToken()) return null;
    try {
        const res = await ghFetch("/user");
        if (res.status === 401) { ghLogout(); return null; }
        if (!res.ok) throw new Error("user " + res.status);
        const u = await res.json();
        const user = { id: u.id, login: u.login };
        localStorage.setItem("gacha_gh_user", JSON.stringify(user));
        return user;
    } catch (e) {
        // нет сети — играем под последним входом, облако отключится само
        return JSON.parse(localStorage.getItem("gacha_gh_user") || "null");
    }
}

// Облачное сохранение в приватный Gist (нужно право "gist" у токена)
const CLOUD = {
    async load() {
        const res = await ghFetch("/gists?per_page=100");
        if (!res.ok) throw new Error("gists " + res.status);
        const g = (await res.json()).find((x) => x.files && x.files[GH_FILE]);
        if (!g) return null;
        gistId = g.id;
        const full = await (await ghFetch("/gists/" + g.id)).json();
        const f = full.files && full.files[GH_FILE];
        return f && f.content ? JSON.parse(f.content) : null;
    },
    // Сохранения идут строго по очереди, чтобы не создать два Gist одновременно
    save(name, state) {
        const body = JSON.stringify(state);
        const run = async () => {
            const files = { [GH_FILE]: { content: body } };
            let res;
            if (gistId) res = await ghFetch("/gists/" + gistId, { method: "PATCH", body: JSON.stringify({ files }) });
            else {
                res = await ghFetch("/gists", { method: "POST", body: JSON.stringify({ description: "MysticRealities gacha save", public: false, files }) });
                if (res.ok) gistId = (await res.json()).id;
            }
            if (!res.ok) throw new Error("gist save " + res.status);
        };
        saveChain = saveChain.then(run, run);
        return saveChain;
    }
};
