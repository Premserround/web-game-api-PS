const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) console.error(" Database connection failed:", err);
  else console.log(" Connected to MySQL Database!");
});

app.post("/api/register", upload.single("photo"), (req, res) => {
  const { username, email, password } = req.body;
  const photo = req.file ? req.file.filename : null;

  if (!username || !email || !password) {
    return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });
  }

  const sql = "INSERT INTO users (username, email, password, photo) VALUES (?, ?, ?, ?)";
  db.query(sql, [username, email, password, photo], (err, result) => {
    if (err) {
      console.error(" Insert error:", err);
      return res.status(500).json({ message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
    }
    res.json({ message: "สมัครสมาชิกสำเร็จ!", photoUrl: photo ? `/uploads/${photo}` : null });
  });
});
// Login by username
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "กรุณากรอก username และ password" });
  }

  const sql = "SELECT * FROM users WHERE username = ?";
  db.query(sql, [username], async (err, results) => {
    if (err) {
      console.error(" DB error:", err);
      return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: "ไม่พบผู้ใช้นี้" });
    }

    const user = results[0];

    const match = password === user.password; // ถ้ายังไม่ hash password

    if (!match) {
      return res.status(401).json({ message: "รหัสผ่านไม่ถูกต้อง" });
    }

    res.json({
      message: "ล็อกอินสำเร็จ!",
      user: {
        uid: user.uid,
        username: user.username,
        email: user.email,
        role: user.role,
        photo: user.photo ? `/uploads/${user.photo}` : null
      }
    });
  });
});

app.get("/api/user/:uid", (req, res) => {
  const { uid } = req.params;

  const sql = "SELECT uid, username, email, role, photo FROM users WHERE uid = ?";
  db.query(sql, [uid], (err, results) => {
    if (err) {
      console.error(" DB error:", err);
      return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    }

    const user = results[0];
    user.photo = user.photo ? `/uploads/${user.photo}` : null;

    res.json(user);
  });
});

app.put("/api/user/:uid", upload.single("photo"), (req, res) => {
  const { uid } = req.params;
  const { username, email, password } = req.body;
  const photo = req.file ? req.file.filename : null;

  if (!username || !email)
    return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });

  const getUserSQL = "SELECT photo FROM users WHERE uid = ?";
  db.query(getUserSQL, [uid], (err, results) => {
    if (err) {
      console.error(" DB error:", err);
      return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
    }

    if (results.length === 0)
      return res.status(404).json({ message: "ไม่พบผู้ใช้" });

    const oldPhoto = results[0].photo;

    let sql = "UPDATE users SET username = ?, email = ?";
    const params = [username, email];

    if (password) {
      sql += ", password = ?";
      params.push(password);
    }

    if (photo) {
      sql += ", photo = ?";
      params.push(photo);

      if (oldPhoto) {
        const oldPath = path.join(uploadDir, oldPhoto);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    sql += " WHERE uid = ?";
    params.push(uid);

    db.query(sql, params, (err2) => {
      if (err2) {
        console.error(" Update error:", err2);
        return res.status(500).json({ message: "ไม่สามารถอัปเดตข้อมูลได้" });
      }

      res.json({
        message: "อัปเดตโปรไฟล์สำเร็จ!",
        photoUrl: photo
          ? `/uploads/${photo}`
          : oldPhoto
          ? `/uploads/${oldPhoto}`
          : null,
      });
    });
  });
});

app.get('/test', (req, res) => {
  res.send('Test hello gameshop'); // เวลาเรียก /hi จะตอบ hi
});


app.listen(port, () => console.log(` Server running on http://localhost:${port}`));
