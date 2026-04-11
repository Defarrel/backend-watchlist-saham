import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import db from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import watchlistRoutes from "./routes/watchlistRoutes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json()); 

app.get('/', (req, res) => {
    res.json({ message: "Main Backend is running..." });
});
app.use('/uploads', express.static('uploads')); 
app.use("/api/auth", authRoutes);
app.use("/api/watchlist", watchlistRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server Main Backend berjalan di http://localhost:${PORT}`);
});