const int relaisPin = 6;

void setup() {
  pinMode(relaisPin, OUTPUT);
  digitalWrite(relaisPin, LOW); // pompe toujours OFF
}

void loop() {
  // rien
}
