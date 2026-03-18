import db from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mendaftarkan akun user baru ke database
export const register = (req, res) => {
    const { username, email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email dan password wajib diisi" });
    }

    const finalUsername = username && username.trim() !== '' ? username : email;

    const checkEmailQuery = "SELECT * FROM users WHERE email = ?";
    db.query(checkEmailQuery, [email], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error" });
        if (result.length > 0) return res.status(400).json({ message: "Email sudah terdaftar." });

        const checkUsernameQuery = "SELECT * FROM users WHERE username = ?";
        db.query(checkUsernameQuery, [finalUsername], (errCheck, resCheck) => {
            if (errCheck) return res.status(500).json({ message: "Database error" });
            
            let effectiveUsername = finalUsername;
            if (resCheck.length > 0) {
                 effectiveUsername = `${finalUsername}_${Date.now()}`.substring(0, 50);
            }

            const hashedPassword = bcrypt.hashSync(password, 10);
            const insertQuery = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
            db.query(insertQuery, [effectiveUsername, email, hashedPassword], (err2) => {
                if (err2) return res.status(500).json({ message: "Gagal mendaftar" });
                res.status(201).json({ message: "Registrasi berhasil" });
            });
        });
    });
};

// Autentikasi user dan pembuatan token JWT
export const login = (req, res) => {
    const { email, password } = req.body; 

    if (!email || !password) return res.status(400).json({ message: "Email dan password wajib diisi" });

    const query = "SELECT * FROM users WHERE email = ?";
    db.query(query, [email], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error" });
        if (result.length === 0) return res.status(401).json({ message: "Email atau password salah" });

        const user = result[0];
        const isPasswordValid = bcrypt.compareSync(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ message: "Email atau password salah" });

        const token = jwt.sign(
            { id: user.id, email: user.email, username: user.username }, 
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        res.status(200).json({
            message: "Login berhasil", token,
            user: { id: user.id, username: user.username, email: user.email },
        });
    });
};

// Mengubah username dari user yang sedang login
export const updateUsername = (req, res) => {
  const userId = req.user.id;
  const { username } = req.body;

  if (!username || username.trim() === "") return res.status(400).json({ message: "Username tidak boleh kosong" });

  const checkQuery = "SELECT * FROM users WHERE username = ? AND id != ?";
  db.query(checkQuery, [username, userId], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (result.length > 0) return res.status(400).json({ message: "Username sudah digunakan" });

    const sql = "UPDATE users SET username = ? WHERE id = ?";
    db.query(sql, [username, userId], (err2) => {
      if (err2) return res.status(500).json({ message: "Gagal mengubah username" });
      res.status(200).json({ message: "Username berhasil diperbarui" });
    });
  });
};

// Mengubah password dengan memvalidasi password lama terlebih dahulu
export const updatePassword = (req, res) => {
  const userId = req.user.id;
  const { password_lama, password_baru } = req.body;

  if (!password_lama || !password_baru) return res.status(400).json({ message: "Semua field wajib diisi" });

  const sql = "SELECT * FROM users WHERE id = ?";
  db.query(sql, [userId], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error" });

    const user = result[0];
    const isValid = bcrypt.compareSync(password_lama, user.password);
    if (!isValid) return res.status(401).json({ message: "Password lama salah" });

    const hashed = bcrypt.hashSync(password_baru, 10);
    const updateSql = "UPDATE users SET password = ? WHERE id = ?";
    db.query(updateSql, [hashed, userId], (err2) => {
      if (err2) return res.status(500).json({ message: "Gagal mengubah password" });
      res.status(200).json({ message: "Password berhasil diperbarui" });
    });
  });
};


// Update foto profil dan simpan nama filenya ke database
export const updateFotoProfile = (req, res) => {
    const userId = req.user.id;
    if (!req.file) return res.status(400).json({ message: "Tidak ada file yang diupload" });

    const filePath = req.file.filename;
    db.query("UPDATE users SET foto_profile = ? WHERE id = ?", [filePath, userId], (err) => {
        if (err) return res.status(500).json({ message: "Gagal menyimpan foto profil" });
        res.status(200).json({ message: "Foto profil berhasil diperbarui", foto_profile: filePath });
    });
};

// Menghapus file foto dari folder uploads
export const deleteFotoProfile = (req, res) => {
    const userId = req.user.id;
    db.query("SELECT foto_profile FROM users WHERE id = ?", [userId], (err, result) => {
        const currentPhoto = result[0]?.foto_profile;
        if (!currentPhoto) return res.status(400).json({ message: "Tidak ada foto untuk dihapus" });

        const fullPath = path.join(__dirname, "../uploads", currentPhoto);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

        db.query("UPDATE users SET foto_profile = NULL WHERE id = ?", [userId], (err2) => {
            if (err2) return res.status(500).json({ message: "Gagal menghapus foto" });
            res.status(200).json({ message: "Foto berhasil dihapus" });
        });
    });
};

// Ambil data profil user
export const getMe = (req, res) => {
    db.query("SELECT id, username, email, foto_profile FROM users WHERE id = ?", [req.user.id], (err, result) => {
        if (err || result.length === 0) return res.status(404).json({ message: "User tidak ditemukan" });
        res.status(200).json(result[0]);
    });
};