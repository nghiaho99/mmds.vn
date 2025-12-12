const express = require('express');
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