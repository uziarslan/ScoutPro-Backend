const mongoose = require("mongoose");
const Coach = mongoose.model("Coach");
const Player = mongoose.model("Player");
// const puppeteer = require("puppeteer");
const fsp = require("fs").promises;
const fs = require("fs");
const agenda = require("../middlewares/agenda");
const { uploader } = require("cloudinary").v2;
const path = require("path");
const csv = require("csv-parser");
const chromeLambda = require("chrome-aws-lambda");
const puppeteer = require("puppeteer-core");

const executablePath = path.join(
  __dirname,
  "node_modules",
  "puppeteer",
  "lib",
  "system",
  "chrome",
  "chrome"
);

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

async function deleteFileFromCloudinary(publicId, resourceType = "video") {
  try {
    const result = await uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    if (result.result !== "ok") {
      throw new Error(
        `Failed to delete file from Cloudinary: ${result.result}`
      );
    }
  } catch (error) {
    console.error("Error deleting file from Cloudinary:", error);
  }
}

const singleRegister = async (req, res) => {
  const { id } = req.user;
  const coach = await Coach.findById(id);

  if (!coach) return res.status(404).json({ error: "Please register first" });

  const images = req.files.map((file, i) => ({
    filename: file.filename,
    path: file.path,
    fileType: i === 0 ? "mugshot" : "standingshot",
  }));

  const player = new Player({
    images,
    videos: req.body.videos,
    ...req.body,
  });

  await agenda.schedule("in 10 seconds", "generate player image", { player });

  coach.players.push(player._id);

  await player.save();
  await coach.save();

  res.status(201).json({ success: "Player added to list." });
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

  await Player.findByIdAndUpdate(id, { ...req.body });

  if (req.files && req.files.length) {
    await Promise.all(
      req.files.map(async (file) => {
        const index = parseInt(file.fieldname.match(/\[(\d+)\]/)[1]);
        let publicId = player.images[index]?.filename;

        await deleteFileFromCloudinary(publicId, "image");

        player.images[index] = {
          filename: file.filename,
          path: file.path,
          fileType: index === 0 ? "mugshot" : "standingshot",
        };
      })
    );

    await player.save();
  }

  await agenda.schedule("in 10 seconds", "generate player image", { player });

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
          description: checkField(row["Description"]),
        });

        coach.players.push(player._id);
        await player.save();
      }

      await coach.save();
      await fsp.unlink(req.file.path);
      res.status(200).json({ success: "Players registered successfully!" });
    });
};

// const generatePdf = async (req, res) => {
//   const { id } = req.params;
//   const player = await Player.findById(id);

//   if (!player) {
//     return res.status(404).json({ error: "Unable to find player." });
//   }

//   let htmlTemplate = await fsp.readFile("templates/pdf.html", "utf8");

//   htmlTemplate = htmlTemplate
//     .replace("{{playerName}}", player.playerName)
//     .replace("{{weight}}", player.weight || "N/A")
//     .replace("{{heightWithShoes}}", player.heightWithShoes || "N/A")
//     .replace("{{bodyFat}}", player.bodyFat || "N/A")
//     .replace("{{wingSpan}}", player.wingSpan || "N/A")
//     .replace("{{standingReach}}", player.standingReach || "N/A")
//     .replace("{{handWidth}}", player.handWidth || "N/A")
//     .replace("{{handLength}}", player.handLength || "N/A")
//     .replace("{{standingVert}}", player.standingVert || "N/A")
//     .replace("{{maxVert}}", player.maxVert || "N/A")
//     .replace("{{laneAgility}}", player.laneAgility || "N/A")
//     .replace("{{shuttle}}", player.shuttle || "N/A")
//     .replace("{{courtSprint}}", player.courtSprint || "N/A")
//     .replace("{{maxSpeed}}", player.maxSpeed || "N/A")
//     .replace("{{maxJump}}", player.maxJump || "N/A")
//     .replace("{{prpp}}", player.prpp || "N/A")
//     .replace("{{acceleration}}", player.acceleration || "N/A")
//     .replace("{{deceleration}}", player.deceleration || "N/A")
//     .replace("{{ttto}}", player.ttto || "N/A")
//     .replace("{{breakingPhase}}", player.brakingPhase || "N/A")
//     .replace(
//       "{{description}}",
//       player.description === "N/A"
//         ? "No description available."
//         : player.description
//     )
//     .replace(
//       "{{mugShot}}",
//       player.images[0]?.path ||
//         "https://res.cloudinary.com/uzairarslan/image/upload/v1730518031/ScoutPro/Players/ehqjrudw4jw61lzju8pt.png"
//     )
//     .replace(
//       "{{standingShot}}",
//       player.images[1]?.path ||
//         "https://res.cloudinary.com/uzairarslan/image/upload/v1731158399/ScoutPro/Group_48_c0akgu.png"
//     );

//   try {
//     const browser = await puppeteer.launch({
//       executablePath: "/opt/render/.cache/puppeteer",
//       args: ["--no-sandbox", "--disable-setuid-sandbox"],
//     });
//     const page = await browser.newPage();
//     await page.setContent(htmlTemplate, { waitUntil: "load" });

//     const filePath = path.join(__dirname, `ScoutPro-${player.playerName}.pdf`);

//     await page.pdf({
//       path: filePath,
//       width: "640px",
//       height: "852px",
//       printBackground: true,
//     });

//     await browser.close();

//     const fileBuffer = await fsp.readFile(filePath);

//     res.set({
//       "Content-Type": "application/pdf",
//       "Content-Disposition": `attachment; filename=ScoutPro-${player.playerName}.pdf`,
//       "Content-Length": fileBuffer.length,
//     });
//     res.status(200).send(fileBuffer);

//     await fsp.unlink(filePath);
//   } catch (error) {
//     console.error("Error generating PDF:", error.message || error);
//     res.status(500).send("Error generating PDF");
//   }
// };

const generatePdf = async (req, res) => {
  const { id } = req.params;
  const player = await Player.findById(id);

  if (!player) {
    return res.status(404).json({ error: "Unable to find player." });
  }

  let htmlTemplate = await fsp.readFile("templates/pdf.html", "utf8");
  // Your HTML template replacements go here
  // ...

  try {
    const browser = await puppeteer.launch({
      executablePath:
        "/opt/render/project/src/node_modules/puppeteer-core/.local-chromium/linux-901912/chrome-linux/chrome",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
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
