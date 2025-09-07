#!/bin/bash

# Generate Go code from protobuf files (used internally by REST server)
protoc --go_out=. --go_opt=paths=source_relative \
    --go-grpc_out=. --go-grpc_opt=paths=source_relative \
    proto/expense.proto

echo "Protobuf files generated successfully!"
