# Wefit Edge Agent

Para rodar (Console):
```
go run cmd/edge-agent/main.go run
```

Para Build Windows:
```
$env:GOOS="windows"
$env:GOARCH="amd64"
go build -o edge-agent.exe ./cmd/edge-agent
```

Testes E2E e unitários:
```
go test -v ./...
```
