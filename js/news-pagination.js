// News Pagination System
const ARTICLES_PER_PAGE = 10;
let currentPage = 1;

function renderNewsPage(page) {
    const startIndex = (page - 1) * ARTICLES_PER_PAGE;
    const endIndex = startIndex + ARTICLES_PER_PAGE;
    const pageArticles = newsArticles.slice(startIndex, endIndex);

    const newsContainer = document.getElementById('news-container');
    newsContainer.innerHTML = '';

    pageArticles.forEach(article => {
        const articleElement = document.createElement('article');
        articleElement.className = 'news-item';
        articleElement.innerHTML = `
            <div class="news-meta">
                <span class="news-date">${article.date}</span>
                <span class="news-category">${article.category}</span>
            </div>
            <h3>${article.title}</h3>
            <p>${article.content}</p>
        `;
        newsContainer.appendChild(articleElement);
    });

    renderPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderPagination() {
    const totalPages = Math.ceil(newsArticles.length / ARTICLES_PER_PAGE);
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = '';

    // Previous button
    const prevButton = document.createElement('button');
    prevButton.className = 'pagination-btn' + (currentPage === 1 ? ' disabled' : '');
    prevButton.innerHTML = '← Previous';
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderNewsPage(currentPage);
        }
    };
    paginationContainer.appendChild(prevButton);

    // Page numbers
    const pageNumbers = document.createElement('div');
    pageNumbers.className = 'pagination-numbers';

    // Always show first page
    addPageButton(1, pageNumbers);

    // Show ellipsis if needed
    if (currentPage > 3) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'pagination-ellipsis';
        ellipsis.textContent = '...';
        pageNumbers.appendChild(ellipsis);
    }

    // Show pages around current page
    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(totalPages - 1, currentPage + 1);

    for (let i = startPage; i <= endPage; i++) {
        addPageButton(i, pageNumbers);
    }

    // Show ellipsis if needed
    if (currentPage < totalPages - 2) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'pagination-ellipsis';
        ellipsis.textContent = '...';
        pageNumbers.appendChild(ellipsis);
    }

    // Always show last page
    if (totalPages > 1) {
        addPageButton(totalPages, pageNumbers);
    }

    paginationContainer.appendChild(pageNumbers);

    // Next button
    const nextButton = document.createElement('button');
    nextButton.className = 'pagination-btn' + (currentPage === totalPages ? ' disabled' : '');
    nextButton.innerHTML = 'Next →';
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderNewsPage(currentPage);
        }
    };
    paginationContainer.appendChild(nextButton);

    // Page info
    const pageInfo = document.createElement('div');
    pageInfo.className = 'pagination-info';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${newsArticles.length} articles)`;
    paginationContainer.appendChild(pageInfo);
}

function addPageButton(pageNum, container) {
    const pageButton = document.createElement('button');
    pageButton.className = 'pagination-number' + (pageNum === currentPage ? ' active' : '');
    pageButton.textContent = pageNum;
    pageButton.onclick = () => {
        currentPage = pageNum;
        renderNewsPage(currentPage);
    };
    container.appendChild(pageButton);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('news-container')) {
        renderNewsPage(1);
    }
});
