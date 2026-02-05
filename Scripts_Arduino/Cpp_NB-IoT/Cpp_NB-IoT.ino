#include <MKRNB.h>
#include <ArduinoMqttClient.h>
#include <Wire.h>
#include <Adafruit_BME280.h>
#include <Arduino_JSON.h>

// --- CONFIGURATION ---
const char broker[] = "167.99.87.179"; // <- IP
int        port     = 1883;
const char topic[]  = "composteur/capteur";

// Paramètres de la SIM (souvent vide pour le NB-IoT/LTE-M)
const char pin[]      = ""; 
const char apn[]      = ""; // Laisse vide ou mets l'APN de ton opérateur si besoin

// --- OBJETS ---
NB nbAccess;
GPRS gprs;
NBClient client;
MqttClient mqttClient(client);
Adafruit_BME280 bme;

void setup() {
  Serial.begin(9600);
  while (!Serial);

  // Initialisation BME280
  if (!bme.begin(0x76)) {
    Serial.println("BME280 introuvable !");
    while (1);
  }

  // Connexion au réseau cellulaire
  Serial.println("Connexion au réseau NB-IoT...");
  while (nbAccess.begin(pin, apn) != NB_READY || gprs.attachGPRS() != GPRS_READY) {
    Serial.print(".");
    delay(1000);
  }
  Serial.println("\nConnecté au réseau !");

  // Connexion au Broker MQTT sur ta VM
  Serial.print("Connexion au broker MQTT...");
  if (!mqttClient.connect(broker, port)) {
    Serial.print("Échec MQTT code: ");
    Serial.println(mqttClient.connectError());
    while (1);
  }
  Serial.println("Connecté au Cloud !");
}

void loop() {
  mqttClient.poll();

  // On lit les valeurs
  float t = bme.readTemperature();
  float h = bme.readHumidity();
  float p = bme.readPressure() / 100.0F;

  // On crée le message JSON manuellement pour maîtriser les virgules
  // String(valeur, 2) force exactement 2 chiffres après la virgule
  String jsonPayload = "{";
  jsonPayload += "\"temperature\":" + String(t, 2) + ",";
  jsonPayload += "\"humidite\":" + String(h, 2) + ",";
  jsonPayload += "\"pression\":" + String(p, 2);
  jsonPayload += "}";

  // Publication
  Serial.print("Envoi des données : ");
  Serial.println(jsonPayload);
  
  mqttClient.beginMessage(topic);
  mqttClient.print(jsonPayload);
  mqttClient.endMessage();

  delay(5000); 
}