const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const csurf = require('csurf');
require('dotenv').config(); // Tải các biến môi trường từ file .env

const pageRoutes = require('./routes/pages');
const newsRoutes = require('./routes/news');
const contactRoutes = require('./routes/contact');
const adminRoutes = require('./routes/admin');
const helmet = require('helmet');

const app = express();
const port = 5200;

// Use Helmet to set secure HTTP headers, with a specific Content Security Policy
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "*.youtube.com", "*.googlevideo.com", "s.ytimg.com"],
            "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            "img-src": ["'self'", "https://smartsign.com.vn", "data:", "*.ytimg.com", "blob:"],
            "frame-src": ["'self'", "*.google.com", "*.youtube.com", "www.youtube-nocookie.com"],
            "connect-src": ["'self'", "*.youtube.com", "cdn.jsdelivr.net", "*.googlevideo.com"],
            "media-src": ["'self'", "*.youtube.com", "*.googlevideo.com"],
            "object-src": ["'none'"],
        },
    })
);

// Thiết lập view engine là EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Phục vụ các tệp tĩnh từ thư mục 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Phục vụ TinyMCE từ node_modules
app.use('/tinymce', express.static(path.join(__dirname, 'node_modules', 'tinymce')));

// Sử dụng body-parser để xử lý dữ liệu POST
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
app.use(bodyParser.json({ limit: '10mb' }));

// Cấu hình session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Cấu hình CSRF protection
const csrfProtection = csurf();
app.use(csrfProtection);

// Middleware to make CSRF token available in all views
app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
});

// SEO Middleware
const seoDataPath = path.join(__dirname, 'seo-data.json');
const newsDataPathForSeo = path.join(__dirname, 'news_data.json');

app.use((req, res, next) => {
    // Skip SEO middleware for admin routes
    if (req.path.startsWith('/admin')) {
        return next();
    }

    try {
        const seoData = JSON.parse(fs.readFileSync(seoDataPath, 'utf8'));
        const defaultSeo = {
            title: 'MMDS.VN - Dịch vụ chất lượng',
            description: 'Chúng tôi cung cấp các dịch vụ tốt nhất.'
        };

        let pageSeo = seoData.routes.find(r => r.path === req.path);

        // Handle dynamic news articles
        if (!pageSeo && req.path.startsWith('/tin-tuc/')) {
            const articleLink = req.path.split('/')[2];
            const newsTemplate = seoData.routes.find(r => r.path === '/tin-tuc/:articleLink');
            if (newsTemplate) {
                const newsData = JSON.parse(fs.readFileSync(newsDataPathForSeo, 'utf8'));
                const article = newsData.find(a => a.articleLink === articleLink);
                if (article) {
                    // Create a copy to avoid modifying the cached template
                    pageSeo = JSON.parse(JSON.stringify(newsTemplate));
                    pageSeo.title = pageSeo.title.replace('{{TEN_BAI_VIET}}', article.title);
                    pageSeo.description = pageSeo.description.replace('{{TEN_BAI_VIET}}', article.title);
                }
            }
        }
        
        res.locals.seo = pageSeo || defaultSeo;

    } catch (error) {
        console.error('Error reading SEO data:', error);
        res.locals.seo = {
            title: 'MMDS.VN',
            description: 'Lỗi tải dữ liệu SEO.'
        };
    }
    next();
});

// Sitemap Generation
app.get('/sitemap.xml', (req, res) => {
    const baseUrl = 'https://mmds.vn';
    const sitemapPath = path.join(__dirname, 'seo-data.json');
    const newsPath = path.join(__dirname, 'news_data.json');

    try {
        const sitemapData = JSON.parse(fs.readFileSync(sitemapPath, 'utf8'));
        const newsData = JSON.parse(fs.readFileSync(newsPath, 'utf8'));

        let xml = '<?xml version="1.0" encoding="UTF-8"?>';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

        const today = new Date().toISOString().split('T')[0];

        // Add static routes
        sitemapData.routes.forEach(route => {
            // Ignore the dynamic article template
            if (route.path.includes(':')) return;

            xml += '<url>';
            xml += `<loc>${baseUrl}${route.path}</loc>`;
            xml += `<lastmod>${today}</lastmod>`;
            xml += '</url>';
        });

        // Add news articles
        newsData.forEach(article => {
            const articleUrl = `${baseUrl}/tin-tuc/${article.articleLink}`;
            const lastMod = new Date(article.createdAt).toISOString().split('T')[0];
            xml += '<url>';
            xml += `<loc>${articleUrl}</loc>`;
            xml += `<lastmod>${lastMod}</lastmod>`;
            xml += '</url>';
        });

        xml += '</urlset>';

        res.header('Content-Type', 'application/xml');
        res.send(xml);

    } catch (error) {
        console.error('Sitemap generation error:', error);
        res.status(500).send('Error generating sitemap.');
    }
});


// Sử dụng các routes đã được tách ra
app.use('/', pageRoutes);
app.use('/tin-tuc', newsRoutes);
app.use('/', contactRoutes);
app.use('/admin', adminRoutes);

// CSRF error handler
app.use((err, req, res, next) => {
    if (err.code !== 'EBADCSRFTOKEN') return next(err);
    // handle CSRF token errors here
    res.status(403).send('Form tampered with');
});

app.listen(port, () => {
  console.log(`Server đang chạy tại http://localhost:${port}`);
});