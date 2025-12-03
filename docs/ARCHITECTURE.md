# SDK Architecture

## Overview

The Reveal SDK is a lightweight, framework-agnostic library that detects user friction and displays nudges based on backend decisions.

## Module Structure

### Core
- **EntryPoint**: Main orchestration layer

### Modules
- **ConfigClient**: Fetches client-safe configuration
- **SessionManager**: Manages session lifecycle
- **EventPipeline**: Buffers and sends events
- **Transport**: HTTP transport layer
- **DecisionClient**: Requests nudge decisions
- **DetectorManager**: Orchestrates friction detection

### Detectors
- **StallDetector**: Detects user hesitation
- **RageClickDetector**: Detects rapid repeated clicks
- **BacktrackDetector**: Detects backward navigation

### Security
- Input validation and sanitization
- Data minimization and PII scrubbing
- Audit logging

### Utilities
- Logger, safe wrappers, UUID generation, location helpers

## Design Principles

1. Client is sensors, not brain
2. Backend is source of truth
3. Strict contracts
4. Separation of concerns
5. Safety & resilience
6. Performance

