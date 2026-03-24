const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
require('dotenv').config();

const app = express();
const port = 3000;

// IMPORTANT : Configuration pour lire le JSON envoyé par le bouton du site
app.use(cors());
app.use(express.json()); 

// --- CONFIGURATION INFLUXDB ---
const token = process.env.token_bd;
const org = process.env.influx_org;
const bucket = process.env.influx_bucket;

const clientDB = new InfluxDB({ url: 'http://influx_db:8086', token: token });
const writeApi = clientDB.getWriteApi(org, bucket);
const queryApi = clientDB.getQueryApi(org);

let lastData = {
    temperature: "--",
    humidite: "--",
    timestamp: "--"
};

// --- CONNEXION MQTT ---
const mqttClient = mqtt.connect('mqtt://mqtt_broker:1883');

mqttClient.on('connect', () => {
    console.log("✅ Connecté au broker MQTT");
    mqttClient.subscribe('composteur/capteur');
});

mqttClient.on('message', (topic, message) => {
    try {
        const rawPayload = message.toString();
        console.log("📥 MQTT Brut reçu :", rawPayload); // <--- AJOUTE ÇA POUR VOIR
        
        const data = JSON.parse(rawPayload);
        
        // On s'assure que les noms correspondent à ce que le FRONT-END attend
        const cleanData = {
            temperature: data.temperature || 0,
            humidite: data.humidite || 0, // Vérifie si ton index.html attend "humidity" !
            timestamp: new Date().toLocaleTimeString("fr-FR")
        };
        
        lastData = cleanData;

        const point = new Point('mesures')
            .floatField('temperature', cleanData.temperature)
            .floatField('humidite', cleanData.humidite);
        
        writeApi.writePoint(point);
        writeApi.flush();
        
        console.log("💾 Données reçues et stockées :", cleanData);
    } catch (e) {
        console.error("❌ Erreur lors de la réception MQTT :", e.message);
    }
});

// --- ROUTES GET (Lecture) ---

app.get('/api/last', (req, res) => res.json(lastData));

app.get('/api/history', (req, res) => {
    const fluxQuery = `
        from(bucket: "${bucket}")
        |> range(start: -24h)
        |> filter(fn: (r) => r["_measurement"] == "mesures")
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    `;

    const results = [];
    queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) {
            results.push(tableMeta.toObject(row));
        },
        error(error) {
            console.error("Erreur InfluxDB Query:", error);
            res.status(500).json({ error: "Erreur DB" });
        },
        complete() {
            res.json(results);
        },
    });
});

// --- NOUVELLES ROUTES POST (Action) ---

// Route pour changer le mode (Auto / Manuel)
app.post('/api/mode', (req, res) => {
    console.log("📥 Mode reçu du site :", req.body);
    // On relaie l'info à l'Arduino via MQTT
    mqttClient.publish("composteur/mode", JSON.stringify(req.body));
    res.json({ status: "ok", message: "Mode mis à jour" });
});

// Route pour déclencher l'arrosage
app.post('/api/water', (req, res) => {
    // On publie "water" SANS le retenir
    mqttClient.publish('composteur/action', 'water', { qos: 1, retain: false }, (err) => {
        if (err) {
            return res.status(500).json({ error: "Erreur MQTT" });
        }
        res.json({ message: "Arrosage lancé" });
    });
});

app.listen(port, () => {
    console.log(`🚀 API complète lancée sur le port ${port}`);
});
