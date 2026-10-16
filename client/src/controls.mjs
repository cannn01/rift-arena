import {B} from '../../shared/engine.mjs';
// Physical KeyboardEvent.code keeps the layout independent of Shift/Caps Lock.
export const SOLO_KEYS={KeyA:B.left,KeyD:B.right,KeyW:B.up,KeyS:B.block,Space:B.jump,KeyJ:B.attack,KeyK:B.skill,KeyL:B.roll,KeyU:B.super,KeyI:B.burst};
export const LOCAL_P1_KEYS={KeyA:B.left,KeyD:B.right,KeyW:B.up,KeyS:B.block,Space:B.jump,KeyF:B.attack,KeyG:B.skill,KeyH:B.roll,KeyR:B.super,KeyT:B.burst};
export const LOCAL_P2_KEYS={ArrowLeft:B.left,ArrowRight:B.right,ArrowUp:B.up,ArrowDown:B.block,Numpad0:B.jump,Numpad1:B.attack,Numpad2:B.skill,Numpad3:B.roll,Numpad4:B.super,Numpad5:B.burst,Digit0:B.jump,Digit1:B.attack,Digit2:B.skill,Digit3:B.roll,Digit4:B.super,Digit5:B.burst};
export const CONTROL_ROWS=[
 ['Di chuyển','A / D','A / D','← / →'],
 ['Hướng lên / Đỡ','W / S','W / S','↑ / ↓'],
 ['Nhảy','Space','Space','Numpad 0'],
 ['Đánh','J','F','Numpad 1'],
 ['Kỹ năng','K','G','Numpad 2'],
 ['Lăn / Né','L','H','Numpad 3'],
 ['Tuyệt chiêu','U','R','Numpad 4'],
 ['Bộc phát','I','T','Numpad 5'],
 ['Tạm dừng','Esc','Esc','Esc']
];
export function bindingFor(code,mode){if(mode==='local'){if(code in LOCAL_P1_KEYS)return {seat:0,bit:LOCAL_P1_KEYS[code]};if(code in LOCAL_P2_KEYS)return {seat:1,bit:LOCAL_P2_KEYS[code]};return null;}return code in SOLO_KEYS?{seat:0,bit:SOLO_KEYS[code]}:null;}
