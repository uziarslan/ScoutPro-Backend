const mongoose = require("mongoose");
const Coach = mongoose.model("Coach");
const Player = mongoose.model("Player");
const puppeteer = require("puppeteer");
const fs = require("fs");
const fsp = require("fs").promises;
const agenda = require("../middlewares/agenda");
const path = require("path");
const csv = require("csv-parser");
const generateTemplate = require("../middlewares/template");

// Helper Functions
function sanitizeData(data) {
  return data.map((row) => {
    const sanitizedRow = { ...row };
    // List of fields to check for accidental conversions
    const fieldsToSanitize = [
      "HEIGHT",
      "WINGSPAN",
      "STANDING REACH",
      "HAND WIDTH",
      "HAND LENGTH",
      "STANDING VERT",
      "MAX VERT",
    ];

    fieldsToSanitize.forEach((field) => {
      if (sanitizedRow[field]) {
        if (typeof sanitizedRow[field] === "number") {
          sanitizedRow[field] = sanitizedRow[field].toString();
        }

        sanitizedRow[field] = sanitizedRow[field]
          .replace(/(\d)'(\d)/g, "$1' $2")
          .replace(/(\d)"(\s)/g, '$1"$2');
      }
    });

    return sanitizedRow;
  });
}

function transformYouTubeUrl(url) {
  const regex = /^https:\/\/youtu\.be\/([a-zA-Z0-9_-]+)/;
  const validRegex =
    /^https:\/\/www\.youtube\.com\/embed\/([a-zA-Z0-9_-]+)\?si=([a-zA-Z0-9_-]+)$/;

  let match = url.match(regex);

  if (!match) match = url.match(validRegex);

  if (match) {
    const videoId = match[1];

    const urlParams = new URLSearchParams(new URL(url).search);
    const siParam = urlParams.get("si") || "";

    const embedUrl = `https://www.youtube.com/embed/${videoId}?si=${siParam}`;
    return embedUrl;
  } else {
    throw new Error("Invalid YouTube URL");
  }
}

// Helper Function end

const singleRegister = async (req, res) => {
  const { id } = req.user;
  const coach = await Coach.findById(id);

  if (!coach) return res.status(404).json({ error: "Please register first" });

  const images = req.files.map((file, i) => ({
    filename: file.filename,
    path: file.path,
    fileType: i === 0 ? "mugshot" : "standingshot",
  }));

  const videos = req.body.videos.map(
    (url) => url !== "" && transformYouTubeUrl(url)
  );

  const player = new Player({
    images,
    videos: videos,
    ...req.body,
  });

  coach.players.push(player._id);

  await agenda.schedule("in 5 seconds", "generate player image", { player });
  await player.save();
  await coach.save();

  return res.status(201).json({ success: "Player added to list." });
};

const getAllPlayers = async (req, res) => {
  const { id } = req.user;
  const coach = await Coach.findById(id).populate("players");

  if (!coach) return { error: "Unauthorized user detected." };

  res.status(200).json(coach.players);
};

const getIndividualPlayer = async (req, res) => {
  const { id } = req.params;

  const player = await Player.findById(id);

  if (!player) return res.status(404).json({ error: "Unable to find player" });

  res.status(200).json(player);
};

const updatePlayerInfo = async (req, res) => {
  const { id } = req.params;
  const player = await Player.findById(id);

  if (!player) return res.status(404).json({ error: "Unable to find user" });

  const videos = req.body.videos.map(
    (url) => url !== "" && transformYouTubeUrl(url)
  );

  await Player.findByIdAndUpdate(id, { ...req.body, videos });

  if (req.files && req.files.length) {
    await Promise.all(
      req.files.map(async (file) => {
        const index = parseInt(file.fieldname.match(/\[(\d+)\]/)[1]);
        let publicId = player.images[index]?.filename;

        publicId &&
          (await agenda.schedule("in 5 seconds", "deleteFileFromCloudinary", {
            publicId,
          }));

        player.images[index] = {
          filename: file.filename,
          path: file.path,
          fileType: index === 0 ? "mugshot" : "standingshot",
        };
      })
    );
  }

  await player.save();
  await agenda.schedule("in 5 seconds", "generate player image", { player });

  res.status(200).json({ success: "Player Information Updated" });
};

const handleExcelFile = async (req, res) => {
  const { id } = req.user;
  const coach = await Coach.findById(id);

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => {
      results.push(row);
    })
    .on("end", async () => {
      const playerData = sanitizeData(results);

      const checkField = (value) =>
        !value || value === "" || value === "-" ? "N/A" : value.trim();

      for (const row of playerData) {
        const player = new Player({
          playerName: checkField(row["PLAYER"]),
          position: checkField(row["POS"]),
          heightWithShoes: checkField(row["HEIGHT"]),
          weight: checkField(row["WEIGHT"]),
          bodyFat: checkField(row["BODY COMP"]),
          wingSpan: checkField(row["WINGSPAN"]),
          standingReach: checkField(row["STANDING REACH"]),
          handWidth: checkField(row["HAND WIDTH"]),
          handLength: checkField(row["HAND LENGTH"]),
          standingVert: checkField(row["STANDING VERT"]),
          maxVert: checkField(row["MAX VERT"]),
          laneAgility: checkField(row["LANE AGILITY"]),
          shuttle: checkField(row["SHUTTLE"]),
          courtSprint: checkField(row["3/4 COURT SPRINT"]),
          maxSpeed: checkField(row["MAX SPEED"]),
          maxJump: checkField(row["MAX JUMP"]),
          prpp: checkField(row["PROPULSIVE POWER"]),
          acceleration: checkField(row["ACCELERATION"]),
          deceleration: checkField(row["DECELERATION"]),
          ttto: checkField(row["TAKE OFF"]),
          brakingPhase: checkField(row["BRAKING PHASE"]),
          description: checkField(row["DESCRIPTION"]),
        });

        coach.players.push(player._id);
        await player.save();
      }

      await coach.save();
      await fsp.unlink(req.file.path);
      res.status(200).json({ success: "Players registered successfully!" });
    });
};

const generatePdf = async (req, res) => {
  const { id } = req.params;
  const player = await Player.findById(id);

  if (!player) {
    return res.status(404).json({ error: "Unable to find player." });
  }

  let htmlTemplate = await generateTemplate(player);

  try {
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(htmlTemplate, { waitUntil: "load" });

    const filePath = path.join(__dirname, `ScoutPro-${player.playerName}.pdf`);

    await page.pdf({
      path: filePath,
      width: "640px",
      height: "852px",
      printBackground: true,
    });

    await browser.close();

    const fileBuffer = await fsp.readFile(filePath);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=ScoutPro-${player.playerName}.pdf`,
      "Content-Length": fileBuffer.length,
    });
    res.status(200).send(fileBuffer);

    await fsp.unlink(filePath);
  } catch (error) {
    console.error("Error generating PDF:", error.message || error);
    res.status(500).send("Error generating PDF");
  }
};

module.exports = {
  singleRegister,
  getAllPlayers,
  getIndividualPlayer,
  updatePlayerInfo,
  handleExcelFile,
  generatePdf,
};
