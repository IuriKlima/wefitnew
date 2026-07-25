package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: edge-agent <run|install|start|stop|uninstall|version>")
		return
	}
	cmd := os.Args[1]

	switch cmd {
	case "run":
		runConsole()
	case "install", "start", "stop", "uninstall":
		fmt.Println("Windows Service command received:", cmd)
		// golang.org/x/sys/windows/svc would wrap this in real execution
	case "version":
		fmt.Println("Wefit Edge Agent v1.0.0")
	default:
		fmt.Println("Unknown command")
	}
}

func runConsole() {
	fmt.Println("Starting Wefit Edge Agent in console mode...")
	
	// Graceful shutdown context
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	
	go func() {
		<-sig
		fmt.Println("Shutdown signal received...")
		cancel()
	}()
	
	// Start core processes and HTTP panel
	// For simulation, block until ctx is done
	<-ctx.Done()
	
	// Give time for graceful stop
	time.Sleep(1 * time.Second)
	fmt.Println("Shutdown complete.")
}
