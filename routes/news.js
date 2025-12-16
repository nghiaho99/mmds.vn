const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'news_data.json');

const striptags = require('striptags');

// Helper function to format date
function formatDate(isoString) {
  if (!isoString) return 'Chưa có thông tin';
  const date = new Date(isoString);
  const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
  return date.toLocaleDateString('vi-VN', options);
}

// Route cho trang tin tức (liệt kê tất cả)
router.get('/', (req, res) => {
  let allArticles = JSON.parse(fs.readFileSync(dataPath, 'utf-8')).sort((a, b) => b.id - a.id);
  const searchQuery = req.query.search || '';

  if (searchQuery) {
    allArticles = allArticles.filter(article => {
      const match = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    striptags(article.content).toLowerCase().includes(searchQuery.toLowerCase());
      return match;
    });
  }
  
  const page = parseInt(req.query.page) || 1;
  const articlesPerPage = 5;
  const totalArticles = allArticles.length;
  const totalPages = Math.ceil(totalArticles / articlesPerPage);
  const startIndex = (page - 1) * articlesPerPage;
  const endIndex = startIndex + articlesPerPage;
  
  const newsArticles = allArticles.slice(startIndex, endIndex);

  res.render('news', { 
    newsArticles, 
    formatDate: formatDate,
    currentPage: page,
    totalPages: totalPages,
    searchQuery: searchQuery
  });
});

// Route cho trang chi tiết tin tức
router.get('/:articleLink', (req, res) => {
  const articles = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const article = articles.find(a => a.articleLink === req.params.articleLink);

  if (article) {
    res.render('news_detail', { article, formatDate: formatDate }); // Truyền hàm formatDate vào template
  } else {
    // If article not found, redirect to the news list page
    res.redirect('/'); // Redirects to /tin-tuc because this router is mounted at /tin-tuc
  }
});

module.exports = router;
