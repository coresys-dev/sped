use crate::action::{Action, ObsAction, VolumeMode};
use crate::mapping::Mapping;
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
    /// Net wheel rotation (post sensitivity/deadzone) accumulated since
    /// the last `JogClockwise`/`JogCounterClockwise` threshold crossing.
    /// Only meaningful for `ControlId::JogWheel`; see `resolve_jog`.
    jog_accumulator: i32,
}

impl MappingEngine {
    pub fn new(profile: Profile) -> Self {
        Self {
            profile,
            active_modifier: Modifier::None,
            jog_accumulator: 0,
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

    /// Returns the actions that should run for this event, in order, or an
    /// empty vec if nothing is mapped. `Jog`/`Shuttle` resolve through
    /// [`Self::resolve_jog`] against `ControlId::JogWheel`'s mappings
    /// rather than `Self::resolve`'s press/release matching -- `Shuttle`
    /// is not wired up yet and always yields nothing.
    pub fn handle_event(&mut self, event: &ControlEvent) -> Vec<Action> {
        match event {
            ControlEvent::Pressed { control } => self.resolve(*control, Trigger::Press),
            ControlEvent::Released { control } => self.resolve(*control, Trigger::Release),
            ControlEvent::Jog { delta } => self.resolve_jog(*delta),
            _ => Vec::new(),
        }
    }

    fn resolve(&self, control: ControlId, trigger: Trigger) -> Vec<Action> {
        self.find_mapping(control, trigger)
            .map(|m| m.actions.clone())
            .unwrap_or_default()
    }

    /// Finds the mapping for `control`/`trigger` under the active
    /// modifier, falling back to a `Modifier::None` mapping if the current
    /// layer has nothing bound for this control/trigger.
    fn find_mapping(&self, control: ControlId, trigger: Trigger) -> Option<&Mapping> {
        let mappings = self.profile.mappings_for(control);

        mappings
            .iter()
            .find(|m| m.trigger == trigger && m.modifier == self.active_modifier)
            .or_else(|| {
                (self.active_modifier != Modifier::None)
                    .then(|| mappings.iter().find(|m| m.trigger == trigger && m.modifier == Modifier::None))
                    .flatten()
            })
    }

    /// Resolves a raw wheel delta (already sensitivity/deadzone-adjusted
    /// by the caller) against `ControlId::JogWheel`'s mappings.
    ///
    /// `JogContinuous` fires on every call, with its actions' continuous
    /// parameters scaled live by `delta * amount_per_tick` (see
    /// `scale_continuous`). `JogClockwise`/`JogCounterClockwise` fire once
    /// per `threshold` of *accumulated* rotation crossed in that
    /// direction -- the accumulator persists across calls and carries any
    /// remainder past the threshold, so a single large delta can fire
    /// multiple times and partial rotations still add up correctly.
    fn resolve_jog(&mut self, delta: i32) -> Vec<Action> {
        let mut actions = Vec::new();

        if let Some(m) = self.find_mapping(ControlId::JogWheel, Trigger::JogContinuous) {
            actions.extend(m.actions.iter().map(|a| scale_continuous(a, delta, m.amount_per_tick)));
        }

        self.jog_accumulator += delta;

        if let Some((threshold, mapped_actions)) = self
            .find_mapping(ControlId::JogWheel, Trigger::JogClockwise)
            .map(|m| (m.threshold.max(1), m.actions.clone()))
        {
            while self.jog_accumulator >= threshold {
                actions.extend(mapped_actions.iter().cloned());
                self.jog_accumulator -= threshold;
            }
        }

        if let Some((threshold, mapped_actions)) = self
            .find_mapping(ControlId::JogWheel, Trigger::JogCounterClockwise)
            .map(|m| (m.threshold.max(1), m.actions.clone()))
        {
            while self.jog_accumulator <= -threshold {
                actions.extend(mapped_actions.iter().cloned());
                self.jog_accumulator += threshold;
            }
        }

        actions
    }
}

/// Rewrites `action`'s continuous parameter for `JogContinuous` mappings.
/// Only `ObsAction::SourceVolume`'s `VolumeMode::Relative` is continuous
/// today -- everything else is returned unchanged (cloned), so mapping a
/// non-continuous action to `JogContinuous` just fires it as-is on every
/// wheel event.
fn scale_continuous(action: &Action, delta: i32, amount_per_tick: f32) -> Action {
    match action {
        Action::Obs(ObsAction::SourceVolume {
            source,
            mode: VolumeMode::Relative { .. },
        }) => Action::Obs(ObsAction::SourceVolume {
            source: source.clone(),
            mode: VolumeMode::Relative {
                delta_percent: delta as f32 * amount_per_tick,
            },
        }),
        other => other.clone(),
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

    fn jog_mapping(trigger: Trigger, actions: Vec<Action>) -> Mapping {
        Mapping {
            trigger,
            ..Mapping::simple(actions)
        }
    }

    #[test]
    fn press_resolves_mapped_action() {
        let mut profile = Profile::new("Test");
        profile.set_mappings(ControlId::Cut, vec![Mapping::simple(vec![ctrl_b()])]);
        let mut engine = MappingEngine::new(profile);

        let actions = engine.handle_event(&ControlEvent::Pressed {
            control: ControlId::Cut,
        });
        assert_eq!(actions, vec![ctrl_b()]);
    }

    #[test]
    fn unmapped_control_yields_no_actions() {
        let mut engine = MappingEngine::new(Profile::new("Empty"));
        let actions = engine.handle_event(&ControlEvent::Pressed {
            control: ControlId::Cam1,
        });
        assert!(actions.is_empty());
    }

    #[test]
    fn wheel_events_with_no_jog_wheel_mapping_yield_no_actions() {
        let mut engine = MappingEngine::new(Profile::new("Empty"));
        assert!(engine
            .handle_event(&ControlEvent::Jog { delta: 3 })
            .is_empty());
    }

    #[test]
    fn shuttle_never_resolves_to_actions() {
        let mut profile = Profile::new("Test");
        profile.set_mappings(
            ControlId::JogWheel,
            vec![jog_mapping(Trigger::JogContinuous, vec![ctrl_b()])],
        );
        let mut engine = MappingEngine::new(profile);
        assert!(engine
            .handle_event(&ControlEvent::Shuttle { value: 5 })
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
        let mut engine = MappingEngine::new(profile);

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

    #[test]
    fn jog_clockwise_fires_once_per_threshold_crossed() {
        let mut profile = Profile::new("Test");
        let mapping = Mapping {
            trigger: Trigger::JogClockwise,
            threshold: 10,
            ..Mapping::simple(vec![ctrl_b()])
        };
        profile.set_mappings(ControlId::JogWheel, vec![mapping]);
        let mut engine = MappingEngine::new(profile);

        // Below threshold: nothing fires yet.
        assert!(engine.handle_event(&ControlEvent::Jog { delta: 4 }).is_empty());
        assert!(engine.handle_event(&ControlEvent::Jog { delta: 4 }).is_empty());
        // 4 + 4 + 4 = 12 >= 10: fires once, carrying the remainder (2).
        assert_eq!(
            engine.handle_event(&ControlEvent::Jog { delta: 4 }),
            vec![ctrl_b()]
        );
        // Remainder (2) + 4 + 4 = 10: fires again exactly at the boundary.
        assert!(engine.handle_event(&ControlEvent::Jog { delta: 4 }).is_empty());
        assert_eq!(
            engine.handle_event(&ControlEvent::Jog { delta: 4 }),
            vec![ctrl_b()]
        );
    }

    #[test]
    fn jog_clockwise_never_fires_on_counter_clockwise_rotation() {
        let mut profile = Profile::new("Test");
        let mapping = Mapping {
            trigger: Trigger::JogClockwise,
            threshold: 5,
            ..Mapping::simple(vec![ctrl_b()])
        };
        profile.set_mappings(ControlId::JogWheel, vec![mapping]);
        let mut engine = MappingEngine::new(profile);

        for _ in 0..5 {
            assert!(engine.handle_event(&ControlEvent::Jog { delta: -3 }).is_empty());
        }
    }

    #[test]
    fn jog_counter_clockwise_fires_on_negative_threshold_crossed() {
        let mut profile = Profile::new("Test");
        let mapping = Mapping {
            trigger: Trigger::JogCounterClockwise,
            threshold: 6,
            ..Mapping::simple(vec![ctrl_b()])
        };
        profile.set_mappings(ControlId::JogWheel, vec![mapping]);
        let mut engine = MappingEngine::new(profile);

        assert!(engine.handle_event(&ControlEvent::Jog { delta: -4 }).is_empty());
        assert_eq!(
            engine.handle_event(&ControlEvent::Jog { delta: -4 }),
            vec![ctrl_b()]
        );
    }

    #[test]
    fn jog_continuous_fires_every_event_and_scales_relative_volume() {
        let mut profile = Profile::new("Test");
        let volume_action = Action::Obs(ObsAction::SourceVolume {
            source: "Mic".into(),
            mode: VolumeMode::Relative { delta_percent: 0.0 },
        });
        let mapping = Mapping {
            trigger: Trigger::JogContinuous,
            amount_per_tick: 2.5,
            ..Mapping::simple(vec![volume_action])
        };
        profile.set_mappings(ControlId::JogWheel, vec![mapping]);
        let mut engine = MappingEngine::new(profile);

        let actions = engine.handle_event(&ControlEvent::Jog { delta: 4 });
        assert_eq!(
            actions,
            vec![Action::Obs(ObsAction::SourceVolume {
                source: "Mic".into(),
                mode: VolumeMode::Relative { delta_percent: 10.0 },
            })]
        );

        let actions = engine.handle_event(&ControlEvent::Jog { delta: -2 });
        assert_eq!(
            actions,
            vec![Action::Obs(ObsAction::SourceVolume {
                source: "Mic".into(),
                mode: VolumeMode::Relative { delta_percent: -5.0 },
            })]
        );
    }

    #[test]
    fn jog_continuous_leaves_non_continuous_actions_unscaled() {
        let mut profile = Profile::new("Test");
        let mapping = Mapping {
            trigger: Trigger::JogContinuous,
            amount_per_tick: 2.5,
            ..Mapping::simple(vec![ctrl_b()])
        };
        profile.set_mappings(ControlId::JogWheel, vec![mapping]);
        let mut engine = MappingEngine::new(profile);

        assert_eq!(
            engine.handle_event(&ControlEvent::Jog { delta: 4 }),
            vec![ctrl_b()]
        );
    }
}
