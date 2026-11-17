# This fork builds only from pinned source dependencies, without release downloads.
VERSION := 0.1.3-k1ng.1
GO_TOOLCHAIN := go1.27.4
GO := env GOTOOLCHAIN=$(GO_TOOLCHAIN) CGO_ENABLED=0 go
GO_LDFLAGS := -s -w -X main.version=$(VERSION)

.PHONY: help deps daemon plugin package test
help:
	@echo 'make package: build the self-contained offline installation kit'
	@echo 'make test: run plugin security tests and daemon tests'

deps:
	npm ci --ignore-scripts --no-audit --no-fund

# Hash the final signed bytes; the plugin embeds these exact digests.
daemon:
	mkdir -p build
	cd torrentd && $(GO) mod verify
	cd torrentd && GOOS=darwin GOARCH=arm64 $(GO) build -mod=readonly -trimpath -ldflags "$(GO_LDFLAGS)" -o ../build/torrentd-darwin-arm64 .
	cd torrentd && GOOS=darwin GOARCH=amd64 $(GO) build -mod=readonly -trimpath -ldflags "$(GO_LDFLAGS)" -o ../build/torrentd-darwin-x86_64 .
	codesign --force --sign - build/torrentd-darwin-arm64
	codesign --force --sign - build/torrentd-darwin-x86_64
	python3 scripts/prepare-package.py manifest

plugin: deps daemon
	npm run build

package: plugin
	python3 scripts/prepare-package.py

test:
	npm run test:plugin
	cd torrentd && $(GO) test ./...
