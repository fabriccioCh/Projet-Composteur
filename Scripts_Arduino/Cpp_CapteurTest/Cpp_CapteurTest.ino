#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>

Adafruit_BME280 bme; // objet BME280

#define SEALEVELPRESSURE_HPA (1013.25)

void setup() {
  Serial.begin(9600);
  while (!Serial); // attendre le moniteur série (important pour MKR)

  Serial.println("Initialisation du BME280...");

  if (!bme.begin(0x76)) {  // adresse I2C la plus courante (0x76 ou 0x77)
    Serial.println("Capteur BME280 non detecte !");
    while (1);
  }

  Serial.println("BME280 detecte avec succes !");
}

void loop() {
  Serial.print("Temperature: ");
  Serial.print(bme.readTemperature());
  Serial.println(" °C");

  Serial.print("Humidite: ");
  Serial.print(bme.readHumidity());
  Serial.println(" %");

  Serial.print("Pression: ");
  Serial.print(bme.readPressure() / 100.0F);
  Serial.println(" hPa");
  Serial.println("---------------------------");

  delay(5000); // mesure toutes les 2 secondes
}
