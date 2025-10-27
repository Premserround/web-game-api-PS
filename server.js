const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const cloudinary = require('cloudinary').v2;

require("dotenv").config();


const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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
const upload = multer({ storage: multer.memoryStorage() });

// ฟังก์ชันอัปโหลดไป Cloudinary
const uploadToCloudinary = (buffer, folder = 'users') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    stream.end(buffer);
  });
};


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

// =================== Register ===================
app.post("/api/register", upload.single("photo"), async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });
  }

  let photoUrl = null;
  if (req.file && req.file.buffer) {
    try {
      const result = await uploadToCloudinary(req.file.buffer, 'users');
      photoUrl = result.secure_url;
    } catch (err) {
      return res.status(500).json({ message: "อัปโหลดรูปผิดพลาด", error: err.message });
    }
  }

  const sql = "INSERT INTO users (username, email, password, photo) VALUES (?, ?, ?, ?)";
  db.query(sql, [username, email, password, photoUrl], (err, result) => {
    if (err) return res.status(500).json({ message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
    res.json({ message: "สมัครสมาชิกสำเร็จ!", photoUrl });
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

// =================== Update Profile ===================
app.put("/api/user/:uid", upload.single("photo"), async (req, res) => {
  const { uid } = req.params;
  const { username, email, password } = req.body;

  if (!username || !email) return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });

  db.query("SELECT photo FROM users WHERE uid = ?", [uid], async (err, results) => {
    if (err) return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
    if (results.length === 0) return res.status(404).json({ message: "ไม่พบผู้ใช้" });

    let photoUrl = results[0].photo;

    if (req.file && req.file.buffer) {
      try {
        const result = await uploadToCloudinary(req.file.buffer, 'users');
        photoUrl = result.secure_url;
      } catch (err) {
        return res.status(500).json({ message: "อัปโหลดรูปผิดพลาด", error: err.message });
      }
    }

    let sql = "UPDATE users SET username = ?, email = ?, photo = ?";
    const params = [username, email, photoUrl];

    if (password) {
      sql += ", password = ?";
      params.push(password);
    }

    sql += " WHERE uid = ?";
    params.push(uid);

    db.query(sql, params, (err2) => {
      if (err2) return res.status(500).json({ message: "ไม่สามารถอัปเดตข้อมูลได้" });
      res.json({ message: "อัปเดตโปรไฟล์สำเร็จ!", photoUrl });
    });
  });
});

// app.get('/test', (req, res) => {
//   res.send('Test hello gameshop');
// });

// =================== Get Users including wallet balance ===================
app.get("/users", (req, res) => {
  const sql = "SELECT uid, username, email, role, photo, wallets_balance FROM users";
  
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });

    const users = results.map(user => ({
      ...user,
      photo: user.photo || null,
      wallets_balance: parseFloat(user.wallets_balance) || 0,
    }));

    res.json(users);
  });
});




// API สร้างเกมใหม่
app.post('/api/creategame', upload.single('image'), async (req, res) => {
  const { name, price, detail, cid, release_date } = req.body;

  if (!name) return res.status(400).json({ message: 'กรุณาใส่ชื่อเกม' });

  const releaseDate = release_date || new Date().toISOString().split('T')[0];
  let imageUrl = null;

  try {
    if (req.file) {
      // อัปโหลดไป Cloudinary
      const uploadResult = await uploadToCloudinary(req.file.buffer, 'gameshop');
      // เก็บเฉพาะ URL หรือ secure_url
      imageUrl = uploadResult.secure_url;
    }

    // ตรวจสอบ cid
    if (cid) {
      const catResults = await new Promise((resolve, reject) => {
        db.query('SELECT cid FROM categories WHERE cid = ?', [cid], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      if (catResults.length === 0) return res.status(400).json({ message: 'หมวดหมู่ไม่ถูกต้อง' });
    }

    // INSERT ลง DB (เก็บเฉพาะค่าที่ตรงกับ column)
    const result = await new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO game (name, count_sold, price, detail, image, cid, release_date)
        VALUES (?, 0, ?, ?, ?, ?, ?)
      `;
      db.query(sql, [name, price || 0, detail || '', imageUrl, cid || null, releaseDate], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    res.status(201).json({ 
      message: 'สร้างเกมเรียบร้อย', 
      gameId: result.insertId,
      imageUrl
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
  }
});



app.get('/api/game', (req, res) => {
  const sql = `
    SELECT g.gid, g.name, g.count_sold, g.price, g.detail, g.image, g.cid, c.name AS category, g.release_date
    FROM game g
    LEFT JOIN categories c ON g.cid = c.cid
    ORDER BY g.release_date DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: err.message });

    const games = results.map(game => ({
      ...game,
      image: game.image || null,
      category: game.category || null
    }));

    res.json(games);
  });
});



app.get('/api/game/:id', (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT g.gid, g.name, g.count_sold, g.price, g.detail, g.image, g.cid, c.name AS category, g.release_date
    FROM game g
    LEFT JOIN categories c ON g.cid = c.cid
    WHERE g.gid = ?
  `;
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'ไม่พบเกม' });

    const game = results[0];
    // ใช้ URL ตรงจาก DB
    game.image = game.image || null;

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
app.delete("/api/deletegame/:id", (req, res) => {
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

app.put('/api/updategame/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { name, price, detail, cid } = req.body;

  if (!name) return res.status(400).json({ message: 'กรุณาใส่ชื่อเกม' });

  // ตรวจสอบว่าเกมมีอยู่
  db.query('SELECT image FROM game WHERE gid = ?', [id], async (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'ไม่พบเกม' });

    const oldImage = results[0].image;
    let imageUrl = oldImage;

    // อัปโหลดรูปใหม่ไป Cloudinary ถ้ามีไฟล์
    if (req.file) {
      try {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'gameshop' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });
        imageUrl = result.secure_url;
      } catch (err) {
        return res.status(500).json({ message: 'อัปโหลดรูปผิดพลาด', error: err.message });
      }
    }

    // ตรวจสอบ cid ว่ามีอยู่จริงไหม
    const updateGameInDB = () => {
      let sql = 'UPDATE game SET name = ?, price = ?, detail = ?, cid = ?, image = ? WHERE gid = ?';
      const params = [name, price || 0, detail || '', cid || null, imageUrl, id];

      db.query(sql, params, (err2) => {
        if (err2) return res.status(500).json({ message: err2.message });
        res.json({ message: 'แก้ไขเกมสำเร็จ', imageUrl });
      });
    };

    if (cid) {
      db.query('SELECT cid FROM categories WHERE cid = ?', [cid], (errC, catResults) => {
        if (errC) return res.status(500).json({ message: errC.message });
        if (catResults.length === 0) return res.status(400).json({ message: 'หมวดหมู่ไม่ถูกต้อง' });

        updateGameInDB();
      });
    } else {
      updateGameInDB();
    }
  });
});

app.post("/api/buygame", (req, res) => {
  const { uid, gid, discountCode } = req.body;

  if (!uid || !gid) {
    return res.status(400).json({ message: "ข้อมูลไม่ครบ uid หรือ gid" });
  }

  db.beginTransaction(err => {
    if (err) return res.status(500).json({ message: "Transaction error", error: err.message });

    // เช็คว่าซื้อเกมนี้แล้วหรือยัง
    const checkBoughtSQL = "SELECT * FROM transactions WHERE uid = ? AND gid = ? AND type = 'purchase'";
    db.query(checkBoughtSQL, [uid, gid], (err0, boughtResults) => {
      if (err0) return db.rollback(() => res.status(500).json({ message: "ตรวจสอบธุรกรรมผิดพลาด", error: err0.message }));
      if (boughtResults.length > 0) return db.rollback(() => res.status(400).json({ message: "คุณซื้อเกมนี้แล้ว" }));

      const getGameSQL = "SELECT price, name, cid, count_sold FROM game WHERE gid = ?";
      const lockUserSQL = "SELECT wallets_balance FROM users WHERE uid = ? FOR UPDATE";

      db.query(getGameSQL, [gid], (err1, gameResults) => {
        if (err1 || gameResults.length === 0) {
          return db.rollback(() => res.status(404).json({ message: "ไม่พบเกมนี้", error: err1?.message }));
        }

        const game = gameResults[0];
        let finalPrice = parseFloat(game.price);

        const processPurchase = (discountAmount = 0) => {
          finalPrice -= discountAmount;
          if (finalPrice < 0) finalPrice = 0;

          db.query(lockUserSQL, [uid], (err2, userResults) => {
            if (err2 || userResults.length === 0) {
              return db.rollback(() => res.status(404).json({ message: "ไม่พบผู้ใช้", error: err2?.message }));
            }

            const userBalance = parseFloat(userResults[0].wallets_balance) || 0;
            if (userBalance < finalPrice) {
              return db.rollback(() => res.status(400).json({ message: "ยอดเงินไม่เพียงพอ" }));
            }

            const newBalance = userBalance - finalPrice;

            db.query("UPDATE users SET wallets_balance = ? WHERE uid = ?", [newBalance, uid], (err3) => {
              if (err3) return db.rollback(() => res.status(500).json({ message: "ไม่สามารถตัดเงินได้", error: err3.message }));

              const insertTransSQL = `
                INSERT INTO transactions
                (uid, type, amount, description, game_name, cid, gid, created_at)
                VALUES (?, 'purchase', ?, ?, ?, ?, ?, NOW())
              `;
              const desc = `ซื้อเกม ${game.name}`;
              const transParams = [uid, finalPrice, desc, game.name, game.cid || null, gid];

              db.query(insertTransSQL, transParams, (err4) => {
                if (err4) return db.rollback(() => res.status(500).json({ message: "ไม่สามารถบันทึกธุรกรรมได้", error: err4.message }));

                db.query("UPDATE game SET count_sold = count_sold + 1 WHERE gid = ?", [gid], (err5) => {
                  if (err5) return db.rollback(() => res.status(500).json({ message: "ไม่สามารถอัปเดตยอดขายได้", error: err5.message }));

                  const finalize = () => {
                    db.commit(err7 => {
                      if (err7) return db.rollback(() => res.status(500).json({ message: "Commit ล้มเหลว", error: err7.message }));
                      res.json({
                        success: true,
                        message: "ซื้อเกมสำเร็จ!",
                        game: game.name,
                        finalPrice,
                        newBalance: newBalance.toFixed(2),
                        discountUsed: discountCode || null
                      });
                    });
                  };

                  if (discountCode) {
                    db.query("UPDATE discounts SET used_count = used_count + 1 WHERE code = ?", [discountCode], (err6) => {
                      if (err6) return db.rollback(() => res.status(500).json({ message: "ไม่สามารถอัปเดตโค้ดส่วนลดได้", error: err6.message }));
                      finalize();
                    });
                  } else {
                    finalize();
                  }
                });
              });
            });
          });
        };

        if (discountCode) {
          const getDiscountSQL = "SELECT amount FROM discounts WHERE code = ? AND is_active = 1 AND (max_use IS NULL OR used_count < max_use)";
          db.query(getDiscountSQL, [discountCode], (errD, discountResults) => {
            if (errD) return db.rollback(() => res.status(500).json({ message: "ตรวจสอบโค้ดส่วนลดผิดพลาด", error: errD.message }));

            if (discountResults.length === 0) {
              return db.rollback(() => res.status(400).json({ message: "โค้ดส่วนลดไม่ถูกต้อง" }));
            }

            const discountAmount = parseFloat(discountResults[0].amount) || 0;
            processPurchase(discountAmount);
          });
        } else {
          processPurchase();
        }
      });
    });
  });
});


// // ================== 💰 Get user balance ==================
// app.get("/api/user/:uid/balance", (req, res) => {
//   const { uid } = req.params;
//   const sql = "SELECT wallets_balance FROM users WHERE uid = ?";

//   db.query(sql, [uid], (err, results) => {
//     if (err) return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
//     if (results.length === 0) return res.status(404).json({ message: "ไม่พบผู้ใช้" });

//     res.json({ balance: results[0].wallets_balance || 0 });
//   });
// });

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

app.get("/api/transactions/purchase/:uid", (req, res) => {
  const { uid } = req.params;

  const sql = `
    SELECT 
      t.tid,
      t.cid,
      c.name AS category_name,
      t.game_name,
      t.amount AS price,
      1 AS quantity,
      t.created_at AS date
    FROM transactions t
    LEFT JOIN categories c ON t.cid = c.cid
    WHERE t.uid = ? 
      AND t.type = 'purchase'
    ORDER BY t.created_at ASC
  `;

  db.query(sql, [uid], (err, results) => {
    if (err) {
      console.error("Database error fetching purchase history:", err);
      return res.status(500).json({ message: "Database error" });
    }

    const history = results.map(item => ({
      ...item,
      category: item.category_name || null
    }));

    res.json(history); 
  });
});

// ✅ ดึงรายชื่อผู้ใช้ทั้งหมด (สำหรับหน้า admin) แบบ Cloudinary
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

    // ถ้า photo มีค่า ให้ใช้ตรง ๆ ถ้าไม่มี ให้เป็น null หรือ default avatar
    const users = results.map(user => ({
      ...user,
      photo: user.photo || 'https://i.pravatar.cc/150?img=5' // default avatar
    }));

    res.json(users);
  });
});


app.get('/library/:uid', (req, res) => {
  const { uid } = req.params;

  const sql = `
    SELECT 
      g.gid,
      g.name,
      g.price,
      g.image,
      g.cid,
      c.name AS category_name
    FROM transactions t
    JOIN game g ON t.gid = g.gid
    LEFT JOIN categories c ON g.cid = c.cid
    WHERE t.uid = ? AND t.type = 'purchase'
    ORDER BY t.created_at DESC
  `;

  db.query(sql, [uid], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });

    // ส่งตรงจาก DB เหมือน /api/game/:id
    const games = results.map(game => ({
      ...game,
      image: game.image || null,
      category: game.category_name || null
    }));

    res.json(games);
  });
});


// GET /api/check-admin/:uid
app.get('/api/check-admin/:uid', (req, res) => {
  const { uid } = req.params;

  if (!uid) return res.status(400).json({ message: 'กรุณาระบุ UID' });

  const sql = 'SELECT role FROM users WHERE uid = ?';
  db.query(sql, [uid], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (results.length === 0) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });

    const isAdmin = results[0].role === 'admin';
    res.json({ isAdmin });
  });
});
// POST /api/discount
app.post('/api/discount', (req, res) => {
  const { code, amount, max_use, adminUid } = req.body;

  if (!code || !amount || !adminUid) {
    return res.status(400).json({ message: 'ข้อมูลไม่ครบ' });
  }

  // ตรวจสอบว่า adminUid เป็น admin
  const checkSql = 'SELECT role FROM users WHERE uid = ?';
  db.query(checkSql, [adminUid], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (results.length === 0 || results[0].role !== 'admin') {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์' });
    }

    const sql = `
      INSERT INTO discounts (code, amount, is_active, created_by, created_at, max_use, used_count)
      VALUES (?, ?, 1, ?, NOW(), ?, 0)
    `;

    db.query(sql, [code, amount, adminUid, max_use || null], (err2, result) => {
      if (err2) {
        console.error(err2);
        return res.status(500).json({ message: 'สร้างโค้ดไม่สำเร็จ' });
      }

      res.json({ message: 'สร้างโค้ดสำเร็จ', discountId: result.insertId });
    });
  });
});

// ✅ ดึงรายการหมวดหมู่ทั้งหมด
app.get("/api/categories", (req, res) => {
  const sql = "SELECT cid, name FROM categories ORDER BY name ASC";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json(results);
  });
});


app.get('/api/top-games', (req, res) => {
  const sql = `
    SELECT gid, name, count_sold, price, image
    FROM game
    ORDER BY count_sold DESC
    LIMIT 5
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
    res.json(results);
  });
});

// ดึงโค้ดส่วนลดทั้งหมด
app.get('/discounts', (req, res) => {
  db.query('SELECT * FROM discounts ORDER BY created_at DESC', (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
});

app.delete('/discounts/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  console.log('Deleting discount id =', id);

  const sql = 'DELETE FROM discounts WHERE id = ?';
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error('SQL ERROR:', err);
      return res.status(500).json({ error: err.message });
    }
    if (result.affectedRows === 0) return res.status(404).json({ message: 'ไม่พบโค้ดส่วนลด' });
    res.json({ message: 'ลบโค้ดส่วนลดเรียบร้อยแล้ว' });
  });
});

// PUT /discounts/:id
app.put('/discounts/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { code, amount, max_use } = req.body;

  if (!code || amount == null || max_use == null) {
    return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
  }

  const sql = `
    UPDATE discounts
    SET code = ?, amount = ?, max_use = ?
    WHERE id = ?
  `;

  db.query(sql, [code, amount, max_use, id], (err, result) => {
    if (err) {
      console.error('SQL ERROR:', err);
      return res.status(500).json({ error: err.message });
    }
    if (result.affectedRows === 0)
      return res.status(404).json({ message: 'ไม่พบโค้ดส่วนลด' });

    res.json({ message: 'แก้ไขโค้ดส่วนลดเรียบร้อยแล้ว' });
  });
});

// GET /discounts/:id
app.get('/discounts/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const sql = 'SELECT * FROM discounts WHERE id = ?'; // ใช้ table จริง

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error('SQL ERROR:', err);
      return res.status(500).json({ error: err.message });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: 'ไม่พบโค้ดส่วนลด' });
    }

    res.json(result[0]); // ส่งกลับ object ตัวเดียว
  });
});

// =================== CART APIs ===================
app.post("/api/cart/add", (req, res) => {
  const { uid, gid } = req.body;

  if (!uid || !gid) return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบ" });

  // เช็คว่าผู้ใช้เคยซื้อเกมนี้หรือไม่
  const checkBoughtSQL = "SELECT * FROM transactions WHERE uid = ? AND gid = ? AND type = 'purchase'";
  db.query(checkBoughtSQL, [uid, gid], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด", error: err.message });
    if (rows.length > 0) {
      return res.status(400).json({ success: false, message: "คุณเคยซื้อเกมนี้แล้ว ไม่สามารถเพิ่มลงตะกร้าได้" });
    }

    // ถ้ายังไม่เคยซื้อ => ทำงานเดิม (เช็คตะกร้าแล้ว insert/update)
    const checkCartSQL = "SELECT * FROM carts WHERE uid = ? AND gid = ?";
    db.query(checkCartSQL, [uid, gid], (err2, cartRows) => {
      if (err2) return res.status(500).json({ success: false, message: err2.message });
      if (cartRows.length > 0) {
        db.query("UPDATE carts SET quantity = quantity + 1 WHERE uid = ? AND gid = ?", [uid, gid], (err3) => {
          if (err3) return res.status(500).json({ success: false, message: err3.message });
          res.json({ success: true, message: "เพิ่มจำนวนในตะกร้าแล้ว" });
        });
      } else {
        db.query("INSERT INTO carts (uid, gid, quantity) VALUES (?, ?, 1)", [uid, gid], (err4) => {
          if (err4) return res.status(500).json({ success: false, message: err4.message });
          res.json({ success: true, message: "เพิ่มเกมลงตะกร้าแล้ว" });
        });
      }
    });
  });
});


// ✅ 2. ดึงรายการในตะกร้า
app.get("/api/cart/:uid", (req, res) => {
  const { uid } = req.params;

  console.log("📦 กำลังโหลดตะกร้าของ uid:", uid);

  const sql = `
    SELECT 
      c.id,
      g.gid,
      g.name,
      g.price,
      g.image,
      c.quantity
    FROM carts c
    JOIN game g ON c.gid = g.gid
    WHERE c.uid = ?
    ORDER BY c.created_at DESC
  `;

  db.query(sql, [uid], (err, rows) => {
    if (err) {
      console.error("❌ Error loading cart:", err);
      return res.status(500).json({
        success: false,
        message: "เกิดข้อผิดพลาดในการโหลดตะกร้า",
        error: err.message,
      });
    }

    console.log("✅ โหลดตะกร้าสำเร็จ:", rows.length, "รายการ");
    res.json(rows);
  });
});

// ✅ 3. ลบสินค้าออกจากตะกร้า
app.delete("/api/cart/remove/:id", (req, res) => {
  const { id } = req.params;

  console.log("🗑️ กำลังลบสินค้าจากตะกร้า id:", id);

  db.query("DELETE FROM carts WHERE id = ?", [id], (err, result) => {
    if (err) {
      console.error("❌ Error removing item:", err);
      return res.status(500).json({
        success: false,
        message: "เกิดข้อผิดพลาดในเซิร์ฟเวอร์",
        error: err.message,
      });
    }

    if (result.affectedRows === 0) {
      console.log("⚠️ ไม่พบสินค้าในตะกร้า id:", id);
      return res.status(404).json({
        success: false,
        message: "ไม่พบสินค้าในตะกร้า",
      });
    }

    console.log("✅ ลบสินค้าสำเร็จ id:", id);
    res.json({ success: true, message: "ลบสินค้าออกจากตะกร้าแล้ว" });
  });
});

// POST /api/buy
app.post("/api/buy", (req, res) => {
  const { uid, gids, discountCode } = req.body;

  if (!uid || !gids || !Array.isArray(gids) || gids.length === 0) {
    return res.status(400).json({ message: "ข้อมูลไม่ครบ uid หรือ gids" });
  }

  db.beginTransaction(err => {
    if (err) return res.status(500).json({ message: "Transaction error", error: err.message });

    const placeholders = gids.map(() => '?').join(',');
    const getGamesSQL = `SELECT * FROM game WHERE gid IN (${placeholders})`;

    db.query(getGamesSQL, gids, (err1, gamesResults) => {
      if (err1 || gamesResults.length === 0) {
        return db.rollback(() => res.status(404).json({ message: "ไม่พบเกมที่เลือก", error: err1?.message }));
      }

      let totalPrice = gamesResults.reduce((sum, g) => sum + parseFloat(g.price), 0);
      let discountAmount = 0;

      const processPurchase = () => {
        const lockUserSQL = "SELECT wallets_balance FROM users WHERE uid = ? FOR UPDATE";
        db.query(lockUserSQL, [uid], (err2, userResults) => {
          if (err2 || userResults.length === 0)
            return db.rollback(() => res.status(404).json({ message: "ไม่พบผู้ใช้", error: err2?.message }));

          const userBalance = parseFloat(userResults[0].wallets_balance) || 0;
          if (userBalance < totalPrice)
            return db.rollback(() => res.status(400).json({ message: "ยอดเงินไม่เพียงพอ" }));

          const newBalance = userBalance - totalPrice;

          // อัปเดตยอดเงินผู้ใช้
          db.query("UPDATE users SET wallets_balance = ? WHERE uid = ?", [newBalance, uid], (err3) => {
            if (err3) return db.rollback(() => res.status(500).json({ message: "ไม่สามารถตัดเงินได้", error: err3.message }));

            // บันทึกธุรกรรมและเพิ่มยอดขาย
            const insertTrans = (index) => {
              if (index >= gamesResults.length) {
                // ลบเกมจาก cart หลังซื้อเสร็จ
                const deleteFromCartSQL = `DELETE FROM carts WHERE uid = ? AND gid IN (${placeholders})`;
                db.query(deleteFromCartSQL, [uid, ...gids], (errCart) => {
                  if (errCart) return db.rollback(() => res.status(500).json({ message: "ลบเกมจาก cart ไม่สำเร็จ", error: errCart.message }));

                  // commit transaction
                  return db.commit(err7 => {
                    if (err7) return db.rollback(() => res.status(500).json({ message: "Commit ล้มเหลว", error: err7.message }));

                    res.json({
                      success: true,
                      message: "ซื้อเกมสำเร็จ!",
                      totalPrice,
                      newBalance: newBalance.toFixed(2),
                      discountUsed: discountCode || null,
                      games: gamesResults.map(g => g.name),
                    });
                  });
                });
                return;
              }

              const game = gamesResults[index];
              const insertTransSQL = `
                INSERT INTO transactions
                (uid, type, amount, description, game_name, cid, gid, created_at)
                VALUES (?, 'purchase', ?, ?, ?, ?, ?, NOW())
              `;
              const transParams = [uid, parseFloat(game.price), `ซื้อเกม ${game.name}`, game.name, game.cid || null, game.gid];

              db.query(insertTransSQL, transParams, (err4) => {
                if (err4) return db.rollback(() => res.status(500).json({ message: "ไม่สามารถบันทึกธุรกรรมได้", error: err4.message }));

                // เพิ่มยอดขายเกม
                db.query("UPDATE game SET count_sold = count_sold + 1 WHERE gid = ?", [game.gid], (err5) => {
                  if (err5) return db.rollback(() => res.status(500).json({ message: "ไม่สามารถอัปเดตยอดขายได้", error: err5.message }));
                  insertTrans(index + 1);
                });
              });
            };

            insertTrans(0); // เริ่มบันทึกธุรกรรม
          });
        });
      };

      // ถ้ามีโค้ดส่วนลด
      if (discountCode) {
        const getDiscountSQL = "SELECT amount FROM discounts WHERE code = ? AND is_active = 1 AND (max_use IS NULL OR used_count < max_use)";
        db.query(getDiscountSQL, [discountCode], (errD, discountResults) => {
          if (errD) return db.rollback(() => res.status(500).json({ message: "ตรวจสอบโค้ดส่วนลดผิดพลาด", error: errD.message }));
          if (discountResults.length === 0) return db.rollback(() => res.status(400).json({ message: "โค้ดส่วนลดไม่ถูกต้อง" }));

          discountAmount = parseFloat(discountResults[0].amount) || 0;
          totalPrice = Math.max(0, totalPrice - discountAmount);

          // อัปเดต used_count ของโค้ดส่วนลด
          db.query("UPDATE discounts SET used_count = used_count + 1 WHERE code = ?", [discountCode], (err6) => {
            if (err6) return db.rollback(() => res.status(500).json({ message: "ไม่สามารถอัปเดตโค้ดส่วนลดได้", error: err6.message }));
            processPurchase();
          });
        });
      } else {
        processPurchase();
      }
    });
  });
});


app.listen(port, () => console.log(` Server running on http://localhost:${port}`));