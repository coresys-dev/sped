use crate::action::Action;
use crate::modifier::Modifier;
use crate::profile::Profile;
use crate::trigger::Trigger;
use sped_device::{ControlEvent, ControlId};

/// Consumes normalized [`ControlEvent`]s against the active [`Profile`]
/// and resolves them into the [`Action`]s that should run.
///
/// The engine itself never executes actions -- see
/// [`crate::dispatch::Dispatcher`] -- so it stays trivially testable and
/// UI/integration-agnostic.
pub struct MappingEngine {
    profile: Profile,
    active_modifier: Modifier,
}

impl MappingEngine {
    pub fn new(profile: Profile) -> Self {
        Self {
            profile,
            active_modifier: Modifier::None,
        }
    }

    pub fn profile(&self) -> &Profile {
        &self.profile
    }

    pub fn set_profile(&mut self, profile: Profile) {
        self.profile = profile;
    }

    pub fn set_modifier(&mut self, modifier: Modifier) {
        self.active_modifier = modifier;
    }

    /// Returns the actions that should run for this event, in order,
    /// or an empty vec if nothing is mapped (e.g. `Jog`/`Shuttle`, or a
    /// control with no assignment for the current trigger/modifier).
    pub fn handle_event(&self, event: &ControlEvent) -> Vec<Action> {
        let (control, trigger) = match event {
            ControlEvent::Pressed { control } => (*control, Trigger::Press),
            ControlEvent::Released { control } => (*control, Trigger::Release),
            _ => return Vec::new(),
        };

        self.resolve(control, trigger)
    }

    fn resolve(&self, control: ControlId, trigger: Trigger) -> Vec<Action> {
        let mappings = self.profile.mappings_for(control);

        mappings
            .iter()
            .find(|m| m.trigger == trigger && m.modifier == self.active_modifier)
            .or_else(|| {
                // Fall back to a Modifier::None mapping if the current
                // layer has nothing bound for this control/trigger.
                (self.active_modifier != Modifier::None)
                    .then(|| {
                        mappings
                            .iter()
                            .find(|m| m.trigger == trigger && m.modifier == Modifier::None)
                    })
                    .flatten()
            })
            .map(|m| m.actions.clone())
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::action::{Action, KeyboardAction};
    use crate::mapping::Mapping;

    fn ctrl_b() -> Action {
        Action::Keyboard(KeyboardAction {
            keys: vec!["CTRL".into(), "B".into()],
        })
    }

    #[test]
    fn press_resolves_mapped_action() {
        let mut profile = Profile::new("Test");
        profile.set_mappings(ControlId::Cut, vec![Mapping::simple(vec![ctrl_b()])]);
        let engine = MappingEngine::new(profile);

        let actions = engine.handle_event(&ControlEvent::Pressed {
            control: ControlId::Cut,
        });
        assert_eq!(actions, vec![ctrl_b()]);
    }

    #[test]
    fn unmapped_control_yields_no_actions() {
        let engine = MappingEngine::new(Profile::new("Empty"));
        let actions = engine.handle_event(&ControlEvent::Pressed {
            control: ControlId::Cam1,
        });
        assert!(actions.is_empty());
    }

    #[test]
    fn wheel_events_never_resolve_to_actions() {
        let engine = MappingEngine::new(Profile::new("Empty"));
        assert!(engine
            .handle_event(&ControlEvent::Jog { delta: 3 })
            .is_empty());
    }

    #[test]
    fn multiple_actions_execute_in_declared_order() {
        let mut profile = Profile::new("Test");
        let second = Action::Obs(crate::action::ObsAction::Recording {
            mode: crate::action::RecordingMode::Toggle,
        });
        profile.set_mappings(
            ControlId::Cut,
            vec![Mapping::simple(vec![ctrl_b(), second.clone()])],
        );
        let engine = MappingEngine::new(profile);

        let actions = engine.handle_event(&ControlEvent::Pressed {
            control: ControlId::Cut,
        });
        assert_eq!(actions, vec![ctrl_b(), second]);
    }

    #[test]
    fn modifier_layer_falls_back_to_none() {
        let mut profile = Profile::new("Test");
        profile.set_mappings(ControlId::Cut, vec![Mapping::simple(vec![ctrl_b()])]);
        let mut engine = MappingEngine::new(profile);
        engine.set_modifier(Modifier::Shift);

        let actions = engine.handle_event(&ControlEvent::Pressed {
            control: ControlId::Cut,
        });
        assert_eq!(actions, vec![ctrl_b()]);
    }
}
