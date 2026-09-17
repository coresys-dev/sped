// Vendored, modified from `bmd-speededitor` v0.2.3
// (https://github.com/camikura/bmd-speededitor-rs), MIT licensed,
// Copyright (c) 2022 camikura. Trimmed to the handlers `speed_editor.rs`
// (our `sped-device` wrapper, not this module) actually registers
// callbacks for -- see `crates/device/src/vendor/mod.rs` for the full
// list of changes from upstream.

use super::{Key, SpeedEditorResult};

pub trait Handler {
    fn new() -> Self;
}

pub struct ConnectedHandler {
    pub callbacks: Vec<Box<dyn FnMut() -> SpeedEditorResult + Sync + Send>>,
}

impl ConnectedHandler {
    pub fn call(&mut self) -> SpeedEditorResult {
        for callback in self.callbacks.iter_mut() {
            (&mut *callback)()?;
        }
        Ok(())
    }
}

impl Handler for ConnectedHandler {
    fn new() -> ConnectedHandler {
        ConnectedHandler { callbacks: vec![] }
    }
}

pub struct DisconnectedHandler {
    pub callbacks: Vec<Box<dyn FnMut() -> SpeedEditorResult + Sync + Send>>,
}

impl DisconnectedHandler {
    pub fn call(&mut self) -> SpeedEditorResult {
        for callback in self.callbacks.iter_mut() {
            (&mut *callback)()?;
        }
        Ok(())
    }
}

impl Handler for DisconnectedHandler {
    fn new() -> DisconnectedHandler {
        DisconnectedHandler { callbacks: vec![] }
    }
}

pub struct KeyHandler {
    pub callbacks: Vec<Box<dyn FnMut(Key, bool) -> SpeedEditorResult + Sync + Send>>,
}

impl KeyHandler {
    pub fn call(&mut self, key: Key, down: bool) -> SpeedEditorResult {
        for callback in self.callbacks.iter_mut() {
            (&mut *callback)(key, down)?;
        }
        Ok(())
    }
}

impl Handler for KeyHandler {
    fn new() -> KeyHandler {
        KeyHandler { callbacks: vec![] }
    }
}

pub struct JogHandler {
    pub callbacks: Vec<Box<dyn FnMut(u8, i32) -> SpeedEditorResult + Sync + Send>>,
}

impl JogHandler {
    pub fn call(&mut self, mode: u8, value: i32) -> SpeedEditorResult {
        for callback in self.callbacks.iter_mut() {
            (&mut *callback)(mode, value)?;
        }
        Ok(())
    }
}

impl Handler for JogHandler {
    fn new() -> JogHandler {
        JogHandler { callbacks: vec![] }
    }
}
