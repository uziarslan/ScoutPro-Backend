const express = require("express");
const wrapAsync = require("../utils/wrapAsync");
const { protect } = require("../middlewares/authMiddleware");
const { registerCoach, handleLogin, getUser } = require("../controllers/auth");
const {
  singleRegister,
  getAllPlayers,
  getIndividualPlayer,
  updatePlayerInfo,
  handleExcelFile,
  generatePdf,
} = require("../controllers/coach");
const router = express();

const multer = require("multer");
const { storage } = require("../cloudinary");

const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const excelUpload = multer({
  storage: diskStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Coach Login
router.post("/login", wrapAsync(handleLogin));

// Coach Registration
router.post("/signup", wrapAsync(registerCoach));

// Fetching the Logged In Coach
router.get("/user", protect, wrapAsync(getUser));

// Register Single Player
router.post(
  "/player-register",
  protect,
  upload.array("images", 2),
  wrapAsync(singleRegister)
);

// Fetch all Players
router.get("/players", protect, wrapAsync(getAllPlayers));

// Fetch individual Players
router.get("/player/:id", protect, wrapAsync(getIndividualPlayer));

// Edit player info
router.put("/player/:id", protect, upload.any(), wrapAsync(updatePlayerInfo));

// Handle Excel File
router.post(
  "/multi-player",
  protect,
  excelUpload.single("file"),
  wrapAsync(handleExcelFile)
);

// Generate Dynamic PDF
router.get("/generate-pdf/:id", protect, wrapAsync(generatePdf));

module.exports = router;
