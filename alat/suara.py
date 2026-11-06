# Buat suara (ElevenLabs) + timeline dari naskah.json.  Pakai: python3 alat/suara.py video/<nama>
import json, subprocess, sys, os, wave, numpy as np
D = sys.argv[1]; os.chdir(D)
N = json.load(open('naskah.json')); B = N['baris']
VOICE = N.get('suara', 'pNInz6obpgDQGcFmaJgB')  # default: Adam
FPS, SR = 30, 44100
ulang = '--ulang' in sys.argv
for i, b in enumerate(B, 1):
    mp3, wav = f'vo{i:02d}.mp3', f'vo{i:02d}.wav'
    if ulang or not os.path.exists(mp3) or json.load(open('.tts_cache.json')).get(str(i)) != b['tts'] if os.path.exists('.tts_cache.json') else True:
        body = {"text": b['tts'], "model_id": "eleven_multilingual_v2",
                "voice_settings": {"stability": 0.42, "similarity_boost": 0.8, "style": 0.4, "use_speaker_boost": True}}
        if i > 1: body['previous_text'] = B[i - 2]['tts']
        if i < len(B): body['next_text'] = B[i]['tts']
        r = subprocess.run(['curl', '-sS', '-X', 'POST', f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128',
                            '-H', 'xi-api-key: proxy-injected', '-H', 'Content-Type: application/json', '-d', json.dumps(body), '-o', mp3, '-w', '%{http_code}'],
                           capture_output=True, text=True)
        if r.stdout != '200': sys.exit(f'Gagal TTS baris {i}: HTTP {r.stdout} {open(mp3).read()[:200]}')
        c = json.load(open('.tts_cache.json')) if os.path.exists('.tts_cache.json') else {}
        c[str(i)] = b['tts']; json.dump(c, open('.tts_cache.json', 'w'))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp3, '-ac', '1', '-ar', str(SR), '-af',
                    'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse', wav], check=True)
# timeline: jeda 0.35 detik antar baris; setelah baris ber-efek "krik" diberi jeda 1.4 detik
t, seg = 0.0, []
for i, b in enumerate(B, 1):
    t += 0.35 if i == 1 or B[i - 2].get('sfx') != 'krik' else 1.4
    w = wave.open(f'vo{i:02d}.wav'); d = w.getnframes() / SR
    seg.append({'id': i, 'start': round(t, 3), 'dur': round(d, 3), 'cap': b['cap']}); t += d
total = round(t + 1.4, 3); n = int(total * SR)
track = np.zeros(n, dtype=np.float32)
for s in seg:
    w = wave.open(f"vo{s['id']:02d}.wav"); a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    i = int(s['start'] * SR); k = min(len(a), n - i); track[i:i + k] += a[:k]
hop = SR // FPS
amp = [float(np.sqrt(np.mean(track[f * hop:(f + 1) * hop] ** 2))) for f in range(int(total * FPS))]
mx = max(amp) or 1; amp = [round(a / mx, 3) for a in amp]
w = wave.open('vo_track.wav', 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.clip(track, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
json.dump({'fps': FPS, 'durasi': total, 'segmen': seg, 'amp': amp}, open('timeline.json', 'w'), ensure_ascii=False)
print(f'durasi {total} detik, {len(seg)} baris')
