package state

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"

	"github.com/innocentwere/rx-dc/backend/internal/model"
)

type Store struct {
	mu       sync.RWMutex
	started  time.Time
	activity []model.Activity
}

func New() *Store {
	return &Store{started: time.Now(), activity: make([]model.Activity, 0, 100)}
}

func (s *Store) Uptime() time.Duration {
	return time.Since(s.started)
}

func (s *Store) Add(level, message string) model.Activity {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	a := model.Activity{ID: hex.EncodeToString(b), Timestamp: time.Now().UTC(), Level: level, Message: message}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.activity = append([]model.Activity{a}, s.activity...)
	if len(s.activity) > 100 {
		s.activity = s.activity[:100]
	}
	return a
}

func (s *Store) List(limit int) []model.Activity {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if limit <= 0 || limit > len(s.activity) {
		limit = len(s.activity)
	}
	out := make([]model.Activity, limit)
	copy(out, s.activity[:limit])
	return out
}

func (s *Store) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.activity = nil
}
