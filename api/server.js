const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(cors());

// --- CONFIGURATION INFLUXDB ---
const token = process.env.token_bd;
const org = process.env.influx_org;
const bucket = process.env.influx_bucket;

const clientDB = new InfluxDB({ url: 'http://influx_db:8086', token: token });
const writeApi = clientDB.getWriteApi(org, bucket);
// ON CRÉE LE QUERY API ICI :
const queryApi = clientDB.getQueryApi(org);

let lastData = { temperature: "...", humidite: "..." };

// --- CONNEXION MQTT ---
const mqttClient = mqtt.connect('mqtt://mqtt_broker:1883');

mqttClient.on('connect', () => {
    console.log("Connecté au broker MQTT");
    mqttClient.subscribe('composteur/capteur');
});

mqttClient.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        data.timestamp = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
        lastData = data;

        // --- ENREGISTREMENT DANS LA BASE ---
        const point = new Point('mesures')
            .floatField('temp', data.temperature)
            .floatField('hum', data.humidite)
        
        writeApi.writePoint(point);
        // On force l'écriture immédiate
        writeApi.flush();
        
        console.log("Enregistré dans InfluxDB : ", data);
    } catch (e) {
        console.error("Erreur de format JSON reçu");
    }
});

// --- ROUTES API ---

// 1. Dernier point (pour l'affichage direct)
app.get('/api/last', (req, res) => res.json(lastData));

// 2. Historique (pour les graphiques des camarades)
app.get('/api/history', (req, res) => {
    // Requête Flux modifiée pour tout récupérer
    const fluxQuery = `
        from(bucket: "${bucket}")
        |> range(start: 0) // <--- '0' signifie "depuis le début de la base"
        |> filter(fn: (r) => r["_measurement"] == "mesures")
        |> filter(fn: (r) => r["_field"] == "temp" or r["_field"] == "hum")
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    `;

    const results = [];
    queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) {
            results.push(tableMeta.toObject(row));
        },
        error(error) {
            console.error("Erreur InfluxDB Query:", error);
            res.status(500).json({ error: "Erreur lors de la lecture InfluxDB" });
        },
        complete() {
            res.json(results);
        },
    });
});
// --- DÉMARRAGE DU SERVEUR ---
app.listen(port, () => {
    console.log(`✅ Serveur API lancé sur http://localhost:${port}`);
});

