import express from "express";
import { addTicker, deleteTicker, scanWatchlist, getWatchlist, getHistory, getIHSG, getMarketScreener, getModelReports, getActivityLogs, updateWatchlist } from "../controllers/watchlistController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Semua rute ini wajib login (butuh token)
router.post("/add", authenticateToken, addTicker);
router.delete("/delete/:ticker", authenticateToken, deleteTicker);
router.get("/scan", authenticateToken, scanWatchlist);
router.get("/my-list", authenticateToken, getWatchlist); 
router.get("/history", authenticateToken, getHistory);
router.get("/ihsg", authenticateToken, getIHSG);
router.get("/screener", authenticateToken, getMarketScreener);
router.get("/reports", authenticateToken, getModelReports);
router.get("/logs", authenticateToken, getActivityLogs);
router.put("/update/:ticker", authenticateToken, updateWatchlist);

export default router;