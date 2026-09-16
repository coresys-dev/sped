//! Concrete integrations (keyboard, OBS, active-application detection)
//! that implement the traits/enums defined in `sped-mapping` and
//! `sped-device`. Nothing outside this crate knows about `enigo`,
//! `obws` or Win32.

mod app_detection;
mod keyboard;
mod obs;

pub use app_detection::{ActiveApplicationDetector, ApplicationInfo, DetectionError, UnsupportedPlatformDetector};
#[cfg(windows)]
pub use app_detection::WindowsForegroundDetector;
pub use keyboard::KeyboardExecutor;
pub use obs::{ObsIntegration, ObsStatus};
