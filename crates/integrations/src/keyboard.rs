use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use sped_mapping::{Action, ActionError, ActionExecutor};

/// Executes [`Action::Keyboard`] actions by synthesizing key events with
/// `enigo`. A fresh `Enigo` instance is created per call: it wraps
/// platform handles that aren't worth keeping alive across the (rare,
/// human-timescale) gaps between key presses, and this keeps the executor
/// trivially `Send + Sync`.
pub struct KeyboardExecutor;

impl KeyboardExecutor {
    pub fn new() -> Self {
        Self
    }
}

impl Default for KeyboardExecutor {
    fn default() -> Self {
        Self::new()
    }
}

impl ActionExecutor for KeyboardExecutor {
    fn execute(&self, action: &Action) -> Result<(), ActionError> {
        let Action::Keyboard(keyboard_action) = action else {
            return Err(ActionError::Unsupported);
        };

        let keys: Vec<Key> = keyboard_action
            .keys
            .iter()
            .map(|name| parse_key(name))
            .collect::<Result<_, _>>()
            .map_err(ActionError::Failed)?;

        let mut enigo =
            Enigo::new(&Settings::default()).map_err(|e| ActionError::Failed(e.to_string()))?;

        for key in &keys {
            enigo
                .key(*key, Direction::Press)
                .map_err(|e| ActionError::Failed(e.to_string()))?;
        }
        for key in keys.iter().rev() {
            enigo
                .key(*key, Direction::Release)
                .map_err(|e| ActionError::Failed(e.to_string()))?;
        }

        Ok(())
    }
}

/// Parses a normalized key name (as stored in a profile, e.g. `"CTRL"`,
/// `"F5"`, `"B"`) into an `enigo::Key`. Kept independent of display
/// formatting so the same names work regardless of locale.
fn parse_key(name: &str) -> Result<Key, String> {
    let upper = name.to_uppercase();

    if let Some(rest) = upper.strip_prefix('F') {
        if let Ok(n) = rest.parse::<u8>() {
            if let Some(key) = function_key(n) {
                return Ok(key);
            }
        }
    }

    let key = match upper.as_str() {
        "CTRL" | "CONTROL" => Key::Control,
        "SHIFT" => Key::Shift,
        "ALT" | "OPTION" => Key::Alt,
        "META" | "CMD" | "COMMAND" | "WIN" | "WINDOWS" | "SUPER" => Key::Meta,
        "ENTER" | "RETURN" => Key::Return,
        "ESC" | "ESCAPE" => Key::Escape,
        "SPACE" => Key::Space,
        "TAB" => Key::Tab,
        "BACKSPACE" => Key::Backspace,
        "DELETE" | "DEL" => Key::Delete,
        "INSERT" => Key::Insert,
        "HOME" => Key::Home,
        "END" => Key::End,
        "PAGEUP" | "PAGE_UP" => Key::PageUp,
        "PAGEDOWN" | "PAGE_DOWN" => Key::PageDown,
        "UP" | "ARROWUP" => Key::UpArrow,
        "DOWN" | "ARROWDOWN" => Key::DownArrow,
        "LEFT" | "ARROWLEFT" => Key::LeftArrow,
        "RIGHT" | "ARROWRIGHT" => Key::RightArrow,
        "VOLUME_UP" | "VOLUMEUP" => Key::VolumeUp,
        "VOLUME_DOWN" | "VOLUMEDOWN" => Key::VolumeDown,
        "VOLUME_MUTE" | "MUTE" => Key::VolumeMute,
        "MEDIA_PLAY_PAUSE" | "PLAY_PAUSE" => Key::MediaPlayPause,
        "MEDIA_NEXT" | "MEDIA_NEXT_TRACK" => Key::MediaNextTrack,
        "MEDIA_PREV" | "MEDIA_PREVIOUS" | "MEDIA_PREV_TRACK" => Key::MediaPrevTrack,
        "MEDIA_STOP" => Key::MediaStop,
        other => {
            let mut chars = other.chars();
            match (chars.next(), chars.next()) {
                (Some(c), None) => Key::Unicode(c.to_ascii_lowercase()),
                _ => return Err(format!("unrecognized key: {name}")),
            }
        }
    };

    Ok(key)
}

fn function_key(n: u8) -> Option<Key> {
    Some(match n {
        1 => Key::F1,
        2 => Key::F2,
        3 => Key::F3,
        4 => Key::F4,
        5 => Key::F5,
        6 => Key::F6,
        7 => Key::F7,
        8 => Key::F8,
        9 => Key::F9,
        10 => Key::F10,
        11 => Key::F11,
        12 => Key::F12,
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_modifiers_and_letters() {
        assert!(matches!(parse_key("CTRL"), Ok(Key::Control)));
        assert!(matches!(parse_key("b"), Ok(Key::Unicode('b'))));
        assert!(matches!(parse_key("F5"), Ok(Key::F5)));
    }

    #[test]
    fn rejects_unknown_names() {
        assert!(parse_key("NOT_A_KEY").is_err());
    }

    #[test]
    fn non_keyboard_action_is_unsupported() {
        let executor = KeyboardExecutor::new();
        let action = Action::Obs(sped_mapping::ObsAction::Recording {
            mode: sped_mapping::RecordingMode::Toggle,
        });
        assert!(matches!(
            executor.execute(&action),
            Err(ActionError::Unsupported)
        ));
    }
}
