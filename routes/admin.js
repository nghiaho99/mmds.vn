const express = require('express');
const router = express.Router();

// Provide a default SEO object for all admin routes to prevent template errors
router.use((req, res, next) => {
    res.locals.seo = {
        title: 'Admin - MMDS.VN',
        description: 'Khu vực quản trị website.'
    };
    next();
});

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const dataPath = path.join(__dirname, '..', 'news_data.json');
const uploadsDir = path.join(__dirname, '..', 'public', 'images', 'uploads');

// Ensure the uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// --- AUTHENTICATION MIDDLEWARE ---
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/admin/login');
};

// --- LOGIN ROUTES ---
router.get('/login', (req, res) => {
    res.render('admin/login', { error: null });
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        req.session.user = { username: username };
        res.redirect('/admin/news');
    } else {
        res.render('admin/login', { error: 'Invalid username or password' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/admin/news');
        }
        res.clearCookie('connect.sid');
        res.redirect('/admin/login');
    });
});

// --- MULTER CONFIGURATIONS ---

// 1. For TinyMCE (saves directly to disk)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const safeFilename = Date.now() + path.extname(file.originalname);
    cb(null, safeFilename);
  }
});
const tinyMceUpload = multer({ storage: diskStorage });

// 2. For Article Images (stores in memory for processing)
const memoryStorage = multer.memoryStorage();
const uploadArticleImage = multer({ storage: memoryStorage });


// Helper function to read data
const readData = () => {
  const jsonData = fs.readFileSync(dataPath);
  return JSON.parse(jsonData);
};

// Helper function to write data
const writeData = (data) => {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
};

// Apply authentication middleware to all routes below this point
router.use(isAuthenticated);

// --- SEO MANAGEMENT ROUTES ---
const seoDataPath = path.join(__dirname, '..', 'seo-data.json');

const readSeoData = () => {
    try {
        const jsonData = fs.readFileSync(seoDataPath);
        return JSON.parse(jsonData);
    } catch (error) { return { routes: [] }; }
};

const writeSeoData = (data) => {
    fs.writeFileSync(seoDataPath, JSON.stringify(data, null, 2));
};

router.get('/seo', (req, res) => {
    const seoData = readSeoData();
    const successMessage = req.session.successMessage;
    req.session.successMessage = null;
    res.render('admin/seo', { routes: seoData.routes, successMessage, csrfToken: req.csrfToken() });
});

router.post('/seo', (req, res) => {
    const seoData = readSeoData();
    seoData.routes.forEach(route => {
        const titleKey = `${route.path}_title`;
        const descriptionKey = `${route.path}_description`;
        if (req.body[titleKey]) route.title = req.body[titleKey];
        if (req.body[descriptionKey]) route.description = req.body[descriptionKey];
    });
    writeSeoData(seoData);
    req.session.successMessage = 'Cập nhật SEO thành công!';
    res.redirect('/admin/seo');
});

// --- NEWS MANAGEMENT ROUTES ---

// Route for TinyMCE image uploads
router.post('/upload-image', tinyMceUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Không có file nào được tải lên.' });
  }
  res.json({ location: `/images/uploads/${req.file.filename}` });
});

// List all news articles
router.get('/news', (req, res) => {
  const articles = readData();
  res.render('admin/news_list', { articles });
});

// Show form for adding a new article
router.get('/news/new', (req, res) => {
  const errorMessage = req.query.error;
  res.render('admin/news_form', { article: undefined, errorMessage, csrfToken: req.csrfToken() });
});

// Handle submission of the new article form
router.post('/news/new', uploadArticleImage.single('articleImage'), async (req, res) => {
    const articles = readData();
    const { altText, title, articleLink, content, author } = req.body;

    if (articles.some(a => a.articleLink === articleLink)) {
        return res.redirect('/admin/news/new?error=duplicate_link');
    }

    let imageSrc = '';
    if (req.file) {
        const filename = `${Date.now()}.webp`;
        const outputPath = path.join(uploadsDir, filename);
        try {
            await sharp(req.file.buffer).webp({ quality: 80 }).toFile(outputPath);
            imageSrc = `/images/uploads/${filename}`;
        } catch(e) {
            console.error("Image processing failed:", e);
            // Decide how to handle error: redirect with error, or save without image?
            // For now, we'll proceed without an image.
        }
    }

    const sanitizedContent = DOMPurify.sanitize(content);
    const newId = articles.length > 0 ? Math.max(...articles.map(a => a.id)) + 1 : 1;
    const newArticle = {
        id: newId,
        imageSrc,
        altText,
        title,
        articleLink,
        content: sanitizedContent,
        author,
        createdAt: new Date().toISOString()
    };
    articles.push(newArticle);
    writeData(articles);
    res.redirect('/admin/news');
});

// Show form for editing an article
router.get('/news/edit/:id', (req, res) => {
    const articles = readData();
    const article = articles.find(a => a.id === parseInt(req.params.id));
    const errorMessage = req.query.error;

    if (article) {
        res.render('admin/news_form', { article, errorMessage, csrfToken: req.csrfToken() });
    } else {
        res.redirect('/admin/news?error=article_not_found');
    }
});

// Handle submission of the edited article form
router.post('/news/edit/:id', uploadArticleImage.single('articleImage'), async (req, res) => {
    const articles = readData();
    const articleId = parseInt(req.params.id);
    const { altText, title, articleLink, content, author } = req.body;

    const index = articles.findIndex(a => a.id === articleId);
    if (index === -1) {
        return res.redirect('/admin/news?error=article_not_found');
    }

    if (articles.some(a => a.articleLink === articleLink && a.id !== articleId)) {
        return res.redirect(`/admin/news/edit/${articleId}?error=duplicate_link`);
    }
    
    let updatedArticle = { ...articles[index] };
    
    // Process new image if uploaded
    if (req.file) {
        const filename = `${Date.now()}.webp`;
        const outputPath = path.join(uploadsDir, filename);
        try {
            await sharp(req.file.buffer).webp({ quality: 80 }).toFile(outputPath);
            updatedArticle.imageSrc = `/images/uploads/${filename}`;
        } catch(e) {
            console.error("Image processing failed:", e);
        }
    }

    const sanitizedContent = DOMPurify.sanitize(content);
    
    updatedArticle = {
        ...updatedArticle,
        altText,
        title,
        articleLink,
        content: sanitizedContent,
        author
    };

    articles[index] = updatedArticle;
    writeData(articles);
    res.redirect('/admin/news');
});


// Route to delete an article
router.get('/news/delete/:id', (req, res) => {
    let articles = readData();
    articles = articles.filter(a => a.id !== parseInt(req.params.id));
    writeData(articles);
    res.redirect('/admin/news');
});

module.exports = router;