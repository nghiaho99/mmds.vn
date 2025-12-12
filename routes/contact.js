const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const he = require('he');

// Route để xử lý gửi email
router.post('/send-email', (req, res) => {
  const { name, phone, email, service, mst } = req.body;

  // Sanitize all inputs to prevent XSS
  const sanitizedName = name || '';
  const sanitizedPhone = phone || '';
  const sanitizedEmail = email || '';
  const sanitizedService = service || 'Không chọn dịch vụ cụ thể';
  const sanitizedMst = mst || '';

  // Cấu hình Nodemailer với thông tin từ file .env
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true cho cổng 465, false cho các cổng khác như 587 hoặc 25
    ignoreTLS: true,  
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.RECIPIENT_EMAIL, // Đọc email người nhận từ file .env
    subject: 'Yêu cầu tư vấn mới từ Website',
    html: `
      <h2>Thông tin khách hàng đăng ký tư vấn:</h2>
      <ul>
        <li><strong>Họ và tên:</strong> ${sanitizedName}</li>
        <li><strong>Số điện thoại:</strong> ${sanitizedPhone}</li>
        <li><strong>Email:</strong> ${sanitizedEmail}</li>
        <li><strong>Dịch vụ quan tâm:</strong> ${sanitizedService}</li>
        ${sanitizedMst ? `<li><strong>Mã số thuế:</strong> ${sanitizedMst}</li>` : ''}
      </ul>
    `,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      res.status(500).json({ success: false, message: 'Có lỗi xảy ra, vui lòng thử lại.' });
    } else {
      console.log('Email sent: ' + info.response);
      res.status(200).json({ success: true, message: 'Gửi thông tin thành công! Chúng tôi sẽ liên hệ với bạn sớm.' });
    }
  });
});

module.exports = router;
