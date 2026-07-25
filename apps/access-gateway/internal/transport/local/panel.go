package local

import (
	"net/http"
)

// StartPanel safely binds to loopback preventing external exposure
func StartPanel() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Prevent framing and CSRF
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Content-Type", "application/json")
		
		// Return safe payload, no secrets
		w.Write([]byte(`{"status": "online", "version": "1.0.0"}`))
	})
	
	// Bind exclusively to 127.0.0.1
	return http.ListenAndServe("127.0.0.1:8080", mux)
}
