package adb

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/innocentwere/rx-dc/backend/internal/model"
)

type Client struct {
	ADBPath    string
	ScrcpyPath string
}

func New() *Client {
	return &Client{ADBPath: findExecutable("RXDC_ADB_PATH", executableNames("adb")), ScrcpyPath: findExecutable("RXDC_SCRCPY_PATH", executableNames("scrcpy"))}
}

func executableNames(base string) []string {
	if runtime.GOOS == "windows" {
		return []string{base + ".exe", base}
	}
	return []string{base}
}

func findExecutable(envName string, names []string) string {
	if configured := strings.TrimSpace(os.Getenv(envName)); configured != "" {
		if absolute, err := filepath.Abs(configured); err == nil {
			if info, statErr := os.Stat(absolute); statErr == nil && !info.IsDir() {
				return absolute
			}
		}
	}

	candidateDirs := []string{}
	if exe, err := os.Executable(); err == nil {
		base := filepath.Dir(exe)
		candidateDirs = append(candidateDirs,
			base,
			filepath.Join(base, "tools"),
			filepath.Join(base, "platform-tools"),
			filepath.Join(base, "..", "tools"),
			filepath.Join(base, "..", "platform-tools"),
		)
	}

	if home, err := os.UserHomeDir(); err == nil {
		candidateDirs = append(candidateDirs,
			filepath.Join(home, "Android", "Sdk", "platform-tools"),
			filepath.Join(home, "AppData", "Local", "Android", "Sdk", "platform-tools"),
			filepath.Join(home, "Library", "Android", "sdk", "platform-tools"),
		)
	}

	for _, dir := range candidateDirs {
		for _, name := range names {
			path := filepath.Clean(filepath.Join(dir, name))
			if info, err := os.Stat(path); err == nil && !info.IsDir() {
				return path
			}
		}
	}

	for _, name := range names {
		if path, err := exec.LookPath(name); err == nil {
			return path
		}
	}
	return ""
}

func (c *Client) Available() bool { return c.ADBPath != "" }

func (c *Client) run(ctx context.Context, args ...string) ([]byte, error) {
	if c.ADBPath == "" {
		return nil, errors.New("ADB is not installed or could not be found")
	}
	cmd := exec.CommandContext(ctx, c.ADBPath, args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		message := strings.TrimSpace(stderr.String())
		if message == "" {
			message = err.Error()
		}
		return nil, fmt.Errorf("adb %s: %s", strings.Join(args, " "), message)
	}
	return out, nil
}

func (c *Client) Run(timeout time.Duration, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	return c.run(ctx, args...)
}

func (c *Client) Version() string {
	out, err := c.Run(4*time.Second, "version")
	if err != nil {
		return ""
	}
	line, _, _ := strings.Cut(strings.TrimSpace(string(out)), "\n")
	return strings.TrimSpace(line)
}

func (c *Client) ScrcpyVersion() string {
	if c.ScrcpyPath == "" {
		return ""
	}
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, c.ScrcpyPath, "--version").CombinedOutput()
	if err != nil {
		return ""
	}
	line, _, _ := strings.Cut(strings.TrimSpace(string(out)), "\n")
	return line
}

func ParseDevices(raw string) []model.Device {
	devices := make([]model.Device, 0)
	scanner := bufio.NewScanner(strings.NewReader(raw))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "List of devices") || strings.HasPrefix(line, "*") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		d := model.Device{Serial: fields[0], State: fields[1], Connection: "usb"}
		if strings.Contains(d.Serial, ":") {
			d.Connection = "wireless"
		}
		for _, field := range fields[2:] {
			key, value, ok := strings.Cut(field, ":")
			if !ok {
				continue
			}
			switch key {
			case "product":
				d.Product = value
			case "model":
				d.Model = strings.ReplaceAll(value, "_", " ")
			case "device":
				d.Device = value
			case "transport_id":
				d.TransportID = value
			}
		}
		devices = append(devices, d)
	}
	sort.Slice(devices, func(i, j int) bool { return devices[i].Serial < devices[j].Serial })
	return devices
}

func (c *Client) Devices() ([]model.Device, error) {
	out, err := c.Run(8*time.Second, "devices", "-l")
	if err != nil {
		return nil, err
	}
	return ParseDevices(string(out)), nil
}

func (c *Client) DeviceInfo(serial string) (model.DeviceInfo, error) {
	devices, err := c.Devices()
	if err != nil {
		return model.DeviceInfo{}, err
	}
	var base model.Device
	for _, d := range devices {
		if d.Serial == serial {
			base = d
			break
		}
	}
	if base.Serial == "" {
		return model.DeviceInfo{}, fmt.Errorf("device %q not found", serial)
	}

	propOut, err := c.Run(10*time.Second, "-s", serial, "shell", "getprop")
	if err != nil {
		return model.DeviceInfo{}, err
	}
	props := parseGetProp(string(propOut))
	base.Manufacturer = props["ro.product.manufacturer"]
	if base.Model == "" {
		base.Model = props["ro.product.model"]
	}

	batteryOut, _ := c.Run(8*time.Second, "-s", serial, "shell", "dumpsys", "battery")
	level, charging := parseBattery(string(batteryOut))
	storageOut, _ := c.Run(8*time.Second, "-s", serial, "shell", "df", "-h", "/data")
	total, used, free := parseStorage(string(storageOut))
	resolutionOut, _ := c.Run(8*time.Second, "-s", serial, "shell", "wm", "size")

	return model.DeviceInfo{
		Device:         base,
		AndroidVersion: props["ro.build.version.release"],
		SDK:            props["ro.build.version.sdk"],
		MIUIVersion:    firstNonEmpty(props["ro.miui.ui.version.name"], props["ro.miui.ui.version.code"]),
		HyperOSVersion: firstNonEmpty(props["ro.mi.os.version.name"], props["ro.mi.os.version.incremental"]),
		BatteryLevel:   level,
		Charging:       charging,
		StorageTotal:   total,
		StorageUsed:    used,
		StorageFree:    free,
		Resolution:     parseResolution(string(resolutionOut)),
	}, nil
}

func parseGetProp(raw string) map[string]string {
	props := map[string]string{}
	scanner := bufio.NewScanner(strings.NewReader(raw))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "[") {
			continue
		}
		parts := strings.SplitN(line, "]: [", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimPrefix(parts[0], "[")
		value := strings.TrimSuffix(parts[1], "]")
		props[key] = value
	}
	return props
}

func parseBattery(raw string) (int, bool) {
	level := 0
	status := 0
	scanner := bufio.NewScanner(strings.NewReader(raw))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		n, _ := strconv.Atoi(strings.TrimSpace(value))
		switch strings.TrimSpace(key) {
		case "level":
			level = n
		case "status":
			status = n
		}
	}
	return level, status == 2 || status == 5
}

func parseStorage(raw string) (string, string, string) {
	lines := strings.Split(strings.TrimSpace(raw), "\n")
	if len(lines) < 2 {
		return "", "", ""
	}
	fields := strings.Fields(lines[len(lines)-1])
	if len(fields) < 4 {
		return "", "", ""
	}
	return fields[1], fields[2], fields[3]
}

func parseResolution(raw string) string {
	for _, line := range strings.Split(raw, "\n") {
		if strings.Contains(line, ":") {
			_, value, _ := strings.Cut(line, ":")
			value = strings.TrimSpace(value)
			if strings.Contains(value, "x") {
				return value
			}
		}
	}
	return ""
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func (c *Client) Screenshot(serial string) ([]byte, error) {
	return c.Run(15*time.Second, "-s", serial, "exec-out", "screencap", "-p")
}

func (c *Client) Tap(serial string, x, y int) error {
	_, err := c.Run(8*time.Second, "-s", serial, "shell", "input", "tap", strconv.Itoa(x), strconv.Itoa(y))
	return err
}

func (c *Client) Swipe(serial string, x1, y1, x2, y2, duration int) error {
	_, err := c.Run(8*time.Second, "-s", serial, "shell", "input", "swipe", strconv.Itoa(x1), strconv.Itoa(y1), strconv.Itoa(x2), strconv.Itoa(y2), strconv.Itoa(duration))
	return err
}

func (c *Client) Key(serial, keyCode string) error {
	_, err := c.Run(8*time.Second, "-s", serial, "shell", "input", "keyevent", keyCode)
	return err
}

func (c *Client) Text(serial, text string) error {
	encoded := strings.NewReplacer("%", "%25", " ", "%s", "&", "\\&", "<", "\\<", ">", "\\>", "(", "\\(", ")", "\\)", ";", "\\;").Replace(text)
	_, err := c.Run(10*time.Second, "-s", serial, "shell", "input", "text", encoded)
	return err
}

func (c *Client) Push(serial, localPath, remoteDir string) error {
	if strings.TrimSpace(remoteDir) == "" {
		remoteDir = "/sdcard/Download/"
	}
	_, err := c.Run(10*time.Minute, "-s", serial, "push", localPath, remoteDir)
	return err
}

func (c *Client) Pull(serial, remotePath, localDir string) error {
	_, err := c.Run(10*time.Minute, "-s", serial, "pull", remotePath, localDir)
	return err
}

func (c *Client) Pair(address, code string) (string, error) {
	out, err := c.Run(30*time.Second, "pair", address, code)
	return strings.TrimSpace(string(out)), err
}

func (c *Client) Connect(address string) (string, error) {
	out, err := c.Run(20*time.Second, "connect", address)
	return strings.TrimSpace(string(out)), err
}

func (c *Client) Disconnect(address string) (string, error) {
	args := []string{"disconnect"}
	if strings.TrimSpace(address) != "" {
		args = append(args, address)
	}
	out, err := c.Run(20*time.Second, args...)
	return strings.TrimSpace(string(out)), err
}

func (c *Client) Packages(serial string) ([]model.AppPackage, error) {
	out, err := c.Run(20*time.Second, "-s", serial, "shell", "pm", "list", "packages", "-3")
	if err != nil {
		return nil, err
	}
	apps := make([]model.AppPackage, 0)
	for _, line := range strings.Split(string(out), "\n") {
		pkg := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), "package:"))
		if pkg == "" {
			continue
		}
		label := pkg
		if idx := strings.LastIndex(pkg, "."); idx >= 0 && idx < len(pkg)-1 {
			label = strings.Title(strings.ReplaceAll(pkg[idx+1:], "_", " ")) //nolint:staticcheck
		}
		apps = append(apps, model.AppPackage{Package: pkg, Label: label})
	}
	sort.Slice(apps, func(i, j int) bool { return apps[i].Label < apps[j].Label })
	return apps, nil
}

func (c *Client) LaunchPackage(serial, packageName string) error {
	_, err := c.Run(20*time.Second, "-s", serial, "shell", "monkey", "-p", packageName, "-c", "android.intent.category.LAUNCHER", "1")
	return err
}

func (c *Client) StartScrcpy(serial string) error {
	if c.ScrcpyPath == "" {
		return errors.New("scrcpy is not installed or could not be found")
	}
	args := []string{"-s", serial, "--window-title", "R|X DC Desktop Session", "--stay-awake"}
	cmd := exec.Command(c.ScrcpyPath, args...)
	cmd.Stdout = nil
	cmd.Stderr = nil
	if runtime.GOOS == "windows" {
		cmd.SysProcAttr = windowsDetachedProcessAttributes()
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	return cmd.Process.Release()
}

func (c *Client) MDNSServices() ([]model.MDNSService, error) {
	out, err := c.Run(10*time.Second, "mdns", "services")
	if err != nil {
		return nil, err
	}
	services := make([]model.MDNSService, 0)
	for _, line := range strings.Split(string(out), "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 3 || strings.HasPrefix(line, "List of discovered") {
			continue
		}
		services = append(services, model.MDNSService{Name: fields[0], Type: fields[1], Address: fields[len(fields)-1]})
	}
	return services, nil
}
