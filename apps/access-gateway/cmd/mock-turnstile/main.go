package main

import (
	"bufio"
	"fmt"
	"net"
	"strings"
	"time"
)

func main() {
	listener, err := net.Listen("tcp", "127.0.0.1:9090")
	if err != nil {
		fmt.Println("Failed to bind 9090")
		return
	}
	defer listener.Close()

	fmt.Println("Mock Turnstile TCP listening on 127.0.0.1:9090")
	for {
		conn, err := listener.Accept()
		if err != nil {
			continue
		}
		go handleConn(conn)
	}
}

func handleConn(conn net.Conn) {
	defer conn.Close()
	// Set read deadline to avoid lingering connections
	conn.SetReadDeadline(time.Now().Add(5 * time.Minute))

	scanner := bufio.NewScanner(conn)
	// Simulate handshake
	conn.Write([]byte("MOCK_TURNSTILE_READY\n"))

	for scanner.Scan() {
		text := scanner.Text()
		
		if strings.HasPrefix(text, "REQUEST_ACCESS ") {
			// Expected: REQUEST_ACCESS <credentialID>
			conn.Write([]byte("ALLOW\n")) // Simplified response
		} else if text == "PING" {
			conn.Write([]byte("PONG\n"))
		} else {
			conn.Write([]byte("UNKNOWN_COMMAND\n"))
		}
	}
}
