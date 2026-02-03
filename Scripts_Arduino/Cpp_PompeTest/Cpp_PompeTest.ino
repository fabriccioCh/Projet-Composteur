const int relaisPin = 6;

void setup() {
  pinMode(relaisPin, OUTPUT);

  // pompe OFF au démarrage
  digitalWrite(relaisPin, LOW);
}

void loop() {
  // Pompe ON
  digitalWrite(relaisPin, HIGH);
  delay(2000);

  // Pompe OFF
  digitalWrite(relaisPin, LOW);
  delay(10000);
}
