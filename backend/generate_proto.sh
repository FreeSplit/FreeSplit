#!/bin/bash

# Generate Go code from protobuf files
protoc --go_out=. --go_opt=paths=source_relative \
    --go-grpc_out=. --go-grpc_opt=paths=source_relative \
    --grpc-gateway_out=. --grpc-gateway_opt=paths=source_relative \
    --grpc-gateway_opt=generate_unbound_methods=true \
    proto/expense.proto

echo "Protobuf files generated successfully!"
