import { allVideos, SPEEDS, settings, t } from './state';
import { renderSettings, toast } from './ui';
// ---------------------------------------------------------------- velocidade
export function applySpeed(v: HTMLVideoElement) {
    // Transmissões ao vivo não têm duração finita; acelerar só causaria travamento.
    if (v.readyState > 0 && !isFinite(v.duration))
        return;
    if (v.playbackRate !== settings.speed)
        v.playbackRate = settings.speed;
}
// A velocidade não é salva: toda página começa em 1× e a escolha vale até recarregar.
export function setSpeed(s: number) {
    settings.speed = s;
    renderSettings();
    allVideos().forEach(applySpeed);
}
// Sobe ou desce uma fase na lista de velocidades, parando nas pontas.
export function stepSpeed(dir: number) {
    const i = SPEEDS.indexOf(settings.speed);
    const next = SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, i + dir))];
    if (next !== settings.speed)
        setSpeed(next);
    toast(t('toastSpeed', next));
}
