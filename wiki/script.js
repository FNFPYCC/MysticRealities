
const searchInput = document.getElementById("searchInput");
const articleCards = document.querySelectorAll(".article-card");
const noResults = document.getElementById("noResults");
const searchCount = document.getElementById("searchCount");

function searchArticles() {
    const query = searchInput.value
        .toLowerCase()
        .trim();

    let visibleCount = 0;

    articleCards.forEach(card => {
        const title = card.dataset.title.toLowerCase();
        const text = card.textContent.toLowerCase();

        const matches =
            title.includes(query) ||
            text.includes(query);

        card.style.display = matches ? "flex" : "none";

        if (matches) {
            visibleCount++;
        }
    });

    noResults.style.display =
        visibleCount === 0 ? "block" : "none";

    if (query.length > 0) {
        searchCount.textContent =
            `Найдено статей: ${visibleCount}`;
    } else {
        searchCount.textContent = "";
    }
}

searchInput.addEventListener("input", searchArticles);
