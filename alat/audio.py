# Campur suara + efek suara jadi audio_final.wav.  Pakai: python3 alat/audio.py video/<nama>
import json, wave, sys, os, numpy as np
os.chdir(sys.argv[1]); SR = 44100
def baca(fn):
    w = wave.open(fn); return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
t = lambda d: np.arange(int(d * SR)) / SR
rng = np.random.default_rng(3)
def pop():
    x = t(0.12); f = 900 * np.exp(-x * 18) + 500; return 0.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 35)
def whoosh():
    x = t(0.5); n = np.convolve(rng.standard_normal(len(x)), np.ones(25) / 25, 'same'); return 0.6 * n * np.sin(np.pi * x / 0.5) ** 2
def krik():
    out = np.zeros(int(1.6 * SR))
    for s in (0.0, 0.75):
        for j in range(4):
            x = t(0.035); ch = 0.25 * np.sin(2 * np.pi * 4300 * x) * np.sin(np.pi * x / 0.035); i = int((s + j * 0.06) * SR); out[i:i + len(ch)] += ch
    return out
def tada():
    out = np.zeros(int(0.9 * SR))
    for i, f in enumerate([523, 659, 784, 1047]):
        x = t(0.5); s = 0.18 * (np.sin(2 * np.pi * f * x) + 0.4 * np.sin(4 * np.pi * f * x)) * np.exp(-x * 5); a = int(i * 0.08 * SR); out[a:a + len(s)] += s
    return out
def stempel():
    x = t(0.25); return 0.7 * np.sin(2 * np.pi * 90 * x) * np.exp(-x * 22) + 0.25 * rng.standard_normal(len(x)) * np.exp(-x * 40)
SFX = {'pop': pop(), 'whoosh': whoosh(), 'krik': krik(), 'tada': tada(), 'stempel': stempel()}
mix = baca('vo_track.wav').copy()
for tt, j in json.load(open('sfx.json')):
    s = SFX.get(j); i = int(tt * SR)
    if s is None or i >= len(mix): continue
    n = min(len(s), len(mix) - i); mix[i:i + n] += s[:n] * 0.55
mix = np.clip(mix / max(1.0, np.abs(mix).max() / 0.95), -1, 1)
w = wave.open('audio_final.wav', 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes()); w.close()
print('audio', round(len(mix) / SR, 2), 'detik')
