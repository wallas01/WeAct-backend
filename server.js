require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const NodeCache = require("node-cache");
const morgan = require("morgan");
const admin = require("firebase-admin");
const mysql = require("mysql2/promise");
const serviceAccount = require("./firebase-service-account.json");
const dbConfig = require("./db-config.json");
const {
  authenticateFirebaseToken,
} = require("./utilities/authenticationUtils");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
const port = process.env.PORT || 3000;

// Crea un pool di connessioni per gestire le connessioni al database
let pool;

// Funzione per inizializzare il pool di connessioni al database MySQL
async function initializeDbPool() {
  try {
    pool = mysql.createPool(dbConfig);
    console.log("Connessione al database MySQL stabilita con successo.");
  } catch (error) {
    console.error("Errore durante la connessione al database:", error.message);
    // Potresti voler terminare il processo o ritentare la connessione
    process.exit(1);
  }
}

// Inizializza il pool di connessioni all'avvio del server
initializeDbPool();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(morgan("dev")); // Logger

// In-memory cache
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // Cache for 10 minutes

// ACLED API Base URL
const ACLED_API_BASE_URL = "https://api.acleddata.com/acled/read";
const ACLED_API_KEY = process.env.ACLED_API_KEY;
const ACLED_API_EMAIL = process.env.ACLED_API_EMAIL;

// Endpoint /conflitti API ACLED
/*app.get("/conflitti", authenticateFirebaseToken, async (req, res) => {
  if (!ACLED_API_KEY) {
    return res
      .status(500)
      .json({ error: "ACLED_API_KEY not configured in .env" });
  }

  if (!ACLED_API_EMAIL) {
    return res
      .status(500)
      .json({ error: "ACLED_API_EMAIL not configured in .env" });
  }

  const queryParams = req.query;
  const cacheKey = JSON.stringify(queryParams);

  // Check cache first
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    console.log("Serving from cache:", cacheKey);
    return res.json(cachedData);
  }

  try {
    const response = await axios.get(ACLED_API_BASE_URL, {
      headers: {
        "Content-Type": "application/json",
      },
      params: {
        key: ACLED_API_KEY,
        email: ACLED_API_EMAIL,
        year: 2025,
        limit: 100, // Example limit, can be adjusted
      },
    });

    console.log("Response from ACLED API:", response.data);

    // Normalize data (example: just return the events array)
    const normalizedData = response.data.data;

    // Store in cache
    cache.set(cacheKey, normalizedData);
    console.log("Data fetched from ACLED API and cached:", cacheKey);

    res.json(normalizedData);
  } catch (error) {
    console.error("Error fetching data from ACLED API:", error.message);
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      res.status(error.response.status).json({ error: error.response.data });
    } else if (error.request) {
      // The request was made but no response was received
      res.status(500).json({ error: "No response received from ACLED API" });
    } else {
      // Something happened in setting up the request that triggered an Error
      res.status(500).json({ error: error.message });
    }
  }
}); */

// Endpoint API per recuperare i dati dalla tabella ACLED-may-jul
app.get("/conflitti", authenticateFirebaseToken, async (req, res) => {
  try {
    // Esegui la query per selezionare tutti i dati dalla tua tabella
    const [rows, fields] = await pool.execute("SELECT * FROM `ACLED-may-jul`");

    // Oggetto per memorizzare i dati raggruppati per regione
    const groupedByRegion = {};

    // Itera attraverso le righe e raggruppa per il campo 'region'
    rows.forEach((row) => {
      const regionName = row.region; // Assicurati che il nome della colonna sia 'region'
      if (regionName) {
        // Assicurati che la regione non sia null o undefined
        if (!groupedByRegion[regionName]) {
          groupedByRegion[regionName] = [];
        }
        groupedByRegion[regionName].push(row);
      }
    });

    // Invia i dati raggruppati come risposta JSON
    res.json(groupedByRegion); // Invia direttamente l'oggetto raggruppato
  } catch (error) {
    console.error(
      "Errore durante il recupero o l'elaborazione dei dati ACLED:",
      error.message
    );
    res.status(500).json({
      message: "Errore interno del server durante il recupero dei dati.",
      error: error.message,
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
