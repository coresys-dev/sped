# 0001: Speed Editor HID driver

## Decision

Use the [`bmd-speededitor`](https://github.com/camikura/bmd-speededitor-rs) crate
(crates.io name `bmd-speededitor`, version `0.2.x`) as the HID transport and
protocol implementation for the Blackmagic Speed Editor, wrapped by our own
`sped-device` crate (`SpeedEditorSurface`) so the rest of the application never
depends on it directly.

## Why

- **License**: MIT (`camikura`, 2022). Fully compatible with a future
  commercial CoreSys product; no copyleft obligations.
- The device authentication handshake it implements is itself a Rust port of
  the challenge/response protocol documented in
  [`smunaut/blackmagic-misc`](https://github.com/smunaut/blackmagic-misc),
  which is **Apache-2.0** licensed. Apache-2.0 is also commercial-friendly, so
  there is no hidden copyleft dependency two levels down.
- It already implements the parts that are expensive to get right from
  scratch: the vendor/product ID (`VID=7899`, `PID=55822`), the
  challenge-response authentication required before the keyboard sends any
  reports, key-state diffing (press/release from the raw 6-key HID array),
  jog/shuttle decoding, and LED output.
- API shape (`on_key`, `on_jog`, `on_connected`, `on_disconnected`, blocking
  `run()`) maps cleanly onto our own `ControlSurface` trait.

## What we did NOT do

We did not vendor or copy its source into this repository. It is a normal
crates.io dependency (`bmd-speededitor = "0.2"` in `crates/device/Cargo.toml`).
`sped-device::control::ControlId` is our own enum, independent of
`bmd_speededitor::Key`, with an explicit mapping function
(`ControlId::from_bmd_key`) at the single boundary point
(`crates/device/src/speed_editor.rs`). This means:

- If `bmd-speededitor` ever needs to be replaced (relicensed, abandoned,
  hardware protocol changes), only `speed_editor.rs` changes -- the mapping
  engine, profiles and frontend are unaffected.
- Our public `ControlId`/`ControlEvent` types, and the JSON profile format
  built on them, are not tied to a third-party crate's naming.

## Alternatives considered

- **Reimplementing the HID protocol from scratch** against the
  `smunaut/blackmagic-misc` Apache-2.0 reference implementation. Rejected for
  the MVP: it would duplicate already-correct, permissively-licensed work for
  no license or architectural benefit, since it's cleanly wrapped either way.
  Worth revisiting only if `bmd-speededitor` stops being maintained or needs
  functionality it doesn't expose (e.g. finer-grained LED control).
- **`obws`-style hand-rolled feature reports** without a crate at all: more
  code, more risk of subtly breaking the auth handshake, no license benefit.
