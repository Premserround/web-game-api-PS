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
  host: "202.28.34.210",
  port: 3309,
  user: "66011212180",
  password: "66011212180",
  database: "db66011212180"
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

    const match = password === user.password;

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

// app.get('/test', (req, res) => {
//   res.send('Test hello gameshop');
// });

// ✅ ดึงข้อมูลผู้ใช้ทั้งหมด
app.get("/users", (req, res) => {
  const sql = "SELECT uid, username, email, role, photo FROM users";
  db.query(sql, (err, results) => {
    if (err) {
      console.error(" DB error:", err);
      return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
    }

    // เพิ่ม path ของรูปภาพให้ครบ
    const users = results.map(user => ({
      ...user,
      photo: user.photo ? `/uploads/${user.photo}` : null,
    }));

    res.json(users);
  });
});


// API สร้างเกมใหม่
app.post('/api/game', upload.single('image'), (req, res) => {
  const { name, price, detail, category, release_date } = req.body;
  const image = req.file ? req.file.filename : null;

  if (!name) {
    return res.status(400).json({ message: 'กรุณาใส่ชื่อเกม' });
  }

  // ถ้า release_date ไม่มี ให้ใช้วันปัจจุบัน
  const releaseDate = release_date || new Date().toISOString().split('T')[0];

  const sql = `
    INSERT INTO game (name, count_sold, price, detail, image, category, release_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  // count_sold เริ่มที่ 0 เสมอ
  db.query(sql, [name, 0, price || '0', detail || '', image, category || '', releaseDate], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.status(201).json({ message: 'สร้างเกมเรียบร้อย', gameId: result.insertId });
  });
});

// ดึงข้อมูลเกมทั้งหมด
app.get('/api/game', (req, res) => {
  const sql = `
    SELECT gid, name, count_sold, price, detail, image, category, release_date
    FROM game
    ORDER BY release_date DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: err.message });

    // เพิ่ม path ของรูปภาพ
    const games = results.map(game => ({
      ...game,
      image: game.image ? `/uploads/${game.image}` : null
    }));

    res.json(games);
  });
});

// ดึงเกมตาม id
app.get('/api/game/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'SELECT gid, name, count_sold, price, detail, image, category, release_date FROM game WHERE gid = ?';
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'ไม่พบเกม' });

    const game = results[0];
    game.image = game.image ? `/uploads/${game.image}` : null;
    res.json(game);
  });
});

// ✅ ตรวจสอบ role ของผู้ใช้จากฐานข้อมูล
app.get("/api/check-role/:uid", (req, res) => {
  const { uid } = req.params;

  if (!uid) return res.status(400).json({ message: "กรุณาระบุ UID" });

  const sql = "SELECT role FROM users WHERE uid = ?";
  db.query(sql, [uid], (err, results) => {
    if (err) {
      console.error(" DB error:", err);
      return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบฐานข้อมูล" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    }

    res.json({ role: results[0].role });
  });
});

// ✅ ลบเกมตาม id (เฉพาะ admin)
app.delete("/api/game/:id", (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "กรุณาระบุ ID ของเกม" });
  }

  const sql = "DELETE FROM game WHERE gid = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("เกิดข้อผิดพลาดในการลบ:", err);
      return res.status(500).json({ message: "เกิดข้อผิดพลาดในการลบเกม" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "ไม่พบเกมที่ต้องการลบ" });
    }

    res.json({ message: "ลบเกมสำเร็จ" });
  });
});

app.put('/api/game/:id', upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { name, price, detail, category, release_date } = req.body; // release_date จะ optional
  const image = req.file ? req.file.filename : null;

  if (!name) return res.status(400).json({ message: 'กรุณาใส่ชื่อเกม' });

  // ตรวจสอบว่าเกมมีอยู่
  const checkSql = 'SELECT image, release_date FROM game WHERE gid = ?';
  db.query(checkSql, [id], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'ไม่พบเกม' });

    const oldImage = results[0].image;
    const oldReleaseDate = results[0].release_date; // เก็บวันเดิม

    // สร้าง SQL สำหรับอัปเดตเฉพาะฟิลด์ที่ต้องการ
    let sql = 'UPDATE game SET name = ?, price = ?, detail = ?, category = ?';
    const params = [name, price || '0', detail || '', category || ''];

    // ถ้ามี release_date ใหม่ให้ใช้ ถ้าไม่ใช้วันเดิม
    if (release_date) {
      sql += ', release_date = ?';
      params.push(release_date);
    }

    if (image) {
      sql += ', image = ?';
      params.push(image);

      if (oldImage) {
        const oldPath = path.join(uploadDir, oldImage);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    sql += ' WHERE gid = ?';
    params.push(id);

    db.query(sql, params, (err2) => {
      if (err2) return res.status(500).json({ message: err2.message });
      res.json({ message: 'แก้ไขเกมสำเร็จ' });
    });
  });
});
// ================== 💰 Get user balance ==================
app.get("/api/user/:uid/balance", (req, res) => {
  const { uid } = req.params;
  const sql = "SELECT wallets_balance FROM users WHERE uid = ?";

  db.query(sql, [uid], (err, results) => {
    if (err) return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
    if (results.length === 0) return res.status(404).json({ message: "ไม่พบผู้ใช้" });

    res.json({ balance: results[0].wallets_balance || 0 });
  });
});

// ================== 💰 Top-up + Save Transaction ==================
app.post('/api/topup', (req, res) => {
  const { uid, amount } = req.body;

  if (!uid || !amount || amount <= 0) {
    return res.status(400).json({ message: 'Invalid data' });
  }

  db.beginTransaction(err => {
    if (err) return res.status(500).json({ message: 'Transaction error' });

    // ✅ Lock row ป้องกัน race condition
    const lockSql = "SELECT wallets_balance FROM users WHERE uid = ? FOR UPDATE";
    db.query(lockSql, [uid], (err, results) => {
      if (err || results.length === 0) {
        return db.rollback(() => {
          res.status(500).json({ message: "User not found or lock failed" });
        });
      }

      const currentBalance = parseFloat(results[0].wallets_balance) || 0;
      const newBalance = currentBalance + parseFloat(amount);

      // ✅ Update balance
      const updateSql = "UPDATE users SET wallets_balance = ? WHERE uid = ?";
      db.query(updateSql, [newBalance, uid], err2 => {
        if (err2) {
          return db.rollback(() => {
            res.status(500).json({ message: "Balance update failed" });
          });
        }

        // ✅ Save transaction log
        const logSql = `
          INSERT INTO transactions (uid, type, amount, description, created_at)
          VALUES (?, 'topup', ?, ?, NOW())
        `;
        const desc = `เติมเงินจำนวน ${amount} บาท`;

        db.query(logSql, [uid, amount, desc], err3 => {
          if (err3) {
            return db.rollback(() => {
              res.status(500).json({ message: "Transaction log failed" });
            });
          }

          // ✅ COMMIT ทุกอย่าง (atomic)
          db.commit(err4 => {
            if (err4) {
              return db.rollback(() => {
                res.status(500).json({ message: "Commit failed" });
              });
            }

            return res.json({
              message: `เติมเงิน ${amount} บาท สำเร็จ!`,
              newBalance: newBalance.toFixed(2)
            });
          });
        });
      });
    });
  });
});


// ================== 🎮 ซื้อเกม (แก้ไขแล้ว) ==================
app.post("/api/buy", (req, res) => {
    const { uid, gid } = req.body;

    if (!uid || !gid) {
        return res.status(400).json({ message: "ข้อมูลไม่ครบ uid หรือ gid" });
    }

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ message: "Transaction error" });

        // ✅ 1. แก้ไข: ดึง category มาด้วย
        const getGameSQL = "SELECT price, name, category FROM game WHERE gid = ?";
        const lockUserSQL = "SELECT wallets_balance FROM users WHERE uid = ? FOR UPDATE";

        db.query(getGameSQL, [gid], (err1, gameResults) => {
            if (err1 || gameResults.length === 0) {
                return db.rollback(() => res.status(404).json({ message: "ไม่พบเกมนี้" }));
            }

            // Game object มี price, name, และ category
            const game = gameResults[0]; 

            db.query(lockUserSQL, [uid], (err2, userResults) => {
                // ... (โค้ดส่วนอื่น ๆ เหมือนเดิม)
                if (err2 || userResults.length === 0) {
                    return db.rollback(() => res.status(404).json({ message: "ไม่พบผู้ใช้" }));
                }

                const userBalance = parseFloat(userResults[0].wallets_balance) || 0;

                // ✅ ตรวจสอบยอดเงิน
                if (userBalance < game.price) {
                    return db.rollback(() => {
                        res.status(400).json({ message: "ยอดเงินไม่เพียงพอ" });
                    });
                }

                const newBalance = userBalance - game.price;

                // ✅ ตัดเงิน
                const updateSQL = "UPDATE users SET wallets_balance = ? WHERE uid = ?";
                db.query(updateSQL, [newBalance, uid], (err3) => {
                    if (err3) {
                        return db.rollback(() => {
                            res.status(500).json({ message: "ไม่สามารถตัดเงินได้" });
                        });
                    }

                    // ✅ 2. แก้ไข: บันทึกธุรกรรม - เพิ่ม game_name และ category
                    const insertTransSQL = `
                        INSERT INTO transactions (uid, type, amount, description, game_name, category, gid, created_at)
                        VALUES (?, 'purchase', ?, ?, ?, ?, ?, NOW()) 
                    `;
                    const desc = `ซื้อเกม ${game.name}`;

                    // เพิ่ม game.name, game.category, และ gid ใน params
                    db.query(insertTransSQL, [uid, game.price, desc, game.name, game.category, gid], (err4) => {
                        if (err4) {
                            return db.rollback(() => {
                                res.status(500).json({ message: "ไม่สามารถบันทึกธุรกรรมได้" });
                            });
                        }

                        // ✅ COMMIT
                        db.commit((err5) => {
                            if (err5) {
                                return db.rollback(() => {
                                    res.status(500).json({ message: "Commit ล้มเหลว" });
                                });
                            }

                            res.json({
                                message: "ซื้อเกมสำเร็จ!",
                                game: game.name,
                                newBalance: newBalance.toFixed(2),
                            });
                        });
                    });
                });
            });
        });
    });
});



// ✅ ประวัติการเติมเงิน
app.get("/api/transactions/topup/:uid", (req, res) => {
  const { uid } = req.params;
  const sql = `
    SELECT tid, type, amount, description, created_at
    FROM transactions
    WHERE uid = ? AND type = 'topup'
    ORDER BY created_at ASC
  `;
  db.query(sql, [uid], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.json(results);
  });
});

// ✅ ประวัติการซื้อเกม (เวอร์ชันอัปเกรด)
app.get("/api/transactions/purchase/:uid", (req, res) => {
    const { uid } = req.params;

    const sql = `
        SELECT 
          t.tid,
          t.category,
          t.game_name,
          t.amount AS price,
          1 AS quantity,
          t.created_at AS date
        FROM transactions t
        WHERE t.uid = ? 
          AND t.type = 'purchase'
          AND t.game_name IS NOT NULL  /* 👈 เพิ่มเงื่อนไขนี้ */
          AND t.category IS NOT NULL   /* 👈 เพิ่มเงื่อนไขนี้ */
        ORDER BY t.created_at ASC
    `;
    
    db.query(sql, [uid], (err, results) => {
        if (err) {
            console.error("Database error fetching purchase history:", err);
            return res.status(500).json({ message: "Database error" });
        }
        res.json(results); 
    });
});
// ✅ ดึงรายชื่อผู้ใช้ทั้งหมด (สำหรับหน้า admin)
app.get("/api/admin/users", (req, res) => {
  const sql = `
    SELECT uid, username, photo, wallets_balance
    FROM users
    ORDER BY uid ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching users:", err);
      return res.status(500).json({ message: err.message });
    }

    // เพิ่ม path ให้รูปภาพ
    const users = results.map(user => ({
      ...user,
      photo: user.photo ? `/uploads/${user.photo}` : null,
    }));

    res.json(users);
  });
});

app.listen(port, () => console.log(` Server running on http://localhost:${port}`));