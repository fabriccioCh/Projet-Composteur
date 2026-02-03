const express = require('express');
const mqtt = require('mqtt');
const app = express();
const port = 3000;

// Variable temporaire pour stocker la dernière donnée
let lastData = {
    temperature: "En attente...",
    humidite: "En attente...",
    pression: "En attente...",
    timestamp: null
};

// Connexion au Broker MQTT (interne à Docker)
const client = mqtt.connect('mqtt://mqtt_broker:1883');

client.on('connect', () => {
    console.log("Connecté au Broker MQTT");
    client.subscribe('composteur/capteur');
});

client.on('message', (topic, message) => {
    try {
        lastData = JSON.parse(message.toString());
        lastData.timestamp = new Date().toISOString();
        console.log("Donnée mise à jour :", lastData);
    } catch (e) {
        console.log("Erreur format JSON");
    }
});

// Route pour ton équipe (Front-end)
app.get('/api/last', (req, res) => {
    res.json(lastData);
});

app.listen(port, () => {
    console.log(`API prête sur http://localhost:${port}`);
});