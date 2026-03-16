const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json()); 

app.get('/', (req, res) => {
    res.json({ message: "Main Backend is running..." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server Main Backend berjalan di http://localhost:${PORT}`);
});