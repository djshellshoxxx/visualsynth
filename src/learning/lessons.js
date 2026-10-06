const lesson=(id,topic,title,summary)=>({id,topic,title,summary,steps:[{title:'Listen',instruction:summary},{title:'Change it',instruction:'Adjust the highlighted control and listen while watching the signal path.'},{title:'Compare',instruction:'Use the original value as an A/B reference, then restore or keep your change.'}]});
export const LESSONS=Object.freeze([
lesson('waveform','waveform','Waveform shape','Compare sine, triangle, saw and pulse spectra.'),
lesson('frequency','frequency','Frequency and pitch','Change pitch and relate frequency to musical note height.'),
lesson('amplitude','amplitude','Amplitude','Hear level changes and watch the output meter.'),
lesson('harmonics','harmonics','Harmonics','Build a tone from partials and compare spectral balance.'),
lesson('osc-mixing','oscillator-mixing','Oscillator mixing','Blend two oscillators and observe summing and headroom.'),
lesson('phase','phase','Phase','Compare phase relationships and cancellation.'),
lesson('detune','detune','Detune','Spread oscillator frequency for beating and width.'),
lesson('filter','filter','Filtering','Sweep cutoff and watch the response curve.'),
lesson('resonance','resonance','Resonance','Increase resonance and hear emphasis near cutoff.'),
lesson('adsr','adsr','ADSR envelope','Shape attack, decay, sustain and release.'),
lesson('lfo','lfo','LFO modulation','Route a slow control source to pitch or cutoff.'),
lesson('fm','fm','Frequency modulation','Use audio-rate frequency modulation for sidebands.'),
lesson('am','am','Amplitude modulation','Multiply amplitude with an oscillator-rate control.'),
lesson('pwm','pwm','Pulse-width modulation','Animate pulse width and hear harmonic movement.'),
lesson('subtractive','subtractive','Subtractive synthesis','Start bright and remove harmonics with a filter.'),
lesson('additive','additive','Additive synthesis','Construct timbre by choosing harmonic amplitudes.'),
lesson('wavetable','wavetable','Wavetable synthesis','Morph between periodic wave shapes.'),
lesson('routing','routing','Signal routing','Trace typed connections from source to destination.'),
lesson('effects','effects','Effects chain','Compare dry and processed signal through effects.'),
lesson('patch-building','patch-building','Build a patch','Assemble input, oscillator, envelope, VCA and output.')
]);
