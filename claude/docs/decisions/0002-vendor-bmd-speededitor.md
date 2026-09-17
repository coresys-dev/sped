# 0002: Vendor `bmd-speededitor` instead of depending on it

## Decision

Vendor a modified copy of `bmd-speededitor` v0.2.3 into
`crates/device/src/vendor/` instead of depending on the crates.io crate
(superseding that part of
[0001](./0001-speed-editor-driver.md)). MIT license and attribution are
preserved in the vendored files' headers.

## Why

LED output reports need to go out over the same HID handle the input-report
read loop already holds. `hidapi::HidApi::new()` (the crate both
`bmd-speededitor` and our own code used) is a process-wide singleton --
only one `HidApi`/`HidDevice` can be open at a time in the whole process
(`hidapi::HidApiLock`, an `AtomicBool`-backed global guard). The read
loop's `HidDevice` keeps that lock held for as long as it's connected,
which is effectively the app's whole lifetime. A second, independent
`LedController` that opened its own `HidApi::new()` for every LED write
(the original design, see 656ba30) therefore *always* failed with
`HidError::InitializationError` -- confirmed against real hardware, not
just a theoretical concern.

`bmd-speededitor` does expose `set_key_led`/`set_leds`/`set_all_key_leds`
publicly, and they write over its already-open `self.device`, which would
avoid the second handle entirely -- but its blocking `run()` holds `&mut
self` for the loop's entire lifetime, and `connect()`/`auth()` are
private. There is no way, through the published API, to interleave a
write between reads on the same handle.

## What changed from upstream

- `run()` now takes a `&Receiver<crate::led::LedCommand>` and drains it
  (non-blocking `try_recv`) once per loop iteration, before the blocking
  read, so LED writes share the read loop's handle.
- Its own `key_led::KeyLed` enum is dropped in favor of `crate::led::LedId`
  directly -- there's no longer an external-crate boundary to keep them
  decoupled across (bit positions already matched exactly by design, see
  `LedId`'s doc comment).
- `chrono::DateTime<Utc>` (auth timestamp) replaced with
  `std::time::Instant` -- it was only ever compared for elapsed time, never
  serialized, so `chrono` was an unused-capability dependency.
- Handlers/callbacks our own `speed_editor.rs` wrapper never registered
  (`on_keys`, `on_key_down`, `on_key_up`, `on_unknown`) are removed rather
  than carried along dead.

Everything else (HID transport, the challenge/response auth handshake,
key-state diffing, jog/shuttle decoding, VID/PID) is unchanged from
upstream.

## Consequences

- We now own this code and must port fixes/updates from upstream
  ourselves instead of bumping a version number. Given the crate is small,
  has had no releases since 0.2.3, and the part we depend on (protocol +
  auth) is stable/hardware-fixed, this is judged an acceptable tradeoff
  against having a working LED feature at all.
- `LedController` (`crates/device/src/led.rs`) is now a message sender,
  not a direct HID writer: `set`/`set_many`/`clear_all` queue a
  `LedCommand` and return `DeviceError::NotConnected` if nothing has
  called `LedController::attach` yet (real surface not started, or
  running in mock mode -- mock mode previously would have *tried* to hit
  real hardware for LED calls, which was itself a latent bug this happens
  to fix as a side effect).

## Alternatives considered

- **Keep `bmd-speededitor` as a dependency, reimplement the read loop
  ourselves** against the Apache-2.0 `smunaut/blackmagic-misc` reference
  instead of forking `bmd-speededitor`. Rejected: strictly more code than
  forking the ~250 lines we actually use, for no license or
  maintainability benefit over vendoring MIT-licensed code we're already
  permitted to modify.
- **Two handles, but only open the LED one on-demand and close it
  immediately after each write** (rather than the original always-open
  independent handle). Doesn't help: the read loop's handle is *always*
  open, so `HidApi::new()` for the LED write fails regardless of how
  short-lived the write-side handle is.
