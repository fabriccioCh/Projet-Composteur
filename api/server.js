const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const port = 3000;

const server = http.createServer(app); 
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json()); 

const token = process.env.token_bd;
const org = process.env.influx_org;
const bucket = process.env.influx_bucket;
const clientDB = new InfluxDB({ url: 'http://influx_db:8086', token: token });
const writeApi = clientDB.getWriteApi(org, bucket);
const queryApi = clientDB.getQueryApi(org);

let lastData = { temperature: "--", humidite: "--", timestamp: "--" };
let currentMode = "MANUEL"; 

const mqttClient = mqtt.connect('mqtt://mqtt_broker:1883');

mqttClient.on('connect', () => {
    console.log("✅ Connecté au broker MQTT");
    mqttClient.subscribe('composteur/capteur');
});

mqttClient.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        const cleanData = {
            temperature: data.temperature || 0,
            humidite: data.humidite || 0,
            timestamp: new Date().toLocaleTimeString("fr-FR")
        };
        lastData = cleanData;
        io.emit("updateData", cleanData);

        const point = new Point('mesures')
            .floatField('temperature', cleanData.temperature)
            .floatField('humidite', cleanData.humidite);
        writeApi.writePoint(point);
        writeApi.flush();
        console.log("📥 Donnée diffusée :", cleanData);
    } catch (e) {
        console.error("❌ Erreur MQTT :", e.message);
    }
});

app.get('/api/last', (req, res) => res.json(lastData));

// --- CORRECTION ICI (Parenthèse fixée) ---
app.get('/api/mode', (req, res) => {
    res.json({ mode: currentMode });
});

app.get('/api/history', (req, res) => {
    const fluxQuery = `from(bucket: "${bucket}") |> range(start: -24h) |> filter(fn: (r) => r["_measurement"] == "mesures") |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")`;
    const results = [];
    queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) { results.push(tableMeta.toObject(row)); },
        error(err) { res.status(500).json({ error: "Erreur DB" }); },
        complete() { res.json(results); },
    });
});

app.post('/api/mode', (req, res) => {
    const newMode = req.body.mode; 
    currentMode = newMode;
    console.log(`🔄 SYNCHRO : Passage en mode ${newMode}`);
    io.emit("updateMode", { mode: newMode });
    mqttClient.publish("composteur/mode", JSON.stringify({ mode: newMode }));
    res.json({ status: "ok" });
});

app.post('/api/water', (req, res) => {
    console.log("💦 ACTION : Arrosage");
    io.emit("wateringStatus", { active: true });
    mqttClient.publish('composteur/action', 'water', { qos: 1 }, (err) => {
        if (err) return res.status(500).json({ error: "Erreur MQTT" });
        setTimeout(() => {
            io.emit("wateringStatus", { active: false });
        }, 3000);
        res.json({ message: "Arrosage lancé" });
    });
});

io.on('connection', (socket) => {
    console.log(`🔌 Client connecté : ${socket.id}`);
    socket.emit("updateMode", { mode: currentMode });
});

server.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Serveur actif sur le port ${port}`);
});
