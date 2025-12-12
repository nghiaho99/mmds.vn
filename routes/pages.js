const express = require('express');
const router = express.Router();

// Route để render trang chính
router.get('/', (req, res) => {
  res.render('index');
});

// Route cho trang hướng dẫn
router.get('/huong-dan', (req, res) => {
  res.render('guide');
});

// Route cho trang công ty
router.get('/cong-ty', (req, res) => {
  res.render('company');
});

module.exports = router;
