import express from "express";
import multer from "multer";
import path from "path";
import { register, login, getMe, updateUsername, updatePassword, updateFotoProfile, deleteFotoProfile } from "../controllers/authcontroller.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Konfigurasi penyimpanan file multer
const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticateToken, getMe);
router.put("/username", authenticateToken, updateUsername);
router.put("/password", authenticateToken, updatePassword);

// Route khusus foto profil
router.put("/foto", authenticateToken, upload.single("foto_profile"), updateFotoProfile);
router.delete("/foto", authenticateToken, deleteFotoProfile);

export default router;