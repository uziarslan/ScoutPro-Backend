if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
require("./models/coachModel");
require("./models/playerModel");
const express = require("express");
const app = express();
const methodOverride = require("method-override");
const mongoose = require("mongoose");
const MongoDBStore = require("connect-mongo");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const coachRoutes = require("./routes/coach");
const ExpressError = require("./utils/ExpressError");
const wrapAsync = require("./utils/wrapAsync");
const cors = require("cors");
const agenda = require("./middlewares/agenda");

const PORT = process.env.PORT || 3000;
const mongoURi =
  process.env.MONGODB_URI || "mongodb://localhost:27017/scoutpro";

const secret = "thisisnotagoodsecret";
const store = new MongoDBStore({
  mongoUrl: mongoURi,
  secret,
  touchAfter: 24 * 60 * 60,
});
const sessionConfig = {
  store,
  secret,
  name: "session",
  resave: false,
  saveUninitialized: false,
};

const corsOptions = {
  origin: process.env.DOMAIN_FRONTEND,
  credentials: true,
  methods: "GET,POST,PUT,DELETE",
  allowedHeaders: "Content-Type,Authorization",
};

// Using the app
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.static(__dirname + "/templates"));
app.use(express.static(__dirname + "/public"));
app.use("/scripts", express.static(path.join(__dirname, "node_modules")));
app.use(methodOverride("_method"));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(session(sessionConfig));

// Route hanlder
app.use("/api/v1", coachRoutes);

// Logout route for every user
app.get(
  "/logout",
  wrapAsync(async (req, res) => {
    req.logout(() => {
      res.redirect("/");
    });
  })
);

// initializing Mongoose
mongoose
  .connect(mongoURi, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("Mongoose is connected");
  })
  .catch((e) => {
    console.log(e);
  });

//Ssetting up Agenda
agenda.on("ready", async () => {
  console.log("Agenda Started!");
  await agenda.start();
});

agenda.on("fail", (err, job) => {
  console.error(`Job failed with error: ${err.message}`, job);
});

// handling the error message
app.all("*", (req, res, next) => {
  next(new ExpressError("Page not found", 404));
});
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  const { status = 500 } = err;
  if (!err.message) err.message = "Oh No, Something Went Wrong!";
  res.status(status).json({ error: err.message });
});

// Listen for the port Number
app.listen(PORT, () => {
  console.log(`App is listening on http://localhost:${PORT}`);
});
