
const playButton = document.getElementById("playButton");

if (playButton) {
    playButton.addEventListener("click", () => {
        window.location.href = "games/mysticguessr/index.html";
    });
}
