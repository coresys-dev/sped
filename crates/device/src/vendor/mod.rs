//! Vendored, modified copy of `bmd-speededitor` v0.2.3
//! (<https://github.com/camikura/bmd-speededitor-rs>), MIT licensed,
//! Copyright (c) 2022 camikura.
//!
//! See `claude/docs/decisions/0001-speed-editor-driver.md` (original
//! decision to depend on the crate) and
//! `claude/docs/decisions/0002-vendor-bmd-speededitor.md` (why it's
//! vendored here instead) for the full history.
//!
//! Changes from upstream:
//! - `run()` now also drains a `Receiver<crate::led::LedCommand>` each loop
//!   iteration (before the blocking read) so LED writes go out over the
//!   *same* `HidDevice`/`HidApi` handle the read loop already holds,
//!   instead of a second independent `hidapi::HidApi::new()` -- which
//!   can't coexist with this one: `HidApi` is a process-wide singleton
//!   (see `hidapi::HidApiLock`), so a second handle always fails with
//!   `HidError::InitializationError` while this one is open. That's what
//!   `LedController` (crates/device/src/led.rs) used to do, and why it
//!   never worked against real hardware.
//! - Its own `key_led::KeyLed` enum is dropped in favor of our own
//!   `crate::led::LedId`, since there's no longer an external-crate
//!   boundary to keep them decoupled across (bit positions already match
//!   exactly -- see `LedId`'s own doc comment).
//! - `last_authenticated_at` uses `std::time::Instant` instead of
//!   `chrono::DateTime<Utc>` (only ever compared for elapsed time, never
//!   serialized, so `chrono` bought nothing but an extra dependency).

pub mod handler;
pub mod key;

use crate::led::{LedCommand, LedId};
use hidapi::{HidDevice, HidError};
use std::io::Read;
use std::sync::mpsc::{Receiver, TryRecvError};
use std::time::{Duration, Instant};
use std::{thread, time::Duration as StdDuration};

use handler::{ConnectedHandler, DisconnectedHandler, Handler, JogHandler, KeyHandler};
use key::Key;

pub struct SpeedEditor {
    pub device: Option<HidDevice>,
    pub last_authenticated_at: Option<Instant>,
    pub current_keys: Vec<Key>,
    pub current_led_mask: u32,
    pub connected_handler: ConnectedHandler,
    pub disconnected_handler: DisconnectedHandler,
    pub key_handler: KeyHandler,
    pub jog_handler: JogHandler,
}

pub type SpeedEditorResult = Result<(), SpeedEditorError>;

#[derive(Debug)]
pub enum SpeedEditorError {
    HidApiError(hidapi::HidError),
    StdIoError(std::io::Error),
    AuthGetKbdChallengeError,
    AuthGetKbdResponseError,
    AuthGetKbdStatusError,
}

impl From<hidapi::HidError> for SpeedEditorError {
    fn from(e: HidError) -> Self {
        SpeedEditorError::HidApiError(e)
    }
}

impl From<std::io::Error> for SpeedEditorError {
    fn from(e: std::io::Error) -> Self {
        SpeedEditorError::StdIoError(e)
    }
}

pub fn new() -> Result<SpeedEditor, SpeedEditorError> {
    Ok(SpeedEditor {
        device: None,
        last_authenticated_at: None,
        current_keys: Vec::default(),
        current_led_mask: 0,
        connected_handler: ConnectedHandler::new(),
        disconnected_handler: DisconnectedHandler::new(),
        key_handler: KeyHandler::new(),
        jog_handler: JogHandler::new(),
    })
}

impl SpeedEditor {
    const VID: u16 = 7899;
    const PID: u16 = 55822;
    const READ_TIMEOUT: i32 = 1000;
    const RECONNECT_INTERVAL: u64 = 100;
    const AUTH_INTERVAL: Duration = StdDuration::from_millis(30000);

    const AUTH_EVEN_TBL: [u64; 8] = [
        4242707987619187656,
        3069963097229903046,
        2352841328256802570,
        12646368222702737177,
        17018789593460232529,
        12706253227766860309,
        11978781369061872007,
        8438608961089703390,
    ];

    const AUTH_ODD_TBL: [u64; 8] = [
        4477338132788707294,
        2622620659002747676,
        11637077509869926595,
        7923852755392722584,
        8224257920127642516,
        4049197610885016386,
        18266591397768539273,
        7035737829027231430,
    ];

    const MASK: u64 = 12077075256910773232;

    fn rol8(&self, v: u64) -> u64 {
        ((v << 56) | (v >> 8)) & 18446744073709551615
    }

    fn rol8n(&self, mut v: u64, n: u64) -> u64 {
        for _ in 0..n {
            v = self.rol8(v);
        }
        v
    }

    /*
     * Authenticate module is taken from:
     * https://github.com/smunaut/blackmagic-misc
     * Copyright (C) 2021 Sylvain Munaut <tnt@246tNt.com>
     *
     * */
    fn auth(&mut self) -> SpeedEditorResult {
        let mut buf = [0; 8];
        let mut bytes = vec![0; 10];

        if let Some(device) = &self.device {
            device.send_feature_report(&[0x6, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0])?;
            bytes[0] = 0x6;

            let _ = device.get_feature_report(&mut bytes)?;
            if bytes[0] != 0x6 || bytes[1] != 0x0 {
                return Err(SpeedEditorError::AuthGetKbdChallengeError);
            }

            (&bytes[2..]).read_exact(&mut buf).unwrap();
            let challenge = u64::from_le_bytes(buf);

            device.send_feature_report(&[0x6, 0x1, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0])?;
            let _ = device.get_feature_report(&mut bytes)?;
            if bytes[0] != 0x6 || bytes[1] != 0x2 {
                return Err(SpeedEditorError::AuthGetKbdResponseError);
            }

            let n = challenge & 7;
            let mut v = self.rol8n(challenge, n);
            let k: u64;
            if (v & 1) == ((120 >> n) & 1) {
                k = Self::AUTH_EVEN_TBL[n as usize];
            } else {
                v = v ^ self.rol8(v);
                k = Self::AUTH_ODD_TBL[n as usize];
            }

            let response = v ^ (self.rol8(v) & Self::MASK) ^ k;
            buf = response.to_le_bytes();

            bytes[1] = 0x3;
            for i in 0..8 {
                bytes[i + 2] = buf[i];
            }

            device.send_feature_report(bytes.as_slice())?;

            let _ = device.get_feature_report(&mut bytes)?;
            if bytes[0] != 0x6 || bytes[1] != 0x4 {
                return Err(SpeedEditorError::AuthGetKbdStatusError);
            }

            self.last_authenticated_at = Some(Instant::now());
        }

        Ok(())
    }

    fn is_expired(&self) -> bool {
        match self.last_authenticated_at {
            Some(at) => at.elapsed() >= Self::AUTH_INTERVAL,
            None => true,
        }
    }

    /// Blocking event loop. `led_rx` is drained (non-blockingly) once per
    /// iteration, whenever the device is connected and authenticated, so
    /// LED writes share this same handle instead of opening a second one.
    pub fn run(&mut self, led_rx: &Receiver<LedCommand>) -> SpeedEditorResult {
        loop {
            if self.device.is_none() {
                self.connect()?;
                continue;
            }

            if self.is_expired() {
                self.auth()?;
                continue;
            }

            self.drain_led_commands(led_rx)?;

            if let Some(device) = &self.device {
                let mut buf = [0; 64];
                match device.read_timeout(&mut buf, Self::READ_TIMEOUT) {
                    Ok(len) => {
                        if len > 0 {
                            self.process_events(&buf[..len])?;
                        }
                    }
                    Err(_) => self.disconnect()?,
                }
            }
        }
    }

    fn drain_led_commands(&mut self, led_rx: &Receiver<LedCommand>) -> SpeedEditorResult {
        loop {
            match led_rx.try_recv() {
                Ok(LedCommand::Set(led, on)) => self.apply_led(led, on)?,
                Ok(LedCommand::SetMany(leds, on)) => {
                    for led in leds {
                        self.apply_led_bit(led.bit(), on);
                    }
                    self.light_leds()?;
                }
                Ok(LedCommand::SetBit(bit, on)) => {
                    self.apply_led_bit(bit, on);
                    self.light_leds()?;
                }
                Ok(LedCommand::ClearAll) => {
                    self.current_led_mask = 0;
                    self.light_leds()?;
                }
                Err(TryRecvError::Empty) => return Ok(()),
                Err(TryRecvError::Disconnected) => return Ok(()),
            }
        }
    }

    fn apply_led(&mut self, led: LedId, on: bool) -> SpeedEditorResult {
        self.apply_led_bit(led.bit(), on);
        self.light_leds()
    }

    fn apply_led_bit(&mut self, bit: u32, on: bool) {
        if on {
            self.current_led_mask |= 1 << bit;
        } else {
            self.current_led_mask &= !(1 << bit);
        }
    }

    fn process_events(&mut self, buf: &[u8]) -> SpeedEditorResult {
        match buf[0] {
            3 => self.jog_event(buf[1], &buf[2..])?,
            4 => self.key_event(&buf[1..])?,
            _ => self.unknown_event(buf)?,
        }

        Ok(())
    }

    fn jog_event(&mut self, mode: u8, buf: &[u8]) -> SpeedEditorResult {
        let mut data = [0; 4];
        (&buf[..]).read_exact(&mut data)?;
        let value = i32::from_le_bytes(data) / 360;
        self.jog_handler.call(mode, value)?;
        Ok(())
    }

    fn key_event(&mut self, buf: &[u8]) -> SpeedEditorResult {
        let current_keys: Vec<Key> = buf
            .iter()
            .enumerate()
            .filter(|&(i, _)| i % 2 == 0)
            .filter(|&(_, &v)| v > 0)
            .map(|(_, &v)| Key::try_from(v).unwrap())
            .collect();

        // Are you pressing 7 or more keys at the same time?
        if current_keys == self.current_keys {
            return Ok(());
        }

        let down_keys: Vec<Key> = current_keys
            .iter()
            .map(|&v| {
                if self.current_keys.iter().find(|&k| *k == v) == None {
                    v
                } else {
                    Key::None
                }
            })
            .filter(|&v| v > Key::None)
            .collect();

        let up_keys: Vec<Key> = self
            .current_keys
            .iter()
            .map(|&v| {
                if current_keys.iter().find(|&k| *k == v) == None {
                    v
                } else {
                    Key::None
                }
            })
            .filter(|&v| v > Key::None)
            .collect();

        self.current_keys = current_keys.to_owned();

        for k in down_keys {
            self.key_handler.call(k, true)?;
        }

        for k in up_keys {
            self.key_handler.call(k, false)?;
        }

        Ok(())
    }

    fn unknown_event(&mut self, _buf: &[u8]) -> SpeedEditorResult {
        Ok(())
    }

    fn disconnect(&mut self) -> SpeedEditorResult {
        self.device = None;
        self.last_authenticated_at = None;
        self.disconnected_handler.call()
    }

    // Try to connect
    fn connect(&mut self) -> SpeedEditorResult {
        let api = hidapi::HidApi::new()?;

        self.device = match api.open(SpeedEditor::VID, SpeedEditor::PID) {
            Ok(device) => {
                self.connected_handler.call()?;
                Some(device)
            }
            Err(_) => {
                thread::sleep(StdDuration::from_millis(Self::RECONNECT_INTERVAL));
                None
            }
        };

        Ok(())
    }

    fn light_leds(&mut self) -> SpeedEditorResult {
        if let Some(device) = &self.device {
            // Output Report ID 2: report-id byte + LE32 LED bitfield, 5
            // bytes total -- no trailing byte. The upstream crate this was
            // vendored from sent a spurious 6th `0x00` byte, which happened
            // not to matter for bits within the first data byte (e.g.
            // CUT/DIS/SMTH_CUT) but silently dropped bits in the 2nd/3rd
            // (e.g. CAM1/CAM2/CAM3, bits 14-16) on real hardware. Matches
            // `smunaut/blackmagic-misc`'s `bmd.py` (`struct.pack('<BI', 2,
            // leds)`), the reference this protocol is based on.
            let buf = self.current_led_mask.to_le_bytes();
            let data = [0x2, buf[0], buf[1], buf[2], buf[3]];
            device.write(&data)?;
        }
        Ok(())
    }

    pub fn on_connected<F>(&mut self, callback: F)
    where
        F: FnMut() -> SpeedEditorResult + Sync + Send + 'static,
    {
        self.connected_handler.callbacks.push(Box::new(callback));
    }

    pub fn on_disconnected<F>(&mut self, callback: F)
    where
        F: FnMut() -> SpeedEditorResult + Sync + Send + 'static,
    {
        self.disconnected_handler.callbacks.push(Box::new(callback));
    }

    pub fn on_key<F>(&mut self, callback: F)
    where
        F: FnMut(Key, bool) -> SpeedEditorResult + Sync + Send + 'static,
    {
        self.key_handler.callbacks.push(Box::new(callback));
    }

    pub fn on_jog<F>(&mut self, callback: F)
    where
        F: FnMut(u8, i32) -> SpeedEditorResult + Sync + Send + 'static,
    {
        self.jog_handler.callbacks.push(Box::new(callback));
    }
}
