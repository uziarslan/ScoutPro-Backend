const fs = require("fs").promises;

module.exports = async (player) => {
  let htmlTemplate = await fs.readFile("templates/pdf.html", "utf8");

  htmlTemplate = htmlTemplate
    .replace("{{playerName}}", player.playerName)
    .replace("{{weight}}", player.weight || "N/A")
    .replace("{{heightWithShoes}}", player.heightWithShoes || "N/A")
    .replace("{{bodyFat}}", player.bodyFat || "N/A")
    .replace("{{wingSpan}}", player.wingSpan || "N/A")
    .replace("{{standingReach}}", player.standingReach || "N/A")
    .replace("{{handWidth}}", player.handWidth || "N/A")
    .replace("{{handLength}}", player.handLength || "N/A")
    .replace("{{standingVert}}", player.standingVert || "N/A")
    .replace("{{maxVert}}", player.maxVert || "N/A")
    .replace("{{laneAgility}}", player.laneAgility || "N/A")
    .replace("{{shuttle}}", player.shuttle || "N/A")
    .replace("{{courtSprint}}", player.courtSprint || "N/A")
    .replace("{{maxSpeed}}", player.maxSpeed || "N/A")
    .replace("{{maxJump}}", player.maxJump || "N/A")
    .replace("{{prpp}}", player.prpp || "N/A")
    .replace("{{acceleration}}", player.acceleration || "N/A")
    .replace("{{deceleration}}", player.deceleration || "N/A")
    .replace("{{ttto}}", player.ttto || "N/A")
    .replace("{{breakingPhase}}", player.brakingPhase || "N/A")
    .replace(
      "{{description}}",
      player.description === "N/A"
        ? "No description available."
        : player.description
    )
    .replace(
      "{{mugShot}}",
      player.images[0]?.path ||
        "https://res.cloudinary.com/uzairarslan/image/upload/v1730518031/ScoutPro/Players/ehqjrudw4jw61lzju8pt.png"
    )
    .replace(
      "{{standingShot}}",
      player.images[1]?.path ||
        "https://res.cloudinary.com/uzairarslan/image/upload/v1731158399/ScoutPro/Group_48_c0akgu.png"
    );

  return htmlTemplate;
};
