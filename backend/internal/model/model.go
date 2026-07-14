package model

import "time"

type Device struct {
	Serial       string `json:"serial"`
	State        string `json:"state"`
	Product      string `json:"product,omitempty"`
	Model        string `json:"model,omitempty"`
	Device       string `json:"device,omitempty"`
	TransportID  string `json:"transportId,omitempty"`
	Connection   string `json:"connection"`
	Manufacturer string `json:"manufacturer,omitempty"`
}

type DeviceInfo struct {
	Device
	AndroidVersion string `json:"androidVersion,omitempty"`
	SDK            string `json:"sdk,omitempty"`
	MIUIVersion    string `json:"miuiVersion,omitempty"`
	HyperOSVersion string `json:"hyperOsVersion,omitempty"`
	BatteryLevel   int    `json:"batteryLevel"`
	Charging       bool   `json:"charging"`
	StorageTotal   string `json:"storageTotal,omitempty"`
	StorageUsed    string `json:"storageUsed,omitempty"`
	StorageFree    string `json:"storageFree,omitempty"`
	Resolution     string `json:"resolution,omitempty"`
}

type Dependency struct {
	Name      string `json:"name"`
	Available bool   `json:"available"`
	Path      string `json:"path,omitempty"`
	Version   string `json:"version,omitempty"`
}

type Activity struct {
	ID        string    `json:"id"`
	Timestamp time.Time `json:"timestamp"`
	Level     string    `json:"level"`
	Message   string    `json:"message"`
}

type AppPackage struct {
	Package string `json:"package"`
	Label   string `json:"label"`
}

type MDNSService struct {
	Name    string `json:"name"`
	Address string `json:"address"`
	Type    string `json:"type"`
}
