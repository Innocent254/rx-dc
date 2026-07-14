package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/innocentwere/rx-dc/backend/internal/adb"
	"github.com/innocentwere/rx-dc/backend/internal/api"
	"github.com/innocentwere/rx-dc/backend/internal/state"
)

var version = "dev"

func main() {
	port := getenv("RXDC_PORT", "21743")
	token := getenv("RXDC_AUTH_TOKEN", "rxdc-local-development-token")

	client := adb.New()
	store := state.New()
	store.Add("success", "Local backend started")
	server := api.New(client, store, token)

	httpServer := &http.Server{
		Addr:              "127.0.0.1:" + port,
		Handler:           server.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      11 * time.Minute,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Printf("R|X DC backend %s listening on http://%s", version, httpServer.Addr)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("backend server failed: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(ctx); err != nil {
		fmt.Fprintf(os.Stderr, "backend shutdown: %v\n", err)
	}
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
