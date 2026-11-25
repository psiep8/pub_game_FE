// Pitch shifter granulare a due teste: cambia l'intonazione senza toccare la
// velocità del brano (playbackRate resta 1). Gira nell'AudioWorklet per non
// occupare il thread principale. Se il browser non lo carica, la manche 2
// continua con gli altri effetti (nesun finto pitch shift).
class PitchShiftProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'ratio', defaultValue: 0.82, minValue: 0.5, maxValue: 1.5, automationRate: 'k-rate' }];
  }

  constructor() {
    super();
    this.size = 1 << 15;
    this.buffer = new Float32Array(this.size);
    this.writeIndex = 0;
    this.phase = 0;
    this.grain = 1536;
  }

  read(delaySamples) {
    let position = this.writeIndex - delaySamples;
    while (position < 0) position += this.size;
    const index = Math.floor(position);
    const next = (index + 1) % this.size;
    const fraction = position - index;
    return this.buffer[index % this.size] * (1 - fraction) + this.buffer[next] * fraction;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0] && inputs[0][0];
    const output = outputs[0] && outputs[0][0];
    if (!output) return true;
    if (!input) {
      output.fill(0);
      return true;
    }

    const ratio = Math.min(1.5, Math.max(0.5, parameters.ratio[0] ?? 0.82));
    const step = (1 - ratio) / this.grain;
    const base = 2 * this.grain;

    for (let i = 0; i < output.length; i++) {
      this.buffer[this.writeIndex] = input[i];
      this.writeIndex = (this.writeIndex + 1) % this.size;

      this.phase += step;
      if (this.phase >= 1) this.phase -= 1;
      else if (this.phase < 0) this.phase += 1;

      // Due teste a mezzo grano di distanza, pesi sin²/cos²: quando una testa
      // riavvolge il suo peso è zero, quindi nessun click.
      const a = Math.sin(Math.PI * this.phase);
      const b = Math.cos(Math.PI * this.phase);
      const second = (this.phase + 0.5) % 1;
      output[i] =
        this.read(base + this.phase * this.grain) * a * a +
        this.read(base + second * this.grain) * b * b;
    }
    return true;
  }
}

registerProcessor('pitch-shift', PitchShiftProcessor);
