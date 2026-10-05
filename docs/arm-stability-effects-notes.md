# Arm stability, signal labels, presets, and effects

This change set fixes cable/arm instability during parameter edits and expands the factory synth configuration set.

## Arm stability

Parameter preview and commit events no longer rebuild the workspace DOM. Existing module cards and cable SVG paths remain in place while controls are adjusted. Cable geometry is recalculated only for actual layout or topology changes.

## Cable signal labels

Each cable displays source/output and destination/input information along the cable path, including module, port, and signal type.

## Presets

The Quick Setup bank now contains 24 validated configurations, including basses, leads, pads, filtered patches, distorted patches, delay/echo patches, and an init patch.

## Effects

Patchable effects include:

- Multimode filter: low-pass, high-pass, band-pass, notch
- Distortion with drive, tone, and mix
- Delay with time, feedback, damping, and mix
- Echo with time, feedback, damping, and mix

The newer Standard Noise module and available-module catalogue from main are retained.
