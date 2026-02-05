const express = require('express');
const mqtt = require('mqtt');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

const app = express();
const port = 3000;

// --- CONFIGURATION INFLUXDB ---
const token = '3yOnuNRs6GGE7Bi_yv9W6_1RnLuYMZBdS1nj6zUXK2ZqUUyiqBZAfQqfoHcv5PTliW2Cy-w1aDBSAZJHyqusOQ==';
const org = 'lycee';
const bucket = 'composteur_data';
const clientDB = new InfluxDB({ url: 'http://influx_db:8086', token: token });
const writeApi = clientDB.getWriteApi(org, bucket);

let lastData = { temperature: "...", humidite: "..." };

// --- CONNEXION MQTT ---
const mqttClient = mqtt.connect('mqtt://mqtt_broker:1883');

mqttClient.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        lastData = data;

        // --- ENREGISTREMENT DANS LA BASE ---
        const point = new Point('mesures')
            .floatField('temp', data.temperature)
            .floatField('hum', data.humidite);
        
        writeApi.writePoint(point);
        console.log("Enregistré dans InfluxDB : ", data);
    } catch (e) {
        console.error("Erreur de format");
    }
});

mqttClient.subscribe('composteur/capteur');

app.get('/api/last', (req, res) => res.json(lastData));

app.listen(port, () => console.log("API & DB Link Active"));
