"""Pipeline completo demo-video:
1. Playwright captura cada HTML como PNG 1920x1080
2. edge-tts genera MP3 por escena (voz es-ES natural)
3. ffmpeg compone video sincronizando imagen + audio + crossfade entre escenas
Output: ../public/downloads/cluberly-demo.mp4
"""
import os, asyncio, subprocess, sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
SCENES_DIR = SCRIPT_DIR / 'scenes'
NARRATION_DIR = SCRIPT_DIR / 'narration'
FRAMES_DIR = SCRIPT_DIR / 'frames'
AUDIO_DIR = SCRIPT_DIR / 'audio'
OUT_PATH = SCRIPT_DIR.parent / 'public' / 'downloads' / 'cluberly-demo.mp4'

FRAMES_DIR.mkdir(exist_ok=True)
AUDIO_DIR.mkdir(exist_ok=True)
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

VOICE = 'es-ES-AlvaroNeural'  # voz natural masculina española
RATE = '+0%'

scene_files = sorted(SCENES_DIR.glob('*.html'))
print(f'Escenas: {len(scene_files)}')

# ── 1. Capturar PNGs con Playwright ─────────────────────────────────────────
def capture_frames():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = ctx.new_page()
        for scene in scene_files:
            out = FRAMES_DIR / f'{scene.stem}.png'
            if out.exists():
                print(f'  · {scene.stem}.png ya existe, skip')
                continue
            page.goto(f'file:///{scene.resolve().as_posix()}', wait_until='networkidle')
            page.wait_for_timeout(800)
            page.screenshot(path=str(out), full_page=False, clip={'x':0,'y':0,'width':1920,'height':1080})
            print(f'  ✓ {scene.stem}.png')
        browser.close()

# ── 2. Generar audio con edge-tts ───────────────────────────────────────────
async def generate_audio_one(idx, text):
    import edge_tts
    out = AUDIO_DIR / f'{idx}.mp3'
    if out.exists():
        print(f'  · {out.name} ya existe, skip')
        return
    tts = edge_tts.Communicate(text, VOICE, rate=RATE)
    await tts.save(str(out))
    print(f'  ✓ {out.name}')

async def generate_all_audio():
    for idx_file in sorted(NARRATION_DIR.glob('*.txt')):
        text = idx_file.read_text(encoding='utf-8').strip()
        await generate_audio_one(idx_file.stem, text)

# ── 3. Calcular duración de cada audio para sincronizar ─────────────────────
def audio_duration(path):
    out = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'default=noprint_wrappers=1:nokey=1', str(path)],
        capture_output=True, text=True, check=True
    )
    return float(out.stdout.strip())

# ── 4. Componer video con ffmpeg ────────────────────────────────────────────
def compose():
    # Para cada escena: convertir PNG -> MP4 con duración = audio.mp3 + 0.3s padding
    scene_videos = []
    for scene in scene_files:
        stem = scene.stem
        frame = FRAMES_DIR / f'{stem}.png'
        audio = AUDIO_DIR / f'{stem.split("-")[0]}.mp3'
        if not frame.exists() or not audio.exists():
            print(f'  ✗ falta frame o audio para {stem}')
            continue
        dur = audio_duration(audio) + 0.4  # 0.4s padding final
        out_mp4 = FRAMES_DIR / f'{stem}.mp4'
        # PNG estático + audio narración
        cmd = ['ffmpeg', '-y',
               '-loop', '1', '-i', str(frame),
               '-i', str(audio),
               '-c:v', 'libx264', '-tune', 'stillimage',
               '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p',
               '-shortest', '-t', f'{dur:.2f}',
               '-vf', 'scale=1920:1080,format=yuv420p',
               '-r', '30',
               str(out_mp4)]
        subprocess.run(cmd, check=True, capture_output=True)
        scene_videos.append(out_mp4)
        print(f'  ✓ {out_mp4.name} ({dur:.1f}s)')

    # Concatenar todos los MP4 en uno final
    concat_file = SCRIPT_DIR / 'concat.txt'
    concat_file.write_text('\n'.join(f"file '{p.resolve().as_posix()}'" for p in scene_videos), encoding='utf-8')
    print(f'\nComponiendo video final...')
    cmd = ['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', str(concat_file),
           '-c:v', 'libx264', '-c:a', 'aac', '-b:v', '4M',
           '-movflags', '+faststart', str(OUT_PATH)]
    subprocess.run(cmd, check=True, capture_output=True)
    size = OUT_PATH.stat().st_size // 1024
    print(f'\n✅ Video generado: {OUT_PATH} ({size} KB)')

if __name__ == '__main__':
    print('1️⃣  Capturando frames con Playwright...')
    capture_frames()
    print('\n2️⃣  Generando voz en off con edge-tts...')
    asyncio.run(generate_all_audio())
    print('\n3️⃣  Componiendo video...')
    compose()
