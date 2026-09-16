use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ApplicationInfo {
    /// Executable name without path or extension, e.g. `"Resolve"`.
    pub process_name: String,
    pub window_title: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum DetectionError {
    #[error("could not determine the active application: {0}")]
    Unavailable(String),
}

/// Backend abstraction for "which application is currently focused",
/// used to drive application-aware profile switching. Kept out of the
/// frontend and out of the mapping engine so platform-specific code stays
/// in one place.
pub trait ActiveApplicationDetector: Send + Sync {
    fn active_application(&self) -> Result<ApplicationInfo, DetectionError>;
}

/// Fallback used on platforms without a native implementation yet.
pub struct UnsupportedPlatformDetector;

impl ActiveApplicationDetector for UnsupportedPlatformDetector {
    fn active_application(&self) -> Result<ApplicationInfo, DetectionError> {
        Err(DetectionError::Unavailable(
            "active application detection is not implemented for this platform".into(),
        ))
    }
}

#[cfg(windows)]
pub use windows_impl::WindowsForegroundDetector;

#[cfg(windows)]
mod windows_impl {
    use super::{ActiveApplicationDetector, ApplicationInfo, DetectionError};
    use windows::Win32::Foundation::{CloseHandle, HANDLE, MAX_PATH};
    use windows::Win32::System::ProcessStatus::GetModuleBaseNameW;
    use windows::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_VM_READ,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
    };

    #[derive(Default)]
    pub struct WindowsForegroundDetector;

    impl WindowsForegroundDetector {
        pub fn new() -> Self {
            Self
        }
    }

    impl ActiveApplicationDetector for WindowsForegroundDetector {
        fn active_application(&self) -> Result<ApplicationInfo, DetectionError> {
            unsafe {
                let hwnd = GetForegroundWindow();
                if hwnd.is_invalid() {
                    return Err(DetectionError::Unavailable(
                        "no foreground window".to_string(),
                    ));
                }

                let mut pid: u32 = 0;
                GetWindowThreadProcessId(hwnd, Some(&mut pid));
                if pid == 0 {
                    return Err(DetectionError::Unavailable(
                        "could not resolve owning process".to_string(),
                    ));
                }

                let process: HANDLE = OpenProcess(
                    PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ,
                    false,
                    pid,
                )
                .map_err(|e| DetectionError::Unavailable(e.to_string()))?;

                let mut name_buf = [0u16; MAX_PATH as usize];
                let len = GetModuleBaseNameW(process, None, &mut name_buf);
                let _ = CloseHandle(process);

                if len == 0 {
                    return Err(DetectionError::Unavailable(
                        "could not read process name".to_string(),
                    ));
                }

                let process_name = String::from_utf16_lossy(&name_buf[..len as usize])
                    .trim_end_matches(".exe")
                    .to_string();

                let mut title_buf = [0u16; 512];
                let title_len = GetWindowTextW(hwnd, &mut title_buf);
                let window_title = (title_len > 0)
                    .then(|| String::from_utf16_lossy(&title_buf[..title_len as usize]));

                Ok(ApplicationInfo {
                    process_name,
                    window_title,
                })
            }
        }
    }
}
