package api

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/innocentwere/rx-dc/backend/internal/adb"
	"github.com/innocentwere/rx-dc/backend/internal/model"
	"github.com/innocentwere/rx-dc/backend/internal/state"
)

type Server struct {
	adb   *adb.Client
	state *state.Store
	token string
	mux   *http.ServeMux
}

func New(client *adb.Client, store *state.Store, token string) *Server {
	s := &Server{adb: client, state: store, token: token, mux: http.NewServeMux()}
	s.routes()
	return s
}

func (s *Server) Handler() http.Handler {
	return s.securityHeaders(s.auth(s.mux))
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /api/health", s.health)
	s.mux.HandleFunc("GET /api/status", s.status)
	s.mux.HandleFunc("GET /api/dependencies", s.dependencies)
	s.mux.HandleFunc("GET /api/devices", s.devices)
	s.mux.HandleFunc("GET /api/devices/{serial}", s.deviceInfo)
	s.mux.HandleFunc("GET /api/devices/{serial}/screenshot", s.screenshot)
	s.mux.HandleFunc("GET /api/devices/{serial}/apps", s.apps)
	s.mux.HandleFunc("POST /api/apps/launch", s.launchApp)
	s.mux.HandleFunc("POST /api/session/start", s.startSession)
	s.mux.HandleFunc("POST /api/input/tap", s.tap)
	s.mux.HandleFunc("POST /api/input/swipe", s.swipe)
	s.mux.HandleFunc("POST /api/input/key", s.key)
	s.mux.HandleFunc("POST /api/input/text", s.text)
	s.mux.HandleFunc("POST /api/files/push", s.pushFiles)
	s.mux.HandleFunc("POST /api/files/pull", s.pullFile)
	s.mux.HandleFunc("POST /api/pair", s.pair)
	s.mux.HandleFunc("POST /api/connect", s.connect)
	s.mux.HandleFunc("POST /api/disconnect", s.disconnect)
	s.mux.HandleFunc("GET /api/discovery", s.discovery)
	s.mux.HandleFunc("GET /api/activity", s.activity)
	s.mux.HandleFunc("DELETE /api/activity", s.clearActivity)
}

func (s *Server) auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/health" {
			next.ServeHTTP(w, r)
			return
		}
		provided := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if s.token == "" || len(provided) != len(s.token) || subtle.ConstantTimeCompare([]byte(provided), []byte(s.token)) != 1 {
			writeError(w, http.StatusUnauthorized, errors.New("unauthorized"))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		next.ServeHTTP(w, r)
	})
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "service": "rxdc-backend", "time": time.Now().UTC()})
}

func (s *Server) status(w http.ResponseWriter, _ *http.Request) {
	devices := []model.Device{}
	adbMessage := "ready"
	if s.adb.Available() {
		if found, err := s.adb.Devices(); err == nil {
			devices = found
		} else {
			adbMessage = err.Error()
		}
	} else {
		adbMessage = "ADB not found"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"service":         "running",
		"uptimeSeconds":   int(s.state.Uptime().Seconds()),
		"adbAvailable":    s.adb.Available(),
		"scrcpyAvailable": s.adb.ScrcpyPath != "",
		"deviceCount":     len(devices),
		"message":         adbMessage,
	})
}

func (s *Server) dependencies(w http.ResponseWriter, _ *http.Request) {
	deps := []model.Dependency{
		{Name: "adb", Available: s.adb.ADBPath != "", Path: s.adb.ADBPath, Version: s.adb.Version()},
		{Name: "scrcpy", Available: s.adb.ScrcpyPath != "", Path: s.adb.ScrcpyPath, Version: s.adb.ScrcpyVersion()},
	}
	writeJSON(w, http.StatusOK, deps)
}

func (s *Server) devices(w http.ResponseWriter, _ *http.Request) {
	devices, err := s.adb.Devices()
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, devices)
}

func (s *Server) deviceInfo(w http.ResponseWriter, r *http.Request) {
	info, err := s.adb.DeviceInfo(r.PathValue("serial"))
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, info)
}

func (s *Server) screenshot(w http.ResponseWriter, r *http.Request) {
	png, err := s.adb.Screenshot(r.PathValue("serial"))
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Content-Length", strconv.Itoa(len(png)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(png)
}

func (s *Server) apps(w http.ResponseWriter, r *http.Request) {
	apps, err := s.adb.Packages(r.PathValue("serial"))
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, apps)
}

func (s *Server) launchApp(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Serial  string `json:"serial"`
		Package string `json:"package"`
	}
	if err := readJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if input.Serial == "" || input.Package == "" {
		writeError(w, http.StatusBadRequest, errors.New("serial and package are required"))
		return
	}
	if err := s.adb.LaunchPackage(input.Serial, input.Package); err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	s.state.Add("success", "Launched "+input.Package)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) startSession(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Serial string `json:"serial"`
	}
	if err := readJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if input.Serial == "" {
		writeError(w, http.StatusBadRequest, errors.New("serial is required"))
		return
	}
	if err := s.adb.StartScrcpy(input.Serial); err != nil {
		writeError(w, http.StatusPreconditionFailed, err)
		return
	}
	s.state.Add("success", "Desktop session started for "+input.Serial)
	writeJSON(w, http.StatusAccepted, map[string]any{"ok": true})
}

func (s *Server) tap(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Serial string `json:"serial"`
		X      int    `json:"x"`
		Y      int    `json:"y"`
	}
	if err := readJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if err := s.adb.Tap(input.Serial, input.X, input.Y); err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) swipe(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Serial   string `json:"serial"`
		X1       int    `json:"x1"`
		Y1       int    `json:"y1"`
		X2       int    `json:"x2"`
		Y2       int    `json:"y2"`
		Duration int    `json:"duration"`
	}
	if err := readJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if input.Duration <= 0 {
		input.Duration = 300
	}
	if err := s.adb.Swipe(input.Serial, input.X1, input.Y1, input.X2, input.Y2, input.Duration); err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) key(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Serial  string `json:"serial"`
		KeyCode string `json:"keyCode"`
	}
	if err := readJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if input.KeyCode == "" {
		writeError(w, http.StatusBadRequest, errors.New("keyCode is required"))
		return
	}
	if err := s.adb.Key(input.Serial, input.KeyCode); err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) text(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Serial string `json:"serial"`
		Text   string `json:"text"`
	}
	if err := readJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if input.Text == "" {
		writeError(w, http.StatusBadRequest, errors.New("text is required"))
		return
	}
	if err := s.adb.Text(input.Serial, input.Text); err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	s.state.Add("info", "Sent text to "+input.Serial)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) pushFiles(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Serial     string   `json:"serial"`
		LocalPaths []string `json:"localPaths"`
		RemoteDir  string   `json:"remoteDir"`
	}
	if err := readJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if input.Serial == "" || len(input.LocalPaths) == 0 {
		writeError(w, http.StatusBadRequest, errors.New("serial and localPaths are required"))
		return
	}
	for _, path := range input.LocalPaths {
		info, err := os.Stat(path)
		if err != nil || info.IsDir() {
			writeError(w, http.StatusBadRequest, fmt.Errorf("invalid local file: %s", path))
			return
		}
		if err := s.adb.Push(input.Serial, path, input.RemoteDir); err != nil {
			writeError(w, http.StatusBadGateway, err)
			return
		}
	}
	s.state.Add("success", fmt.Sprintf("Transferred %d file(s) to %s", len(input.LocalPaths), input.Serial))
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "count": len(input.LocalPaths)})
}

func (s *Server) pullFile(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Serial     string `json:"serial"`
		RemotePath string `json:"remotePath"`
		LocalDir   string `json:"localDir"`
	}
	if err := readJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if input.Serial == "" || input.RemotePath == "" || input.LocalDir == "" {
		writeError(w, http.StatusBadRequest, errors.New("serial, remotePath and localDir are required"))
		return
	}
	if info, err := os.Stat(input.LocalDir); err != nil || !info.IsDir() {
		writeError(w, http.StatusBadRequest, errors.New("localDir is not a valid directory"))
		return
	}
	if err := s.adb.Pull(input.Serial, input.RemotePath, filepath.Clean(input.LocalDir)); err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	s.state.Add("success", "Downloaded "+input.RemotePath)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) pair(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Address string `json:"address"`
		Code    string `json:"code"`
	}
	if err := readJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if input.Address == "" || input.Code == "" {
		writeError(w, http.StatusBadRequest, errors.New("address and code are required"))
		return
	}
	message, err := s.adb.Pair(input.Address, input.Code)
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	s.state.Add("success", "Paired with "+input.Address)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": message})
}

func (s *Server) connect(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Address string `json:"address"`
	}
	if err := readJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if input.Address == "" {
		writeError(w, http.StatusBadRequest, errors.New("address is required"))
		return
	}
	message, err := s.adb.Connect(input.Address)
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	s.state.Add("success", "Connected to "+input.Address)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": message})
}

func (s *Server) disconnect(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Address string `json:"address"`
	}
	if err := readJSON(r, &input); err != nil && !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	message, err := s.adb.Disconnect(input.Address)
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	s.state.Add("info", "Disconnected "+firstNonEmpty(input.Address, "wireless devices"))
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": message})
}

func (s *Server) discovery(w http.ResponseWriter, _ *http.Request) {
	services, err := s.adb.MDNSServices()
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, services)
}

func (s *Server) activity(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 20
	}
	writeJSON(w, http.StatusOK, s.state.List(limit))
}

func (s *Server) clearActivity(w http.ResponseWriter, _ *http.Request) {
	s.state.Clear()
	w.WriteHeader(http.StatusNoContent)
}

func readJSON(r *http.Request, target any) error {
	defer r.Body.Close()
	decoder := json.NewDecoder(io.LimitReader(r.Body, 2<<20))
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("encode response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]any{"error": err.Error(), "status": status})
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
