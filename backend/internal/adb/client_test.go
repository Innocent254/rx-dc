package adb

import (
	"testing"

	"github.com/innocentwere/rx-dc/backend/internal/model"
)

func TestParseDevices(t *testing.T) {
	raw := `List of devices attached
ABC123 device product:duchamp model:Redmi_Note_13 device:duchamp transport_id:1
192.168.1.20:5555 device product:nuwa model:2210132C device:nuwa transport_id:2
`
	devices := ParseDevices(raw)
	if len(devices) != 2 {
		t.Fatalf("expected 2 devices, got %d", len(devices))
	}
	bySerial := map[string]model.Device{}
	for _, device := range devices {
		bySerial[device.Serial] = device
	}
	if bySerial["ABC123"].Model != "Redmi Note 13" {
		t.Fatalf("unexpected model: %q", bySerial["ABC123"].Model)
	}
	if bySerial["192.168.1.20:5555"].Connection != "wireless" {
		t.Fatalf("expected wireless connection, got %q", bySerial["192.168.1.20:5555"].Connection)
	}
}

func TestParseBattery(t *testing.T) {
	level, charging := parseBattery("level: 87\nstatus: 2\n")
	if level != 87 || !charging {
		t.Fatalf("unexpected battery result: %d %v", level, charging)
	}
}
