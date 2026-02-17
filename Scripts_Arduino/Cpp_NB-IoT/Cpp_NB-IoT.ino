void loop() {
  mqttClient.poll();

  // --- SIMULATION DES DONNÉES ---
  // On génère des valeurs réalistes pour un composteur
  // random(min, max) génère un entier, on divise pour avoir des décimales
  float t = random(2000, 4500) / 100.0; // Simule entre 20.00 et 45.00 °C
  float h = random(6000, 8500) / 100.0; // Simule entre 60.00 et 85.00 % d'humidité
  float p = random(101000, 101500) / 100.0; // Simule autour de 1013 hPa

  // On crée le message JSON
  String jsonPayload = "{";
  jsonPayload += "\"temperature\":" + String(t, 2) + ",";
  jsonPayload += "\"humidite\":" + String(h, 2) + ",";
  jsonPayload += "\"pression\":" + String(p, 2);
  jsonPayload += "}";

  // Publication
  Serial.print("Envoi des données SIMULÉES : ");
  Serial.println(jsonPayload);
  
  mqttClient.beginMessage(topic);
  mqttClient.print(jsonPayload);
  mqttClient.endMessage();

  delay(5000); 
}