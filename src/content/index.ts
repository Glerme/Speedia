import { registerMedia } from './media';
import { initializeUI } from './ui';
import { bindPlayerControls } from './pip';
import { registerEvents } from './events';
registerMedia();
initializeUI();
bindPlayerControls();
registerEvents();
