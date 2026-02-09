const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

let counter = 0;

const GREETINGS = [
  { id: 1, message: "Hello, World!" },
  { id: 2, message: "Hola, Mundo!" },
  { id: 3, message: "Bonjour, le Monde!" },
  { id: 4, message: "Hallo, Welt!" },
  { id: 5, message: "Ciao, Mondo!" },
];

app.get("/api/hello", (req, res) => {
  const name = req.query.name || "World";
  counter += 1;
  res.json({ id: counter, message: `Hello, ${name}!` });
});

app.get("/api/greetings", (_req, res) => {
  res.json(GREETINGS);
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

module.exports = app;
