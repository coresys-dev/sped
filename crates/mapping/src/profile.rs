use crate::mapping::Mapping;
use serde::{Deserialize, Serialize};
use sped_device::ControlId;
use std::collections::HashMap;
use std::path::Path;
use thiserror::Error;

/// Bump when the on-disk shape of `Profile` changes, and add a branch to
/// [`Profile::from_json`] to upgrade older files rather than rejecting
/// them.
pub const PROFILE_FORMAT_VERSION: u32 = 1;

#[derive(Debug, Error)]
pub enum ProfileError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid profile JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("profile format version {0} is newer than supported ({PROFILE_FORMAT_VERSION})")]
    UnsupportedVersion(u32),
}

/// A named set of control -> mapping assignments. Mappings are keyed by
/// [`ControlId::as_str`] rather than the enum directly so the JSON stays
/// stable and human-readable even if the enum's internal representation
/// changes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub version: u32,
    pub name: String,
    #[serde(default)]
    pub mappings: HashMap<String, Vec<Mapping>>,
}

impl Profile {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            version: PROFILE_FORMAT_VERSION,
            name: name.into(),
            mappings: HashMap::new(),
        }
    }

    pub fn mappings_for(&self, control: ControlId) -> &[Mapping] {
        self.mappings
            .get(control.as_str())
            .map(Vec::as_slice)
            .unwrap_or(&[])
    }

    pub fn set_mappings(&mut self, control: ControlId, mappings: Vec<Mapping>) {
        if mappings.is_empty() {
            self.mappings.remove(control.as_str());
        } else {
            self.mappings.insert(control.as_str().to_string(), mappings);
        }
    }

    pub fn duplicate(&self, new_name: impl Into<String>) -> Self {
        Self {
            version: self.version,
            name: new_name.into(),
            mappings: self.mappings.clone(),
        }
    }

    pub fn from_json(data: &str) -> Result<Self, ProfileError> {
        let profile: Profile = serde_json::from_str(data)?;
        if profile.version > PROFILE_FORMAT_VERSION {
            return Err(ProfileError::UnsupportedVersion(profile.version));
        }
        // Older (lower) versions would be migrated here once the format
        // has actually changed. Nothing to do yet for version 1.
        Ok(profile)
    }

    pub fn to_json(&self) -> Result<String, ProfileError> {
        Ok(serde_json::to_string_pretty(self)?)
    }

    pub fn load(path: &Path) -> Result<Self, ProfileError> {
        let data = std::fs::read_to_string(path)?;
        Self::from_json(&data)
    }

    pub fn save(&self, path: &Path) -> Result<(), ProfileError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, self.to_json()?)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::action::{Action, KeyboardAction};
    use crate::mapping::Mapping;

    #[test]
    fn round_trips_through_json() {
        let mut profile = Profile::new("DaVinci Resolve");
        profile.set_mappings(
            ControlId::Cut,
            vec![Mapping::simple(vec![Action::Keyboard(KeyboardAction {
                keys: vec!["CTRL".into(), "B".into()],
            })])],
        );

        let json = profile.to_json().unwrap();
        let restored = Profile::from_json(&json).unwrap();

        assert_eq!(restored.name, "DaVinci Resolve");
        assert_eq!(restored.mappings_for(ControlId::Cut).len(), 1);
    }

    #[test]
    fn save_and_load_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("profile.json");

        let profile = Profile::new("Roundtrip");
        profile.save(&path).unwrap();

        let loaded = Profile::load(&path).unwrap();
        assert_eq!(loaded.name, "Roundtrip");
    }

    #[test]
    fn rejects_future_versions() {
        let json = r#"{"version": 999, "name": "future", "mappings": {}}"#;
        assert!(matches!(
            Profile::from_json(json),
            Err(ProfileError::UnsupportedVersion(999))
        ));
    }
}
